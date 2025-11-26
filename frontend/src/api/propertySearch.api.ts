// frontend/src/api/propertySearch.api.ts
import api from './axios';

export interface SearchFilters {
  deal_type?: 'sale' | 'rent' | 'both';
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
    tolerance?: number;
    search_below_max?: boolean;
  };
  dates?: {
    check_in?: string;
    check_out?: string;
    tolerance_days?: number;
  };
  regions?: string[];
  features?: string[];
  must_have_features?: string[];
  furniture?: string;
  parking?: boolean;
  pets?: boolean;
  complex_name?: string;
  floor?: {
    min?: number;
    max?: number;
  };
  floors?: {
    min?: number;
    max?: number;
  };
  distance_to_beach?: {
    max?: number;
  };
  owner_name?: string;
  map_search?: {
    lat: number;
    lng: number;
    radius_km: number;
  };
}

export interface PropertySearchResult {
  id: number;
  property_number: string;
  property_name: string;
  deal_type: string;
  property_type: string;
  region: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  indoor_area: number;
  distance_to_beach: number | null;
  sale_price: number | null;
  year_price: number | null;
  cover_photo: string;
  photos_count: number;
  calculated_price: {
    total_price: number;
    currency: string;
    nights: number;
    breakdown: any[];
  } | null;
}

export interface AIConversation {
  id: number;
  mode: 'property_search' | 'client_agent';
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages_count: number;
  first_message: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

export interface SearchHistoryLog {
  id: number;
  user_id: number;
  search_type: 'ai' | 'manual';
  ai_query?: string;
  search_params?: string;
  results_count: number;
  execution_time_ms: number;
  created_at: string;
  conversation_id?: number;
}

export const propertySearchApi = {
  // Поиск через AI с диалогами
    searchWithAI: (query: string, conversationId?: number) =>
      api.post<{
        success: boolean;
        data: {
          conversationId: number;
          interpretation: any;
          aiResponse: string;
          properties: PropertySearchResult[];
          total: number;
          execution_time_ms: number;
          requested_features: string[];        // ← НОВОЕ
          must_have_features: string[];        // ← НОВОЕ
        };
      }>('/property-search/ai', { query, conversationId }),

  // Режим клиент-агент
    chatWithClient: (message: string, conversationId?: number) =>
      api.post<{
        success: boolean;
        data: {
          conversationId: number;
          response: string;
          shouldShowProperties: boolean;
          properties: PropertySearchResult[];
          total: number;
          execution_time_ms: number;
          requested_features: string[];        // ← НОВОЕ
          must_have_features: string[];        // ← НОВОЕ
        };
      }>('/property-search/chat', { message, conversationId }),

  // Мануальный поиск
searchManual: (filters: SearchFilters) =>
  api.post<{
    success: boolean;
    data: {
      properties: PropertySearchResult[];
      total: number;
      execution_time_ms: number;
      requested_features: string[];        // ← НОВОЕ
      must_have_features: string[];        // ← НОВОЕ
    };
  }>('/property-search/manual', filters),

  // Получить список диалогов
  getConversations: (params?: { page?: number; limit?: number; mode?: string }) =>
    api.get<{
      success: boolean;
      data: {
        conversations: AIConversation[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/property-search/conversations', { params }),

  // Получить конкретный диалог
  getConversationById: (id: number) =>
    api.get<{
      success: boolean;
      data: {
        conversation: AIConversation;
        messages: ConversationMessage[];
      };
    }>(`/property-search/conversations/${id}`),

  // Удалить диалог
  deleteConversation: (id: number) =>
    api.delete(`/property-search/conversations/${id}`),

  // История поисков
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get<{
      success: boolean;
      data: {
        logs: SearchHistoryLog[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/property-search/history', { params }),

  // Получить конкретный лог поиска по ID
  getLogById: (id: number) =>
    api.get<{
      success: boolean;
      data: SearchHistoryLog;
    }>(`/property-search/history/${id}`),

  // Удалить лог из истории
  deleteLog: (id: number) =>
    api.delete<{
      success: boolean;
      message: string;
    }>(`/property-search/history/${id}`),

  // Рассчитать расстояние до пляжа
  calculateBeachDistance: (latitude: number, longitude: number) =>
    api.post<{
      success: boolean;
      data: {
        distance: number;
        distanceFormatted: string;
        category: string;
        nearestBeach: string;
      };
    }>('/property-search/calculate-beach-distance', { latitude, longitude }),

// Найти доступные периоды для объекта
findAvailablePeriods: (propertyId: number, nights: number, month?: number, year?: number) =>
  api.post<{
    success: boolean;
    data: {
      property_id: number;
      nights: number;
      periods: Array<{
        check_in: string;
        check_out: string;
        nights: number;
        total_price: number;
        daily_average: number;
      }>;
      total_found: number;
    };
  }>('/property-search/available-periods', { 
    property_id: propertyId, 
    nights, 
    month, 
    year 
  }),

// Получить последний AI interpretation
getLastAIInterpretation: () =>
  api.get<{
    success: boolean;
    data: {
      id: number;
      query: string;
      raw_response: string;
      interpretation: any;
      converted_filters: any;
      results_count: number;
      created_at: string;
    };
  }>('/property-search/last-ai-interpretation'),

  // Получить историю поисков
  getSearchHistory: (page: number = 1, limit: number = 10) =>
    api.get<{
      success: boolean;
      data: {
        history: any[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/property-search/history', {
      params: { page, limit }
    }),

  // Удалить запись из истории
  deleteSearchHistory: (id: number) =>
    api.delete<{
      success: boolean;
      message: string;
    }>(`/property-search/history/${id}`),

// Получить результаты конкретного поиска
  getSearchResults: (id: number) =>
    api.get<{
      success: boolean;
      data: {
        log: {
          id: number;
          search_type: string;
          ai_query?: string;
          search_params: any;
          results_count: number;
          execution_time_ms: number;
          created_at: string;
          conversation_id?: number;
        };
        properties: PropertySearchResult[];
      };
    }>(`/property-search/history/${id}/results`)
};