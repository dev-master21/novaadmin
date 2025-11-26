import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import logger from '../utils/logger';

export class PDFService {
  /**
   * Генерация PDF через фронтенд (как Print)
   */
  static async generateAgreementPDF(
    agreementId: number
  ): Promise<string> {
    try {
      const uploadsDir = path.join(__dirname, '../../public/uploads/agreements-pdf');
      await fs.ensureDir(uploadsDir);

      const filename = `agreement-${agreementId}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const publicPath = `/uploads/agreements-pdf/${filename}`;

      // Получаем внутренний ключ из переменных окружения
      const internalKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
      
      // URL фронтенда для печати с внутренним ключом
      const printUrl = `https://admin.novaestate.company/agreement-print/${agreementId}?internalKey=${internalKey}`;

      logger.info(`Opening print URL: ${printUrl}`);

      // Запускаем Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });

      const page = await browser.newPage();
      
      // Устанавливаем viewport для правильного рендеринга
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 2
      });

      // Открываем страницу печати
      await page.goto(printUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      logger.info('Page loaded successfully');
      
      // Даем дополнительное время на рендеринг React и загрузку изображений
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info('Starting PDF generation...');

      // Генерируем PDF (как браузерная печать)
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      });

      await browser.close();

      logger.info(`PDF generated successfully: ${publicPath}`);
      return publicPath;

    } catch (error) {
      logger.error('PDF generation error:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  /**
   * Удаление старого PDF файла
   */
  static async deleteOldPDF(pdfPath: string): Promise<void> {
    try {
      if (!pdfPath) return;
      
      const fullPath = path.join(__dirname, '../../public', pdfPath);
      
      if (await fs.pathExists(fullPath)) {
        await fs.unlink(fullPath);
        logger.info(`Old PDF deleted: ${pdfPath}`);
      }
    } catch (error) {
      logger.error('Error deleting old PDF:', error);
    }
  }
  /**
 * Генерация PDF для инвойса
 */
static async generateInvoicePDF(invoiceId: number): Promise<string> {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/invoices-pdf');
    await fs.ensureDir(uploadsDir);

    const filename = `invoice-${invoiceId}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    const publicPath = `/uploads/invoices-pdf/${filename}`;

    const internalKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    const htmlUrl = `https://admin.novaestate.company/api/financial-documents/invoices/${invoiceId}/html?internalKey=${internalKey}`;

    logger.info(`Opening invoice HTML URL: ${htmlUrl}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });

    await page.goto(htmlUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    logger.info('Invoice HTML loaded successfully');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    await browser.close();

    logger.info(`Invoice PDF generated successfully: ${publicPath}`);
    return publicPath;

  } catch (error) {
    logger.error('Invoice PDF generation error:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}

/**
 * Генерация PDF для чека
 */
static async generateReceiptPDF(receiptId: number): Promise<string> {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/receipts-pdf');
    await fs.ensureDir(uploadsDir);

    const filename = `receipt-${receiptId}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    const publicPath = `/uploads/receipts-pdf/${filename}`;

    const internalKey = process.env.INTERNAL_API_KEY || 'your-secret-internal-key';
    const htmlUrl = `https://admin.novaestate.company/api/financial-documents/receipts/${receiptId}/html?internalKey=${internalKey}`;

    logger.info(`Opening receipt HTML URL: ${htmlUrl}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });

    await page.goto(htmlUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    logger.info('Receipt HTML loaded successfully');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    await browser.close();

    logger.info(`Receipt PDF generated successfully: ${publicPath}`);
    return publicPath;

  } catch (error) {
    logger.error('Receipt PDF generation error:', error);
    throw new Error('Failed to generate receipt PDF');
  }
}

}