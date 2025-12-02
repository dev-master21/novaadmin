// frontend/src/api/propertyOwners.api.ts
import ownerApi from './ownerAxios';
import api from './axios';

export interface CreateOwnerAccessRequest {
  owner_name: string;
  can_edit_calendar?: boolean;
  can_edit_pricing?: boolean;
}

export interface UpdateOwnerPermissionsRequest {
  can_edit_calendar: boolean;
  can_edit_pricing: boolean;
}

export interface CreateOwnerAccessResponse {
  owner_name: string;
  access_url: string;
  password: string;
  properties_count: number;
  can_edit_calendar: boolean;
  can_edit_pricing: boolean;
}

export interface OwnerLoginRequest {
  access_token: string;
  password: string;
}

export interface OwnerLoginResponse {
  owner: {
    id: number;
    owner_name: string;
    access_token: string;
    properties_count: number;
    can_edit_calendar: boolean;
    can_edit_pricing: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface MonthlyPriceDetail {
  month: number;
  price: number | null;
  source_price: number | null;
  is_filled: boolean;
}

export interface CompletenessField {
  name: string;
  is_filled: boolean;
  field_key: string;
}

export interface CompletenessDetails {
  filled: CompletenessField[];
  missing: CompletenessField[];
  monthly_prices?: MonthlyPriceDetail[];
}

export interface OwnerProperty {
  id: number;
  property_number: string;
  property_name: string | null;
  deal_type: 'sale' | 'rent' | 'both';
  bedrooms: number;
  bathrooms: number;
  cover_photo: string | null;
  photos: Array<{ url: string }>;
  completeness: number;
  completeness_details?: CompletenessDetails;
  nearest_blocked_period: {
    start_date: string;
    end_date: string;
  } | null;
  has_blocked_dates: boolean;
  blocked_dates?: string[];
  pricing?: Array<{
    season_type: string;
    price_per_night: number;
    pricing_mode: string;
    pricing_type: string;
  }>;
}

// ✅ ПОЛНЫЙ интерфейс с ВСЕМИ полями
export interface OwnerPropertyDetail extends OwnerProperty {
  region: string;
  address: string;
  indoor_area: number | null;
  outdoor_area: number | null;
  
  // Поля для продажи
  sale_price: number | null;
  sale_pricing_mode: 'net' | 'gross' | null;
  sale_commission_type_new: 'percentage' | 'fixed' | null;
  sale_commission_value_new: number | null;
  sale_source_price: number | null;
  sale_margin_amount: number | null;
  sale_margin_percentage: number | null;
  
  // Поля для годовой аренды
  year_price: number | null;
  year_pricing_mode: 'net' | 'gross' | null;
  year_commission_type: 'percentage' | 'fixed' | null;
  year_commission_value: number | null;
  year_source_price: number | null;
  year_margin_amount: number | null;
  year_margin_percentage: number | null;
  
  // Поля для аренды
  deposit_type: 'one_month' | 'two_months' | 'custom' | null;
  deposit_amount: number | null;
  electricity_rate: number | null;
  water_rate: number | null;
  sale_commission_type: string | null;
  rent_commission_type: string | null;
  
  // Цены
  seasonal_pricing: Array<{
    season_type: string;
    start_date_recurring: string;
    end_date_recurring: string;
    price_per_night: number;
    pricing_mode: string;
    pricing_type: string;
    minimum_nights: number;
  }>;
  monthly_pricing: Array<{
    month_number: number;
    price_per_month: number;
    pricing_mode: string;
    minimum_days: number;
  }>;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const propertyOwnersApi = {
  // Админские эндпоинты
  createOwnerAccess: (data: CreateOwnerAccessRequest) =>
    api.post<{ success: boolean; data: CreateOwnerAccessResponse }>('/property-owners/create', data),

  getOwnerInfo: (ownerName: string) =>
    api.get<{ success: boolean; data: any }>(`/property-owners/info/${ownerName}`),

  updateOwnerPermissions: (ownerName: string, data: UpdateOwnerPermissionsRequest) =>
    api.put<{ success: boolean; message: string }>(`/property-owners/permissions/${ownerName}`, data),

  // Публичные эндпоинты
  verifyToken: (token: string) =>
    api.get<{ success: boolean; data: any }>(`/property-owners/verify/${token}`),

  login: (data: OwnerLoginRequest) =>
    api.post<{ success: boolean; data: OwnerLoginResponse }>('/property-owners/login', data),

  // Эндпоинты для авторизованных владельцев
  refreshToken: (refreshToken: string) =>
    ownerApi.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
      '/property-owners/refresh',
      { refreshToken }
    ),

  getProperties: () =>
    ownerApi.get<{ success: boolean; data: OwnerProperty[] }>('/property-owners/properties'),

  getProperty: (propertyId: number) =>
    ownerApi.get<{ success: boolean; data: OwnerPropertyDetail }>(`/property-owners/property/${propertyId}`),
  
  // ✅ Обновление цен
  updatePropertyPricing: (propertyId: number, data: any) =>
    ownerApi.put<{ success: boolean; message: string }>(`/property-owners/property/${propertyId}/pricing`, data),

  // ✅ Обновление месячных цен
  updatePropertyMonthlyPricing: (propertyId: number, monthlyPricing: any[]) =>
    ownerApi.put<{ success: boolean; message: string }>(`/property-owners/property/${propertyId}/monthly-pricing`, { monthlyPricing }),

  changePassword: (data: ChangePasswordRequest) =>
    ownerApi.post<{ success: boolean; message: string }>('/property-owners/change-password', data),

  getPropertyPreviewUrl: (propertyId: number) =>
    ownerApi.get<{ success: boolean; data: { previewUrl: string } }>(`/property-owners/property/${propertyId}/preview-url`),
};