// backend/src/types/agreements.types.ts
export interface Agreement {
  id: number;
  agreement_number: string;
  template_id: number;
  property_id?: number;
  request_uuid?: string;  // ✅ ДОБАВЛЕНО
  type: string;
  content: string;
  structure?: string;
  description?: string;
  date_from?: string;
  date_to?: string;
  city: string;
  status: 'draft' | 'pending_signatures' | 'signed' | 'active' | 'expired' | 'cancelled';
  public_link: string;
  verify_link?: string;
  qr_code_path?: string;
  qr_code_base64?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  pdf_path?: string;
  pdf_generated_at?: Date;
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
  request_uuid?: string;  // ✅ ДОБАВЛЕНО
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

export interface AIEditRequest {
  prompt: string;
  conversationId?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface AIEditResponse {
  conversationId: string;
  changes: {
    description: string;
    descriptionRu: string;
    changedFields: string[];
    htmlAfter: string;
    structureAfter: string;
    databaseUpdates: Record<string, any>;
  };
  aiResponse: string;
}

export interface AIEditLog {
  id: number;
  agreement_id: number;
  user_id: number;
  conversation_id: string;
  prompt: string;
  ai_response: string;
  changes_description: string;
  changes_list: any[];
  html_before: string;
  html_after: string;
  structure_before: string;
  structure_after: string;
  database_fields_changed: Record<string, any>;
  was_applied: boolean;
  applied_at?: Date;
  created_at: Date;
}
