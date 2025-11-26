// backend/src/controllers/financialDocuments.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import QRCode from 'qrcode';
import { CreateInvoiceDTO, CreateReceiptDTO } from '../types/financialDocuments.types';

class FinancialDocumentsController {
  
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
      const countQuery = `SELECT COUNT(*) as total FROM invoices i ${whereClause}`;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем инвойсы
      const query = `
        SELECT 
          i.*,
          a.agreement_number,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM receipts WHERE invoice_id = i.id AND deleted_at IS NULL) as receipts_count
        FROM invoices i
        LEFT JOIN agreements a ON i.agreement_id = a.id
        LEFT JOIN admin_users u ON i.created_by = u.id
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

      const invoice = await db.queryOne(`
        SELECT 
          i.*,
          a.agreement_number,
          u.username as created_by_name
        FROM invoices i
        LEFT JOIN agreements a ON i.agreement_id = a.id
        LEFT JOIN admin_users u ON i.created_by = u.id
        WHERE i.id = ? AND i.deleted_at IS NULL
      `, [id]);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      // Получаем позиции инвойса
      const items = await db.query(
        'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
        [id]
      );

      // Получаем чеки для этого инвойса
      const receipts = await db.query(`
        SELECT 
          r.*,
          u.username as created_by_name
        FROM receipts r
        LEFT JOIN admin_users u ON r.created_by = u.id
        WHERE r.invoice_id = ? AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC
      `, [id]);

      res.json({
        success: true,
        data: {
          ...invoice,
          items,
          receipts
        }
      });
    } catch (error) {
      logger.error('Get invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения инвойса'
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
      const data: CreateInvoiceDTO = req.body;

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

      // Создаем инвойс
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
          bank_name, bank_account_name, bank_account_number,
          notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.bank_name || null,
        data.bank_account_name || null,
        data.bank_account_number || null,
        data.notes || null,
        'draft',
        userId
      ]);

      const invoiceId = (result as any)[0].insertId;

      // Создаем позиции инвойса
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        await connection.query(`
          INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [invoiceId, item.description, item.quantity, item.unit_price, item.total_price, i]);
      }

      // Генерируем QR-код для верификации
      try {
        const verifyUrl = `https://documents.novaestate.company/invoice/${invoiceUuid}`;
        const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
          width: 300,
          margin: 1
        });
        await connection.query(
          'UPDATE invoices SET qr_code_base64 = ? WHERE id = ?',
          [qrCodeBase64, invoiceId]
        );
      } catch (qrError) {
        logger.error('QR code generation failed:', qrError);
      }

      await db.commit(connection);

      // Генерируем PDF сразу после создания
      try {
        await this.generateInvoicePDF(invoiceId);
      } catch (pdfError) {
        logger.error('PDF generation failed:', pdfError);
        // Не прерываем процесс если PDF не сгенерировался
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
      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes || null);
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

        // Создаем новые позиции
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await connection.query(`
            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [id, item.description, item.quantity, item.unit_price, item.total_price, i]);
        }

        // Регенерируем PDF после обновления позиций
        fields.push('pdf_path = ?', 'pdf_generated_at = ?');
        values.push(null, null);
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE invoices SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      await db.commit(connection);

      // Регенерируем PDF после обновления
      try {
        await this.generateInvoicePDF(parseInt(id));
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
    try {
      const { id } = req.params;

      const invoice = await db.queryOne('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Инвойс не найден'
        });
        return;
      }

      await db.query('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [id]);

      logger.info(`Invoice deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Инвойс успешно удалён'
      });
    } catch (error) {
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
      const countQuery = `SELECT COUNT(*) as total FROM receipts r ${whereClause}`;
      const countResult = await db.queryOne<{ total: number }>(countQuery, queryParams);
      const total = countResult?.total || 0;

      // Получаем чеки
      const query = `
        SELECT 
          r.*,
          i.invoice_number,
          a.agreement_number,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM receipt_files WHERE receipt_id = r.id) as files_count
        FROM receipts r
        LEFT JOIN invoices i ON r.invoice_id = i.id
        LEFT JOIN agreements a ON r.agreement_id = a.id
        LEFT JOIN admin_users u ON r.created_by = u.id
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

      const receipt = await db.queryOne(`
        SELECT 
          r.*,
          i.invoice_number,
          a.agreement_number,
          u.username as created_by_name
        FROM receipts r
        LEFT JOIN invoices i ON r.invoice_id = i.id
        LEFT JOIN agreements a ON r.agreement_id = a.id
        LEFT JOIN admin_users u ON r.created_by = u.id
        WHERE r.id = ? AND r.deleted_at IS NULL
      `, [id]);

      if (!receipt) {
        res.status(404).json({
          success: false,
          message: 'Чек не найден'
        });
        return;
      }

      // Получаем файлы чека
      const files = await db.query(
        'SELECT * FROM receipt_files WHERE receipt_id = ? ORDER BY uploaded_at',
        [id]
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
      `, [id]);

      res.json({
        success: true,
        data: {
          ...receipt,
          files,
          items
        }
      });
    } catch (error) {
      logger.error('Get receipt error:', error);
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
      const data: CreateReceiptDTO = req.body;

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

      // Генерируем уникальный номер REC-2025-ABC0001
      const year = new Date().getFullYear();
      const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
      // Генерируем UUID
      const { v4: uuidv4 } = require('uuid');
      const receiptUuid = uuidv4();
      const countResult = await connection.query(
        'SELECT COUNT(*) as count FROM receipts WHERE receipt_number LIKE ?',
        [`REC-${year}-%`]
      );
      const count = (countResult[0] as any)[0].count + 1;
      const receipt_number = `REC-${year}-${randomPart}${count.toString().padStart(4, '0')}`;

      // Создаем чек
      const result = await connection.query(`
        INSERT INTO receipts (
          receipt_number, uuid, invoice_id, agreement_id, receipt_date,
          amount_paid, payment_method, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        receipt_number,
        receiptUuid,
        data.invoice_id,
        data.agreement_id || null,
        data.receipt_date,
        data.amount_paid,
        data.payment_method,
        data.notes || null,
        'verified',
        userId
      ]);

      const receiptId = (result as any)[0].insertId;

      // Сохраняем привязку к позициям инвойса
      if (data.selected_items && data.selected_items.length > 0) {
        for (const itemId of data.selected_items) {
          await connection.query(`
            INSERT INTO receipt_invoice_items (receipt_id, invoice_item_id, amount_allocated)
            VALUES (?, ?, ?)
          `, [receiptId, itemId, 0]); // amount_allocated можно уточнить позже
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

      // Генерируем QR-код для верификации
      try {
        const verifyUrl = `https://documents.novaestate.company/receipt/${receiptUuid}`;
        const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
          width: 300,
          margin: 1
        });
        await connection.query(
          'UPDATE receipts SET qr_code_base64 = ? WHERE id = ?',
          [qrCodeBase64, receiptId]
        );
      } catch (qrError) {
        logger.error('QR code generation failed:', qrError);
      }

      await db.commit(connection);

      // Генерируем PDF сразу после создания
      try {
        await this.generateReceiptPDF(receiptId);
      } catch (pdfError) {
        logger.error('PDF generation failed:', pdfError);
        // Не прерываем процесс если PDF не сгенерировался
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

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE receipts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      // Обновляем привязки к позициям инвойса если переданы
      if (data.selected_items) {
        await connection.query('DELETE FROM receipt_invoice_items WHERE receipt_id = ?', [id]);
        
        for (const itemId of data.selected_items) {
          await connection.query(`
            INSERT INTO receipt_invoice_items (receipt_id, invoice_item_id, amount_allocated)
            VALUES (?, ?, ?)
          `, [id, itemId, 0]);
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
/**
 * Получить HTML версию инвойса для генерации PDF
 * GET /api/financial-documents/invoices/:id/html
 */
async getInvoiceHTML(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { internalKey } = req.query;

    // Проверяем внутренний ключ для Puppeteer
    const expectedKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    if (internalKey !== expectedKey) {
      res.status(403).send('Доступ запрещен');
      return;
    }

    // Получаем инвойс с позициями
    const invoice = await db.queryOne(`
      SELECT i.* FROM invoices i WHERE i.id = ? AND i.deleted_at IS NULL
    `, [id]);

    if (!invoice) {
      res.status(404).send('Invoice not found');
      return;
    }

    // Получаем позиции
    const items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id',
      [id]
    );

    // Получаем данные договора если есть
    let agreementData = null;
    if (invoice.agreement_id) {
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
      `, [invoice.agreement_id]);
    }

    // Генерируем HTML
    const html = this.generateInvoiceHTML(invoice, items, agreementData);
    
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

    // Получаем чек
    const receipt = await db.queryOne(`
      SELECT 
        r.*,
        i.invoice_number
      FROM receipts r
      LEFT JOIN invoices i ON r.invoice_id = i.id
      WHERE r.id = ? AND r.deleted_at IS NULL
    `, [id]);

    if (!receipt) {
      res.status(404).send('Receipt not found');
      return;
    }

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
    if (receipt.agreement_id) {
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
      `, [receipt.agreement_id]);
    }

    // Генерируем HTML
    const html = this.generateReceiptHTML(receipt, items, files, agreementData);
    
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

    if (!invoice.pdf_path) {
      // Генерируем PDF если еще не сгенерирован
      await this.generateInvoicePDF(parseInt(id));
      
      const updatedInvoice = await db.queryOne<any>(
        'SELECT pdf_path FROM invoices WHERE id = ?',
        [id]
      );
      
      invoice.pdf_path = updatedInvoice.pdf_path;
    }

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
private async generateInvoicePDF(invoiceId: number): Promise<void> {
  try {
    const PDFService = require('../services/pdf.service').PDFService;
    const pdfPath = await PDFService.generateInvoicePDF(invoiceId);
    
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
/**
 * Генерация HTML для инвойса
 */
private generateInvoiceHTML(invoice: any, items: any[], agreementData: any): string {
  const logoUrl = 'https://admin.novaestate.company/nova-logo.svg';
  
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
      background: #f9f6f3;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 210mm;
      height: 297mm;
      background: #f9f6f3;
      padding: 10mm;
      position: relative;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .page-inner {
      width: 190mm;
      height: 277mm;
      background: #f9f6f3;
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
      background: #f9f6f3;
      padding: 0 5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      position: relative;
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

    .items-table th {
      background: #5d666e !important;
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
            ${items.map((item, index) => `
              <tr>
                <td class="number">${index + 1}</td>
                <td>${item.description}</td>
                <td class="qty">${item.quantity}</td>
                <td class="price">${formatCurrency(item.unit_price)} ${invoice.currency}</td>
                <td class="price">${formatCurrency(item.total_price)} ${invoice.currency}</td>
              </tr>
            `).join('')}
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
        </div>

        ${(invoice.bank_name || invoice.bank_account_name || invoice.bank_account_number) ? `
        <div class="bank-details">
          <h3>BANK DETAILS FOR PAYMENT:</h3>
          ${invoice.bank_name ? `<div><strong>Bank:</strong> ${invoice.bank_name}</div>` : ''}
          ${invoice.bank_account_name ? `<div><strong>Account Name:</strong> ${invoice.bank_account_name}</div>` : ''}
          ${invoice.bank_account_number ? `<div><strong>Account Number:</strong> ${invoice.bank_account_number}</div>` : ''}
        </div>
        ` : ''}
      </div>

      ${invoice.qr_code_base64 ? `
      <div class="qr-section">
        <img src="${invoice.qr_code_base64}" alt="QR Code" />
      </div>
      ` : ''}

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
private generateReceiptHTML(receipt: any, items: any[], files: any[], agreementData: any): string {
  const logoUrl = 'https://admin.novaestate.company/nova-logo.svg';
  
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
      background: #f9f6f3;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 210mm;
      height: 297mm;
      background: #f9f6f3;
      padding: 10mm;
      position: relative;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .page-inner {
      width: 190mm;
      height: 277mm;
      background: #f9f6f3;
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
      background: #f9f6f3;
      padding: 0 5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      position: relative;
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

      ${receipt.qr_code_base64 ? `
      <div class="qr-section">
        <img src="${receipt.qr_code_base64}" alt="QR Code" />
      </div>
      ` : ''}

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
}

export default new FinancialDocumentsController();