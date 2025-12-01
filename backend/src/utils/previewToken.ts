// backend/src/utils/previewToken.ts
import crypto from 'crypto';

/**
 * Генерирует подписанный токен для просмотра объекта на основном сайте
 */
export function generatePreviewToken(propertyId: number | string): string {
  const SECRET_KEY = process.env.PREVIEW_TOKEN_SECRET || 'default-secret-key';
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Создаем подпись
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${propertyId}|${timestamp}`)
    .digest('hex');
  
  // Формируем токен: propertyId|timestamp|signature
  const tokenData = `${propertyId}|${timestamp}|${signature}`;
  
  // Кодируем в base64
  return Buffer.from(tokenData).toString('base64');
}

/**
 * Генерирует полный URL для просмотра объекта на основном сайте
 */
export function generatePreviewUrl(propertyId: number | string): string {
  const token = generatePreviewToken(propertyId);
  const MAIN_SITE_URL = process.env.MAIN_SITE_URL || 'https://novaestate.company';
  
  return `${MAIN_SITE_URL}/properties/${propertyId}?viewupdate=${token}`;
}