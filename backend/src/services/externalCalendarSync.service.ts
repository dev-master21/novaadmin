// backend/src/services/externalCalendarSync.service.ts
import axios from 'axios';
import * as ical from 'ical';
import cron from 'node-cron';
import db from '../config/database';
import logger from '../utils/logger';
import icsGeneratorService from './icsGenerator.service';
import { RowDataPacket } from 'mysql2';

interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
}

interface ExternalCalendar extends RowDataPacket {
  id: number;
  property_id: number;
  calendar_name: string;
  ics_url: string;
  is_enabled: boolean;
}

interface CalendarConflict {
  date: string;
  calendars: Array<{
    calendar_id: number;
    calendar_name: string;
    event_summary: string;
    event_description?: string;
    period_start: string;
    period_end: string;
  }>;
}

class ExternalCalendarSyncService {
  /**
   * Валидация .ics URL
   */
  async validateIcsUrl(url: string): Promise<{ valid: boolean; error?: string; eventsCount?: number }> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'NovaEstate Calendar Sync/1.0'
        }
      });

      if (response.status !== 200) {
        return { valid: false, error: 'Не удалось загрузить календарь' };
      }

      // Парсим ICS
      const data = ical.parseICS(response.data);
      const events = Object.values(data).filter((event: any) => event.type === 'VEVENT');

      if (events.length === 0) {
        return { valid: false, error: 'Календарь не содержит событий' };
      }

      return { valid: true, eventsCount: events.length };
    } catch (error: any) {
      logger.error('ICS validation error:', error);
      return { 
        valid: false, 
        error: error.code === 'ENOTFOUND' ? 'URL недоступен' : 'Ошибка загрузки календаря' 
      };
    }
  }

  /**
   * Получить события из .ics файла
   */
  async fetchCalendarEvents(url: string): Promise<CalendarEvent[]> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'NovaEstate Calendar Sync/1.0'
        }
      });

      const data = ical.parseICS(response.data);
      const events: CalendarEvent[] = [];

      for (const key in data) {
        const event = data[key];
        if (event.type === 'VEVENT' && event.start && event.end) {
          events.push({
            uid: event.uid || `${Date.now()}-${Math.random()}`,
            start: new Date(event.start),
            end: new Date(event.end),
            summary: event.summary || 'Booked',
            description: event.description || undefined
          });
        }
      }

      return events;
    } catch (error) {
      logger.error('Fetch calendar events error:', error);
      throw new Error('Не удалось загрузить события календаря');
    }
  }

  /**
   * Синхронизация одного внешнего календаря
   * Возвращает количество событий
   */
  async syncCalendar(
    connection: any,
    propertyId: number,
    calendarId: number,
    icsUrl: string
  ): Promise<number> {
    try {
      const events = await this.fetchCalendarEvents(icsUrl);

      // Удаляем старые даты из этого календаря
      await connection.query(
        'DELETE FROM property_calendar WHERE property_id = ? AND source_calendar_id = ?',
        [propertyId, calendarId]
      );

      // Добавляем новые события
      for (const event of events) {
        const dates = this.getDateRange(event.start, event.end);
        
        if (dates.length === 0) continue;

        const isCheckIn = (dateStr: string) => dateStr === dates[0];
        const isCheckOut = (dateStr: string) => dateStr === dates[dates.length - 1];

        for (const date of dates) {
          await connection.query(
            `INSERT INTO property_calendar 
             (property_id, blocked_date, reason, source_calendar_id, event_uid, is_check_in, is_check_out)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               reason = VALUES(reason),
               source_calendar_id = VALUES(source_calendar_id),
               event_uid = VALUES(event_uid),
               is_check_in = VALUES(is_check_in),
               is_check_out = VALUES(is_check_out)`,
            [
              propertyId,
              date,
              event.summary,
              calendarId,
              event.uid,
              isCheckIn(date) ? 1 : 0,
              isCheckOut(date) ? 1 : 0
            ]
          );
        }
      }

      return events.length;
    } catch (error) {
      logger.error(`Sync calendar ${calendarId} error:`, error);
      throw error;
    }
  }

  /**
   * Анализ пересечений между календарями
   */
  async analyzeCalendarConflicts(propertyId: number, calendarIds: number[]): Promise<{
    conflicts: CalendarConflict[];
    totalConflicts: number;
    calendarsAnalyzed: number;
  }> {
    try {
      // Загружаем все календари
      const calendarsResult: any = await db.query(
        `SELECT id, property_id, calendar_name, ics_url, is_enabled
         FROM property_external_calendars
         WHERE property_id = ? AND id IN (${calendarIds.map(() => '?').join(',')})`,
        [propertyId, ...calendarIds]
      );

      const calendars = (Array.isArray(calendarsResult[0]) 
        ? calendarsResult[0] 
        : calendarsResult) as ExternalCalendar[];

      if (calendars.length < 2) {
        return { conflicts: [], totalConflicts: 0, calendarsAnalyzed: calendars.length };
      }

      // Загружаем события из каждого календаря
      const calendarEvents = new Map<number, CalendarEvent[]>();
      for (const calendar of calendars) {
        try {
          const events = await this.fetchCalendarEvents(calendar.ics_url);
          calendarEvents.set(calendar.id, events);
        } catch (error) {
          logger.error(`Failed to fetch calendar ${calendar.id}:`, error);
          calendarEvents.set(calendar.id, []);
        }
      }

      // Находим пересечения
      const conflictsMap = new Map<string, CalendarConflict>();

      // Создаем карту дат для каждого календаря
      const dateToCalendarsMap = new Map<string, Array<{
        calendarId: number;
        calendarName: string;
        event: CalendarEvent;
      }>>();

      for (const [calendarId, events] of calendarEvents.entries()) {
        const calendar = calendars.find(c => c.id === calendarId);
        if (!calendar) continue;

        for (const event of events) {
          const dates = this.getDateRange(event.start, event.end);
          
          for (const date of dates) {
            if (!dateToCalendarsMap.has(date)) {
              dateToCalendarsMap.set(date, []);
            }
            dateToCalendarsMap.get(date)!.push({
              calendarId,
              calendarName: calendar.calendar_name,
              event
            });
          }
        }
      }

      // Находим даты с пересечениями (присутствуют в 2+ календарях)
      for (const [date, calendarsList] of dateToCalendarsMap.entries()) {
        if (calendarsList.length > 1) {
          conflictsMap.set(date, {
            date,
            calendars: calendarsList.map(item => ({
              calendar_id: item.calendarId,
              calendar_name: item.calendarName,
              event_summary: item.event.summary,
              event_description: item.event.description,
              period_start: this.formatDate(item.event.start),
              period_end: this.formatDate(item.event.end)
            }))
          });
        }
      }

      const conflicts = Array.from(conflictsMap.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      return {
        conflicts,
        totalConflicts: conflicts.length,
        calendarsAnalyzed: calendars.length
      };
    } catch (error) {
      logger.error('Analyze calendar conflicts error:', error);
      throw new Error('Ошибка анализа пересечений календарей');
    }
  }

  /**
   * Синхронизация внешних календарей для объекта
   */
  async syncPropertyCalendars(propertyId: number): Promise<{
    success: boolean;
    syncedCalendars: number;
    totalEvents: number;
    errors: string[];
  }> {
    const connection = await db.beginTransaction();

    try {
      // Получаем информацию об объекте
      const propertyResult: any = await connection.query(
        'SELECT id, property_number FROM properties WHERE id = ? AND deleted_at IS NULL',
        [propertyId]
      );

      const properties = Array.isArray(propertyResult[0]) 
        ? propertyResult[0] 
        : propertyResult;

      const property = properties[0];

      if (!property) {
        await connection.rollback();
        throw new Error('Property not found');
      }

      // Получаем все включенные календари для объекта
      const calendarsResult: any = await connection.query(
        `SELECT id, property_id, calendar_name, ics_url, is_enabled
         FROM property_external_calendars
         WHERE property_id = ? AND is_enabled = 1`,
        [propertyId]
      );

      const calendars = (Array.isArray(calendarsResult[0]) 
        ? calendarsResult[0] 
        : calendarsResult) as ExternalCalendar[];

      if (calendars.length === 0) {
        await connection.commit();
        return { success: true, syncedCalendars: 0, totalEvents: 0, errors: [] };
      }

      const errors: string[] = [];
      let totalEvents = 0;
      let syncedCount = 0;

      // Синхронизируем каждый календарь
      for (const calendar of calendars) {
        try {
          const eventCount = await this.syncCalendar(
            connection,
            propertyId,
            calendar.id,
            calendar.ics_url
          );

          totalEvents += eventCount;
          syncedCount++;

          // Обновляем информацию о календаре
          await connection.query(
            `UPDATE property_external_calendars
             SET last_sync_at = NOW(), sync_error = NULL, total_events = ?
             WHERE id = ?`,
            [eventCount, calendar.id]
          );

          logger.info(`Synced calendar ${calendar.id} for property ${propertyId}: ${eventCount} events`);

        } catch (error: any) {
          const errorMsg = `${calendar.calendar_name}: ${error.message}`;
          errors.push(errorMsg);
          
          // Сохраняем ошибку в БД
          await connection.query(
            `UPDATE property_external_calendars
             SET sync_error = ?
             WHERE id = ?`,
            [error.message, calendar.id]
          );

          logger.error(`Failed to sync calendar ${calendar.id}:`, error);
        }
      }

      // ВАЖНО: Генерируем объединенный .ics файл после синхронизации
      await this.generateMergedICS(propertyId, property.property_number, connection);

      await connection.commit();

      return {
        success: errors.length === 0,
        syncedCalendars: syncedCount,
        totalEvents,
        errors
      };

    } catch (error) {
      await connection.rollback();
      logger.error('Sync property calendars error:', error);
      throw error;
    }
  }

  /**
   * Генерация объединенного .ics файла
   */
  private async generateMergedICS(
    propertyId: number, 
    propertyNumber: string,
    connection?: any
  ): Promise<void> {
    const dbConn = connection || db;

    // Получаем ВСЕ заблокированные даты (включая вручную добавленные)
    const allBlockedDatesResult: any = await dbConn.query(
      'SELECT blocked_date, reason FROM property_calendar WHERE property_id = ? ORDER BY blocked_date',
      [propertyId]
    );

    const allBlockedDates = Array.isArray(allBlockedDatesResult[0])
      ? allBlockedDatesResult[0]
      : allBlockedDatesResult;

    // Генерируем .ics файл
    const icsData = await icsGeneratorService.generateICSFile(
      propertyId,
      propertyNumber,
      allBlockedDates
    );

    // Обновляем информацию о .ics файле
    await dbConn.query(
      `INSERT INTO property_ics (property_id, ics_url, ics_filename, ics_file_path, total_blocked_days)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         ics_url = VALUES(ics_url),
         ics_filename = VALUES(ics_filename),
         ics_file_path = VALUES(ics_file_path),
         total_blocked_days = VALUES(total_blocked_days),
         updated_at = NOW()`,
      [propertyId, icsData.url, icsData.filename, icsData.filepath, allBlockedDates.length]
    );

    logger.info(`Generated merged ICS for property ${propertyId}: ${allBlockedDates.length} blocked dates`);
  }

/**
   * Настройка автоматической синхронизации (каждые 15 минут)
   */
  setupAutoSync(): void {
    // Каждые 15 минут
    cron.schedule('*/15 * * * *', async () => {
      logger.info('Starting scheduled external calendars sync');
      
      try {
        // Получаем все объекты с включенными внешними календарями
        const propertiesResult: any = await db.query(`
          SELECT DISTINCT p.id, p.property_number
          FROM properties p
          INNER JOIN property_external_calendars pec ON p.id = pec.property_id
          WHERE pec.is_enabled = 1 
            AND p.deleted_at IS NULL
        `);

        const properties = Array.isArray(propertiesResult[0]) 
          ? propertiesResult[0] 
          : propertiesResult;

        logger.info(`Found ${properties.length} properties with active external calendars`);

        for (const property of properties) {
          try {
            const result = await this.syncPropertyCalendars(property.id);
            
            if (result.success) {
              logger.info(
                `Auto-sync completed for property ${property.id}: ${result.syncedCalendars} calendars, ${result.totalEvents} events`
              );
            } else {
              logger.warn(
                `Auto-sync for property ${property.id} completed with errors: ${result.errors.join(', ')}`
              );
            }

            // Небольшая задержка между объектами
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error(`Failed to auto-sync property ${property.id}:`, error);
          }
        }

        logger.info('Scheduled external calendars sync completed');
      } catch (error) {
        logger.error('Scheduled sync error:', error);
      }
    });

    logger.info('External calendar auto-sync scheduled (every 15 minutes)');
  }

  /**
   * Получить все даты в диапазоне
   */
  private getDateRange(start: Date, end: Date): string[] {
    const dates: string[] = [];
    const currentDate = new Date(start);
    currentDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setUTCHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      dates.push(this.formatDate(currentDate));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * Форматировать дату в YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export default new ExternalCalendarSyncService();