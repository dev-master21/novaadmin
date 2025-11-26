// frontend/src/modules/Properties/types.ts
export interface Property {
  id: number;
  property_number: string;
  deal_type: string;
  property_type: string;
  region: string;
  address?: string;
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
  owner_telegram?: string;
  owner_instagram?: string;
  owner_notes?: string;
}

export interface PropertyFilters {
  status?: string;
  deal_type?: string;
  property_type?: string;
  search?: string;
  owner_name?: string;
}