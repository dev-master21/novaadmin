// backend/src/routes/propertySearch.routes.ts
import { Router } from 'express';
import propertySearchController from '../controllers/propertySearch.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

// AI поиск с диалогами
router.post('/ai', propertySearchController.searchWithAI.bind(propertySearchController));

// Режим клиент-агент
router.post('/chat', propertySearchController.chatWithClient.bind(propertySearchController));

// Мануальный поиск
router.post('/manual', propertySearchController.searchManual.bind(propertySearchController));

// Список диалогов
router.get('/conversations', propertySearchController.getConversations.bind(propertySearchController));

// Получить конкретный диалог
router.get('/conversations/:id', propertySearchController.getConversationById.bind(propertySearchController));

// Удалить (архивировать) диалог
router.delete('/conversations/:id', propertySearchController.deleteConversation.bind(propertySearchController));

// История поисков
router.get('/history', propertySearchController.getSearchHistory.bind(propertySearchController));

// ✅ НОВОЕ: Получить конкретный лог по ID
router.get('/history/:id', propertySearchController.getSearchHistoryById.bind(propertySearchController));

// ✅ НОВОЕ: Удалить лог из истории
router.delete('/history/:id', propertySearchController.deleteSearchHistory.bind(propertySearchController));

// Расчет расстояния до пляжа
router.post('/calculate-beach-distance', propertySearchController.calculateBeachDistance.bind(propertySearchController));

// Найти доступные периоды для объекта
router.post('/available-periods', authenticate, propertySearchController.findAvailablePeriods.bind(propertySearchController));

// ВРЕМЕННЫЙ роут для отладки
router.get('/debug-pricing/:propertyId', authenticate, propertySearchController.debugPricing.bind(propertySearchController));

// Получить последний AI interpretation
router.get('/last-ai-interpretation', propertySearchController.getLastAIInterpretation.bind(propertySearchController));

// Получить результаты конкретного поиска
router.get('/history/:id/results', propertySearchController.getSearchResults.bind(propertySearchController));

export default router;