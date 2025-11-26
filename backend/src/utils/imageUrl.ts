// backend/src/utils/imageUrl.ts
import { config } from '../config/config';

/**
 * Преобразует относительный путь изображения в полный URL
 * @param relativePath - относительный путь из БД (например: /uploads/properties/photos/image.jpg)
 * @param useThumbnail - использовать ли thumbnail версию
 * @returns полный URL к изображению
 */
export const getImageUrl = (relativePath: string | null, useThumbnail: boolean = false): string | null => {
  if (!relativePath) return null;

  let path = relativePath;

  // Если нужен thumbnail - добавляем _thumb перед расширением
  if (useThumbnail) {
    const lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
      path = path.substring(0, lastDot) + '_thumb' + path.substring(lastDot);
    }
  }

  // Формируем полный URL с клиентского сайта
  return `${config.clientSiteUrl}${path}`;
};

/**
 * Преобразует массив путей в полные URL
 */
export const getImageUrls = (paths: string[], useThumbnail: boolean = false): string[] => {
  return paths
    .map(path => getImageUrl(path, useThumbnail))
    .filter((url): url is string => url !== null);
};