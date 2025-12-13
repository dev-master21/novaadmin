// backend/src/controllers/financialDocuments.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import QRCode from 'qrcode';
import { 
  CreateInvoiceDTO, 
  CreateReceiptDTO, 
  CreateSavedBankDetailsDTO 
} from '../types/financialDocuments.types';

class FinancialDocumentsController {
  
  // ==================== SAVED BANK DETAILS ====================
  
  /**
   * Получить все сохраненные банковские реквизиты
   * GET /api/financial-documents/saved-bank-details
   */
  async getAllSavedBankDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userPartnerId = req.admin?.partner_id;
      const whereConditions: string[] = [];
      const queryParams: any[] = [];

      // ✅ ФИЛЬТРАЦИЯ ПО ПАРТНЁРУ
      if (userPartnerId !== null && userPartnerId !== undefined) {
        whereConditions.push('partner_id = ?');
        queryParams.push(userPartnerId);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      const query = `
        SELECT 
          sbd.*,
          au.username as created_by_name
        FROM saved_bank_details sbd
        LEFT JOIN admin_users au ON sbd.created_by = au.id
        ${whereClause}
        ORDER BY sbd.created_at DESC
      `;

      const savedBankDetails = await db.query(query, queryParams);

      res.json({
        success: true,
        data: savedBankDetails
      });
    } catch (error) {
      logger.error('Get all saved bank details error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения сохраненных реквизитов'
      });
    }
  }

  /**
   * Получить сохраненные реквизиты по ID
   * GET /api/financial-documents/saved-bank-details/:id
   */
  async getSavedBankDetailsById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userPartnerId = req.admin?.partner_id;

      let query = `
        SELECT 
          sbd.*,
          au.username as created_by_name
        FROM saved_bank_details sbd
        LEFT JOIN admin_users au ON sbd.created_by = au.id
        WHERE sbd.id = ?
      `;
      const queryParams: any[] = [id];

      // ✅ ФИЛЬТРАЦИЯ ПО ПАРТНЁРУ
      if (userPartnerId !== null && userPartnerId !== undefined) {
        query += ' AND sbd.partner_id = ?';
        queryParams.push(userPartnerId);
      }

      const savedBankDetails = await db.queryOne(query, queryParams);

      if (!savedBankDetails) {
        res.status(404).json({
          success: false,
          message: 'Сохраненные реквизиты не найдены'
        });
        return;
      }

      res.json({
        success: true,
        data: savedBankDetails
      });
    } catch (error) {
      logger.error('Get saved bank details by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения сохраненных реквизитов'
      });
    }
  }

/**
 * Создать сохраненные банковские реквизиты
 * POST /api/financial-documents/saved-bank-details
 */
async createSavedBankDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.admin!.id;
    const userPartnerId = req.admin?.partner_id;
    const data: CreateSavedBankDetailsDTO = req.body;

    const result = await db.query(`
      INSERT INTO saved_bank_details (
        name, bank_details_type,
        bank_name, bank_account_name, bank_account_number,
        bank_account_address, bank_currency, bank_code, bank_swift_code,
        bank_address,
        bank_custom_details,
        created_by, partner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.bank_details_type,
      data.bank_name || null,
      data.bank_account_name || null,
      data.bank_account_number || null,
      data.bank_account_address || null,
      data.bank_currency || null,
      data.bank_code || null,
      data.bank_swift_code || null,
      data.bank_address || null,
      data.bank_custom_details || null,
      userId,
      userPartnerId || null
    ]);

    const savedBankDetailsId = (result as any)[0].insertId;

    logger.info(`Saved bank details created: ${savedBankDetailsId} by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Реквизиты успешно сохранены',
      data: {
        id: savedBankDetailsId
      }
    });
  } catch (error) {
    logger.error('Create saved bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сохранения реквизитов'
    });
  }
}

/**
 * Обновить сохраненные банковские реквизиты
 * PUT /api/financial-documents/saved-bank-details/:id
 */
async updateSavedBankDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userPartnerId = req.admin?.partner_id;
    const data: Partial<CreateSavedBankDetailsDTO> = req.body;

    // Проверяем существование и доступ
    let checkQuery = 'SELECT * FROM saved_bank_details WHERE id = ?';
    const checkParams: any[] = [id];

    if (userPartnerId !== null && userPartnerId !== undefined) {
      checkQuery += ' AND partner_id = ?';
      checkParams.push(userPartnerId);
    }

    const existing = await db.queryOne(checkQuery, checkParams);
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Сохраненные реквизиты не найдены'
      });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.bank_details_type !== undefined) {
      fields.push('bank_details_type = ?');
      values.push(data.bank_details_type);
    }
    if (data.bank_name !== undefined) {
      fields.push('bank_name = ?');
      values.push(data.bank_name || null);
    }
    if (data.bank_account_name !== undefined) {
      fields.push('bank_account_name = ?');
      values.push(data.bank_account_name || null);
    }
    if (data.bank_account_number !== undefined) {
      fields.push('bank_account_number = ?');
      values.push(data.bank_account_number || null);
    }
    if (data.bank_account_address !== undefined) {
      fields.push('bank_account_address = ?');
      values.push(data.bank_account_address || null);
    }
    if (data.bank_currency !== undefined) {
      fields.push('bank_currency = ?');
      values.push(data.bank_currency || null);
    }
    if (data.bank_code !== undefined) {
      fields.push('bank_code = ?');
      values.push(data.bank_code || null);
    }
    if (data.bank_swift_code !== undefined) {
      fields.push('bank_swift_code = ?');
      values.push(data.bank_swift_code || null);
    }
    if (data.bank_address !== undefined) {
      fields.push('bank_address = ?');
      values.push(data.bank_address || null);
    }
    if (data.bank_custom_details !== undefined) {
      fields.push('bank_custom_details = ?');
      values.push(data.bank_custom_details || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE saved_bank_details SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    logger.info(`Saved bank details updated: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Реквизиты успешно обновлены'
    });
  } catch (error) {
    logger.error('Update saved bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления реквизитов'
    });
  }
}

  /**
   * Удалить сохраненные банковские реквизиты
   * DELETE /api/financial-documents/saved-bank-details/:id
   */
  async deleteSavedBankDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userPartnerId = req.admin?.partner_id;

      let query = 'DELETE FROM saved_bank_details WHERE id = ?';
      const queryParams: any[] = [id];

      if (userPartnerId !== null && userPartnerId !== undefined) {
        query += ' AND partner_id = ?';
        queryParams.push(userPartnerId);
      }

      const result = await db.query(query, queryParams);

      if ((result as any)[0].affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Сохраненные реквизиты не найдены'
        });
        return;
      }

      logger.info(`Saved bank details deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Реквизиты успешно удалены'
      });
    } catch (error) {
      logger.error('Delete saved bank details error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления реквизитов'
      });
    }
  }

  // ==================== INVOICES ====================
  
  /**
   * Получить список всех инвойсов
   * GET /api/financial-documents/invoices
   */
  async getAllInvoices(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, agreement_id, search, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = ['i.deleted_at IS NULL'];
      const queryParams: any[] = [];

      // ✅ ФИЛЬТРАЦИЯ ПО ПАРТНЁРУ
      const userPartnerId = req.admin?.partner_id;
      if (userPartnerId !== null && userPartnerId !== undefined) {
        whereConditions.push('au.partner_id = ?');
        queryParams.push(userPartnerId);
      }

      if (status) {
        whereConditions.push('i.status = ?');
        queryParams.push(status);
      }

      if (agreement_id) {
        whereConditions.push('i.agreement_id = ?');
        queryParams.push(agreement_id);
      }

      if (search) {
        whereConditions.push('(i.invoice_number LIKE ? OR i.notes LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Получаем общее количество
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM invoices i 
        LEFT JOIN admin_users au ON i.created_by = au.id
        ${whereClause}
      `;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем инвойсы с информацией об оплаченных позициях
      const query = `
        SELECT 
          i.*,
          a.agreement_number,
          u.username as created_by_name,
          au.partner_id as creator_partner_id,
          (SELECT COUNT(*) FROM receipts WHERE invoice_id = i.id AND deleted_at IS NULL) as receipts_count,
          (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as total_items_count,
          (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id AND is_fully_paid = 1) as paid_items_count
        FROM invoices i
        LEFT JOIN agreements a ON i.agreement_id = a.id
        LEFT JOIN admin_users u ON i.created_by = u.id
        LEFT JOIN admin_users au ON i.created_by = au.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limitNum, offset);
      const invoices = await db.query(query, queryParams);

      res.json({
        success: true,
        data: invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get all invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения инвойсов'
      });
    }
  }

/**
 * Получить инвойс по ID
 * GET /api/financial-documents/invoices/:id
 */
async getInvoiceById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // ✅ ДОБАВЛЕНО: Получение цветов партнёра
    const invoice = await db.queryOne(`
      SELECT 
        i.*,
        a.agreement_number,
        p.logo_filename as partner_logo_filename,
        p.partner_name,
        p.primary_color as partner_primary_color,
        p.secondary_color as partner_secondary_color,
        p.accent_color as partner_accent_color,
        au.username as created_by_name,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as items_count,
        (SELECT COUNT(*) FROM receipts WHERE invoice_id = i.id AND deleted_at IS NULL) as receipts_count
      FROM invoices i
      LEFT JOIN agreements a ON i.agreement_id = a.id
      LEFT JOIN admin_users au ON i.created_by = au.id
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE i.id = ? AND i.deleted_at IS NULL
    `, [id]);

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Инвойс не найден'
      });
      return;
    }

    // ✅ ДОБАВЛЯЕМ LOGO URL
    (invoice as any).logoUrl = (invoice as any).partner_logo_filename 
      ? `https://admin.novaestate.company/${(invoice as any).partner_logo_filename}`
      : 'https://admin.novaestate.company/nova-logo.svg';

    // ✅ ДОБАВЛЯЕМ ЦВЕТА ПАРТНЁРА (с дефолтными значениями)
    (invoice as any).primaryColor = (invoice as any).partner_primary_color || '#1b273b';
    (invoice as any).secondaryColor = (invoice as any).partner_secondary_color || '#5d666e';
    (invoice as any).accentColor = (invoice as any).partner_accent_color || '#1b273b';

    // Получаем позиции инвойса
    const items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
      [id]
    );

    // Получаем чеки
    const receipts = await db.query(`
      SELECT 
        r.*,
        au.username as created_by_name
      FROM receipts r
      LEFT JOIN admin_users au ON r.created_by = au.id
      WHERE r.invoice_id = ? AND r.deleted_at IS NULL
      ORDER BY r.receipt_date DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...invoice,
        items: items,
        receipts: receipts
      }
    });

  } catch (error) {
    logger.error('Get invoice by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения инвойса'
    });
  }
}

  /**
   * Получить статусы оплаты позиций инвойса
   * GET /api/financial-documents/invoices/:id/items-payment-status
   */
  async getInvoiceItemsPaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Проверяем существование инвойса
      const invoice = await db.queryOne(
        'SELECT id FROM invoices WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      // Получаем позиции с информацией об оплате
      const items = await db.query(`
        SELECT 
          ii.id as item_id,
          ii.description,
          ii.total_price,
          ii.amount_paid,
          ii.is_fully_paid,
          (
            SELECT COUNT(*) 
            FROM receipt_invoice_items rii
            JOIN receipts r ON rii.receipt_id = r.id
            WHERE rii.invoice_item_id = ii.id AND r.deleted_at IS NULL
          ) > 0 as has_active_receipt
        FROM invoice_items ii
        WHERE ii.invoice_id = ?
        ORDER BY ii.sort_order, ii.id
      `, [id]);

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      logger.error('Get invoice items payment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения статусов оплаты позиций'
      });
    }
  }

  /**
   * Проверить существующие инвойсы для договора
   * GET /api/financial-documents/agreements/:agreementId/check-existing-invoices
   */
  async checkExistingInvoicesForAgreement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { agreementId } = req.params;

      // Получаем существующие инвойсы для договора
      const existingInvoices = await db.query(`
        SELECT 
          i.id,
          i.invoice_number,
          i.invoice_date,
          i.total_amount,
          i.amount_paid,
          (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as items_count,
          (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id AND is_fully_paid = 1) as paid_items_count
        FROM invoices i
        WHERE i.agreement_id = ? AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC
      `, [agreementId]);

      if (existingInvoices.length === 0) {
        res.json({
          success: true,
          data: {
            hasExisting: false,
            invoices: []
          }
        });
        return;
      }

      // Для первого инвойса получаем детальную информацию
      const firstInvoice = existingInvoices[0] as any;
      const items = await db.query(
        'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
        [firstInvoice.id]
      );

      res.json({
        success: true,
        data: {
          hasExisting: true,
          count: existingInvoices.length,
          firstInvoice: {
            ...firstInvoice,
            items
          },
          allInvoices: existingInvoices
        }
      });
    } catch (error) {
      logger.error('Check existing invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка проверки существующих инвойсов'
      });
    }
  }
/**
 * Создать инвойс
 * POST /api/financial-documents/invoices
 */
async createInvoice(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const userId = req.admin!.id;
    const userPartnerId = req.admin?.partner_id;
    const data: CreateInvoiceDTO = req.body;

    // ✅ ИЗВЛЕКАЕМ show_qr_code (по умолчанию 1 - показывать)
    const showQrCode = data.show_qr_code !== undefined ? data.show_qr_code : 1;

    // ✅ ЗАГРУЗКА СОХРАНЕННЫХ РЕКВИЗИТОВ
    let bankDetails: any = {};
    if (data.saved_bank_details_id) {
      const saved = await db.queryOne(
        'SELECT * FROM saved_bank_details WHERE id = ?',
        [data.saved_bank_details_id]
      );
      if (saved) {
        bankDetails = {
          bank_details_type: (saved as any).bank_details_type,
          bank_name: (saved as any).bank_name,
          bank_account_name: (saved as any).bank_account_name,
          bank_account_number: (saved as any).bank_account_number,
          bank_account_address: (saved as any).bank_account_address,
          bank_currency: (saved as any).bank_currency,
          bank_code: (saved as any).bank_code,
          bank_swift_code: (saved as any).bank_swift_code,
          bank_address: (saved as any).bank_address,
          bank_custom_details: (saved as any).bank_custom_details
        };
      }
    } else {
      bankDetails = {
        bank_details_type: data.bank_details_type || 'simple',
        bank_name: data.bank_name,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
        bank_account_address: data.bank_account_address,
        bank_currency: data.bank_currency,
        bank_code: data.bank_code,
        bank_swift_code: data.bank_swift_code,
        bank_address: data.bank_address,
        bank_custom_details: data.bank_custom_details
      };
    }

    // ✅ ПОЛУЧАЕМ ДОМЕН ПАРТНЁРА ПОЛЬЗОВАТЕЛЯ
    const userPartner = await db.queryOne<any>(`
      SELECT p.domain, p.partner_name
      FROM admin_users au
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE au.id = ?
    `, [userId]);

    // Определяем базовый домен для ссылок (с поддоменом agreement)
    const baseDomain = userPartner?.domain 
      ? `agreement.${userPartner.domain}` 
      : 'documents.novaestate.company';
    console.log(`🌐 Using domain for invoice: ${baseDomain}`);

    // Генерируем уникальный номер INV-2025-ABC0001
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    const countResult = await connection.query(
      'SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?',
      [`INV-${year}-%`]
    );
    const count = (countResult[0] as any)[0].count + 1;
    const invoice_number = `INV-${year}-${randomPart}${count.toString().padStart(4, '0')}`;
    
    // Генерируем UUID
    const { v4: uuidv4 } = require('uuid');
    const invoiceUuid = uuidv4();

    // Вычисляем суммы
    let subtotal = 0;
    data.items.forEach(item => {
      item.total_price = item.quantity * item.unit_price;
      subtotal += item.total_price;
    });

    const tax_amount = data.tax_amount || 0;
    const total_amount = subtotal + tax_amount;

    // ✅ ДОБАВЛЕНО show_qr_code в INSERT (43 поля, 43 значения)
    const result = await connection.query(`
      INSERT INTO invoices (
        invoice_number, uuid, agreement_id, invoice_date, due_date,
        from_type, from_company_name, from_company_tax_id, from_company_address,
        from_director_name, from_director_country, from_director_passport,
        from_individual_name, from_individual_country, from_individual_passport,
        to_type, to_company_name, to_company_tax_id, to_company_address,
        to_director_name, to_director_country, to_director_passport,
        to_individual_name, to_individual_country, to_individual_passport,
        subtotal, tax_amount, total_amount, currency,
        bank_details_type, bank_name, bank_account_name, bank_account_number,
        bank_account_address, bank_currency, bank_code, bank_swift_code, 
        bank_address, bank_custom_details,
        notes, status, created_by, show_qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_number,
      invoiceUuid,
      data.agreement_id || null,
      data.invoice_date,
      data.due_date || null,
      data.from_type,
      data.from_company_name || null,
      data.from_company_tax_id || null,
      data.from_company_address || null,
      data.from_director_name || null,
      data.from_director_country || null,
      data.from_director_passport || null,
      data.from_individual_name || null,
      data.from_individual_country || null,
      data.from_individual_passport || null,
      data.to_type,
      data.to_company_name || null,
      data.to_company_tax_id || null,
      data.to_company_address || null,
      data.to_director_name || null,
      data.to_director_country || null,
      data.to_director_passport || null,
      data.to_individual_name || null,
      data.to_individual_country || null,
      data.to_individual_passport || null,
      subtotal,
      tax_amount,
      total_amount,
      'THB',
      bankDetails.bank_details_type,
      bankDetails.bank_name || null,
      bankDetails.bank_account_name || null,
      bankDetails.bank_account_number || null,
      bankDetails.bank_account_address || null,
      bankDetails.bank_currency || null,
      bankDetails.bank_code || null,
      bankDetails.bank_swift_code || null,
      bankDetails.bank_address || null,
      bankDetails.bank_custom_details || null,
      data.notes || null,
      'draft',
      userId,
      showQrCode  // ✅ ДОБАВЛЕНО
    ]);

    const invoiceId = (result as any)[0].insertId;

    // ✅ СОЗДАЕМ ПОЗИЦИИ ИНВОЙСА С is_currently_selected
    const selectedItemsSet = new Set(data.selected_items || []);
    
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      await connection.query(`
        INSERT INTO invoice_items (
          invoice_id, description, quantity, unit_price, total_price, 
          due_date, is_currently_selected, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId, 
        item.description, 
        item.quantity, 
        item.unit_price, 
        item.total_price,
        item.due_date || null,
        selectedItemsSet.size > 0 ? (selectedItemsSet.has(i) ? 1 : 0) : 1,
        i
      ]);
      
      if (selectedItemsSet.size === 0 || selectedItemsSet.has(i)) {
        logger.info(`Item ${i} marked as currently selected in invoice ${invoiceId}`);
      }
    }

    // ✅ СОХРАНЕНИЕ РЕКВИЗИТОВ ЕСЛИ НУЖНО
    if (data.save_bank_details && data.bank_details_name) {
      try {
        await connection.query(`
          INSERT INTO saved_bank_details (
            name, bank_details_type,
            bank_name, bank_account_name, bank_account_number,
            bank_account_address, bank_currency, bank_code, bank_swift_code,
            bank_address,
            bank_custom_details,
            created_by, partner_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          data.bank_details_name,
          bankDetails.bank_details_type,
          bankDetails.bank_name || null,
          bankDetails.bank_account_name || null,
          bankDetails.bank_account_number || null,
          bankDetails.bank_account_address || null,
          bankDetails.bank_currency || null,
          bankDetails.bank_code || null,
          bankDetails.bank_swift_code || null,
          bankDetails.bank_address || null,
          bankDetails.bank_custom_details || null,
          userId,
          userPartnerId || null
        ]);
        logger.info(`Bank details saved: ${data.bank_details_name}`);
      } catch (saveError) {
        logger.error('Error saving bank details:', saveError);
      }
    }

    // ✅ ГЕНЕРИРУЕМ QR-КОД С ДОМЕНОМ ПАРТНЁРА
    try {
      const verifyUrl = `https://${baseDomain}/invoice/${invoiceUuid}`;
      console.log(`📱 Generating QR code for: ${verifyUrl}`);
      const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
        width: 300,
        margin: 1
      });
      await connection.query(
        'UPDATE invoices SET qr_code_base64 = ? WHERE id = ?',
        [qrCodeBase64, invoiceId]
      );
      logger.info(`QR code generated for invoice ${invoiceId} with domain ${baseDomain}`);
    } catch (qrError) {
      logger.error('QR code generation failed:', qrError);
    }

    await db.commit(connection);

    // ✅ Генерируем PDF сразу после создания с выбранными позициями
    try {
      const selectedItemsIds = await db.query(
        'SELECT id FROM invoice_items WHERE invoice_id = ? AND is_currently_selected = 1',
        [invoiceId]
      );
      const selectedIds = (selectedItemsIds as any[]).map(item => item.id);
      await this.generateInvoicePDF(invoiceId, selectedIds.length > 0 ? selectedIds : undefined);
    } catch (pdfError) {
      logger.error('PDF generation failed:', pdfError);
    }

    logger.info(`Invoice created: ${invoice_number} (ID: ${invoiceId}) by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Инвойс успешно создан',
      data: {
        id: invoiceId,
        invoice_number
      }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания инвойса'
    });
  }
}

/**
   * Обновить инвойс
   * PUT /api/financial-documents/invoices/:id
   */
  async updateInvoice(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const userId = req.admin!.id;
      const userPartnerId = req.admin?.partner_id;
      const data: Partial<CreateInvoiceDTO> = req.body;

      const invoice = await db.queryOne('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!invoice) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      // ✅ ЗАГРУЗКА СОХРАНЕННЫХ РЕКВИЗИТОВ
      let bankDetails: any = {};
      if (data.saved_bank_details_id) {
        const saved = await db.queryOne(
          'SELECT * FROM saved_bank_details WHERE id = ?',
          [data.saved_bank_details_id]
        );
        if (saved) {
          bankDetails = {
            bank_details_type: (saved as any).bank_details_type,
            bank_name: (saved as any).bank_name,
            bank_account_name: (saved as any).bank_account_name,
            bank_account_number: (saved as any).bank_account_number,
            bank_account_address: (saved as any).bank_account_address,
            bank_currency: (saved as any).bank_currency,
            bank_code: (saved as any).bank_code,
            bank_swift_code: (saved as any).bank_swift_code,
            bank_custom_details: (saved as any).bank_custom_details
          };
        }
      }

      // Обновляем инвойс
      const fields: string[] = [];
      const values: any[] = [];

      if (data.invoice_date !== undefined) {
        fields.push('invoice_date = ?');
        values.push(data.invoice_date);
      }
      if (data.due_date !== undefined) {
        fields.push('due_date = ?');
        values.push(data.due_date || null);
      }
      if (data.from_type !== undefined) {
        fields.push('from_type = ?');
        values.push(data.from_type);
      }
      if (data.from_company_name !== undefined) {
        fields.push('from_company_name = ?');
        values.push(data.from_company_name || null);
      }
      if (data.from_company_tax_id !== undefined) {
        fields.push('from_company_tax_id = ?');
        values.push(data.from_company_tax_id || null);
      }
      if (data.from_company_address !== undefined) {
        fields.push('from_company_address = ?');
        values.push(data.from_company_address || null);
      }
      if (data.from_director_name !== undefined) {
        fields.push('from_director_name = ?');
        values.push(data.from_director_name || null);
      }
      if (data.from_director_country !== undefined) {
        fields.push('from_director_country = ?');
        values.push(data.from_director_country || null);
      }
      if (data.from_director_passport !== undefined) {
        fields.push('from_director_passport = ?');
        values.push(data.from_director_passport || null);
      }
      if (data.from_individual_name !== undefined) {
        fields.push('from_individual_name = ?');
        values.push(data.from_individual_name || null);
      }
      if (data.from_individual_country !== undefined) {
        fields.push('from_individual_country = ?');
        values.push(data.from_individual_country || null);
      }
      if (data.from_individual_passport !== undefined) {
        fields.push('from_individual_passport = ?');
        values.push(data.from_individual_passport || null);
      }
      if (data.to_type !== undefined) {
        fields.push('to_type = ?');
        values.push(data.to_type);
      }
      if (data.to_company_name !== undefined) {
        fields.push('to_company_name = ?');
        values.push(data.to_company_name || null);
      }
      if (data.to_company_tax_id !== undefined) {
        fields.push('to_company_tax_id = ?');
        values.push(data.to_company_tax_id || null);
      }
      if (data.to_company_address !== undefined) {
        fields.push('to_company_address = ?');
        values.push(data.to_company_address || null);
      }
      if (data.to_director_name !== undefined) {
        fields.push('to_director_name = ?');
        values.push(data.to_director_name || null);
      }
      if (data.to_director_country !== undefined) {
        fields.push('to_director_country = ?');
        values.push(data.to_director_country || null);
      }
      if (data.to_director_passport !== undefined) {
        fields.push('to_director_passport = ?');
        values.push(data.to_director_passport || null);
      }
      if (data.to_individual_name !== undefined) {
        fields.push('to_individual_name = ?');
        values.push(data.to_individual_name || null);
      }
      if (data.to_individual_country !== undefined) {
        fields.push('to_individual_country = ?');
        values.push(data.to_individual_country || null);
      }
      if (data.to_individual_passport !== undefined) {
        fields.push('to_individual_passport = ?');
        values.push(data.to_individual_passport || null);
      }

// ✅ ОБНОВЛЕНИЕ БАНКОВСКИХ РЕКВИЗИТОВ
if (data.saved_bank_details_id && Object.keys(bankDetails).length > 0) {
  if (bankDetails.bank_details_type !== undefined) {
    fields.push('bank_details_type = ?');
    values.push(bankDetails.bank_details_type);
  }
  if (bankDetails.bank_name !== undefined) {
    fields.push('bank_name = ?');
    values.push(bankDetails.bank_name || null);
  }
  if (bankDetails.bank_account_name !== undefined) {
    fields.push('bank_account_name = ?');
    values.push(bankDetails.bank_account_name || null);
  }
  if (bankDetails.bank_account_number !== undefined) {
    fields.push('bank_account_number = ?');
    values.push(bankDetails.bank_account_number || null);
  }
  if (bankDetails.bank_account_address !== undefined) {
    fields.push('bank_account_address = ?');
    values.push(bankDetails.bank_account_address || null);
  }
  if (bankDetails.bank_currency !== undefined) {
    fields.push('bank_currency = ?');
    values.push(bankDetails.bank_currency || null);
  }
  if (bankDetails.bank_code !== undefined) {
    fields.push('bank_code = ?');
    values.push(bankDetails.bank_code || null);
  }
  if (bankDetails.bank_swift_code !== undefined) {
    fields.push('bank_swift_code = ?');
    values.push(bankDetails.bank_swift_code || null);
  }
  if (bankDetails.bank_address !== undefined) {
    fields.push('bank_address = ?');
    values.push(bankDetails.bank_address || null);
  }
  if (bankDetails.bank_custom_details !== undefined) {
    fields.push('bank_custom_details = ?');
    values.push(bankDetails.bank_custom_details || null);
  }
} else {
  if (data.bank_details_type !== undefined) {
    fields.push('bank_details_type = ?');
    values.push(data.bank_details_type || 'simple');
  }
  if (data.bank_name !== undefined) {
    fields.push('bank_name = ?');
    values.push(data.bank_name || null);
  }
  if (data.bank_account_name !== undefined) {
    fields.push('bank_account_name = ?');
    values.push(data.bank_account_name || null);
  }
  if (data.bank_account_number !== undefined) {
    fields.push('bank_account_number = ?');
    values.push(data.bank_account_number || null);
  }
  if (data.bank_account_address !== undefined) {
    fields.push('bank_account_address = ?');
    values.push(data.bank_account_address || null);
  }
  if (data.bank_currency !== undefined) {
    fields.push('bank_currency = ?');
    values.push(data.bank_currency || null);
  }
  if (data.bank_code !== undefined) {
    fields.push('bank_code = ?');
    values.push(data.bank_code || null);
  }
  if (data.bank_swift_code !== undefined) {
    fields.push('bank_swift_code = ?');
    values.push(data.bank_swift_code || null);
  }
  if (data.bank_address !== undefined) {
    fields.push('bank_address = ?');
    values.push(data.bank_address || null);
  }
  if (data.bank_custom_details !== undefined) {
    fields.push('bank_custom_details = ?');
    values.push(data.bank_custom_details || null);
  }
}

      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes || null);
      }
      if (data.show_qr_code !== undefined) {
        fields.push('show_qr_code = ?');
        values.push(data.show_qr_code);
      }

      // Если переданы items - обновляем их
      if (data.items && data.items.length > 0) {
        // Удаляем старые позиции
        await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

        // Вычисляем новые суммы
        let subtotal = 0;
        data.items.forEach(item => {
          item.total_price = item.quantity * item.unit_price;
          subtotal += item.total_price;
        });

        const tax_amount = data.tax_amount || 0;
        const total_amount = subtotal + tax_amount;

        fields.push('subtotal = ?', 'tax_amount = ?', 'total_amount = ?');
        values.push(subtotal, tax_amount, total_amount);

        // ✅ СОЗДАЕМ НОВЫЕ ПОЗИЦИИ С is_currently_selected
        const selectedItemsSet = new Set(data.selected_items || []);
        
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await connection.query(`
            INSERT INTO invoice_items (
              invoice_id, description, quantity, unit_price, total_price, 
              due_date, is_currently_selected, sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, 
            item.description, 
            item.quantity, 
            item.unit_price, 
            item.total_price,
            item.due_date || null,
            selectedItemsSet.size > 0 ? (selectedItemsSet.has(i) ? 1 : 0) : 1, // Если selected_items пустой - все выбраны
            i
          ]);
        }

        // Регенерируем PDF после обновления позиций
        fields.push('pdf_path = ?', 'pdf_generated_at = ?');
        values.push(null, null);
      } else if (data.selected_items !== undefined) {
        // ✅ ОБНОВЛЕНИЕ ТОЛЬКО ВЫБОРА ПОЗИЦИЙ (без изменения самих позиций)
        // Сначала сбрасываем все is_currently_selected
        await connection.query(
          'UPDATE invoice_items SET is_currently_selected = 0 WHERE invoice_id = ?',
          [id]
        );

        // Затем устанавливаем выбранные
        if (data.selected_items.length > 0) {
          // Получаем все позиции инвойса
          const allItems = await connection.query(
            'SELECT id FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
            [id]
          );
          
          // Преобразуем индексы в ID
          const selectedIds: number[] = [];
          data.selected_items.forEach((index: number) => {
            if (allItems[index]) {
              selectedIds.push((allItems[index] as any).id);
            }
          });

          if (selectedIds.length > 0) {
            const placeholders = selectedIds.map(() => '?').join(',');
            await connection.query(
              `UPDATE invoice_items SET is_currently_selected = 1 WHERE id IN (${placeholders})`,
              selectedIds
            );
          }
        }

        // Регенерируем PDF
        fields.push('pdf_path = ?', 'pdf_generated_at = ?');
        values.push(null, null);
      }

// ✅ СОХРАНЕНИЕ РЕКВИЗИТОВ ЕСЛИ НУЖНО
if (data.save_bank_details && data.bank_details_name) {
  try {
    const saveBankDetails = data.saved_bank_details_id ? bankDetails : {
      bank_details_type: data.bank_details_type || 'simple',
      bank_name: data.bank_name,
      bank_account_name: data.bank_account_name,
      bank_account_number: data.bank_account_number,
      bank_account_address: data.bank_account_address,
      bank_currency: data.bank_currency,
      bank_code: data.bank_code,
      bank_swift_code: data.bank_swift_code,
      bank_address: data.bank_address,
      bank_custom_details: data.bank_custom_details
    };

    await connection.query(`
      INSERT INTO saved_bank_details (
        name, bank_details_type,
        bank_name, bank_account_name, bank_account_number,
        bank_account_address, bank_currency, bank_code, bank_swift_code,
        bank_address,
        bank_custom_details,
        created_by, partner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.bank_details_name,
      saveBankDetails.bank_details_type,
      saveBankDetails.bank_name || null,
      saveBankDetails.bank_account_name || null,
      saveBankDetails.bank_account_number || null,
      saveBankDetails.bank_account_address || null,
      saveBankDetails.bank_currency || null,
      saveBankDetails.bank_code || null,
      saveBankDetails.bank_swift_code || null,
      saveBankDetails.bank_address || null,
      saveBankDetails.bank_custom_details || null,
      userId,
      userPartnerId || null
    ]);
    logger.info(`Bank details saved: ${data.bank_details_name}`);
  } catch (saveError) {
    logger.error('Error saving bank details:', saveError);
  }
}

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE invoices SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      await db.commit(connection);

      // ✅ Регенерируем PDF после обновления с выбранными позициями
      try {
        // Получаем ID выбранных позиций из базы
        const selectedItemsIds = await db.query(
          'SELECT id FROM invoice_items WHERE invoice_id = ? AND is_currently_selected = 1',
          [id]
        );
        const selectedIds = (selectedItemsIds as any[]).map(item => item.id);
        await this.generateInvoicePDF(parseInt(id), selectedIds.length > 0 ? selectedIds : undefined);
      } catch (pdfError) {
        logger.error('PDF regeneration failed after update:', pdfError);
      }

      logger.info(`Invoice updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Инвойс успешно обновлён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления инвойса'
      });
    }
  }

  /**
   * Удалить инвойс (мягкое удаление)
   * DELETE /api/financial-documents/invoices/:id
   */
  async deleteInvoice(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { delete_receipts } = req.query;

      const invoice = await connection.query(
        'SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', 
        [id]
      );

      if (!invoice || (invoice as any)[0].length === 0) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      // ✅ УДАЛЕНИЕ СВЯЗАННЫХ ЧЕКОВ ЕСЛИ УКАЗАНО
      if (delete_receipts === 'true') {
        await connection.query(
          'UPDATE receipts SET deleted_at = NOW() WHERE invoice_id = ?',
          [id]
        );
        logger.info(`Receipts deleted for invoice: ${id}`);
      }

      // Мягкое удаление инвойса
      await connection.query('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [id]);

      await db.commit(connection);

      logger.info(`Invoice deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Инвойс успешно удалён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Delete invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления инвойса'
      });
    }
  }

  // ==================== RECEIPTS ====================
  
  /**
   * Получить список всех чеков
   * GET /api/financial-documents/receipts
   */
  async getAllReceipts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, invoice_id, agreement_id, search, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = ['r.deleted_at IS NULL'];
      const queryParams: any[] = [];

      // ✅ ФИЛЬТРАЦИЯ ПО ПАРТНЁРУ
      const userPartnerId = req.admin?.partner_id;
      if (userPartnerId !== null && userPartnerId !== undefined) {
        whereConditions.push('au.partner_id = ?');
        queryParams.push(userPartnerId);
      }

      if (status) {
        whereConditions.push('r.status = ?');
        queryParams.push(status);
      }

      if (invoice_id) {
        whereConditions.push('r.invoice_id = ?');
        queryParams.push(invoice_id);
      }

      if (agreement_id) {
        whereConditions.push('r.agreement_id = ?');
        queryParams.push(agreement_id);
      }

      if (search) {
        whereConditions.push('(r.receipt_number LIKE ? OR r.notes LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Получаем общее количество
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM receipts r 
        LEFT JOIN admin_users au ON r.created_by = au.id
        ${whereClause}
      `;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем чеки
      const query = `
        SELECT 
          r.*,
          i.invoice_number,
          a.agreement_number,
          u.username as created_by_name,
          au.partner_id as creator_partner_id,
          (SELECT COUNT(*) FROM receipt_files WHERE receipt_id = r.id) as files_count
        FROM receipts r
        LEFT JOIN invoices i ON r.invoice_id = i.id
        LEFT JOIN agreements a ON r.agreement_id = a.id
        LEFT JOIN admin_users u ON r.created_by = u.id
        LEFT JOIN admin_users au ON r.created_by = au.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limitNum, offset);
      const receipts = await db.query(query, queryParams);

      res.json({
        success: true,
        data: receipts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get all receipts error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения чеков'
      });
    }
  }

/**
 * Получить чек по ID
 * GET /api/financial-documents/receipts/:id
 */
async getReceiptById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // ✅ ДОБАВЛЕНО: Получение цветов партнёра
    const receipt = await db.queryOne(`
      SELECT 
        r.*,
        i.invoice_number,
        i.agreement_id,
        a.agreement_number,
        p.logo_filename as partner_logo_filename,
        p.partner_name,
        p.primary_color as partner_primary_color,
        p.secondary_color as partner_secondary_color,
        p.accent_color as partner_accent_color,
        au.username as created_by_name,
        (SELECT COUNT(*) FROM receipt_files WHERE receipt_id = r.id) as files_count
      FROM receipts r
      LEFT JOIN invoices i ON r.invoice_id = i.id
      LEFT JOIN agreements a ON i.agreement_id = a.id
      LEFT JOIN admin_users au ON r.created_by = au.id
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE r.id = ? AND r.deleted_at IS NULL
    `, [id]);

    if (!receipt) {
      res.status(404).json({
        success: false,
        message: 'Чек не найден'
      });
      return;
    }

    // ✅ ДОБАВЛЯЕМ LOGO URL
    (receipt as any).logoUrl = (receipt as any).partner_logo_filename 
      ? `https://admin.novaestate.company/${(receipt as any).partner_logo_filename}`
      : 'https://admin.novaestate.company/nova-logo.svg';

    // ✅ ДОБАВЛЯЕМ ЦВЕТА ПАРТНЁРА (с дефолтными значениями)
    (receipt as any).primaryColor = (receipt as any).partner_primary_color || '#1b273b';
    (receipt as any).secondaryColor = (receipt as any).partner_secondary_color || '#5d666e';
    (receipt as any).accentColor = (receipt as any).partner_accent_color || '#1b273b';

    // Получаем оплаченные позиции
    const items = await db.query(`
      SELECT 
        rii.*,
        ii.description,
        ii.quantity,
        ii.unit_price,
        ii.total_price
      FROM receipt_invoice_items rii
      LEFT JOIN invoice_items ii ON rii.invoice_item_id = ii.id
      WHERE rii.receipt_id = ?
    `, [id]);

    // Получаем файлы
    const files = await db.query(
      'SELECT * FROM receipt_files WHERE receipt_id = ? ORDER BY uploaded_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...receipt,
        items: items,
        files: files
      }
    });

  } catch (error) {
    logger.error('Get receipt by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения чека'
    });
  }
}

/**
 * Создать чек
 * POST /api/financial-documents/receipts
 */
async createReceipt(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const userId = req.admin!.id;
    const userPartnerId = req.admin?.partner_id;
    const data: CreateReceiptDTO = req.body;

    // ✅ ИЗВЛЕКАЕМ show_qr_code (по умолчанию 1 - показывать)
    const showQrCode = data.show_qr_code !== undefined ? data.show_qr_code : 1;

    // Проверяем существование инвойса
    const invoice = await connection.query(
      'SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL',
      [data.invoice_id]
    );

    if (!invoice || (invoice as any).length === 0) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Инвойс не найден'
      });
      return;
    }

    // ✅ ЗАГРУЗКА СОХРАНЕННЫХ РЕКВИЗИТОВ
    let bankDetails: any = {};
    if (data.saved_bank_details_id) {
      const saved = await db.queryOne(
        'SELECT * FROM saved_bank_details WHERE id = ?',
        [data.saved_bank_details_id]
      );
      if (saved) {
        bankDetails = {
          bank_details_type: (saved as any).bank_details_type,
          bank_name: (saved as any).bank_name,
          bank_account_name: (saved as any).bank_account_name,
          bank_account_number: (saved as any).bank_account_number,
          bank_account_address: (saved as any).bank_account_address,
          bank_currency: (saved as any).bank_currency,
          bank_code: (saved as any).bank_code,
          bank_swift_code: (saved as any).bank_swift_code,
          bank_address: (saved as any).bank_address,
          bank_custom_details: (saved as any).bank_custom_details
        };
      }
    } else {
      bankDetails = {
        bank_details_type: data.bank_details_type || 'simple',
        bank_name: data.bank_name,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
        bank_account_address: data.bank_account_address,
        bank_currency: data.bank_currency,
        bank_code: data.bank_code,
        bank_swift_code: data.bank_swift_code,
        bank_address: data.bank_address,
        bank_custom_details: data.bank_custom_details
      };
    }

    // ✅ ПОЛУЧАЕМ ДОМЕН ПАРТНЁРА СОЗДАТЕЛЯ ИНВОЙСА
    const creatorPartner = await db.queryOne<any>(`
      SELECT p.domain
      FROM invoices inv
      LEFT JOIN admin_users au ON inv.created_by = au.id
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE inv.id = ?
    `, [data.invoice_id]);

    const baseDomain = creatorPartner?.domain 
      ? `agreement.${creatorPartner.domain}` 
      : 'documents.novaestate.company';
    console.log(`🌐 Using domain for receipt: ${baseDomain}`);

    // Генерируем уникальный номер REC-2025-ABC0001
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    const { v4: uuidv4 } = require('uuid');
    const receiptUuid = uuidv4();
    const countResult = await connection.query(
      'SELECT COUNT(*) as count FROM receipts WHERE receipt_number LIKE ?',
      [`REC-${year}-%`]
    );
    const count = (countResult[0] as any)[0].count + 1;
    const receipt_number = `REC-${year}-${randomPart}${count.toString().padStart(4, '0')}`;

    // ✅ ДОБАВЛЕНО show_qr_code в INSERT (21 поле, 21 значение)
    const result = await connection.query(`
      INSERT INTO receipts (
        receipt_number, uuid, invoice_id, agreement_id, receipt_date,
        amount_paid, payment_method,
        bank_details_type, bank_name, bank_account_name, bank_account_number,
        bank_account_address, bank_currency, bank_code, bank_swift_code, 
        bank_address, bank_custom_details,
        notes, status, created_by, show_qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receipt_number,
      receiptUuid,
      data.invoice_id,
      data.agreement_id || null,
      data.receipt_date,
      data.amount_paid,
      data.payment_method,
      bankDetails.bank_details_type,
      bankDetails.bank_name || null,
      bankDetails.bank_account_name || null,
      bankDetails.bank_account_number || null,
      bankDetails.bank_account_address || null,
      bankDetails.bank_currency || null,
      bankDetails.bank_code || null,
      bankDetails.bank_swift_code || null,
      bankDetails.bank_address || null,
      bankDetails.bank_custom_details || null,
      data.notes || null,
      'verified',
      userId,
      showQrCode  // ✅ ДОБАВЛЕНО
    ]);

    const receiptId = (result as any)[0].insertId;

    // Сохраняем привязку к позициям инвойса и обновляем их статус оплаты
    if (data.selected_items && data.selected_items.length > 0) {
      for (const itemId of data.selected_items) {
        await connection.query(`
          INSERT INTO receipt_invoice_items (receipt_id, invoice_item_id, amount_allocated)
          VALUES (?, ?, ?)
        `, [receiptId, itemId, 0]);

        // ✅ ОБНОВЛЯЕМ СТАТУС ОПЛАТЫ ПОЗИЦИИ
        await connection.query(`
          UPDATE invoice_items
          SET is_fully_paid = 1,
              amount_paid = total_price
          WHERE id = ?
        `, [itemId]);
      }
    }

    // Обновляем amount_paid в инвойсе
    await connection.query(`
      UPDATE invoices 
      SET amount_paid = amount_paid + ?,
          status = CASE
            WHEN (amount_paid + ?) >= total_amount THEN 'paid'
            WHEN (amount_paid + ?) > 0 THEN 'partially_paid'
            ELSE status
          END
      WHERE id = ?
    `, [data.amount_paid, data.amount_paid, data.amount_paid, data.invoice_id]);

    // ✅ СОХРАНЕНИЕ РЕКВИЗИТОВ ЕСЛИ НУЖНО
    if (data.save_bank_details && data.bank_details_name) {
      try {
        await connection.query(`
          INSERT INTO saved_bank_details (
            name, bank_details_type,
            bank_name, bank_account_name, bank_account_number,
            bank_account_address, bank_currency, bank_code, bank_swift_code,
            bank_address,
            bank_custom_details,
            created_by, partner_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          data.bank_details_name,
          bankDetails.bank_details_type,
          bankDetails.bank_name || null,
          bankDetails.bank_account_name || null,
          bankDetails.bank_account_number || null,
          bankDetails.bank_account_address || null,
          bankDetails.bank_currency || null,
          bankDetails.bank_code || null,
          bankDetails.bank_swift_code || null,
          bankDetails.bank_address || null,
          bankDetails.bank_custom_details || null,
          userId,
          userPartnerId || null
        ]);
        logger.info(`Bank details saved: ${data.bank_details_name}`);
      } catch (saveError) {
        logger.error('Error saving bank details:', saveError);
      }
    }

    // ✅ ГЕНЕРИРУЕМ QR-КОД С ДОМЕНОМ ПАРТНЁРА
    try {
      const verifyUrl = `https://${baseDomain}/receipt/${receiptUuid}`;
      console.log(`📱 Generating QR code for: ${verifyUrl}`);
      const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
        width: 300,
        margin: 1
      });
      await connection.query(
        'UPDATE receipts SET qr_code_base64 = ? WHERE id = ?',
        [qrCodeBase64, receiptId]
      );
      logger.info(`QR code generated for receipt ${receiptId} with domain ${baseDomain}`);
    } catch (qrError) {
      logger.error('QR code generation failed:', qrError);
    }

    await db.commit(connection);

    // Генерируем PDF сразу после создания
    try {
      await this.generateReceiptPDF(receiptId);
    } catch (pdfError) {
      logger.error('PDF generation failed:', pdfError);
    }

    logger.info(`Receipt created: ${receipt_number} (ID: ${receiptId}) by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Чек успешно создан',
      data: {
        id: receiptId,
        receipt_number
      }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Create receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания чека'
    });
  }
}

  /**
   * Загрузить файлы чека
   * POST /api/financial-documents/receipts/:id/upload-files
   */
  async uploadReceiptFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const uploadedFiles = (req as any).files || [];

      const receipt = await db.queryOne('SELECT * FROM receipts WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!receipt) {
        res.status(404).json({
          success: false,
          message: 'Чек не найден'
        });
        return;
      }

      const fs = require('fs-extra');
      const path = require('path');
      const { v4: uuidv4 } = require('uuid');

      let uploadedCount = 0;

      for (const file of uploadedFiles) {
        try {
          const ext = file.mimetype.split('/')[1] || 'jpg';
          const filename = `${uuidv4()}.${ext}`;
          const uploadDir = path.join(__dirname, '../../uploads/receipt-files');
          await fs.ensureDir(uploadDir);

          const filepath = path.join(uploadDir, filename);
          await fs.writeFile(filepath, file.buffer);

          const filePath = `/uploads/receipt-files/${filename}`;

          // Сохраняем в БД
          await db.query(`
            INSERT INTO receipt_files (receipt_id, file_path, file_name, file_size, mime_type)
            VALUES (?, ?, ?, ?, ?)
          `, [id, filePath, file.originalname, file.size, file.mimetype]);

          uploadedCount++;
          logger.info(`Receipt file saved: ${filePath}`);
        } catch (err) {
          logger.error('Error saving receipt file:', err);
        }
      }

      // Регенерируем PDF после загрузки файлов
      try {
        await this.generateReceiptPDF(parseInt(id));
        logger.info(`Receipt PDF regenerated after file upload: ${id}`);
      } catch (pdfError) {
        logger.error('PDF regeneration failed after file upload:', pdfError);
      }

      res.json({
        success: true,
        message: `Загружено файлов: ${uploadedCount}`,
        uploadedCount
      });
    } catch (error) {
      logger.error('Upload receipt files error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка загрузки файлов'
      });
    }
  }

  /**
   * Обновить чек
   * PUT /api/financial-documents/receipts/:id
   */
  async updateReceipt(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const userId = req.admin!.id;
      const userPartnerId = req.admin?.partner_id;
      const data: Partial<CreateReceiptDTO> = req.body;

      const receipt: any = await connection.query(
        'SELECT * FROM receipts WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!receipt || receipt[0].length === 0) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Чек не найден'
        });
        return;
      }

      const receiptData = receipt[0][0];
      const oldAmount = receiptData.amount_paid;
      const oldInvoiceId = receiptData.invoice_id;

      // ✅ ЗАГРУЗКА СОХРАНЕННЫХ РЕКВИЗИТОВ
      let bankDetails: any = {};
      if (data.saved_bank_details_id) {
        const saved = await db.queryOne(
          'SELECT * FROM saved_bank_details WHERE id = ?',
          [data.saved_bank_details_id]
        );
        if (saved) {
          bankDetails = {
            bank_details_type: (saved as any).bank_details_type,
            bank_name: (saved as any).bank_name,
            bank_account_name: (saved as any).bank_account_name,
            bank_account_number: (saved as any).bank_account_number,
            bank_account_address: (saved as any).bank_account_address,
            bank_currency: (saved as any).bank_currency,
            bank_code: (saved as any).bank_code,
            bank_swift_code: (saved as any).bank_swift_code,
            bank_custom_details: (saved as any).bank_custom_details
          };
        }
      }

      // Обновляем чек
      const fields: string[] = [];
      const values: any[] = [];

      if (data.receipt_date !== undefined) {
        fields.push('receipt_date = ?');
        values.push(data.receipt_date);
      }
      if (data.amount_paid !== undefined) {
        fields.push('amount_paid = ?');
        values.push(data.amount_paid);
      }
      if (data.payment_method !== undefined) {
        fields.push('payment_method = ?');
        values.push(data.payment_method);
      }
      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes || null);
      }
      if (data.invoice_id !== undefined) {
        fields.push('invoice_id = ?');
        values.push(data.invoice_id);
      }
      if (data.agreement_id !== undefined) {
        fields.push('agreement_id = ?');
        values.push(data.agreement_id || null);
      }

      // ✅ ОБНОВЛЕНИЕ БАНКОВСКИХ РЕКВИЗИТОВ
      if (data.saved_bank_details_id && Object.keys(bankDetails).length > 0) {
        if (bankDetails.bank_details_type !== undefined) {
          fields.push('bank_details_type = ?');
          values.push(bankDetails.bank_details_type);
        }
        if (bankDetails.bank_name !== undefined) {
          fields.push('bank_name = ?');
          values.push(bankDetails.bank_name || null);
        }
        if (bankDetails.bank_account_name !== undefined) {
          fields.push('bank_account_name = ?');
          values.push(bankDetails.bank_account_name || null);
        }
        if (bankDetails.bank_account_number !== undefined) {
          fields.push('bank_account_number = ?');
          values.push(bankDetails.bank_account_number || null);
        }
        if (bankDetails.bank_account_address !== undefined) {
          fields.push('bank_account_address = ?');
          values.push(bankDetails.bank_account_address || null);
        }
        if (bankDetails.bank_currency !== undefined) {
          fields.push('bank_currency = ?');
          values.push(bankDetails.bank_currency || null);
        }
        if (bankDetails.bank_code !== undefined) {
          fields.push('bank_code = ?');
          values.push(bankDetails.bank_code || null);
        }
        if (bankDetails.bank_swift_code !== undefined) {
          fields.push('bank_swift_code = ?');
          values.push(bankDetails.bank_swift_code || null);
        }
        if (bankDetails.bank_custom_details !== undefined) {
          fields.push('bank_custom_details = ?');
          values.push(bankDetails.bank_custom_details || null);
        }
      } else {
        if (data.bank_details_type !== undefined) {
          fields.push('bank_details_type = ?');
          values.push(data.bank_details_type || 'simple');
        }
        if (data.bank_name !== undefined) {
          fields.push('bank_name = ?');
          values.push(data.bank_name || null);
        }
        if (data.bank_account_name !== undefined) {
          fields.push('bank_account_name = ?');
          values.push(data.bank_account_name || null);
        }
        if (data.bank_account_number !== undefined) {
          fields.push('bank_account_number = ?');
          values.push(data.bank_account_number || null);
        }
        if (data.bank_account_address !== undefined) {
          fields.push('bank_account_address = ?');
          values.push(data.bank_account_address || null);
        }
        if (data.show_qr_code !== undefined) {
          fields.push('show_qr_code = ?');
          values.push(data.show_qr_code);
        }
        if (data.bank_currency !== undefined) {
          fields.push('bank_currency = ?');
          values.push(data.bank_currency || null);
        }
        if (data.bank_code !== undefined) {
          fields.push('bank_code = ?');
          values.push(data.bank_code || null);
        }
        if (data.bank_swift_code !== undefined) {
          fields.push('bank_swift_code = ?');
          values.push(data.bank_swift_code || null);
        }
        if (data.bank_custom_details !== undefined) {
          fields.push('bank_custom_details = ?');
          values.push(data.bank_custom_details || null);
        }
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE receipts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      // Обновляем привязки к позициям инвойса если переданы
      if (data.selected_items) {
        // Сбрасываем статус старых позиций
        const oldItems = await connection.query(
          'SELECT invoice_item_id FROM receipt_invoice_items WHERE receipt_id = ?',
          [id]
        );
        for (const oldItem of oldItems as any[]) {
          await connection.query(`
            UPDATE invoice_items
            SET is_fully_paid = 0,
                amount_paid = 0
            WHERE id = ?
          `, [oldItem.invoice_item_id]);
        }

        // Удаляем старые привязки
        await connection.query('DELETE FROM receipt_invoice_items WHERE receipt_id = ?', [id]);
        
        // Создаем новые привязки
        for (const itemId of data.selected_items) {
          await connection.query(`
            INSERT INTO receipt_invoice_items (receipt_id, invoice_item_id, amount_allocated)
            VALUES (?, ?, ?)
          `, [id, itemId, 0]);

          // ✅ ОБНОВЛЯЕМ СТАТУС ОПЛАТЫ ПОЗИЦИИ
          await connection.query(`
            UPDATE invoice_items
            SET is_fully_paid = 1,
                amount_paid = total_price
            WHERE id = ?
          `, [itemId]);
        }
      }

      // Обновляем amount_paid в старом инвойсе (вычитаем старую сумму)
      if (oldInvoiceId) {
        await connection.query(`
          UPDATE invoices 
          SET amount_paid = GREATEST(amount_paid - ?, 0),
              status = CASE
                WHEN (amount_paid - ?) <= 0 THEN 'sent'
                WHEN (amount_paid - ?) >= total_amount THEN 'paid'
                ELSE 'partially_paid'
              END
          WHERE id = ?
        `, [oldAmount, oldAmount, oldAmount, oldInvoiceId]);
      }

      // Обновляем amount_paid в новом инвойсе (добавляем новую сумму)
      const newInvoiceId = data.invoice_id || oldInvoiceId;
      const newAmount = data.amount_paid || oldAmount;

      if (newInvoiceId) {
        await connection.query(`
          UPDATE invoices 
          SET amount_paid = amount_paid + ?,
              status = CASE
                WHEN (amount_paid + ?) >= total_amount THEN 'paid'
                WHEN (amount_paid + ?) > 0 THEN 'partially_paid'
                ELSE status
              END
          WHERE id = ?
        `, [newAmount, newAmount, newAmount, newInvoiceId]);
      }

// ✅ СОХРАНЕНИЕ РЕКВИЗИТОВ ЕСЛИ НУЖНО
if (data.save_bank_details && data.bank_details_name) {
  try {
    const saveBankDetails = data.saved_bank_details_id ? bankDetails : {
      bank_details_type: data.bank_details_type || 'simple',
      bank_name: data.bank_name,
      bank_account_name: data.bank_account_name,
      bank_account_number: data.bank_account_number,
      bank_account_address: data.bank_account_address,
      bank_currency: data.bank_currency,
      bank_code: data.bank_code,
      bank_swift_code: data.bank_swift_code,
      bank_address: data.bank_address,
      bank_custom_details: data.bank_custom_details
    };

    await connection.query(`
      INSERT INTO saved_bank_details (
        name, bank_details_type,
        bank_name, bank_account_name, bank_account_number,
        bank_account_address, bank_currency, bank_code, bank_swift_code,
        bank_address,
        bank_custom_details,
        created_by, partner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.bank_details_name,
      saveBankDetails.bank_details_type,
      saveBankDetails.bank_name || null,
      saveBankDetails.bank_account_name || null,
      saveBankDetails.bank_account_number || null,
      saveBankDetails.bank_account_address || null,
      saveBankDetails.bank_currency || null,
      saveBankDetails.bank_code || null,
      saveBankDetails.bank_swift_code || null,
      saveBankDetails.bank_address || null,
      saveBankDetails.bank_custom_details || null,
      userId,
      userPartnerId || null
    ]);
    logger.info(`Bank details saved: ${data.bank_details_name}`);
  } catch (saveError) {
    logger.error('Error saving bank details:', saveError);
  }
}

      // Сбрасываем PDF чтобы регенерировать
      await connection.query(
        'UPDATE receipts SET pdf_path = NULL, pdf_generated_at = NULL WHERE id = ?',
        [id]
      );

      await db.commit(connection);

      // Регенерируем PDF после обновления
      try {
        await this.generateReceiptPDF(parseInt(id));
      } catch (pdfError) {
        logger.error('PDF regeneration failed after update:', pdfError);
      }

      logger.info(`Receipt updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Чек успешно обновлён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update receipt error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления чека'
      });
    }
  }

  /**
   * Удалить чек (мягкое удаление)
   * DELETE /api/financial-documents/receipts/:id
   */
  async deleteReceipt(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;

      const receipt: any = await connection.query(
        'SELECT * FROM receipts WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!receipt || receipt[0].length === 0) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Чек не найден'
        });
        return;
      }

      const receiptData = receipt[0][0];

      // ✅ СБРАСЫВАЕМ СТАТУС ОПЛАТЫ ПОЗИЦИЙ
      const paidItems = await connection.query(
        'SELECT invoice_item_id FROM receipt_invoice_items WHERE receipt_id = ?',
        [id]
      );
      for (const item of paidItems as any[]) {
        await connection.query(`
          UPDATE invoice_items
          SET is_fully_paid = 0,
              amount_paid = 0
          WHERE id = ?
        `, [item.invoice_item_id]);
      }

      // Обновляем amount_paid в инвойсе (вычитаем сумму удаляемого чека)
      await connection.query(`
        UPDATE invoices 
        SET amount_paid = GREATEST(amount_paid - ?, 0),
            status = CASE
              WHEN (amount_paid - ?) <= 0 THEN 'sent'
              WHEN (amount_paid - ?) >= total_amount THEN 'paid'
              ELSE 'partially_paid'
            END
        WHERE id = ?
      `, [receiptData.amount_paid, receiptData.amount_paid, receiptData.amount_paid, receiptData.invoice_id]);

      // Мягкое удаление чека
      await connection.query('UPDATE receipts SET deleted_at = NOW() WHERE id = ?', [id]);

      await db.commit(connection);

      logger.info(`Receipt deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Чек успешно удалён'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Delete receipt error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления чека'
      });
    }
  }

  /**
   * Получить инвойсы по agreement_id (для выбора при создании чека)
   * GET /api/financial-documents/invoices-by-agreement/:agreementId
   */
  async getInvoicesByAgreement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { agreementId } = req.params;

      const invoices = await db.query(`
        SELECT 
          i.id,
          i.invoice_number,
          i.invoice_date,
          i.total_amount,
          i.amount_paid,
          i.status,
          (i.total_amount - i.amount_paid) as remaining_amount
        FROM invoices i
        WHERE i.agreement_id = ? AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC
      `, [agreementId]);

      res.json({
        success: true,
        data: invoices
      });
    } catch (error) {
      logger.error('Get invoices by agreement error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения инвойсов'
      });
    }
  }

  // ==================== PDF GENERATION & HTML ====================

/**
 * Получить HTML версию инвойса для генерации PDF
 * GET /api/financial-documents/invoices/:id/html
 */
async getInvoiceHTML(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { internalKey, selected_items } = req.query;

    // Проверяем внутренний ключ для Puppeteer
    const expectedKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    if (internalKey !== expectedKey) {
      res.status(403).send('Доступ запрещен');
      return;
    }

    // ✅ ПОЛУЧАЕМ ИНВОЙС С LOGO И ЦВЕТАМИ ПАРТНЁРА
    const invoice = await db.queryOne(`
      SELECT 
        i.*,
        p.logo_filename as partner_logo_filename,
        p.primary_color as partner_primary_color,
        p.secondary_color as partner_secondary_color,
        p.accent_color as partner_accent_color
      FROM invoices i
      LEFT JOIN admin_users au ON i.created_by = au.id
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE i.id = ? AND i.deleted_at IS NULL
    `, [id]);

    if (!invoice) {
      res.status(404).send('Invoice not found');
      return;
    }

    // ✅ ФОРМИРУЕМ LOGO URL
    const logoUrl = (invoice as any).partner_logo_filename 
      ? `https://admin.novaestate.company/${(invoice as any).partner_logo_filename}`
      : 'https://admin.novaestate.company/nova-logo.svg';

    // ✅ ФОРМИРУЕМ ЦВЕТА (с дефолтами)
    const primaryColor = (invoice as any).partner_primary_color || '#1b273b';
    const secondaryColor = (invoice as any).partner_secondary_color || '#5d666e';

    // Получаем позиции
    const items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
      [id]
    );

    // ✅ ПАРСИМ selected_items ЕСЛИ ЕСТЬ
    let selectedItemsArray: number[] = [];
    if (selected_items) {
      try {
        selectedItemsArray = JSON.parse(String(selected_items));
      } catch (e) {
        logger.error('Error parsing selected_items:', e);
      }
    }

    // Получаем данные договора если есть
    let agreementData = null;
    if ((invoice as any).agreement_id) {
      agreementData = await db.queryOne(`
        SELECT 
          a.agreement_number,
          COALESCE(
            a.property_name_override,
            pt_ru.property_name, 
            pt_en.property_name, 
            p.complex_name, 
            CONCAT('Объект ', p.property_number)
          ) as property_name,
          COALESCE(
            a.property_number_override,
            p.property_number
          ) as property_number,
          COALESCE(
            a.property_address_override,
            p.address
          ) as address
        FROM agreements a
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
        LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
        WHERE a.id = ?
      `, [(invoice as any).agreement_id]);
    }

    // ✅ ГЕНЕРИРУЕМ HTML С LOGO URL, ЦВЕТАМИ И selected_items
    const html = this.generateInvoiceHTML(invoice, items, agreementData, logoUrl, selectedItemsArray, primaryColor, secondaryColor);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    logger.error('Get invoice HTML error:', error);
    res.status(500).send('Error generating HTML');
  }
}

/**
 * Получить HTML версию чека для генерации PDF
 * GET /api/financial-documents/receipts/:id/html
 */
async getReceiptHTML(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { internalKey } = req.query;

    // Проверяем внутренний ключ для Puppeteer
    const expectedKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    if (internalKey !== expectedKey) {
      res.status(403).send('Доступ запрещен');
      return;
    }

    // ✅ ПОЛУЧАЕМ ЧЕК С LOGO И ЦВЕТАМИ ПАРТНЁРА
    const receipt = await db.queryOne(`
      SELECT 
        r.*,
        i.invoice_number,
        i.agreement_id,
        i.from_type,
        i.from_company_name,
        i.from_individual_name,
        i.to_type,
        i.to_company_name,
        i.to_individual_name,
        p.logo_filename as partner_logo_filename,
        p.primary_color as partner_primary_color,
        p.secondary_color as partner_secondary_color,
        p.accent_color as partner_accent_color
      FROM receipts r
      LEFT JOIN invoices i ON r.invoice_id = i.id
      LEFT JOIN admin_users au ON r.created_by = au.id
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE r.id = ? AND r.deleted_at IS NULL
    `, [id]);

    if (!receipt) {
      res.status(404).send('Receipt not found');
      return;
    }

    // ✅ ФОРМИРУЕМ LOGO URL
    const logoUrl = (receipt as any).partner_logo_filename 
      ? `https://admin.novaestate.company/${(receipt as any).partner_logo_filename}`
      : 'https://admin.novaestate.company/nova-logo.svg';

    // ✅ ФОРМИРУЕМ ЦВЕТА (с дефолтами)
    const primaryColor = (receipt as any).partner_primary_color || '#1b273b';
    const secondaryColor = (receipt as any).partner_secondary_color || '#5d666e';

    // Получаем оплаченные позиции
    const items = await db.query(`
      SELECT 
        rii.*,
        ii.description,
        ii.quantity,
        ii.unit_price,
        ii.total_price
      FROM receipt_invoice_items rii
      LEFT JOIN invoice_items ii ON rii.invoice_item_id = ii.id
      WHERE rii.receipt_id = ?
    `, [id]);

    // Получаем файлы чека
    const files = await db.query(
      'SELECT * FROM receipt_files WHERE receipt_id = ? ORDER BY uploaded_at',
      [id]
    );

    // Получаем данные договора если есть
    let agreementData = null;
    if ((receipt as any).agreement_id) {
      agreementData = await db.queryOne(`
        SELECT 
          a.agreement_number,
          COALESCE(
            a.property_name_override,
            pt_ru.property_name, 
            pt_en.property_name, 
            p.complex_name, 
            CONCAT('Объект ', p.property_number)
          ) as property_name,
          COALESCE(
            a.property_number_override,
            p.property_number
          ) as property_number,
          COALESCE(
            a.property_address_override,
            p.address
          ) as address
        FROM agreements a
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt_ru ON p.id = pt_ru.property_id AND pt_ru.language_code = 'ru'
        LEFT JOIN property_translations pt_en ON p.id = pt_en.property_id AND pt_en.language_code = 'en'
        WHERE a.id = ?
      `, [(receipt as any).agreement_id]);
    }

    // ✅ ГЕНЕРИРУЕМ HTML С LOGO URL И ЦВЕТАМИ
    const html = this.generateReceiptHTML(receipt, items, files, agreementData, logoUrl, primaryColor, secondaryColor);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    logger.error('Get receipt HTML error:', error);
    res.status(500).send('Error generating HTML');
  }
}

  /**
   * Скачать PDF инвойса
   * GET /api/financial-documents/invoices/:id/pdf
   */
  async downloadInvoicePDF(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { selected_items } = req.query;

      const invoice = await db.queryOne<any>(
        'SELECT pdf_path, invoice_number FROM invoices WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      // ✅ ГЕНЕРИРУЕМ PDF С selected_items
      let selectedItemsArray: number[] = [];
      if (selected_items) {
        try {
          selectedItemsArray = JSON.parse(String(selected_items));
        } catch (e) {
          logger.error('Error parsing selected_items:', e);
        }
      }

      // Генерируем PDF с выбранными позициями
      await this.generateInvoicePDF(parseInt(id), selectedItemsArray);
      
      const updatedInvoice = await db.queryOne<any>(
        'SELECT pdf_path FROM invoices WHERE id = ?',
        [id]
      );
      
      invoice.pdf_path = updatedInvoice.pdf_path;

      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', invoice.pdf_path.replace('/uploads/', ''));

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
      res.download(filePath, `${invoice.invoice_number}.pdf`, (err) => {
        if (err) {
          logger.error('Error downloading invoice PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Ошибка скачивания PDF'
            });
          }
        }
      });

    } catch (error) {
      logger.error('Download invoice PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка скачивания PDF'
      });
    }
  }

  /**
   * Скачать PDF чека
   * GET /api/financial-documents/receipts/:id/pdf
   */
  async downloadReceiptPDF(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const receipt = await db.queryOne<any>(
        'SELECT pdf_path, receipt_number FROM receipts WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!receipt) {
        res.status(404).json({
          success: false,
          message: 'Чек не найден'
        });
        return;
      }

      if (!receipt.pdf_path) {
        // Генерируем PDF если еще не сгенерирован
        await this.generateReceiptPDF(parseInt(id));
        
        const updatedReceipt = await db.queryOne<any>(
          'SELECT pdf_path FROM receipts WHERE id = ?',
          [id]
        );
        
        receipt.pdf_path = updatedReceipt.pdf_path;
      }

      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', receipt.pdf_path.replace('/uploads/', ''));

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
      res.download(filePath, `${receipt.receipt_number}.pdf`, (err) => {
        if (err) {
          logger.error('Error downloading receipt PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Ошибка скачивания PDF'
            });
          }
        }
      });

    } catch (error) {
      logger.error('Download receipt PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка скачивания PDF'
      });
    }
  }

  /**
   * Генерация PDF для инвойса
   */
  private async generateInvoicePDF(invoiceId: number, selectedItems?: number[]): Promise<void> {
    try {
      const PDFService = require('../services/pdf.service').PDFService;
      const pdfPath = await PDFService.generateInvoicePDF(invoiceId, selectedItems);
      
      await db.query(
        'UPDATE invoices SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?',
        [pdfPath, invoiceId]
      );
      
      logger.info(`Invoice PDF generated: ${pdfPath}`);
    } catch (error) {
      logger.error(`Error generating invoice PDF ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Генерация PDF для чека
   */
  private async generateReceiptPDF(receiptId: number): Promise<void> {
    try {
      const PDFService = require('../services/pdf.service').PDFService;
      const pdfPath = await PDFService.generateReceiptPDF(receiptId);
      
      await db.query(
        'UPDATE receipts SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?',
        [pdfPath, receiptId]
      );
      
      logger.info(`Receipt PDF generated: ${pdfPath}`);
    } catch (error) {
      logger.error(`Error generating receipt PDF ${receiptId}:`, error);
      throw error;
    }
  }

/**
 * Генерация HTML для инвойса
 */
private generateInvoiceHTML(
  invoice: any, 
  items: any[], 
  agreementData: any, 
  logoUrl?: string,
  selectedItems?: number[],
  _primaryColor?: string,
  secondaryColor?: string
): string {
  const finalLogoUrl = logoUrl || 'https://admin.novaestate.company/nova-logo.svg';
  
  // ✅ ТОЛЬКО ЭТИ ДВА ПАРАМЕТРА ДИНАМИЧЕСКИЕ:
  // 1. Цвет фона заголовка таблицы
  const headerBgColor = secondaryColor || '#5d666e';
  
  // 2. CSS filter для логотипа (убираем для партнёрских SVG)
  const hasPartnerLogo = logoUrl && !logoUrl.includes('nova-logo.svg');
  const logoFilter = hasPartnerLogo 
    ? 'none' 
    : 'brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1131%) hue-rotate(185deg) brightness(94%) contrast(91%)';
  
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  // ✅ РАСЧЕТ СУММЫ К ОПЛАТЕ (только выбранные позиции)
  let amountToPay = 0;
  if (selectedItems && selectedItems.length > 0) {
    items.forEach(item => {
      if (selectedItems.includes(item.id)) {
        const price = Number(item.total_price) || 0;
        amountToPay += price;
      }
    });
  } else {
    amountToPay = Number(invoice.total_amount) - Number(invoice.amount_paid);
  }

  // Формируем информацию о сторонах
  const fromInfo = invoice.from_type === 'company' 
    ? `<div><strong>${invoice.from_company_name}</strong></div>
       <div>Tax ID: ${invoice.from_company_tax_id}</div>
       ${invoice.from_company_address ? `<div>${invoice.from_company_address}</div>` : ''}
       ${invoice.from_director_name ? `<div>Director: ${invoice.from_director_name}</div>` : ''}`
    : `<div><strong>${invoice.from_individual_name}</strong></div>
       <div>${invoice.from_individual_country}</div>
       <div>Passport: ${invoice.from_individual_passport}</div>`;

  const toInfo = invoice.to_type === 'company'
    ? `<div><strong>${invoice.to_company_name}</strong></div>
       <div>Tax ID: ${invoice.to_company_tax_id}</div>
       ${invoice.to_company_address ? `<div>${invoice.to_company_address}</div>` : ''}
       ${invoice.to_director_name ? `<div>Director: ${invoice.to_director_name}</div>` : ''}`
    : `<div><strong>${invoice.to_individual_name}</strong></div>
       <div>${invoice.to_individual_country}</div>
       <div>Passport: ${invoice.to_individual_passport}</div>`;

  // ✅ ФОРМАТИРОВАНИЕ БАНКОВСКИХ РЕКВИЗИТОВ
  let bankDetailsHTML = '';
  if (invoice.bank_details_type === 'international') {
    bankDetailsHTML = `
      <div class="bank-details">
        <h3>BANK DETAILS FOR PAYMENT:</h3>
        ${invoice.bank_account_name ? `<div><strong>Account Name:</strong> ${invoice.bank_account_name}</div>` : ''}
        ${invoice.bank_account_address ? `<div><strong>Account Address:</strong> ${invoice.bank_account_address}</div>` : ''}
        ${invoice.bank_currency ? `<div><strong>Currency:</strong> ${invoice.bank_currency}</div>` : ''}
        ${invoice.bank_account_number ? `<div><strong>Account No:</strong> ${invoice.bank_account_number}</div>` : ''}
        ${invoice.bank_name ? `<div><strong>Bank Name:</strong> ${invoice.bank_name}</div>` : ''}
        ${invoice.bank_address ? `<div><strong>Bank Address:</strong> ${invoice.bank_address}</div>` : ''}
        ${invoice.bank_code ? `<div><strong>Bank Code:</strong> ${invoice.bank_code}</div>` : ''}
        ${invoice.bank_swift_code ? `<div><strong>Swift Code:</strong> ${invoice.bank_swift_code}</div>` : ''}
      </div>
    `;
  } else if (invoice.bank_details_type === 'custom') {
    bankDetailsHTML = `
      <div class="bank-details">
        <h3>BANK DETAILS FOR PAYMENT:</h3>
        <div style="white-space: pre-wrap;">${invoice.bank_custom_details || ''}</div>
      </div>
    `;
  } else if (invoice.bank_name || invoice.bank_account_name || invoice.bank_account_number) {
    bankDetailsHTML = `
      <div class="bank-details">
        <h3>BANK DETAILS FOR PAYMENT:</h3>
        ${invoice.bank_name ? `<div><strong>Bank:</strong> ${invoice.bank_name}</div>` : ''}
        ${invoice.bank_account_name ? `<div><strong>Account Name:</strong> ${invoice.bank_account_name}</div>` : ''}
        ${invoice.bank_account_number ? `<div><strong>Account Number:</strong> ${invoice.bank_account_number}</div>` : ''}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invoice.invoice_number}</title>
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
  }

  body {
    font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1b273b;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }

  .page {
    width: 210mm;
    height: 297mm;
    background: #ffffff;
    padding: 10mm;
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .page-inner {
    width: 190mm;
    height: 277mm;
    background: #ffffff;
    border: 1px solid #1b273b;
    padding: 8mm 15mm 15mm 15mm;
    flex: 1;
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
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
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .header {
    text-align: center;
    margin-bottom: 3mm;
  }

  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2mm;
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
    background: #ffffff;
    padding: 0 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    position: relative;
  }

  /* ✅ ДИНАМИЧЕСКИЙ FILTER ДЛЯ ЛОГОТИПА */
  .logo-container img {
    max-height: 16mm;
    max-width: 60mm;
    height: auto;
    width: auto;
    filter: ${logoFilter};
  }

  h1 {
    font-size: 8mm;
    font-weight: 900;
    text-align: center;
    margin: 2mm 0 4mm 0;
    letter-spacing: 0.5mm;
    color: #1b273b;
  }

  .invoice-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4mm;
    font-size: 3.3mm;
  }

  .invoice-meta-item {
    margin-bottom: 1mm;
  }

  .invoice-meta-item strong {
    font-weight: 600;
  }

  .parties {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4mm;
    gap: 10mm;
  }

  .party {
    flex: 1;
    font-size: 3mm;
    line-height: 1.3;
  }

  .party-title {
    font-size: 3.8mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
    padding-bottom: 1mm;
    border-bottom: 2px solid #1b273b;
  }

  .party div {
    margin-bottom: 0.8mm;
  }

  .property-details {
    background: #e8e5e1;
    padding: 2.5mm;
    margin-bottom: 4mm;
    border-radius: 2mm;
  }

  .property-details h3 {
    font-size: 3.3mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  .property-details div {
    font-size: 3mm;
    margin-bottom: 0.8mm;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4mm;
    font-size: 3mm;
  }

  .items-table th,
  .items-table td {
    border: 1px solid #1b273b;
    padding: 2mm;
    text-align: left;
  }

  /* ✅ ДИНАМИЧЕСКИЙ ЦВЕТ ЗАГОЛОВКА ТАБЛИЦЫ */
  .items-table th {
    background: ${headerBgColor} !important;
    color: white !important;
    font-weight: 700;
  }

  .items-table td.number {
    text-align: center;
    width: 10mm;
  }

  .items-table td.qty {
    text-align: center;
    width: 20mm;
  }

  .items-table td.price {
    text-align: right;
    width: 30mm;
  }

  .items-table tr.selected {
    background: #f0fff5 !important;
    font-weight: 600;
  }

  .totals {
    margin-left: auto;
    width: 70mm;
    font-size: 3.3mm;
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 1.2mm 0;
    border-bottom: 1px solid #d0d0d0;
  }

  .totals-row.total {
    font-size: 4.2mm;
    font-weight: 700;
    border-top: 2px solid #1b273b;
    border-bottom: 2px solid #1b273b;
    padding: 2mm 0;
    margin-top: 1mm;
  }

  .totals-row.amount-to-pay {
    font-size: 4.5mm;
    font-weight: 700;
    background: #2d5f3f;
    color: white !important;
    padding: 2mm;
    border-radius: 2mm;
    margin-top: 2mm;
  }

  .bank-details {
    margin-top: 4mm;
    padding: 2.5mm;
    background: #e8e5e1;
    border-radius: 2mm;
  }

  .bank-details h3 {
    font-size: 3.8mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  .bank-details div {
    font-size: 3mm;
    margin-bottom: 0.8mm;
  }

  .qr-section {
    position: absolute;
    bottom: 30mm;
    right: 15mm;
    opacity: 0.4;
    z-index: 5;
  }

  .qr-section img {
    width: 18mm;
    height: 18mm;
  }

  .signatures-section {
    position: absolute;
    bottom: 23mm;
    left: 15mm;
    right: 15mm;
    display: flex;
    justify-content: space-between;
    gap: 10mm;
    z-index: 9;
    border-top: 1px solid #d0d0d0;
    padding-top: 2mm;
  }

  .signature-block {
    flex: 1;
  }

  .signature-label {
    font-size: 3mm;
    font-weight: 600;
    color: #1b273b;
    margin-bottom: 1mm;
  }

  .signature-name {
    font-size: 3.3mm;
    font-weight: 400;
    color: #1b273b;
    margin-bottom: 0.5mm;
  }

  .signature-date {
    font-size: 3mm;
    color: #666;
  }

  .page-footer {
    position: absolute;
    bottom: 10mm;
    left: 15mm;
    right: 15mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    z-index: 10;
  }

  .page-footer-left {
    display: flex;
    flex-direction: column;
    gap: 1mm;
  }

  .invoice-number {
    font-size: 3mm;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
  }

  .invoice-uuid {
    font-size: 2.5mm;
    font-weight: 300;
    color: #999;
    font-family: 'Courier New', monospace;
  }

  .page-number {
    font-size: 3.5mm;
    font-weight: 300;
    color: #666;
  }

  strong {
    font-weight: 700;
  }
</style>
</head>
<body>
<div class="page">
  <div class="page-inner">
    <div class="watermark">
      <img src="${finalLogoUrl}" alt="Logo" />
    </div>
    <div class="page-content">
      <div class="header">
        <div class="logo-wrapper">
          <div class="decorative-line left"></div>
          <div class="logo-container">
            <img src="${finalLogoUrl}" alt="Logo" />
          </div>
          <div class="decorative-line right"></div>
        </div>
      </div>
      
      <h1>INVOICE</h1>
      
      <div class="invoice-meta">
        <div>
          <div class="invoice-meta-item">
            <strong>Invoice Number:</strong> ${invoice.invoice_number}
          </div>
          <div class="invoice-meta-item">
            <strong>Date:</strong> ${formatDate(invoice.invoice_date)}
          </div>
          ${invoice.due_date ? `
          <div class="invoice-meta-item">
            <strong>Due Date:</strong> ${formatDate(invoice.due_date)}
          </div>
          ` : ''}
          ${agreementData ? `
          <div class="invoice-meta-item">
            <strong>Agreement:</strong> ${agreementData.agreement_number}
          </div>
          ` : ''}
        </div>
      </div>

${agreementData ? `
<div class="property-details">
<h3>PROPERTY DETAILS:</h3>
<div><strong>Address:</strong> ${agreementData.address || 'N/A'}</div>
${agreementData.property_name ? `<div><strong>Property:</strong> ${agreementData.property_name}</div>` : ''}
${agreementData.property_number ? `<div><strong>Number:</strong> ${agreementData.property_number}</div>` : ''}
</div>
` : ''}

      <div class="parties">
        <div class="party">
          <div class="party-title">BILL FROM:</div>
          ${fromInfo}
        </div>
        <div class="party">
          <div class="party-title">BILL TO:</div>
          ${toInfo}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th class="number">#</th>
            <th>Description</th>
            <th class="qty">Qty</th>
            <th class="price">Unit Price</th>
            <th class="price">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const isSelected = selectedItems && selectedItems.length > 0 
              ? selectedItems.includes(item.id) 
              : true;
            return `
            <tr${isSelected ? ' class="selected"' : ''}>
              <td class="number">${index + 1}</td>
              <td>${item.description}${item.is_fully_paid ? ' <strong>[PAID]</strong>' : ''}</td>
              <td class="qty">${item.quantity}</td>
              <td class="price">${formatCurrency(item.unit_price)} ${invoice.currency}</td>
              <td class="price">${formatCurrency(item.total_price)} ${invoice.currency}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(invoice.subtotal)} ${invoice.currency}</span>
        </div>
        ${invoice.tax_amount > 0 ? `
        <div class="totals-row">
          <span>Tax:</span>
          <span>${formatCurrency(invoice.tax_amount)} ${invoice.currency}</span>
        </div>
        ` : ''}
        <div class="totals-row total">
          <span>TOTAL:</span>
          <span>${formatCurrency(invoice.total_amount)} ${invoice.currency}</span>
        </div>
        ${invoice.amount_paid > 0 ? `
        <div class="totals-row">
          <span>Already Paid:</span>
          <span>${formatCurrency(invoice.amount_paid)} ${invoice.currency}</span>
        </div>
        ` : ''}
        ${selectedItems && selectedItems.length > 0 ? `
        <div class="totals-row amount-to-pay">
          <span>PAY NOW:</span>
          <span>${formatCurrency(amountToPay)} ${invoice.currency}</span>
        </div>
        ` : ''}
      </div>

      ${bankDetailsHTML}
    </div>

  ${(invoice.show_qr_code === 1 || invoice.show_qr_code === true) && invoice.qr_code_base64 ? `
    <div class="qr-section">
      <img src="${invoice.qr_code_base64}" alt="QR Code" />
    </div>
    ` : ''}

    <div class="signatures-section">
      <div class="signature-block">
        <div class="signature-label">Delivered by</div>
        <div class="signature-name">
          ${invoice.from_type === 'company' 
            ? `Name: ${invoice.from_company_name || 'N/A'}` 
            : `Name: ${invoice.from_individual_name || 'N/A'}`}
        </div>
        <div class="signature-date">${formatDate(invoice.invoice_date)}</div>
      </div>
      <div class="signature-block">
        <div class="signature-label">Received by</div>
        <div class="signature-name">
          ${invoice.to_type === 'company' 
            ? `Name: ${invoice.to_company_name || 'N/A'}` 
            : `Name: ${invoice.to_individual_name || 'N/A'}`}
        </div>
        <div class="signature-date">${formatDate(invoice.invoice_date)}</div>
      </div>
    </div>

    <div class="page-footer">
      <div class="page-footer-left">
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="invoice-uuid">${invoice.uuid || ''}</div>
      </div>
      <div class="page-number">Page 1 of 1</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Генерация HTML для чека
 */
private generateReceiptHTML(
  receipt: any, 
  items: any[], 
  files: any[], 
  agreementData: any, 
  logoUrl?: string,
  _primaryColor?: string,
  _secondaryColor?: string
): string {
  const finalLogoUrl = logoUrl || 'https://admin.novaestate.company/nova-logo.svg';
  
  // ✅ ТОЛЬКО CSS filter для логотипа (убираем для партнёрских SVG)
  const hasPartnerLogo = logoUrl && !logoUrl.includes('nova-logo.svg');
  const logoFilter = hasPartnerLogo 
    ? 'none' 
    : 'brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1131%) hue-rotate(185deg) brightness(94%) contrast(91%)';
  
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const paymentMethods: Record<string, string> = {
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    crypto: 'Cryptocurrency',
    barter: 'Barter'
  };

  // ✅ ФОРМАТИРОВАНИЕ БАНКОВСКИХ РЕКВИЗИТОВ
  let bankDetailsHTML = '';
  if (receipt.bank_details_type === 'international') {
    bankDetailsHTML = `
      <div class="details-section">
        <h3>BANK DETAILS:</h3>
        <div class="detail-item">
          ${receipt.bank_account_name ? `<div><strong>Account Name:</strong> ${receipt.bank_account_name}</div>` : ''}
          ${receipt.bank_account_address ? `<div><strong>Account Address:</strong> ${receipt.bank_account_address}</div>` : ''}
          ${receipt.bank_currency ? `<div><strong>Currency:</strong> ${receipt.bank_currency}</div>` : ''}
          ${receipt.bank_account_number ? `<div><strong>Account No:</strong> ${receipt.bank_account_number}</div>` : ''}
          ${receipt.bank_name ? `<div><strong>Bank Name:</strong> ${receipt.bank_name}</div>` : ''}
          ${receipt.bank_address ? `<div><strong>Bank Address:</strong> ${receipt.bank_address}</div>` : ''}
          ${receipt.bank_code ? `<div><strong>Bank Code:</strong> ${receipt.bank_code}</div>` : ''}
          ${receipt.bank_swift_code ? `<div><strong>Swift Code:</strong> ${receipt.bank_swift_code}</div>` : ''}
        </div>
      </div>
    `;
  } else if (receipt.bank_details_type === 'custom') {
    bankDetailsHTML = `
      <div class="details-section">
        <h3>BANK DETAILS:</h3>
        <div class="detail-item">
          <div style="white-space: pre-wrap;">${receipt.bank_custom_details || ''}</div>
        </div>
      </div>
    `;
  } else if (receipt.bank_name || receipt.bank_account_name || receipt.bank_account_number) {
    bankDetailsHTML = `
      <div class="details-section">
        <h3>BANK DETAILS:</h3>
        <div class="detail-item">
          ${receipt.bank_name ? `<div><strong>Bank:</strong> ${receipt.bank_name}</div>` : ''}
          ${receipt.bank_account_name ? `<div><strong>Account Name:</strong> ${receipt.bank_account_name}</div>` : ''}
          ${receipt.bank_account_number ? `<div><strong>Account Number:</strong> ${receipt.bank_account_number}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt ${receipt.receipt_number}</title>
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
  }

  body {
    font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1b273b;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }

  .page {
    width: 210mm;
    height: 297mm;
    background: #ffffff;
    padding: 10mm;
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .page-inner {
    width: 190mm;
    height: 277mm;
    background: #ffffff;
    border: 1px solid #1b273b;
    padding: 8mm 15mm 15mm 15mm;
    flex: 1;
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
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
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .header {
    text-align: center;
    margin-bottom: 3mm;
  }

  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2mm;
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
    background: #ffffff;
    padding: 0 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    position: relative;
  }

  /* ✅ ДИНАМИЧЕСКИЙ FILTER ДЛЯ ЛОГОТИПА */
  .logo-container img {
    max-height: 16mm;
    max-width: 60mm;
    height: auto;
    width: auto;
    filter: ${logoFilter};
  }

  h1 {
    font-size: 8mm;
    font-weight: 900;
    text-align: center;
    margin: 2mm 0 4mm 0;
    letter-spacing: 0.5mm;
    color: #1b273b;
  }

  .receipt-meta {
    margin-bottom: 4mm;
    font-size: 3.3mm;
  }

  .receipt-meta-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1mm;
    padding-bottom: 1mm;
    border-bottom: 1px solid #d0d0d0;
  }

  .receipt-meta-item:last-child {
    border-bottom: none;
  }

  .receipt-meta-item strong {
    font-weight: 600;
  }

  .property-details {
    background: #e8e5e1;
    padding: 2.5mm;
    margin-bottom: 4mm;
    border-radius: 2mm;
  }

  .property-details h3 {
    font-size: 3.3mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  .property-details div {
    font-size: 3mm;
    margin-bottom: 0.8mm;
  }

  .details-section {
    margin-bottom: 4mm;
  }

  .details-section h3 {
    font-size: 3.8mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
    padding-bottom: 1mm;
    border-bottom: 2px solid #1b273b;
  }

  .detail-item {
    padding: 2mm;
    margin-bottom: 1mm;
    background: #e8e5e1;
    border-radius: 2mm;
    font-size: 3mm;
    line-height: 1.4;
  }

  .detail-item strong {
    display: block;
    margin-bottom: 0.8mm;
  }

  .detail-item .small {
    font-size: 2.7mm;
    color: #666;
  }

  .detail-item div {
    margin-bottom: 0.5mm;
  }

  .payment-amount {
    background: #2d5f3f;
    color: white !important;
    padding: 3mm 4mm;
    text-align: center;
    border-radius: 2mm;
    margin: 4mm 0;
  }

  .payment-amount .label {
    font-size: 3.2mm;
    margin-bottom: 1mm;
  }

  .payment-amount .amount {
    font-size: 7mm;
    font-weight: 900;
  }

  .payment-files {
    margin-top: 4mm;
  }

  .payment-files h3 {
    font-size: 3.8mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  .payment-files-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 3mm;
    justify-content: flex-start;
    align-items: flex-start;
  }

  .payment-file-wrapper {
    display: inline-block;
    border: 1px solid #1b273b;
    background: white;
    line-height: 0;
  }

  .payment-file {
    display: block;
    width: auto;
    height: auto;
    max-width: 85mm;
    max-height: 55mm;
    object-fit: contain;
  }

  .remarks {
    margin-top: 4mm;
    padding: 2.5mm;
    background: #e8e5e1;
    border-radius: 2mm;
  }

  .remarks h3 {
    font-size: 3.3mm;
    font-weight: 700;
    margin-bottom: 1mm;
  }

  .remarks p {
    font-size: 3mm;
    line-height: 1.4;
  }

  .qr-section {
    position: absolute;
    bottom: 25mm;
    right: 15mm;
    opacity: 0.4;
    z-index: 5;
  }

  .qr-section img {
    width: 18mm;
    height: 18mm;
  }

  .signatures-section {
    position: absolute;
    bottom: 23mm;
    left: 15mm;
    right: 15mm;
    display: flex;
    justify-content: space-between;
    gap: 10mm;
    z-index: 9;
    border-top: 1px solid #d0d0d0;
    padding-top: 2mm;
  }

  .signature-block {
    flex: 1;
  }

  .signature-label {
    font-size: 3mm;
    font-weight: 600;
    color: #1b273b;
    margin-bottom: 1mm;
  }

  .signature-name {
    font-size: 3.3mm;
    font-weight: 400;
    color: #1b273b;
    margin-bottom: 0.5mm;
  }

  .signature-date {
    font-size: 3mm;
    color: #666;
  }

  .page-footer {
    position: absolute;
    bottom: 10mm;
    left: 15mm;
    right: 15mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    z-index: 10;
  }

  .page-footer-left {
    display: flex;
    flex-direction: column;
    gap: 1mm;
  }

  .receipt-number {
    font-size: 3mm;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
  }

  .receipt-uuid {
    font-size: 2.5mm;
    font-weight: 300;
    color: #999;
    font-family: 'Courier New', monospace;
  }
  .page-number {
    font-size: 3.5mm;
    font-weight: 300;
    color: #666;
  }

  strong {
    font-weight: 700;
  }
</style>
</head>
<body>
<div class="page">
  <div class="page-inner">
    <div class="watermark">
      <img src="${finalLogoUrl}" alt="Logo" />
    </div>
    <div class="page-content">
      <div class="header">
        <div class="logo-wrapper">
          <div class="decorative-line left"></div>
          <div class="logo-container">
            <img src="${finalLogoUrl}" alt="Logo" />
          </div>
          <div class="decorative-line right"></div>
        </div>
      </div>
      
      <h1>RECEIPT</h1>
      
      <div class="receipt-meta">
        <div class="receipt-meta-item">
          <strong>Document Number:</strong>
          <span>${receipt.receipt_number}</span>
        </div>
        <div class="receipt-meta-item">
          <strong>Date:</strong>
          <span>${formatDate(receipt.receipt_date)}</span>
        </div>
        ${receipt.invoice_number ? `
        <div class="receipt-meta-item">
          <strong>Invoice:</strong>
          <span>${receipt.invoice_number}</span>
        </div>
        ` : ''}
        ${agreementData ? `
        <div class="receipt-meta-item">
          <strong>Agreement:</strong>
          <span>${agreementData.agreement_number}</span>
        </div>
        ` : ''}
      </div>

${agreementData ? `
<div class="property-details">
<h3>PROPERTY DETAILS:</h3>
<div><strong>Address:</strong> ${agreementData.address || 'N/A'}</div>
${agreementData.property_name ? `<div><strong>Property:</strong> ${agreementData.property_name}</div>` : ''}
${agreementData.property_number ? `<div><strong>Number:</strong> ${agreementData.property_number}</div>` : ''}
</div>
` : ''}

      <div class="payment-amount">
        <div class="label">Payment Received</div>
        <div class="amount">${formatCurrency(receipt.amount_paid)} THB</div>
      </div>

      <div class="details-section">
        <h3>PAYMENT DETAILS:</h3>
        <div class="detail-item">
          <strong>Payment Method:</strong>
          ${paymentMethods[receipt.payment_method] || receipt.payment_method}
        </div>
      </div>

      ${bankDetailsHTML}

      ${items && items.length > 0 ? `
      <div class="details-section">
        <h3>PAID ITEMS:</h3>
        ${items.map(item => `
          <div class="detail-item">
            <strong>${item.description}</strong>
            <div class="small">
              ${item.quantity} x ${formatCurrency(item.unit_price)} THB = ${formatCurrency(item.total_price)} THB
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${files && files.length > 0 ? `
      <div class="payment-files">
        <h3>PAYMENT CONFIRMATION:</h3>
        <div class="payment-files-grid">
          ${files.slice(0, 2).map(file => `
            <div class="payment-file-wrapper">
              <img src="https://admin.novaestate.company${file.file_path}" class="payment-file" alt="Payment confirmation" />
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${receipt.notes ? `
      <div class="remarks">
        <h3>REMARKS:</h3>
        <p>${receipt.notes}</p>
      </div>
      ` : ''}
    </div>

  ${(receipt.show_qr_code === 1 || receipt.show_qr_code === true) && receipt.qr_code_base64 ? `
    <div class="qr-section">
      <img src="${receipt.qr_code_base64}" alt="QR Code" />
    </div>
    ` : ''}

    <div class="signatures-section">
      <div class="signature-block">
        <div class="signature-label">Delivered by</div>
        <div class="signature-name">
          ${receipt.from_type === 'company' 
            ? `Name: ${receipt.from_company_name || 'N/A'}` 
            : `Name: ${receipt.from_individual_name || 'N/A'}`}
        </div>
        <div class="signature-date">${formatDate(receipt.receipt_date)}</div>
      </div>
      <div class="signature-block">
        <div class="signature-label">Received by</div>
        <div class="signature-name">
          ${receipt.to_type === 'company' 
            ? `Name: ${receipt.to_company_name || 'N/A'}` 
            : `Name: ${receipt.to_individual_name || 'N/A'}`}
        </div>
        <div class="signature-date">${formatDate(receipt.receipt_date)}</div>
      </div>
    </div>

    <div class="page-footer">
      <div class="page-footer-left">
        <div class="receipt-number">${receipt.receipt_number}</div>
        <div class="receipt-uuid">${receipt.uuid || ''}</div>
      </div>
      <div class="page-number">Page 1 of 1</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

  // ==================== PUBLIC ACCESS ====================

  /**
   * Получить инвойс по UUID (публичный доступ)
   * GET /api/financial-documents/public/invoice/:uuid
   */
  async getInvoiceByUuid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      const invoice = await db.queryOne(`
        SELECT 
          i.*,
          a.agreement_number,
          a.verify_link as agreement_verify_link,
          u.username as created_by_name
        FROM invoices i
        LEFT JOIN agreements a ON i.agreement_id = a.id
        LEFT JOIN admin_users u ON i.created_by = u.id
        WHERE i.uuid = ? AND i.deleted_at IS NULL
      `, [uuid]);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Получаем позиции инвойса
      const items = await db.query(
        'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
        [invoice.id]
      );

      // Получаем чеки для этого инвойса
      const receipts = await db.query(`
        SELECT 
          r.id,
          r.uuid,
          r.receipt_number,
          r.receipt_date,
          r.amount_paid,
          r.payment_method,
          r.created_at
        FROM receipts r
        WHERE r.invoice_id = ? AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC
      `, [invoice.id]);

      res.json({
        success: true,
        data: {
          ...invoice,
          items,
          receipts
        }
      });
    } catch (error) {
      logger.error('Get invoice by UUID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving invoice'
      });
    }
  }

  /**
   * Получить чек по UUID (публичный доступ)
   * GET /api/financial-documents/public/receipt/:uuid
   */
  async getReceiptByUuid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      const receipt = await db.queryOne(`
        SELECT 
          r.*,
          i.invoice_number,
          i.uuid as invoice_uuid,
          a.agreement_number,
          a.verify_link as agreement_verify_link,
          u.username as created_by_name
        FROM receipts r
        LEFT JOIN invoices i ON r.invoice_id = i.id
        LEFT JOIN agreements a ON r.agreement_id = a.id
        LEFT JOIN admin_users u ON r.created_by = u.id
        WHERE r.uuid = ? AND r.deleted_at IS NULL
      `, [uuid]);

      if (!receipt) {
        res.status(404).json({
          success: false,
          message: 'Receipt not found'
        });
        return;
      }

      // Получаем файлы чека
      const files = await db.query(
        'SELECT * FROM receipt_files WHERE receipt_id = ? ORDER BY uploaded_at',
        [receipt.id]
      );

      // Получаем привязанные позиции инвойса
      const items = await db.query(`
        SELECT 
          rii.*,
          ii.description,
          ii.quantity,
          ii.unit_price,
          ii.total_price
        FROM receipt_invoice_items rii
        LEFT JOIN invoice_items ii ON rii.invoice_item_id = ii.id
        WHERE rii.receipt_id = ?
      `, [receipt.id]);

      // Получаем данные инвойса
      let invoice = null;
      if (receipt.invoice_id) {
        invoice = await db.queryOne(`
          SELECT 
            i.*
          FROM invoices i
          WHERE i.id = ? AND i.deleted_at IS NULL
        `, [receipt.invoice_id]);

        if (invoice) {
          const invoiceItems = await db.query(
            'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
            [invoice.id]
          );
          invoice.items = invoiceItems;
        }
      }

      res.json({
        success: true,
        data: {
          ...receipt,
          files,
          items,
          invoice
        }
      });
    } catch (error) {
      logger.error('Get receipt by UUID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving receipt'
      });
    }
  }

  /**
   * Скачать PDF инвойса по UUID (публичный доступ)
   * GET /api/financial-documents/public/invoice/:uuid/pdf
   */
  async downloadInvoicePDFByUuid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      const invoice = await db.queryOne<any>(
        'SELECT id, pdf_path, invoice_number FROM invoices WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      if (!invoice.pdf_path) {
        await this.generateInvoicePDF(invoice.id);
        
        const updatedInvoice = await db.queryOne<any>(
          'SELECT pdf_path FROM invoices WHERE id = ?',
          [invoice.id]
        );
        
        invoice.pdf_path = updatedInvoice.pdf_path;
      }

      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', invoice.pdf_path.replace('/uploads/', ''));

      const fs = require('fs-extra');
      if (!await fs.pathExists(filePath)) {
        res.status(404).json({
          success: false,
          message: 'PDF file not found'
        });
        return;
      }

      res.download(filePath, `${invoice.invoice_number}.pdf`, (err) => {
        if (err) {
          logger.error('Error downloading invoice PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error downloading PDF'
            });
          }
        }
      });
    } catch (error) {
      logger.error('Download invoice PDF by UUID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading PDF'
      });
    }
  }

  /**
   * Скачать PDF чека по UUID (публичный доступ)
   * GET /api/financial-documents/public/receipt/:uuid/pdf
   */
  async downloadReceiptPDFByUuid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { uuid } = req.params;

      const receipt = await db.queryOne<any>(
        'SELECT id, pdf_path, receipt_number FROM receipts WHERE uuid = ? AND deleted_at IS NULL',
        [uuid]
      );

      if (!receipt) {
        res.status(404).json({
          success: false,
          message: 'Receipt not found'
        });
        return;
      }

      if (!receipt.pdf_path) {
        await this.generateReceiptPDF(receipt.id);
        
        const updatedReceipt = await db.queryOne<any>(
          'SELECT pdf_path FROM receipts WHERE id = ?',
          [receipt.id]
        );
        
        receipt.pdf_path = updatedReceipt.pdf_path;
      }

      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', receipt.pdf_path.replace('/uploads/', ''));

      const fs = require('fs-extra');
      if (!await fs.pathExists(filePath)) {
        res.status(404).json({
          success: false,
          message: 'PDF file not found'
        });
        return;
      }

      res.download(filePath, `${receipt.receipt_number}.pdf`, (err) => {
        if (err) {
          logger.error('Error downloading receipt PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error downloading PDF'
            });
          }
        }
      });
    } catch (error) {
      logger.error('Download receipt PDF by UUID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading PDF'
      });
    }
  }

  // ==================== RESERVATION CONFIRMATION TEMPLATES ====================

  /**
   * Получить все шаблоны Notice
   * GET /api/financial-documents/confirmation-templates
   */
  async getAllConfirmationTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userPartnerId = req.admin?.partner_id;
      const whereConditions: string[] = ['rct.is_active = 1'];
      const queryParams: any[] = [];

      // Фильтрация по партнёру (показываем общие + партнёрские)
      if (userPartnerId !== null && userPartnerId !== undefined) {
        whereConditions.push('(rct.partner_id IS NULL OR rct.partner_id = ?)');
        queryParams.push(userPartnerId);
      } else {
        whereConditions.push('rct.partner_id IS NULL');
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      const templates = await db.query(`
        SELECT 
          rct.*,
          au.username as created_by_name
        FROM reservation_confirmation_templates rct
        LEFT JOIN admin_users au ON rct.created_by = au.id
        ${whereClause}
        ORDER BY rct.created_at DESC
      `, queryParams);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Get all confirmation templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения шаблонов'
      });
    }
  }

  /**
   * Получить шаблон Notice по ID
   * GET /api/financial-documents/confirmation-templates/:id
   */
  async getConfirmationTemplateById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const template = await db.queryOne(`
        SELECT 
          rct.*,
          au.username as created_by_name
        FROM reservation_confirmation_templates rct
        LEFT JOIN admin_users au ON rct.created_by = au.id
        WHERE rct.id = ?
      `, [id]);

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Шаблон не найден'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Get confirmation template by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения шаблона'
      });
    }
  }

  /**
   * Создать шаблон Notice
   * POST /api/financial-documents/confirmation-templates
   */
  async createConfirmationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.admin!.id;
      const userPartnerId = req.admin?.partner_id;
      const { name, content, is_active } = req.body;

      if (!name || !content) {
        res.status(400).json({
          success: false,
          message: 'Название и содержимое обязательны'
        });
        return;
      }

      const result = await db.query(`
        INSERT INTO reservation_confirmation_templates (name, content, is_active, created_by, partner_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        name,
        content,
        is_active !== undefined ? is_active : 1,
        userId,
        userPartnerId || null
      ]);

      const templateId = (result as any).insertId;

      logger.info(`Confirmation template created: ${templateId} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Шаблон успешно создан',
        data: { id: templateId }
      });
    } catch (error) {
      logger.error('Create confirmation template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания шаблона'
      });
    }
  }

  /**
   * Обновить шаблон Notice
   * PUT /api/financial-documents/confirmation-templates/:id
   */
  async updateConfirmationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, content, is_active } = req.body;

      const existing = await db.queryOne(
        'SELECT * FROM reservation_confirmation_templates WHERE id = ?',
        [id]
      );

      if (!existing) {
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
      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (fields.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE reservation_confirmation_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      logger.info(`Confirmation template updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Шаблон успешно обновлён'
      });
    } catch (error) {
      logger.error('Update confirmation template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления шаблона'
      });
    }
  }

  /**
   * Удалить шаблон Notice
   * DELETE /api/financial-documents/confirmation-templates/:id
   */
  async deleteConfirmationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM reservation_confirmation_templates WHERE id = ?',
        [id]
      );

      if ((result as any).affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Шаблон не найден'
        });
        return;
      }

      logger.info(`Confirmation template deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Шаблон успешно удалён'
      });
    } catch (error) {
      logger.error('Delete confirmation template error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления шаблона'
      });
    }
  }

  // ==================== RESERVATION CONFIRMATIONS ====================

  /**
   * Получить список всех подтверждений бронирования
   * GET /api/financial-documents/reservation-confirmations
   */
  async getAllReservationConfirmations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { agreement_id, search, page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = ['rc.deleted_at IS NULL'];
      const queryParams: any[] = [];

      // Фильтрация по партнёру
      const userPartnerId = req.admin?.partner_id;
      if (userPartnerId !== null && userPartnerId !== undefined) {
        whereConditions.push('au.partner_id = ?');
        queryParams.push(userPartnerId);
      }

      if (agreement_id) {
        whereConditions.push('rc.agreement_id = ?');
        queryParams.push(agreement_id);
      }

      if (search) {
        whereConditions.push('(rc.confirmation_number LIKE ? OR rc.property_name LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Получаем общее количество
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM reservation_confirmations rc 
        LEFT JOIN admin_users au ON rc.created_by = au.id
        ${whereClause}
      `;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем подтверждения
      const query = `
        SELECT 
          rc.*,
          a.agreement_number,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM reservation_confirmation_guests WHERE confirmation_id = rc.id) as guests_count,
          (SELECT GROUP_CONCAT(guest_name SEPARATOR ', ') FROM reservation_confirmation_guests WHERE confirmation_id = rc.id ORDER BY sort_order LIMIT 3) as guest_names
        FROM reservation_confirmations rc
        LEFT JOIN agreements a ON rc.agreement_id = a.id
        LEFT JOIN admin_users u ON rc.created_by = u.id
        LEFT JOIN admin_users au ON rc.created_by = au.id
        ${whereClause}
        ORDER BY rc.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limitNum, offset);
      const confirmations = await db.query(query, queryParams);

      res.json({
        success: true,
        data: confirmations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get all reservation confirmations error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения подтверждений'
      });
    }
  }

  /**
   * Получить подтверждение бронирования по ID
   * GET /api/financial-documents/reservation-confirmations/:id
   */
  async getReservationConfirmationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const confirmation = await db.queryOne(`
        SELECT 
          rc.*,
          a.agreement_number,
          rct.name as template_name,
          rct.content as template_content,
          p.logo_filename as partner_logo_filename,
          p.partner_name,
          p.primary_color as partner_primary_color,
          p.secondary_color as partner_secondary_color,
          p.accent_color as partner_accent_color,
          p.phone as partner_phone,
          p.email as partner_email,
          au.username as created_by_name
        FROM reservation_confirmations rc
        LEFT JOIN agreements a ON rc.agreement_id = a.id
        LEFT JOIN reservation_confirmation_templates rct ON rc.template_id = rct.id
        LEFT JOIN admin_users au ON rc.created_by = au.id
        LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
        WHERE rc.id = ? AND rc.deleted_at IS NULL
      `, [id]);

      if (!confirmation) {
        res.status(404).json({
          success: false,
          message: 'Подтверждение не найдено'
        });
        return;
      }

      // Получаем гостей
      const guests = await db.query(
        'SELECT * FROM reservation_confirmation_guests WHERE confirmation_id = ? ORDER BY sort_order, id',
        [id]
      );

      // Добавляем logo URL и цвета
      (confirmation as any).logoUrl = (confirmation as any).partner_logo_filename 
        ? `https://admin.novaestate.company/${(confirmation as any).partner_logo_filename}`
        : 'https://admin.novaestate.company/nova-logo.svg';

      (confirmation as any).primaryColor = (confirmation as any).partner_primary_color || '#1b273b';
      (confirmation as any).secondaryColor = (confirmation as any).partner_secondary_color || '#5d666e';
      (confirmation as any).accentColor = (confirmation as any).partner_accent_color || '#1b273b';

      res.json({
        success: true,
        data: {
          ...confirmation,
          guests
        }
      });
    } catch (error) {
      logger.error('Get reservation confirmation by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения подтверждения'
      });
    }
  }
/**
 * Создать подтверждение бронирования
 * POST /api/financial-documents/reservation-confirmations
 */
async createReservationConfirmation(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const userId = req.admin!.id;
    const data = req.body;

    // Генерируем уникальный номер RC-{timestamp}-{random}
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const confirmation_number = `RC-${timestamp}-${randomPart}`;

    // Получаем данные партнёра для контактов
    const userPartner = await db.queryOne<any>(`
      SELECT p.phone, p.email, p.domain
      FROM admin_users au
      LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
      WHERE au.id = ?
    `, [userId]);

    // Дефолтные контакты
    const defaultPhone = '+6661008937';
    const defaultEmail = 'service@novaestate.company';

    // Определяем контакты (приоритет: из формы -> партнёр -> дефолт)
    const fromTelephone = data.from_telephone || userPartner?.phone || defaultPhone;
    const fromEmail = data.from_email || userPartner?.email || defaultEmail;

    // Получаем и обрабатываем шаблон Notice если указан
    let noticeContent = data.notice_content || null;
    if (data.template_id && !noticeContent) {
      const template = await db.queryOne<any>(
        'SELECT content FROM reservation_confirmation_templates WHERE id = ?',
        [data.template_id]
      );
      if (template) {
        noticeContent = this.replaceConfirmationTemplateVariables(template.content, data);
      }
    }

    // Создаём подтверждение
    const result = await connection.query(`
      INSERT INTO reservation_confirmations (
        confirmation_number, agreement_id, template_id,
        property_name, property_address,
        from_company_name, from_telephone, from_email,
        confirmation_date, arrival_date, departure_date,
        arrival_time, departure_time, check_in_time, check_out_time,
        room_type, rate_type, rate_amount, num_rooms, num_guests, deposit_amount,
        pick_up_service, drop_off_service, arrival_flight, departure_flight,
        remarks, notice_content, cancellation_policy, welcome_message,
        electricity_rate, water_rate,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      confirmation_number,
      data.agreement_id || null,
      data.template_id || null,
      data.property_name || null,
      data.property_address || null,
      data.from_company_name || null,
      fromTelephone,
      fromEmail,
      data.confirmation_date || new Date().toISOString().split('T')[0],
      data.arrival_date || null,
      data.departure_date || null,
      data.arrival_time || '15:00',
      data.departure_time || '12:00',
      data.check_in_time || '15:00PM',
      data.check_out_time || '12:00 Noon',
      data.room_type || null,
      data.rate_type || 'daily',
      data.rate_amount || null,
      data.num_rooms || null,
      data.num_guests || null,
      data.deposit_amount || null,
      data.pick_up_service ? 1 : 0,
      data.drop_off_service ? 1 : 0,
      data.arrival_flight || null,
      data.departure_flight || null,
      data.remarks || null,
      noticeContent,
      data.cancellation_policy || 'Order confirmed, No change, No refund',
      data.welcome_message || 'Thank you for making a reservation at our Villa. We\'re delighted to confirm the details for your upcoming stay.',
      data.electricity_rate || null,
      data.water_rate || null,
      userId
    ]);

    const confirmationId = (result as any)[0].insertId;

    // Создаём гостей
    if (data.guests && data.guests.length > 0) {
      for (let i = 0; i < data.guests.length; i++) {
        const guest = data.guests[i];
        if (guest.guest_name) {
          await connection.query(`
            INSERT INTO reservation_confirmation_guests (
              confirmation_id, guest_name, passport_number, passport_country, phone, email, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            confirmationId,
            guest.guest_name,
            guest.passport_number || null,
            guest.passport_country || null,
            guest.phone || null,
            guest.email || null,
            i
          ]);
        }
      }
    }

    await db.commit(connection);

    // Генерируем PDF сразу после создания
    try {
      await this.generateReservationConfirmationPDF(confirmationId);
    } catch (pdfError) {
      logger.error('PDF generation failed:', pdfError);
    }

    logger.info(`Reservation confirmation created: ${confirmation_number} (ID: ${confirmationId}) by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Подтверждение успешно создано',
      data: {
        id: confirmationId,
        confirmation_number
      }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Create reservation confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания подтверждения'
    });
  }
}
  /**
   * Обновить подтверждение бронирования
   * PUT /api/financial-documents/reservation-confirmations/:id
   */
  async updateReservationConfirmation(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await db.queryOne(
        'SELECT * FROM reservation_confirmations WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!existing) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Подтверждение не найдено'
        });
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      // Обновляем поля
      const updateFields = [
        'agreement_id', 'template_id', 'property_name', 'property_address',
        'from_company_name', 'from_telephone', 'from_email',
        'confirmation_date', 'arrival_date', 'departure_date',
        'arrival_time', 'departure_time', 'check_in_time', 'check_out_time',
        'room_type', 'rate_type', 'rate_amount', 'num_rooms', 'num_guests',
        'arrival_flight', 'departure_flight', 'remarks',
        'notice_content', 'cancellation_policy', 'welcome_message',
        'electricity_rate', 'water_rate'
      ];

      for (const field of updateFields) {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(data[field] || null);
        }
      }

      // Булевые поля
      if (data.pick_up_service !== undefined) {
        fields.push('pick_up_service = ?');
        values.push(data.pick_up_service ? 1 : 0);
      }
      if (data.drop_off_service !== undefined) {
        fields.push('drop_off_service = ?');
        values.push(data.drop_off_service ? 1 : 0);
      }

      // Если изменился шаблон - обновляем notice_content
      if (data.template_id && data.template_id !== (existing as any).template_id) {
        const template = await db.queryOne<any>(
          'SELECT content FROM reservation_confirmation_templates WHERE id = ?',
          [data.template_id]
        );
        if (template) {
          const mergedData = { ...(existing as any), ...data };
          const newNoticeContent = this.replaceConfirmationTemplateVariables(template.content, mergedData);
          fields.push('notice_content = ?');
          values.push(newNoticeContent);
        }
      }

      if (fields.length > 0) {
        fields.push('pdf_path = ?', 'pdf_generated_at = ?');
        values.push(null, null);
        
        values.push(id);
        await connection.query(
          `UPDATE reservation_confirmations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      // Обновляем гостей если переданы
      if (data.guests !== undefined) {
        // Удаляем старых гостей
        await connection.query('DELETE FROM reservation_confirmation_guests WHERE confirmation_id = ?', [id]);

        // Создаём новых
        if (data.guests && data.guests.length > 0) {
          for (let i = 0; i < data.guests.length; i++) {
            const guest = data.guests[i];
            if (guest.guest_name) {
              await connection.query(`
                INSERT INTO reservation_confirmation_guests (
                  confirmation_id, guest_name, passport_number, passport_country, phone, email, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [
                id,
                guest.guest_name,
                guest.passport_number || null,
                guest.passport_country || null,
                guest.phone || null,
                guest.email || null,
                i
              ]);
            }
          }
        }
      }

      await db.commit(connection);

      // Регенерируем PDF
      try {
        await this.generateReservationConfirmationPDF(parseInt(id));
      } catch (pdfError) {
        logger.error('PDF regeneration failed:', pdfError);
      }

      logger.info(`Reservation confirmation updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Подтверждение успешно обновлено'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update reservation confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления подтверждения'
      });
    }
  }

  /**
   * Удалить подтверждение бронирования (мягкое удаление)
   * DELETE /api/financial-documents/reservation-confirmations/:id
   */
  async deleteReservationConfirmation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.query(
        'UPDATE reservation_confirmations SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if ((result as any).affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Подтверждение не найдено'
        });
        return;
      }

      logger.info(`Reservation confirmation deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Подтверждение успешно удалено'
      });
    } catch (error) {
      logger.error('Delete reservation confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления подтверждения'
      });
    }
  }

  /**
   * Получить HTML версию подтверждения для генерации PDF
   * GET /api/financial-documents/reservation-confirmations/:id/html
   */
  async getReservationConfirmationHTML(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { internalKey } = req.query;

      // Проверяем внутренний ключ для Puppeteer
      const expectedKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
      if (internalKey !== expectedKey) {
        res.status(403).send('Доступ запрещен');
        return;
      }

      const confirmation = await db.queryOne(`
        SELECT 
          rc.*,
          a.agreement_number,
          p.logo_filename as partner_logo_filename,
          p.primary_color as partner_primary_color,
          p.secondary_color as partner_secondary_color,
          p.accent_color as partner_accent_color
        FROM reservation_confirmations rc
        LEFT JOIN agreements a ON rc.agreement_id = a.id
        LEFT JOIN admin_users au ON rc.created_by = au.id
        LEFT JOIN partners p ON au.partner_id = p.id AND p.is_active = 1
        WHERE rc.id = ? AND rc.deleted_at IS NULL
      `, [id]);

      if (!confirmation) {
        res.status(404).send('Confirmation not found');
        return;
      }

      // Получаем гостей
      const guests = await db.query(
        'SELECT * FROM reservation_confirmation_guests WHERE confirmation_id = ? ORDER BY sort_order, id',
        [id]
      );

      // Формируем logo URL
      const logoUrl = (confirmation as any).partner_logo_filename 
        ? `https://admin.novaestate.company/${(confirmation as any).partner_logo_filename}`
        : 'https://admin.novaestate.company/nova-logo.svg';

      const primaryColor = (confirmation as any).partner_primary_color || '#1b273b';
      const secondaryColor = (confirmation as any).partner_secondary_color || '#5d666e';

      // Генерируем HTML
      const html = this.generateReservationConfirmationHTMLTemplate(
        confirmation, 
        guests as any[], 
        logoUrl, 
        primaryColor, 
        secondaryColor
      );
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);

    } catch (error) {
      logger.error('Get reservation confirmation HTML error:', error);
      res.status(500).send('Error generating HTML');
    }
  }

  /**
   * Скачать PDF подтверждения
   * GET /api/financial-documents/reservation-confirmations/:id/pdf
   */
  async downloadReservationConfirmationPDF(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const confirmation = await db.queryOne<any>(
        'SELECT pdf_path, confirmation_number FROM reservation_confirmations WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!confirmation) {
        res.status(404).json({
          success: false,
          message: 'Подтверждение не найдено'
        });
        return;
      }

      if (!confirmation.pdf_path) {
        await this.generateReservationConfirmationPDF(parseInt(id));
        
        const updated = await db.queryOne<any>(
          'SELECT pdf_path FROM reservation_confirmations WHERE id = ?',
          [id]
        );
        
        confirmation.pdf_path = updated.pdf_path;
      }

      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', confirmation.pdf_path.replace('/uploads/', ''));

      const fs = require('fs-extra');
      if (!await fs.pathExists(filePath)) {
        res.status(404).json({
          success: false,
          message: 'PDF файл не найден'
        });
        return;
      }

      res.download(filePath, `${confirmation.confirmation_number}.pdf`, (err) => {
        if (err) {
          logger.error('Error downloading confirmation PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Ошибка скачивания PDF'
            });
          }
        }
      });

    } catch (error) {
      logger.error('Download reservation confirmation PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка скачивания PDF'
      });
    }
  }

  /**
   * Публичный доступ к подтверждению по номеру
   * GET /api/financial-documents/public/confirmation/:number
   */
  async getReservationConfirmationByNumber(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { number } = req.params;

      const confirmation = await db.queryOne(`
        SELECT 
          rc.*,
          a.agreement_number
        FROM reservation_confirmations rc
        LEFT JOIN agreements a ON rc.agreement_id = a.id
        WHERE rc.confirmation_number = ? AND rc.deleted_at IS NULL
      `, [number]);

      if (!confirmation) {
        res.status(404).json({
          success: false,
          message: 'Confirmation not found'
        });
        return;
      }

      // Получаем гостей
      const guests = await db.query(
        'SELECT guest_name, passport_country FROM reservation_confirmation_guests WHERE confirmation_id = ? ORDER BY sort_order',
        [(confirmation as any).id]
      );

      res.json({
        success: true,
        data: {
          ...confirmation,
          guests
        }
      });
    } catch (error) {
      logger.error('Get confirmation by number error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving confirmation'
      });
    }
  }

  /**
   * Генерация PDF для подтверждения бронирования
   */
  private async generateReservationConfirmationPDF(confirmationId: number): Promise<void> {
    try {
      const PDFService = require('../services/pdf.service').PDFService;
      const pdfPath = await PDFService.generateReservationConfirmationPDF(confirmationId);
      
      await db.query(
        'UPDATE reservation_confirmations SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?',
        [pdfPath, confirmationId]
      );
      
      logger.info(`Reservation confirmation PDF generated: ${pdfPath}`);
    } catch (error) {
      logger.error(`Error generating reservation confirmation PDF ${confirmationId}:`, error);
      throw error;
    }
  }

  /**
   * Замена переменных в шаблоне Notice
   */
  private replaceConfirmationTemplateVariables(template: string, data: any): string {
    const variables: Record<string, string> = {
      '{{check_in_time}}': data.check_in_time || '15:00PM',
      '{{check_out_time}}': data.check_out_time || '12:00 Noon',
      '{{deposit_amount}}': data.deposit_amount || '________',
      '{{electricity_rate}}': data.electricity_rate ? `${data.electricity_rate}` : '________',
      '{{water_rate}}': data.water_rate ? `${data.water_rate}` : '________',
      '{{property_name}}': data.property_name || '________',
      '{{property_address}}': data.property_address || '________',
      '{{arrival_date}}': data.arrival_date || '________',
      '{{departure_date}}': data.departure_date || '________',
      '{{rate_amount}}': data.rate_amount ? `${data.rate_amount}` : '________',
      '{{num_guests}}': data.num_guests ? `${data.num_guests}` : '________',
      '{{num_rooms}}': data.num_rooms ? `${data.num_rooms}` : '________',
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }
/**
   * Генерация HTML для подтверждения бронирования
   */
  private generateReservationConfirmationHTMLTemplate(
    confirmation: any, 
    guests: any[], 
    logoUrl: string,
    _primaryColor: string,
    secondaryColor: string
  ): string {
    const hasPartnerLogo = logoUrl && !logoUrl.includes('nova-logo.svg');
    const logoFilter = hasPartnerLogo 
      ? 'none' 
      : 'brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1131%) hue-rotate(185deg) brightness(94%) contrast(91%)';
    
    const headerBgColor = secondaryColor || '#5d666e';
    
    const formatDate = (date: string | Date | null): string => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const formatCurrency = (amount: number | null): string => {
      if (!amount) return 'N/A';
      return new Intl.NumberFormat('en-US').format(amount);
    };

    // Мягкое адаптивное масштабирование в зависимости от количества гостей
    const guestCount = guests.length;
    let scaleFactor = 1;
    let tableFontSize = '2.8mm';
    let tablePadding = '1.5mm 2mm';
    let sectionMargin = '4mm';
    let welcomeDisplay = 'block';

    if (guestCount === 4) {
      scaleFactor = 0.97;
      tableFontSize = '2.7mm';
      tablePadding = '1.3mm 1.8mm';
      sectionMargin = '3.5mm';
    } else if (guestCount === 5) {
      scaleFactor = 0.95;
      tableFontSize = '2.6mm';
      tablePadding = '1.2mm 1.6mm';
      sectionMargin = '3.2mm';
    } else if (guestCount === 6) {
      scaleFactor = 0.93;
      tableFontSize = '2.5mm';
      tablePadding = '1.1mm 1.5mm';
      sectionMargin = '3mm';
    } else if (guestCount === 7) {
      scaleFactor = 0.91;
      tableFontSize = '2.4mm';
      tablePadding = '1mm 1.4mm';
      sectionMargin = '2.8mm';
    } else if (guestCount === 8) {
      scaleFactor = 0.89;
      tableFontSize = '2.3mm';
      tablePadding = '0.9mm 1.3mm';
      sectionMargin = '2.6mm';
      welcomeDisplay = 'none';
    } else if (guestCount === 9) {
      scaleFactor = 0.87;
      tableFontSize = '2.2mm';
      tablePadding = '0.8mm 1.2mm';
      sectionMargin = '2.4mm';
      welcomeDisplay = 'none';
    } else if (guestCount >= 10) {
      scaleFactor = 0.85;
      tableFontSize = '2.1mm';
      tablePadding = '0.7mm 1.1mm';
      sectionMargin = '2.2mm';
      welcomeDisplay = 'none';
    }

    // Формируем список гостей
    const guestsHTML = guests.map((guest, index) => `
      <tr>
        <td class="number">${index + 1}</td>
        <td><strong>${guest.guest_name}</strong></td>
        <td>${guest.passport_number || '-'}</td>
        <td>${guest.passport_country || '-'}</td>
        <td>${guest.phone || '-'}</td>
        <td>${guest.email || '-'}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reservation Confirmation ${confirmation.confirmation_number}</title>
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
  }

  body {
    font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1b273b;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }

  .page {
    width: 210mm;
    height: 297mm;
    background: #ffffff;
    padding: 10mm;
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  }

  .page-inner {
    width: 190mm;
    height: 277mm;
    background: #ffffff;
    border: 1px solid #1b273b;
    padding: 8mm 15mm 15mm 15mm;
    flex: 1;
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    flex: 1;
    display: flex;
    flex-direction: column;
    transform: scale(${scaleFactor});
    transform-origin: top center;
  }

  .header {
    text-align: center;
    margin-bottom: 3mm;
  }

  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2mm;
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
    background: #ffffff;
    padding: 0 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    position: relative;
  }

  .logo-container img {
    max-height: 16mm;
    max-width: 60mm;
    height: auto;
    width: auto;
    filter: ${logoFilter};
  }

  h1 {
    font-size: 7mm;
    font-weight: 900;
    text-align: center;
    margin: 2mm 0 3mm 0;
    letter-spacing: 0.5mm;
    color: #1b273b;
  }

  .status-badge {
    display: inline-block;
    background: #2d5f3f;
    color: white;
    padding: 1.5mm 4mm;
    border-radius: 2mm;
    font-size: 3.5mm;
    font-weight: 700;
    margin-bottom: ${sectionMargin};
  }

  .meta-section {
    display: flex;
    justify-content: space-between;
    margin-bottom: ${sectionMargin};
    gap: 10mm;
  }

  .meta-block {
    flex: 1;
  }

  .meta-block h3 {
    font-size: 3.5mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
    padding-bottom: 1mm;
    border-bottom: 2px solid ${headerBgColor};
    color: ${headerBgColor};
  }

  .meta-item {
    font-size: 3mm;
    margin-bottom: 1mm;
    line-height: 1.4;
  }

  .meta-item strong {
    font-weight: 600;
  }

  .welcome-message {
    display: ${welcomeDisplay};
    background: #f5f5f5;
    padding: 3mm;
    margin-bottom: ${sectionMargin};
    border-radius: 2mm;
    font-size: 3.2mm;
    font-style: italic;
    text-align: center;
    color: #444;
  }

  /* Property Details - inline вариант */
  .property-inline {
    background: #e8e5e1;
    padding: 2.5mm;
    margin-bottom: ${sectionMargin};
    border-radius: 2mm;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2mm 5mm;
    font-size: 3mm;
  }

  .property-inline h3 {
    font-size: 3.3mm;
    font-weight: 700;
    color: ${headerBgColor};
    margin-right: 2mm;
  }

  .property-inline .prop-name {
    font-weight: 600;
  }

  .property-inline .prop-item {
    display: flex;
    gap: 2mm;
  }

  .property-inline .prop-item .label {
    color: #666;
  }

  .property-inline .prop-item .value {
    font-weight: 600;
  }

  .property-inline .separator {
    color: #999;
  }

  .booking-details {
    display: flex;
    gap: 5mm;
    margin-bottom: ${sectionMargin};
  }

  .booking-box {
    flex: 1;
    background: #f5f5f5;
    padding: 3mm;
    border-radius: 2mm;
    text-align: center;
  }

  .booking-box .label {
    font-size: 2.8mm;
    color: #666;
    margin-bottom: 1mm;
  }

  .booking-box .value {
    font-size: 4mm;
    font-weight: 700;
    color: #1b273b;
  }

  .booking-box.highlight {
    background: ${headerBgColor};
    color: white;
  }

  .booking-box.highlight .label {
    color: rgba(255,255,255,0.8);
  }

  .booking-box.highlight .value {
    color: white;
  }

  .guests-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: ${sectionMargin};
    font-size: ${tableFontSize};
  }

  .guests-table th,
  .guests-table td {
    border: 1px solid #1b273b;
    padding: ${tablePadding};
    text-align: left;
  }

  .guests-table th {
    background: ${headerBgColor} !important;
    color: white !important;
    font-weight: 700;
  }

  .guests-table td.number {
    text-align: center;
    width: 8mm;
  }

  .services-section {
    display: flex;
    gap: 5mm;
    margin-bottom: ${sectionMargin};
  }

  .service-item {
    flex: 1;
    background: #f5f5f5;
    padding: 2mm 3mm;
    border-radius: 2mm;
    font-size: 3mm;
    display: flex;
    align-items: center;
    gap: 2mm;
  }

  .service-item .icon {
    width: 4mm;
    height: 4mm;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3mm;
  }

  .service-item .icon.yes {
    background: #2d5f3f;
    color: white;
  }

  .service-item .icon.no {
    background: #ccc;
    color: #666;
  }

  .notice-section {
    background: #fffbe6;
    border: 1px solid #faad14;
    padding: 3mm;
    margin-bottom: ${sectionMargin};
    border-radius: 2mm;
  }

  .notice-section h3 {
    font-size: 3.5mm;
    font-weight: 700;
    margin-bottom: 2mm;
    color: #d48806;
  }

  .notice-section .content {
    font-size: 3mm;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .cancellation-section {
    background: #fff2f0;
    border: 1px solid #ff4d4f;
    padding: 3mm;
    margin-bottom: ${sectionMargin};
    border-radius: 2mm;
  }

  .cancellation-section h3 {
    font-size: 3.5mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
    color: #cf1322;
  }

  .cancellation-section .content {
    font-size: 3mm;
    color: #cf1322;
  }

  .remarks-section {
    background: #f5f5f5;
    padding: 3mm;
    margin-bottom: ${sectionMargin};
    border-radius: 2mm;
  }

  .remarks-section h3 {
    font-size: 3.5mm;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  .remarks-section .content {
    font-size: 3mm;
    line-height: 1.4;
  }

  .page-footer {
    margin-top: auto;
    padding-top: 3mm;
    border-top: 1px solid #d0d0d0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .page-footer-left {
    display: flex;
    flex-direction: column;
    gap: 1mm;
  }

  .confirmation-number {
    font-size: 3mm;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
  }

  .confirmation-date {
    font-size: 2.5mm;
    color: #999;
  }

  .page-number {
    font-size: 3.5mm;
    font-weight: 300;
    color: #666;
  }

  strong {
    font-weight: 700;
  }
</style>
</head>
<body>
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
      
      <h1>RESERVATION CONFIRMATION</h1>
      
      <div style="text-align: center;">
        <span class="status-badge">✓ SUCCESS</span>
      </div>

      ${confirmation.welcome_message ? `
      <div class="welcome-message">
        ${confirmation.welcome_message}
      </div>
      ` : ''}

      <div class="meta-section">
        <div class="meta-block">
          <h3>CONFIRMATION DETAILS</h3>
          <div class="meta-item"><strong>Confirmation #:</strong> ${confirmation.confirmation_number}</div>
          <div class="meta-item"><strong>Date:</strong> ${formatDate(confirmation.confirmation_date)}</div>
          ${confirmation.agreement_number ? `<div class="meta-item"><strong>Agreement:</strong> ${confirmation.agreement_number}</div>` : ''}
        </div>
        <div class="meta-block">
          <h3>CONTACT</h3>
          ${confirmation.from_company_name ? `<div class="meta-item"><strong>Company:</strong> ${confirmation.from_company_name}</div>` : ''}
          ${confirmation.from_telephone ? `<div class="meta-item"><strong>Tel:</strong> ${confirmation.from_telephone}</div>` : ''}
          ${confirmation.from_email ? `<div class="meta-item"><strong>Email:</strong> ${confirmation.from_email}</div>` : ''}
        </div>
      </div>

      ${confirmation.property_name || confirmation.property_address ? `
      <div class="property-inline">
        <h3>Property:</h3>
        ${confirmation.property_name ? `<span class="prop-name">${confirmation.property_name}</span>` : ''}
        ${confirmation.property_name && confirmation.property_address ? `<span class="separator">|</span>` : ''}
        ${confirmation.property_address ? `
        <div class="prop-item">
          <span class="label">Address:</span>
          <span class="value">${confirmation.property_address}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="booking-details">
        <div class="booking-box">
          <div class="label">ARRIVAL</div>
          <div class="value">${formatDate(confirmation.arrival_date)}</div>
          <div class="label">${confirmation.arrival_time || '15:00'}</div>
        </div>
        <div class="booking-box">
          <div class="label">DEPARTURE</div>
          <div class="value">${formatDate(confirmation.departure_date)}</div>
          <div class="label">${confirmation.departure_time || '12:00'}</div>
        </div>
        <div class="booking-box highlight">
          <div class="label">${confirmation.rate_type === 'monthly' ? 'MONTHLY RATE' : 'DAILY RATE'}</div>
          <div class="value">${confirmation.rate_amount ? `${formatCurrency(confirmation.rate_amount)} THB` : 'N/A'}</div>
        </div>
      </div>

      <div class="booking-details">
        ${confirmation.room_type ? `
        <div class="booking-box">
          <div class="label">ROOM TYPE</div>
          <div class="value">${confirmation.room_type}</div>
        </div>
        ` : ''}
        ${confirmation.num_rooms ? `
        <div class="booking-box">
          <div class="label">ROOMS</div>
          <div class="value">${confirmation.num_rooms}</div>
        </div>
        ` : ''}
        ${confirmation.num_guests ? `
        <div class="booking-box">
          <div class="label">GUESTS</div>
          <div class="value">${confirmation.num_guests}</div>
        </div>
        ` : ''}
      </div>

      ${guests.length > 0 ? `
      <h3 style="font-size: 3.5mm; margin-bottom: 2mm; color: ${headerBgColor};">GUEST INFORMATION</h3>
      <table class="guests-table">
        <thead>
          <tr>
            <th class="number">#</th>
            <th>Guest Name</th>
            <th>Passport No.</th>
            <th>Country</th>
            <th>Phone</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          ${guestsHTML}
        </tbody>
      </table>
      ` : ''}

      <div class="services-section">
        <div class="service-item">
          <div class="icon ${confirmation.pick_up_service ? 'yes' : 'no'}">${confirmation.pick_up_service ? '✓' : '✗'}</div>
          <span><strong>Pick-up Service:</strong> ${confirmation.pick_up_service ? 'Yes' : 'No'}</span>
          ${confirmation.arrival_flight ? `<span style="margin-left: auto; color: #666;">Flight: ${confirmation.arrival_flight}</span>` : ''}
        </div>
        <div class="service-item">
          <div class="icon ${confirmation.drop_off_service ? 'yes' : 'no'}">${confirmation.drop_off_service ? '✓' : '✗'}</div>
          <span><strong>Drop-off Service:</strong> ${confirmation.drop_off_service ? 'Yes' : 'No'}</span>
          ${confirmation.departure_flight ? `<span style="margin-left: auto; color: #666;">Flight: ${confirmation.departure_flight}</span>` : ''}
        </div>
      </div>

      ${confirmation.notice_content ? `
      <div class="notice-section">
        <h3>⚠ IMPORTANT NOTICE</h3>
        <div class="content">${confirmation.notice_content}</div>
      </div>
      ` : ''}

      ${confirmation.cancellation_policy ? `
      <div class="cancellation-section">
        <h3>CANCELLATION POLICY</h3>
        <div class="content">${confirmation.cancellation_policy}</div>
      </div>
      ` : ''}

      ${confirmation.remarks ? `
      <div class="remarks-section">
        <h3>REMARKS</h3>
        <div class="content">${confirmation.remarks}</div>
      </div>
      ` : ''}

      <div class="page-footer">
        <div class="page-footer-left">
          <div class="confirmation-number">${confirmation.confirmation_number}</div>
          <div class="confirmation-date">Generated: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div class="page-number">Page 1 of 1</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
  }
}

export default new FinancialDocumentsController();