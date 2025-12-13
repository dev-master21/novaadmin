// frontend/src/api/financialDocuments.api.ts
import api from '@/utils/request';
import publicApi from './publicAxios';

// ==================== ТИПЫ БАНКОВСКИХ РЕКВИЗИТОВ ====================

export type BankDetailsType = 'simple' | 'international' | 'custom';

export interface SavedBankDetails {
  id: number;
  name: string;
  bank_details_type: BankDetailsType;
  
  // Простые поля
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
  // Международные поля
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_address?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Метаданные
  created_by: number;
  partner_id?: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface CreateSavedBankDetailsDTO {
  name: string;
  bank_details_type: BankDetailsType;
  
  // Простые поля
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
  // Международные поля
  bank_account_address?: string;
  bank_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
}

// ==================== ИНВОЙСЫ ====================

export interface Invoice {
  id: number;
  invoice_number: string;
  uuid: string;
  agreement_id?: number;
  invoice_date: string;
  due_date?: string;
  show_qr_code?: number;

  from_type: 'company' | 'individual';
  from_company_name?: string;
  from_company_tax_id?: string;
  from_company_address?: string;
  from_director_name?: string;
  from_director_country?: string;
  from_director_passport?: string;
  from_individual_name?: string;
  from_individual_country?: string;
  from_individual_passport?: string;

  agreement_verify_link?: string;

  to_type: 'company' | 'individual';
  to_company_name?: string;
  to_company_tax_id?: string;
  to_company_address?: string;
  to_director_name?: string;
  to_director_country?: string;
  to_director_passport?: string;
  to_individual_name?: string;
  to_individual_country?: string;
  to_individual_passport?: string;


  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  currency: string;
  
  // НОВЫЕ ПОЛЯ: Банковские реквизиты
  bank_details_type?: BankDetailsType;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_custom_details?: string;
  bank_address?: string;
  
  notes?: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  
  qr_code_base64?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
  
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Relations
  agreement_number?: string;
  created_by_name?: string;
  receipts_count?: number;
  items_count?: number;
  total_items_count?: number;
  paid_items_count?: number;
  items?: InvoiceItem[];
  receipts?: Receipt[];
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order?: number;
  
  // НОВЫЕ ПОЛЯ
  due_date?: string;
  is_fully_paid?: boolean;
  amount_paid?: number;
  
  created_at?: string;
  updated_at?: string;
}

export interface CreateInvoiceDTO {
  agreement_id?: number;
  invoice_date: string;
  due_date?: string;
  show_qr_code?: number;
  
  from_type: 'company' | 'individual';
  from_company_name?: string;
  from_company_tax_id?: string;
  from_company_address?: string;
  from_director_name?: string;
  from_director_country?: string;
  from_director_passport?: string;
  from_individual_name?: string;
  from_individual_country?: string;
  from_individual_passport?: string;
  
  to_type: 'company' | 'individual';
  to_company_name?: string;
  to_company_tax_id?: string;
  to_company_address?: string;
  to_director_name?: string;
  to_director_country?: string;
  to_director_passport?: string;
  to_individual_name?: string;
  to_individual_country?: string;
  to_individual_passport?: string;
  selected_items?: number[];

  items: InvoiceItem[];
  
  // НОВЫЕ ПОЛЯ: Банковские реквизиты
  bank_details_type?: BankDetailsType;
  saved_bank_details_id?: number;
  
  // Простые реквизиты
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
  // Международные реквизиты
  bank_account_address?: string;
  bank_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Сохранение реквизитов
  save_bank_details?: boolean;
  bank_details_name?: string;
  
  notes?: string;
  tax_amount?: number;
}

// ==================== ЧЕКИ ====================

export interface Receipt {
  id: number;
  invoice?: Invoice;
  uuid: string;
  invoice_uuid?: string;
  agreement_verify_link?: string;
  receipt_number: string;
  invoice_id: number;
  agreement_id?: number;
  receipt_date: string;
  amount_paid: number;
  payment_method: 'bank_transfer' | 'cash' | 'crypto' | 'barter';
  show_qr_code?: number;
  
  // НОВЫЕ ПОЛЯ: Банковские реквизиты
  bank_details_type?: BankDetailsType;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_custom_details?: string;
  bank_address?: string;

  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  
  qr_code_base64?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
  
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Relations
  invoice_number?: string;
  agreement_number?: string;
  created_by_name?: string;
  files_count?: number;
  files?: ReceiptFile[];
  items?: ReceiptInvoiceItem[];
}

export interface ReceiptFile {
  id?: number;
  receipt_id?: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at?: string;
}

export interface ReceiptInvoiceItem {
  id?: number;
  receipt_id?: number;
  invoice_item_id: number;
  amount_allocated: number;
  created_at?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

export interface CreateReceiptDTO {
  invoice_id: number;
  agreement_id?: number;
  receipt_date: string;
  amount_paid: number;
  payment_method: 'bank_transfer' | 'cash' | 'crypto' | 'barter';
  
  // НОВЫЕ ПОЛЯ: Банковские реквизиты
  bank_details_type?: BankDetailsType;
  saved_bank_details_id?: number;
  
  // Простые реквизиты
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  show_qr_code?: number;

  // Международные реквизиты
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Сохранение реквизитов
  save_bank_details?: boolean;
  bank_details_name?: string;
  
  notes?: string;
  selected_items: number[];
}

// ==================== ДОПОЛНИТЕЛЬНЫЕ ТИПЫ ====================

export interface InvoiceItemPaymentStatus {
  item_id: number;
  description: string;
  total_price: number;
  amount_paid: number;
  is_fully_paid: boolean;
  has_active_receipt: boolean;
}

export interface ExistingInvoiceInfo {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  items_count: number;
  paid_items_count: number;
  items: InvoiceItem[];
}

export interface CheckExistingInvoicesResponse {
  hasExisting: boolean;
  count?: number;
  firstInvoice?: ExistingInvoiceInfo;
  allInvoices?: any[];
}

// ==================== RESERVATION CONFIRMATIONS ====================

export interface ConfirmationTemplate {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
  created_by: number;
  partner_id?: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface CreateConfirmationTemplateDTO {
  name: string;
  content: string;
  is_active?: boolean;
}

export interface ConfirmationGuest {
  id?: number;
  confirmation_id?: number;
  guest_name: string;
  passport_number?: string;
  passport_country?: string;
  phone?: string;
  email?: string;
  sort_order?: number;
}

export interface ReservationConfirmation {
  id: number;
  confirmation_number: string;
  agreement_id?: number;
  template_id?: number;
  
  // Property Info
  property_name?: string;
  property_address?: string;
  
  // From (Company/Sender)
  from_company_name?: string;
  from_telephone?: string;
  from_email?: string;
  
  // Dates
  confirmation_date: string;
  arrival_date?: string;
  departure_date?: string;
  arrival_time?: string;
  departure_time?: string;
  check_in_time?: string;
  check_out_time?: string;
  
  // Booking Details
  room_type?: string;
  rate_type: 'daily' | 'monthly';
  rate_amount?: number;
  num_rooms?: number;
  num_guests?: number;
  deposit_amount?: number;
  
  // Services
  pick_up_service: boolean;
  drop_off_service: boolean;
  arrival_flight?: string;
  departure_flight?: string;
  
  // Remarks
  remarks?: string;
  
  // Notice & Policy
  notice_content?: string;
  cancellation_policy?: string;
  welcome_message?: string;
  
  // Rates
  electricity_rate?: number;
  water_rate?: number;
  
  // PDF
  pdf_path?: string;
  pdf_generated_at?: string;
  
  // Meta
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Relations
  agreement_number?: string;
  template_name?: string;
  template_content?: string;
  created_by_name?: string;
  guests_count?: number;
  guest_names?: string;
  guests?: ConfirmationGuest[];
  
  // Partner info
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  partner_phone?: string;
  partner_email?: string;
}

export interface CreateReservationConfirmationDTO {
  agreement_id?: number;
  template_id?: number;
  
  property_name?: string;
  property_address?: string;
  
  from_company_name?: string;
  from_telephone?: string;
  from_email?: string;
  
  confirmation_date?: string;
  arrival_date?: string;
  departure_date?: string;
  arrival_time?: string;
  departure_time?: string;
  check_in_time?: string;
  check_out_time?: string;
  
  room_type?: string;
  rate_type?: 'daily' | 'monthly';
  rate_amount?: number;
  num_rooms?: number;
  num_guests?: number;
  
  pick_up_service?: boolean;
  drop_off_service?: boolean;
  arrival_flight?: string;
  departure_flight?: string;
  deposit_amount?: number; 
  
  remarks?: string;
  notice_content?: string;
  cancellation_policy?: string;
  welcome_message?: string;
  
  electricity_rate?: number;
  water_rate?: number;
  
  guests?: ConfirmationGuest[];
}

// ==================== API МЕТОДЫ ====================

export const financialDocumentsApi = {
  // ========== SAVED BANK DETAILS ==========
  
  getAllSavedBankDetails: () =>
    api.get<{ success: boolean; data: SavedBankDetails[] }>('/financial-documents/saved-bank-details'),

  getSavedBankDetailsById: (id: number) =>
    api.get<{ success: boolean; data: SavedBankDetails }>(`/financial-documents/saved-bank-details/${id}`),

  createSavedBankDetails: (data: CreateSavedBankDetailsDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>('/financial-documents/saved-bank-details', data),

  updateSavedBankDetails: (id: number, data: Partial<CreateSavedBankDetailsDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/saved-bank-details/${id}`, data),

  deleteSavedBankDetails: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/saved-bank-details/${id}`),

  // ========== INVOICES ==========
  
  getAllInvoices: (params?: {
    status?: string;
    agreement_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ success: boolean; data: Invoice[]; pagination?: any }>('/financial-documents/invoices', { params }),

  getInvoiceById: (id: number) =>
    api.get<{ success: boolean; data: Invoice }>(`/financial-documents/invoices/${id}`),

  getInvoiceItemsPaymentStatus: (id: number) =>
    api.get<{ success: boolean; data: InvoiceItemPaymentStatus[] }>(`/financial-documents/invoices/${id}/items-payment-status`),

  checkExistingInvoicesForAgreement: (agreementId: number) =>
    api.get<{ success: boolean; data: CheckExistingInvoicesResponse }>(`/financial-documents/agreements/${agreementId}/check-existing-invoices`),

  createInvoice: (data: CreateInvoiceDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number; invoice_number: string } }>('/financial-documents/invoices', data),

  updateInvoice: (id: number, data: Partial<CreateInvoiceDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/invoices/${id}`, data),

  deleteInvoice: (id: number, deleteReceipts?: boolean) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/invoices/${id}`, {
      params: { delete_receipts: deleteReceipts }
    }),

  getInvoicesByAgreement: (agreementId: number) =>
    api.get<{ success: boolean; data: Invoice[] }>(`/financial-documents/invoices-by-agreement/${agreementId}`),

  // Скачать PDF инвойса
  downloadInvoicePDF: (id: number, selectedItems?: number[]) => {
    const token = localStorage.getItem('token');
    const params: any = {};
    if (selectedItems && selectedItems.length > 0) {
      params.selected_items = JSON.stringify(selectedItems);
    }
    return api.get(`/financial-documents/invoices/${id}/pdf`, {
      responseType: 'blob',
      params,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },

  // ========== RECEIPTS ==========
  
  getAllReceipts: (params?: {
    status?: string;
    invoice_id?: number;
    agreement_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ success: boolean; data: Receipt[]; pagination?: any }>('/financial-documents/receipts', { params }),

  getReceiptById: (id: number) =>
    api.get<{ success: boolean; data: Receipt }>(`/financial-documents/receipts/${id}`),

  createReceipt: (data: CreateReceiptDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number; receipt_number: string } }>('/financial-documents/receipts', data),
  
  updateReceipt: (id: number, data: Partial<CreateReceiptDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/receipts/${id}`, data),

  deleteReceipt: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/receipts/${id}`),

  uploadReceiptFiles: (receiptId: number, formData: FormData) =>
    api.post<{ success: boolean; message: string; uploadedCount: number }>(
      `/financial-documents/receipts/${receiptId}/upload-files`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ),

  // Скачать PDF чека
  downloadReceiptPDF: (id: number) => {
    const token = localStorage.getItem('token');
    return api.get(`/financial-documents/receipts/${id}/pdf`, {
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },

  // ========== ПУБЛИЧНЫЕ ЭНДПОИНТЫ ==========

  getInvoiceByUuid: (uuid: string) =>
    publicApi.get<{ success: boolean; data: Invoice }>(`/financial-documents/public/invoice/${uuid}`),

  getReceiptByUuid: (uuid: string) =>
    publicApi.get<{ success: boolean; data: Receipt }>(`/financial-documents/public/receipt/${uuid}`),

  downloadInvoicePDFByUuid: (uuid: string) => {
    return publicApi.get(`/financial-documents/public/invoice/${uuid}/pdf`, {
      responseType: 'blob'
    });
  },

  downloadReceiptPDFByUuid: (uuid: string) => {
    return publicApi.get(`/financial-documents/public/receipt/${uuid}/pdf`, {
      responseType: 'blob'
    });
  },
  // ========== CONFIRMATION TEMPLATES ==========

  getAllConfirmationTemplates: () =>
    api.get<{ success: boolean; data: ConfirmationTemplate[] }>('/financial-documents/confirmation-templates'),

  getConfirmationTemplateById: (id: number) =>
    api.get<{ success: boolean; data: ConfirmationTemplate }>(`/financial-documents/confirmation-templates/${id}`),

  createConfirmationTemplate: (data: CreateConfirmationTemplateDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number } }>('/financial-documents/confirmation-templates', data),

  updateConfirmationTemplate: (id: number, data: Partial<CreateConfirmationTemplateDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/confirmation-templates/${id}`, data),

  deleteConfirmationTemplate: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/confirmation-templates/${id}`),

  // ========== RESERVATION CONFIRMATIONS ==========

  getAllReservationConfirmations: (params?: {
    agreement_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ success: boolean; data: ReservationConfirmation[]; pagination?: any }>('/financial-documents/reservation-confirmations', { params }),

  getReservationConfirmationById: (id: number) =>
    api.get<{ success: boolean; data: ReservationConfirmation }>(`/financial-documents/reservation-confirmations/${id}`),

  createReservationConfirmation: (data: CreateReservationConfirmationDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number; confirmation_number: string } }>('/financial-documents/reservation-confirmations', data),

  updateReservationConfirmation: (id: number, data: Partial<CreateReservationConfirmationDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/reservation-confirmations/${id}`, data),

  deleteReservationConfirmation: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/reservation-confirmations/${id}`),

  downloadReservationConfirmationPDF: (id: number) => {
    const token = localStorage.getItem('token');
    return api.get(`/financial-documents/reservation-confirmations/${id}/pdf`, {
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },

  // Публичный доступ к подтверждению
  getConfirmationByNumber: (number: string) =>
    publicApi.get<{ success: boolean; data: ReservationConfirmation }>(`/financial-documents/public/confirmation/${number}`),
};