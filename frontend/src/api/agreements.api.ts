// frontend/src/api/agreements.api.ts
import api from '@/utils/request';

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
  rent_amount_monthly?: number;
  rent_amount_total?: number;
  deposit_amount?: number;
  utilities_included?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  property_address_override?: string;
  status: string;
  public_link: string;
  qr_code_path?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  template_name?: string;
  property_name?: string;
  property_number?: string;
  created_by_name?: string;
  signature_count?: number;
  signed_count?: number;
  signatures?: AgreementSignature[];
  parties?: AgreementParty[];
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
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  usage_count?: number;
}

export interface AgreementParty {
  id?: number;
  agreement_id?: number;
  role: string;
  name: string;
  passport_country: string;
  passport_number: string;
  is_company?: boolean;
  company_name?: string;
  company_address?: string;
  company_tax_id?: string;
  director_name?: string;
  director_passport?: string;
  director_country?: string;
  document_path?: string;
  created_at?: string;
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
  signed_at?: string;
  ip_address?: string;
  geolocation?: string;
  created_at: string;
  // Новые поля для аналитики
  user_agent?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  first_visit_at?: string;
  agreement_view_duration?: number;
  signature_clear_count?: number;
  total_session_duration?: number;
}

export interface CreateAgreementDTO {
  template_id: number;
  property_id?: number;
  description?: string;
  date_from?: string;
  date_to?: string;
  city?: string;
  parties?: AgreementParty[];
  rent_amount_monthly?: number;
  rent_amount_total?: number;
  deposit_amount?: number;
  utilities_included?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  property_address_override?: string;
  property_name_manual?: string;
  property_number_manual?: string;
}

export interface UpdateAgreementDTO {
  content?: string;
  structure?: string;
  status?: string;
  description?: string;
}

export interface CreateSignaturesDTO {
  signatures: {
    signer_name: string;
    signer_role: string;
    position_x?: number;
    position_y?: number;
    position_page?: number;
  }[];
}

export const agreementsApi = {
  // === ДОГОВОРЫ ===
  getAll: (params?: {
    type?: string;
    status?: string;
    property_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ success: boolean; data: Agreement[]; pagination?: any }>('/agreements', { params }),

  getById: (id: number) =>
    api.get<{ success: boolean; data: Agreement }>(`/agreements/${id}`),

  create: (data: CreateAgreementDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number; agreement_number: string } }>('/agreements', data),

  update: (id: number, data: UpdateAgreementDTO) =>
    api.put<{ success: boolean; message: string }>(`/agreements/${id}`, data),

  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/agreements/${id}`),

  getByPublicLink: (link: string) =>
    api.get<{ success: boolean; data: Agreement }>(`/agreements/public/${link}`),

  createSignatures: (id: number, data: CreateSignaturesDTO) =>
    api.post<{ success: boolean; message: string; data: { signatureLinks: any[] } }>(
      `/agreements/${id}/signatures`,
      data
    ),

  // === ОБЪЕКТЫ ===
  getProperties: (search?: string) =>
    api.get<{ success: boolean; data: any }>('/agreements/properties', { params: { search } }),

  // === ШАБЛОНЫ ===
  getTemplates: (params?: { type?: string; active?: boolean }) =>
    api.get<{ success: boolean; data: AgreementTemplate[] }>('/agreements/templates/list', { params }),

  getTemplateById: (id: number) =>
    api.get<{ success: boolean; data: AgreementTemplate }>(`/agreements/templates/${id}`),

  createTemplate: (data: { name: string; type: string; content: string; structure?: string }) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>('/agreements/templates', data),

  updateTemplate: (id: number, data: { name?: string; content?: string; structure?: string; is_active?: boolean }) =>
    api.put<{ success: boolean; message: string }>(`/agreements/templates/${id}`, data),

  deleteTemplate: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/agreements/templates/${id}`),

  // === ПОДПИСИ ===
  getSignatureByLink: (link: string) =>
    api.get<{ success: boolean; data: any }>(`/agreements/signatures/link/${link}`),

signAgreement: (link: string, data: { 
  signature_data: string;
  agreement_view_duration?: number;
  signature_clear_count?: number;
  total_session_duration?: number;
}) =>
  api.post<{ success: boolean; message: string; data: { all_signed: boolean } }>(
    `/agreements/signatures/sign/${link}`,
    data
  ),

  updateSignature: (id: number, data: { signer_name?: string; signer_role?: string }) =>
    api.put<{ success: boolean; message: string }>(`/agreements/signatures/${id}`, data),

  regenerateSignatureLink: (id: number) =>
    api.post<{ success: boolean; message: string; data: { signature_link: string; public_url: string } }>(
      `/agreements/signatures/${id}/regenerate`
    ),

  deleteSignature: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/agreements/signatures/${id}`)
};