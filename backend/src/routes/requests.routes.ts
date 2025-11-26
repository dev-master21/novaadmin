import { Router } from 'express';
import { AuthRequest } from '../types';
import requestsController from '../controllers/requests.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import multer from 'multer';
import path from 'path';

// Настройка multer для загрузки паспортов (для защищенных роутов)
const storageMemory = multer.memoryStorage();
const uploadPassport = multer({
  storage: storageMemory,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  }
});

// Настройка multer для публичной загрузки паспортов
const storageDisk = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/request-passports'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `passport-${uniqueSuffix}${ext}`);
  }
});

const uploadPublic = multer({
  storage: storageDisk,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  }
});

const router = Router();

// ========== ПУБЛИЧНЫЕ РОУТЫ (БЕЗ АВТОРИЗАЦИИ) ==========

// Получить данные заявки для создания договора
router.get('/public/:uuid/for-agreement', (req, res) => {
  requestsController.getRequestForAgreement(req as AuthRequest, res);
});

// Связать договор с заявкой
router.post('/public/:uuid/link-agreement', (req, res) => {
  requestsController.linkAgreementToRequest(req as AuthRequest, res);
});

// Получить заявку по UUID
router.get('/public/:uuid', (req, res) => {
  requestsController.getByUuid(req as AuthRequest, res);
});

router.get('/by-agreement/:agreementId', requestsController.getByAgreementId);


// Получить историю чата
router.get('/chat/:chatUuid', (req, res) => {
  requestsController.getChatHistory(req as AuthRequest, res);
});

// Обновить поле заявки
router.put('/public/:uuid/field', (req, res) => {
  requestsController.updateField(req as AuthRequest, res);
});

// Получить историю изменений поля
router.get('/public/:uuid/field-history/:fieldName', (req, res) => {
  requestsController.getFieldHistory(req as AuthRequest, res);
});

// Публичная загрузка паспорта (новый роут без авторизации)
router.post('/public/:uuid/upload-passport', uploadPublic.single('file'), (req, res) => {
  requestsController.uploadPassportPublic(req as AuthRequest, res);
});

// Загрузить паспорт клиента (старый роут для совместимости)
router.post('/public/:uuid/upload-client-passport', uploadPassport.single('passport'), (req, res) => {
  requestsController.uploadClientPassport(req as AuthRequest, res);
});

// Загрузить паспорт агента (старый роут для совместимости)
router.post('/public/:uuid/upload-agent-passport', uploadPassport.single('passport'), (req, res) => {
  requestsController.uploadAgentPassport(req as AuthRequest, res);
});

// Добавить предложенный вариант
router.post('/public/:uuid/add-property', (req, res) => {
  requestsController.addProposedProperty(req as AuthRequest, res);
});

// Обновить статус заявки (с поддержкой финансовых данных)
router.put('/public/:uuid/status', (req, res) => {
  requestsController.updateStatus(req as AuthRequest, res);
});

// Запрос на создание договора
router.post('/public/:uuid/request-contract', (req, res) => {
  requestsController.requestContract(req as AuthRequest, res);
});

// Получить список объектов для выбора
router.get('/properties', (req, res) => {
  requestsController.getProperties(req as AuthRequest, res);
});

// Получить список групп агентов (публичный для создания заявки)
router.get('/agent-groups', (req, res) => {
  requestsController.getAgentGroups(req as AuthRequest, res);
});

// ========== ЗАЩИЩЕННЫЕ РОУТЫ (С АВТОРИЗАЦИЕЙ) ==========
router.use(authenticate);

// Получить все заявки
router.get('/', requirePermission('requests.view'), (req, res) => {
  requestsController.getAll(req as AuthRequest, res);
});

// Получить заявку по ID
router.get('/:id', requirePermission('requests.view'), (req, res) => {
  requestsController.getById(req as AuthRequest, res);
});

// Удалить заявку
router.delete('/:id', requirePermission('requests.delete'), (req, res) => {
  requestsController.delete(req as AuthRequest, res);
});

// Создать заявку из WhatsApp
router.post('/create-whatsapp', requirePermission('requests.create'), (req, res) => {
  requestsController.createWhatsAppRequest(req as AuthRequest, res);
});

// Загрузить скриншот WhatsApp
router.post('/upload-whatsapp-screenshot', requirePermission('requests.create'), uploadPassport.single('screenshot'), (req, res) => {
  requestsController.uploadWhatsAppScreenshot(req as AuthRequest, res);
});

export default router;