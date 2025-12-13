// backend/src/routes/partners.routes.ts
import { Router } from 'express';
import partnersController, { upload } from '../controllers/partners.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// ========== ПУБЛИЧНЫЕ ЭНДПОИНТЫ (ДО authenticate) ==========

/**
 * Получить партнёра по домену (публичный endpoint для загрузки логотипа)
 * GET /api/partners/by-domain/:domain
 */
router.get('/by-domain/:domain', partnersController.getByDomain);

// ========== ЗАЩИЩЁННЫЕ ЭНДПОИНТЫ (применяем authenticate ко всем) ==========
router.use(authenticate);

/**
 * Получить всех партнёров
 * GET /api/partners
 */
router.get('/', partnersController.getAll);

/**
 * Получить партнёра текущего пользователя
 * GET /api/partners/current
 * ВАЖНО: Должен быть ДО /:id чтобы не перехватывался как ID
 */
router.get('/current', partnersController.getCurrentPartner);

/**
 * Получить партнёра по ID
 * GET /api/partners/:id
 */
router.get('/:id', partnersController.getById);

/**
 * Создать партнёра с загрузкой логотипа
 * POST /api/partners
 */
router.post('/', upload.single('logo'), partnersController.create);

/**
 * Обновить партнёра
 * PUT /api/partners/:id
 */
router.put('/:id', upload.single('logo'), partnersController.update);

/**
 * Удалить партнёра
 * DELETE /api/partners/:id
 */
router.delete('/:id', partnersController.delete);

export default router;