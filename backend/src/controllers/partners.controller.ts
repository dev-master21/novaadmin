// backend/src/controllers/partners.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface Partner {
  id: number;
  partner_name: string | null;
  domain: string | null;
  logo_filename: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

// ✅ Извлечение основного домена
function extractRootDomain(hostname: string): string {
  const cleanHostname = hostname.replace(/^www\./, '');
  
  if (cleanHostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHostname)) {
    return cleanHostname;
  }
  
  const parts = cleanHostname.split('.');
  
  if (parts.length <= 2) {
    return cleanHostname;
  }
  
  const rootDomain = parts.slice(-2).join('.');
  
  logger.info(`Extracted root domain: ${hostname} -> ${rootDomain}`);
  
  return rootDomain;
}

// ✅ ОБНОВЛЕНО: Конфигурация multer для загрузки в frontend/public
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // ✅ ПУТЬ К FRONTEND PUBLIC
    const uploadDir = path.join(__dirname, '../../../frontend/public');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    logger.info(`Upload directory: ${uploadDir}`);
    cb(null, uploadDir);
  },
  filename: (req, _file, cb) => {
    const partnerName = req.body.partner_name || Date.now().toString();
    const sanitizedName = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `${sanitizedName}.svg`;
    cb(null, filename);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
    cb(null, true);
  } else {
    cb(new Error('Только .svg файлы разрешены'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

class PartnersController {
  /**
   * Получить всех партнёров
   * GET /api/partners
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.admin?.is_super_admin) {
        res.status(403).json({
          success: false,
          message: 'Доступ запрещён. Требуются права SuperAdmin'
        });
        return;
      }

      const partners = await db.query<Partner>(
        `SELECT * FROM partners ORDER BY created_at DESC`
      );

      logger.info(`Partners list retrieved by ${req.admin.username}`);

      res.json({
        success: true,
        data: partners
      });
    } catch (error) {
      logger.error('Get partners error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка партнёров'
      });
    }
  }

  /**
   * Получить партнёра по ID
   * GET /api/partners/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.admin?.is_super_admin) {
        res.status(403).json({
          success: false,
          message: 'Доступ запрещён'
        });
        return;
      }

      const partner = await db.queryOne<Partner>(
        'SELECT * FROM partners WHERE id = ?',
        [id]
      );

      if (!partner) {
        res.status(404).json({
          success: false,
          message: 'Партнёр не найден'
        });
        return;
      }

      res.json({
        success: true,
        data: partner
      });
    } catch (error) {
      logger.error('Get partner error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения партнёра'
      });
    }
  }

  /**
   * Получить партнёра по домену (публичный endpoint)
   * GET /api/partners/by-domain/:domain
   */
  async getByDomain(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { domain } = req.params;

      logger.info(`Getting partner for domain: ${domain}`);

      const rootDomain = extractRootDomain(domain);
      logger.info(`Root domain extracted: ${rootDomain}`);

      const partner = await db.queryOne<Partner>(
        'SELECT * FROM partners WHERE domain = ? AND is_active = 1',
        [rootDomain]
      );

      if (!partner) {
        logger.info(`No partner found for domain: ${rootDomain}, using default logo`);
        res.json({
          success: true,
          data: {
            logo_filename: 'logo.svg'
          }
        });
        return;
      }

      logger.info(`Partner found for domain ${rootDomain}: ${partner.partner_name}`);

      res.json({
        success: true,
        data: {
          logo_filename: partner.logo_filename || 'logo.svg'
        }
      });
    } catch (error) {
      logger.error('Get partner by domain error:', error);
      res.json({
        success: true,
        data: {
          logo_filename: 'logo.svg'
        }
      });
    }
  }

  /**
   * Создать партнёра
   * POST /api/partners
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      if (!req.admin?.is_super_admin) {
        await db.rollback(connection);
        res.status(403).json({
          success: false,
          message: 'Доступ запрещён'
        });
        return;
      }

      const { partner_name, domain, is_active } = req.body;
      const userId = req.admin.id;

      const logo_filename = req.file ? req.file.filename : null;
      const cleanDomain = domain ? extractRootDomain(domain) : null;

      // ✅ НОВОЕ: Копируем файл также в frontend/dist если он существует
      if (req.file) {
        const distDir = path.join(__dirname, '../../../frontend/dist');
        if (fs.existsSync(distDir)) {
          const sourceFile = path.join(__dirname, '../../../frontend/public', req.file.filename);
          const destFile = path.join(distDir, req.file.filename);
          
          try {
            fs.copyFileSync(sourceFile, destFile);
            logger.info(`Logo copied to dist: ${req.file.filename}`);
          } catch (error) {
            logger.warn(`Failed to copy logo to dist:`, error);
            // Не критичная ошибка, продолжаем
          }
        }
      }

      const result = await connection.query(
        `INSERT INTO partners (partner_name, domain, logo_filename, is_active, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          partner_name || null,
          cleanDomain,
          logo_filename,
          is_active !== undefined ? is_active : 1,
          userId
        ]
      );

      await db.commit(connection);

      const partnerId = (result as any)[0].insertId;

      logger.info(`Partner created: ${partner_name} (${cleanDomain}) by ${req.admin.username}`);

      res.status(201).json({
        success: true,
        message: 'Партнёр успешно создан',
        data: { id: partnerId, logo_filename }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create partner error:', error);
      
      // ✅ ОБНОВЛЕНО: Удаляем из обеих директорий
      if (req.file) {
        const publicPath = path.join(__dirname, '../../../frontend/public', req.file.filename);
        const distPath = path.join(__dirname, '../../../frontend/dist', req.file.filename);
        
        [publicPath, distPath].forEach(filePath => {
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              logger.warn(`Failed to delete file: ${filePath}`, e);
            }
          }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка создания партнёра'
      });
    }
  }

  /**
   * Обновить партнёра
   * PUT /api/partners/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;

      if (!req.admin?.is_super_admin) {
        await db.rollback(connection);
        res.status(403).json({
          success: false,
          message: 'Доступ запрещён'
        });
        return;
      }

      const { partner_name, domain, is_active } = req.body;

      const existingPartner = await db.queryOne<Partner>(
        'SELECT * FROM partners WHERE id = ?',
        [id]
      );

      if (!existingPartner) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Партнёр не найден'
        });
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (partner_name !== undefined) {
        fields.push('partner_name = ?');
        values.push(partner_name || null);
      }

      if (domain !== undefined) {
        const cleanDomain = domain ? extractRootDomain(domain) : null;
        fields.push('domain = ?');
        values.push(cleanDomain);
      }

      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (req.file) {
        // ✅ ОБНОВЛЕНО: Удаляем старый логотип из обеих директорий
        if (existingPartner.logo_filename && existingPartner.logo_filename !== 'logo.svg') {
          const publicPath = path.join(__dirname, '../../../frontend/public', existingPartner.logo_filename);
          const distPath = path.join(__dirname, '../../../frontend/dist', existingPartner.logo_filename);
          
          [publicPath, distPath].forEach(filePath => {
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (e) {
                logger.warn(`Failed to delete old file: ${filePath}`, e);
              }
            }
          });
        }

        // ✅ НОВОЕ: Копируем новый файл в dist
        const distDir = path.join(__dirname, '../../../frontend/dist');
        if (fs.existsSync(distDir)) {
          const sourceFile = path.join(__dirname, '../../../frontend/public', req.file.filename);
          const destFile = path.join(distDir, req.file.filename);
          
          try {
            fs.copyFileSync(sourceFile, destFile);
            logger.info(`Logo copied to dist: ${req.file.filename}`);
          } catch (error) {
            logger.warn(`Failed to copy logo to dist:`, error);
          }
        }

        fields.push('logo_filename = ?');
        values.push(req.file.filename);
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE partners SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }

      await db.commit(connection);

      logger.info(`Partner updated: ${id} by ${req.admin.username}`);

      res.json({
        success: true,
        message: 'Партнёр успешно обновлён',
        data: { logo_filename: req.file?.filename }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update partner error:', error);

      // ✅ ОБНОВЛЕНО: Удаляем из обеих директорий при ошибке
      if (req.file) {
        const publicPath = path.join(__dirname, '../../../frontend/public', req.file.filename);
        const distPath = path.join(__dirname, '../../../frontend/dist', req.file.filename);
        
        [publicPath, distPath].forEach(filePath => {
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              logger.warn(`Failed to delete file: ${filePath}`, e);
            }
          }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка обновления партнёра'
      });
    }
  }

  /**
   * Удалить партнёра
   * DELETE /api/partners/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.admin?.is_super_admin) {
        res.status(403).json({
          success: false,
          message: 'Доступ запрещён'
        });
        return;
      }

      const partner = await db.queryOne<Partner>(
        'SELECT * FROM partners WHERE id = ?',
        [id]
      );

      if (!partner) {
        res.status(404).json({
          success: false,
          message: 'Партнёр не найден'
        });
        return;
      }

      // ✅ ОБНОВЛЕНО: Удаляем логотип из обеих директорий
      if (partner.logo_filename && partner.logo_filename !== 'logo.svg') {
        const publicPath = path.join(__dirname, '../../../frontend/public', partner.logo_filename);
        const distPath = path.join(__dirname, '../../../frontend/dist', partner.logo_filename);
        
        [publicPath, distPath].forEach(filePath => {
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              logger.info(`Deleted logo: ${filePath}`);
            } catch (e) {
              logger.warn(`Failed to delete file: ${filePath}`, e);
            }
          }
        });
      }

      await db.query('DELETE FROM partners WHERE id = ?', [id]);

      logger.info(`Partner deleted: ${id} by ${req.admin.username}`);

      res.json({
        success: true,
        message: 'Партнёр успешно удалён'
      });
    } catch (error) {
      logger.error('Delete partner error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления партнёра'
      });
    }
  }
}

export default new PartnersController();