// backend/src/middlewares/auth.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import db from '../config/database';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Токен не предоставлен'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // Получаем полную информацию о пользователе с ролями и правами
    const user = await db.queryOne<any>(
      `SELECT 
        u.id, u.username, u.full_name, u.email, 
        u.is_active, u.is_super_admin,
        GROUP_CONCAT(DISTINCT p.permission_name) as permissions
      FROM admin_users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = ? AND u.is_active = TRUE
      GROUP BY u.id`,
      [decoded.id]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Пользователь не найден или неактивен'
      });
      return;
    }

    req.admin = {
      ...user,
      permissions: user.permissions ? user.permissions.split(',') : []
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Токен истёк'
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Неверный токен'
    });
  }
};

// Middleware для проверки прав доступа
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Суперадмин имеет все права
    if (req.admin.is_super_admin) {
      next();
      return;
    }

    // Проверяем наличие нужного права
    if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: 'Недостаточно прав для выполнения этой операции'
      });
      return;
    }

    next();
  };
};