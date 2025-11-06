// backend/src/types/agreements.types.ts
export interface Agreement {
  id: number;
  agreement_number: string;
  template_id: number;
  property_id?: number;
  type: string;
  content: string;
  structure?: string;
  description?: string;
  date_from?: string;
  date_to?: string;
  city: string;
  status: 'draft' | 'pending_signatures' | 'signed' | 'active' | 'expired' | 'cancelled';
  public_link: string;
  qr_code_path?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface AgreementTemplate {
  id: number;
  name: string;
  type: string;
  content: string;
  structure?: string;
  version: number;
  is_active: boolean;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface AgreementParty {
  id: number;
  agreement_id: number;
  role: string;
  name: string;
  passport_country: string;
  passport_number: string;
  created_at: Date;
}

export interface AgreementSignature {
  id: number;
  agreement_id: number;
  signer_name: string;
  signer_role: string;
  position_x?: number;
  position_y?: number;
  position_page?: number;
  signature_link?: string;
  is_signed: boolean;
  signature_data?: string;
  signed_at?: Date;
  ip_address?: string;
  geolocation?: string;
  created_at: Date;
}

export interface CreateAgreementDTO {
  template_id: number;
  property_id?: number;
  description?: string;
  date_from?: string;
  date_to?: string;
  city?: string;
  parties?: AgreementParty[];
}

export interface UpdateAgreementDTO {
  content?: string;
  structure?: string;
  status?: string;
  description?: string;
}