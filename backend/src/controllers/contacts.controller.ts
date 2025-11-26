import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class ContactsController {
  /**
   * Получить все сохраненные контакты с документами
   * GET /api/contacts
   */
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const contacts = await db.query(`
        SELECT * FROM agreement_saved_contacts
        ORDER BY 
          type ASC,
          COALESCE(name, company_name) ASC
      `);

      // Для каждого контакта загружаем документы
      for (const contact of contacts as any[]) {
        const documents = await db.query(
          'SELECT id, document_base64, mime_type, file_size FROM agreement_saved_contact_documents WHERE contact_id = ?',
          [contact.id]
        );
        contact.documents = documents;
      }

      res.json({
        success: true,
        data: contacts
      });
    } catch (error) {
      logger.error('Get contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения контактов'
      });
    }
  }

/**
 * Создать новый контакт с документами
 * POST /api/contacts
 */
async create(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();
  
  try {
    const {
      type,
      name,
      passport_country,
      passport_number,
      company_name,
      company_address,
      company_tax_id,
      director_name,
      director_passport,
      director_country,
      documents
    } = req.body;

    console.log('📝 Creating contact with data:', {
      type,
      name,
      company_name,
      passport_number,
      company_tax_id,
      documentsCount: documents?.length || 0
    });

    const userId = req.admin!.id;

    // ✅ ИСПРАВЛЕННАЯ ПРОВЕРКА СУЩЕСТВОВАНИЯ
    let existingRows: any;
    
    if (type === 'individual') {
      existingRows = await connection.query(
        'SELECT id FROM agreement_saved_contacts WHERE type = ? AND name = ? AND passport_number = ?',
        [type, name, passport_number]
      );
    } else {
      existingRows = await connection.query(
        'SELECT id FROM agreement_saved_contacts WHERE type = ? AND company_name = ? AND company_tax_id = ?',
        [type, company_name, company_tax_id]
      );
    }
    
    console.log('🔍 Existing rows result:', existingRows);
    
    // ✅ Правильная проверка на существование
    const existingArray = Array.isArray(existingRows[0]) ? existingRows[0] : existingRows;
    
    if (existingArray && existingArray.length > 0) {
      await db.rollback(connection);
      console.log('ℹ️ Contact already exists with ID:', existingArray[0].id);
      res.json({
        success: true,
        message: 'Контакт уже существует',
        data: existingArray[0]
      });
      return;
    }

    console.log('✅ Contact does not exist, creating new...');

    // Создаем новый контакт
    const result = await connection.query(`
      INSERT INTO agreement_saved_contacts (
        type, name, passport_country, passport_number,
        company_name, company_address, company_tax_id,
        director_name, director_passport, director_country,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      type,
      name || null,
      passport_country || null,
      passport_number || null,
      company_name || null,
      company_address || null,
      company_tax_id || null,
      director_name || null,
      director_passport || null,
      director_country || null,
      userId
    ]);

    const contactId = (result as any)[0].insertId;
    console.log('✅ Contact created with ID:', contactId);

    // ✅ Сохраняем документы если есть
    if (documents && Array.isArray(documents) && documents.length > 0) {
      console.log(`📎 Saving ${documents.length} documents...`);
      
      for (const doc of documents) {
        if (doc.document_base64) {
          const base64Length = doc.document_base64.length;
          console.log('💾 Saving document, base64 length:', base64Length, 'bytes');
          
          await connection.query(`
            INSERT INTO agreement_saved_contact_documents (
              contact_id, document_base64, mime_type, file_size
            ) VALUES (?, ?, ?, ?)
          `, [
            contactId,
            doc.document_base64,
            doc.mime_type || null,
            doc.file_size || null
          ]);
          
          console.log('✅ Document saved successfully');
        } else {
          console.log('⚠️ Document has no base64 data');
        }
      }
      console.log(`✅ Saved ${documents.length} documents for contact ${contactId}`);
    } else {
      console.log('ℹ️ No documents to save');
    }

    await db.commit(connection);

    logger.info(`Contact created: ${contactId} by user ${req.admin?.username}`);

    res.status(201).json({
      success: true,
      message: 'Контакт успешно сохранен',
      data: { id: contactId }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Create contact error:', error);
    console.error('❌ Create contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания контакта'
    });
  }
}

  /**
   * Удалить контакт (документы удалятся автоматически через CASCADE)
   * DELETE /api/contacts/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.query('DELETE FROM agreement_saved_contacts WHERE id = ?', [id]);

      logger.info(`Contact deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Контакт успешно удален'
      });
    } catch (error) {
      logger.error('Delete contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления контакта'
      });
    }
  }
}

export default new ContactsController();