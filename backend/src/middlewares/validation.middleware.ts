// backend/src/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';

// Простая валидация без express-validator
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Проверяем обязательные поля
    if (schema.required) {
      for (const field of schema.required) {
        if (!req.body[field]) {
          errors.push(`${field} is required`);
        }
      }
    }

    // Проверяем email
    if (schema.email) {
      for (const field of schema.email) {
        if (req.body[field]) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(req.body[field])) {
            errors.push(`${field} must be a valid email`);
          }
        }
      }
    }

    // Проверяем минимальную длину
    if (schema.minLength) {
      for (const [field, length] of Object.entries(schema.minLength)) {
        if (req.body[field] && req.body[field].length < (length as number)) {
          errors.push(`${field} must be at least ${length} characters`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
      return;
    }

    next();
  };
};