// backend/src/controllers/roles.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';

class RolesController {
  // Получить список всех ролей
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const roles = await db.query<any>(
        `SELECT 
          r.id,
          r.role_name,
          r.description,
          r.created_at,
          r.updated_at,
          COUNT(DISTINCT ur.user_id) as users_count
         FROM roles r
         LEFT JOIN user_roles ur ON r.id = ur.role_id
         GROUP BY r.id
         ORDER BY r.created_at DESC`
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
        data: roles
      });
    } catch (error) {
      logger.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка ролей'
      });
    }
  }

  // Получить роль по ID
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const role = await db.queryOne<any>(
        'SELECT * FROM roles WHERE id = ?',
        [id]
      );

      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Роль не найдена'
        });
        return;
      }

      // Получаем права роли
      const permissions = await db.query<any>(
        `SELECT p.id, p.permission_name, p.module, p.description
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?
         ORDER BY p.module, p.permission_name`,
        [id]
      );

      role.permissions = permissions;

      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      logger.error('Get role by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения роли'
      });
    }
  }

  // Получить все права доступа (сгруппированные по модулям)
  async getAllPermissions(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const permissions = await db.query<any>(
        'SELECT * FROM permissions ORDER BY module, permission_name'
      );

      // Группируем по модулям
      const grouped: Record<string, any[]> = {};
      for (const permission of permissions) {
        if (!grouped[permission.module]) {
          grouped[permission.module] = [];
        }
        grouped[permission.module].push(permission);
      }

      res.json({
        success: true,
        data: grouped
      });
    } catch (error) {
      logger.error('Get permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения списка прав'
      });
    }
  }

  // Создать роль
  async create(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { role_name, description, permission_ids } = req.body;

      // Создаем роль
      const result = await connection.query(
        'INSERT INTO roles (role_name, description) VALUES (?, ?)',
        [role_name, description || null]
      );

      const roleId = (result as any)[0].insertId;

      // Добавляем права
      if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
        for (const permissionId of permission_ids) {
          await connection.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permissionId]
          );
        }
      }

      await db.commit(connection);

      logger.info(`Role created: ${role_name} by user ${req.admin?.username}`);

      res.status(201).json({
        success: true,
        message: 'Роль успешно создана',
        data: { roleId }
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Create role error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания роли'
      });
    }
  }

  // Обновить роль
  async update(req: AuthRequest, res: Response): Promise<void> {
    const connection = await db.beginTransaction();

    try {
      const { id } = req.params;
      const { role_name, description, permission_ids } = req.body;

      // Проверяем существование роли
      const role = await db.queryOne('SELECT id FROM roles WHERE id = ?', [id]);

      if (!role) {
        await db.rollback(connection);
        res.status(404).json({
          success: false,
          message: 'Роль не найдена'
        });
        return;
      }

      // Обновляем роль
      if (role_name || description !== undefined) {
        const fields: string[] = [];
        const values: any[] = [];

        if (role_name) {
          fields.push('role_name = ?');
          values.push(role_name);
        }
        if (description !== undefined) {
          fields.push('description = ?');
          values.push(description);
        }

        if (fields.length > 0) {
          values.push(id);
          await connection.query(
            `UPDATE roles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
          );
        }
      }

      // Обновляем права
      if (permission_ids !== undefined) {
        // Удаляем старые права
        await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);

        // Добавляем новые права
        if (Array.isArray(permission_ids) && permission_ids.length > 0) {
          for (const permissionId of permission_ids) {
            await connection.query(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
              [id, permissionId]
            );
          }
        }
      }

      await db.commit(connection);

      logger.info(`Role updated: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Роль успешно обновлена'
      });
    } catch (error) {
      await db.rollback(connection);
      logger.error('Update role error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления роли'
      });
    }
  }

  // Удалить роль
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Проверяем есть ли пользователи с этой ролью
      const users = await db.query<any>(
        'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
        [id]
      );

      if (users[0].count > 0) {
        res.status(400).json({
          success: false,
          message: 'Невозможно удалить роль, назначенную пользователям'
        });
        return;
      }

      // Удаляем роль (права удалятся автоматически по CASCADE)
      await db.query('DELETE FROM roles WHERE id = ?', [id]);

      logger.info(`Role deleted: ${id} by user ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Роль успешно удалена'
      });
    } catch (error) {
      logger.error('Delete role error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления роли'
      });
    }
  }
}

export default new RolesController();