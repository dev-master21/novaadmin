// backend/src/controllers/agreementSignatures.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class AgreementSignaturesController {
/**
 * Получить информацию о подписи по ссылке (публичный эндпоинт)
 * GET /api/agreements/signatures/link/:link
 */
async getByLink(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { link } = req.params;

    const signature = await db.queryOne(`
      SELECT 
        s.*,
        a.agreement_number,
        a.content as agreement_content,
        a.structure as agreement_structure,
        a.type as agreement_type,
        a.city as agreement_city,
        a.date_from,
        a.date_to,
        a.rent_amount_monthly,
        a.rent_amount_total,
        a.deposit_amount,
        a.utilities_included,
        a.public_link,
        a.qr_code_path,
        pt.property_name,
        p.property_number
      FROM agreement_signatures s
      JOIN agreements a ON s.agreement_id = a.id
      LEFT JOIN properties p ON a.property_id = p.id
      LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
      WHERE s.signature_link = ?
    `, [link]);

    if (!signature) {
      res.status(404).json({
        success: false,
        message: 'Ссылка для подписи не найдена или больше не действительна'
      });
      return;
    }

    // Если первый визит - сохраняем информацию
    if (!(signature as any).first_visit_at) {
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
      
      // Парсим user agent
      const UAParser = require('ua-parser-js');
      const parser = new UAParser(userAgent);
      const uaResult = parser.getResult();
      
      await db.query(`
        UPDATE agreement_signatures 
        SET first_visit_at = NOW(),
            ip_address = ?,
            user_agent = ?,
            device_type = ?,
            browser = ?,
            os = ?
        WHERE id = ?
      `, [
        ipAddress,
        userAgent,
        uaResult.device.type || 'desktop',
        `${uaResult.browser.name || 'Unknown'} ${uaResult.browser.version || ''}`,
        `${uaResult.os.name || 'Unknown'} ${uaResult.os.version || ''}`,
        (signature as any).id
      ]);
    }

    res.json({
      success: true,
      data: signature
    });
  } catch (error) {
    logger.error('Get signature by link error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения информации о подписи'
    });
  }
}

/**
 * Подписать договор (публичный эндпоинт)
 * POST /api/agreements/signatures/sign/:link
 */
async sign(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { link } = req.params;
    const { 
      signature_data, 
      agreement_view_duration, 
      signature_clear_count,
      total_session_duration 
    } = req.body;
    
    const ip_address = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!signature_data) {
      await db.rollback(connection);
      res.status(400).json({
        success: false,
        message: 'Данные подписи отсутствуют'
      });
      return;
    }

    // Проверяем подпись
    const signature = await db.queryOne<any>(
      'SELECT * FROM agreement_signatures WHERE signature_link = ?',
      [link]
    );

    if (!signature) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Подпись не найдена'
      });
      return;
    }

    if (signature.is_signed) {
      await db.rollback(connection);
      res.status(400).json({
        success: false,
        message: 'Договор уже подписан'
      });
      return;
    }

    // Обновляем подпись с полной аналитикой
    await connection.query(`
      UPDATE agreement_signatures 
      SET signature_data = ?, 
          is_signed = TRUE, 
          signed_at = NOW(), 
          ip_address = ?,
          agreement_view_duration = ?,
          signature_clear_count = ?,
          total_session_duration = ?
      WHERE id = ?
    `, [
      signature_data, 
      ip_address, 
      agreement_view_duration || 0,
      signature_clear_count || 0,
      total_session_duration || 0,
      signature.id
    ]);

    // Проверяем все ли подписали
    const allSignatures = await db.query<any>(
      'SELECT * FROM agreement_signatures WHERE agreement_id = ?',
      [signature.agreement_id]
    );

    const allSigned = allSignatures.every((s: any) => s.is_signed);

    // Если все подписали - меняем статус договора
    if (allSigned) {
      await connection.query(
        'UPDATE agreements SET status = ? WHERE id = ?',
        ['signed', signature.agreement_id]
      );
    }

    // Логируем
    await connection.query(`
      INSERT INTO agreement_logs (agreement_id, action, description, user_id)
      VALUES (?, ?, ?, NULL)
    `, [
      signature.agreement_id,
      'signed',
      `Подписано: ${signature.signer_name} (${signature.signer_role}) | Устройство: ${signature.device_type} | Браузер: ${signature.browser}`
    ]);

    await db.commit(connection);

    logger.info(`Agreement signed: ${signature.agreement_id} by ${signature.signer_name}`);

    res.json({
      success: true,
      message: 'Договор успешно подписан',
      data: { all_signed: allSigned }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Sign agreement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка подписания договора'
    });
  }
}

/**
 * Удалить подпись
 */
async delete(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { id } = req.params;

    const signature = await db.queryOne<any>(
      'SELECT * FROM agreement_signatures WHERE id = ?',
      [id]
    );

    if (!signature) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Подпись не найдена'
      });
      return;
    }

    await connection.query('DELETE FROM agreement_signatures WHERE id = ?', [id]);

    // Логируем
    await connection.query(`
      INSERT INTO agreement_logs (agreement_id, action, description, user_id)
      VALUES (?, ?, ?, ?)
    `, [
      signature.agreement_id,
      'signature_deleted',
      `Подпись удалена: ${signature.signer_name} (${signature.signer_role})`,
      req.admin!.id
    ]);

    // Если все подписи удалены, возвращаем статус договора
    const remainingSignatures = await db.query(
      'SELECT COUNT(*) as count FROM agreement_signatures WHERE agreement_id = ?',
      [signature.agreement_id]
    );

    if ((remainingSignatures as any)[0].count === 0) {
      await connection.query(
        'UPDATE agreements SET status = ? WHERE id = ?',
        ['draft', signature.agreement_id]
      );
    }

    await db.commit(connection);

    logger.info(`Agreement signature deleted: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Подпись успешно удалена'
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Delete signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления подписи'
    });
  }
}
  /**
 * Обновить подпись (имя, роль)
 * PUT /api/agreements/signatures/:id
 */
async update(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { id } = req.params;
    const { signer_name, signer_role } = req.body;

    const signature = await db.queryOne<any>(
      'SELECT * FROM agreement_signatures WHERE id = ?',
      [id]
    );

    if (!signature) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Подпись не найдена'
      });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (signer_name !== undefined) {
      fields.push('signer_name = ?');
      values.push(signer_name);
    }

    if (signer_role !== undefined) {
      fields.push('signer_role = ?');
      values.push(signer_role);
    }

    if (fields.length > 0) {
      values.push(id);
      await connection.query(
        `UPDATE agreement_signatures SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // Логируем
      await connection.query(`
        INSERT INTO agreement_logs (agreement_id, action, description, user_id)
        VALUES (?, ?, ?, ?)
      `, [
        signature.agreement_id,
        'signature_updated',
        `Подпись обновлена: ${signer_name || signature.signer_name}`,
        req.admin!.id
      ]);
    }

    await db.commit(connection);

    logger.info(`Signature updated: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Подпись успешно обновлена'
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Update signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления подписи'
    });
  }
}

/**
 * Перегенерировать ссылку для подписи
 * POST /api/agreements/signatures/:id/regenerate
 */
async regenerateLink(req: AuthRequest, res: Response): Promise<void> {
  const connection = await db.beginTransaction();

  try {
    const { id } = req.params;

    const signature = await db.queryOne<any>(
      'SELECT * FROM agreement_signatures WHERE id = ?',
      [id]
    );

    if (!signature) {
      await db.rollback(connection);
      res.status(404).json({
        success: false,
        message: 'Подпись не найдена'
      });
      return;
    }

    // Генерируем новую ссылку
    const { v4: uuidv4 } = require('uuid');
    const uniqueLink = uuidv4();

    await connection.query(
      'UPDATE agreement_signatures SET signature_link = ? WHERE id = ?',
      [uniqueLink, id]
    );

    // Логируем
    await connection.query(`
      INSERT INTO agreement_logs (agreement_id, action, description, user_id)
      VALUES (?, ?, ?, ?)
    `, [
      signature.agreement_id,
      'signature_link_regenerated',
      `Ссылка перегенерирована для: ${signature.signer_name}`,
      req.admin!.id
    ]);

    await db.commit(connection);

    logger.info(`Signature link regenerated: ${id} by user ${req.admin?.username}`);

    res.json({
      success: true,
      message: 'Ссылка успешно перегенерирована',
      data: {
        signature_link: uniqueLink,
        public_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sign/${uniqueLink}`
      }
    });
  } catch (error) {
    await db.rollback(connection);
    logger.error('Regenerate signature link error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка перегенерации ссылки'
    });
  }
}
}

export default new AgreementSignaturesController();