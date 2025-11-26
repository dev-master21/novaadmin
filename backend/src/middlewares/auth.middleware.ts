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

// Проверка прав на редактирование конкретного объекта
export const canEditProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Суперадмин может всё
    if (req.admin.is_super_admin) {
      next();
      return;
    }

    // Если есть право properties.update - может редактировать всё
    if (req.admin.permissions && req.admin.permissions.includes('properties.update')) {
      next();
      return;
    }

    // Проверяем, является ли пользователь создателем объекта
    const { id } = req.params;
    const property = await db.queryOne<any>(
      'SELECT created_by FROM properties WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    // Если пользователь создатель - может редактировать
    if (property.created_by === req.admin.id) {
      next();
      return;
    }

    // Иначе - нет прав
    res.status(403).json({
      success: false,
      message: 'У вас нет прав на редактирование этого объекта'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки прав доступа'
    });
  }
};

// Только супер-админ может удалять
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.admin) {
    res.status(401).json({
      success: false,
      message: 'Не авторизован'
    });
    return;
  }

  if (!req.admin.is_super_admin) {
    res.status(403).json({
      success: false,
      message: 'Только супер-администратор может выполнить эту операцию'
    });
    return;
  }

  next();
};