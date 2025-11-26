// backend/src/controllers/agreementTemplates.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class AgreementTemplatesController {
  /**
   * Получить список всех шаблонов
   * GET /api/agreement-templates
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type, active } = req.query;

      const whereConditions: string[] = [];
      const queryParams: any[] = [];

      if (type) {
        whereConditions.push('t.type = ?');
        queryParams.push(type);
      }

      if (active !== undefined) {
        whereConditions.push('t.is_active = ?');
        queryParams.push(active === 'true' ? 1 : 0);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          t.*,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM agreements WHERE template_id = t.id) as usage_count
        FROM agreement_templates t
        LEFT JOIN admin_users u ON t.created_by = u.id
        ${whereClause}
        ORDER BY t.created_at DESC
      `;

      const templates = await db.query(query, queryParams);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Get agreement templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения шаблонов'
      });
    }
  }

  /**
   * Получить шаблон по ID
   * GET /api/agreement-templates/:id
   */
async getById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const template = await db.queryOne(`
      SELECT 
        t.*,
        u.username as created_by_name
      FROM agreement_templates t
      LEFT JOIN admin_users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Шаблон не найден'
      });
      return;
    }

    // Получаем объекты где использовался шаблон
    const usedProperties = await db.query(`
      SELECT DISTINCT 
        p.*,
        COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_nameы
      FROM agreements a
      JOIN properties p ON a.property_id = p.id
      LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
      LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
      WHERE a.template_id = ?
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        ...template,
        used_properties: usedProperties
      }
    });
  } catch (error) {
    logger.error('Get agreement template error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения шаблона'
    });
  }
}

  /**
   * Создать шаблон
   * POST /api/agreement-templates
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { name, type, content, structure } = req.body;
      const userId = req.admin!.id;

      if (!name || !type || !content) {
        await db.rollback(connection);
        res.status(400).json({
          success: false,
          message: 'Не заполнены обязательные поля'
        });
        return;
      }

      const result = await connection.query(
        `INSERT INTO agreement_templates (name, type, content, structure, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [name, type, content, structure || null, userId]
      );

      await db.commit(connection);

      const templateId = (result as any)[0].insertId;

      logger.info(`Agreement template created: ${name} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Шаблон успешно создан',
        data: { id: templateId }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create agreement template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания шаблона'
      });
    }
  }

  /**
   * Обновить шаблон
   * PUT /api/agreement-templates/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { name, content, structure, is_active } = req.body;

      const template = await db.queryOne('SELECT id FROM agreement_templates WHERE id = ?', [id]);

      if (!template) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Шаблон не найден'
        });
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        fields.push('name = ?');
        values.push(name);
      }

      if (content !== undefined) {
        fields.push('content = ?');
        values.push(content);
      }

      if (structure !== undefined) {
        fields.push('structure = ?');
        values.push(structure);
      }

      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active);
      }

      if (fields.length > 0) {
        fields.push('version = version + 1');
        values.push(id);

        await connection.query(
          `UPDATE agreement_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      await db.commit(connection);

      logger.info(`Agreement template updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Шаблон успешно обновлён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update agreement template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления шаблона'
      });
    }
  }

  /**
   * Удалить шаблон (деактивация)
   * DELETE /api/agreement-templates/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Проверяем использование шаблона
      const usageCount = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM agreements WHERE template_id = ? AND deleted_at IS NULL',
        [id]
      );

      if (usageCount && usageCount.count > 0) {
        res.status(400).json({
          success: false,
          message: `Невозможно удалить шаблон. Он используется в ${usageCount.count} договорах`
        });
        return;
      }

      // Деактивируем шаблон
      await db.query('UPDATE agreement_templates SET is_active = FALSE WHERE id = ?', [id]);

      logger.info(`Agreement template deactivated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Шаблон успешно деактивирован'
      });
    } catch (error) {
      logger.error('Delete agreement template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления шаблона'
      });
    }
  }
}

export default new AgreementTemplatesController();