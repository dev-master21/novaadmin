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

export interface CreateSignaturesDTO {
  signatures: {
    signer_name: string;
    signer_role: string;
    position_x: number;
    position_y: number;
    position_page: number;
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

  signAgreement: (link: string, data: { signature_data: string }) =>
    api.post<{ success: boolean; message: string; data: { all_signed: boolean } }>(
      `/agreements/signatures/sign/${link}`,
      data
    ),

  deleteSignature: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/agreements/signatures/${id}`),
};