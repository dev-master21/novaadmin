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

export const propertiesApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    deal_type?: string;
    property_type?: string;
    search?: string;
  }) => api.get<PropertiesResponse>('/properties', { params }),

  getById: (id: number) => api.get(`/properties/${id}`),

  create: (data: any) => api.post('/properties', data),

  update: (id: number, data: any) => api.put(`/properties/${id}`, data),

  delete: (id: number) => api.delete(`/properties/${id}`),

  restore: (id: number) => api.post(`/properties/${id}/restore`),

  toggleVisibility: (id: number, status: string) => 
    api.patch(`/properties/${id}/visibility`, { status }),

  uploadPhotos: (id: number, formData: FormData, onProgress?: (progress: number) => void) => 
    api.post(`/properties/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    }),

  deletePhoto: (photoId: number) => api.delete(`/properties/photos/${photoId}`),

  updatePhotosOrder: (id: number, photos: any[]) => 
    api.put(`/properties/${id}/photos/order`, { photos }),

  setPrimaryPhoto: (photoId: number) => 
    api.patch(`/properties/photos/${photoId}/primary`),

  uploadFloorPlan: (id: number, formData: FormData) => 
    api.post(`/properties/${id}/floor-plan`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // VR Panoramas
  getVRPanoramas: (propertyId: number) => 
    api.get(`/properties/${propertyId}/vr-panoramas`),

  createVRPanorama: (propertyId: number, formData: FormData) => 
    api.post(`/properties/${propertyId}/vr-panoramas`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  deleteVRPanorama: (panoramaId: number) => 
    api.delete(`/properties/vr-panoramas/${panoramaId}`),

  // Получить детальную информацию по ценам
  getPricingDetails: (id: number) => 
    api.get(`/properties/${id}/pricing-details`),

  // Получить календарь занятости
  getCalendar: (id: number, params?: { start_date?: string; end_date?: string }) => 
    api.get(`/properties/${id}/calendar`, { params }),
  
  updateVRPanoramasOrder: (propertyId: number, panoramas: any[]) => 
    api.put(`/properties/${propertyId}/vr-panoramas/order`, { panoramas }),
  // Добавить в propertiesApi:

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
   
   deleteVideo: (id: number) => api.delete(`/properties/${id}/video`),
};