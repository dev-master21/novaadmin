// backend/src/controllers/agreements.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs-extra';
import { PDFService } from '../services/pdf.service';

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

    // Получаем договоры с правильным language_code и fallback
    const query = `
      SELECT 
        a.*,
        at.name as template_name,
        COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name,
        p.property_number,
        u.username as created_by_name,
        (SELECT COUNT(*) FROM agreement_signatures WHERE agreement_id = a.id) as signature_count,
        (SELECT COUNT(*) FROM agreement_signatures WHERE agreement_id = a.id AND is_signed = 1) as signed_count
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN properties p ON a.property_id = p.id
      LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
      LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
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
        COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name,
        p.property_number,
        u.username as created_by_name
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN properties p ON a.property_id = p.id
      LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
      LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
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

    // Для каждой стороны получаем документы
    for (const party of parties as any[]) {
      const documents = await db.query(
        'SELECT id, document_path, document_base64, document_type, file_size, mime_type, uploaded_at FROM agreement_party_documents WHERE party_id = ? ORDER BY uploaded_at',
        [party.id]
      );
      party.documents = documents;
    }

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

    console.log('🎯 Extracted property_id:', property_id);
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
      console.log('🔍 Fetching property with ID:', property_id);
      property = await db.queryOne(`
        SELECT 
          p.*,
          COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name
        FROM properties p
        LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
        LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
        WHERE p.id = ? AND p.deleted_at IS NULL
      `, [property_id]);

      if (!property) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Объект не найден'
        });
        return;
      }
      console.log('✅ Property found:', (property as any).property_name);
    }

    // Генерируем уникальный номер договора
    const { v4: uuidv4 } = require('uuid');
    const agreement_number = `AGR-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Генерируем публичную ссылку
    const public_link = `https://agreement.novaestate.company/agreement/${uuidv4()}`;

    // Подготавливаем переменные для замены в шаблоне
    const variables: any = {
      agreement_number,
      city: city || 'Phuket',
      date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      date_from: date_from ? new Date(date_from).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      date_to: date_to ? new Date(date_to).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      property_name: property_name_manual || (property as any)?.property_name || '',
      property_number: property_number_manual || (property as any)?.property_number || '',
      property_address: property_address_override || (property as any)?.address || '',
      rent_amount_monthly: rent_amount_monthly || '',
      rent_amount_total: rent_amount_total || '',
      deposit_amount: deposit_amount || '',
      utilities_included: utilities_included || '',
      bank_name: bank_name || '',
      bank_account_name: bank_account_name || '',
      bank_account_number: bank_account_number || ''
    };

    // Добавляем переменные сторон
    if (parties && Array.isArray(parties)) {
      parties.forEach((party: any, index: number) => {
        const prefix = party.role || `party_${index}`;
        
        if (party.is_company) {
          variables[`${prefix}_name`] = party.company_name || '';
          variables[`${prefix}_company_name`] = party.company_name || '';
          variables[`${prefix}_address`] = party.company_address || '';
          variables[`${prefix}_tax_id`] = party.company_tax_id || '';
          variables[`${prefix}_director_name`] = party.director_name || '';
          variables[`${prefix}_director_passport`] = party.director_passport || '';
          variables[`${prefix}_director_country`] = party.director_country || '';
        } else {
          variables[`${prefix}_name`] = party.name || '';
          variables[`${prefix}_passport_country`] = party.passport_country || '';
          variables[`${prefix}_country`] = party.passport_country || '';
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

    // Сохраняем стороны договора (БЕЗ документов - они загрузятся отдельно)
    if (parties && Array.isArray(parties) && parties.length > 0) {
      const parsedParties = typeof parties === 'string' ? JSON.parse(parties) : parties;
      
      for (const party of parsedParties) {
        // Создаем запись стороны
        await connection.query(`
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
      }
    }

    // Логируем создание
    await connection.query(`
      INSERT INTO agreement_logs (agreement_id, action, description, user_id)
      VALUES (?, ?, ?, ?)
    `, [agreementId, 'created', 'Договор создан', userId]);

    await db.commit(connection);

    // Генерируем PDF для договора
    try {
      await this.generatePDF(agreementId);
    } catch (pdfError) {
      logger.error('PDF generation failed, but agreement created:', pdfError);
    }


    // Получаем ID созданных сторон для маппинга
    const createdParties = await db.query(
      'SELECT id, role FROM agreement_parties WHERE agreement_id = ? ORDER BY id',
      [agreementId]
    );

    logger.info(`Agreement created: ${agreement_number} (ID: ${agreementId}) by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Договор успешно создан',
      data: {
        id: agreementId,
        agreement_number,
        parties: createdParties // Возвращаем ID сторон для загрузки файлов
      }
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
 * Генерировать PDF для договора
 */
private async generatePDF(agreementId: number, connection?: any): Promise<void> {
  try {
    // Получаем данные договора
    const agreement = await db.queryOne(
      'SELECT pdf_path FROM agreements WHERE id = ?',
      [agreementId]
    );

    if (!agreement) {
      throw new Error('Agreement not found');
    }

    // Удаляем старый PDF если есть
    if (agreement.pdf_path) {
      await PDFService.deleteOldPDF(agreement.pdf_path);
    }

    // Генерируем новый PDF через фронтенд (как Print)
    const pdfPath = await PDFService.generateAgreementPDF(agreementId);

    // Обновляем путь к PDF в базе
    const updateQuery = 'UPDATE agreements SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?';
    
    if (connection) {
      await connection.query(updateQuery, [pdfPath, agreementId]);
    } else {
      await db.query(updateQuery, [pdfPath, agreementId]);
    }

    logger.info(`PDF generated and saved for agreement ${agreementId}: ${pdfPath}`);
  } catch (error) {
    logger.error(`Error generating PDF for agreement ${agreementId}:`, error);
    throw error;
  }
}


/**
 * Получить договор для публичного просмотра (для генерации PDF)
 * GET /api/agreements/:id/public
 */
async getPublicAgreement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { token } = req.query;

    // Если токен передан - проверяем его
    if (token) {
      const tokenData = await db.queryOne(
        'SELECT * FROM agreement_print_tokens WHERE agreement_id = ? AND token = ? AND expires_at > NOW()',
        [id, token]
      );

      if (!tokenData) {
        res.status(403).json({
          success: false,
          message: 'Недействительный или истекший токен доступа'
        });
        return;
      }

      // Удаляем использованный токен (одноразовый)
      await db.query('DELETE FROM agreement_print_tokens WHERE token = ?', [token]);
    }

    // УВЕЛИЧИВАЕМ ЛИМИТ
    await db.query('SET SESSION group_concat_max_len = 1000000');

    const agreement = await db.queryOne(`
      SELECT 
        a.*,
        at.name as template_name,
        GROUP_CONCAT(DISTINCT CONCAT(s.id, '~|~', s.signer_name, '~|~', s.signer_role, '~|~', s.is_signed, '~|~', COALESCE(s.signature_data, ''), '~|~', COALESCE(s.signed_at, '')) SEPARATOR '|||') as signatures_data,
        GROUP_CONCAT(DISTINCT CONCAT(ap.id, '~|~', ap.role, '~|~', COALESCE(ap.name, ''), '~|~', COALESCE(ap.is_company, 0)) SEPARATOR '|||') as parties_data
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN agreement_signatures s ON a.id = s.agreement_id
      LEFT JOIN agreement_parties ap ON a.id = ap.agreement_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [id]);

    if (!agreement) {
      res.status(404).json({
        success: false,
        message: 'Договор не найден'
      });
      return;
    }

    // Парсим подписи
    const signatures = [];
    if (agreement.signatures_data) {
      const signaturesArr = agreement.signatures_data.split('|||');
      for (const sigStr of signaturesArr) {
        const [sid, name, role, is_signed, signature_data, signed_at] = sigStr.split('~|~');
        signatures.push({
          id: parseInt(sid),
          signer_name: name,
          signer_role: role,
          is_signed: is_signed === '1',
          signature_data: signature_data || null,
          signed_at: signed_at || null
        });
      }
    }

    // Парсим стороны
    const parties = [];
    if (agreement.parties_data) {
      const partiesArr = agreement.parties_data.split('|||');
      for (const partyStr of partiesArr) {
        const [pid, role, name, is_company] = partyStr.split('~|~');
        
        const documents = await db.query(
          'SELECT document_base64 FROM agreement_party_documents WHERE party_id = ?',
          [parseInt(pid)]
        );
        
        parties.push({
          id: parseInt(pid),
          role,
          name,
          is_company: is_company === '1',
          documents: documents.map((d: any) => ({ document_base64: d.document_base64 }))
        });
      }
    }

    agreement.signatures = signatures;
    agreement.parties = parties;

    res.json({
      success: true,
      data: agreement
    });

  } catch (error) {
    logger.error('Get public agreement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки договора'
    });
  }
}

/**
 * Получить договор для генерации PDF (внутренний endpoint для Puppeteer)
 * GET /api/agreements/:id/internal
 */
async getAgreementInternal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { internalKey } = req.query;

    // Проверяем внутренний ключ
    const expectedKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    if (internalKey !== expectedKey) {
      res.status(403).json({
        success: false,
        message: 'Доступ запрещен'
      });
      return;
    }

    // УВЕЛИЧИВАЕМ ЛИМИТ
    await db.query('SET SESSION group_concat_max_len = 1000000');

    const agreement = await db.queryOne(`
      SELECT 
        a.*,
        at.name as template_name,
        GROUP_CONCAT(DISTINCT CONCAT(s.id, '~|~', s.signer_name, '~|~', s.signer_role, '~|~', s.is_signed, '~|~', COALESCE(s.signature_data, ''), '~|~', COALESCE(s.signed_at, '')) SEPARATOR '|||') as signatures_data,
        GROUP_CONCAT(DISTINCT CONCAT(ap.id, '~|~', ap.role, '~|~', COALESCE(ap.name, ''), '~|~', COALESCE(ap.is_company, 0)) SEPARATOR '|||') as parties_data
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN agreement_signatures s ON a.id = s.agreement_id
      LEFT JOIN agreement_parties ap ON a.id = ap.agreement_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [id]);

    if (!agreement) {
      res.status(404).json({
        success: false,
        message: 'Договор не найден'
      });
      return;
    }

    // Парсим подписи
    const signatures = [];
    if (agreement.signatures_data) {
      const signaturesArr = agreement.signatures_data.split('|||');
      for (const sigStr of signaturesArr) {
        const [sid, name, role, is_signed, signature_data, signed_at] = sigStr.split('~|~');
        signatures.push({
          id: parseInt(sid),
          signer_name: name,
          signer_role: role,
          is_signed: is_signed === '1',
          signature_data: signature_data || null,
          signed_at: signed_at || null
        });
      }
    }

    // Парсим стороны
    const parties = [];
    if (agreement.parties_data) {
      const partiesArr = agreement.parties_data.split('|||');
      for (const partyStr of partiesArr) {
        const [pid, role, name, is_company] = partyStr.split('~|~');
        
        const documents = await db.query(
          'SELECT document_base64 FROM agreement_party_documents WHERE party_id = ?',
          [parseInt(pid)]
        );
        
        parties.push({
          id: parseInt(pid),
          role,
          name,
          is_company: is_company === '1',
          documents: documents.map((d: any) => ({ document_base64: d.document_base64 }))
        });
      }
    }

    agreement.signatures = signatures;
    agreement.parties = parties;

    res.json({
      success: true,
      data: agreement
    });

  } catch (error) {
    logger.error('Get agreement internal error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки договора'
    });
  }
}

/**
 * Получить договор по ссылке подписи (публичный)
 * GET /api/agreements/by-signature-link/:link
 */
async getPublicAgreementBySignatureLink(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { link } = req.params;

    // Находим подпись
    const signature = await db.queryOne(
      'SELECT agreement_id FROM agreement_signatures WHERE signature_link = ?',
      [link]
    );

    if (!signature) {
      res.status(404).json({
        success: false,
        message: 'Подпись не найдена'
      });
      return;
    }

    // УВЕЛИЧИВАЕМ ЛИМИТ
    await db.query('SET SESSION group_concat_max_len = 1000000');

    // Получаем полный договор
    const agreement = await db.queryOne(`
      SELECT 
        a.*,
        at.name as template_name,
        GROUP_CONCAT(DISTINCT CONCAT(s.id, '~|~', s.signer_name, '~|~', s.signer_role, '~|~', s.is_signed, '~|~', COALESCE(s.signature_data, ''), '~|~', COALESCE(s.signed_at, '')) SEPARATOR '|||') as signatures_data
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN agreement_signatures s ON a.id = s.agreement_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [signature.agreement_id]);

    if (!agreement) {
      res.status(404).json({
        success: false,
        message: 'Договор не найден'
      });
      return;
    }

// Парсим подписи
const signatures = [];
if (agreement.signatures_data) {
  const signaturesArr = agreement.signatures_data.split('|||');
  for (const sigStr of signaturesArr) {
    const [sid, name, role, is_signed, signature_data, signed_at] = sigStr.split('~|~');
    signatures.push({
      id: parseInt(sid),
      signer_name: name,
      signer_role: role,
      is_signed: is_signed === '1',
      signature_data: signature_data || null,
      signed_at: signed_at || null
    });
  }
}

    agreement.signatures = signatures;

    res.json({
      success: true,
      data: agreement
    });

  } catch (error) {
    logger.error('Get public agreement by link error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки договора'
    });
  }
}


/**
 * Создать временный токен для печати
 * POST /api/agreements/:id/print-token
 */
async createPrintToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Проверяем что договор существует и пользователь имеет доступ
    const agreement = await db.queryOne(
      'SELECT id FROM agreements WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!agreement) {
      res.status(404).json({
        success: false,
        message: 'Договор не найден'
      });
      return;
    }

    // Генерируем временный токен (действует 5 минут)
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Сохраняем токен в БД
    await db.query(`
      INSERT INTO agreement_print_tokens (agreement_id, token, expires_at)
      VALUES (?, ?, ?)
    `, [id, token, expiresAt]);

    res.json({
      success: true,
      token,
      url: `/agreement-print/${id}?token=${token}`
    });
  } catch (error) {
    logger.error('Create print token error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания токена'
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

      // Регенерируем PDF после обновления
      try {
        await this.generatePDF(parseInt(id as string));
      } catch (pdfError) {
        logger.error('PDF regeneration failed:', pdfError);
      }

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
        COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name,
        p.property_number
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN properties p ON a.property_id = p.id
      LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
      LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
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

    // Для каждой стороны получаем документы
    for (const party of parties as any[]) {
      const documents = await db.query(
        'SELECT id, document_path, document_base64, document_type, file_size, mime_type, uploaded_at FROM agreement_party_documents WHERE party_id = ? ORDER BY uploaded_at',
        [party.id]
      );
      party.documents = documents;
    }

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

    // ✅ УБРАЛИ УДАЛЕНИЕ СУЩЕСТВУЮЩИХ ПОДПИСЕЙ - теперь только добавляем новые!
    // await connection.query('DELETE FROM agreement_signatures WHERE agreement_id = ?', [id]); // <-- ЭТА СТРОКА УДАЛЕНА

    // ✅ Проверяем уникальность ролей среди новых подписей
    const newRoles = signatures.map((s: any) => s.signer_role);
    const uniqueNewRoles = new Set(newRoles);
    
    if (newRoles.length !== uniqueNewRoles.size) {
      await db.rollback(connection);
      res.status(400).json({
        success: false,
        message: 'Роли подписантов должны быть уникальными'
      });
      return;
    }

    // ✅ Проверяем конфликт с существующими ролями
    const existingSignatures = await db.query<any>(
      'SELECT signer_role FROM agreement_signatures WHERE agreement_id = ?',
      [id]
    );
    
    const existingRoles = existingSignatures.map((s: any) => s.signer_role);
    const conflictingRoles = newRoles.filter((role: string) => existingRoles.includes(role));
    
    if (conflictingRoles.length > 0) {
      await db.rollback(connection);
      res.status(400).json({
        success: false,
        message: `Роль "${conflictingRoles[0]}" уже используется в существующих подписях`
      });
      return;
    }

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

    // Обновляем статус договора только если это первые подписи
    if (existingSignatures.length === 0) {
      await connection.query(
        'UPDATE agreements SET status = ? WHERE id = ?',
        ['pending_signatures', id]
      );
    }

    // Генерируем QR код (если ещё не был сгенерирован)
    if (!(agreement as any).qr_code_path) {
      const qrCodePath = await this.generateQRCode((agreement as any).public_link, (agreement as any).agreement_number);
      await connection.query('UPDATE agreements SET qr_code_path = ? WHERE id = ?', [qrCodePath, id]);
    }

    // Логируем
    await connection.query(`
      INSERT INTO agreement_logs (agreement_id, action, description, user_id)
      VALUES (?, ?, ?, ?)
    `, [
      id,
      'signatures_added',
      `Добавлено подписей: ${signatures.length}`,
      req.admin!.id
    ]);

    await db.commit(connection);

    logger.info(`Signatures created for agreement: ${id}`);

    // Регенерируем PDF с новыми подписями
    try {
      await this.generatePDF(parseInt(id));
      logger.info(`PDF regenerated after creating signatures for agreement ${id}`);
    } catch (pdfError) {
      logger.error('PDF regeneration error after creating signatures:', pdfError);
      // Не прерываем выполнение, просто логируем ошибку
    }
    
    res.json({
      success: true,
      message: 'Подписи успешно созданы',
      data: {
        signatureLinks: signatureLinks
      }
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
        COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name, CONCAT('Объект ', p.property_number)) as property_name,
        p.deal_type,
        p.property_type
      FROM properties p
      LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
      LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
      WHERE p.deleted_at IS NULL
    `;

    const queryParams: any[] = [];

    if (search) {
      query += ` AND (COALESCE(pt_ru.property_name, pt_en.property_name, p.complex_name) LIKE ? OR p.property_number LIKE ? OR p.address LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.complex_name, p.property_number`;

    const properties = await db.query(query, queryParams);

    // Группируем по комплексам
    const grouped: any = {
      complexes: {} as Record<string, any[]>,
      standalone: [] as any[],
      all: properties
    };

    (properties as any[]).forEach((prop: any) => {
      if (prop.complex_name) {
        if (!grouped.complexes[prop.complex_name]) {
          grouped.complexes[prop.complex_name] = [];
        }
        grouped.complexes[prop.complex_name].push(prop);
      } else {
        grouped.standalone.push(prop);
      }
    });

    res.json({
      success: true,
      data: grouped
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
/**
 * Загрузить документы для договора после создания
 * POST /api/agreements/:agreementId/upload-documents
 */
async uploadAgreementDocuments(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { agreementId } = req.params;
    const uploadedFiles = (req as any).files || [];
    const { partyMapping } = req.body; // JSON строка с маппингом party index -> party id

    logger.info(`Uploading documents for agreement ${agreementId}, files count: ${uploadedFiles.length}`);

    // Парсим маппинг индексов сторон к их ID
    const mapping = partyMapping ? JSON.parse(partyMapping) : {};
    
    const fs = require('fs-extra');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');

    let uploadedCount = 0;

    for (const file of uploadedFiles) {
      try {
        // Файлы приходят с fieldname вида "party_0_doc_0"
        const match = file.fieldname.match(/party_(\d+)_doc_(\d+)/);
        if (!match) continue;

        const partyIndex = parseInt(match[1]);
        const partyId = mapping[partyIndex.toString()];

        if (!partyId) {
          logger.warn(`No party ID found for index ${partyIndex}`);
          continue;
        }

        // Генерируем имя файла
        const ext = file.mimetype.split('/')[1] || 'jpg';
        const filename = `${uuidv4()}.${ext}`;
        const uploadDir = path.join(__dirname, '../../public/uploads/party-documents');
        await fs.ensureDir(uploadDir);
        
        const filepath = path.join(uploadDir, filename);
        
        // Сохраняем файл на диск
        await fs.writeFile(filepath, file.buffer);
        
        const documentPath = `/uploads/party-documents/${filename}`;
        
        // Конвертируем в base64 для БД
        const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        
        // Сохраняем в таблицу agreement_party_documents
        await connection.query(`
          INSERT INTO agreement_party_documents 
          (party_id, document_path, document_base64, document_type, file_size, mime_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          partyId,
          documentPath,
          base64Data,
          'passport',
          file.size,
          file.mimetype
        ]);
        
        uploadedCount++;
        logger.info(`Document saved for party ${partyId}: ${documentPath} (${file.size} bytes)`);
      } catch (err) {
        logger.error('Error saving document:', err);
        // Продолжаем обработку остальных файлов
      }
    }

    await db.commit(connection);

    // Регенерируем PDF после добавления документов
    try {
      await this.generatePDF(parseInt(agreementId));
    } catch (pdfError) {
      logger.error('PDF regeneration failed:', pdfError);
    }

    res.json({
      success: true,
      message: `Загружено документов: ${uploadedCount}`,
      uploadedCount
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Upload agreement documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки документов'
    });
  }
}

/**
 * Получить HTML версию договора
 * GET /api/agreements/:id/html
 */
async getAgreementHTML(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { token } = req.query;

    // Если токен передан - проверяем его
    if (token) {
      const tokenData = await db.queryOne(
        'SELECT * FROM agreement_print_tokens WHERE agreement_id = ? AND token = ? AND expires_at > NOW()',
        [id, token]
      );

      if (!tokenData) {
        res.status(403).send('Недействительный или истекший токен');
        return;
      }

      // Удаляем использованный токен
      await db.query('DELETE FROM agreement_print_tokens WHERE token = ?', [token]);
    } else {
      // Если токена нет - требуем авторизацию (через middleware)
      if (!req.admin) {
        res.status(401).send('Требуется авторизация');
        return;
      }
    }

    // УВЕЛИЧИВАЕМ ЛИМИТ GROUP_CONCAT
    await db.query('SET SESSION group_concat_max_len = 1000000');

    // Получаем полные данные договора
    const agreement = await db.queryOne(`
      SELECT 
        a.*,
        at.name as template_name,
        GROUP_CONCAT(DISTINCT CONCAT(s.id, '~|~', s.signer_name, '~|~', s.signer_role, '~|~', s.is_signed, '~|~', COALESCE(s.signature_data, ''), '~|~', COALESCE(s.signed_at, '')) SEPARATOR '|||') as signatures_data,
        GROUP_CONCAT(DISTINCT CONCAT(ap.id, '~|~', ap.role, '~|~', COALESCE(ap.name, ''), '~|~', COALESCE(ap.is_company, 0)) SEPARATOR '|||') as parties_data
      FROM agreements a
      LEFT JOIN agreement_templates at ON a.template_id = at.id
      LEFT JOIN agreement_signatures s ON a.id = s.agreement_id
      LEFT JOIN agreement_parties ap ON a.id = ap.agreement_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [id]);

    if (!agreement) {
      res.status(404).send('Agreement not found');
      return;
    }

// Парсим подписи
const signatures = [];
if (agreement.signatures_data) {
  const signaturesArr = agreement.signatures_data.split('|||');
  for (const sigStr of signaturesArr) {
    const [sid, name, role, is_signed, signature_data, signed_at] = sigStr.split('~|~');
    signatures.push({
      id: parseInt(sid),
      signer_name: name,
      signer_role: role,
      is_signed: is_signed === '1',
      signature_data: signature_data || null,
      signed_at: signed_at || null
    });
  }
}

// Парсим стороны
const parties = [];
if (agreement.parties_data) {
  const partiesArr = agreement.parties_data.split('|||');
  for (const partyStr of partiesArr) {
    const [pid, role, name, is_company] = partyStr.split('~|~');
    
    const documents = await db.query(
      'SELECT document_base64 FROM agreement_party_documents WHERE party_id = ?',
      [parseInt(pid)]
    );
    
    parties.push({
      id: parseInt(pid),
      role,
      name,
      is_company: is_company === '1',
      documents: documents.map((d: any) => ({ document_base64: d.document_base64 }))
    });
  }
}

    // Парсим структуру если есть
    let structure = null;
    if (agreement.structure) {
      try {
        structure = JSON.parse(agreement.structure);
      } catch (e) {
        logger.error('Error parsing structure:', e);
      }
    }

    // Генерируем полный HTML
    const html = this.generateFullDocumentHTML(agreement, signatures, parties, structure);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    logger.error('Get agreement HTML error:', error);
    res.status(500).send('Error generating HTML');
  }
}

/**
 * Генерация полного HTML документа со стилями DocumentEditor
 */
private generateFullDocumentHTML(agreement: any, signatures: any[], parties: any[], structure: any): string {
  const logoUrl = 'https://admin.novaestate.company/nova-logo.svg';
  
  // Функция форматирования роли
  const formatRole = (role: string): string => {
    const roles: any = {
      'tenant': 'Tenant',
      'lessor': 'Lessor',
      'landlord': 'Landlord',
      'representative': 'Representative',
      'principal': 'Principal',
      'agent': 'Agent',
      'buyer': 'Buyer',
      'seller': 'Seller'
    };
    return roles[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Рендерим ноды из структуры - точная копия структуры DocumentEditor
  const renderNodes = (nodes: any[]): string => {
    if (!nodes || nodes.length === 0) return '';

    let html = '';

    nodes.forEach(node => {
      // NodeContainer wrapper с правильным margin
      const nodeMargin = '5mm 0';
      html += `<div style="margin: ${nodeMargin}; position: relative; page-break-inside: avoid;">`;

      if (node.type === 'section') {
        // SectionHeader
        html += `<div class="section-header">${node.content}</div>`;

        // Children внутри той же NodeContainer
        if (node.children) {
          node.children.forEach((child: any) => {
            if (child.type === 'subsection') {
              html += `<div class="subsection"><span class="number">${child.number}.</span> ${child.content}</div>`;
            } else if (child.type === 'paragraph') {
              html += `<p class="paragraph">${child.content}</p>`;
            } else if (child.type === 'bulletList' && child.items) {
              html += '<ul class="bullet-list">';
              child.items.forEach((item: string) => {
                html += `<li>${item}</li>`;
              });
              html += '</ul>';
            }
          });
        }
      }

      html += '</div>'; // закрываем NodeContainer
    });

    return html;
  };

  const contentHtml = structure && structure.nodes 
    ? renderNodes(structure.nodes)
    : (agreement.content || '');

  const titleText = structure?.title || 'LEASE AGREEMENT';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agreement.agreement_number}</title>
  <style>
    @page {
      size: 210mm 297mm;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    body {
      font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1b273b;
      background: #f9f6f3;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      background: #f9f6f3;
      padding: 10mm;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .page-inner {
      width: 190mm;
      background: #f9f6f3;
      border: 1px solid #1b273b;
      padding: 15mm 15mm 10mm 15mm;
      flex: 1;
      position: relative;
      box-sizing: border-box;
    }

    .page-inner.not-first {
      padding: 10mm 15mm;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.03;
      z-index: 0;
      pointer-events: none;
    }

    .watermark img {
      width: 80mm;
      height: auto;
    }

    .page-content {
      position: relative;
      z-index: 4;
      width: 160mm;
    }

    .header {
      margin-bottom: 10mm;
      text-align: center;
      position: relative;
      z-index: 10;
      page-break-inside: avoid;
      page-break-after: avoid;
    }

    .logo-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 5mm;
      position: relative;
    }

    .decorative-line {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #1b273b 50%, transparent 100%);
      flex: 1;
    }

    .decorative-line.left {
      margin-right: 10mm;
    }

    .decorative-line.right {
      margin-left: 10mm;
    }

    .logo-container {
      background: #f9f6f3;
      padding: 0 5mm;
      height: 10mm;
      z-index: 2;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-container img {
      height: 35mm;
      width: auto;
      filter: brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1131%) hue-rotate(185deg) brightness(94%) contrast(91%);
    }

    h1 {
      font-size: 8mm;
      font-weight: 900;
      text-align: center;
      margin: -10mm 0 -2mm 0;
      letter-spacing: 0.5mm;
      color: #1b273b;
      z-index: 999;
      position: relative;
      page-break-after: avoid;
    }

    .date-location {
      display: flex;
      justify-content: space-between;
      margin: 5mm 0;
      font-size: 4mm;
      font-weight: 300;
      width: 160mm;
      page-break-inside: avoid;
    }

    .section-header {
      background: #5d666e !important;
      color: white !important;
      padding: 1.5mm 4mm;
      font-size: 4.5mm;
      font-weight: 700;
      margin: -1mm 0 -4mm 0;
      letter-spacing: 0.2mm;
      width: 160mm;
      page-break-after: avoid;
      page-break-inside: avoid;
      position: relative;
      z-index: 10;
    }

    .subsection {
      margin: -4mm 0;
      font-weight: 300;
      line-height: 1.5;
      font-size: 3.8mm;
      width: 160mm;
      page-break-inside: avoid;
      position: relative;
    }

    .subsection .number {
      font-weight: 700;
      margin-right: 1mm;
    }

    .paragraph {
      margin: -5mm 0;
      font-weight: 300;
      line-height: 1.6;
      font-size: 3.8mm;
      page-break-inside: avoid;
      orphans: 3;
      widows: 3;
    }

    .bullet-list {
      margin: -5mm 0 -3mm 0mm;
      padding-left: 6mm;
      width: 148mm;
      page-break-inside: avoid;
      list-style-type: disc;
    }

    .bullet-list li {
      margin: 1mm 0;
      font-weight: 300;
      line-height: 1.6;
      font-size: 3.8mm;
      page-break-inside: avoid;
      orphans: 2;
      widows: 2;
    }

    .signature-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 3mm;
    }

    .signature-table th,
    .signature-table td {
      border: 1px solid #1b273b;
      padding: 3mm;
      text-align: left;
      font-size: 3.8mm;
    }

    .signature-table th {
      background: #f0f0f0 !important;
      font-weight: 600;
    }

    .signature-img {
      max-height: 20mm;
      max-width: 50mm;
      object-fit: contain;
    }

    .document-section {
      margin-top: 5mm;
    }

    .document-block {
      margin-bottom: 8mm;
      page-break-inside: avoid;
    }

    .document-label {
      font-size: 4mm;
      font-weight: 600;
      margin-bottom: 3mm;
      margin-top: 5mm;
      color: #1b273b;
      position: relative;
      z-index: 5;
    }

    .document-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5mm;
    }

    .document-img {
      width: 100%;
      max-width: 85mm;
      height: auto;
      border: 1px solid #1b273b;
      object-fit: contain;
      background: white;
    }

    .page-number {
      position: absolute;
      bottom: 10mm;
      right: 15mm;
      font-size: 3.5mm;
      font-weight: 300;
      color: #666;
      z-index: 10;
    }

    strong {
      font-weight: 700;
    }
  </style>
</head>
<body>
  <!-- Первая страница -->
  <div class="page">
    <div class="page-inner">
      <div class="watermark">
        <img src="${logoUrl}" alt="Logo" />
      </div>
      <div class="page-content">
        <div class="header">
          <div class="logo-wrapper">
            <div class="decorative-line left"></div>
            <div class="logo-container">
              <img src="${logoUrl}" alt="Logo" />
            </div>
            <div class="decorative-line right"></div>
          </div>
        </div>
        
        <h1>${titleText}</h1>
        
        <div class="date-location">
          <span>City: ${agreement.city || 'Phuket'}</span>
          <span>${formatDate(new Date())}</span>
        </div>
        
        ${contentHtml}
      </div>
      <div class="page-number">Page 1 of ${signatures.length > 0 ? '2' : '1'}</div>
    </div>
  </div>

  ${signatures.length > 0 ? `
  <!-- Страница с подписями -->
  <div class="page">
    <div class="page-inner not-first">
      <div class="watermark">
        <img src="${logoUrl}" alt="Logo" />
      </div>
      <div class="page-content">
        <div class="section-header">SIGNATURES</div>
        
        <table class="signature-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Signature</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${signatures.map(sig => `
              <tr>
                <td>
                  <div>${sig.signer_name}</div>
                  <div style="font-size: 3mm; color: #666; margin-top: 1mm;">
                    (${formatRole(sig.signer_role)})
                  </div>
                </td>
                <td style="text-align: center;">
                  ${sig.is_signed && sig.signature_data 
                    ? `<img src="${sig.signature_data}" class="signature-img" alt="Signature" />` 
                    : '___________'}
                </td>
                <td>
                  ${sig.signed_at 
                    ? formatDate(new Date(sig.signed_at))
                    : '«____» __________ 20__'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${parties.filter((p: any) => p.documents && p.documents.length > 0).length > 0 ? `
          <div class="document-section">
            <div class="section-header">ATTACHED DOCUMENTS</div>
            ${parties.filter((p: any) => p.documents && p.documents.length > 0).map((party: any) => `
              <div class="document-block">
                <div class="document-label">${formatRole(party.role)}'s Passport Documents:</div>
                <div class="document-grid">
                  ${party.documents.map((doc: any) => `
                    <img src="${doc.document_base64}" class="document-img" alt="Document" />
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="page-number">Page 2 of 2</div>
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}

/**
 * Скачать PDF договора
 * GET /api/agreements/:id/pdf
 */
async downloadPDF(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const agreement = await db.queryOne<any>(
      'SELECT pdf_path, agreement_number FROM agreements WHERE id = ?',
      [id]
    );

    if (!agreement) {
      res.status(404).json({
        success: false,
        message: 'Договор не найден'
      });
      return;
    }

    if (!agreement.pdf_path) {
      // Если PDF еще не сгенерирован - генерируем сейчас
      await this.generatePDF(parseInt(id));
      
      const updatedAgreement = await db.queryOne<any>(
        'SELECT pdf_path FROM agreements WHERE id = ?',
        [id]
      );
      
      agreement.pdf_path = updatedAgreement.pdf_path;
    }

    const path = require('path');
    const filePath = path.join(__dirname, '../../public', agreement.pdf_path);

    // Проверяем существование файла
    const fs = require('fs-extra');
    if (!await fs.pathExists(filePath)) {
      res.status(404).json({
        success: false,
        message: 'PDF файл не найден'
      });
      return;
    }

    // Отправляем файл
    res.download(filePath, `${agreement.agreement_number}.pdf`, (err) => {
      if (err) {
        logger.error('Error downloading PDF:', err);
        res.status(500).json({
          success: false,
          message: 'Ошибка скачивания PDF'
        });
      }
    });

  } catch (error) {
    logger.error('Download PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка скачивания PDF'
    });
  }
}

}

export default new AgreementsController();