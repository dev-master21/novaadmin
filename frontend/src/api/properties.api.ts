// frontend/src/api/properties.api.ts
import api from './axios';
import { getApiClient } from '@/utils/apiClient';

export interface Property {
  id: number;
  property_number: string;
  deal_type: string;
  property_type: string;
  region: string;
  bedrooms: number;
  bathrooms: number;
  sale_price: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  creator_name: string;
  creator_username: string;
  property_name?: string;
  cover_photo?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
}

export interface PriceMarkup {
  type: 'percent' | 'fixed';
  value: number;
}

export interface PropertyPricesInfo {
  dealType: 'rent' | 'sale' | 'both';
  yearlyPrice: number | null;
  seasonalPrices: Array<{
    id: number;
    pricing_type: 'per_night' | 'per_period';
    price_per_night: number;
    source_price_per_night: number | null;
    start_date_recurring: string;
    end_date_recurring: string;
    minimum_nights: number;
  }>;
  monthlyPrices: Array<{
    month_number: number;
    price_per_month: number;
    minimum_days: number | null;
  }>;
  salePrice: number | null;
}

export interface PropertiesResponse {
  success: boolean;
  data: {
    properties: Property[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface MonthlyPrice {
  month_number: number;
  price_per_month: number;
  minimum_days?: number | null;
}

export const propertiesApi = {
  // Методы, которые ВСЕГДА используют admin API
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    deal_type?: string;
    property_type?: string;
    search?: string;
    owner_name?: string;
  }) => api.get<PropertiesResponse>('/properties', { params }),

  getById: (id: number) => {
    const client = getApiClient();
    return client.get(`/properties/${id}`);
  },

  create: (data: any) => api.post('/properties', data),

  update: (id: number, data: any) => {
    const client = getApiClient();
    return client.put(`/properties/${id}`, data);
  },

  delete: (id: number) => api.delete(`/properties/${id}`),

  restore: (id: number) => api.post(`/properties/${id}/restore`),

  getUniqueOwners: () => api.get<{ success: boolean; data: string[] }>('/properties/owners/unique'),

  downloadPhotos: (propertyId: number, photoIds?: number[]) => 
    api.post(`/properties/${propertyId}/photos/download`, 
      { photoIds }, 
      { responseType: 'blob' }
    ),

  toggleVisibility: (id: number, status: string) => 
    api.patch(`/properties/${id}/visibility`, { status }),

  uploadPhotos: (id: number, formData: FormData, onProgress?: (progress: number) => void) => {
    return api.post(`/properties/${id}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  uploadVideos: (id: number, formData: FormData, onProgress?: (progress: number) => void) => {
    return api.post(`/properties/${id}/videos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  deleteVideo: (propertyId: number, videoId: number) => {
    return api.delete(`/properties/${propertyId}/videos/${videoId}`);
  },

  updateVideo: (propertyId: number, videoId: number, data: any) => {
    return api.put(`/properties/${propertyId}/videos/${videoId}`, data);
  },
  
  deletePhoto: (propertyId: number, photoId: number) => 
    api.delete(`/properties/${propertyId}/photos/${photoId}`),

  updatePhotosOrder: (id: number, updates: any[]) => 
    api.put(`/properties/${id}/photos/reorder`, { updates }),

  setPrimaryPhoto: (propertyId: number, photoId: number) => 
    api.patch(`/properties/${propertyId}/photos/${photoId}/primary`),

  uploadFloorPlan: (id: number, formData: FormData) => 
    api.post(`/properties/${id}/floor-plan`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

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
    
  getVRPanoramas: (propertyId: number) => 
    api.get(`/properties/${propertyId}/vr-panoramas`),

  createVRPanorama: (propertyId: number, formData: FormData) => 
    api.post(`/properties/${propertyId}/vr-panoramas`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  deleteVRPanorama: (panoramaId: number) => 
    api.delete(`/properties/vr-panoramas/${panoramaId}`),

  // ✅ Методы с getApiClient() для работы и админов, и владельцев
  getPricingDetails: (id: number) => {
    const client = getApiClient();
    return client.get(`/properties/${id}/pricing-details`);
  },

  updatePricingDetails: (id: number, data: any) => {
    const client = getApiClient();
    return client.put(`/properties/${id}/pricing-details`, data);
  },

  getMonthlyPricing: (id: number) => {
    const client = getApiClient();
    return client.get(`/properties/${id}/monthly-pricing`);
  },

  updateMonthlyPricing: (id: number, monthlyPricing: MonthlyPrice[]) => {
    const client = getApiClient();
    return client.put(`/properties/${id}/monthly-pricing`, { monthlyPricing });
  },

  getCalendar: (id: number, params?: { start_date?: string; end_date?: string }) => {
    const client = getApiClient();
    return client.get(`/properties/${id}/calendar`, { params });
  },

  addBlockedPeriod: (propertyId: number, data: { start_date: string; end_date: string; reason?: string }) => {
    const client = getApiClient();
    return client.post(`/properties/${propertyId}/calendar/block`, data);
  },
  
  removeBlockedDates: (propertyId: number, dates: string[]) => {
    const client = getApiClient();
    return client.delete(`/properties/${propertyId}/calendar/block`, { data: { dates } });
  },
  
  getICSInfo: (propertyId: number) => {
    const client = getApiClient();
    return client.get(`/properties/${propertyId}/ics`);
  },

  getExternalCalendars: (propertyId: number) => {
    const client = getApiClient();
    return client.get(`/properties/${propertyId}/external-calendars`);
  },

  addExternalCalendar: (propertyId: number, data: { calendar_name: string; ics_url: string }) => {
    const client = getApiClient();
    return client.post(`/properties/${propertyId}/external-calendars`, data);
  },

  removeExternalCalendar: (propertyId: number, calendarId: number, removeDates: boolean) => {
    const client = getApiClient();
    return client.delete(`/properties/${propertyId}/external-calendars/${calendarId}`, {
      data: { remove_dates: removeDates }
    });
  },

  toggleExternalCalendar: (propertyId: number, calendarId: number, isEnabled: boolean) => {
    const client = getApiClient();
    return client.patch(`/properties/${propertyId}/external-calendars/${calendarId}/toggle`, {
      is_enabled: isEnabled
    });
  },

  analyzeExternalCalendars: (propertyId: number, calendarIds: number[]) => {
    const client = getApiClient();
    return client.post(`/properties/${propertyId}/external-calendars/analyze`, {
      calendar_ids: calendarIds
    });
  },

  syncExternalCalendars: (propertyId: number) => {
    const client = getApiClient();
    return client.post(`/properties/${propertyId}/external-calendars/sync`);
  },

  updateVRPanoramasOrder: (propertyId: number, panoramas: any[]) => 
    api.put(`/properties/${propertyId}/vr-panoramas/order`, { panoramas }),

  uploadVideo: (id: number, file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('video', file);
  
    return api.post(`/properties/${id}/video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    });
  },

  checkAIGenerationReadiness: (id: number) => 
    api.get(`/properties/${id}/ai-generation/readiness`),
  
  generateAIDescription: (id: number, additionalPrompt?: string) => 
    api.post(`/properties/${id}/ai-generation/generate`, { additionalPrompt }),

  createWithAI: (text: string) =>
    api.post('/properties/create-with-ai', { text }),
  
  saveFromAI: (propertyData: any, photosData?: any[]) =>
    api.post('/properties/save-from-ai', { propertyData, photosData }),

  getPropertyPrices: (id: number): Promise<{ data: PropertyPricesInfo }> =>
    api.get(`/properties/${id}/prices`),
  
  // Получение preview URL для просмотра на основном сайте
  async getPreviewUrl(propertyId: number) {
    return api.get(`/properties/${propertyId}/preview-url`);
  },

deleteFloorPlan: (propertyId: number) => 
  api.delete(`/properties/${propertyId}/floor-plan`),

  generateHTML: (id: number, options: {
    language: string;
    displayMode?: 'rent' | 'sale' | 'both';
    showRentalPrices: boolean;
    showSalePrices: boolean;
    includeSeasonalPrices: boolean;
    includeMonthlyPrices: boolean;
    includeYearlyPrice: boolean;
    forAgent?: boolean;
    yearlyPriceMarkup?: PriceMarkup;
    seasonalPricesMarkup?: PriceMarkup;
    monthlyPricesMarkup?: { [monthNumber: number]: PriceMarkup };
    salePriceMarkup?: PriceMarkup;
  }) => api.post(`/properties/${id}/generate-html`, options, {
    responseType: 'text'
  }),
};