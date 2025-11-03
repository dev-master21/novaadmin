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

      // Получаем роли и права пользователя
      const roles = await db.query<any>(
        `SELECT r.role_name 
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [user.id]
      );

      const permissions = await db.query<any>(
        `SELECT DISTINCT p.permission_name
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = ?`,
        [user.id]
      );

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
            is_super_admin: user.is_super_admin,
            roles: roles.map((r: any) => r.role_name),
            permissions: permissions.map((p: any) => p.permission_name)
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
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token не предоставлен'
        });
        return;
      }

      // Проверка существования токена в БД
      const tokens = await db.query<any>(
        'SELECT * FROM admin_refresh_tokens WHERE token = ? AND expires_at > NOW()',
        [refreshToken]
      );

      if (!tokens || tokens.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Недействительный refresh token'
        });
        return;
      }

      const tokenData = tokens[0];

      // Получение данных пользователя
      const users = await db.query<any>(
        'SELECT * FROM admin_users WHERE id = ? AND is_active = TRUE',
        [tokenData.user_id]
      );

      if (!users || users.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      const user = users[0];

      // Генерация нового access token
      const tokenPayload = {
        id: user.id,
        username: user.username,
        is_super_admin: user.is_super_admin
      };

      const accessToken = generateAccessToken(tokenPayload);

      res.json({
        success: true,
        data: { accessToken }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
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

      // Получаем роли и права
      const roles = await db.query<any>(
        `SELECT r.role_name 
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [req.admin.id]
      );

      const permissions = await db.query<any>(
        `SELECT DISTINCT p.permission_name
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = ?`,
        [req.admin.id]
      );

      res.json({
        success: true,
        data: {
          id: req.admin.id,
          username: req.admin.username,
          full_name: req.admin.full_name,
          email: req.admin.email,
          is_super_admin: req.admin.is_super_admin,
          roles: roles.map((r: any) => r.role_name),
          permissions: permissions.map((p: any) => p.permission_name)
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