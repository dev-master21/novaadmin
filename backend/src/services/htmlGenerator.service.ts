import db from '../config/database';
import logger from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';

// ✅ Интерфейс для наценки
interface PriceMarkup {
  type: 'percent' | 'fixed';
  value: number;
}

interface HTMLGeneratorOptions {
  language: string;
  displayMode: 'rent' | 'sale' | 'both';
  showRentalPrices: boolean;
  showSalePrices: boolean;
  includeSeasonalPrices: boolean;
  includeMonthlyPrices: boolean;
  includeYearlyPrice: boolean;
  forAgent?: boolean;
  // ✅ Параметры наценок
  yearlyPriceMarkup?: PriceMarkup;
  seasonalPricesMarkup?: PriceMarkup;
  monthlyPricesMarkup?: { [monthNumber: number]: PriceMarkup };
  salePriceMarkup?: PriceMarkup;
}

class HTMLGeneratorService {
  /**
   * ✅ Применить наценку к цене
   */
private applyMarkup(originalPrice: number | string, markup?: PriceMarkup): number {
  // ✅ КРИТИЧНО: Всегда преобразуем в число
  const numericPrice = typeof originalPrice === 'string' 
    ? parseFloat(originalPrice) 
    : originalPrice;
  
  console.log('🔧 applyMarkup called:', { 
    originalPrice, 
    numericPrice, 
    markup 
  });
  
  if (!markup || !markup.value) {
    console.log('→ No markup, returning original:', numericPrice);
    return numericPrice;
  }

  let result;
  if (markup.type === 'percent') {
    result = Math.round(numericPrice + (numericPrice * markup.value / 100));
    console.log(`→ Percent markup: ${numericPrice} + (${numericPrice} * ${markup.value} / 100) = ${result}`);
  } else {
    result = Math.round(numericPrice + markup.value);
    console.log(`→ Fixed markup: ${numericPrice} + ${markup.value} = ${result}`);
  }
  
  return result;
}

  /**
   * Конвертировать изображение в base64
   */
  private async imageToBase64(imagePath: string): Promise<string> {
    try {
      const fullPath = path.join('/var/www/www-root/data/www/novaestate.company/backend', imagePath);
      
      if (!await fs.pathExists(fullPath)) {
        logger.warn(`Image not found: ${fullPath}`);
        return '';
      }

      const imageBuffer = await fs.readFile(fullPath);
      const base64 = imageBuffer.toString('base64');
      const ext = path.extname(imagePath).toLowerCase();
      
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      logger.error(`Error converting image to base64: ${imagePath}`, error);
      return '';
    }
  }

  /**
   * Получить логотип в base64
   */
  private getLogoBase64(): string {
    const svgContent = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="1024.000000pt" height="1024.000000pt" viewBox="0 0 1024.000000 1024.000000" preserveAspectRatio="xMidYMid meet">
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
<path d="M3290 7470 l0 -110 665 0 665 0 0 110 0 110 -665 0 -665 0 0 -110z"/>
<path d="M360 5850 l0 -1170 95 0 95 0 2 887 3 888 760 -888 760 -887 82 0 83 0 0 1170 0 1170 -95 0 -95 0 -2 -893 -3 -893 -758 893 -758 893 -85 0 -84 0 0 -1170z"/>
<path d="M3795 7013 c-251 -31 -506 -156 -684 -334 -108 -108 -158 -180 -226 -321 -128 -267 -149 -542 -64 -843 100 -353 340 -622 669 -748 182 -70 249 -81 485 -82 198 0 216 2 312 27 347 93 611 307 771 624 100 199 140 490 98 722 -19 107 -64 248 -102 324 -104 206 -309 417 -489 503 -221 105 -359 136 -594 134 -80 -1 -159 -4 -176 -6z m386 -157 c157 -40 320 -154 410 -288 63 -93 126 -233 160 -358 31 -110 32 -125 36 -347 5 -263 -2 -323 -62 -491 -85 -238 -246 -414 -455 -499 -107 -43 -191 -55 -335 -50 -240 8 -393 82 -538 259 -67 82 -157 262 -191 383 -71 253 -75 600 -9 809 84 269 228 444 446 547 133 62 371 77 538 35z"/>
<path d="M5493 7008 c2 -7 153 -350 335 -763 181 -412 410 -933 508 -1157 l179 -408 115 0 115 0 182 428 c100 235 316 740 478 1122 163 382 305 716 316 743 l19 47 -124 0 -124 0 -14 -37 c-376 -970 -764 -1951 -770 -1945 -5 6 -302 711 -757 1799 l-76 183 -194 0 c-150 0 -192 -3 -188 -12z"/>
<path d="M8736 6933 c-46 -106 -1006 -2235 -1013 -2245 -2 -5 40 -8 95 -8 l99 0 175 367 174 368 490 -3 c269 -2 492 -7 495 -10 3 -4 75 -168 160 -364 l154 -358 177 0 c98 0 178 3 177 8 0 4 -222 529 -493 1167 l-492 1160 -80 3 -80 3 -38 -88z m225 -868 l198 -460 -42 -7 c-53 -8 -665 -8 -732 0 l-51 7 188 440 c103 242 194 458 203 480 15 36 18 38 28 20 6 -11 100 -227 208 -480z"/>
<path d="M2300 3440 l0 -410 255 0 255 0 0 60 0 60 -187 2 -188 3 0 110 0 110 188 3 187 2 0 60 0 60 -190 0 -190 0 0 110 0 110 190 0 191 0 -3 63 -3 62 -252 3 -253 2 0 -410z"/>
<path d="M4380 3790 l0 -60 110 0 110 0 0 -350 0 -350 65 0 65 0 0 350 0 350 115 0 115 0 0 60 0 60 -290 0 -290 0 0 -60z"/>
<path d="M5634 3842 c-7 -5 -245 -562 -341 -799 -4 -10 11 -13 58 -13 l64 0 42 98 41 97 187 0 186 0 42 -97 42 -98 62 0 c61 0 62 1 54 23 -38 99 -316 757 -327 775 -11 17 -24 22 -57 22 -23 0 -47 -4 -53 -8z m126 -304 c40 -101 75 -189 77 -195 4 -10 -30 -13 -151 -13 -86 0 -156 2 -156 4 0 12 151 386 156 386 1 0 35 -82 74 -182z"/>
<path d="M6430 3790 l0 -60 110 0 110 0 0 -350 0 -350 70 0 70 0 0 350 0 349 113 3 112 3 3 58 3 57 -296 0 -295 0 0 -60z"/>
<path d="M7520 3440 l0 -410 255 0 255 0 0 60 0 60 -187 2 -188 3 0 110 0 110 188 3 187 2 0 60 0 60 -187 2 -188 3 -3 108 -3 107 191 0 191 0 -3 63 -3 62 -252 3 -253 2 0 -410z"/>
<path d="M3510 3820 c-96 -33 -150 -119 -136 -218 12 -92 63 -141 194 -188 42 -15 100 -36 129 -46 71 -26 113 -66 113 -110 0 -78 -79 -138 -181 -138 -65 0 -147 42 -175 90 -10 16 -22 30 -26 30 -5 0 -26 -12 -48 -26 l-40 -26 19 -27 c51 -70 144 -125 233 -137 59 -8 172 11 228 40 154 78 158 292 7 380 -23 14 -87 37 -142 52 -148 39 -185 68 -185 147 0 66 55 107 145 107 66 0 108 -16 157 -59 20 -17 40 -31 44 -31 5 0 25 14 44 30 l35 30 -37 33 c-20 18 -62 45 -92 60 -47 23 -67 27 -143 27 -60 -1 -106 -7 -143 -20z"/>
</g>
</svg>`;
    
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Получить SVG иконку
   */
  private getSVGIcon(name: string): string {
    const icons: { [key: string]: string } = {
      bed: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v13h2v-2h18v2h2v-9c0-1.1-.9-2-2-2zm0 8h-8V9h8v6z"/></svg>',
      bath: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 3c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm13 15H4v-2h16v2zm0-5H4V5h16v8z"/></svg>',
      area: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/><path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h10v2H7z"/></svg>',
      location: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>',
      map: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>',
      check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
      chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
      chevronUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
      chevronLeft: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/></svg>',
      chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/></svg>',
      calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>',
      dollar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
      home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
      pool: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2zm0-4.5c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36s-.78.13-1.15.36c-.47.27-1.09.64-2.2.64v-2c.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36v2zM8.67 12c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.12-.07.26-.15.41-.23L10.48 5C8.93 3.45 7.5 2.99 5 3v2.5c1.82-.01 2.89.39 4 1.5l1 1-3.25 3.25c.31.12.56.27.77.39.37.23.59.36 1.15.36z"/></svg>',
      wifi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>',
      images: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/></svg>',
      building: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>',
      parking: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>',
      pet: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 9.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M9 5.5A2.5 2.5 0 1 0 9 10.5A2.5 2.5 0 1 0 9 5.5M15 5.5A2.5 2.5 0 1 0 15 10.5A2.5 2.5 0 1 0 15 5.5M19.5 9.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z"/></svg>',
      land: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>',
      document: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
      furniture: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-6.18C11.4 5.84 9.3 5 7 5c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.3 0 4.4-.84 5.82-2.18H19c.55 0 1-.45 1-1V8c0-.55-.45-1-1-1z"/></svg>',
      beach: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21zm4.293-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z"/></svg>',
    };
    return icons[name] || '';
  }

  /**
   * Получить переводы интерфейса
   */
  private getUITranslations(language: string): { [key: string]: string } {
    const translations: { [key: string]: { [key: string]: string } } = {
      ru: {
        // Заголовки секций
        'description': 'Описание',
        'features': 'Особенности',
        'calendar': 'Календарь занятости',
        'calendar_not_synced': 'Для данного объекта не синхронизирован календарь - уточняйте занятость',
        'property_features': 'Особенности объекта',
        'outdoor_amenities': 'Уличные удобства',
        'rental_conditions': 'Условия аренды',
        'location_features': 'Локация',
        'views': 'Виды',
        'sale_details': 'Детали продажи',
        'rental_prices': 'Цены аренды',
        'quick_info': 'Краткая информация',
        
        // Цены
        'sale_price': 'Цена продажи',
        'price_per_sqm': 'за м²',
        'from': 'От',
        'per_night': '/ ночь',
        'per_period': 'за период',
        'per_year': '/ год',
        'yearly_rent': 'Годовая аренда',
        'seasonal_prices': 'Сезонные цены',
        'monthly_prices': 'Месячные цены',
        
        // Инфо карточки
        'bedrooms': 'Спален',
        'bathrooms': 'Ванных',
        'indoor_area': 'Жилая площадь',
        'outdoor_area': 'Нежилая площадь',
        'plot_size': 'Участок',
        'floors': 'Этажей',
        'floor_number': 'Этаж',
        'parking_spaces': 'Парковочных мест',
        
        // Детали продажи
        'ownership_type': 'Тип владения',
        'building_ownership': 'Владение зданием',
        'land_ownership': 'Владение землей',
        'construction_year': 'Год постройки',
        'furniture_status': 'Мебель',
        'distance_to_beach': 'До пляжа',
        'pets_allowed': 'Животные',
        
        // Типы владения
        'freehold': 'Фрихолд',
        'leasehold': 'Лизхолд',
        'company': 'Компания',
        
        // Мебель
        'fullyFurnished': 'Полностью меблирован',
        'partiallyFurnished': 'Частично меблирован',
        'unfurnished': 'Без мебели',
        'builtIn': 'Встроенная мебель',
        'empty': 'Пусто',
        
        // Животные
        'yes': 'Разрешены',
        'no': 'Не разрешены',
        'negotiable': 'Обсуждается',
        
        // Кнопки и действия
        'view_all': 'Посмотреть все',
        'open_map': 'Открыть на карте',
        
        // Календарь
        'available': 'Доступно',
        'occupied': 'Занято',
        'mon': 'Пн',
        'tue': 'Вт',
        'wed': 'Ср',
        'thu': 'Чт',
        'fri': 'Пт',
        'sat': 'Сб',
        'sun': 'Вс',
        
        // Месяцы
        'january': 'Январь',
        'february': 'Февраль',
        'march': 'Март',
        'april': 'Апрель',
        'may': 'Май',
        'june': 'Июнь',
        'july': 'Июль',
        'august': 'Август',
        'september': 'Сентябрь',
        'october': 'Октябрь',
        'november': 'Ноябрь',
        'december': 'Декабрь',
        
        // Месяцы короткие (для дат)
        'jan': 'янв',
        'feb': 'фев',
        'mar': 'мар',
        'apr': 'апр',
        'may_short': 'мая',
        'jun': 'июн',
        'jul': 'июл',
        'aug': 'авг',
        'sep': 'сен',
        'oct': 'окт',
        'nov': 'ноя',
        'dec': 'дек',
        
        // Футер
        'all_rights_reserved': 'Все права защищены',
        
        // Единицы
        'meters': 'м',
        'sqm': 'м²',
        'year': 'год'
      },
      
      en: {
        // Section headers
        'description': 'Description',
        'features': 'Features',
        'calendar': 'Availability Calendar',
        'calendar_not_synced': 'Calendar is not synced for this property - please check availability',
        'property_features': 'Property Features',
        'outdoor_amenities': 'Outdoor Amenities',
        'rental_conditions': 'Rental Conditions',
        'location_features': 'Location',
        'views': 'Views',
        'sale_details': 'Sale Details',
        'rental_prices': 'Rental Prices',
        'quick_info': 'Quick Info',
        
        // Prices
        'sale_price': 'Sale Price',
        'price_per_sqm': 'per m²',
        'from': 'From',
        'per_night': '/ night',
        'per_period': 'per period',
        'per_year': '/ year',
        'yearly_rent': 'Yearly Rent',
        'seasonal_prices': 'Seasonal Prices',
        'monthly_prices': 'Monthly Prices',
        
        // Info cards
        'bedrooms': 'Bedrooms',
        'bathrooms': 'Bathrooms',
        'indoor_area': 'Indoor Area',
        'outdoor_area': 'Outdoor Area',
        'plot_size': 'Plot Size',
        'floors': 'Floors',
        'floor_number': 'Floor',
        'parking_spaces': 'Parking Spaces',
        
        // Sale details
        'ownership_type': 'Ownership Type',
        'building_ownership': 'Building Ownership',
        'land_ownership': 'Land Ownership',
        'construction_year': 'Construction Year',
        'furniture_status': 'Furniture',
        'distance_to_beach': 'Distance to Beach',
        'pets_allowed': 'Pets',
        
        // Ownership types
        'freehold': 'Freehold',
        'leasehold': 'Leasehold',
        'company': 'Company',
        
        // Furniture
        'fullyFurnished': 'Fully Furnished',
        'partiallyFurnished': 'Partially Furnished',
        'unfurnished': 'Unfurnished',
        'builtIn': 'Built-in',
        'empty': 'Empty',
        
        // Pets
        'yes': 'Yes',
        'no': 'No',
        'negotiable': 'Negotiable',
        
        // Buttons and actions
        'view_all': 'View All',
        'open_map': 'Open Map',
        
        // Calendar
        'available': 'Available',
        'occupied': 'Occupied',
        'mon': 'Mon',
        'tue': 'Tue',
        'wed': 'Wed',
        'thu': 'Thu',
        'fri': 'Fri',
        'sat': 'Sat',
        'sun': 'Sun',
        
        // Months
        'january': 'January',
        'february': 'February',
        'march': 'March',
        'april': 'April',
        'may': 'May',
        'june': 'June',
        'july': 'July',
        'august': 'August',
        'september': 'September',
        'october': 'October',
        'november': 'November',
        'december': 'December',
        
        // Short months
        'jan': 'Jan',
        'feb': 'Feb',
        'mar': 'Mar',
        'apr': 'Apr',
        'may_short': 'May',
        'jun': 'Jun',
        'jul': 'Jul',
        'aug': 'Aug',
        'sep': 'Sep',
        'oct': 'Oct',
        'nov': 'Nov',
        'dec': 'Dec',
        
        // Footer
        'all_rights_reserved': 'All Rights Reserved',
        
        // Units
        'meters': 'm',
        'sqm': 'm²',
        'year': 'year'
      },
      
      th: {
        'description': 'คำอธิบาย',
        'features': 'คุณสมบัติ',
        'calendar': 'ปฏิทินความพร้อม',
        'property_features': 'คุณสมบัติของทรัพย์สิน',
        'outdoor_amenities': 'สิ่งอำนวยความสะดวกกลางแจ้ง',
        'rental_conditions': 'เงื่อนไขการเช่า',
        'location_features': 'ทำเล',
        'views': 'วิว',
        'sale_details': 'รายละเอียดการขาย',
        'rental_prices': 'ราคาเช่า',
        'quick_info': 'ข้อมูลด่วน',
        'sale_price': 'ราคาขาย',
        'price_per_sqm': 'ต่อตร.ม.',
        'from': 'จาก',
        'per_night': '/ คืน',
        'calendar_not_synced': 'ปฏิทินไม่ได้ซิงค์สำหรับทรัพย์สินนี้ - โปรดตรวจสอบความพร้อม',
        'per_period': 'ต่อช่วง',
        'per_year': '/ ปี',
        'yearly_rent': 'ค่าเช่ารายปี',
        'seasonal_prices': 'ราคาตามฤดูกาล',
        'monthly_prices': 'ราคารายเดือน',
        'bedrooms': 'ห้องนอน',
        'bathrooms': 'ห้องน้ำ',
        'indoor_area': 'พื้นที่ภายใน',
        'outdoor_area': 'พื้นที่ภายนอก',
        'plot_size': 'ขนาดที่ดิน',
        'floors': 'จำนวนชั้น',
        'floor_number': 'ชั้น',
        'parking_spaces': 'ที่จอดรถ',
        'ownership_type': 'ประเภทกรรมสิทธิ์',
        'building_ownership': 'กรรมสิทธิ์อาคาร',
        'land_ownership': 'กรรมสิทธิ์ที่ดิน',
        'construction_year': 'ปีที่สร้าง',
        'furniture_status': 'เฟอร์นิเจอร์',
        'distance_to_beach': 'ระยะทางถึงชายหาด',
        'pets_allowed': 'สัตว์เลี้ยง',
        'freehold': 'กรรมสิทธิ์เต็ม',
        'leasehold': 'สัญญาเช่า',
        'company': 'บริษัท',
        'fullyFurnished': 'มีเฟอร์นิเจอร์ครบ',
        'partiallyFurnished': 'มีเฟอร์นิเจอร์บางส่วน',
        'unfurnished': 'ไม่มีเฟอร์นิเจอร์',
        'builtIn': 'เฟอร์นิเจอร์ติดตั้ง',
        'empty': 'ว่าง',
        'yes': 'ได้',
        'no': 'ไม่ได้',
        'negotiable': 'ต่อรองได้',
        'view_all': 'ดูทั้งหมด',
        'open_map': 'เปิดแผนที่',
        'available': 'ว่าง',
        'occupied': 'ไม่ว่าง',
        'mon': 'จ',
        'tue': 'อ',
        'wed': 'พ',
        'thu': 'พฤ',
        'fri': 'ศ',
        'sat': 'ส',
        'sun': 'อา',
        'january': 'มกราคม',
        'february': 'กุมภาพันธ์',
        'march': 'มีนาคม',
        'april': 'เมษายน',
        'may': 'พฤษภาคม',
        'june': 'มิถุนายน',
        'july': 'กรกฎาคม',
        'august': 'สิงหาคม',
        'september': 'กันยายน',
        'october': 'ตุลาคม',
        'november': 'พฤศจิกายน',
        'december': 'ธันวาคม',
        'jan': 'ม.ค.',
        'feb': 'ก.พ.',
        'mar': 'มี.ค.',
        'apr': 'เม.ย.',
        'may_short': 'พ.ค.',
        'jun': 'มิ.ย.',
        'jul': 'ก.ค.',
        'aug': 'ส.ค.',
        'sep': 'ก.ย.',
        'oct': 'ต.ค.',
        'nov': 'พ.ย.',
        'dec': 'ธ.ค.',
        'all_rights_reserved': 'สงวนลิขสิทธิ์',
        'meters': 'ม.',
        'sqm': 'ตร.ม.',
        'year': 'ปี'
      },
      
      zh: {
        'description': '描述',
        'features': '特色',
        'calendar': '可用性日历',
        'property_features': '房产特色',
        'outdoor_amenities': '户外设施',
        'rental_conditions': '租赁条件',
        'location_features': '位置',
        'views': '景观',
        'sale_details': '销售详情',
        'rental_prices': '租金',
        'quick_info': '快速信息',
        'sale_price': '售价',
        'price_per_sqm': '每平方米',
        'from': '从',
        'per_night': '/ 晚',
        'per_period': '每期',
        'per_year': '/ 年',
        'yearly_rent': '年租金',
        'seasonal_prices': '季节性价格',
        'monthly_prices': '月度价格',
        'bedrooms': '卧室',
        'bathrooms': '浴室',
        'indoor_area': '室内面积',
        'outdoor_area': '室外面积',
        'plot_size': '地块大小',
        'floors': '楼层数',
        'floor_number': '楼层',
        'parking_spaces': '停车位',
        'ownership_type': '所有权类型',
        'calendar_not_synced': '此房产的日历未同步 - 请确认可用性',
        'building_ownership': '建筑所有权',
        'land_ownership': '土地所有权',
        'construction_year': '建造年份',
        'furniture_status': '家具',
        'distance_to_beach': '到海滩的距离',
        'pets_allowed': '宠物',
        'freehold': '永久产权',
        'leasehold': '租赁产权',
        'company': '公司',
        'fullyFurnished': '全装修',
        'partiallyFurnished': '部分装修',
        'unfurnished': '无装修',
        'builtIn': '内置家具',
        'empty': '空置',
        'yes': '是',
        'no': '否',
        'negotiable': '可协商',
        'view_all': '查看全部',
        'open_map': '打开地图',
        'available': '可用',
        'occupied': '已占用',
        'mon': '一',
        'tue': '二',
        'wed': '三',
        'thu': '四',
        'fri': '五',
        'sat': '六',
        'sun': '日',
        'january': '一月',
        'february': '二月',
        'march': '三月',
        'april': '四月',
        'may': '五月',
        'june': '六月',
        'july': '七月',
        'august': '八月',
        'september': '九月',
        'october': '十月',
        'november': '十一月',
        'december': '十二月',
        'jan': '1月',
        'feb': '2月',
        'mar': '3月',
        'apr': '4月',
        'may_short': '5月',
        'jun': '6月',
        'jul': '7月',
        'aug': '8月',
        'sep': '9月',
        'oct': '10月',
        'nov': '11月',
        'dec': '12月',
        'all_rights_reserved': '版权所有',
        'meters': '米',
        'sqm': '平方米',
        'year': '年'
      },
      
      he: {
        'description': 'תיאור',
        'features': 'תכונות',
        'calendar': 'לוח זמינות',
        'property_features': 'תכונות הנכס',
        'outdoor_amenities': 'מתקנים חיצוניים',
        'rental_conditions': 'תנאי השכירות',
        'location_features': 'מיקום',
        'views': 'נוף',
        'sale_details': 'פרטי מכירה',
        'rental_prices': 'מחירי שכירות',
        'quick_info': 'מידע מהיר',
        'sale_price': 'מחיר מכירה',
        'price_per_sqm': 'למ"ר',
        'from': 'מ',
        'per_night': '/ לילה',
        'per_period': 'לתקופה',
        'per_year': '/ שנה',
        'yearly_rent': 'שכירות שנתית',
        'seasonal_prices': 'מחירים עונתיים',
        'monthly_prices': 'מחירים חודשיים',
        'bedrooms': 'חדרי שינה',
        'bathrooms': 'חדרי רחצה',
        'calendar_not_synced': 'לוח השנה לא מסונכרן עבור נכס זה - אנא בדוק זמינות',
        'indoor_area': 'שטח פנימי',
        'outdoor_area': 'שטח חיצוני',
        'plot_size': 'גודל מגרש',
        'floors': 'קומות',
        'floor_number': 'קומה',
        'parking_spaces': 'מקומות חניה',
        'ownership_type': 'סוג בעלות',
        'building_ownership': 'בעלות על המבנה',
        'land_ownership': 'בעלות על הקרקע',
        'construction_year': 'שנת בנייה',
        'furniture_status': 'ריהוט',
        'distance_to_beach': 'מרחק לחוף',
        'pets_allowed': 'חיות מחמד',
        'freehold': 'בעלות מלאה',
        'leasehold': 'חכירה',
        'company': 'חברה',
        'fullyFurnished': 'מרוהט במלואו',
        'partiallyFurnished': 'מרוהט חלקית',
        'unfurnished': 'לא מרוהט',
        'builtIn': 'ריהוט קבוע',
        'empty': 'ריק',
        'yes': 'כן',
        'no': 'לא',
        'negotiable': 'ניתן למשא ומתן',
        'view_all': 'צפה בהכל',
        'open_map': 'פתח מפה',
        'available': 'פנוי',
        'occupied': 'תפוס',
        'mon': 'ב',
        'tue': 'ג',
        'wed': 'ד',
        'thu': 'ה',
        'fri': 'ו',
        'sat': 'ש',
        'sun': 'א',
        'january': 'ינואר',
        'february': 'פברואר',
        'march': 'מרץ',
        'april': 'אפריל',
        'may': 'מאי',
        'june': 'יוני',
        'july': 'יולי',
        'august': 'אוגוסט',
        'september': 'ספטמבר',
        'october': 'אוקטובר',
        'november': 'נובמבר',
        'december': 'דצמבר',
        'jan': 'ינו',
        'feb': 'פבר',
        'mar': 'מרץ',
        'apr': 'אפר',
        'may_short': 'מאי',
        'jun': 'יונ',
        'jul': 'יול',
        'aug': 'אוג',
        'sep': 'ספט',
        'oct': 'אוק',
        'nov': 'נוב',
        'dec': 'דצמ',
        'all_rights_reserved': 'כל הזכויות שמורות',
        'meters': 'מ\'',
        'sqm': 'מ"ר',
        'year': 'שנה'
      }
    };

    return translations[language] || translations['ru'];
  }

  /**
   * Форматировать цену
   */
  private formatPrice(price: number, currency: string = '฿'): string {
    const rounded = Math.round(price);
    return `${currency}${rounded.toLocaleString('en-US')}`;
  }

  /**
   * Получить название месяца
   */
  private getMonthName(monthNumber: number, language: string): string {
    const ui = this.getUITranslations(language);
    const months = [
      ui['january'], ui['february'], ui['march'], ui['april'],
      ui['may'], ui['june'], ui['july'], ui['august'],
      ui['september'], ui['october'], ui['november'], ui['december']
    ];

    return months[monthNumber - 1] || `Month ${monthNumber}`;
  }

  /**
   * Форматировать дату для отображения (DD-MM формат)
   */
  private formatDateRange(start: string, end: string, language: string): string {
    const [startDay, startMonth] = start.split('-').map(Number);
    const [endDay, endMonth] = end.split('-').map(Number);
    
    const ui = this.getUITranslations(language);
    const months = [
      ui['jan'], ui['feb'], ui['mar'], ui['apr'],
      ui['may_short'], ui['jun'], ui['jul'], ui['aug'],
      ui['sep'], ui['oct'], ui['nov'], ui['dec']
    ];
    
    const startMonthName = months[startMonth - 1];
    const endMonthName = months[endMonth - 1];
    
    return `${startDay} ${startMonthName} - ${endDay} ${endMonthName}`;
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirstLetter(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Генерировать HTML для объекта
   */
  async generatePropertyHTML(
    propertyId: number,
    options: HTMLGeneratorOptions
  ): Promise<string> {
    try {
      // Загружаем данные объекта
      const property = await db.queryOne<any>(
        `SELECT 
          p.*,
          pt.property_name as translated_name,
          pt.description as translated_description
        FROM properties p
        LEFT JOIN property_translations pt ON p.id = pt.property_id AND pt.language_code = ?
        WHERE p.id = ? AND p.deleted_at IS NULL`,
        [options.language, propertyId]
      );

      if (!property) {
        throw new Error('Property not found');
      }

      // Загружаем фотографии
      let photos = await db.query<any>(
        `SELECT photo_url, is_primary 
         FROM property_photos 
         WHERE property_id = ? 
         ORDER BY is_primary DESC, sort_order ASC`,
        [propertyId]
      );

      // Берём до 20 фотографий
      if (photos.length > 20) {
        const primaryPhoto = photos.find((p: any) => p.is_primary);
        const otherPhotos = photos.filter((p: any) => !p.is_primary);
        const shuffled = otherPhotos.sort(() => Math.random() - 0.5);
        photos = primaryPhoto 
          ? [primaryPhoto, ...shuffled.slice(0, 19)]
          : shuffled.slice(0, 20);
      }

      // Конвертируем фото в base64
      const photosBase64 = await Promise.all(
        photos.map(async (photo: any) => await this.imageToBase64(photo.photo_url))
      );

      const validPhotos = photosBase64.filter(p => p !== '');

      if (validPhotos.length === 0) {
        throw new Error('No photos available for this property');
      }

      // Загружаем характеристики
      const features = await db.query<any>(
        'SELECT feature_type, feature_value FROM property_features WHERE property_id = ?',
        [propertyId]
      );

      const featuresByType: { [key: string]: string[] } = {};
      features.forEach((f: any) => {
        if (!featuresByType[f.feature_type]) {
          featuresByType[f.feature_type] = [];
        }
        featuresByType[f.feature_type].push(f.feature_value);
      });

      // Загружаем цены только если не режим "только продажа"
      let seasonalPrices: any[] = [];
      let monthlyPrices: any[] = [];

      if (options.displayMode !== 'sale' && options.showRentalPrices) {
        if (options.includeSeasonalPrices) {
          seasonalPrices = await db.query(
            `SELECT * FROM property_pricing 
             WHERE property_id = ? 
             ORDER BY start_date_recurring ASC`,
            [propertyId]
          );
        }

        if (options.includeMonthlyPrices) {
          monthlyPrices = await db.query(
            `SELECT * FROM property_pricing_monthly 
             WHERE property_id = ? 
             ORDER BY month_number ASC`,
            [propertyId]
          );
        }
      }

      // Загружаем календарь занятости только если не режим "только продажа"
      let blockedDates: any[] = [];
      if (options.displayMode !== 'sale') {
        blockedDates = await db.query<any>(
          `SELECT blocked_date, is_check_in, is_check_out
           FROM property_calendar
           WHERE property_id = ?
           ORDER BY blocked_date ASC`,
          [propertyId]
        );
      }

      // Генерируем HTML
      const html = this.generateHTMLTemplate({
        property,
        photos: validPhotos,
        features: featuresByType,
        seasonalPrices,
        monthlyPrices,
        blockedDates,
        options
      });

      return html;
    } catch (error) {
      logger.error('Generate HTML error:', error);
      throw error;
    }
  }

  /**
   * Генерировать HTML шаблон
   */
  private generateHTMLTemplate(data: any): string {
    const { property, photos, features, seasonalPrices, monthlyPrices, blockedDates, options } = data;

    const ui = this.getUITranslations(options.language);
    const forAgent = options.forAgent || false;
    const propertyName = property.translated_name || property.property_name || `Property ${property.property_number}`;
    const description = property.translated_description || '';
    const propertyNumber = property.property_number || '';
    const region = this.capitalizeFirstLetter(property.region || '');
    const logoBase64 = this.getLogoBase64();
    const mainPhoto = photos[0];
    
    // Генерируем миниатюры
    const thumbnailsCount = Math.min(3, photos.length - 1);
    let thumbnailsHTML = '';
    
    for (let i = 1; i <= thumbnailsCount; i++) {
      thumbnailsHTML += `
        <a href="#photo${i}" class="thumbnail">
          <img src="${photos[i]}" alt="Thumbnail" />
        </a>
      `;
    }

    if (photos.length > 4) {
      thumbnailsHTML += `
        <a href="#photo0" class="thumbnail view-all-thumbnail">
          <img src="${photos[thumbnailsCount]}" alt="Thumbnail" />
          <div class="view-all-overlay">
            ${this.getSVGIcon('images')}
            <span>${ui['view_all']}</span>
            <span class="photo-count">+${photos.length - 4}</span>
          </div>
        </a>
      `;
    } else if (photos.length === 4) {
      thumbnailsHTML += `
        <a href="#photo3" class="thumbnail">
          <img src="${photos[3]}" alt="Thumbnail" />
        </a>
      `;
    }

    // Генерируем галерею
    const galleryPhotosHTML = photos.map((photo: string, index: number) => `
      <div class="gallery-slide" id="photo${index}">
        <div class="gallery-content">
          <a href="#" class="gallery-close">×</a>
          ${index > 0 ? `<a href="#photo${index - 1}" class="gallery-nav prev">${this.getSVGIcon('chevronLeft')}</a>` : `<a href="#photo${photos.length - 1}" class="gallery-nav prev">${this.getSVGIcon('chevronLeft')}</a>`}
          <img src="${photo}" alt="Photo ${index + 1}" />
          ${index < photos.length - 1 ? `<a href="#photo${index + 1}" class="gallery-nav next">${this.getSVGIcon('chevronRight')}</a>` : `<a href="#photo0" class="gallery-nav next">${this.getSVGIcon('chevronRight')}</a>`}
          <div class="gallery-counter">${index + 1} / ${photos.length}</div>
        </div>
      </div>
    `).join('');

    // ✅ ГЕНЕРИРУЕМ БЫСТРУЮ ИНФОРМАЦИЮ (все доступные поля)
    const quickInfoItems = [];
    
    if (property.bedrooms) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('bed')}
          <div class="info-value">${Math.round(property.bedrooms)}</div>
          <div class="info-label">${ui['bedrooms']}</div>
        </div>
      `);
    }
    
    if (property.bathrooms) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('bath')}
          <div class="info-value">${Math.round(property.bathrooms)}</div>
          <div class="info-label">${ui['bathrooms']}</div>
        </div>
      `);
    }
    
    if (property.indoor_area) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('area')}
          <div class="info-value">${Math.round(property.indoor_area)}</div>
          <div class="info-label">${ui['indoor_area']} (${ui['sqm']})</div>
        </div>
      `);
    }
    
    if (property.outdoor_area) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('area')}
          <div class="info-value">${Math.round(property.outdoor_area)}</div>
          <div class="info-label">${ui['outdoor_area']} (${ui['sqm']})</div>
        </div>
      `);
    }
    
    if (property.plot_size) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('land')}
          <div class="info-value">${Math.round(property.plot_size)}</div>
          <div class="info-label">${ui['plot_size']} (${ui['sqm']})</div>
        </div>
      `);
    }
    
    // Показываем floors и floor_number только если не режим "только аренда"
    if (options.displayMode !== 'rent') {
      if (property.floors) {
        quickInfoItems.push(`
          <div class="info-card">
            ${this.getSVGIcon('building')}
            <div class="info-value">${Math.round(property.floors)}</div>
            <div class="info-label">${ui['floors']}</div>
          </div>
        `);
      }
      
      if (property.floor_number) {
        quickInfoItems.push(`
          <div class="info-card">
            ${this.getSVGIcon('building')}
            <div class="info-value">${Math.round(property.floor_number)}</div>
            <div class="info-label">${ui['floor_number']}</div>
          </div>
        `);
      }
    }
    
    if (property.parking_spaces) {
      quickInfoItems.push(`
        <div class="info-card">
          ${this.getSVGIcon('parking')}
          <div class="info-value">${Math.round(property.parking_spaces)}</div>
          <div class="info-label">${ui['parking_spaces']}</div>
        </div>
      `);
    }
    
    const quickInfoHTML = quickInfoItems.length > 0 ? `
      <div class="quick-info">
        ${quickInfoItems.join('')}
      </div>
    ` : '';

    // ✅ ГЕНЕРИРУЕМ СЕКЦИЮ ЦЕН АРЕНДЫ (ВСЕГДА ПОКАЗЫВАЕМ ФИНАЛЬНУЮ ЦЕНУ С НАЦЕНКОЙ)
    let rentalPricesHTML = '';
    if (options.displayMode !== 'sale' && options.showRentalPrices) {
      const rentalPricesContent = [];
      
      // Главная цена аренды (логика из PropertyDetails)
      let mainRentalPrice = null;
      let mainRentalPriceLabel = '';
      
      // 1. Проверяем per_night цены
      const perNightPrices = seasonalPrices.filter((p: any) => p.pricing_type === 'per_night' && p.price_per_night);
      if (perNightPrices.length > 0) {
        const minPrice = Math.min(...perNightPrices.map((p: any) => p.price_per_night));
        // ✅ ВСЕГДА применяем наценку
        const finalPrice = this.applyMarkup(minPrice, options.seasonalPricesMarkup);
        mainRentalPrice = finalPrice;
        mainRentalPriceLabel = `${ui['from']} ${this.formatPrice(finalPrice)} ${ui['per_night']}`;
      }
      
      // 2. Если нет per_night, проверяем per_period
      if (!mainRentalPrice) {
        const perPeriodPrices = seasonalPrices.filter((p: any) => p.pricing_type === 'per_period' && p.price_per_period);
        if (perPeriodPrices.length > 0) {
          const minPrice = Math.min(...perPeriodPrices.map((p: any) => p.price_per_period));
          // ✅ ВСЕГДА применяем наценку
          const finalPrice = this.applyMarkup(minPrice, options.seasonalPricesMarkup);
          mainRentalPrice = finalPrice;
          mainRentalPriceLabel = `${ui['from']} ${this.formatPrice(finalPrice)} ${ui['per_period']}`;
        }
      }
      
      // 3. Если нет сезонных, берём месячные цены (текущий месяц)
      if (!mainRentalPrice && monthlyPrices.length > 0) {
        const currentMonth = new Date().getMonth() + 1;
        const currentMonthPrice = monthlyPrices.find((p: any) => p.month_number === currentMonth);
        const basePrice = currentMonthPrice ? currentMonthPrice.price_per_month : monthlyPrices[0].price_per_month;
        
        const monthMarkup = options.monthlyPricesMarkup?.[currentMonth] || options.monthlyPricesMarkup?.[monthlyPrices[0].month_number];
        // ✅ ВСЕГДА применяем наценку
        const finalPrice = this.applyMarkup(basePrice, monthMarkup);
        mainRentalPrice = finalPrice;
        mainRentalPriceLabel = this.formatPrice(finalPrice);
      }
      
      // 4. Если нет месячных, берём годовую цену
      if (!mainRentalPrice && property.year_price) {
        // ✅ ВСЕГДА применяем наценку
        const finalPrice = this.applyMarkup(property.year_price, options.yearlyPriceMarkup);
        mainRentalPrice = finalPrice;
        mainRentalPriceLabel = `${this.formatPrice(finalPrice)} ${ui['per_year']}`;
      }
      
      // Показываем главную цену аренды
      if (mainRentalPrice) {
        rentalPricesContent.push(`
          <div class="price-card rental-price">
            <div class="price-label">${ui['rental_prices']}</div>
            <div class="price-amount">${mainRentalPriceLabel}</div>
          </div>
        `);
      }
      
      // ✅ Годовая цена (ВСЕГДА с наценкой, без исходной цены)
      if (options.includeYearlyPrice && property.year_price) {
        const finalPrice = this.applyMarkup(property.year_price, options.yearlyPriceMarkup);
        
        rentalPricesContent.push(`
          <div class="price-simple-card">
            <div class="price-header">
              <span class="price-icon">${this.getSVGIcon('calendar')}</span>
              <span class="price-title">${ui['yearly_rent']}</span>
            </div>
            <div class="price-value">${this.formatPrice(finalPrice)}</div>
          </div>
        `);
      }
      
      // ✅ Сезонные цены (ВСЕГДА с наценкой, без исходной цены)
      if (options.includeSeasonalPrices && seasonalPrices.length > 0) {
        const seasonalHTML = seasonalPrices.map((price: any) => {
          const period = this.formatDateRange(price.start_date_recurring, price.end_date_recurring, options.language);
          const originalPrice = price.pricing_type === 'per_night' ? price.price_per_night : price.price_per_period;
          const finalPrice = this.applyMarkup(originalPrice, options.seasonalPricesMarkup);
          const priceLabel = price.pricing_type === 'per_night' ? ui['per_night'] : ui['per_period'];
          
          return `
            <div class="seasonal-item">
              <div class="season-period">${this.getSVGIcon('calendar')} ${period}</div>
              <div class="season-price">${this.formatPrice(finalPrice)} ${priceLabel}</div>
            </div>
          `;
        }).join('');

        rentalPricesContent.push(`
          <div class="section">
            <details class="section-accordion">
              <summary class="section-accordion-header">
                <div class="section-title-row">
                  <span class="section-icon">${this.getSVGIcon('dollar')}</span>
                  <span class="section-title">${ui['seasonal_prices']}</span>
                </div>
                <span class="section-chevron">${this.getSVGIcon('chevronDown')}</span>
              </summary>
              <div class="section-accordion-content">
                <div class="seasonal-list">
                  ${seasonalHTML}
                </div>
              </div>
            </details>
          </div>
        `);
      }
      
      // ✅ Месячные цены (ВСЕГДА с наценкой, без исходной цены)
      if (options.includeMonthlyPrices && monthlyPrices.length > 0) {
        const monthlyHTML = monthlyPrices.map((price: any) => {
          const monthName = this.getMonthName(price.month_number, options.language);
          const originalPrice = price.price_per_month;
          const monthMarkup = options.monthlyPricesMarkup?.[price.month_number];
          const finalPrice = this.applyMarkup(originalPrice, monthMarkup);
          
          return `
            <div class="monthly-item">
              <div class="month-name">${monthName}</div>
              <div class="month-price">${this.formatPrice(finalPrice)}</div>
            </div>
          `;
        }).join('');

        rentalPricesContent.push(`
          <div class="section">
            <details class="section-accordion">
              <summary class="section-accordion-header">
                <div class="section-title-row">
                  <span class="section-icon">${this.getSVGIcon('calendar')}</span>
                  <span class="section-title">${ui['monthly_prices']}</span>
                </div>
                <span class="section-chevron">${this.getSVGIcon('chevronDown')}</span>
              </summary>
              <div class="section-accordion-content">
                <div class="monthly-grid">
                  ${monthlyHTML}
                </div>
              </div>
            </details>
          </div>
        `);
      }
      
      rentalPricesHTML = rentalPricesContent.join('');
    }

// ✅ ГЕНЕРИРУЕМ СЕКЦИЮ ПРОДАЖИ (ВСЕГДА с наценкой, без исходной цены)
let saleDetailsHTML = '';
if (options.displayMode !== 'rent' && options.showSalePrices && property.sale_price) {
  const saleDetailsItems = [];
  
  // ✅ КРИТИЧНО: Преобразуем sale_price в число перед применением наценки
  const baseSalePrice = typeof property.sale_price === 'string' 
    ? parseFloat(property.sale_price) 
    : property.sale_price;
  
  const finalSalePrice = this.applyMarkup(baseSalePrice, options.salePriceMarkup);
  
  console.log('🔥 BACKEND - Sale Price Calculation:');
  console.log('Base Sale Price:', baseSalePrice);
  console.log('Sale Markup:', options.salePriceMarkup);
  console.log('Final Sale Price:', finalSalePrice);
      let pricePerSqm = '';
      const areaForCalculation = property.plot_size || property.outdoor_area || property.indoor_area;
      if (areaForCalculation) {
        const pricePerSqmValue = finalSalePrice / areaForCalculation;
        pricePerSqm = `${this.formatPrice(pricePerSqmValue)} ${ui['price_per_sqm']}`;
      }
      
      saleDetailsItems.push(`
        <div class="price-card sale-price">
          <div class="price-label">${ui['sale_price']}</div>
          <div class="price-amount">${this.formatPrice(finalSalePrice)}</div>
          ${pricePerSqm ? `<div class="price-per-sqm">${pricePerSqm}</div>` : ''}
        </div>
      `);
      
      // Детали продажи
      const saleDetailsList = [];
      
      if (property.ownership_type) {
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('document')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['ownership_type']}</div>
              <div class="detail-value">${ui[property.ownership_type] || property.ownership_type}</div>
            </div>
          </div>
        `);
      }
      
      if (property.building_ownership) {
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('building')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['building_ownership']}</div>
              <div class="detail-value">${ui[property.building_ownership] || property.building_ownership}</div>
            </div>
          </div>
        `);
      }
      
      if (property.land_ownership) {
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('land')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['land_ownership']}</div>
              <div class="detail-value">${ui[property.land_ownership] || property.land_ownership}</div>
            </div>
          </div>
        `);
      }
      
      if (property.construction_year) {
        let constructionText = property.construction_year.toString();
        if (property.construction_month) {
          constructionText = `${this.getMonthName(property.construction_month, options.language)} ${property.construction_year}`;
        }
        
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('calendar')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['construction_year']}</div>
              <div class="detail-value">${constructionText}</div>
            </div>
          </div>
        `);
      }
      
      if (property.furniture_status) {
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('furniture')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['furniture_status']}</div>
              <div class="detail-value">${ui[property.furniture_status] || property.furniture_status}</div>
            </div>
          </div>
        `);
      }
      
      if (property.distance_to_beach) {
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('beach')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['distance_to_beach']}</div>
              <div class="detail-value">${Math.round(property.distance_to_beach)} ${ui['meters']}</div>
            </div>
          </div>
        `);
      }
      
      if (property.pets_allowed !== null && property.pets_allowed !== undefined) {
        let petsText = ui['no'];
        if (property.pets_allowed === 'yes') petsText = ui['yes'];
        else if (property.pets_allowed === 'no') petsText = ui['no'];
        else if (property.pets_allowed === 'negotiable') petsText = ui['negotiable'];
        
        if (property.pets_custom) {
          petsText += ` (${property.pets_custom})`;
        }
        
        saleDetailsList.push(`
          <div class="detail-item">
            <div class="detail-icon">${this.getSVGIcon('pet')}</div>
            <div class="detail-content">
              <div class="detail-label">${ui['pets_allowed']}</div>
              <div class="detail-value">${petsText}</div>
            </div>
          </div>
        `);
      }
      
      if (saleDetailsList.length > 0) {
        saleDetailsItems.push(`
          <div class="section">
            <details class="section-accordion" open>
              <summary class="section-accordion-header">
                <div class="section-title-row">
                  <span class="section-icon">${this.getSVGIcon('home')}</span>
                  <span class="section-title">${ui['sale_details']}</span>
                </div>
                <span class="section-chevron">${this.getSVGIcon('chevronDown')}</span>
              </summary>
              <div class="section-accordion-content">
                <div class="sale-details-grid">
                  ${saleDetailsList.join('')}
                </div>
              </div>
            </details>
          </div>
        `);
      }
      
      saleDetailsHTML = saleDetailsItems.join('');
    }

    // ✅ ГЕНЕРИРУЕМ КАЛЕНДАРЬ (только если не режим "только продажа")
    let calendarHTML = '';
    if (options.displayMode !== 'sale') {
      const calendars: string[] = [];
      const today = new Date();
      
      // ✅ Проверяем есть ли занятые даты
      const hasBlockedDates = blockedDates.length > 0;
      
      const blockedByMonth: { [key: string]: Set<number> } = {};
      
      if (hasBlockedDates) {
        blockedDates.forEach((item: any) => {
          const date = new Date(item.blocked_date);
          const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
          
          if (!blockedByMonth[monthKey]) {
            blockedByMonth[monthKey] = new Set();
          }
          
          blockedByMonth[monthKey].add(date.getUTCDate());
        });
      }

      for (let i = 0; i < 12; i++) {
        const currentMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const monthKey = `${year}-${month}`;
        
        const monthName = this.getMonthName(month + 1, options.language);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        
        let calendarDaysHTML = '';
        
        const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
        for (let j = 0; j < emptyDays; j++) {
          calendarDaysHTML += '<div class="calendar-day empty"></div>';
        }
        
        const blockedDays = blockedByMonth[monthKey] || new Set();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const isBlocked = blockedDays.has(day);
          const classes = isBlocked ? 'calendar-day blocked' : 'calendar-day';
          
          calendarDaysHTML += `<div class="${classes}">${day}</div>`;
        }

        calendars.push(`
          <div class="calendar-month" id="month${i}">
            <div class="calendar-month-header">
              <span class="calendar-month-name">${monthName} ${year}</span>
            </div>
            <div class="calendar-weekdays">
              <div>${ui['mon']}</div>
              <div>${ui['tue']}</div>
              <div>${ui['wed']}</div>
              <div>${ui['thu']}</div>
              <div>${ui['fri']}</div>
              <div>${ui['sat']}</div>
              <div>${ui['sun']}</div>
            </div>
            <div class="calendar-days">
              ${calendarDaysHTML}
            </div>
          </div>
        `);
      }

      // ✅ Дисклеймер если нет занятых дат
      const disclaimerHTML = !hasBlockedDates ? `
        <div class="calendar-disclaimer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <span>${ui['calendar_not_synced']}</span>
        </div>
      ` : '';

      calendarHTML = `
        <div class="section">
          <div class="section-header">
            <span class="section-icon">${this.getSVGIcon('calendar')}</span>
            <span class="section-title">${ui['calendar']}</span>
          </div>
          
          ${disclaimerHTML}
          
          <div class="calendar-widget">
            <input type="radio" name="cal" id="cal0" class="calendar-radio" checked />
            <input type="radio" name="cal" id="cal1" class="calendar-radio" />
            <input type="radio" name="cal" id="cal2" class="calendar-radio" />
            <input type="radio" name="cal" id="cal3" class="calendar-radio" />
            <input type="radio" name="cal" id="cal4" class="calendar-radio" />
            <input type="radio" name="cal" id="cal5" class="calendar-radio" />
            <input type="radio" name="cal" id="cal6" class="calendar-radio" />
            <input type="radio" name="cal" id="cal7" class="calendar-radio" />
            <input type="radio" name="cal" id="cal8" class="calendar-radio" />
            <input type="radio" name="cal" id="cal9" class="calendar-radio" />
            <input type="radio" name="cal" id="cal10" class="calendar-radio" />
            <input type="radio" name="cal" id="cal11" class="calendar-radio" />
            
            <div class="calendar-navigation">
              <label for="cal11" id="prev0" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal1" id="next0" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal0" id="prev1" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal2" id="next1" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal1" id="prev2" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal3" id="next2" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal2" id="prev3" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal4" id="next3" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal3" id="prev4" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal5" id="next4" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal4" id="prev5" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal6" id="next5" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal5" id="prev6" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal7" id="next6" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal6" id="prev7" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal8" id="next7" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal7" id="prev8" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal9" id="next8" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal8" id="prev9" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal10" id="next9" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal9" id="prev10" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal11" id="next10" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>

              <label for="cal10" id="prev11" class="calendar-nav-btn prev-btn">${this.getSVGIcon('chevronLeft')}</label>
              <label for="cal0" id="next11" class="calendar-nav-btn next-btn">${this.getSVGIcon('chevronRight')}</label>
            </div>
            
            <div class="calendar-months-container">
              ${calendars.join('')}
            </div>
            
            <div class="calendar-legend">
              <div class="legend-item">
                <div class="legend-box available"></div>
                <span>${ui['available']}</span>
              </div>
              <div class="legend-item">
                <div class="legend-box occupied"></div>
                <span>${ui['occupied']}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // ✅ ГЕНЕРИРУЕМ ОСОБЕННОСТИ
    const generateFeaturesSection = (type: string, titleKey: string, iconName: string, iconColor: string) => {
      const typeFeatures = features[type] || [];
      if (typeFeatures.length === 0) return '';

      const featuresHTML = typeFeatures.map((feature: string) => `
        <div class="feature-badge">
          <span class="badge-icon" style="color: ${iconColor}">${this.getSVGIcon('check')}</span>
          <span>${feature}</span>
        </div>
      `).join('');

      const count = typeFeatures.length;

      return `
        <details class="features-accordion">
          <summary class="features-accordion-header">
            <div class="accordion-title">
              <span class="accordion-icon" style="color: ${iconColor}">${this.getSVGIcon(iconName)}</span>
              <span>${ui[titleKey]}</span>
              <span class="feature-count">(${count})</span>
            </div>
            <span class="accordion-chevron">${this.getSVGIcon('chevronDown')}</span>
          </summary>
          <div class="features-accordion-content">
            <div class="features-grid">
              ${featuresHTML}
            </div>
          </div>
        </details>
      `;
    };

    let featuresHTML = '';
    if (Object.keys(features).length > 0) {
      const featuresSections = [];
      
      // Всегда показываем эти секции
      featuresSections.push(generateFeaturesSection('property', 'property_features', 'home', '#3b82f6'));
      featuresSections.push(generateFeaturesSection('outdoor', 'outdoor_amenities', 'pool', '#10b981'));
      featuresSections.push(generateFeaturesSection('location', 'location_features', 'location', '#f59e0b'));
      featuresSections.push(generateFeaturesSection('views', 'views', 'home', '#8b5cf6'));
      
      // Показываем "rental" только если не режим "только продажа"
      if (options.displayMode !== 'sale') {
        featuresSections.push(generateFeaturesSection('rental', 'rental_conditions', 'check', '#ec4899'));
      }
      
      const validSections = featuresSections.filter(s => s !== '');
      
      if (validSections.length > 0) {
        featuresHTML = `
          <div class="section">
            <div class="section-header">
              <span class="section-icon">${this.getSVGIcon('check')}</span>
              <span class="section-title">${ui['features']}</span>
            </div>
            ${validSections.join('')}
          </div>
        `;
      }
    }

    // ✅ СОБИРАЕМ ФИНАЛЬНЫЙ HTML
    return `
<!DOCTYPE html>
<html lang="${options.language}" dir="${options.language === 'he' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${propertyName}${!forAgent ? ' - NOVA Estate' : ''}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f8f9fa;
      color: #212529;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
    }

    /* Header */
    .header-bar {
      background: #ffffff;
      padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo img {
      height: 40px;
      width: auto;
    }

    /* Property Header */
    .property-header {
      padding: 24px 20px 16px;
      background: #ffffff;
    }

    .property-title-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .property-title {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.3;
    }

    .property-number {
      font-size: 18px;
      font-weight: 600;
      color: #6366f1;
      padding: 4px 12px;
      background: #eef2ff;
      border-radius: 8px;
    }

    .property-location {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      font-size: 15px;
    }

    .property-location svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    /* Gallery */
    .gallery-container {
      padding: 0 20px 20px;
    }

    .main-photo {
      width: 100%;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    }

    .main-photo a {
      display: block;
    }

    .main-photo img {
      width: 100%;
      height: 400px;
      object-fit: cover;
      display: block;
    }

    .thumbnails-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .thumbnail {
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      position: relative;
      display: block;
      text-decoration: none;
    }

    .thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .view-all-thumbnail {
      position: relative;
    }

    .view-all-thumbnail img {
      filter: blur(3px) brightness(0.7);
    }

    .view-all-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #ffffff;
      text-align: center;
      background: rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }

    .view-all-overlay svg {
      width: 28px;
      height: 28px;
    }

    .view-all-overlay span {
      font-size: 12px;
      font-weight: 600;
    }

    .photo-count {
      font-size: 18px !important;
      font-weight: 700 !important;
    }

    /* Gallery Modal */
    .gallery-slide {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      overflow: hidden;
    }

    .gallery-slide:target {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gallery-content {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gallery-slide img {
      max-width: 90%;
      max-height: 90vh;
      object-fit: contain;
    }

    .gallery-close {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      color: #ffffff;
      font-size: 28px;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      z-index: 10;
    }

    .gallery-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      color: #ffffff;
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
    }

    .gallery-nav.prev {
      left: 20px;
    }

    .gallery-nav.next {
      right: 20px;
    }

    .gallery-nav svg {
      width: 24px;
      height: 24px;
    }

    .gallery-counter {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      backdrop-filter: blur(10px);
    }

    .map-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: #3b82f6;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      margin-top: 12px;
    }

    .map-button svg {
      width: 18px;
      height: 18px;
    }

    /* Quick Info */
    .quick-info {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      padding: 20px;
      background: #f8fafc;
    }

    .info-card {
      background: #ffffff;
      padding: 20px 16px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .info-card svg {
      width: 32px;
      height: 32px;
      margin-bottom: 8px;
      color: #3b82f6;
    }

    .info-value {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .info-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    /* Content */
    .content {
      padding: 0 20px 24px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .section-icon {
      width: 24px;
      height: 24px;
      color: #3b82f6;
    }

    .section-icon svg {
      width: 100%;
      height: 100%;
    }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .description-text {
      font-size: 15px;
      line-height: 1.7;
      color: #475569;
      white-space: pre-wrap;
    }

    /* Price Cards */
    .price-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      border-radius: 16px;
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
      margin-bottom: 12px;
    }

    .rental-price {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .sale-price {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .price-label {
      font-size: 13px;
      opacity: 0.9;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .price-amount {
      font-size: 28px;
      font-weight: 700;
    }

    .price-per-sqm {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 4px;
    }

    /* ✅ Simple Price Cards (no markup display) */
    .price-simple-card {
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .price-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .price-icon {
      width: 20px;
      height: 20px;
      color: #3b82f6;
    }

    .price-icon svg {
      width: 100%;
      height: 100%;
    }

    .price-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .price-value {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
    }

    /* Sale Details Grid */
    .sale-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .detail-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 12px;
    }

    .detail-icon {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border-radius: 10px;
      color: #3b82f6;
    }

    .detail-icon svg {
      width: 24px;
      height: 24px;
    }

    .detail-content {
      flex: 1;
    }

    .detail-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 500;
    }

    .detail-value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 600;
    }

    /* Accordions */
    details {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    summary {
      padding: 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      list-style: none;
      user-select: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary:active {
      background: #f8fafc;
    }

    .section-title-row, .accordion-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .section-title-row {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }

    .accordion-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .accordion-icon {
      width: 24px;
      height: 24px;
    }

    .accordion-icon svg {
      width: 100%;
      height: 100%;
    }

    .feature-count {
      font-size: 14px;
      color: #94a3b8;
      font-weight: 500;
    }

    .accordion-chevron, .section-chevron {
      width: 20px;
      height: 20px;
      color: #94a3b8;
      transition: transform 0.3s ease;
    }

    .accordion-chevron svg, .section-chevron svg {
      width: 100%;
      height: 100%;
    }

    details[open] .accordion-chevron,
    details[open] .section-chevron {
      transform: rotate(180deg);
    }

    .section-accordion-content, .features-accordion-content {
      padding: 0 16px 16px;
    }

    /* ✅ Seasonal & Monthly Prices (simple, no markup display) */
    .seasonal-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .seasonal-item {
      background: #f8fafc;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .season-period {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #475569;
      font-weight: 600;
    }

    .season-period svg {
      width: 16px;
      height: 16px;
      color: #94a3b8;
    }

    .season-price {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }

    .monthly-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }

    .monthly-item {
      background: #f8fafc;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }

    .month-name {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .month-price {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }

    /* Calendar Disclaimer */
    .calendar-disclaimer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 12px;
      color: #92400e;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 500;
    }

    .calendar-disclaimer svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: #f59e0b;
    }

    /* Calendar */
    .calendar-widget {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px;
      position: relative;
    }

    .calendar-radio {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .calendar-navigation {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      position: relative;
    }

    .calendar-nav-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #475569;
      position: absolute;
    }

    .calendar-nav-btn.prev-btn {
      left: 0;
    }

    .calendar-nav-btn.next-btn {
      right: 0;
    }

    .calendar-nav-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Show navigation for current month */
    #cal0:checked ~ .calendar-navigation #prev0,
    #cal0:checked ~ .calendar-navigation #next0 { display: flex; }
    #cal1:checked ~ .calendar-navigation #prev1,
    #cal1:checked ~ .calendar-navigation #next1 { display: flex; }
    #cal2:checked ~ .calendar-navigation #prev2,
    #cal2:checked ~ .calendar-navigation #next2 { display: flex; }
    #cal3:checked ~ .calendar-navigation #prev3,
    #cal3:checked ~ .calendar-navigation #next3 { display: flex; }
    #cal4:checked ~ .calendar-navigation #prev4,
    #cal4:checked ~ .calendar-navigation #next4 { display: flex; }
    #cal5:checked ~ .calendar-navigation #prev5,
    #cal5:checked ~ .calendar-navigation #next5 { display: flex; }
    #cal6:checked ~ .calendar-navigation #prev6,
    #cal6:checked ~ .calendar-navigation #next6 { display: flex; }
    #cal7:checked ~ .calendar-navigation #prev7,
    #cal7:checked ~ .calendar-navigation #next7 { display: flex; }
    #cal8:checked ~ .calendar-navigation #prev8,
    #cal8:checked ~ .calendar-navigation #next8 { display: flex; }
    #cal9:checked ~ .calendar-navigation #prev9,
    #cal9:checked ~ .calendar-navigation #next9 { display: flex; }
    #cal10:checked ~ .calendar-navigation #prev10,
    #cal10:checked ~ .calendar-navigation #next10 { display: flex; }
    #cal11:checked ~ .calendar-navigation #prev11,
    #cal11:checked ~ .calendar-navigation #next11 { display: flex; }

    .calendar-months-container {
      position: relative;
      min-height: 300px;
    }

    .calendar-month {
      display: none;
    }

    /* Show current month */
    #cal0:checked ~ .calendar-months-container #month0 { display: block; }
    #cal1:checked ~ .calendar-months-container #month1 { display: block; }
    #cal2:checked ~ .calendar-months-container #month2 { display: block; }
    #cal3:checked ~ .calendar-months-container #month3 { display: block; }
    #cal4:checked ~ .calendar-months-container #month4 { display: block; }
    #cal5:checked ~ .calendar-months-container #month5 { display: block; }
    #cal6:checked ~ .calendar-months-container #month6 { display: block; }
    #cal7:checked ~ .calendar-months-container #month7 { display: block; }
    #cal8:checked ~ .calendar-months-container #month8 { display: block; }
    #cal9:checked ~ .calendar-months-container #month9 { display: block; }
    #cal10:checked ~ .calendar-months-container #month10 { display: block; }
    #cal11:checked ~ .calendar-months-container #month11 { display: block; }

    .calendar-month-header {
      text-align: center;
      margin-bottom: 16px;
    }

    .calendar-month-name {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }

    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 8px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }

    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border-radius: 8px;
      color: #1e293b;
      font-weight: 500;
    }

    .calendar-day.empty {
      visibility: hidden;
    }

    .calendar-day.blocked {
      background: #fee2e2;
      color: #991b1b;
    }

    .calendar-legend {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #64748b;
    }

    .legend-box {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .legend-box.available {
      background: #ffffff;
      border: 1px solid #cbd5e1;
    }

    .legend-box.occupied {
      background: #fee2e2;
    }

    /* Features */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }

    .feature-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 13px;
      color: #475569;
    }

    .badge-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .badge-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Footer */
    .footer {
      padding: 32px 20px;
      text-align: center;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .footer-logo {
      margin-bottom: 12px;
    }

    .footer-logo img {
      height: 50px;
      width: auto;
    }

    .footer-text {
      font-size: 13px;
      color: #94a3b8;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .property-title {
        font-size: 24px;
      }

      .main-photo img {
        height: 300px;
      }

      .thumbnails-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .quick-info {
        grid-template-columns: repeat(2, 1fr);
      }

      .info-card {
        padding: 16px 12px;
      }

      .info-value {
        font-size: 20px;
      }

      .features-grid {
        grid-template-columns: 1fr;
      }

      .sale-details-grid {
        grid-template-columns: 1fr;
      }

      .monthly-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${!forAgent ? `
    <div class="header-bar">
      <div class="logo">
        <img src="${logoBase64}" alt="NOVA Estate" />
      </div>
    </div>
    ` : ''}

    <div class="property-header">
      <div class="property-title-row">
        <h1 class="property-title">${propertyName}</h1>
        ${propertyNumber ? `<span class="property-number">#${propertyNumber}</span>` : ''}
      </div>
      <div class="property-location">
        ${this.getSVGIcon('location')}
        <span>${region}</span>
      </div>
    </div>

    <div class="gallery-container">
      <div class="main-photo">
        <a href="#photo0">
          <img src="${mainPhoto}" alt="${propertyName}" />
        </a>
      </div>
      ${thumbnailsHTML ? `
        <div class="thumbnails-grid">
          ${thumbnailsHTML}
        </div>
      ` : ''}
      ${property.google_maps_link ? `
        <a href="${property.google_maps_link}" target="_blank" rel="noopener" class="map-button">
          ${this.getSVGIcon('map')}
          ${ui['open_map']}
        </a>
      ` : ''}
    </div>

    ${quickInfoHTML}

    <div class="content">
      ${description ? `
        <div class="section">
          <div class="section-header">
            <span class="section-icon">${this.getSVGIcon('home')}</span>
            <span class="section-title">${ui['description']}</span>
          </div>
          <div class="description-text">${description}</div>
        </div>
      ` : ''}

      ${saleDetailsHTML}
      ${rentalPricesHTML}
      ${calendarHTML}
      ${featuresHTML}
    </div>

    ${!forAgent ? `
    <div class="footer">
      <div class="footer-logo">
        <img src="${logoBase64}" alt="NOVA Estate" />
      </div>
      <div class="footer-text">&copy; ${new Date().getFullYear()} NOVA Estate. ${ui['all_rights_reserved']}</div>
    </div>
    ` : ''}
  </div>

  ${galleryPhotosHTML}
</body>
</html>
    `;
  }
}

export default new HTMLGeneratorService();