import { Router } from 'express';
import { AuthRequest } from '../types';
import botSettingsController from '../controllers/botSettings.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticate);

// Middleware для проверки прав super admin
const requireSuperAdmin = (req: AuthRequest, res: any, next: any) => {
  if (!req.admin?.is_super_admin) {
    return res.status(403).json({
      success: false,
      message: 'Доступ запрещен. Требуются права супер-администратора'
    });
  }
  next();
};

router.use(requireSuperAdmin);

// ========== ГРУППЫ АГЕНТОВ ==========
router.get('/agent-groups', (req, res) => {
  botSettingsController.getAgentGroups(req as AuthRequest, res);
});

router.post('/agent-groups', (req, res) => {
  botSettingsController.createAgentGroup(req as AuthRequest, res);
});

router.put('/agent-groups/:id', (req, res) => {
  botSettingsController.updateAgentGroup(req as AuthRequest, res);
});

router.delete('/agent-groups/:id', (req, res) => {
  botSettingsController.deleteAgentGroup(req as AuthRequest, res);
});

// ========== ПОЛЬЗОВАТЕЛИ БОТА ==========
router.get('/bot-users', (req, res) => {
  botSettingsController.getBotUsers(req as AuthRequest, res);
});

router.post('/bot-users', (req, res) => {
  botSettingsController.createBotUser(req as AuthRequest, res);
});

router.put('/bot-users/:id', (req, res) => {
  botSettingsController.updateBotUser(req as AuthRequest, res);
});

router.delete('/bot-users/:id', (req, res) => {
  botSettingsController.deleteBotUser(req as AuthRequest, res);
});

// ========== TELEGRAM АККАУНТЫ ==========
router.get('/telegram-accounts', (req, res) => {
  botSettingsController.getTelegramAccounts(req as AuthRequest, res);
});

router.post('/telegram-accounts', (req, res) => {
  botSettingsController.createTelegramAccount(req as AuthRequest, res);
});

// Авторизация аккаунтов
router.post('/telegram-accounts/:id/start-auth', (req, res) => {
  botSettingsController.startAccountAuth(req as AuthRequest, res);
});

router.post('/telegram-accounts/:id/complete-auth', (req, res) => {
  botSettingsController.completeAccountAuth(req as AuthRequest, res);
});

router.put('/telegram-accounts/:id', (req, res) => {
  botSettingsController.updateTelegramAccount(req as AuthRequest, res);
});

router.delete('/telegram-accounts/:id', (req, res) => {
  botSettingsController.deleteTelegramAccount(req as AuthRequest, res);
});

// ========== АДМИН-ЧАТ ==========
router.get('/admin-chat', (req, res) => {
  botSettingsController.getAdminChat(req as AuthRequest, res);
});

router.post('/admin-chat', (req, res) => {
  botSettingsController.setAdminChat(req as AuthRequest, res);
});

router.put('/admin-chat/:id', (req, res) => {
  botSettingsController.updateAdminChat(req as AuthRequest, res);
});

export default router;