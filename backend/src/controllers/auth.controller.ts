// backend/src/controllers/auth.controller.ts
import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../types';
import db from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import logger from '../utils/logger';

class AuthController {
  // Вход в систему
  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      // Поиск пользователя
      const users = await db.query<any>(
        'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
        [username]
      );

      if (!users || users.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Неверное имя пользователя или пароль'
        });
        return;
      }

      const user = users[0];

      // Проверка пароля
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Неверное имя пользователя или пароль'
        });
        return;
      }

      // Получаем роли пользователя
      const roles = await db.query<any>(
        `SELECT r.id, r.role_name, r.description
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [user.id]
      );

      // Получаем права для каждой роли
      for (const role of roles) {
        const permissions = await db.query<any>(
          `SELECT p.id, p.permission_name, p.module, p.description
           FROM permissions p
           INNER JOIN role_permissions rp ON p.id = rp.permission_id
           WHERE rp.role_id = ?
           ORDER BY p.module, p.permission_name`,
          [role.id]
        );
        role.permissions = permissions;
      }

      // Генерация токенов
      const tokenPayload = {
        id: user.id,
        username: user.username,
        is_super_admin: user.is_super_admin
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Сохраняем refresh token в БД
      await db.query(
        'INSERT INTO admin_refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [user.id, refreshToken]
      );

      // Обновляем время последнего входа
      await db.query(
        'UPDATE admin_users SET last_login_at = NOW() WHERE id = ?',
        [user.id]
      );

      logger.info(`User logged in: ${username}`);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            is_active: user.is_active,
            is_super_admin: user.is_super_admin,
            roles: roles
          },
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка входа в систему'
      });
    }
  }

  // Выход из системы
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await db.query(
          'DELETE FROM admin_refresh_tokens WHERE token = ?',
          [refreshToken]
        );
      }

      logger.info(`User logged out: ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Выход выполнен успешно'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка выхода из системы'
      });
    }
  }

// Обновление access token
async refresh(req: AuthRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn('Refresh attempt without token');
      res.status(400).json({
        success: false,
        message: 'Refresh token не предоставлен'
      });
      return;
    }

    logger.info('Refresh token request started');

    // ✅ ОПТИМИЗАЦИЯ: Объединяем 2 запроса в 1
    const result = await db.query<any>(
      `SELECT 
        rt.*,
        u.id as user_id,
        u.username,
        u.is_super_admin,
        u.is_active
      FROM admin_refresh_tokens rt
      INNER JOIN admin_users u ON u.id = rt.user_id
      WHERE rt.token = ? 
        AND rt.expires_at > NOW()
        AND u.is_active = TRUE
      LIMIT 1`,
      [refreshToken]
    );

    if (!result || result.length === 0) {
      logger.warn('Invalid or expired refresh token');
      
      // ✅ Очищаем просроченные токены этого пользователя
      await db.query(
        'DELETE FROM admin_refresh_tokens WHERE token = ? OR expires_at <= NOW()',
        [refreshToken]
      );
      
      res.status(401).json({
        success: false,
        message: 'Недействительный refresh token'
      });
      return;
    }

    const userData = result[0];

    // Генерация нового access token
    const tokenPayload = {
      id: userData.user_id,
      username: userData.username,
      is_super_admin: userData.is_super_admin
    };

    const accessToken = generateAccessToken(tokenPayload);

    const duration = Date.now() - startTime;
    logger.info(`Refresh token successful for user ${userData.username} (${duration}ms)`);

    res.json({
      success: true,
      data: { accessToken }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Token refresh error (${duration}ms):`, error);
    
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления токена'
    });
  }
}

  // Получить текущего пользователя
  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        res.status(401).json({
          success: false,
          message: 'Не авторизован'
        });
        return;
      }

      // Получаем роли пользователя
      const roles = await db.query<any>(
        `SELECT r.id, r.role_name, r.description
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [req.admin.id]
      );

      // Получаем права для каждой роли
      for (const role of roles) {
        const permissions = await db.query<any>(
          `SELECT p.id, p.permission_name, p.module, p.description
           FROM permissions p
           INNER JOIN role_permissions rp ON p.id = rp.permission_id
           WHERE rp.role_id = ?
           ORDER BY p.module, p.permission_name`,
          [role.id]
        );
        role.permissions = permissions;
      }

      res.json({
        success: true,
        data: {
          id: req.admin.id,
          username: req.admin.username,
          full_name: req.admin.full_name,
          email: req.admin.email,
          is_active: req.admin.is_active,
          is_super_admin: req.admin.is_super_admin,
          roles: roles
        }
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения данных пользователя'
      });
    }
  }
}

export default new AuthController();