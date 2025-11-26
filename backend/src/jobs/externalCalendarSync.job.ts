// backend/src/jobs/externalCalendarSync.job.ts
import cron from 'node-cron';
import db from '../config/database';
import externalCalendarSyncService from '../services/externalCalendarSync.service';
import logger from '../utils/logger';

class ExternalCalendarSyncJob {
  /**
   * Запуск периодической синхронизации внешних календарей
   */
  start() {
    // Синхронизация каждые 15 минут
    cron.schedule('*/15 * * * *', async () => {
      logger.info('Starting external calendars synchronization job');
      await this.syncAllProperties();
    });

    // Синхронизация при старте сервера (через 2 минуты)
    setTimeout(() => {
      logger.info('Starting initial sync after server start');
      this.syncAllProperties();
    }, 120000);

    logger.info('External calendar sync job scheduled (every 15 minutes)');
  }

  /**
   * Синхронизация всех объектов с внешними календарями
   */
  async syncAllProperties() {
    try {
      // Получаем все объекты, у которых есть активные внешние календари
      const propertiesResult: any = await db.query(
        `SELECT DISTINCT p.id, p.property_number
         FROM properties p
         INNER JOIN property_external_calendars ec ON p.id = ec.property_id
         WHERE ec.is_enabled = 1
         AND p.deleted_at IS NULL`
      );

      const properties = Array.isArray(propertiesResult[0]) 
        ? propertiesResult[0] 
        : propertiesResult;

      logger.info(`Found ${properties.length} properties with active external calendars`);

      let successCount = 0;
      let errorCount = 0;

      for (const property of properties) {
        try {
          const result = await externalCalendarSyncService.syncPropertyCalendars(property.id);
          
          if (result.success) {
            successCount++;
            logger.info(
              `Property ${property.id} (${property.property_number}) synced: ${result.syncedCalendars} calendars, ${result.totalEvents} events`
            );
          } else {
            errorCount++;
            logger.warn(
              `Property ${property.id} (${property.property_number}) sync completed with errors: ${result.errors.join(', ')}`
            );
          }
        } catch (error) {
          errorCount++;
          logger.error(`Failed to sync property ${property.id}:`, error);
        }

        // Небольшая задержка между синхронизациями (2 секунды)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      logger.info(
        `External calendars sync job completed: ${successCount} success, ${errorCount} errors`
      );
    } catch (error) {
      logger.error('External calendar sync job error:', error);
    }
  }

  /**
   * Синхронизация конкретного объекта (для ручного вызова)
   */
  async syncProperty(propertyId: number) {
    try {
      logger.info(`Starting manual sync for property ${propertyId}`);
      const result = await externalCalendarSyncService.syncPropertyCalendars(propertyId);
      logger.info(`Manual sync for property ${propertyId} completed:`, result);
      return result;
    } catch (error) {
      logger.error(`Failed to manually sync property ${propertyId}:`, error);
      throw error;
    }
  }
}

export default new ExternalCalendarSyncJob();