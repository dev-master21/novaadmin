import { Response } from 'express';
import { AuthRequest } from '../types';
import db from '../config/database';
import logger from '../utils/logger';
import telegramBot from '../services/telegramBot.service';

class BotSettingsController {
  // ========== ГРУППЫ АГЕНТОВ ==========
  
  /**
   * Получить все группы агентов
   * GET /api/bot-settings/agent-groups
   */
  async getAgentGroups(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const groups = await db.query(`
        SELECT 
          bag.*,
          COUNT(DISTINCT bagm.agent_id) as agents_count,
          COUNT(DISTINCT r.id) as requests_count
        FROM bot_agent_groups bag
        LEFT JOIN bot_agent_group_members bagm ON bag.id = bagm.group_id
        LEFT JOIN requests r ON bag.id = r.agent_group_id
        GROUP BY bag.id
        ORDER BY bag.created_at DESC
      `);

      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      logger.error('Get agent groups error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения групп агентов'
      });
    }
  }

  /**
   * Создать группу агентов
   * POST /api/bot-settings/agent-groups
   */
  async createAgentGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { group_name, chat_id, description } = req.body;

      if (!group_name || !chat_id) {
        res.status(400).json({
          success: false,
          message: 'Укажите название группы и Chat ID'
        });
        return;
      }

      const result = await db.query(`
        INSERT INTO bot_agent_groups (group_name, chat_id, description)
        VALUES (?, ?, ?)
      `, [group_name, chat_id, description || null]);

      logger.info(`Agent group created: ${group_name} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Группа агентов создана',
        data: { id: (result as any).insertId }
      });
    } catch (error) {
      logger.error('Create agent group error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания группы агентов'
      });
    }
  }

  /**
   * Обновить группу агентов
   * PUT /api/bot-settings/agent-groups/:id
   */
  async updateAgentGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { group_name, chat_id, description, is_active } = req.body;

      const group = await db.queryOne(
        'SELECT * FROM bot_agent_groups WHERE id = ?',
        [id]
      );

      if (!group) {
        res.status(404).json({
          success: false,
          message: 'Группа не найдена'
        });
        return;
      }

      await db.query(`
        UPDATE bot_agent_groups 
        SET group_name = ?, chat_id = ?, description = ?, is_active = ?
        WHERE id = ?
      `, [group_name, chat_id, description, is_active, id]);

      logger.info(`Agent group updated: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Группа агентов обновлена'
      });
    } catch (error) {
      logger.error('Update agent group error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления группы агентов'
      });
    }
  }

  /**
   * Удалить группу агентов
   * DELETE /api/bot-settings/agent-groups/:id
   */
  async deleteAgentGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const group = await db.queryOne(
        'SELECT * FROM bot_agent_groups WHERE id = ?',
        [id]
      );

      if (!group) {
        res.status(404).json({
          success: false,
          message: 'Группа не найдена'
        });
        return;
      }

      await db.query('DELETE FROM bot_agent_groups WHERE id = ?', [id]);

      logger.info(`Agent group deleted: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Группа агентов удалена'
      });
    } catch (error) {
      logger.error('Delete agent group error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления группы агентов'
      });
    }
  }

  // ========== ПОЛЬЗОВАТЕЛИ БОТА ==========
  
  /**
   * Получить всех пользователей бота
   * GET /api/bot-settings/bot-users
   */
  async getBotUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role } = req.query;

      let query = `
        SELECT 
          bu.*,
          COUNT(DISTINCT r.id) as assigned_requests_count,
          COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_requests_count
        FROM bot_users bu
        LEFT JOIN request_agents ra ON bu.id = ra.bot_user_id
        LEFT JOIN requests r ON ra.id = r.agent_id
      `;

      const queryParams: any[] = [];

      if (role) {
        query += ' WHERE bu.role = ?';
        queryParams.push(role);
      }

      query += ' GROUP BY bu.id ORDER BY bu.created_at DESC';

      const users = await db.query(query, queryParams);

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Get bot users error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения пользователей бота'
      });
    }
  }

  /**
   * Создать пользователя бота
   * POST /api/bot-settings/bot-users
   */
  async createBotUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { telegram_id, telegram_username, first_name, last_name, role } = req.body;

      if (!telegram_id || !role) {
        res.status(400).json({
          success: false,
          message: 'Укажите Telegram ID и роль'
        });
        return;
      }

      if (!['agent', 'manager'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Роль должна быть agent или manager'
        });
        return;
      }

      // Проверяем существование
      const existing = await db.queryOne(
        'SELECT * FROM bot_users WHERE telegram_id = ?',
        [telegram_id]
      );

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Пользователь с таким Telegram ID уже существует'
        });
        return;
      }

      const result = await db.query(`
        INSERT INTO bot_users (telegram_id, telegram_username, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?)
      `, [telegram_id, telegram_username, first_name, last_name, role]);

      logger.info(`Bot user created: ${telegram_id} (${role}) by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Пользователь бота создан',
        data: { id: (result as any).insertId }
      });
    } catch (error) {
      logger.error('Create bot user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания пользователя бота'
      });
    }
  }

  /**
   * Обновить пользователя бота
   * PUT /api/bot-settings/bot-users/:id
   */
  async updateBotUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { telegram_username, first_name, last_name, role, is_active } = req.body;

      const user = await db.queryOne(
        'SELECT * FROM bot_users WHERE id = ?',
        [id]
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      await db.query(`
        UPDATE bot_users 
        SET telegram_username = ?, first_name = ?, last_name = ?, role = ?, is_active = ?
        WHERE id = ?
      `, [telegram_username, first_name, last_name, role, is_active, id]);

      logger.info(`Bot user updated: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Пользователь бота обновлен'
      });
    } catch (error) {
      logger.error('Update bot user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления пользователя бота'
      });
    }
  }

  /**
   * Удалить пользователя бота
   * DELETE /api/bot-settings/bot-users/:id
   */
  async deleteBotUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await db.queryOne(
        'SELECT * FROM bot_users WHERE id = ?',
        [id]
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
        return;
      }

      await db.query('DELETE FROM bot_users WHERE id = ?', [id]);

      logger.info(`Bot user deleted: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Пользователь бота удален'
      });
    } catch (error) {
      logger.error('Delete bot user error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления пользователя бота'
      });
    }
  }

  // ========== TELEGRAM АККАУНТЫ ==========
  
  /**
   * Получить все Telegram аккаунты
   * GET /api/bot-settings/telegram-accounts
   */
  async getTelegramAccounts(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const accounts = await db.query(`
        SELECT 
          bta.id,
          bta.account_name,
          bta.phone_number,
          bta.is_active,
          bta.last_sync_at,
          bta.created_at,
          bta.updated_at,
          COUNT(DISTINCT r.id) as requests_count
        FROM bot_telegram_accounts bta
        LEFT JOIN requests r ON bta.id = r.telegram_account_id
        GROUP BY bta.id
        ORDER BY bta.created_at DESC
      `);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Get telegram accounts error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения Telegram аккаунтов'
      });
    }
  }

  /**
   * Создать Telegram аккаунт
   * POST /api/bot-settings/telegram-accounts
   */
  async createTelegramAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { account_name, phone_number, api_id, api_hash } = req.body;

      if (!account_name || !phone_number || !api_id || !api_hash) {
        res.status(400).json({
          success: false,
          message: 'Все поля обязательны для заполнения'
        });
        return;
      }

      // Проверяем существование
      const existing = await db.queryOne(
        'SELECT * FROM bot_telegram_accounts WHERE phone_number = ?',
        [phone_number]
      );

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Аккаунт с таким номером уже существует'
        });
        return;
      }

      const result = await db.query(`
        INSERT INTO bot_telegram_accounts (account_name, phone_number, api_id, api_hash, is_active)
        VALUES (?, ?, ?, ?, FALSE)
      `, [account_name, phone_number, api_id, api_hash]);

      logger.info(`Telegram account created: ${phone_number} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Telegram аккаунт создан. Теперь синхронизируйте его.',
        data: { id: (result as any).insertId }
      });
    } catch (error) {
      logger.error('Create telegram account error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания Telegram аккаунта'
      });
    }
  }

  /**
   * Начать авторизацию аккаунта
   * POST /api/bot-settings/telegram-accounts/:id/start-auth
   */
  async startAccountAuth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const account: any = await db.queryOne(
        'SELECT * FROM bot_telegram_accounts WHERE id = ?',
        [id]
      );

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Аккаунт не найден'
        });
        return;
      }

      if (!account.api_id || !account.api_hash) {
        res.status(400).json({
          success: false,
          message: 'API ID и API Hash не указаны для этого аккаунта'
        });
        return;
      }

      // Запускаем процесс авторизации
      const result = await telegramBot.startAccountAuthorization(
        parseInt(id),
        account.phone_number,
        account.api_id,
        account.api_hash
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      logger.info(`Started auth for account ${account.phone_number} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Код отправлен на ваш Telegram',
        data: {
          phone_code_hash: result.phone_code_hash
        }
      });
    } catch (error) {
      logger.error('Start account auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка запуска авторизации'
      });
    }
  }

  /**
   * Завершить авторизацию с кодом
   * POST /api/bot-settings/telegram-accounts/:id/complete-auth
   */
  async completeAccountAuth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { code, phone_code_hash, password } = req.body;

      if (!code || !phone_code_hash) {
        res.status(400).json({
          success: false,
          message: 'Код и phone_code_hash обязательны'
        });
        return;
      }

      const account: any = await db.queryOne(
        'SELECT * FROM bot_telegram_accounts WHERE id = ?',
        [id]
      );

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Аккаунт не найден'
        });
        return;
      }

      // Завершаем авторизацию
      const result = await telegramBot.completeAccountAuthorization(
        parseInt(id),
        code,
        phone_code_hash,
        password
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
          needPassword: result.needPassword
        });
        return;
      }

      // Сохраняем session string
      await db.query(`
        UPDATE bot_telegram_accounts 
        SET session_string = ?, is_active = TRUE, last_sync_at = NOW()
        WHERE id = ?
      `, [result.sessionString, id]);

      // Перезагружаем аккаунты в сервисе
      await telegramBot.reloadAccounts();

      logger.info(`Completed auth for account ${account.phone_number} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Аккаунт успешно авторизован и активен'
      });
    } catch (error) {
      logger.error('Complete account auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка завершения авторизации'
      });
    }
  }

  /**
   * Обновить Telegram аккаунт
   * PUT /api/bot-settings/telegram-accounts/:id
   */
  async updateTelegramAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { account_name, phone_number, session_string, api_id, api_hash, is_active } = req.body;

      const account = await db.queryOne(
        'SELECT * FROM bot_telegram_accounts WHERE id = ?',
        [id]
      );

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Аккаунт не найден'
        });
        return;
      }

      await db.query(`
        UPDATE bot_telegram_accounts 
        SET account_name = ?, phone_number = ?, session_string = ?, 
            api_id = ?, api_hash = ?, is_active = ?
        WHERE id = ?
      `, [account_name, phone_number, session_string, api_id, api_hash, is_active, id]);

      logger.info(`Telegram account updated: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Telegram аккаунт обновлен'
      });
    } catch (error) {
      logger.error('Update telegram account error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления Telegram аккаунта'
      });
    }
  }

  /**
   * Удалить Telegram аккаунт
   * DELETE /api/bot-settings/telegram-accounts/:id
   */
  async deleteTelegramAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const account = await db.queryOne(
        'SELECT * FROM bot_telegram_accounts WHERE id = ?',
        [id]
      );

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Аккаунт не найден'
        });
        return;
      }

      // Отключаем аккаунт в сервисе перед удалением
      await telegramBot.disconnectAccount(parseInt(id));

      await db.query('DELETE FROM bot_telegram_accounts WHERE id = ?', [id]);

      logger.info(`Telegram account deleted: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Telegram аккаунт удален'
      });
    } catch (error) {
      logger.error('Delete telegram account error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка удаления Telegram аккаунта'
      });
    }
  }

  // ========== АДМИН-ЧАТ ==========
  
  /**
   * Получить настройки админ-чата
   * GET /api/bot-settings/admin-chat
   */
  async getAdminChat(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const chat = await db.queryOne(`
        SELECT * FROM bot_admin_chat WHERE is_active = TRUE LIMIT 1
      `);

      res.json({
        success: true,
        data: chat
      });
    } catch (error) {
      logger.error('Get admin chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения настроек админ-чата'
      });
    }
  }

  /**
   * Установить админ-чат
   * POST /api/bot-settings/admin-chat
   */
  async setAdminChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { chat_id, chat_name } = req.body;

      if (!chat_id) {
        res.status(400).json({
          success: false,
          message: 'Укажите Chat ID'
        });
        return;
      }

      // Деактивируем все существующие
      await db.query('UPDATE bot_admin_chat SET is_active = FALSE');

      // Создаем новый
      const result = await db.query(`
        INSERT INTO bot_admin_chat (chat_id, chat_name, is_active)
        VALUES (?, ?, TRUE)
      `, [chat_id, chat_name || 'Админ-чат']);

      logger.info(`Admin chat set: ${chat_id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Админ-чат установлен',
        data: { id: (result as any).insertId }
      });
    } catch (error) {
      logger.error('Set admin chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка установки админ-чата'
      });
    }
  }

  /**
   * Обновить админ-чат
   * PUT /api/bot-settings/admin-chat/:id
   */
  async updateAdminChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { chat_id, chat_name, is_active } = req.body;

      const chat = await db.queryOne(
        'SELECT * FROM bot_admin_chat WHERE id = ?',
        [id]
      );

      if (!chat) {
        res.status(404).json({
          success: false,
          message: 'Админ-чат не найден'
        });
        return;
      }

      await db.query(`
        UPDATE bot_admin_chat 
        SET chat_id = ?, chat_name = ?, is_active = ?
        WHERE id = ?
      `, [chat_id, chat_name, is_active, id]);

      logger.info(`Admin chat updated: ${id} by ${req.admin?.username}`);

      res.json({
        success: true,
        message: 'Админ-чат обновлен'
      });
    } catch (error) {
      logger.error('Update admin chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка обновления админ-чата'
      });
    }
  }
}

export default new BotSettingsController();