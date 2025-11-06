// backend/src/controllers/users.controller.ts
import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class UsersController {
  // Получить список всех пользователей
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await db.query<any>(
        `SELECT 
          id,
          username,
          full_name,
          email,
          is_active,
          is_super_admin,
          last_login_at,
          created_at
         FROM admin_users
         ORDER BY created_at DESC`
      );

      // Получаем роли для каждого пользователя
      for (const user of users) {
        const roles = await db.query<any>(
          `SELECT r.id, r.role_name
           FROM roles r
           INNER JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = ?`,
          [user.id]
        );
        user.roles = roles;
      }

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка пользователей'
      });
    }
  }

  // Получить пользователя по ID
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await db.queryOne<any>(
        `SELECT 
          id,
          username,
          full_name,
          email,
          is_active,
          is_super_admin,
          last_login_at,
          created_at
         FROM admin_users
         WHERE id = ?`,
        [id]
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      // Получаем роли
      const roles = await db.query<any>(
        `SELECT r.id, r.role_name
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [id]
      );
      user.roles = roles;

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения пользователя'
      });
    }
  }

  // Создать пользователя
  async create(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { username, password, full_name, email, role_ids } = req.body;

      // Проверяем уникальность username
      const existingUser = await db.queryOne(
        'SELECT id FROM admin_users WHERE username = ?',
        [username]
      );

      if (existingUser) {
        await db.rollback(connection);
        res.status(400).json({
          success: false,
          message: 'Пользователь с таким именем уже существует'
        });
        return;
      }

      // Хешируем пароль
      const passwordHash = await bcrypt.hash(password, 10);

      // Создаем пользователя
      const result = await connection.query(
        `INSERT INTO admin_users (username, password_hash, full_name, email, is_active)
         VALUES (?, ?, ?, ?, TRUE)`,
        [username, passwordHash, full_name, email || null]
      );

      const userId = (result as any)[0].insertId;

      // Добавляем роли
      if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
        for (const roleId of role_ids) {
          await connection.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, roleId]
          );
        }
      }

      await db.commit(connection);

      logger.info(`User created: ${username} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Пользователь успешно создан',
        data: { userId }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания пользователя'
      });
    }
  }

  // Обновить пользователя
  async update(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { full_name, email, password, role_ids, is_active } = req.body;

      // Проверяем существование пользователя
      const user = await db.queryOne('SELECT id FROM admin_users WHERE id = ?', [id]);

      if (!user) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      // Обновляем данные пользователя
      const fields: string[] = [];
      const values: any[] = [];

      if (full_name !== undefined) {
        fields.push('full_name = ?');
        values.push(full_name);
      }
      if (email !== undefined) {
        fields.push('email = ?');
        values.push(email);
      }
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        fields.push('password_hash = ?');
        values.push(passwordHash);
      }
      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active);
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE admin_users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      // Обновляем роли
      if (role_ids !== undefined) {
        // Удаляем старые роли
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);

        // Добавляем новые роли
        if (Array.isArray(role_ids) && role_ids.length > 0) {
          for (const roleId of role_ids) {
            await connection.query(
              'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
              [id, roleId]
            );
          }
        }
      }

      await db.commit(connection);

      logger.info(`User updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Пользователь успешно обновлен'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления пользователя'
      });
    }
  }

  // Удалить пользователя
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Проверяем что пользователь не удаляет сам себя
      if (req.admin?.id === parseInt(id)) {
        res.status(400).json({
          success: false,
          message: 'Нельзя удалить самого себя'
        });
        return;
      }

      // Проверяем что удаляемый пользователь не суперадмин
      const user = await db.queryOne<any>(
        'SELECT is_super_admin FROM admin_users WHERE id = ?',
        [id]
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      if (user.is_super_admin) {
        res.status(400).json({
          success: false,
          message: 'Нельзя удалить суперадминистратора'
        });
        return;
      }

      // Удаляем пользователя (роли удалятся автоматически по CASCADE)
      await db.query('DELETE FROM admin_users WHERE id = ?', [id]);

      logger.info(`User deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Пользователь успешно удален'
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления пользователя'
      });
    }
  }
}

export default new UsersController();