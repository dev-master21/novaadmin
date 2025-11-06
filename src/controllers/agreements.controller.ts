// backend/src/controllers/agreements.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs-extra';

class AgreementsController {
  private uploadsPath = path.join(__dirname, '../../uploads/qrcodes');

  constructor() {
    fs.ensureDirSync(this.uploadsPath);
  }

  /**
   * Получить список всех договоров
   * GET /api/agreements
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type, status, property_id, search, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = ['a.deleted_at IS NULL'];
      const queryParams: any[] = [];

      if (type) {
        whereConditions.push('a.type = ?');
        queryParams.push(type);
      }

      if (status) {
        whereConditions.push('a.status = ?');
        queryParams.push(status);
      }

      if (property_id) {
        whereConditions.push('a.property_id = ?');
        queryParams.push(property_id);
      }

      if (search) {
        whereConditions.push('(a.agreement_number LIKE ? OR a.description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Получаем общее количество
      const countQuery = `
        SELECT COUNT(*) as total
        FROM agreements a
        ${whereClause}
      `;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем договоры
      const query = `
        SELECT 
          a.*,
          at.name as template_name,
          pt.property_name as property_name,
          p.property_number,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM agreement_signatures WHERE agreement_id = a.id) as signature_count,
          (SELECT COUNT(*) FROM agreement_signatures WHERE agreement_id = a.id AND is_signed = 1) as signed_count
        FROM agreements a
        LEFT JOIN agreement_templates at ON a.template_id = at.id
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        LEFT JOIN admin_users u ON a.created_by = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limitNum, offset);
      const agreements = await db.query(query, queryParams);

      res.json({
        success: true,
        data: agreements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get agreements error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения договоров'
      });
    }
  }

  /**
   * Получить договор по ID
   * GET /api/agreements/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const agreement = await db.queryOne(`
        SELECT 
          a.*,
          at.name as template_name,
          pt.property_name,
          p.property_number,
          u.username as created_by_name
        FROM agreements a
        LEFT JOIN agreement_templates at ON a.template_id = at.id
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        LEFT JOIN admin_users u ON a.created_by = u.id
        WHERE a.id = ? AND a.deleted_at IS NULL
      `, [id]);

      if (!agreement) {
        res.status(404).json({
          success: false,
          message: 'Договор не найден'
        });
        return;
      }

      // Получаем подписи
      const signatures = await db.query(
        'SELECT * FROM agreement_signatures WHERE agreement_id = ? ORDER BY created_at',
        [id]
      );

      // Получаем стороны договора
      const parties = await db.query(
        'SELECT * FROM agreement_parties WHERE agreement_id = ? ORDER BY id',
        [id]
      );

      res.json({
        success: true,
        data: {
          ...agreement,
          signatures,
          parties
        }
      });
    } catch (error) {
      logger.error('Get agreement error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения договора'
      });
    }
  }

  /**
   * Создать договор
   * POST /api/agreements
   */
async create(req: AuthRequest, res: Response): Promise<void> {
  console.log('🎯 Controller create called');
  console.log('🎯 Request body:', JSON.stringify(req.body, null, 2));
  
  const connection = await db.beginTransaction();

  try {
    const {
      template_id,
      property_id,
      description,
      date_from,
      date_to,
      city,
      parties
    } = req.body;

    console.log('🎯 Extracted template_id:', template_id);
    
    const userId = req.admin!.id;

    // Получаем шаблон
    const template = await db.queryOne<any>(
      'SELECT * FROM agreement_templates WHERE id = ? AND is_active = TRUE',
      [template_id]
    );

    console.log('🎯 Template found:', template);

    if (!template) {
      console.log('❌ Template not found for id:', template_id);
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Шаблон не найден'
      });
      return;
    }

      // Генерируем номер договора
      const agreement_number = `NOVA-${template.type.toUpperCase()}-${Date.now()}`;

      // Генерируем публичную ссылку
      const publicLinkId = uuidv4();
      const public_link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/agreement/${publicLinkId}`;

      // Получаем данные об объекте если указан
      let propertyData: any = null;
      if (property_id) {
        propertyData = await db.queryOne(
          'SELECT * FROM properties WHERE id = ?',
          [property_id]
        );
      }

      // Подготавливаем переменные для замены в шаблоне
      const templateVariables: any = {
        agreement_number,
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        city: city || 'Phuket',
        date_from: date_from ? new Date(date_from).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
        date_to: date_to ? new Date(date_to).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      };

      // Добавляем данные об объекте
      if (propertyData) {
        templateVariables.property_name = propertyData.property_name || '';
        templateVariables.property_number = propertyData.property_number || '';
        templateVariables.property_address = propertyData.address || '';
      }

      // Добавляем данные о сторонах
      if (parties && Array.isArray(parties)) {
        parties.forEach((party: any) => {
          const role = party.role.toLowerCase();
          templateVariables[`${role}_name`] = party.name;
          templateVariables[`${role}_country`] = party.passport_country;
          templateVariables[`${role}_passport`] = party.passport_number;
          templateVariables[`${role}_passport_number`] = party.passport_number;
        });
      }

      // Заменяем переменные в контенте
      let finalContent = this.replaceTemplateVariables(template.content, templateVariables);
      let finalStructure = template.structure;

      // Заменяем переменные в структуре если она есть
      if (finalStructure) {
        try {
          const structureObj = typeof finalStructure === 'string' ? JSON.parse(finalStructure) : finalStructure;
          finalStructure = JSON.stringify(this.replaceVariablesInStructure(structureObj, templateVariables));
        } catch (e) {
          logger.error('Error processing structure:', e);
          finalStructure = null;
        }
      }

      // Создаем договор
      const result = await connection.query(`
        INSERT INTO agreements (
          agreement_number, template_id, property_id, type,
          content, structure, description, date_from, date_to,
          status, public_link, created_by, city
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        agreement_number,
        template_id,
        property_id || null,
        template.type,
        finalContent,
        finalStructure,
        description,
        date_from,
        date_to,
        'draft',
        public_link,
        userId,
        city || 'Phuket'
      ]);

      const agreementId = (result as any)[0].insertId;

      // Сохраняем стороны договора
      if (parties && Array.isArray(parties) && parties.length > 0) {
        for (const party of parties) {
          await connection.query(`
            INSERT INTO agreement_parties (
              agreement_id, role, name, passport_country, passport_number
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            agreementId,
            party.role,
            party.name,
            party.passport_country,
            party.passport_number
          ]);
        }
      }

      // Логируем создание
      await connection.query(`
        INSERT INTO agreement_logs (agreement_id, action, description, user_id)
        VALUES (?, ?, ?, ?)
      `, [agreementId, 'created', 'Договор создан', userId]);

      await db.commit(connection);

      logger.info(`Agreement created: ${agreement_number} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Договор успешно создан',
        data: { id: agreementId, agreement_number }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create agreement error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания договора'
      });
    }
  }

  /**
   * Обновить договор
   * PUT /api/agreements/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { content, structure, status, description } = req.body;
      const userId = req.admin!.id;

      // Проверяем существование
      const agreement = await db.queryOne('SELECT * FROM agreements WHERE id = ? AND deleted_at IS NULL', [id]);

      if (!agreement) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Договор не найден'
        });
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (content !== undefined) {
        fields.push('content = ?');
        values.push(content);
      }

      if (structure !== undefined) {
        fields.push('structure = ?');
        values.push(structure);
      }

      if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
      }

      if (description !== undefined) {
        fields.push('description = ?');
        values.push(description);
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE agreements SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );

        // Логируем
        await connection.query(`
          INSERT INTO agreement_logs (agreement_id, action, description, user_id)
          VALUES (?, ?, ?, ?)
        `, [id, 'updated', 'Договор обновлён', userId]);
      }

      await db.commit(connection);

      logger.info(`Agreement updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Договор успешно обновлён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update agreement error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления договора'
      });
    }
  }

  /**
   * Удалить договор (мягкое удаление)
   * DELETE /api/agreements/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.admin!.id;

      const agreement = await db.queryOne('SELECT * FROM agreements WHERE id = ? AND deleted_at IS NULL', [id]);

      if (!agreement) {
        res.status(404).json({
          success: false,
          message: 'Договор не найден'
        });
        return;
      }

      await db.query('UPDATE agreements SET deleted_at = NOW() WHERE id = ?', [id]);

      // Логируем
      await db.query(`
        INSERT INTO agreement_logs (agreement_id, action, description, user_id)
        VALUES (?, ?, ?, ?)
      `, [id, 'deleted', 'Договор удалён', userId]);

      logger.info(`Agreement deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Договор успешно удалён'
      });
    } catch (error) {
      logger.error('Delete agreement error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления договора'
      });
    }
  }

  /**
   * Получить договор по публичной ссылке (без авторизации)
   * GET /api/agreements/public/:link
   */
  async getByPublicLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { link } = req.params;

      const agreement = await db.queryOne(`
        SELECT 
          a.*,
          at.name as template_name,
          pt.property_name,
          p.property_number
        FROM agreements a
        LEFT JOIN agreement_templates at ON a.template_id = at.id
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        WHERE a.public_link LIKE ? AND a.deleted_at IS NULL
      `, [`%${link}%`]);

      if (!agreement) {
        res.status(404).json({
          success: false,
          message: 'Договор не найден'
        });
        return;
      }

      // Получаем подписи
      const signatures = await db.query(
        'SELECT * FROM agreement_signatures WHERE agreement_id = ? ORDER BY created_at',
        [(agreement as any).id]
      );

      // Получаем стороны
      const parties = await db.query(
        'SELECT * FROM agreement_parties WHERE agreement_id = ? ORDER BY id',
        [(agreement as any).id]
      );

      res.json({
        success: true,
        data: {
          ...agreement,
          signatures,
          parties
        }
      });
    } catch (error) {
      logger.error('Get agreement by public link error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения договора'
      });
    }
  }

  /**
   * Создать зоны для подписей
   * POST /api/agreements/:id/signatures
   */
  async createSignatures(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { signatures } = req.body;

      const agreement = await db.queryOne('SELECT * FROM agreements WHERE id = ? AND deleted_at IS NULL', [id]);

      if (!agreement) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Договор не найден'
        });
        return;
      }

      // Удаляем существующие подписи
      await connection.query('DELETE FROM agreement_signatures WHERE agreement_id = ?', [id]);

      // Создаем новые подписи
      const signatureLinks: any[] = [];

      for (const signature of signatures) {
        const uniqueLink = uuidv4();
        const publicLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sign/${uniqueLink}`;

        await connection.query(`
          INSERT INTO agreement_signatures (
            agreement_id, signer_name, signer_role,
            position_x, position_y, position_page,
            signature_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          signature.signer_name,
          signature.signer_role,
          signature.position_x,
          signature.position_y,
          signature.position_page,
          uniqueLink
        ]);

        signatureLinks.push({
          signer_name: signature.signer_name,
          link: publicLink
        });
      }

      // Обновляем статус договора
      await connection.query(
        'UPDATE agreements SET status = ? WHERE id = ?',
        ['pending_signatures', id]
      );

      // Генерируем QR код
      const qrCodePath = await this.generateQRCode((agreement as any).public_link, (agreement as any).agreement_number);
      await connection.query('UPDATE agreements SET qr_code_path = ? WHERE id = ?', [qrCodePath, id]);

      await db.commit(connection);

      logger.info(`Signatures created for agreement: ${id}`);

      res.json({
        success: true,
        message: 'Подписи успешно созданы',
        data: { signatureLinks }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create signatures error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания подписей'
      });
    }
  }

  /**
   * Вспомогательный метод: замена переменных в тексте
   */
  private replaceTemplateVariables(content: string, variables: any): string {
    let result = content;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    return result;
  }

  /**
   * Вспомогательный метод: замена переменных в структуре
   */
  private replaceVariablesInStructure(structure: any, variables: any): any {
    if (typeof structure === 'string') {
      return this.replaceTemplateVariables(structure, variables);
    }

    if (Array.isArray(structure)) {
      return structure.map(item => this.replaceVariablesInStructure(item, variables));
    }

    if (typeof structure === 'object' && structure !== null) {
      const result: any = {};
      Object.keys(structure).forEach(key => {
        result[key] = this.replaceVariablesInStructure(structure[key], variables);
      });
      return result;
    }

    return structure;
  }

  /**
   * Вспомогательный метод: генерация QR кода
   */
  private async generateQRCode(publicLink: string, agreementNumber: string): Promise<string> {
    try {
      const fileName = `${agreementNumber}_${Date.now()}.png`;
      const filePath = path.join(this.uploadsPath, fileName);

      await QRCode.toFile(filePath, publicLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return `/uploads/qrcodes/${fileName}`;
    } catch (error) {
      logger.error('QR code generation error:', error);
      throw error;
    }
  }
}

export default new AgreementsController();