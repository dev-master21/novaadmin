// backend/src/controllers/agreements.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
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
      parties,
      rent_amount_monthly,
      rent_amount_total,
      deposit_amount,
      utilities_included,
      bank_name,
      bank_account_name,
      bank_account_number,
      property_address_override,
      property_name_manual,
      property_number_manual
    } = req.body;

    console.log('🎯 Extracted template_id:', template_id);
    
    const userId = req.admin!.id;

    // Получаем шаблон
    const template = await db.queryOne<any>(
      'SELECT * FROM agreement_templates WHERE id = ?',
      [template_id]
    );

    if (!template) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Шаблон не найден'
      });
      return;
    }

    // Получаем информацию об объекте если указан
    let property = null;
    if (property_id) {
      property = await db.queryOne(`
        SELECT p.*, pt.property_name
        FROM properties p
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        WHERE p.id = ?
      `, [property_id]);
    }

    // Генерируем номер договора
    const timestamp = Date.now();
    const agreement_number = `NOVA-${template.type.toUpperCase()}-${timestamp}`;

    // Генерируем публичную ссылку
    const { v4: uuidv4 } = require('uuid');
    const uniqueLink = uuidv4();
    const public_link = `https://agreement.novaestate.company/${uniqueLink}`;

    // Подготавливаем переменные для замены
    const variables: any = {
      agreement_number,
      property_name: property_name_manual || (property as any)?.property_name || 'N/A',
      property_number: property_number_manual || (property as any)?.property_number || 'N/A',
      property_address: property_address_override || (property as any)?.address || 'N/A',
      date_from: date_from || new Date().toISOString().split('T')[0],
      date_to: date_to || '',
      city: city || 'Phuket',
      rent_amount_monthly: rent_amount_monthly || 0,
      rent_amount_total: rent_amount_total || 0,
      deposit_amount: deposit_amount || 0,
      utilities_included: utilities_included || '',
      bank_name: bank_name || '',
      bank_account_name: bank_account_name || '',
      bank_account_number: bank_account_number || ''
    };

    // Добавляем данные сторон
    if (parties && Array.isArray(parties)) {
      parties.forEach((party: any, index: number) => {
        const prefix = party.role || `party_${index + 1}`;
        if (party.is_company) {
          variables[`${prefix}_name`] = party.company_name || '';
          variables[`${prefix}_company_name`] = party.company_name || '';
          variables[`${prefix}_tax_id`] = party.company_tax_id || '';
          variables[`${prefix}_address`] = party.company_address || '';
          variables[`${prefix}_director`] = party.director_name || '';
          variables[`${prefix}_director_name`] = party.director_name || '';
          variables[`${prefix}_director_passport`] = party.director_passport || '';
          variables[`${prefix}_director_country`] = party.director_country || '';
        } else {
          // Добавляем ВСЕ возможные варианты переменных для каждой стороны
          variables[`${prefix}_name`] = party.name || '';
          
          // Варианты для страны паспорта
          variables[`${prefix}_passport_country`] = party.passport_country || '';
          variables[`${prefix}_country`] = party.passport_country || '';
          
          // Варианты для номера паспорта  
          variables[`${prefix}_passport_number`] = party.passport_number || '';
          variables[`${prefix}_passport`] = party.passport_number || '';
        }
      });
    }

    // Заменяем переменные
    const finalContent = this.replaceTemplateVariables(template.content, variables);
    let finalStructure = template.structure;
    if (finalStructure) {
      try {
        const structureObj = JSON.parse(finalStructure);
        finalStructure = JSON.stringify(this.replaceVariablesInStructure(structureObj, variables));
      } catch (e) {
        finalStructure = this.replaceTemplateVariables(finalStructure, variables);
      }
    }

    // Создаем договор
    const result = await connection.query(`
      INSERT INTO agreements (
        agreement_number, template_id, property_id, type, content, structure,
        description, date_from, date_to, status, public_link, created_by, city,
        rent_amount_monthly, rent_amount_total, deposit_amount, utilities_included,
        bank_name, bank_account_name, bank_account_number, property_address_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      city || 'Phuket',
      rent_amount_monthly || null,
      rent_amount_total || null,
      deposit_amount || null,
      utilities_included || null,
      bank_name || null,
      bank_account_name || null,
      bank_account_number || null,
      property_address_override || null
    ]);

    const agreementId = (result as any)[0].insertId;

    // Сохраняем стороны договора с документами
    if (parties && Array.isArray(parties) && parties.length > 0) {
      for (const party of parties) {
        // Сначала создаем запись стороны
        const partyResult = await connection.query(`
          INSERT INTO agreement_parties (
            agreement_id, role, name, passport_country, passport_number,
            is_company, company_name, company_address, company_tax_id,
            director_name, director_passport, director_country
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          agreementId,
          party.role,
          party.is_company ? null : (party.name || null),
          party.is_company ? null : (party.passport_country || null),
          party.is_company ? null : (party.passport_number || null),
          party.is_company ? 1 : 0,
          party.is_company ? (party.company_name || null) : null,
          party.is_company ? (party.company_address || null) : null,
          party.is_company ? (party.company_tax_id || null) : null,
          party.is_company ? (party.director_name || null) : null,
          party.is_company ? (party.director_passport || null) : null,
          party.is_company ? (party.director_country || null) : null
        ]);

        const partyId = (partyResult as any)[0].insertId;

        // Если есть документы в base64, сохраняем их
        if (party.documents && Array.isArray(party.documents) && party.documents.length > 0) {
          for (const doc of party.documents) {
            if (doc.preview && doc.preview.startsWith('data:')) {
              try {
                // Декодируем base64 и сохраняем файл
                const base64Data = doc.preview.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Определяем расширение файла
                const mimeType = doc.preview.split(';')[0].split(':')[1];
                const ext = mimeType.split('/')[1] || 'jpg';
                
                // Генерируем имя файла
                const fs = require('fs-extra');
                const path = require('path');
                const filename = `${uuidv4()}.${ext}`;
                const uploadDir = path.join(__dirname, '../../public/uploads/party-documents');
                await fs.ensureDir(uploadDir);
                
                const filepath = path.join(uploadDir, filename);
                await fs.writeFile(filepath, buffer);
                
                const documentPath = `/uploads/party-documents/${filename}`;
                
                // Обновляем запись стороны с путем к документу
                await connection.query(
                  'UPDATE agreement_parties SET document_path = ?, document_uploaded_at = NOW() WHERE id = ?',
                  [documentPath, partyId]
                );
                
                logger.info(`Document saved for party ${partyId}: ${documentPath}`);
                
                // Сохраняем только первый документ, если их несколько
                break;
              } catch (err) {
                logger.error('Error saving party document:', err);
              }
            }
          }
        }
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
    const { v4: uuidv4 } = require('uuid');
    const signatureLinks: any[] = [];

    for (const signature of signatures) {
      const uniqueLink = uuidv4();
      const publicLink = `https://agreement.novaestate.company/sign/${uniqueLink}`;

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
  /**
   * Получить список объектов для выбора
   * GET /api/agreements/properties
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
          pt.property_name,
          p.deal_type,
          p.property_type
        FROM properties p
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        WHERE p.deleted_at IS NULL
      `;

      const queryParams: any[] = [];

      if (search) {
        query += ` AND (pt.property_name LIKE ? OR p.property_number LIKE ? OR p.complex_name LIKE ? OR p.address LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY p.complex_name, p.property_number`;

      const properties = await db.query(query, queryParams);

      // Группируем по комплексам
      const complexes: any = {};
      const standalone: any[] = [];

      properties.forEach((prop: any) => {
        if (prop.complex_name && prop.complex_name.trim() !== '') {
          if (!complexes[prop.complex_name]) {
            complexes[prop.complex_name] = [];
          }
          complexes[prop.complex_name].push(prop);
        } else {
          standalone.push(prop);
        }
      });

      res.json({
        success: true,
        data: {
          complexes,
          standalone,
          all: properties,
          total: properties.length,
          complexCount: Object.keys(complexes).length,
          standaloneCount: standalone.length
        }
      });
    } catch (error) {
      logger.error('Get properties error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения объектов'
      });
    }
  }
  /**
   * Загрузить документ стороны
   * POST /api/agreements/parties/:partyId/document
   */
  async uploadPartyDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { partyId } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Файл не загружен'
        });
        return;
      }

      // Проверяем существование стороны
      const party = await db.queryOne('SELECT * FROM agreement_parties WHERE id = ?', [partyId]);

      if (!party) {
        res.status(404).json({
          success: false,
          message: 'Сторона не найдена'
        });
        return;
      }

      // Сохраняем путь к файлу
      const documentPath = `/uploads/party-documents/${req.file.filename}`;

      await db.query(
        'UPDATE agreement_parties SET document_path = ?, document_uploaded_at = NOW() WHERE id = ?',
        [documentPath, partyId]
      );

      logger.info(`Party document uploaded: ${partyId}`);

      res.json({
        success: true,
        message: 'Документ успешно загружен',
        data: { document_path: documentPath }
      });
    } catch (error) {
      logger.error('Upload party document error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка загрузки документа'
      });
    }
  }

  /**
   * Удалить документ стороны
   * DELETE /api/agreements/parties/:partyId/document
   */
  async deletePartyDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { partyId } = req.params;

      const party = await db.queryOne<any>('SELECT * FROM agreement_parties WHERE id = ?', [partyId]);

      if (!party) {
        res.status(404).json({
          success: false,
          message: 'Сторона не найдена'
        });
        return;
      }

      // Удаляем файл с диска
      if (party.document_path) {
        const filePath = path.join(__dirname, '../../public', party.document_path);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          logger.warn(`Failed to delete file: ${filePath}`, err);
        }
      }

      // Обновляем запись в БД
      await db.query(
        'UPDATE agreement_parties SET document_path = NULL, document_uploaded_at = NULL WHERE id = ?',
        [partyId]
      );

      logger.info(`Party document deleted: ${partyId}`);

      res.json({
        success: true,
        message: 'Документ успешно удален'
      });
    } catch (error) {
      logger.error('Delete party document error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления документа'
      });
    }
  }
}

export default new AgreementsController();
