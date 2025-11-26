import api from '@/utils/request';

// ========== ТИПЫ ==========

export interface AgentGroup {
  id: number;
  group_name: string;
  chat_id: string;
  description?: string;
  is_active: boolean;
  agents_count: number;
  requests_count: number;
  created_at: string;
  updated_at: string;
}

export interface BotUser {
  id: number;
  telegram_id: string;
  telegram_username?: string;
  first_name?: string;
  last_name?: string;
  role: 'agent' | 'manager';
  is_active: boolean;
  assigned_requests_count: number;
  completed_requests_count: number;
  created_at: string;
  updated_at: string;
}

export interface TelegramAccount {
  id: number;
  account_name: string;
  phone_number: string;
  session_string?: string;
  api_id?: number;
  api_hash?: string;
  is_active: boolean;
  last_sync_at?: string;
  requests_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminChat {
  id: number;
  chat_id: string;
  chat_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== API ==========

export const botSettingsApi = {
  // ========== ГРУППЫ АГЕНТОВ ==========
  
  getAgentGroups: () =>
    api.get<{ success: boolean; data: AgentGroup[] }>('/bot-settings/agent-groups'),

  createAgentGroup: (data: {
    group_name: string;
    chat_id: string;
    description?: string;
  }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>(
      '/bot-settings/agent-groups',
      data
    ),

  updateAgentGroup: (id: number, data: {
    group_name: string;
    chat_id: string;
    description?: string;
    is_active: boolean;
  }) =>
    api.put<{ success: boolean; message: string }>(
      `/bot-settings/agent-groups/${id}`,
      data
    ),

  deleteAgentGroup: (id: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/bot-settings/agent-groups/${id}`
    ),

  // ========== ПОЛЬЗОВАТЕЛИ БОТА ==========
  
  getBotUsers: (role?: 'agent' | 'manager') =>
    api.get<{ success: boolean; data: BotUser[] }>('/bot-settings/bot-users', {
      params: { role }
    }),

  createBotUser: (data: {
    telegram_id: string;
    telegram_username?: string;
    first_name?: string;
    last_name?: string;
    role: 'agent' | 'manager';
  }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>(
      '/bot-settings/bot-users',
      data
    ),

  updateBotUser: (id: number, data: {
    telegram_username?: string;
    first_name?: string;
    last_name?: string;
    role: 'agent' | 'manager';
    is_active: boolean;
  }) =>
    api.put<{ success: boolean; message: string }>(
      `/bot-settings/bot-users/${id}`,
      data
    ),

  deleteBotUser: (id: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/bot-settings/bot-users/${id}`
    ),

  // ========== TELEGRAM АККАУНТЫ ==========
  
  getTelegramAccounts: () =>
    api.get<{ success: boolean; data: TelegramAccount[] }>(
      '/bot-settings/telegram-accounts'
    ),

  createTelegramAccount: (data: {
    account_name: string;
    phone_number: string;
    api_id: number;
    api_hash: string;
  }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>(
      '/bot-settings/telegram-accounts',
      data
    ),

  updateTelegramAccount: (id: number, data: {
    account_name: string;
    phone_number: string;
    session_string?: string;
    api_id?: number;
    api_hash?: string;
    is_active: boolean;
  }) =>
    api.put<{ success: boolean; message: string }>(
      `/bot-settings/telegram-accounts/${id}`,
      data
    ),

  deleteTelegramAccount: (id: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/bot-settings/telegram-accounts/${id}`
    ),

  // Методы авторизации аккаунтов
  startAccountAuth: (id: number) =>
    api.post<{ success: boolean; message: string; data: { phone_code_hash: string } }>(
      `/bot-settings/telegram-accounts/${id}/start-auth`
    ),

  completeAccountAuth: (id: number, data: {
    code: string;
    phone_code_hash: string;
    password?: string;
  }) =>
    api.post<{ success: boolean; message: string; needPassword?: boolean }>(
      `/bot-settings/telegram-accounts/${id}/complete-auth`,
      data
    ),

  // ========== АДМИН-ЧАТ ==========
  
  getAdminChat: () =>
    api.get<{ success: boolean; data: AdminChat | null }>(
      '/bot-settings/admin-chat'
    ),

  setAdminChat: (data: {
    chat_id: string;
    chat_name?: string;
  }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>(
      '/bot-settings/admin-chat',
      data
    ),

  updateAdminChat: (id: number, data: {
    chat_id: string;
    chat_name?: string;
    is_active: boolean;
  }) =>
    api.put<{ success: boolean; message: string }>(
      `/bot-settings/admin-chat/${id}`,
      data
    ),
};