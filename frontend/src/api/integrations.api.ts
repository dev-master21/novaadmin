// frontend/src/api/integrations.api.ts
import api from './axios';

export interface Integration {
  id: number;
  integration_type: 'beds24' | 'airbnb' | 'booking' | 'agoda';
  api_key_v1?: string;
  api_key_v2?: string;
  is_active: boolean;
  is_verified: boolean;
  last_verified_at?: string;
  last_sync_at?: string;
  sync_error?: string;
  settings_json?: any;
  created_at: string;
  updated_at: string;
}

export interface Beds24Property {
  propId: number;
  propName: string;
  propCode?: string;
  rooms: Beds24Room[];
}

export interface Beds24Room {
  roomId: number;
  roomName: string;
  propId: number;
}

export interface MyProperty {
  id: number;
  property_number: string;
  property_name?: string;
  property_type: string;
  region: string;
  bedrooms?: number;
  bathrooms?: number;
  deal_type: string;
  cover_photo?: string;
  beds24_prop_id?: number;
  beds24_room_id?: number;
  is_synced: boolean;
  creator_name: string;
}

export const integrationsApi = {
  // Получить все интеграции
  getIntegrations: () =>
    api.get<{ success: boolean; data: Integration[] }>('/integrations'),

  // Получить конкретную интеграцию
  getIntegration: (type: string) =>
    api.get<{ success: boolean; data: Integration }>(`/integrations/${type}`),

  // Сохранить интеграцию
  saveIntegration: (type: string, data: {
    api_key_v1: string;
    api_key_v2?: string;
    settings_json?: any;
  }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>(
      `/integrations/${type}`,
      data
    ),

  // Удалить интеграцию
  deleteIntegration: (type: string) =>
    api.delete<{ success: boolean; message: string }>(`/integrations/${type}`),

  // ========== BEDS24 ==========

  // Проверить API ключ Beds24
  verifyBeds24: (api_key_v1: string) =>
    api.post<{ success: boolean; message: string }>(
      '/integrations/beds24/verify',
      { api_key_v1 }
    ),

  // Получить объекты из Beds24
  getBeds24Properties: () =>
    api.get<{ success: boolean; data: Beds24Property[] }>(
      '/integrations/beds24/properties'
    ),

  // Получить свои объекты для синхронизации
  getMyProperties: () =>
    api.get<{ success: boolean; data: MyProperty[] }>(
      '/integrations/beds24/my-properties'
    ),

  // Привязать объект к Beds24
  linkProperty: (data: {
    property_id: number;
    beds24_prop_id: number;
    beds24_room_id: number;
  }) =>
    api.post<{ success: boolean; message: string }>(
      '/integrations/beds24/link',
      data
    ),

  // Отвязать объект от Beds24
  unlinkProperty: (propertyId: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/integrations/beds24/unlink/${propertyId}`
    ),
};