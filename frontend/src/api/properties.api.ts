// frontend/src/api/properties.api.ts
import api from './axios';

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
  type: 'percent' | 'fixed'; // процент или фиксированная сумма в батах
  value: number; // значение
}

export interface PropertyPricesInfo {
  dealType: 'rent' | 'sale' | 'both'; // ✅ Добавляем deal_type
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

// ✅ НОВЫЙ ТИП
export interface MonthlyPrice {
  month_number: number;
  price_per_month: number;
  minimum_days?: number;
}

export const propertiesApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    deal_type?: string;
    property_type?: string;
    search?: string;
    owner_name?: string;
  }) => api.get<PropertiesResponse>('/properties', { params }),

  getById: (id: number) => api.get(`/properties/${id}`),

  create: (data: any) => api.post('/properties', data),

  update: (id: number, data: any) => api.put(`/properties/${id}`, data),

  delete: (id: number) => api.delete(`/properties/${id}`),

  restore: (id: number) => api.post(`/properties/${id}/restore`),

  getUniqueOwners: () => api.get<{ success: boolean; data: string[] }>('/properties/owners/unique'),

  // Скачать фотографии
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
    
  // VR Panoramas
  getVRPanoramas: (propertyId: number) => 
    api.get(`/properties/${propertyId}/vr-panoramas`),

  createVRPanorama: (propertyId: number, formData: FormData) => 
    api.post(`/properties/${propertyId}/vr-panoramas`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  deleteVRPanorama: (panoramaId: number) => 
    api.delete(`/properties/vr-panoramas/${panoramaId}`),

  // Управление календарём занятости
  addBlockedPeriod: (propertyId: number, data: { start_date: string; end_date: string; reason?: string }) =>
    api.post(`/properties/${propertyId}/calendar/block`, data),
  
  removeBlockedDates: (propertyId: number, dates: string[]) =>
    api.delete(`/properties/${propertyId}/calendar/block`, { data: { dates } }),
  
  getICSInfo: (propertyId: number) =>
    api.get(`/properties/${propertyId}/ics`),

  // Получить детальную информацию по ценам
  getPricingDetails: (id: number) => 
    api.get(`/properties/${id}/pricing-details`),

  // ✅ НОВОЕ: Обновить месячные цены
  updateMonthlyPricing: (id: number, monthlyPricing: MonthlyPrice[]) =>
    api.put(`/properties/${id}/monthly-pricing`, { monthlyPricing }),

  // Получить календарь занятости
  getCalendar: (id: number, params?: { start_date?: string; end_date?: string }) => 
    api.get(`/properties/${id}/calendar`, { params }),
  
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

  // Управление внешними календарями
  getExternalCalendars: (propertyId: number) =>
    api.get(`/properties/${propertyId}/external-calendars`),

  addExternalCalendar: (propertyId: number, data: { calendar_name: string; ics_url: string }) =>
    api.post(`/properties/${propertyId}/external-calendars`, data),

  removeExternalCalendar: (propertyId: number, calendarId: number, removeDates: boolean) =>
    api.delete(`/properties/${propertyId}/external-calendars/${calendarId}`, {
      data: { remove_dates: removeDates }
    }),

  toggleExternalCalendar: (propertyId: number, calendarId: number, isEnabled: boolean) =>
    api.patch(`/properties/${propertyId}/external-calendars/${calendarId}/toggle`, {
      is_enabled: isEnabled
    }),

  analyzeExternalCalendars: (propertyId: number, calendarIds: number[]) =>
    api.post(`/properties/${propertyId}/external-calendars/analyze`, {
      calendar_ids: calendarIds
    }),

  syncExternalCalendars: (propertyId: number) =>
    api.post(`/properties/${propertyId}/external-calendars/sync`),

  // AI Generation
  checkAIGenerationReadiness: (id: number) => 
    api.get(`/properties/${id}/ai-generation/readiness`),
  
  generateAIDescription: (id: number, additionalPrompt?: string) => 
    api.post(`/properties/${id}/ai-generation/generate`, { additionalPrompt }),

  // AI создание объекта
  createWithAI: (text: string) =>
    api.post('/properties/create-with-ai', { text }),
  
  saveFromAI: (propertyData: any, photosData?: any[]) =>
    api.post('/properties/save-from-ai', { propertyData, photosData }),

  getPropertyPrices: (id: number): Promise<{ data: PropertyPricesInfo }> =>
    api.get(`/properties/${id}/prices`),
  
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