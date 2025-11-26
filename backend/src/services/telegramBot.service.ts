import TelegramBot from 'node-telegram-bot-api';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import db from '../config/database';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

interface TelegramAccountData {
  id: number;
  phone_number: string;
  session_string: string;
  api_id: number;
  api_hash: string;
  client?: TelegramClient;
}

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private telegramAccounts: Map<number, TelegramAccountData> = new Map();
  private mediaGroupPhotos: Map<string, { photos: TelegramBot.Message[], timeout: NodeJS.Timeout }> = new Map();
  
  // Bot credentials
  private botToken: string;
  
  private isInitialized: boolean = false;
  
  // Директория для медиафайлов
  private mediaDir: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.mediaDir = path.join(__dirname, '../../uploads/telegram_media');
  }

  /**
   * Инициализация бота
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Telegram services already initialized');
      return;
    }

    try {
      // Создаем директорию для медиа если её нет
      await fs.ensureDir(this.mediaDir);
      logger.info(`Media directory ensured: ${this.mediaDir}`);

      // 1. Загружаем все активные Telegram аккаунты из БД
      await this.loadTelegramAccounts();

      // 2. Инициализация Bot (для взаимодействия)
      await this.initializeBot();

      this.isInitialized = true;
      logger.info('Telegram services initialized successfully!');

    } catch (error) {
      logger.error('Failed to initialize Telegram services:', error);
      throw error;
    }
  }

  /**
   * Загрузка всех активных Telegram аккаунтов из БД
   */
  private async loadTelegramAccounts(): Promise<void> {
    try {
      const accounts: any[] = await db.query(`
        SELECT id, phone_number, session_string, api_id, api_hash
        FROM bot_telegram_accounts
        WHERE is_active = TRUE AND session_string IS NOT NULL
      `);

      for (const account of accounts) {
        if (account.session_string && account.api_id && account.api_hash) {
          try {
            const session = new StringSession(account.session_string);
            const client = new TelegramClient(session, account.api_id, account.api_hash, {
              connectionRetries: 5,
            });

            await client.connect();

            this.telegramAccounts.set(account.id, {
              id: account.id,
              phone_number: account.phone_number,
              session_string: account.session_string,
              api_id: account.api_id,
              api_hash: account.api_hash,
              client: client
            });

            logger.info(`Telegram account ${account.phone_number} connected`);
          } catch (error) {
            logger.error(`Failed to connect account ${account.phone_number}:`, error);
          }
        }
      }

      logger.info(`Loaded ${this.telegramAccounts.size} Telegram accounts`);
    } catch (error) {
      logger.error('Error loading telegram accounts:', error);
    }
  }

  /**
   * Инициализация Bot
   */
  private async initializeBot(): Promise<void> {
    this.bot = new TelegramBot(this.botToken, { polling: true });

    // Обработчик команды /start
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStartCommand(msg);
    });

    // Обработчик callback query (нажатия на кнопки)
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });

    // Обработчик текстовых сообщений (для заметок)
    this.bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        await this.handleTextMessage(msg);
      } else if (msg.photo) {
        await this.handlePhotoMessage(msg);
      }
    });

    logger.info('Telegram bot connected successfully!');
  }

  /**
   * Обработка команды /start
   */
  private async handleStartCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();

    if (!this.bot || !userId) return;

    try {
      // Проверяем пользователя в БД
      const botUser: any = await db.queryOne(
        'SELECT * FROM bot_users WHERE telegram_id = ? AND is_active = TRUE',
        [userId]
      );

      if (!botUser) {
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет доступа к боту.\n\nОбратитесь к администратору для получения доступа.'
        );
        return;
      }

      // Показываем меню в зависимости от роли
      if (botUser.role === 'manager') {
        await this.showManagerMenu(chatId, botUser);
      } else if (botUser.role === 'agent') {
        await this.showAgentMenu(chatId, botUser);
      }

    } catch (error) {
      logger.error('Error handling start command:', error);
      if (this.bot) {
        await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
      }
    }
  }

  /**
   * Показать меню менеджера
   */
  private async showManagerMenu(chatId: number, botUser: any): Promise<void> {
    if (!this.bot) return;

    try {
      const name = botUser.first_name || botUser.telegram_username || 'Менеджер';

      // Получаем статистику
      const stats: any = await db.queryOne(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests
        FROM requests
        WHERE deleted_at IS NULL
      `);

      const messageText = `👋 Добро пожаловать, ${name}!\n\n` +
        `📊 *Статистика заявок:*\n` +
        `• Всего заявок: ${stats.total_requests}\n` +
        `• Новых: ${stats.new_requests}\n` +
        `• В работе: ${stats.in_progress_requests}\n` +
        `• Выполнено: ${stats.completed_requests}\n\n` +
        `Выберите действие:`;

      await this.bot.sendMessage(
        chatId,
        messageText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Создать заявку', callback_data: 'manager_create_request' }],
              [{ text: '👥 Просмотр агентов', callback_data: 'manager_view_agents' }],
              [{ text: '📊 Статистика', callback_data: 'manager_statistics' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error('Error showing manager menu:', error);
    }
  }

/**
 * Показать выбор источника заявки (Telegram/WhatsApp)
 */
private async showRequestSourceSelection(chatId: number, messageId: number): Promise<void> {
  if (!this.bot) return;

  try {
    await this.bot.editMessageText(
      '📱 *Выберите источник заявки*\n\n' +
      '• Telegram - синхронизация чата из Telegram\n' +
      '• WhatsApp - загрузка скриншотов переписки',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Telegram', callback_data: 'source_telegram' }],
            [{ text: '📱 WhatsApp', callback_data: 'source_whatsapp' }],
            [{ text: '🔙 Назад', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error showing request source selection:', error);
  }
}

/**
 * Показать форму создания заявки из WhatsApp
 */
private async showWhatsAppForm(chatId: number, messageId: number): Promise<void> {
  if (!this.bot) return;

  try {
    // Получаем userId из callback query context
    await this.bot.editMessageText(
      '📱 *Создание заявки из WhatsApp*\n\n' +
      'Начнем создание заявки. Сначала введите имя клиента.\n\n' +
      'Например: Иван Иванов',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
          ]
        }
      }
    );

    // Сохраняем состояние ожидания имени клиента используя chatId (в личных чатах chatId = userId)
    await db.query(
      `INSERT INTO request_bot_settings (setting_key, setting_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [
        `awaiting_whatsapp_client_name_${chatId}`,
        JSON.stringify({ step: 'client_name' }),
        JSON.stringify({ step: 'client_name' })
      ]
    );
  } catch (error) {
    logger.error('Error showing WhatsApp form:', error);
  }
}

/**
 * Показать выбор группы для WhatsApp заявки
 */
private async showWhatsAppGroupSelection(
  chatId: number,
  messageId: number,
  requestData: any
): Promise<void> {
  if (!this.bot) return;

  try {
    const groups: any[] = await db.query(`
      SELECT id, group_name, description
      FROM bot_agent_groups
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `);

    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    // Кнопка "Без группы"
    buttons.push([{
      text: '📋 Без группы',
      callback_data: 'whatsapp_group:null'
    }]);

    // Группы агентов
    for (const group of groups) {
      buttons.push([{
        text: `👥 ${group.group_name}`,
        callback_data: `whatsapp_group:${group.id}`
      }]);
    }

    buttons.push([{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]);

    await this.bot.editMessageText(
      '👥 *Выберите группу агентов*\n\n' +
      `📊 Загружено скриншотов: ${requestData.screenshots.length}\n\n` +
      'Куда направить заявку?',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );

    // Сохраняем данные для выбора группы
    await db.query(
      `INSERT INTO request_bot_settings (setting_key, setting_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [
        `awaiting_whatsapp_group_${chatId}`,
        JSON.stringify(requestData),
        JSON.stringify(requestData)
      ]
    );
  } catch (error) {
    logger.error('Error showing WhatsApp group selection:', error);
  }
}

  /**
   * Показать меню агента
   */
  private async showAgentMenu(chatId: number, botUser: any): Promise<void> {
    if (!this.bot) return;

    try {
      const name = botUser.first_name || botUser.telegram_username || 'Агент';

      // Находим request_agents по bot_user_id
      const agent: any = await db.queryOne(
        'SELECT id FROM request_agents WHERE bot_user_id = ?',
        [botUser.id]
      );

      let stats = { assigned: 0, completed: 0, in_progress: 0 };

      if (agent) {
        const agentStats: any = await db.queryOne(`
          SELECT 
            COUNT(*) as assigned,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress
          FROM requests
          WHERE agent_id = ? AND deleted_at IS NULL
        `, [agent.id]);

        stats = agentStats;
      }

      const messageText = `👋 Добро пожаловать, ${name}!\n\n` +
        `📊 *Ваша статистика:*\n` +
        `• Взято заявок: ${stats.assigned}\n` +
        `• В работе: ${stats.in_progress}\n` +
        `• Выполнено: ${stats.completed}\n\n` +
        `Выберите действие:`;

      await this.bot.sendMessage(
        chatId,
        messageText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Мои заявки', callback_data: 'agent_my_requests' }],
              [{ text: '📊 Моя статистика', callback_data: 'agent_statistics' }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error('Error showing agent menu:', error);
    }
  }

/**
 * Обработка callback query
 */
private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!this.bot || !query.data) return;

  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const userId = query.from.id.toString();

  if (!chatId || !messageId) return;

  try {
    await this.bot.answerCallbackQuery(query.id);

    const data = query.data;

    // ========== МЕНЕДЖЕР ==========
    if (data === 'manager_create_request') {
      await this.showRequestSourceSelection(chatId, messageId);
    } else if (data === 'source_telegram') {
      await this.showAccountSelection(chatId, messageId);
    } else if (data === 'source_whatsapp') {
      await this.showWhatsAppForm(chatId, messageId);
} else if (data === 'whatsapp_screenshots_done') {
  const awaitingData: any = await db.queryOne(
    'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
    [`awaiting_whatsapp_screenshots_${chatId}`]
  );

  if (awaitingData) {
    const screenshotData = JSON.parse(awaitingData.setting_value);
    
    if (!screenshotData.screenshots || screenshotData.screenshots.length === 0) {
      await this.bot.answerCallbackQuery(query.id, {
        text: 'Загрузите хотя бы один скриншот',
        show_alert: true
      });
      return;
    }

    await db.query(
      'DELETE FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_screenshots_${chatId}`]
    );

    // Показываем выбор группы агентов
    await this.showWhatsAppGroupSelection(chatId, messageId, screenshotData);
  }
} else if (data.startsWith('whatsapp_group:')) {
  const groupId = data.split(':')[1];
  
  const awaitingData: any = await db.queryOne(
    'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
    [`awaiting_whatsapp_group_${chatId}`]
  );

  if (awaitingData) {
    const requestData = JSON.parse(awaitingData.setting_value);
    requestData.group_id = groupId === 'null' ? null : parseInt(groupId);

    await db.query(
      'DELETE FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_group_${chatId}`]
    );

    // Спрашиваем про заметку
    await this.bot.editMessageText(
      '📝 *Хотите добавить заметку к заявке?*\n\n' +
      'Вы можете написать заметку в следующем сообщении или пропустить этот шаг.',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭ Пропустить', callback_data: 'whatsapp_skip_note' }],
            [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
          ]
        }
      }
    );

    // Сохраняем данные для заметки
    await db.query(
      `INSERT INTO request_bot_settings (setting_key, setting_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [
        `awaiting_whatsapp_note_${chatId}`,
        JSON.stringify(requestData),
        JSON.stringify(requestData)
      ]
    );
  }
} else if (data === 'whatsapp_skip_note') {
  const awaitingData: any = await db.queryOne(
    'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
    [`awaiting_whatsapp_note_${chatId}`]
  );

  if (awaitingData) {
    const requestData = JSON.parse(awaitingData.setting_value);
    
    await db.query(
      'DELETE FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_note_${chatId}`]
    );

    await this.bot.deleteMessage(chatId, messageId);

    // Создаем заявку без заметки
    await this.createWhatsAppRequest(
      chatId,
      requestData.client_name,
      requestData.whatsapp_phone,
      requestData.screenshots,
      requestData.group_id,
      null,
      userId
    );
  }
} else if (data.startsWith('select_account:')) {
      const accountId = parseInt(data.split(':')[1]);
      await this.showChatsList(chatId, messageId, accountId);
    } else if (data.startsWith('select_chat:')) {
      const parts = data.split(':');
      const accountId = parseInt(parts[1]);
      const selectedUserId = parts[2];
      await this.showGroupSelection(chatId, messageId, accountId, selectedUserId);
    } else if (data.startsWith('select_group:')) {
      const parts = data.split(':');
      const accountId = parseInt(parts[1]);
      const selectedUserId = parts[2];
      const groupId = parts[3];
      await this.confirmRequestCreation(chatId, messageId, accountId, selectedUserId, groupId);
    } else if (data.startsWith('confirm_request:')) {
      const parts = data.split(':');
      const accountId = parseInt(parts[1]);
      const selectedUserId = parts[2];
      const groupId = parts[3] === 'self' ? null : parseInt(parts[3]);
      const assignToSelf = parts[3] === 'self';
      await this.askForNote(chatId, messageId, accountId, selectedUserId, groupId, assignToSelf, userId);
    } else if (data.startsWith('skip_note:')) {
      const parts = data.split(':');
      const accountId = parseInt(parts[1]);
      const selectedUserId = parts[2];
      const groupId = parts[3] === 'null' ? null : parseInt(parts[3]);
      const assignToSelf = parts[4] === 'true';
      const managerId = parts[5];
      await this.createRequest(chatId, accountId, selectedUserId, managerId, null, groupId, assignToSelf);
    } else if (data === 'manager_view_agents') {
      await this.showAgentsList(chatId, messageId);
    } else if (data.startsWith('view_agent:')) {
      const agentId = parseInt(data.split(':')[1]);
      await this.showAgentDetails(chatId, messageId, agentId);
    } else if (data === 'manager_statistics') {
      await this.showManagerStatistics(chatId, messageId);
    }

    // ========== АГЕНТ ==========
    else if (data === 'agent_my_requests') {
      await this.showAgentRequests(chatId, messageId, userId);
    } else if (data === 'agent_statistics') {
      await this.showAgentStatistics(chatId, messageId, userId);
    }

    // ========== ОБЩЕЕ ==========
    else if (data.startsWith('accept_request:')) {
      const requestId = data.split(':')[1];
      await this.acceptRequest(query, requestId);
    } else if (data === 'back_to_menu') {
      await this.bot.deleteMessage(chatId, messageId);
      
      const botUser: any = await db.queryOne(
        'SELECT * FROM bot_users WHERE telegram_id = ?',
        [userId]
      );
      
      if (botUser) {
        if (botUser.role === 'manager') {
          await this.showManagerMenu(chatId, botUser);
        } else {
          await this.showAgentMenu(chatId, botUser);
        }
      }
    }

  } catch (error) {
    logger.error('Error handling callback query:', error);
  }
}
  /**
   * Показать выбор Telegram аккаунта
   */
  private async showAccountSelection(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    try {
      const accounts: any[] = await db.query(`
        SELECT id, account_name, phone_number
        FROM bot_telegram_accounts
        WHERE is_active = TRUE
        ORDER BY created_at DESC
      `);

      if (accounts.length === 0) {
        await this.bot.editMessageText(
          '❌ Нет доступных Telegram аккаунтов.\n\nОбратитесь к администратору.',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
            }
          }
        );
        return;
      }

      const buttons: TelegramBot.InlineKeyboardButton[][] = [];

      for (const account of accounts) {
        buttons.push([{
          text: `📱 ${account.account_name} (${account.phone_number})`,
          callback_data: `select_account:${account.id}`
        }]);
      }

      buttons.push([{ text: '🔙 Назад', callback_data: 'back_to_menu' }]);

      await this.bot.editMessageText(
        '📱 *Выберите Telegram аккаунт*\n\nС какого аккаунта вы хотите создать заявку?',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error showing account selection:', error);
    }
  }

  /**
   * Показать список чатов для выбранного аккаунта
   */
  private async showChatsList(
    chatId: number,
    messageId: number,
    accountId: number,
    page: number = 0
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const accountData = this.telegramAccounts.get(accountId);

      if (!accountData || !accountData.client) {
        await this.bot.editMessageText(
          '❌ Аккаунт не найден или не подключен.',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
            }
          }
        );
        return;
      }

      await this.bot.editMessageText('⏳ Загружаю список чатов...', {
        chat_id: chatId,
        message_id: messageId
      });

      const dialogs = await accountData.client.getDialogs({ limit: 100 });

      const privateChats = dialogs.filter(dialog => {
        if (!dialog.entity) return false;
        return dialog.isUser && !(dialog.entity as any).bot;
      });

      if (privateChats.length === 0) {
        await this.bot.editMessageText(
          '❌ У выбранного аккаунта нет активных чатов для создания заявок.',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'manager_create_request' }]]
            }
          }
        );
        return;
      }

      // Пагинация
      const chatsPerPage = 10;
      const totalPages = Math.ceil(privateChats.length / chatsPerPage);
      const startIndex = page * chatsPerPage;
      const endIndex = Math.min(startIndex + chatsPerPage, privateChats.length);
      const currentPageChats = privateChats.slice(startIndex, endIndex);

      const buttons: TelegramBot.InlineKeyboardButton[][] = [];

      for (const dialog of currentPageChats) {
        const user = dialog.entity as any;

        let displayName = '';
        const nameParts: string[] = [];
        if (user.firstName) nameParts.push(user.firstName);
        if (user.lastName) nameParts.push(user.lastName);

        if (nameParts.length > 0) {
          displayName = nameParts.join(' ');
        }

        if (user.username) {
          if (displayName) {
            displayName += ` [@${user.username}]`;
          } else {
            displayName = `@${user.username}`;
          }
        }

        if (!displayName) {
          displayName = `User ${user.id}`;
        }

        buttons.push([{
          text: `💬 ${displayName}`,
          callback_data: `select_chat:${accountId}:${user.id}`
        }]);
      }

      // Кнопки навигации
      if (totalPages > 1) {
        const navButtons: TelegramBot.InlineKeyboardButton[] = [];

        if (page > 0) {
          navButtons.push({
            text: '⬅️ Назад',
            callback_data: `page_chats:${accountId}:${page - 1}`
          });
        }

        navButtons.push({
          text: `📄 ${page + 1}/${totalPages}`,
          callback_data: `page_info:${page}`
        });

        if (page < totalPages - 1) {
          navButtons.push({
            text: 'Вперед ➡️',
            callback_data: `page_chats:${accountId}:${page + 1}`
          });
        }

        buttons.push(navButtons);
      }

      buttons.push([{ text: '🔙 Назад', callback_data: 'manager_create_request' }]);

      const messageText = `📋 *Выберите чат для создания заявки*\n\n` +
        `Показаны чаты ${startIndex + 1}-${endIndex} из ${privateChats.length}\n` +
        `Страница ${page + 1} из ${totalPages}`;

      await this.bot.editMessageText(
        messageText,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

    } catch (error) {
      logger.error('Error showing chats list:', error);
      if (this.bot) {
        await this.bot.editMessageText(
          '❌ Ошибка загрузки списка чатов.',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
            }
          }
        );
      }
    }
  }

  /**
   * Показать выбор группы агентов или "Себе"
   */
  private async showGroupSelection(
    chatId: number,
    messageId: number,
    accountId: number,
    selectedUserId: string
  ): Promise<void> {
    if (!this.bot) return;

    try {
      // Получаем группы агентов
      const groups: any[] = await db.query(`
        SELECT id, group_name, description
        FROM bot_agent_groups
        WHERE is_active = TRUE
        ORDER BY created_at DESC
      `);

      const buttons: TelegramBot.InlineKeyboardButton[][] = [];

      // Кнопка "Себе"
      buttons.push([{
        text: '👤 Себе',
        callback_data: `select_group:${accountId}:${selectedUserId}:self`
      }]);

      // Группы агентов
      for (const group of groups) {
        buttons.push([{
          text: `👥 ${group.group_name}`,
          callback_data: `select_group:${accountId}:${selectedUserId}:${group.id}`
        }]);
      }

      buttons.push([{ text: '🔙 Назад', callback_data: `select_account:${accountId}` }]);

      await this.bot.editMessageText(
        '👥 *Выберите кому назначить заявку*\n\n' +
        '• Себе - заявка будет назначена на вас\n' +
        '• Группа агентов - уведомление уйдет в выбранную группу',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error showing group selection:', error);
    }
  }

  /**
   * Подтверждение создания заявки
   */
  private async confirmRequestCreation(
    chatId: number,
    messageId: number,
    accountId: number,
    selectedUserId: string,
    groupIdOrSelf: string
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const accountData = this.telegramAccounts.get(accountId);
      if (!accountData || !accountData.client) return;

      const user = await accountData.client.getEntity(selectedUserId);
      const userData = user as any;

      let displayName = '';
      const nameParts: string[] = [];
      if (userData.firstName) nameParts.push(userData.firstName);
      if (userData.lastName) nameParts.push(userData.lastName);

      if (nameParts.length > 0) {
        displayName = nameParts.join(' ');
      }

      if (userData.username) {
        if (displayName) {
          displayName += ` [@${userData.username}]`;
        } else {
          displayName = `@${userData.username}`;
        }
      }

      if (!displayName) {
        displayName = `User ${selectedUserId}`;
      }

      let assignmentText = '';
      if (groupIdOrSelf === 'self') {
        assignmentText = '👤 *Назначение:* Себе';
      } else {
        const group: any = await db.queryOne(
          'SELECT group_name FROM bot_agent_groups WHERE id = ?',
          [groupIdOrSelf]
        );
        assignmentText = `👥 *Группа:* ${group.group_name}`;
      }

      await this.bot.editMessageText(
        `✅ *Подтверждение создания заявки*\n\n` +
        `👤 *Клиент:* ${displayName}\n` +
        `${assignmentText}\n\n` +
        `Подтвердите создание заявки или вернитесь назад.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: `confirm_request:${accountId}:${selectedUserId}:${groupIdOrSelf}` },
                { text: '🔙 Назад', callback_data: `select_chat:${accountId}:${selectedUserId}` }
              ]
            ]
          }
        }
      );
    } catch (error) {
      logger.error('Error confirming request:', error);
    }
  }

  /**
   * Запрос заметки
   */
  private async askForNote(
    chatId: number,
    messageId: number,
    accountId: number,
    selectedUserId: string,
    groupId: number | null,
    assignToSelf: boolean,
    managerId: string
  ): Promise<void> {
    if (!this.bot) return;

    try {
      await db.query(
        `INSERT INTO request_bot_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [
          `awaiting_note_${managerId}`,
          JSON.stringify({ accountId, selectedUserId, groupId, assignToSelf }),
          JSON.stringify({ accountId, selectedUserId, groupId, assignToSelf })
        ]
      );

      await this.bot.editMessageText(
        '📝 *Введите заметку к заявке*\n\nВы можете пропустить этот шаг или написать заметку в следующем сообщении.',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ 
                text: '⏭ Пропустить', 
                callback_data: `skip_note:${accountId}:${selectedUserId}:${groupId}:${assignToSelf}:${managerId}` 
              }]
            ]
          }
        }
      );
    } catch (error) {
      logger.error('Error asking for note:', error);
    }
  }

/**
 * Обработка текстового сообщения (заметка)
 */
private async handleTextMessage(msg: TelegramBot.Message): Promise<void> {
  if (!this.bot || !msg.from) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  try {
    // ========== ПРОВЕРКИ ДЛЯ WHATSAPP (приоритет выше) ==========
    
    // 1. Проверяем ожидание имени клиента для WhatsApp
    const whatsappClientName: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_client_name_${chatId}`]
    );

    if (whatsappClientName && text) {
      logger.info(`WhatsApp client name received: ${text}`);
      
      // Сохраняем имя клиента и переходим к вводу телефона
      await db.query(
        `INSERT INTO request_bot_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [
          `awaiting_whatsapp_phone_${chatId}`,
          JSON.stringify({ step: 'phone', client_name: text }),
          JSON.stringify({ step: 'phone', client_name: text })
        ]
      );

      await db.query(
        'DELETE FROM request_bot_settings WHERE setting_key = ?',
        [`awaiting_whatsapp_client_name_${chatId}`]
      );

      await this.bot.sendMessage(
        chatId,
        '📞 *Отлично!*\n\nТеперь введите номер телефона WhatsApp клиента.\n\n' +
        'Например: +7 900 123 45 67',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
            ]
          }
        }
      );
      return;
    }

    // 2. Проверяем ожидание телефона для WhatsApp
    const whatsappPhone: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_phone_${chatId}`]
    );

    if (whatsappPhone && text) {
      logger.info(`WhatsApp phone received: ${text}`);
      
      const data = JSON.parse(whatsappPhone.setting_value);
      data.whatsapp_phone = text;

      // Переходим к загрузке скриншотов
      await db.query(
        `INSERT INTO request_bot_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [
          `awaiting_whatsapp_screenshots_${chatId}`,
          JSON.stringify({ ...data, step: 'screenshots', screenshots: [] }),
          JSON.stringify({ ...data, step: 'screenshots', screenshots: [] })
        ]
      );

      await db.query(
        'DELETE FROM request_bot_settings WHERE setting_key = ?',
        [`awaiting_whatsapp_phone_${chatId}`]
      );

      await this.bot.sendMessage(
        chatId,
        '📸 *Отлично!*\n\nТеперь загрузите скриншоты переписки из WhatsApp.\n\n' +
        'Вы можете отправить несколько фотографий. После загрузки всех скриншотов нажмите "Продолжить".',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
            ]
          }
        }
      );
      return;
    }

    // 3. Проверяем ожидание заметки для WhatsApp
    const whatsappNote: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_note_${chatId}`]
    );

    if (whatsappNote && text) {
      logger.info(`WhatsApp note received: ${text}`);
      
      const data = JSON.parse(whatsappNote.setting_value);
      
      await db.query(
        'DELETE FROM request_bot_settings WHERE setting_key = ?',
        [`awaiting_whatsapp_note_${chatId}`]
      );

      // Создаем заявку с заметкой
      await this.createWhatsAppRequest(
        chatId,
        data.client_name,
        data.whatsapp_phone,
        data.screenshots,
        data.group_id,
        text,
        userId.toString()
      );
      return;
    }

    // ========== ПРОВЕРКИ ДЛЯ TELEGRAM ==========
    
    // 4. Проверяем ожидание заметки для Telegram заявки
    const awaitingNote: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_note_${userId}`]
    );

    if (awaitingNote && text) {
      const data = JSON.parse(awaitingNote.setting_value);
      const { accountId, selectedUserId, groupId, assignToSelf } = data;

      await db.query(
        'DELETE FROM request_bot_settings WHERE setting_key = ?',
        [`awaiting_note_${userId}`]
      );

      await this.createRequest(chatId, accountId, selectedUserId, userId.toString(), text, groupId, assignToSelf);
      return;
    }

  } catch (error) {
    logger.error('Error handling text message:', error);
  }
}

/**
 * Обработка фото (для скриншотов WhatsApp)
 */
private async handlePhotoMessage(msg: TelegramBot.Message): Promise<void> {
  if (!this.bot || !msg.from || !msg.photo) return;

  const chatId = msg.chat.id;

  try {
    const awaitingData: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_screenshots_${chatId}`]
    );

    if (!awaitingData) {
      return;
    }

    // Проверяем, это альбом или одиночное фото
    const mediaGroupId = msg.media_group_id;

    if (mediaGroupId) {
      // Это фото из альбома - собираем все фото
      if (!this.mediaGroupPhotos.has(mediaGroupId)) {
        this.mediaGroupPhotos.set(mediaGroupId, {
          photos: [],
          timeout: setTimeout(async () => {
            await this.processMediaGroup(mediaGroupId, chatId);
          }, 1000) // Ждем 1 секунду после последнего фото
        });
      }

      const groupData = this.mediaGroupPhotos.get(mediaGroupId)!;
      groupData.photos.push(msg);

      // Сбрасываем таймер
      clearTimeout(groupData.timeout);
      groupData.timeout = setTimeout(async () => {
        await this.processMediaGroup(mediaGroupId, chatId);
      }, 1000);
    } else {
      // Одиночное фото - обрабатываем сразу
      await this.processSinglePhoto(msg, chatId);
    }
  } catch (error) {
    logger.error('Error handling photo message:', error);
  }
}

/**
 * Обработка группы фото из альбома
 */
private async processMediaGroup(mediaGroupId: string, chatId: number): Promise<void> {
  if (!this.bot) return;

  const groupData = this.mediaGroupPhotos.get(mediaGroupId);
  if (!groupData) return;

  try {
    logger.info(`Processing media group ${mediaGroupId} with ${groupData.photos.length} photos`);

    const awaitingData: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_screenshots_${chatId}`]
    );

    if (!awaitingData) {
      this.mediaGroupPhotos.delete(mediaGroupId);
      return;
    }

    const data = JSON.parse(awaitingData.setting_value);

    if (!data.screenshots) {
      data.screenshots = [];
    }

    const startCount = data.screenshots.length;

    // Обрабатываем все фото из группы
    for (const photoMsg of groupData.photos) {
      const photo = photoMsg.photo![photoMsg.photo!.length - 1];
      const fileLink = await this.bot.getFileLink(photo.file_id);
      
      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      
      const uploadDir = path.join(__dirname, '../../uploads/whatsapp-screenshots');
      await fs.ensureDir(uploadDir);
      
      const { v4: uuidv4 } = require('uuid');
      const filename = `wa_screenshot_${uuidv4()}.jpeg`;
      const filepath = path.join(uploadDir, filename);
      
      await fs.writeFile(filepath, Buffer.from(buffer));
      
      const screenshotPath = `/uploads/whatsapp-screenshots/${filename}`;
      data.screenshots.push(screenshotPath);
      
      logger.info(`WhatsApp screenshot saved: ${screenshotPath}`);
    }

    // Обновляем данные
    await db.query(
      'UPDATE request_bot_settings SET setting_value = ? WHERE setting_key = ?',
      [JSON.stringify(data), `awaiting_whatsapp_screenshots_${chatId}`]
    );

    // Отправляем или обновляем сообщение
    if (startCount === 0) {
      // Первая загрузка - отправляем новое сообщение
      const sentMsg = await this.bot.sendMessage(
        chatId,
        `✅ Скриншотов загружено: ${data.screenshots.length}\n\n` +
        `Загрузите еще скриншоты или нажмите "Продолжить".`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продолжить', callback_data: 'whatsapp_screenshots_done' }],
              [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
            ]
          }
        }
      );
      
      data.control_message_id = sentMsg.message_id;
      await db.query(
        'UPDATE request_bot_settings SET setting_value = ? WHERE setting_key = ?',
        [JSON.stringify(data), `awaiting_whatsapp_screenshots_${chatId}`]
      );
    } else {
      // Обновляем существующее сообщение
      if (data.control_message_id) {
        try {
          await this.bot.editMessageText(
            `✅ Скриншотов загружено: ${data.screenshots.length}\n\n` +
            `Загрузите еще скриншоты или нажмите "Продолжить".`,
            {
              chat_id: chatId,
              message_id: data.control_message_id,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ Продолжить', callback_data: 'whatsapp_screenshots_done' }],
                  [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
                ]
              }
            }
          );
        } catch (error) {
          logger.error('Error updating message:', error);
        }
      }
    }

    // Удаляем группу из памяти
    this.mediaGroupPhotos.delete(mediaGroupId);
  } catch (error) {
    logger.error('Error processing media group:', error);
    this.mediaGroupPhotos.delete(mediaGroupId);
  }
}

/**
 * Обработка одиночного фото
 */
private async processSinglePhoto(msg: TelegramBot.Message, chatId: number): Promise<void> {
  if (!this.bot || !msg.photo) return;

  try {
    const awaitingData: any = await db.queryOne(
      'SELECT setting_value FROM request_bot_settings WHERE setting_key = ?',
      [`awaiting_whatsapp_screenshots_${chatId}`]
    );

    if (!awaitingData) return;

    const data = JSON.parse(awaitingData.setting_value);

    // Скачиваем фото
    const photo = msg.photo[msg.photo.length - 1];
    const fileLink = await this.bot.getFileLink(photo.file_id);
    
    const response = await fetch(fileLink);
    const buffer = await response.arrayBuffer();
    
    const uploadDir = path.join(__dirname, '../../uploads/whatsapp-screenshots');
    await fs.ensureDir(uploadDir);
    
    const { v4: uuidv4 } = require('uuid');
    const filename = `wa_screenshot_${uuidv4()}.jpeg`;
    const filepath = path.join(uploadDir, filename);
    
    await fs.writeFile(filepath, Buffer.from(buffer));
    
    const screenshotPath = `/uploads/whatsapp-screenshots/${filename}`;
    
    logger.info(`WhatsApp screenshot saved: ${screenshotPath}`);
    
    if (!data.screenshots) {
      data.screenshots = [];
    }
    data.screenshots.push(screenshotPath);
    
    const isFirstPhoto = data.screenshots.length === 1;
    
    await db.query(
      'UPDATE request_bot_settings SET setting_value = ? WHERE setting_key = ?',
      [JSON.stringify(data), `awaiting_whatsapp_screenshots_${chatId}`]
    );
    
    if (isFirstPhoto) {
      const sentMsg = await this.bot.sendMessage(
        chatId,
        `✅ Скриншот 1 загружен.\n\n` +
        `Загрузите еще скриншоты или нажмите "Продолжить".`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продолжить', callback_data: 'whatsapp_screenshots_done' }],
              [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
            ]
          }
        }
      );
      
      data.control_message_id = sentMsg.message_id;
      await db.query(
        'UPDATE request_bot_settings SET setting_value = ? WHERE setting_key = ?',
        [JSON.stringify(data), `awaiting_whatsapp_screenshots_${chatId}`]
      );
    } else {
      if (data.control_message_id) {
        try {
          await this.bot.editMessageText(
            `✅ Скриншотов загружено: ${data.screenshots.length}\n\n` +
            `Загрузите еще скриншоты или нажмите "Продолжить".`,
            {
              chat_id: chatId,
              message_id: data.control_message_id,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ Продолжить', callback_data: 'whatsapp_screenshots_done' }],
                  [{ text: '🔙 Отмена', callback_data: 'manager_create_request' }]
                ]
              }
            }
          );
        } catch (error) {
          logger.error('Error updating message:', error);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing single photo:', error);
  }
}

  /**
   * Создание заявки
   */
  private async createRequest(
    managerChatId: number,
    accountId: number,
    clientUserId: string,
    managerId: string,
    note: string | null,
    groupId: number | null,
    assignToSelf: boolean
  ): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.sendMessage(managerChatId, '⏳ Создаю заявку...');

      const accountData = this.telegramAccounts.get(accountId);
      if (!accountData || !accountData.client) {
        await this.bot.sendMessage(managerChatId, '❌ Ошибка: аккаунт не найден.');
        return;
      }

      const manager = await accountData.client.getEntity(managerId);
      const client = await accountData.client.getEntity(clientUserId);

      const clientData = client as any;
      const managerData = manager as any;

      const messages = await accountData.client.getMessages(clientUserId, { limit: 100 });

      const firstMessage = messages[messages.length - 1];
      const lastMessage = messages[0];

      const { v4: uuidv4 } = require('uuid');
      const uuid = uuidv4();
      const chatUuid = uuidv4();
      const requestNumber = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Определяем agent_id если заявка "себе"
      let agentId = null;
      let agentAcceptedAt = null;
      let status = 'new';

      if (assignToSelf) {
        // Находим или создаем bot_user для менеджера
        let botUser: any = await db.queryOne(
          'SELECT id FROM bot_users WHERE telegram_id = ?',
          [managerId]
        );

        if (!botUser) {
          const userResult = await db.query(
            'INSERT INTO bot_users (telegram_id, role) VALUES (?, ?)',
            [managerId, 'manager']
          );
          botUser = { id: (userResult as any).insertId };
        }

        // Находим или создаем request_agents
        let agent: any = await db.queryOne(
          'SELECT id FROM request_agents WHERE telegram_id = ?',
          [managerId]
        );

        if (!agent) {
          const agentResult = await db.query(
            'INSERT INTO request_agents (telegram_id, telegram_username, first_name, last_name, bot_user_id) VALUES (?, ?, ?, ?, ?)',
            [managerId, managerData.username, managerData.firstName, managerData.lastName, botUser.id]
          );
          agentId = (agentResult as any).insertId;
        } else {
          agentId = agent.id;
          
          // Обновляем связь с bot_user если её нет
          await db.query(
            'UPDATE request_agents SET bot_user_id = ? WHERE id = ?',
            [botUser.id, agentId]
          );
        }

        agentAcceptedAt = new Date();
        status = 'in_progress';
      }

      const result = await db.query(`
        INSERT INTO requests (
          request_number, uuid, chat_uuid,
          client_telegram_id, client_username, client_first_name, client_last_name, client_phone,
          manager_telegram_id, manager_username, manager_first_name, manager_last_name,
          initial_note, first_message_at, last_message_at, 
          telegram_account_id, agent_group_id, assigned_to_self, agent_id, agent_accepted_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestNumber, uuid, chatUuid,
        clientData.id.toString(), clientData.username, clientData.firstName, clientData.lastName, clientData.phone,
        managerData.id.toString(), managerData.username, managerData.firstName, managerData.lastName,
        note,
        firstMessage ? new Date(firstMessage.date * 1000) : new Date(),
        lastMessage ? new Date(lastMessage.date * 1000) : new Date(),
        accountId, groupId, assignToSelf, agentId, agentAcceptedAt,
        status
      ]);

      const requestId = (result as any).insertId;

      logger.info(`Created request ${requestNumber} with ID ${requestId}`);

      await this.saveMessagesToDatabase(requestId, messages, accountData.client);

      const chatUrl = `${process.env.REQUEST_BASE_URL}/request/chat/${chatUuid}`;
      const requestUrl = `${process.env.REQUEST_BASE_URL}/request/client/${uuid}`;

      if (assignToSelf) {
        await this.bot.sendMessage(
          managerChatId,
          `✅ *Заявка создана и назначена на вас!*\n\n` +
          `📋 Номер: ${requestNumber}\n` +
          `🔗 История чата: ${chatUrl}\n` +
          `🔗 Управление заявкой: ${requestUrl}`,
          { parse_mode: 'Markdown' }
        );

        // Отправляем уведомление в админ-чат
        await this.sendAdminChatNotification(
          'request_created_self',
          requestId,
          requestNumber,
          clientData,
          chatUrl,
          requestUrl,
          { manager_name: `${managerData.firstName || ''} ${managerData.lastName || ''}`.trim() }
        );
      } else {
        await this.bot.sendMessage(
          managerChatId,
          `✅ *Заявка создана успешно!*\n\n` +
          `📋 Номер: ${requestNumber}\n` +
          `🔗 История чата: ${chatUrl}\n` +
          `🔗 Управление заявкой: ${requestUrl}`,
          { parse_mode: 'Markdown' }
        );

        // Отправляем уведомление в групповой чат агентов
        if (groupId) {
          await this.sendNewRequestNotification(requestId, requestNumber, clientData, note, chatUrl, groupId);
        }
      }

      logger.info(`Request created: ${requestNumber} (ID: ${requestId})`);

    } catch (error) {
      logger.error('Error creating request:', error);
      if (this.bot) {
        await this.bot.sendMessage(managerChatId, '❌ Ошибка создания заявки. Попробуйте позже.');
      }
    }
  }

/**
 * Создание заявки из WhatsApp
 */
private async createWhatsAppRequest(
  chatId: number,
  clientName: string,
  whatsappPhone: string,
  screenshots: string[],
  groupId: number | null,
  note: string | null,
  managerId: string
): Promise<void> {
  if (!this.bot) return;

  try {
    await this.bot.sendMessage(chatId, '⏳ Создаю заявку из WhatsApp...');

    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    const chatUuid = uuidv4();
    const requestNumber = `REQ-WA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Создаём заявку
    const result = await db.query(`
      INSERT INTO requests (
        request_number, uuid, chat_uuid,
        request_source,
        client_first_name,
        client_telegram_id,
        whatsapp_phone,
        manager_telegram_id, manager_username,
        initial_note,
        first_message_at, last_message_at,
        agent_group_id,
        status
      ) VALUES (?, ?, ?, 'whatsapp', ?, NULL, ?, ?, NULL, ?, NOW(), NOW(), ?, 'new')
    `, [
      requestNumber, uuid, chatUuid,
      clientName,
      whatsappPhone,
      managerId,
      note,
      groupId
    ]);

    const requestId = (result as any).insertId;

    logger.info(`Created WhatsApp request ${requestNumber} with ID ${requestId}`);

    // Сохраняем скриншоты как сообщения
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      
      await db.query(`
        INSERT INTO request_messages (
          request_id,
          telegram_message_id,
          from_telegram_id,
          message_type,
          media_file_path,
          message_date
        ) VALUES (?, ?, NULL, 'whatsapp_screenshot', ?, NOW())
      `, [
        requestId,
        i + 1,
        screenshot
      ]);
    }

    const chatUrl = `${process.env.REQUEST_BASE_URL}/request/chat/${chatUuid}`;
    const requestUrl = `${process.env.REQUEST_BASE_URL}/request/client/${uuid}`;

    // Отправляем уведомление в группу агентов если выбрана
    if (groupId) {
      await this.sendWhatsAppRequestNotification(
        requestId,
        requestNumber,
        clientName,
        whatsappPhone,
        note,
        chatUrl,
        groupId
      );
    }

    await this.bot.sendMessage(
      chatId,
      `✅ *Заявка из WhatsApp создана успешно!*\n\n` +
      `📋 Номер: ${requestNumber}\n` +
      `👤 Клиент: ${clientName}\n` +
      `📞 WhatsApp: ${whatsappPhone}\n` +
      `📸 Скриншотов: ${screenshots.length}\n\n` +
      `🔗 Скриншоты: ${chatUrl}\n` +
      `🔗 Управление заявкой: ${requestUrl}`,
      { parse_mode: 'Markdown' }
    );

    logger.info(`WhatsApp request created: ${requestNumber} (ID: ${requestId})`);

  } catch (error) {
    logger.error('Error creating WhatsApp request:', error);
    if (this.bot) {
      await this.bot.sendMessage(chatId, '❌ Ошибка создания заявки. Попробуйте позже.');
    }
  }
}

  /**
   * Сохранение сообщений в БД
   */
  private async saveMessagesToDatabase(requestId: number, messages: any[], client: TelegramClient): Promise<void> {
    try {
      logger.info(`Starting to save ${messages.length} messages for request ${requestId}`);
      
      for (const msg of messages.reverse()) {
        let messageType = 'text';
        let mediaFileId = null;
        let mediaMimeType = null;
        let mediaFileSize: number | null = null;
        let mediaDuration: number | null = null;
        let mediaWidth: number | null = null;
        let mediaHeight: number | null = null;
        let caption = null;
        let mediaFilePath = null;

        let fromTelegramId = null;
        if (msg.fromId) {
          if (msg.fromId.userId) {
            fromTelegramId = msg.fromId.userId.toString();
          }
        } else if (msg.sender?.id) {
          fromTelegramId = msg.sender.id.toString();
        }

        if (msg.photo) {
          messageType = 'photo';
          mediaFileId = msg.photo.id?.toString();
          logger.info(`Processing photo message ${msg.id}`);
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.photo.sizes && msg.photo.sizes.length > 0) {
            const largestSize = msg.photo.sizes[msg.photo.sizes.length - 1];
            if (largestSize.w) mediaWidth = Number(largestSize.w);
            if (largestSize.h) mediaHeight = Number(largestSize.h);
          }
        } else if (msg.video) {
          messageType = 'video';
          mediaFileId = msg.video.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.video.duration) mediaDuration = Number(msg.video.duration);
          if (msg.video.w) mediaWidth = Number(msg.video.w);
          if (msg.video.h) mediaHeight = Number(msg.video.h);
          if (msg.video.size) mediaFileSize = Number(msg.video.size);
          if (msg.video.mimeType) mediaMimeType = msg.video.mimeType;
        } else if (msg.voice) {
          messageType = 'voice';
          mediaFileId = msg.voice.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.voice.duration) mediaDuration = Number(msg.voice.duration);
        } else if (msg.videoNote) {
          messageType = 'video_note';
          mediaFileId = msg.videoNote.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.videoNote.duration) mediaDuration = Number(msg.videoNote.duration);
        } else if (msg.audio) {
          messageType = 'audio';
          mediaFileId = msg.audio.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.audio.duration) mediaDuration = Number(msg.audio.duration);
          if (msg.audio.size) mediaFileSize = Number(msg.audio.size);
          if (msg.audio.mimeType) mediaMimeType = msg.audio.mimeType;
        } else if (msg.document) {
          messageType = 'document';
          mediaFileId = msg.document.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.document.size) mediaFileSize = Number(msg.document.size);
          if (msg.document.mimeType) mediaMimeType = msg.document.mimeType;
        } else if (msg.sticker) {
          messageType = 'sticker';
          mediaFileId = msg.sticker.id?.toString();
          mediaFilePath = await this.downloadMedia(msg, requestId, client);
          
          if (msg.sticker.w) mediaWidth = Number(msg.sticker.w);
          if (msg.sticker.h) mediaHeight = Number(msg.sticker.h);
        } else if (msg.action) {
          if (msg.action.className === 'MessageActionPhoneCall') {
            messageType = 'phone_call';
            if (msg.action.duration) mediaDuration = Number(msg.action.duration);
          } else {
            messageType = 'action';
          }
        }

        caption = msg.message || null;

        await db.query(`
          INSERT INTO request_messages (
            request_id, telegram_message_id, from_telegram_id, from_username,
            from_first_name, from_last_name, message_type, message_text,
            media_file_id, media_file_path, media_mime_type, media_file_size, 
            media_duration, media_width, media_height, caption, message_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          requestId,
          msg.id,
          fromTelegramId,
          null,
          null,
          null,
          messageType,
          msg.message || null,
          mediaFileId,
          mediaFilePath,
          mediaMimeType,
          mediaFileSize,
          mediaDuration,
          mediaWidth,
          mediaHeight,
          caption,
          new Date(msg.date * 1000)
        ]);
      }

      logger.info(`Saved ${messages.length} messages to database for request ${requestId}`);
    } catch (error) {
      logger.error('Error saving messages to database:', error);
      throw error;
    }
  }

  /**
   * Скачать медиафайл
   */
  private async downloadMedia(message: any, requestId: number, client: TelegramClient): Promise<string | null> {
    try {
      logger.info(`Downloading media for message ${message.id}`);
      
      const buffer = await client.downloadMedia(message);

      if (!buffer) {
        logger.warn(`No buffer returned for message ${message.id}`);
        return null;
      }

      logger.info(`Downloaded ${buffer.length} bytes for message ${message.id}`);

      let extension = 'bin';
      if (message.photo) {
        extension = 'jpg';
      } else if (message.video) {
        extension = 'mp4';
      } else if (message.voice) {
        extension = 'ogg';
      } else if (message.audio) {
        extension = 'mp3';
      } else if (message.videoNote) {
        extension = 'mp4';
      } else if (message.document) {
        const mimeType = message.document.mimeType;
        if (mimeType) {
          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/quicktime': 'mov',
            'audio/mpeg': 'mp3',
            'audio/ogg': 'ogg',
            'application/pdf': 'pdf',
            'application/zip': 'zip',
            'application/x-rar-compressed': 'rar',
          };
          
          const parts = mimeType.split('/');
          extension = mimeToExt[mimeType] || parts[1] || 'bin';
        }
      }

      const fileName = `${requestId}_${message.id}_${Date.now()}.${extension}`;
      const filePath = path.join(this.mediaDir, fileName);

      await fs.writeFile(filePath, buffer as Buffer);
      await fs.chmod(filePath, 0o644);
      
      logger.info(`Saved media file: ${filePath}`);

      return `/uploads/telegram_media/${fileName}`;

    } catch (error) {
      logger.error(`Error downloading media for message ${message.id}:`, error);
      return null;
    }
  }

  /**
   * Отправка уведомления в групповой чат агентов
   */
  private async sendNewRequestNotification(
    _requestId: number,
    requestNumber: string,
    clientData: any,
    _note: string | null,
    chatUrl: string,
    groupId: number
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const group: any = await db.queryOne(
        'SELECT chat_id FROM bot_agent_groups WHERE id = ? AND is_active = TRUE',
        [groupId]
      );

      if (!group) {
        logger.warn(`Group ${groupId} not found or inactive`);
        return;
      }

      const escapedRequestNumber = this.escapeMarkdown(requestNumber);
      const escapedFirstName = clientData.firstName ? this.escapeMarkdown(clientData.firstName) : null;
      const escapedLastName = clientData.lastName ? this.escapeMarkdown(clientData.lastName) : null;
      const escapedUsername = clientData.username ? this.escapeMarkdown(clientData.username) : null;
      const escapedPhone = clientData.phone ? this.escapeMarkdown(clientData.phone) : null;

      let messageText = `🆕 *НОВАЯ ЗАЯВКА ${escapedRequestNumber}*\n\n`;

      messageText += `👤 *Клиент:*\n`;
      if (escapedFirstName) messageText += `Имя: ${escapedFirstName}\n`;
      if (escapedLastName) messageText += `Фамилия: ${escapedLastName}\n`;
      if (escapedUsername) messageText += `Username: @${escapedUsername}\n`;
      if (escapedPhone) messageText += `Телефон: ${escapedPhone}\n`;
      messageText += `ID: ${clientData.id}\n`;

      await this.bot.sendMessage(
        group.chat_id,
        messageText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Просмотреть историю чата', url: chatUrl }],
              [{ text: '✅ Принять', callback_data: `accept_request:${_requestId}` }]
            ]
          }
        }
      );

      logger.info(`Sent notification for request ${requestNumber} to group ${groupId}`);
    } catch (error) {
      logger.error('Error sending group notification:', error);
    }
  }

/**
 * Принятие заявки агентом
 */
private async acceptRequest(query: TelegramBot.CallbackQuery, requestId: string): Promise<void> {
  if (!this.bot) return;

  try {
    const agent = query.from;
    const agentTelegramId = agent.id.toString();
    const agentUsername = agent.username;
    const agentFirstName = agent.first_name;
    const agentLastName = agent.last_name;

    // Проверяем есть ли пользователь в bot_users
    let botUser: any = await db.queryOne(
      'SELECT id FROM bot_users WHERE telegram_id = ? AND is_active = TRUE',
      [agentTelegramId]
    );

    if (!botUser) {
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ У вас нет доступа к боту. Обратитесь к администратору.',
        show_alert: true
      });
      return;
    }

    // Находим или создаем request_agents
    let dbAgent: any = await db.queryOne(
      'SELECT * FROM request_agents WHERE telegram_id = ?',
      [agentTelegramId]
    );

    if (!dbAgent) {
      const result = await db.query(`
        INSERT INTO request_agents (telegram_id, telegram_username, first_name, last_name, bot_user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [agentTelegramId, agentUsername, agentFirstName, agentLastName, botUser.id]);
      
      dbAgent = { id: (result as any).insertId };
    } else {
      // Обновляем связь с bot_user
      await db.query(
        'UPDATE request_agents SET bot_user_id = ? WHERE id = ?',
        [botUser.id, dbAgent.id]
      );
    }

    // Проверяем не взята ли уже заявка
    const request: any = await db.queryOne(
      'SELECT * FROM requests WHERE id = ?',
      [requestId]
    );

    if (!request) {
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ Заявка не найдена',
        show_alert: true
      });
      return;
    }

    if (request.agent_id) {
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ Заявка уже взята другим агентом',
        show_alert: true
      });
      return;
    }

    // Принимаем заявку
    await db.query(`
      UPDATE requests 
      SET agent_id = ?, agent_accepted_at = NOW(), status = 'in_progress' 
      WHERE id = ?
    `, [dbAgent.id, requestId]);

    // Добавляем агента в группу
    if (request.agent_group_id) {
      await db.query(`
        INSERT IGNORE INTO bot_agent_group_members (agent_id, group_id)
        VALUES (?, ?)
      `, [dbAgent.id, request.agent_group_id]);
    }

    const displayName = agentFirstName || agentUsername || `ID ${agentTelegramId}`;
    const agentMention = agentUsername ? `@${agentUsername}` : `ID: ${agentTelegramId}`;

    // Обновляем сообщение в групповом чате
    if (query.message) {
      const originalText = query.message.text || '';
      const cleanText = originalText.replace(/[_*[\]()~`>#+=|{}.!-]/g, '');
      const updatedText = cleanText + `\n\n✅ Заявку принял: ${displayName} | ${agentMention}`;
      
      try {
        await this.bot.editMessageText(updatedText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        });
      } catch (editError) {
        logger.warn('Could not edit message:', editError);
      }
    }

    const chatUrl = `${process.env.REQUEST_BASE_URL}/request/chat/${request.chat_uuid}`;
    const requestUrl = `${process.env.REQUEST_BASE_URL}/request/client/${request.uuid}`;

    // Формируем сообщение в зависимости от типа заявки
    let messageText = `✅ *Вы приняли заявку ${this.escapeMarkdown(request.request_number)}*\n\n`;

    if (request.request_source === 'whatsapp') {
      // WhatsApp заявка
      const escapedClientName = this.escapeMarkdown(request.client_first_name || 'Клиент');
      const escapedPhone = this.escapeMarkdown(request.whatsapp_phone || '');

      messageText += `📱 *WhatsApp заявка*\n\n`;
      messageText += `👤 Клиент: ${escapedClientName}\n`;
      messageText += `📞 Телефон: ${escapedPhone}\n\n`;
      messageText += `🔗 [Скриншоты переписки](${chatUrl})\n`;
      messageText += `🔗 [Управление заявкой](${requestUrl})`;

      // Формируем номер для WhatsApp (убираем все кроме цифр и +)
      const phoneForWhatsApp = request.whatsapp_phone.replace(/[^\d+]/g, '');

      await this.bot.sendMessage(
        agentTelegramId,
        messageText,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Связаться в WhatsApp', url: `https://wa.me/${phoneForWhatsApp}` }]
            ]
          }
        }
      );
    } else {
      // Telegram заявка
      const escapedClientFirstName = this.escapeMarkdown(request.client_first_name || '');
      const escapedClientLastName = this.escapeMarkdown(request.client_last_name || '');
      const escapedClientUsername = request.client_username ? this.escapeMarkdown(request.client_username) : '';

      messageText += `💬 *Telegram заявка*\n\n`;
      messageText += `👤 Клиент: ${escapedClientFirstName} ${escapedClientLastName}\n`;
      if (escapedClientUsername) {
        messageText += `📱 Username: @${escapedClientUsername}\n`;
      }
      messageText += `🆔 ID: ${request.client_telegram_id}\n\n`;
      messageText += `🔗 [История чата](${chatUrl})\n`;
      messageText += `🔗 [Управление заявкой](${requestUrl})`;

      const inlineKeyboard: TelegramBot.InlineKeyboardButton[][] = [];

      // Кнопка "Связаться" - либо по username, либо по ID
      if (request.client_username) {
        inlineKeyboard.push([{ 
          text: '💬 Связаться в Telegram', 
          url: `https://t.me/${request.client_username}` 
        }]);
      } else {
        inlineKeyboard.push([{ 
          text: '💬 Связаться в Telegram', 
          url: `tg://user?id=${request.client_telegram_id}` 
        }]);
      }

      await this.bot.sendMessage(
        agentTelegramId,
        messageText,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }
      );
    }

    // Отправляем уведомление в админ-чат
    await this.sendAdminChatNotification(
      'request_accepted',
      parseInt(requestId),
      request.request_number,
      null,
      chatUrl,
      requestUrl,
      { agent_name: displayName, agent_username: agentMention }
    );

    await db.query(`
      INSERT INTO request_analytics (request_id, agent_id, action_type, action_data)
      VALUES (?, ?, 'agent_accepted', ?)
    `, [requestId, dbAgent.id, JSON.stringify({ agent_username: agentUsername })]);

    logger.info(`Request ${request.request_number} accepted by ${displayName}`);

  } catch (error) {
    logger.error('Error accepting request:', error);
  }
}

  /**
   * Показать список агентов для менеджера
   */
  private async showAgentsList(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    try {
      const agents: any[] = await db.query(`
        SELECT 
          bu.id,
          bu.telegram_id,
          bu.telegram_username,
          bu.first_name,
          bu.last_name,
          COUNT(DISTINCT r.id) as total_requests,
          COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_requests
        FROM bot_users bu
        LEFT JOIN request_agents ra ON bu.id = ra.bot_user_id
        LEFT JOIN requests r ON ra.id = r.agent_id
        WHERE bu.role = 'agent' AND bu.is_active = TRUE
        GROUP BY bu.id
        ORDER BY total_requests DESC
      `);

      if (agents.length === 0) {
        await this.bot.editMessageText(
          '❌ Нет активных агентов',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
            }
          }
        );
        return;
      }

      const buttons: TelegramBot.InlineKeyboardButton[][] = [];

      for (const agent of agents) {
        const name = [agent.first_name, agent.last_name].filter(Boolean).join(' ') 
          || agent.telegram_username 
          || `ID ${agent.telegram_id}`;
        
        buttons.push([{
          text: `👤 ${name} (${agent.total_requests} заявок, ${agent.completed_requests} выполнено)`,
          callback_data: `view_agent:${agent.id}`
        }]);
      }

      buttons.push([{ text: '🔙 Назад', callback_data: 'manager_create_request' }]);

      await this.bot.editMessageText(
        '👥 *Список агентов*\n\nВыберите агента для просмотра детальной информации:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error showing agents list:', error);
    }
  }

  /**
   * Показать детали агента
   */
  private async showAgentDetails(chatId: number, messageId: number, botUserId: number): Promise<void> {
    if (!this.bot) return;

    try {
      const agent: any = await db.queryOne(`
        SELECT 
          bu.*,
          ra.id as agent_id
        FROM bot_users bu
        LEFT JOIN request_agents ra ON bu.id = ra.bot_user_id
        WHERE bu.id = ?
      `, [botUserId]);

      if (!agent) {
        await this.bot.editMessageText('❌ Агент не найден', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'manager_view_agents' }]]
          }
        });
        return;
      }

      const stats: any = await db.queryOne(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
        FROM requests
        WHERE agent_id = ? AND deleted_at IS NULL
      `, [agent.agent_id]);

      const requests: any[] = await db.query(`
        SELECT 
          request_number,
          uuid,
          chat_uuid,
          status,
          client_first_name,
          client_last_name,
          created_at
        FROM requests
        WHERE agent_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
      `, [agent.agent_id]);

      const name = [agent.first_name, agent.last_name].filter(Boolean).join(' ') 
        || agent.telegram_username 
        || `ID ${agent.telegram_id}`;

      let messageText = `👤 *Агент: ${this.escapeMarkdown(name)}*\n\n`;
      messageText += `📊 *Статистика:*\n`;
      messageText += `• Всего заявок: ${stats.total_requests}\n`;
      messageText += `• В работе: ${stats.in_progress}\n`;
      messageText += `• Выполнено: ${stats.completed}\n`;
      messageText += `• Отказано: ${stats.rejected}\n\n`;

      if (requests.length > 0) {
        messageText += `📋 *Последние заявки:*\n`;
        for (const req of requests) {
          const statusEmoji = req.status === 'completed' ? '✅' : req.status === 'in_progress' ? '🔄' : '❌';
          const clientName = [req.client_first_name, req.client_last_name].filter(Boolean).join(' ') || 'Клиент';
          messageText += `${statusEmoji} ${this.escapeMarkdown(req.request_number)} \\- ${this.escapeMarkdown(clientName)}\n`;
          messageText += `   [История](${process.env.REQUEST_BASE_URL}/request/chat/${req.chat_uuid}) \\| `;
          messageText += `[Управление](${process.env.REQUEST_BASE_URL}/request/client/${req.uuid})\n\n`;
        }
      }

      await this.bot.editMessageText(
        messageText,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'manager_view_agents' }]]
          }
        }
      );
    } catch (error) {
      logger.error('Error showing agent details:', error);
    }
  }

  /**
   * Показать статистику менеджера
   */
  private async showManagerStatistics(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    try {
      const stats: any = await db.queryOne(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_requests,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'deal_created' THEN 1 END) as deal_created,
          COUNT(CASE WHEN agent_id IS NULL THEN 1 END) as unassigned
        FROM requests
        WHERE deleted_at IS NULL
      `);

      const agentsStats: any = await db.queryOne(`
        SELECT 
          COUNT(DISTINCT bu.id) as total_agents,
          COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN bu.id END) as active_agents
        FROM bot_users bu
        LEFT JOIN request_agents ra ON bu.id = ra.bot_user_id
        LEFT JOIN requests r ON ra.id = r.agent_id AND r.status = 'in_progress'
        WHERE bu.role = 'agent' AND bu.is_active = TRUE
      `);

      let messageText = `📊 *Общая статистика*\n\n`;
      messageText += `📋 *Заявки:*\n`;
      messageText += `• Всего: ${stats.total_requests}\n`;
      messageText += `• Новых: ${stats.new_requests}\n`;
      messageText += `• В работе: ${stats.in_progress}\n`;
      messageText += `• Выполнено: ${stats.completed}\n`;
      messageText += `• Отказано: ${stats.rejected}\n`;
      messageText += `• Договоров создано: ${stats.deal_created}\n`;
      messageText += `• Не назначено: ${stats.unassigned}\n\n`;
      messageText += `👥 *Агенты:*\n`;
      messageText += `• Всего агентов: ${agentsStats.total_agents}\n`;
      messageText += `• Активных агентов: ${agentsStats.active_agents}\n`;

      await this.bot.editMessageText(
        messageText,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
          }
        }
      );
    } catch (error) {
      logger.error('Error showing manager statistics:', error);
    }
  }

/**
 * Показать заявки агента
 */
private async showAgentRequests(chatId: number, messageId: number, userId: string): Promise<void> {
  if (!this.bot) return;

  try {
    const botUser: any = await db.queryOne(
      'SELECT id FROM bot_users WHERE telegram_id = ?',
      [userId]
    );

    if (!botUser) return;

    const agent: any = await db.queryOne(
      'SELECT id FROM request_agents WHERE bot_user_id = ?',
      [botUser.id]
    );

    if (!agent) {
      await this.bot.editMessageText(
        '❌ У вас пока нет заявок',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
          }
        }
      );
      return;
    }

    const requests: any[] = await db.query(`
      SELECT 
        request_number,
        uuid,
        chat_uuid,
        status,
        client_first_name,
        client_last_name,
        created_at
      FROM requests
      WHERE agent_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20
    `, [agent.id]);

    if (requests.length === 0) {
      await this.bot.editMessageText(
        '❌ У вас пока нет заявок',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
          }
        }
      );
      return;
    }

    let messageText = `📋 *Ваши заявки* (${requests.length})\n\n`;

    for (const req of requests) {
      const statusEmoji = req.status === 'completed' ? '✅' : req.status === 'in_progress' ? '🔄' : '❌';
      const clientName = [req.client_first_name, req.client_last_name].filter(Boolean).join(' ') || 'Клиент';
      
      messageText += `${statusEmoji} *${req.request_number}*\n`;
      messageText += `👤 ${clientName}\n`;
      messageText += `[История чата](${process.env.REQUEST_BASE_URL}/request/chat/${req.chat_uuid}) | `;
      messageText += `[Управление](${process.env.REQUEST_BASE_URL}/request/client/${req.uuid})\n\n`;
    }

    await this.bot.editMessageText(
      messageText,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
        }
      }
    );
  } catch (error) {
    logger.error('Error showing agent requests:', error);
  }
}

  /**
   * Показать статистику агента
   */
  private async showAgentStatistics(chatId: number, messageId: number, userId: string): Promise<void> {
    if (!this.bot) return;

    try {
      const botUser: any = await db.queryOne(
        'SELECT id FROM bot_users WHERE telegram_id = ?',
        [userId]
      );

      if (!botUser) return;

      const agent: any = await db.queryOne(
        'SELECT id FROM request_agents WHERE bot_user_id = ?',
        [botUser.id]
      );

      let stats = { total: 0, in_progress: 0, completed: 0, rejected: 0 };

      if (agent) {
        const agentStats: any = await db.queryOne(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
          FROM requests
          WHERE agent_id = ? AND deleted_at IS NULL
        `, [agent.id]);

        stats = agentStats;
      }

      let messageText = `📊 *Ваша статистика*\n\n`;
      messageText += `📋 *Заявки:*\n`;
      messageText += `• Всего взято: ${stats.total}\n`;
      messageText += `• В работе: ${stats.in_progress}\n`;
      messageText += `• Выполнено: ${stats.completed}\n`;
      messageText += `• Отказано: ${stats.rejected}\n`;

      if (stats.total > 0) {
        const completionRate = ((stats.completed / stats.total) * 100).toFixed(1);
        messageText += `\n✅ Процент выполнения: ${completionRate}%`;
      }

      await this.bot.editMessageText(
        messageText,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back_to_menu' }]]
          }
        }
      );
    } catch (error) {
      logger.error('Error showing agent statistics:', error);
    }
  }

  /**
   * Отправить уведомление в админ-чат
   */
  async sendAdminChatNotification(
    type: string,
    _requestId: number,
    requestNumber: string,
    clientData: any | null,
    chatUrl: string,
    requestUrl: string,
    additionalData?: any
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const adminChat: any = await db.queryOne(
        'SELECT chat_id FROM bot_admin_chat WHERE is_active = TRUE LIMIT 1'
      );

      if (!adminChat) {
        logger.warn('Admin chat not configured');
        return;
      }

      let messageText = '';

      if (type === 'request_created_self') {
        messageText = `📋 *Создана заявка (назначена себе)*\n\n`;
        messageText += `Номер: ${this.escapeMarkdown(requestNumber)}\n`;
        messageText += `Менеджер: ${this.escapeMarkdown(additionalData.manager_name)}\n\n`;
        if (clientData) {
          messageText += `👤 Клиент: ${this.escapeMarkdown(clientData.firstName || '')} ${this.escapeMarkdown(clientData.lastName || '')}\n`;
        }
      } else if (type === 'request_accepted') {
        messageText = `✅ *Заявка принята агентом*\n\n`;
        messageText += `Номер: ${this.escapeMarkdown(requestNumber)}\n`;
        messageText += `Агент: ${this.escapeMarkdown(additionalData.agent_name)}\n`;
        messageText += `${additionalData.agent_username}\n`;
      } else if (type === 'field_updated') {
        messageText = `📝 *Обновлено поле в заявке*\n\n`;
        messageText += `Номер: ${this.escapeMarkdown(requestNumber)}\n`;
        messageText += `Поле: ${this.escapeMarkdown(additionalData.field_name)}\n`;
        messageText += `Агент: ${this.escapeMarkdown(additionalData.agent_name || 'Неизвестен')}\n`;
      } else if (type === 'contract_requested') {
        messageText = `📄 *Запрос на создание договора*\n\n`;
        messageText += `Номер заявки: ${this.escapeMarkdown(requestNumber)}\n`;
        messageText += `Агент: ${this.escapeMarkdown(additionalData.agent_name || 'Неизвестен')}\n\n`;
        messageText += `📋 *Информация для договора:*\n`;
        if (additionalData.contract_data) {
          const data = additionalData.contract_data;
          if (data.villa_name_address) messageText += `🏠 Вилла: ${this.escapeMarkdown(data.villa_name_address)}\n`;
          if (data.rental_cost) messageText += `💰 Стоимость: ${this.escapeMarkdown(data.rental_cost)}\n`;
          if (data.rental_dates) messageText += `📅 Даты: ${this.escapeMarkdown(data.rental_dates)}\n`;
        }
      }

      messageText += `\n🔗 [История чата](${chatUrl})\n`;
      messageText += `🔗 [Управление заявкой](${requestUrl})`;

      await this.bot.sendMessage(
        adminChat.chat_id,
        messageText,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );

      logger.info(`Sent admin chat notification: ${type} for request ${requestNumber}`);
    } catch (error) {
      logger.error('Error sending admin chat notification:', error);
    }
  }

  /**
   * Экранирование специальных символов для Telegram Markdown
   */
  private escapeMarkdown(text: string): string {
    if (!text) return '';
    return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
  }

/**
 * Отправить уведомление о запросе договора
 */
async sendContractRequestNotification(
  requestId: number,
  requestNumber: string,
  contractData: any,
  chatUrl: string,
  requestUrl: string
): Promise<void> {
  if (!this.bot) return;

  try {
    const adminChat: any = await db.queryOne(
      'SELECT chat_id FROM bot_admin_chat WHERE is_active = TRUE LIMIT 1'
    );

    if (!adminChat) {
      logger.warn('Admin chat not configured for contract notification');
      return;
    }

    // Получаем информацию о заявке и клиенте
    const request: any = await db.queryOne(`
      SELECT 
        r.*,
        ra.telegram_username as agent_username,
        ra.first_name as agent_first_name,
        ra.last_name as agent_last_name
      FROM requests r
      LEFT JOIN request_agents ra ON r.agent_id = ra.id
      WHERE r.id = ?
    `, [requestId]);

    if (!request) {
      logger.warn(`Request ${requestId} not found for contract notification`);
      return;
    }

    const clientName = [request.client_first_name, request.client_last_name]
      .filter(Boolean)
      .join(' ') || request.client_username || 'Клиент';

    const agentName = request.agent_username 
      ? `@${request.agent_username}`
      : request.agent_first_name
      ? [request.agent_first_name, request.agent_last_name].filter(Boolean).join(' ')
      : 'Не назначен';

    const escapedRequestNumber = this.escapeMarkdown(requestNumber);
    const escapedClientName = this.escapeMarkdown(clientName);
    const escapedAgentName = this.escapeMarkdown(agentName);
    const escapedVilla = this.escapeMarkdown(contractData.villa_name_address || '');
    const escapedDates = this.escapeMarkdown(contractData.rental_dates || '');
    const escapedCost = this.escapeMarkdown(contractData.rental_cost || '');

    let messageText = `📄 *ЗАПРОС НА СОЗДАНИЕ ДОГОВОРА*\n\n`;
    messageText += `📋 Заявка: ${escapedRequestNumber}\n`;
    messageText += `👤 Клиент: ${escapedClientName}\n`;
    if (request.client_phone) {
      messageText += `📞 Телефон: ${this.escapeMarkdown(request.client_phone)}\n`;
    }
    messageText += `👨‍💼 Агент: ${escapedAgentName}\n\n`;
    
    messageText += `*Данные для договора:*\n`;
    messageText += `🏠 Вилла: ${escapedVilla}\n`;
    messageText += `📅 Даты аренды: ${escapedDates}\n`;
    messageText += `💰 Стоимость: ${escapedCost}\n`;

    if (contractData.cost_includes) {
      messageText += `📝 Что включено: ${this.escapeMarkdown(contractData.cost_includes)}\n`;
    }
    if (contractData.utilities_cost) {
      messageText += `⚡ Коммунальные услуги: ${this.escapeMarkdown(contractData.utilities_cost)}\n`;
    }
    if (contractData.payment_terms) {
      messageText += `💳 Условия оплаты: ${this.escapeMarkdown(contractData.payment_terms)}\n`;
    }
    if (contractData.deposit_amount) {
      messageText += `💵 Депозит: ${this.escapeMarkdown(contractData.deposit_amount)}\n`;
    }
    if (contractData.additional_terms) {
      messageText += `📋 Дополнительные условия: ${this.escapeMarkdown(contractData.additional_terms)}\n`;
    }

    messageText += `\n🔗 [История чата](${chatUrl})\n`;
    messageText += `🔗 [Управление заявкой](${requestUrl})`;

    // Отправляем текстовое сообщение
    await this.bot.sendMessage(
      adminChat.chat_id,
      messageText,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );

    // Отправляем паспорт клиента
    if (contractData.client_passport_front) {
      try {
        // Нормализуем путь - убираем лишние части
        let clientPassportPath = contractData.client_passport_front;
        
        // Убираем полный путь если он есть
        if (clientPassportPath.includes('/var/www/')) {
          clientPassportPath = clientPassportPath.replace(/.*\/backend\//, '');
        }
        
        // Убираем двойные слэши
        clientPassportPath = clientPassportPath.replace(/\/+/g, '/');
        
        // Формируем абсолютный путь
        const fullClientPassportPath = path.join(__dirname, '../../public', clientPassportPath);
        
        logger.info(`Trying to send client passport from: ${fullClientPassportPath}`);
        
        if (await fs.pathExists(fullClientPassportPath)) {
          await this.bot.sendPhoto(adminChat.chat_id, fullClientPassportPath, {
            caption: '📸 Паспорт клиента'
          });
          logger.info('Client passport sent successfully');
        } else {
          logger.warn(`Client passport file not found: ${fullClientPassportPath}`);
        }
      } catch (error) {
        logger.error('Error sending client passport:', error);
      }
    }

    // Отправляем паспорт агента
    if (contractData.agent_passport_front) {
      try {
        // Нормализуем путь - убираем лишние части
        let agentPassportPath = contractData.agent_passport_front;
        
        // Убираем полный путь если он есть
        if (agentPassportPath.includes('/var/www/')) {
          agentPassportPath = agentPassportPath.replace(/.*\/backend\//, '');
        }
        
        // Убираем двойные слэши
        agentPassportPath = agentPassportPath.replace(/\/+/g, '/');
        
        // Формируем абсолютный путь
        const fullAgentPassportPath = path.join(__dirname, '../../public', agentPassportPath);
        
        logger.info(`Trying to send agent passport from: ${fullAgentPassportPath}`);
        
        if (await fs.pathExists(fullAgentPassportPath)) {
          await this.bot.sendPhoto(adminChat.chat_id, fullAgentPassportPath, {
            caption: '📸 Паспорт агента'
          });
          logger.info('Agent passport sent successfully');
        } else {
          logger.warn(`Agent passport file not found: ${fullAgentPassportPath}`);
        }
      } catch (error) {
        logger.error('Error sending agent passport:', error);
      }
    }

    logger.info(`Contract request notification sent for request ${requestNumber}`);
  } catch (error) {
    logger.error('Error sending contract request notification:', error);
  }
}

/**
 * Отправить уведомление агенту о готовности договора
 */
async sendAgreementReadyNotification(
  agentTelegramId: string,
  requestNumber: string,
  agreementData: any,
  signatures: any[],
  verifyLink: string
): Promise<void> {
  if (!this.bot) return;

  try {
    const escapedRequestNumber = this.escapeMarkdown(requestNumber);
    const escapedAgreementNumber = this.escapeMarkdown(agreementData.agreement_number || '');
    
    let messageText = `🎉 *ДОГОВОР ГОТОВ\\!*\n\n`;
    messageText += `📋 Заявка: ${escapedRequestNumber}\n`;
    messageText += `📄 Номер договора: ${escapedAgreementNumber}\n\n`;
    
    messageText += `*Детали договора:*\n`;
    if (agreementData.date_from && agreementData.date_to) {
      messageText += `📅 Период: ${this.escapeMarkdown(new Date(agreementData.date_from).toLocaleDateString('ru-RU'))} \\- ${this.escapeMarkdown(new Date(agreementData.date_to).toLocaleDateString('ru-RU'))}\n`;
    }
    if (agreementData.rent_amount_monthly) {
      messageText += `💰 Аренда: ${this.escapeMarkdown(agreementData.rent_amount_monthly.toString())} ฿/месяц\n`;
    }
    if (agreementData.deposit_amount) {
      messageText += `💵 Депозит: ${this.escapeMarkdown(agreementData.deposit_amount.toString())} ฿\n`;
    }
    
    messageText += `\n*Подписанты:*\n`;
    for (const sig of signatures) {
      messageText += `\n👤 ${this.escapeMarkdown(sig.signer_name)} \\(${this.escapeMarkdown(sig.signer_role)}\\)\n`;
      const signLink = `https://agreement.novaestate.company/sign/${sig.signature_link}`;
      messageText += `🔗 [Ссылка для подписи](${signLink})\n`;
    }
    
    messageText += `\n📋 [Просмотреть и проверить договор](https://agreement.novaestate.company/agreement\\-verify/${verifyLink})`;

    await this.bot.sendMessage(
      agentTelegramId,
      messageText,
      { parse_mode: 'MarkdownV2', disable_web_page_preview: false }
    );

    logger.info(`Agreement ready notification sent to agent ${agentTelegramId} for request ${requestNumber}`);
  } catch (error) {
    logger.error('Error sending agreement ready notification:', error);
  }
}

  /**
   * Остановка сервисов
   */
  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      logger.info('Telegram bot stopped');
    }

    for (const [, accountData] of this.telegramAccounts) {
      if (accountData.client) {
        await accountData.client.disconnect();
        logger.info(`Telegram account ${accountData.phone_number} disconnected`);
      }
    }

    this.telegramAccounts.clear();
    this.isInitialized = false;
  }

  /**
   * Начать авторизацию аккаунта
   */
  async startAccountAuthorization(
    accountId: number,
    phoneNumber: string,
    apiId: number,
    apiHash: string
  ): Promise<{ success: boolean; message?: string; phone_code_hash?: string }> {
    try {
      const session = new StringSession('');
      const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
      });

      await client.connect();

      const result = await client.sendCode(
        {
          apiId: apiId,
          apiHash: apiHash,
        },
        phoneNumber
      );

      // Сохраняем временный клиент для этого аккаунта
      this.telegramAccounts.set(accountId, {
        id: accountId,
        phone_number: phoneNumber,
        session_string: '',
        api_id: apiId,
        api_hash: apiHash,
        client: client
      });

      logger.info(`Started authorization for account ${phoneNumber}`);

      return {
        success: true,
        phone_code_hash: result.phoneCodeHash
      };
    } catch (error) {
      logger.error('Start account authorization error:', error);
      return {
        success: false,
        message: 'Ошибка отправки кода. Проверьте API ID и API Hash.'
      };
    }
  }

  /**
   * Завершить авторизацию аккаунта
   */
  async completeAccountAuthorization(
    accountId: number,
    code: string,
    phoneCodeHash: string,
    password?: string
  ): Promise<{ 
    success: boolean; 
    message?: string; 
    sessionString?: string;
    needPassword?: boolean;
  }> {
    try {
      const accountData = this.telegramAccounts.get(accountId);

      if (!accountData || !accountData.client) {
        return {
          success: false,
          message: 'Сначала запустите процесс авторизации'
        };
      }

      try {
        await accountData.client.invoke(
          new (require('telegram/tl').Api.auth.SignIn)({
            phoneNumber: accountData.phone_number,
            phoneCodeHash: phoneCodeHash,
            phoneCode: code,
          })
        );
      } catch (error: any) {
        // Проверяем нужен ли пароль 2FA
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          if (!password) {
            return {
              success: false,
              message: 'Требуется пароль двухфакторной аутентификации',
              needPassword: true
            };
          }

          // Вводим пароль
          const passwordResult = await accountData.client.invoke(
            new (require('telegram/tl').Api.account.GetPassword)()
          );

          await accountData.client.invoke(
            new (require('telegram/tl').Api.auth.CheckPassword)({
              password: await require('telegram/Password').computeCheck(
                passwordResult,
                password
              ),
            })
          );
        } else {
          throw error;
        }
      }

      // Получаем session string
      const sessionString = accountData.client.session.save() as unknown as string;

      logger.info(`Completed authorization for account ${accountData.phone_number}`);

      return {
        success: true,
        sessionString: sessionString
      };
    } catch (error: any) {
      logger.error('Complete account authorization error:', error);
      
      // Удаляем временный клиент
      const accountData = this.telegramAccounts.get(accountId);
      if (accountData?.client) {
        await accountData.client.disconnect();
      }
      this.telegramAccounts.delete(accountId);

      return {
        success: false,
        message: error.errorMessage || 'Неверный код или произошла ошибка'
      };
    }
  }

  /**
   * Перезагрузить аккаунты из БД
   */
  async reloadAccounts(): Promise<void> {
    logger.info('Reloading telegram accounts...');
    
    // Отключаем текущие подключения
    for (const [, accountData] of this.telegramAccounts) {
      if (accountData.client) {
        try {
          await accountData.client.disconnect();
        } catch (error) {
          logger.error('Error disconnecting account:', error);
        }
      }
    }
    
    this.telegramAccounts.clear();
    
    // Загружаем заново
    await this.loadTelegramAccounts();
    
    logger.info('Telegram accounts reloaded');
  }

  /**
   * Отключить аккаунт
   */
  async disconnectAccount(accountId: number): Promise<void> {
    const accountData = this.telegramAccounts.get(accountId);
    
    if (accountData?.client) {
      try {
        await accountData.client.disconnect();
        logger.info(`Disconnected account ${accountData.phone_number}`);
      } catch (error) {
        logger.error('Error disconnecting account:', error);
      }
    }
    
    this.telegramAccounts.delete(accountId);
  }


  /**
 * Отправить уведомление о заявке из WhatsApp
 */
async sendWhatsAppRequestNotification(
  _requestId: number,
  requestNumber: string,
  clientName: string,
  whatsappPhone: string,
  note: string | null,
  chatUrl: string,
  groupId: number
): Promise<void> {
  if (!this.bot) return;

  try {
    const group: any = await db.queryOne(
      'SELECT chat_id FROM bot_agent_groups WHERE id = ? AND is_active = TRUE',
      [groupId]
    );

    if (!group) {
      logger.warn(`Group ${groupId} not found or inactive`);
      return;
    }

    const escapedRequestNumber = this.escapeMarkdown(requestNumber);
    const escapedClientName = this.escapeMarkdown(clientName);
    const escapedPhone = this.escapeMarkdown(whatsappPhone);

    let messageText = `🆕 *НОВАЯ ЗАЯВКА ${escapedRequestNumber}*\n`;
    messageText += `📱 *Заявка из WhatsApp*\n\n`;

    messageText += `👤 *Клиент:* ${escapedClientName}\n`;
    messageText += `📞 *WhatsApp:* ${escapedPhone}\n`;

    if (note) {
      const escapedNote = this.escapeMarkdown(note);
      messageText += `📝 *Заметка:* ${escapedNote}\n`;
    }

    await this.bot.sendMessage(
      group.chat_id,
      messageText,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📸 Просмотреть скриншоты', url: chatUrl }],
            [{ text: '✅ Принять', callback_data: `accept_request:${_requestId}` }]
          ]
        }
      }
    );

    logger.info(`Sent WhatsApp notification for request ${requestNumber} to group ${groupId}`);
  } catch (error) {
    logger.error('Error sending WhatsApp notification:', error);
  }
}

}

export default new TelegramBotService();