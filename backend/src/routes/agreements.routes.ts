// backend/src/routes/agreements.routes.ts
import { Router } from 'express';
import { AuthRequest } from '../types';
import agreementsController from '../controllers/agreements.controller';
import agreementTemplatesController from '../controllers/agreementTemplates.controller';
import agreementSignaturesController from '../controllers/agreementSignatures.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { uploadPartyDocument } from '../middlewares/upload.middleware';
import multer from 'multer';

// Настройка multer для загрузки документов сторон при создании договора
const storage = multer.memoryStorage(); // Храним в памяти для обработки
const uploadPartyDocs = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB на файл
    files: 20 // Максимум 20 файлов
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

// ========== ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ) ==========

// Публичный endpoint для страницы верификации договора
router.get('/verify/:verifyLink', (req, res) => {
  agreementsController.getAgreementByVerifyLink(req as AuthRequest, res);
});

// Публичное скачивание PDF (по verify_link или signature_link)
router.get('/download-pdf/:link', (req, res) => {
  agreementsController.downloadPDFPublic(req as AuthRequest, res);
});

// ВНУТРЕННИЙ endpoint для Puppeteer (генерация PDF)
router.get('/:id/internal', (req, res) => {
  agreementsController.getAgreementInternal(req as AuthRequest, res);
});

// Публичный endpoint для получения договора с токеном (для печати пользователем)
router.get('/:id/public', (req, res) => {
  agreementsController.getPublicAgreement(req as AuthRequest, res);
});

// Получить договор по ссылке подписи
router.get('/by-signature-link/:link', (req, res) => {
  agreementsController.getPublicAgreementBySignatureLink(req as AuthRequest, res);
});

// Получить подпись по ссылке
router.get('/signatures/link/:link', (req, res) => {
  agreementSignaturesController.getByLink(req as AuthRequest, res);
});

// Подписать договор по ID подписи (публичный)
router.post('/signatures/:id/sign', (req, res) => {
  agreementSignaturesController.signById(req as AuthRequest, res);
});

// Получить договор по публичной ссылке
router.get('/public/:link', (req, res) => {
  agreementsController.getByPublicLink(req as AuthRequest, res);
});

// Публичный endpoint для получения договора с токеном (для печати)
router.get('/:id/public', (req, res) => {
  agreementsController.getPublicAgreement(req as AuthRequest, res);
});

// ========== ЗАЩИЩЕННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ) ==========
router.use(authenticate);

// Создать временный токен для печати (требует авторизации)
router.post('/:id/print-token', (req, res) => {
  agreementsController.createPrintToken(req as AuthRequest, res);
});

// Получить HTML для печати
router.get('/:id/html', (req, res) => {
  agreementsController.getAgreementHTML(req as AuthRequest, res);
});

// === СПЕЦИАЛЬНЫЕ РОУТЫ (должны быть ДО параметризованных) ===

// Получение объектов недвижимости
router.get('/properties', (req, res) => {
  agreementsController.getProperties(req as AuthRequest, res);
});

// === ШАБЛОНЫ (конкретные пути) ===
router.get('/templates/list', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.getAll(req as AuthRequest, res);
});

router.post('/templates', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.create(req as AuthRequest, res);
});

router.get('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.getById(req as AuthRequest, res);
});

router.put('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.update(req as AuthRequest, res);
});

router.delete('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.delete(req as AuthRequest, res);
});

// === ПОДПИСИ (конкретные действия) ===
router.put('/signatures/:id', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.update(req as AuthRequest, res);
});

router.post('/signatures/:id/regenerate', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.regenerateLink(req as AuthRequest, res);
});

router.delete('/signatures/:id', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.delete(req as AuthRequest, res);
});

// === СТОРОНЫ ДОГОВОРА (конкретные действия) ===
// Загрузка документа стороны
router.post('/parties/:partyId/document', 
  uploadPartyDocument.single('document'), 
  (req, res) => {
    agreementsController.uploadPartyDocument(req as AuthRequest, res);
  }
);

// Удаление документа стороны
router.delete('/parties/:partyId/document', (req, res) => {
  agreementsController.deletePartyDocument(req as AuthRequest, res);
});

// === ДОГОВОРЫ (основные операции) ===

// Получить список всех договоров
router.get('/', requirePermission('agreements.view'), (req, res) => {
  agreementsController.getAll(req as AuthRequest, res);
});

// Создать договор
router.post('/', 
  requirePermission('agreements.create'),
  uploadPartyDocs.any(), // Принимаем любые файлы
  (req, res) => {
    agreementsController.create(req as AuthRequest, res);
  }
);

// === ОПЕРАЦИИ С КОНКРЕТНЫМ ДОГОВОРОМ (параметризованные роуты в конце) ===

// Загрузка множественных документов
router.post('/:agreementId/upload-documents', 
  requirePermission('agreements.create'),
  uploadPartyDocs.any(),
  (req, res) => {
    agreementsController.uploadAgreementDocuments(req as AuthRequest, res);
  }
);

// Создать подписи для договора
router.post('/:id/signatures', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementsController.createSignatures(req as AuthRequest, res);
});

// Скачать PDF договора
router.get('/:id/pdf', requirePermission('agreements.view'), (req, res) => {
  agreementsController.downloadPDF(req as AuthRequest, res);
});

// Получить договор по ID
router.get('/:id', requirePermission('agreements.view'), (req, res) => {
  agreementsController.getById(req as AuthRequest, res);
});

// Обновить договор
router.put('/:id', requirePermission('agreements.edit'), (req, res) => {
  agreementsController.update(req as AuthRequest, res);
});

// Удалить договор
router.delete('/:id', requirePermission('agreements.delete'), (req, res) => {
  agreementsController.delete(req as AuthRequest, res);
});

// Отправить уведомление агенту
router.post('/:id/notify-agent', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementsController.notifyAgent(req as AuthRequest, res);
});

router.get('/:id/with-parties',
  requirePermission('agreements.view'),
  (req, res) => {
    agreementsController.getAgreementWithParties(req as AuthRequest, res);
  }
);

// AI редактирование договоров
router.post('/:id/ai-edit', requirePermission('agreements.edit'), (req, res) => {
  agreementsController.aiEdit(req as AuthRequest, res);
});

router.post('/:id/ai-edit/apply', requirePermission('agreements.edit'), (req, res) => {
  agreementsController.applyAiEdit(req as AuthRequest, res);
});

router.get('/:id/ai-edit/history', requirePermission('agreements.view'), (req, res) => {
  agreementsController.getAiEditHistory(req as AuthRequest, res);
});


export default router;