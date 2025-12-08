// backend/src/routes/financialDocuments.routes.ts
import { Router } from 'express';
import { AuthRequest } from '../types';
import financialDocumentsController from '../controllers/financialDocuments.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import multer from 'multer';

// Настройка multer для загрузки файлов чеков
const storage = multer.memoryStorage();
const uploadReceiptFiles = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB на файл
    files: 10 // Максимум 10 файлов
  },
  fileFilter: (_req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  }
});

const router = Router();

// ========== ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ) - ДОЛЖНЫ БЫТЬ ПЕРВЫМИ! ==========

// HTML endpoints для Puppeteer (БЕЗ авторизации, но с internal key)
router.get('/invoices/:id/html', (req, res) => {
  financialDocumentsController.getInvoiceHTML(req as AuthRequest, res);
});

router.get('/receipts/:id/html', (req, res) => {
  financialDocumentsController.getReceiptHTML(req as AuthRequest, res);
});

// Публичные эндпоинты для верификации (БЕЗ авторизации)
router.get('/public/invoice/:uuid', (req, res) => {
  financialDocumentsController.getInvoiceByUuid(req as AuthRequest, res);
});

router.get('/public/receipt/:uuid', (req, res) => {
  financialDocumentsController.getReceiptByUuid(req as AuthRequest, res);
});

router.get('/public/invoice/:uuid/pdf', (req, res) => {
  financialDocumentsController.downloadInvoicePDFByUuid(req as AuthRequest, res);
});

router.get('/public/receipt/:uuid/pdf', (req, res) => {
  financialDocumentsController.downloadReceiptPDFByUuid(req as AuthRequest, res);
});

// ========== ЗАЩИЩЕННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ) ==========
// Все роуты ниже этой строки требуют авторизации
router.use(authenticate);

// ========== SAVED BANK DETAILS ==========

// Получить все сохранённые банковские реквизиты
router.get('/saved-bank-details',
  requirePermission('financial_documents.view_invoices'),
  (req, res) => {
    financialDocumentsController.getAllSavedBankDetails(req as AuthRequest, res);
  }
);

// Получить сохранённые банковские реквизиты по ID
router.get('/saved-bank-details/:id',
  requirePermission('financial_documents.view_invoices'),
  (req, res) => {
    financialDocumentsController.getSavedBankDetailsById(req as AuthRequest, res);
  }
);

// Создать сохранённые банковские реквизиты
router.post('/saved-bank-details',
  requirePermission('financial_documents.create_invoices'),
  (req, res) => {
    financialDocumentsController.createSavedBankDetails(req as AuthRequest, res);
  }
);

// Обновить сохранённые банковские реквизиты
router.put('/saved-bank-details/:id',
  requirePermission('financial_documents.edit_invoices'),
  (req, res) => {
    financialDocumentsController.updateSavedBankDetails(req as AuthRequest, res);
  }
);

// Удалить сохранённые банковские реквизиты
router.delete('/saved-bank-details/:id',
  requirePermission('financial_documents.delete_invoices'),
  (req, res) => {
    financialDocumentsController.deleteSavedBankDetails(req as AuthRequest, res);
  }
);

// ========== INVOICES ==========

// Получить список инвойсов
router.get('/invoices', 
  requirePermission('financial_documents.view_invoices'), 
  (req, res) => {
    financialDocumentsController.getAllInvoices(req as AuthRequest, res);
  }
);

// Получить инвойс по ID
router.get('/invoices/:id', 
  requirePermission('financial_documents.view_invoices'), 
  (req, res) => {
    financialDocumentsController.getInvoiceById(req as AuthRequest, res);
  }
);

// Получить статусы оплаты позиций инвойса
router.get('/invoices/:id/items-payment-status',
  requirePermission('financial_documents.view_invoices'),
  (req, res) => {
    financialDocumentsController.getInvoiceItemsPaymentStatus(req as AuthRequest, res);
  }
);

// Создать инвойс
router.post('/invoices', 
  requirePermission('financial_documents.create_invoices'), 
  (req, res) => {
    financialDocumentsController.createInvoice(req as AuthRequest, res);
  }
);

// Обновить инвойс
router.put('/invoices/:id', 
  requirePermission('financial_documents.edit_invoices'), 
  (req, res) => {
    financialDocumentsController.updateInvoice(req as AuthRequest, res);
  }
);

// Удалить инвойс
router.delete('/invoices/:id', 
  requirePermission('financial_documents.delete_invoices'), 
  (req, res) => {
    financialDocumentsController.deleteInvoice(req as AuthRequest, res);
  }
);

// Получить инвойсы по договору
router.get('/invoices-by-agreement/:agreementId', 
  requirePermission('financial_documents.view_invoices'), 
  (req, res) => {
    financialDocumentsController.getInvoicesByAgreement(req as AuthRequest, res);
  }
);

// PDF download endpoint
router.get('/invoices/:id/pdf', 
  requirePermission('financial_documents.view_invoices'),
  (req, res) => {
    financialDocumentsController.downloadInvoicePDF(req as AuthRequest, res);
  }
);

// Проверить существующие инвойсы для договора
router.get('/agreements/:agreementId/check-existing-invoices',
  requirePermission('financial_documents.view_invoices'),
  (req, res) => {
    financialDocumentsController.checkExistingInvoicesForAgreement(req as AuthRequest, res);
  }
);

// ========== RECEIPTS ==========

// Получить список чеков
router.get('/receipts', 
  requirePermission('financial_documents.view_receipts'), 
  (req, res) => {
    financialDocumentsController.getAllReceipts(req as AuthRequest, res);
  }
);

// Получить чек по ID
router.get('/receipts/:id', 
  requirePermission('financial_documents.view_receipts'), 
  (req, res) => {
    financialDocumentsController.getReceiptById(req as AuthRequest, res);
  }
);

// Создать чек
router.post('/receipts', 
  requirePermission('financial_documents.create_receipts'), 
  (req, res) => {
    financialDocumentsController.createReceipt(req as AuthRequest, res);
  }
);

// Обновить чек
router.put('/receipts/:id', 
  requirePermission('financial_documents.edit_receipts'), 
  (req, res) => {
    financialDocumentsController.updateReceipt(req as AuthRequest, res);
  }
);

// Загрузить файлы для чека
router.post('/receipts/:id/upload-files', 
  requirePermission('financial_documents.edit_receipts'),
  uploadReceiptFiles.any(),
  (req, res) => {
    financialDocumentsController.uploadReceiptFiles(req as AuthRequest, res);
  }
);

// Удалить чек
router.delete('/receipts/:id', 
  requirePermission('financial_documents.delete_receipts'), 
  (req, res) => {
    financialDocumentsController.deleteReceipt(req as AuthRequest, res);
  }
);

// PDF download endpoint
router.get('/receipts/:id/pdf',
  requirePermission('financial_documents.view_receipts'),
  (req, res) => {
    financialDocumentsController.downloadReceiptPDF(req as AuthRequest, res);
  }
);

export default router;