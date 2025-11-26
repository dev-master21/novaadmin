import api from '@/utils/request';

export interface Request {
  id: number;
  request_number: string;
  uuid: string;
  chat_uuid: string;
  request_source: 'telegram' | 'whatsapp';
  
  client_telegram_id: string;
  client_username?: string;
  client_first_name?: string;
  client_last_name?: string;
  client_phone?: string;
  whatsapp_phone?: string;

  client_name?: string;
  additional_info?: string;
  agreement_id?: number;
  
  manager_telegram_id: string;
  manager_username?: string;
  manager_first_name?: string;
  manager_last_name?: string;
  
  agent_id?: number;
  agent_username?: string;
  agent_first_name?: string;
  agent_last_name?: string;
  agent_accepted_at?: string;
  
  initial_note?: string;
  first_message_at?: string;
  last_message_at?: string;
  
  description?: string;
  check_in_date?: string;
  check_out_date?: string;
  budget?: string;
  notes?: string;
  rental_period?: string;
  district?: string;
  
  client_passport_path?: string;
  agent_passport_path?: string;
  
  contract_requested_at?: string

  rental_dates?: string;
  villa_name_address?: string;
  rental_cost?: string;
  cost_includes?: string;
  utilities_cost?: string;
  payment_terms?: string;
  deposit_amount?: string;
  additional_terms?: string;
  
  status: 'new' | 'in_progress' | 'rejected' | 'completed' | 'deal_created';
  rejected_at?: string;
  completed_at?: string;
  deal_created_at?: string;
  
  created_at: string;
  updated_at: string;
  
  messages_count?: number;
  chat_views_count?: number;
  request_views_count?: number;
  
  proposed_properties?: ProposedProperty[];
}

export interface ProposedProperty {
  id: number;
  request_id: number;
  property_id?: number;
  custom_name?: string;
  rejection_reason?: string;
  proposed_at: string;
  property_number?: string;
  property_name?: string;
  address?: string;
}

export interface RequestMessage {
  id: number;
  request_id: number;
  telegram_message_id: number;
  from_telegram_id: string;
  from_username?: string;
  from_first_name?: string;
  from_last_name?: string;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'audio' | 'document' | 'sticker' | 'animation' | 'location' | 'contact' | 'whatsapp_screenshot';
  message_text?: string;
  media_file_id?: string;
  media_file_path?: string;
  media_file_base64?: string;
  media_mime_type?: string;
  media_file_size?: number;
  media_duration?: number;
  media_width?: number;
  media_height?: number;
  caption?: string;
  reply_to_message_id?: number;
  message_date: string;
  created_at: string;
}

export interface FieldHistory {
  id: number;
  request_id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by_agent_id?: number;
  telegram_username?: string;
  first_name?: string;
  last_name?: string;
  changed_at: string;
}

export interface AgentGroup {
  id: number;
  group_name: string;
  description?: string;
  chat_id?: string;
}

export const requestsApi = {
  // === ПУБЛИЧНЫЕ ENDPOINTS ===
  
  // Получить заявку по UUID
  getByUuid: (uuid: string) =>
    api.get<{ success: boolean; data: Request }>(`/requests/public/${uuid}`),

  // Получить историю чата
  getChatHistory: (chatUuid: string) =>
    api.get<{ success: boolean; data: { request_info: any; messages: RequestMessage[] } }>(
      `/requests/chat/${chatUuid}`
    ),

  // Обновить поле заявки
  updateField: (uuid: string, data: { field_name: string; field_value: any; agent_telegram_id?: string }) =>
    api.put<{ success: boolean; message: string }>(`/requests/public/${uuid}/field`, data),

  // Получить историю изменений поля
  getFieldHistory: (uuid: string, fieldName: string) =>
    api.get<{ success: boolean; data: FieldHistory[] }>(
      `/requests/public/${uuid}/field-history/${fieldName}`
    ),

  // Загрузить паспорт клиента
  uploadClientPassport: (uuid: string, formData: FormData) =>
    api.post<{ success: boolean; message: string; data: { passport_path: string } }>(
      `/requests/public/${uuid}/upload-client-passport`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ),

  // Загрузить паспорт агента
  uploadAgentPassport: (uuid: string, formData: FormData) =>
    api.post<{ success: boolean; message: string; data: { passport_path: string } }>(
      `/requests/public/${uuid}/upload-agent-passport`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ),

  // Добавить предложенный вариант
  addProposedProperty: (uuid: string, data: {
    property_id?: number;
    custom_name?: string;
    rejection_reason?: string;
    agent_telegram_id?: string;
  }) =>
    api.post<{ success: boolean; message: string }>(`/requests/public/${uuid}/add-property`, data),

  // Обновить статус заявки
  updateStatus: (uuid: string, data: { status: string; agent_telegram_id?: string }) =>
    api.put<{ success: boolean; message: string }>(`/requests/public/${uuid}/status`, data),

  // Получить список объектов
  getProperties: (search?: string) =>
    api.get<{ success: boolean; data: any[] }>('/requests/properties', { params: { search } }),

  // === ЗАЩИЩЕННЫЕ ENDPOINTS ===
  
  // Получить все заявки (для админки)
  getAll: (params?: {
    status?: string;
    agent_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{ success: boolean; data: Request[]; pagination?: any }>('/requests', { params }),

  // Получить заявку по ID (для админки)
  getById: (id: number) =>
    api.get<{ success: boolean; data: Request }>(`/requests/${id}`),

  // Удалить заявку
  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/requests/${id}`),

  // Запросить контракт
  requestContract: (uuid: string, data: {
    rental_dates: string;
    villa_name_address: string;
    rental_cost: string;
    cost_includes?: string;
    utilities_cost?: string;
    payment_terms?: string;
    deposit_amount?: string;
    additional_terms?: string;
    client_passport_front: string;
    client_passport_back: string;
    agent_passport_front: string;
    agent_passport_back: string;
  }) =>
    api.post<{ success: boolean; message: string }>(
      `/requests/public/${uuid}/request-contract`,
      data
    ),

  // Получить данные заявки для создания договора
  getRequestForAgreement: (uuid: string) =>
    api.get<{ success: boolean; data: Request }>(
      `/requests/public/${uuid}/for-agreement`
    ),

  // Связать договор с заявкой
  linkAgreementToRequest: (uuid: string, agreementId: number) =>
    api.post<{ success: boolean; message: string }>(
      `/requests/public/${uuid}/link-agreement`,
      { agreement_id: agreementId }
    ),

  // Получить список групп агентов
  getAgentGroups: () =>
    api.get<{ success: boolean; data: AgentGroup[] }>('/requests/agent-groups'),

  // Загрузить скриншот WhatsApp
  uploadWhatsAppScreenshot: (formData: FormData) =>
    api.post<{ success: boolean; message: string; data: { screenshot_path: string } }>(
      '/requests/upload-whatsapp-screenshot',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ),

  // Создать заявку из WhatsApp
  createWhatsAppRequest: (data: {
    client_name: string;
    whatsapp_phone: string;
    initial_note?: string;
    agent_group_id?: number;
    screenshots: string[];
  }) =>
    api.post<{ 
      success: boolean; 
      message: string; 
      data: {
        request_id: number;
        request_number: string;
        uuid: string;
        chat_uuid: string;
        chat_url: string;
        request_url: string;
      }
    }>('/requests/create-whatsapp', data)
};