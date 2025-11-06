// backend/src/controllers/agreementSignatures.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class AgreementSignaturesController {
  /**
   * Получить информацию о подписи по ссылке (публичный эндпоинт)
   * GET /api/agreement-signatures/link/:link
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
          a.public_link,
          a.qr_code_path,
          pt.property_name,
          p.property_number
        FROM agreement_signatures s
        JOIN agreements a ON s.agreement_id = a.id
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = 'en'
        WHERE s.signature_link = ? AND s.is_signed = FALSE
      `, [link]);

      if (!signature) {
        res.status(404).json({
          success: false,
          message: 'Ссылка для подписи не найдена или уже использована'
        });
        return;
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
   * POST /api/agreement-signatures/sign/:link
   */
  async sign(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { link } = req.params;
      const { signature_data } = req.body;
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

      // Обновляем подпись
      await connection.query(`
        UPDATE agreement_signatures 
        SET signature_data = ?, is_signed = TRUE, signed_at = NOW(), ip_address = ?
        WHERE id = ?
      `, [signature_data, ip_address, signature.id]);

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
        `Подписано: ${signature.signer_name} (${signature.signer_role})`
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
   * DELETE /api/agreement-signatures/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const signature = await db.queryOne<any>(
        'SELECT * FROM agreement_signatures WHERE id = ?',
        [id]
      );

      if (!signature) {
        res.status(404).json({
          success: false,
          message: 'Подпись не найдена'
        });
        return;
      }

      if (signature.is_signed) {
        res.status(400).json({
          success: false,
          message: 'Нельзя удалить уже использованную подпись'
        });
        return;
      }

      await db.query('DELETE FROM agreement_signatures WHERE id = ?', [id]);

      logger.info(`Agreement signature deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Подпись успешно удалена'
      });
    } catch (error) {
      logger.error('Delete signature error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления подписи'
      });
    }
  }
}

export default new AgreementSignaturesController();