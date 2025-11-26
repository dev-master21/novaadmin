// frontend/src/api/agreements.api.ts
import api from '@/utils/request';

export interface Agreement {
  id: number;
  agreement_number: string;
  template_id: number;
  property_id?: number;
  request_uuid?: string;
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
  verify_link?: string;
  qr_code_path?: string;
  qr_code_base64?: string;
  pdf_path?: string;
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
  lessor?: AgreementParty;
  tenant?: AgreementParty;
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
  type: 'company' | 'individual';
  individual_name?: string;
  individual_country?: string;
  individual_passport?: string;
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
  request_uuid?: string;
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

// ✅ НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ AI РЕДАКТИРОВАНИЯ
export interface AIChangedSection {
  section: string;
  action: 'added' | 'modified' | 'removed';
  clause_number: string;
  text_en: string;
  text_ru: string;
  reason_en: string;
  reason_ru: string;
}

export interface AIConflictDetected {
  section: string;
  clause_number: string;
  conflict_description: string;
  conflict_description_ru: string;
  text_en: string;
  text_ru: string;
  resolution: string;
  resolution_ru: string;
}

export interface AIEditResponse {
  success: boolean;
  data: {
    conversationId: string;
    aiResponse: string;
    changes: {
      description: string;
      descriptionRu: string;
      changedFields: string[];
      changedSections?: AIChangedSection[];
      conflictsDetected?: AIConflictDetected[];
      htmlAfter: string;
      structureAfter: string;
      databaseUpdates: Record<string, any>;
    };
  };
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
    api.post<{ 
      success: boolean; 
      message: string; 
      data: { 
        id: number; 
        agreement_number: string;
        parties?: Array<{ id: number; role: string }>;
      } 
    }>('/agreements', data),

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

  downloadPDF: (id: number) => {
    return api.get(`/agreements/${id}/pdf`, {
      responseType: 'blob'
    });
  },

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
    api.get<{ success: boolean; data: AgreementSignature }>(`/agreements/signatures/link/${link}`),

  getPublicAgreementByLink: (link: string) =>
    api.get<{ success: boolean; data: Agreement }>(`/agreements/by-signature-link/${link}`),

  signAgreement: (signatureId: number, data: { 
    signature_data: string;
    agreement_view_duration?: number;
    signature_clear_count?: number;
    total_session_duration?: number;
  }) =>
    api.post<{ success: boolean; message: string; data: { all_signed: boolean } }>(
      `/agreements/signatures/${signatureId}/sign`,
      data
    ),

  updateSignature: (id: number, data: { signer_name?: string; signer_role?: string }) =>
    api.put<{ success: boolean; message: string }>(`/agreements/signatures/${id}`, data),

  regenerateSignatureLink: (id: number) =>
    api.post<{ success: boolean; message: string; data: { signature_link: string; public_url: string } }>(
      `/agreements/signatures/${id}/regenerate`
    ),

  deleteSignature: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/agreements/signatures/${id}`),

  // === ЗАГРУЗКА ДОКУМЕНТОВ ===
  uploadAgreementDocuments: (agreementId: number, formData: FormData) =>
    api.post<{ success: boolean; message: string; uploadedCount: number }>(
      `/agreements/${agreementId}/upload-documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ),
    
  downloadPDFPublic: (link: string) => {
    return api.get(`/agreements/download-pdf/${link}`, {
      responseType: 'blob'
    });
  },

  getAgreementByVerifyLink: (verifyLink: string) => {
    return api.get(`/agreements/verify/${verifyLink}`);
  },

  notifyAgent: (agreementId: number, requestUuid: string) => {
    return api.post(`/agreements/${agreementId}/notify-agent`, {
      request_uuid: requestUuid
    });
  },

  getAgreementWithParties: (id: number) =>
    api.get<{ success: boolean; data: Agreement }>(`/agreements/${id}/with-parties`),

  // === AI РЕДАКТИРОВАНИЕ ===
  aiEdit: (id: number, data: { 
    prompt: string; 
    conversationId?: string;
    conversationHistory?: any[];
  }) =>
    api.post<AIEditResponse>(`/agreements/${id}/ai-edit`, data),

  applyAiEdit: (id: number, data: {
    conversationId: string;
    htmlAfter: string;
    structureAfter: string;
    databaseUpdates: Record<string, any>;
  }) =>
    api.post<{
      success: boolean;
      message: string;
    }>(`/agreements/${id}/ai-edit/apply`, data),

  getAiEditHistory: (id: number) =>
    api.get<{
      success: boolean;
      data: any[];
    }>(`/agreements/${id}/ai-edit/history`),
};