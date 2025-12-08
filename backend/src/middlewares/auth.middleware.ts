// backend/src/middlewares/auth.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import db from '../config/database';
import jwt from 'jsonwebtoken';

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

    // ✅ ИСПРАВЛЕНО: Добавлено u.partner_id в SELECT
    const user = await db.queryOne<any>(
      `SELECT 
        u.id, u.username, u.full_name, u.email, 
        u.is_active, u.is_super_admin, u.partner_id,
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

    // ✅ ДОБАВЛЕНО: Логирование для отладки
    console.log('=== AUTH MIDDLEWARE ===');
    console.log('User ID:', user.id);
    console.log('Username:', user.username);
    console.log('Partner ID from DB:', user.partner_id);
    console.log('Partner ID type:', typeof user.partner_id);

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

/**
 * Middleware для проверки авторизации владельца недвижимости
 */
export const authenticateOwner = async (
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
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Недействительный токен'
      });
      return;
    }

    // Проверяем что это токен владельца
    if (decoded.type !== 'owner') {
      res.status(403).json({
        success: false,
        message: 'Доступ запрещён'
      });
      return;
    }

    // Получаем информацию о владельце с разрешениями
    const owner = await db.queryOne<any>(
      `SELECT id, owner_name, is_active, can_edit_calendar, can_edit_pricing 
       FROM property_owners 
       WHERE id = ? AND is_active = 1`,
      [decoded.id]
    );

    if (!owner) {
      res.status(401).json({
        success: false,
        message: 'Владелец не найден или доступ деактивирован'
      });
      return;
    }

    // Добавляем информацию о владельце с разрешениями в request
    (req as any).owner = {
      id: owner.id,
      owner_name: owner.owner_name,
      can_edit_calendar: !!owner.can_edit_calendar,
      can_edit_pricing: !!owner.can_edit_pricing
    };

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
};

/**
 * Middleware для проверки разрешения владельца на редактирование календаря
 */
export const requireCalendarEditPermission = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const owner = (req as any).owner;
  
  if (!owner || !owner.can_edit_calendar) {
    res.status(403).json({
      success: false,
      message: 'У вас нет разрешения на редактирование календаря'
    });
    return;
  }
  
  next();
};

/**
 * Middleware для проверки разрешения владельца на редактирование цен
 */
export const requirePricingEditPermission = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const owner = (req as any).owner;
  
  if (!owner || !owner.can_edit_pricing) {
    res.status(403).json({
      success: false,
      message: 'У вас нет разрешения на редактирование цен'
    });
    return;
  }
  
  next();
};

/**
 * Middleware для проверки разрешения владельца на редактирование календаря
 */
export const requireCalendaryEditPermission = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const owner = (req as any).owner;
  
  if (!owner || !owner.can_edit_calendar) {
    res.status(403).json({
      success: false,
      message: 'У вас нет разрешения на редактирование календаря'
    });
    return;
  }
  
  next();
};

/**
 * Middleware для проверки прав владельца на редактирование объекта
 */
export const canOwnerEditProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: propertyId } = req.params;
    const ownerName = (req as any).owner?.owner_name;

    if (!ownerName) {
      res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
      return;
    }

    // Проверяем что объект принадлежит владельцу
    const property = await db.queryOne<any>(
      'SELECT id, owner_name FROM properties WHERE id = ? AND deleted_at IS NULL',
      [propertyId]
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Объект не найден'
      });
      return;
    }

    if (property.owner_name !== ownerName) {
      res.status(403).json({
        success: false,
        message: 'У вас нет прав на редактирование этого объекта'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки прав'
    });
  }
};

/**
 * Универсальный middleware для авторизации админа или владельца
 * Используется для эндпоинтов, к которым должны иметь доступ оба типа пользователей
 */
export const authenticateAdminOrOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Токен не предоставлен'
    });
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type === 'owner') {
      // Это токен владельца
      return authenticateOwner(req, res, next);
    } else {
      // Это токен админа
      return authenticate(req, res, next);
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Недействительный токен'
    });
    return;
  }
};

/**
 * Универсальный middleware для проверки прав на редактирование объекта
 * Работает для админов и владельцев
 */
export const canEditPropertyUniversal = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Если это владелец
  if ((req as any).owner) {
    return canOwnerEditProperty(req, res, next);
  }
  
  // Если это админ
  if (req.admin) {
    return canEditProperty(req, res, next);
  }
  
  res.status(401).json({
    success: false,
    message: 'Не авторизован'
  });
};