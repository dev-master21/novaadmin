import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

class RequestsController {
  /**
   * Получить все заявки (для админ-панели)
   * GET /api/requests
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, agent_id, search, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = ['r.deleted_at IS NULL'];
      const queryParams: any[] = [];

      if (status) {
        whereConditions.push('r.status = ?');
        queryParams.push(status);
      }

      if (agent_id) {
        whereConditions.push('r.agent_id = ?');
        queryParams.push(agent_id);
      }

      if (search) {
        whereConditions.push(`(
          r.request_number LIKE ? OR 
          r.client_first_name LIKE ? OR 
          r.client_last_name LIKE ? OR 
          r.client_username LIKE ? OR
          r.client_phone LIKE ?
        )`);
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Получаем общее количество
      const countQuery = `
        SELECT COUNT(*) as total
        FROM requests r
        ${whereClause}
      `;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем заявки
      const query = `
        SELECT 
          r.*,
          ra.telegram_username as agent_username,
          ra.first_name as agent_first_name,
          ra.last_name as agent_last_name,
          (SELECT COUNT(*) FROM request_messages WHERE request_id = r.id) as messages_count,
          (SELECT COUNT(*) FROM request_analytics WHERE request_id = r.id AND action_type = 'chat_view') as chat_views_count,
          (SELECT COUNT(*) FROM request_analytics WHERE request_id = r.id AND action_type = 'request_view') as request_views_count
        FROM requests r
        LEFT JOIN request_agents ra ON r.agent_id = ra.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limitNum, offset);
      const requests = await db.query(query, queryParams);

      res.json({
        success: true,
        data: requests,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения заявок'
      });
    }
  }

  /**
   * Получить заявку по ID (для админ-панели)
   * GET /api/requests/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const request = await db.queryOne(`
        SELECT 
          r.*,
          ra.telegram_username as agent_username,
          ra.first_name as agent_first_name,
          ra.last_name as agent_last_name
        FROM requests r
        LEFT JOIN request_agents ra ON r.agent_id = ra.id
        WHERE r.id = ? AND r.deleted_at IS NULL
      `, [id]);

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Получаем предложенные варианты
      const proposedProperties = await db.query(`
        SELECT 
          rpp.*,
          p.property_number,
          pt.property_name,
          p.address
        FROM request_proposed_properties rpp
        LEFT JOIN properties p ON rpp.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
        WHERE rpp.request_id = ?
        ORDER BY rpp.proposed_at DESC
      `, [id]);

      res.json({
        success: true,
        data: {
          ...request,
          proposed_properties: proposedProperties
        }
      });
    } catch (error) {
      logger.error('Get request by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения заявки'
      });
    }
  }

  /**
   * Получить заявку по UUID (публичный endpoint)
   * GET /api/requests/public/:uuid
   */
  async getByUuid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      const request = await db.queryOne(`
        SELECT 
          r.*,
          ra.telegram_username as agent_username,
          ra.first_name as agent_first_name,
          ra.last_name as agent_last_name
        FROM requests r
        LEFT JOIN request_agents ra ON r.agent_id = ra.id
        WHERE r.uuid = ? AND r.deleted_at IS NULL
      `, [uuid]);

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Получаем предложенные варианты
      const proposedProperties = await db.query(`
        SELECT 
          rpp.*,
          p.property_number,
          pt.property_name,
          p.address
        FROM request_proposed_properties rpp
        LEFT JOIN properties p ON rpp.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'ru'
        WHERE rpp.request_id = ?
        ORDER BY rpp.proposed_at DESC
      `, [(request as any).id]);

      // Логируем просмотр
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;

      await db.query(`
        INSERT INTO request_analytics (request_id, action_type, ip_address, user_agent)
        VALUES (?, 'request_view', ?, ?)
      `, [(request as any).id, ipAddress, userAgent]);

      res.json({
        success: true,
        data: {
          ...request,
          proposed_properties: proposedProperties
        }
      });
    } catch (error) {
      logger.error('Get request by UUID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения заявки'
      });
    }
  }

/**
 * Получить историю чата по chat_uuid (публичный endpoint)
 * GET /api/requests/chat/:chatUuid
 */
async getChatHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { chatUuid } = req.params;

    // Находим заявку
    const request = await db.queryOne(`
      SELECT 
        id, 
        request_number,
        request_source,
        client_telegram_id,
        client_first_name, 
        client_last_name, 
        client_username,
        whatsapp_phone
      FROM requests
      WHERE chat_uuid = ? AND deleted_at IS NULL
    `, [chatUuid]);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'История чата не найдена'
      });
      return;
    }

    // Получаем все сообщения
    const messages = await db.query(`
      SELECT *
      FROM request_messages
      WHERE request_id = ?
      ORDER BY message_date ASC
    `, [(request as any).id]);

    // Логируем просмотр истории
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await db.query(`
      INSERT INTO request_analytics (request_id, action_type, ip_address, user_agent)
      VALUES (?, 'chat_view', ?, ?)
    `, [(request as any).id, ipAddress, userAgent]);

    res.json({
      success: true,
      data: {
        request_info: request,
        messages: messages
      }
    });
  } catch (error) {
    logger.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории чата'
    });
  }
}

  /**
   * Обновить поле заявки (публичный endpoint)
   * PUT /api/requests/public/:uuid/field
   */
  async updateField(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;
      const { field_name, field_value, agent_telegram_id } = req.body;

      // Проверяем существование заявки
      const request: any = await db.queryOne(
        'SELECT * FROM requests WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Разрешенные поля для обновления
      const allowedFields = [
        'description', 'check_in_date', 'check_out_date', 'budget',
        'notes', 'rental_period', 'district', 'rental_dates',
        'villa_name_address', 'rental_cost', 'cost_includes',
        'utilities_cost', 'payment_terms', 'deposit_amount', 'additional_terms'
      ];

      if (!allowedFields.includes(field_name)) {
        res.status(400).json({
          success: false,
          message: 'Недопустимое поле для обновления'
        });
        return;
      }

      // Получаем старое значение
      const oldValue = (request as any)[field_name];

      // Обновляем поле
      await db.query(
        `UPDATE requests SET ${field_name} = ?, updated_at = NOW() WHERE id = ?`,
        [field_value, request.id]
      );

      // Находим или создаем агента
      let agentId = null;
      if (agent_telegram_id) {
        let agent: any = await db.queryOne(
          'SELECT id FROM request_agents WHERE telegram_id = ?',
          [agent_telegram_id]
        );

        if (!agent) {
          const result = await db.query(
            'INSERT INTO request_agents (telegram_id) VALUES (?)',
            [agent_telegram_id]
          );
          agentId = (result as any)[0].insertId;
        } else {
          agentId = agent.id;
        }
      }

      // Сохраняем историю изменений
      await db.query(`
        INSERT INTO request_field_history (request_id, field_name, old_value, new_value, changed_by_agent_id)
        VALUES (?, ?, ?, ?, ?)
      `, [request.id, field_name, oldValue, field_value, agentId]);

      // Логируем действие
      await db.query(`
        INSERT INTO request_analytics (request_id, agent_id, action_type, action_data)
        VALUES (?, ?, 'field_update', ?)
      `, [request.id, agentId, JSON.stringify({ field_name, old_value: oldValue, new_value: field_value })]);

      logger.info(`Field ${field_name} updated for request ${request.request_number}`);

      res.json({
        success: true,
        message: 'Поле успешно обновлено'
      });
    } catch (error) {
      logger.error('Update field error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления поля'
      });
    }
  }

  /**
   * Получить историю изменений поля
   * GET /api/requests/public/:uuid/field-history/:fieldName
   */
  async getFieldHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid, fieldName } = req.params;

      const request: any = await db.queryOne(
        'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      const history = await db.query(`
        SELECT 
          rfh.*,
          ra.telegram_username,
          ra.first_name,
          ra.last_name
        FROM request_field_history rfh
        LEFT JOIN request_agents ra ON rfh.changed_by_agent_id = ra.id
        WHERE rfh.request_id = ? AND rfh.field_name = ?
        ORDER BY rfh.changed_at DESC
      `, [request.id, fieldName]);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Get field history error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения истории изменений'
      });
    }
  }

  /**
   * Загрузить паспорт клиента
   * POST /api/requests/public/:uuid/upload-client-passport
   */
  async uploadClientPassport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Файл не загружен'
        });
        return;
      }

      const request: any = await db.queryOne(
        'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Сохраняем файл
      const uploadDir = path.join(__dirname, '../../public/uploads/request-passports');
      await fs.ensureDir(uploadDir);

      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const { v4: uuidv4 } = require('uuid');
      const filename = `client_${uuidv4()}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      await fs.writeFile(filepath, req.file.buffer);

      const passportPath = `/uploads/request-passports/${filename}`;
      const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      // Обновляем заявку
      await db.query(
        'UPDATE requests SET client_passport_path = ?, client_passport_base64 = ? WHERE id = ?',
        [passportPath, base64Data, request.id]
      );

      logger.info(`Client passport uploaded for request ID ${request.id}`);

      res.json({
        success: true,
        message: 'Паспорт клиента успешно загружен',
        data: { passport_path: passportPath }
      });
    } catch (error) {
      logger.error('Upload client passport error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка загрузки паспорта'
      });
    }
  }

  /**
   * Загрузить паспорт агента
   * POST /api/requests/public/:uuid/upload-agent-passport
   */
  async uploadAgentPassport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Файл не загружен'
        });
        return;
      }

      const request: any = await db.queryOne(
        'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Сохраняем файл
      const uploadDir = path.join(__dirname, '../../public/uploads/request-passports');
      await fs.ensureDir(uploadDir);

      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const { v4: uuidv4 } = require('uuid');
      const filename = `agent_${uuidv4()}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      await fs.writeFile(filepath, req.file.buffer);

      const passportPath = `/uploads/request-passports/${filename}`;
      const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      // Обновляем заявку
      await db.query(
        'UPDATE requests SET agent_passport_path = ?, agent_passport_base64 = ? WHERE id = ?',
        [passportPath, base64Data, request.id]
      );

      logger.info(`Agent passport uploaded for request ID ${request.id}`);

      res.json({
        success: true,
        message: 'Паспорт агента успешно загружен',
        data: { passport_path: passportPath }
      });
    } catch (error) {
      logger.error('Upload agent passport error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка загрузки паспорта'
      });
    }
  }

  /**
   * Добавить предложенный вариант
   * POST /api/requests/public/:uuid/add-property
   */
  async addProposedProperty(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;
      const { property_id, custom_name, rejection_reason, agent_telegram_id } = req.body;

      const request: any = await db.queryOne(
        'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      // Находим или создаем агента
      let agentId = null;
      if (agent_telegram_id) {
        let agent: any = await db.queryOne(
          'SELECT id FROM request_agents WHERE telegram_id = ?',
          [agent_telegram_id]
        );

        if (!agent) {
          const result = await db.query(
            'INSERT INTO request_agents (telegram_id) VALUES (?)',
            [agent_telegram_id]
          );
          agentId = (result as any)[0].insertId;
        } else {
          agentId = agent.id;
        }
      }

      // Добавляем предложенный вариант
      await db.query(`
        INSERT INTO request_proposed_properties 
        (request_id, property_id, custom_name, rejection_reason, proposed_by_agent_id)
        VALUES (?, ?, ?, ?, ?)
      `, [request.id, property_id, custom_name, rejection_reason, agentId]);

      // Логируем действие
      await db.query(`
        INSERT INTO request_analytics (request_id, agent_id, action_type, action_data)
        VALUES (?, ?, 'property_proposed', ?)
      `, [request.id, agentId, JSON.stringify({ property_id, custom_name })]);

      logger.info(`Property proposed for request ID ${request.id}`);

      res.json({
        success: true,
        message: 'Вариант успешно добавлен'
      });
    } catch (error) {
      logger.error('Add proposed property error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка добавления варианта'
      });
    }
  }

  /**
   * Обновить статус заявки
   * PUT /api/requests/public/:uuid/status
   */
async updateStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { status, agent_telegram_id, owner_price, client_price, price_markup_percent } = req.body;

    // Разрешенные статусы (добавили in_progress для возобновления)
    const allowedStatuses = ['in_progress', 'rejected', 'completed', 'deal_created'];

    if (!allowedStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Недопустимый статус'
      });
      return;
    }

    const request: any = await db.queryOne(
      'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    // Формируем запрос на обновление
    let updateQuery = 'UPDATE requests SET status = ?';
    const updateParams: any[] = [status];

    // Добавляем метки времени в зависимости от статуса
    if (status === 'rejected') {
      updateQuery += ', rejected_at = NOW()';
    } else if (status === 'completed') {
      updateQuery += ', completed_at = NOW()';
    } else if (status === 'deal_created') {
      updateQuery += ', deal_created_at = NOW()';
    }

    // Добавляем финансовые данные если они есть
    if (owner_price !== undefined && owner_price !== null) {
      updateQuery += ', owner_price = ?';
      updateParams.push(owner_price);
    }
    
    if (client_price !== undefined && client_price !== null) {
      updateQuery += ', client_price = ?';
      updateParams.push(client_price);
    }
    
    if (price_markup_percent !== undefined && price_markup_percent !== null) {
      updateQuery += ', price_markup_percent = ?';
      updateParams.push(price_markup_percent);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(request.id);

    await db.query(updateQuery, updateParams);

    // Находим агента
    let agentId = null;
    if (agent_telegram_id) {
      const agent: any = await db.queryOne(
        'SELECT id FROM request_agents WHERE telegram_id = ?',
        [agent_telegram_id]
      );
      agentId = agent?.id || null;
    }

    // Логируем действие
    const analyticsData: any = { new_status: status };
    
    if (owner_price) analyticsData.owner_price = owner_price;
    if (client_price) analyticsData.client_price = client_price;
    if (price_markup_percent) analyticsData.price_markup_percent = price_markup_percent;

    await db.query(`
      INSERT INTO request_analytics (request_id, agent_id, action_type, action_data)
      VALUES (?, ?, 'status_changed', ?)
    `, [request.id, agentId, JSON.stringify(analyticsData)]);

    logger.info(`Status updated to ${status} for request ID ${request.id}`);

    res.json({
      success: true,
      message: 'Статус успешно обновлен'
    });
  } catch (error) {
    logger.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления статуса'
    });
  }
}

  /**
   * Получить список всех объектов для выбора
   * GET /api/requests/properties
   */
  async getProperties(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { search } = req.query;

      let query = `
        SELECT 
          p.id,
          p.property_number,
          p.complex_name,
          p.address,
          COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name
        FROM properties p
        LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
        LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
        WHERE p.deleted_at IS NULL
      `;

      const queryParams: any[] = [];

      if (search) {
        query += ` AND (
          COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name) LIKE ? OR 
          p.property_number LIKE ? OR 
          p.address LIKE ?
        )`;
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY p.complex_name, p.property_number LIMIT 100`;

      const properties = await db.query(query, queryParams);

      res.json({
        success: true,
        data: properties
      });
    } catch (error) {
      logger.error('Get properties error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка объектов'
      });
    }
  }

  /**
   * Удалить заявку (мягкое удаление)
   * DELETE /api/requests/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const request: any = await db.queryOne(
        'SELECT * FROM requests WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Заявка не найдена'
        });
        return;
      }

      await db.query('UPDATE requests SET deleted_at = NOW() WHERE id = ?', [id]);

      logger.info(`Request deleted: ${request.request_number} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Заявка успешно удалена'
      });
    } catch (error) {
      logger.error('Delete request error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления заявки'
      });
    }
  }

/**
 * Запрос на создание договора
 */
async requestContract(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const {
      rental_dates,
      villa_name_address,
      rental_cost,
      cost_includes,
      utilities_cost,
      payment_terms,
      deposit_amount,
      additional_terms,
      client_passport_front,
      client_passport_back,
      agent_passport_front,
      agent_passport_back
    } = req.body;

    // Валидация обязательных полей
    if (!rental_dates || !villa_name_address || !rental_cost) {
      res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля: Даты аренды, Название виллы, Стоимость аренды'
      });
      return;
    }

    if (!client_passport_front || !client_passport_back) {
      res.status(400).json({
        success: false,
        message: 'Загрузите обе стороны паспорта клиента'
      });
      return;
    }

    if (!agent_passport_front || !agent_passport_back) {
      res.status(400).json({
        success: false,
        message: 'Загрузите обе стороны паспорта агента'
      });
      return;
    }

    const request: any = await db.queryOne(
      'SELECT * FROM requests WHERE uuid = ?',
      [uuid]
    );

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    // Сохраняем данные для договора
    await db.query(`
      UPDATE requests 
      SET 
        rental_dates = ?,
        villa_name_address = ?,
        rental_cost = ?,
        cost_includes = ?,
        utilities_cost = ?,
        payment_terms = ?,
        deposit_amount = ?,
        additional_terms = ?,
        client_passport_front = ?,
        client_passport_back = ?,
        agent_passport_front = ?,
        agent_passport_back = ?,
        contract_requested_at = NOW()
      WHERE id = ?
    `, [
      rental_dates,
      villa_name_address,
      rental_cost,
      cost_includes,
      utilities_cost,
      payment_terms,
      deposit_amount,
      additional_terms,
      client_passport_front,
      client_passport_back,
      agent_passport_front,
      agent_passport_back,
      request.id
    ]);

    // Аналитика
    await db.query(`
      INSERT INTO request_analytics (request_id, agent_id, action_type, action_data)
      VALUES (?, ?, 'contract_requested', ?)
    `, [
      request.id,
      request.agent_id || null,
      JSON.stringify({
        rental_dates,
        villa_name_address,
        rental_cost
      })
    ]);

    // Отправляем уведомление в Telegram
    const contractData = {
      rental_dates,
      villa_name_address,
      rental_cost,
      cost_includes,
      utilities_cost,
      payment_terms,
      deposit_amount,
      additional_terms,
      client_passport_front,
      client_passport_back,
      agent_passport_front,
      agent_passport_back
    };

    const chatUrl = `${process.env.REQUEST_BASE_URL}/request/chat/${request.chat_uuid}`;
    const requestUrl = `${process.env.REQUEST_BASE_URL}/request/client/${request.uuid}`;

    // Импортируем telegramBot и отправляем уведомление
    const telegramBot = require('../services/telegramBot.service').default;
    await telegramBot.sendContractRequestNotification(
      request.id,
      request.request_number,
      contractData,
      chatUrl,
      requestUrl
    );

    logger.info(`Contract requested for request ${request.request_number}`);

    res.json({
      success: true,
      message: 'Запрос на создание договора отправлен'
    });
  } catch (error) {
    logger.error('Request contract error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка запроса договора'
    });
  }
}

/**
 * Публичная загрузка паспорта (без авторизации)
 */
async uploadPassportPublic(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Файл не загружен'
      });
      return;
    }

    // Проверяем что заявка существует
    const request: any = await db.queryOne(
      'SELECT id FROM requests WHERE uuid = ?',
      [uuid]
    );

    if (!request) {
      // Удаляем загруженный файл если заявка не найдена
      if (req.file.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    // Формируем относительный путь для сохранения в БД
    const relativePath = req.file.path.replace(/\\/g, '/').replace('public/', '/');

    logger.info(`Passport uploaded for request ${uuid}: ${relativePath}`);

    res.json({
      success: true,
      message: 'Файл загружен успешно',
      data: {
        path: relativePath,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('Upload passport public error:', error);
    
    // Удаляем файл в случае ошибки
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки файла'
    });
  }
}
  
/**
 * Получить данные заявки для создания договора
 * GET /api/requests/public/:uuid/for-agreement
 */
async getRequestForAgreement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;

    const request: any = await db.queryOne(`
      SELECT 
        r.*,
        ra.telegram_username as agent_username,
        ra.first_name as agent_first_name,
        ra.last_name as agent_last_name,
        ra.telegram_id as agent_telegram_id
      FROM requests r
      LEFT JOIN request_agents ra ON r.agent_id = ra.id
      WHERE r.uuid = ? AND r.deleted_at IS NULL
    `, [uuid]);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Get request for agreement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения данных заявки'
    });
  }
}

/**
 * Связать договор с заявкой
 * POST /api/requests/public/:uuid/link-agreement
 */
async linkAgreementToRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { agreement_id } = req.body;

    if (!agreement_id) {
      res.status(400).json({
        success: false,
        message: 'agreement_id обязателен'
      });
      return;
    }

    const request: any = await db.queryOne(
      'SELECT id FROM requests WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    // Обновляем заявку
    await db.query(
      'UPDATE requests SET agreement_id = ?, status = ?, deal_created_at = NOW() WHERE id = ?',
      [agreement_id, 'deal_created', request.id]
    );

    // Аналитика
    await db.query(`
      INSERT INTO request_analytics (request_id, action_type, action_data)
      VALUES (?, 'agreement_created', ?)
    `, [request.id, JSON.stringify({ agreement_id })]);

    logger.info(`Agreement ${agreement_id} linked to request ${uuid}`);

    res.json({
      success: true,
      message: 'Договор успешно привязан к заявке'
    });
  } catch (error) {
    logger.error('Link agreement to request error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка привязки договора'
    });
  }
}
/**
 * Получить заявку по agreement_id
 * GET /api/requests/by-agreement/:agreementId
 */
async getByAgreementId(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { agreementId } = req.params;

    const request = await db.queryOne(`
      SELECT uuid, request_number
      FROM requests
      WHERE agreement_id = ? AND deleted_at IS NULL
    `, [agreementId]);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
      return;
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Get request by agreement ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения заявки'
    });
  }
}
/**
 * Создать заявку из WhatsApp (вручную)
 * POST /api/requests/create-whatsapp
 */
async createWhatsAppRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      client_name,
      whatsapp_phone,
      initial_note,
      agent_group_id,
      screenshots
    } = req.body;

    // Валидация
    if (!client_name || !whatsapp_phone) {
      res.status(400).json({
        success: false,
        message: 'Заполните обязательные поля: Имя клиента и Номер WhatsApp'
      });
      return;
    }

    if (!screenshots || screenshots.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Загрузите хотя бы один скриншот переписки'
      });
      return;
    }

    // Генерируем UUID и номер заявки
    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    const chatUuid = uuidv4();
    const requestNumber = `REQ-WA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Получаем данные менеджера
    const managerId = req.admin?.id;
    const managerUsername = req.admin?.username;

    // Создаём заявку
    const result = await db.query(`
      INSERT INTO requests (
        request_number, uuid, chat_uuid,
        request_source,
        client_first_name,
        client_telegram_id,
        whatsapp_phone,
        manager_telegram_id, manager_username,
        initial_note,
        first_message_at, last_message_at,
        agent_group_id,
        status
      ) VALUES (?, ?, ?, 'whatsapp', ?, NULL, ?, ?, ?, ?, NOW(), NOW(), ?, 'new')
    `, [
      requestNumber, uuid, chatUuid,
      client_name,
      whatsapp_phone,
      managerId, managerUsername,
      initial_note,
      agent_group_id
    ]);

    const requestId = (result as any).insertId;

    logger.info(`Created WhatsApp request ${requestNumber} with ID ${requestId}`);

    // Сохраняем скриншоты как сообщения
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      
      await db.query(`
        INSERT INTO request_messages (
          request_id,
          telegram_message_id,
          from_telegram_id,
          message_type,
          media_file_path,
          message_date
        ) VALUES (?, ?, NULL, 'whatsapp_screenshot', ?, NOW())
      `, [
        requestId,
        i + 1, // Используем индекс как message_id
        screenshot // Путь к скриншоту
      ]);
    }

    // Формируем ссылки
    const chatUrl = `${process.env.REQUEST_BASE_URL}/request/chat/${chatUuid}`;
    const requestUrl = `${process.env.REQUEST_BASE_URL}/request/client/${uuid}`;

    // Отправляем уведомление в группу агентов
    if (agent_group_id) {
      const telegramBot = require('../services/telegramBot.service').default;
      await telegramBot.sendWhatsAppRequestNotification(
        requestId,
        requestNumber,
        client_name,
        whatsapp_phone,
        initial_note,
        chatUrl,
        agent_group_id
      );
    }

    res.json({
      success: true,
      message: 'Заявка из WhatsApp создана успешно',
      data: {
        request_id: requestId,
        request_number: requestNumber,
        uuid,
        chat_uuid: chatUuid,
        chat_url: chatUrl,
        request_url: requestUrl
      }
    });
  } catch (error) {
    logger.error('Create WhatsApp request error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания заявки из WhatsApp'
    });
  }
}

/**
 * Получить список групп агентов
 * GET /api/requests/agent-groups
 */
async getAgentGroups(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const groups = await db.query(`
      SELECT id, group_name, description, chat_id
      FROM bot_agent_groups
      WHERE is_active = TRUE
      ORDER BY group_name ASC
    `);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    logger.error('Get agent groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка групп'
    });
  }
}

/**
 * Загрузить скриншот WhatsApp
 * POST /api/requests/upload-whatsapp-screenshot
 */
async uploadWhatsAppScreenshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Файл не загружен'
      });
      return;
    }

    // Сохраняем файл (БЕЗ public/)
    const uploadDir = path.join(__dirname, '../../uploads/whatsapp-screenshots');
    await fs.ensureDir(uploadDir);

    const ext = req.file.mimetype.split('/')[1] || 'jpg';
    const { v4: uuidv4 } = require('uuid');
    const filename = `wa_screenshot_${uuidv4()}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    await fs.writeFile(filepath, req.file.buffer);

    const screenshotPath = `/uploads/whatsapp-screenshots/${filename}`;

    logger.info(`WhatsApp screenshot uploaded: ${screenshotPath}`);

    res.json({
      success: true,
      message: 'Скриншот загружен успешно',
      data: { screenshot_path: screenshotPath }
    });
  } catch (error) {
    logger.error('Upload WhatsApp screenshot error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки скриншота'
    });
  }
}

}

export default new RequestsController();