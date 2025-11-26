// frontend/src/api/financialDocuments.api.ts
import api from '@/utils/request';

export interface Invoice {
  id: number;
  invoice_number: string;
  agreement_id?: number;
  invoice_date: string;
  due_date?: string;
  
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

  uuid: string;
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
  
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
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
  created_at?: string;
  updated_at?: string;
}

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

export interface CreateInvoiceDTO {
  agreement_id?: number;
  invoice_date: string;
  due_date?: string;
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
  items: InvoiceItem[];
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  notes?: string;
  tax_amount?: number;
}

export interface CreateReceiptDTO {
  invoice_id: number;
  agreement_id?: number;
  receipt_date: string;
  amount_paid: number;
  payment_method: 'bank_transfer' | 'cash' | 'crypto' | 'barter';
  notes?: string;
  selected_items: number[];
}

export const financialDocumentsApi = {
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

  createInvoice: (data: CreateInvoiceDTO) =>
    api.post<{ success: boolean; message: string; data: { id: number; invoice_number: string } }>('/financial-documents/invoices', data),

  updateInvoice: (id: number, data: Partial<CreateInvoiceDTO>) =>
    api.put<{ success: boolean; message: string }>(`/financial-documents/invoices/${id}`, data),

  deleteInvoice: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/financial-documents/invoices/${id}`),

  getInvoicesByAgreement: (agreementId: number) =>
    api.get<{ success: boolean; data: Invoice[] }>(`/financial-documents/invoices-by-agreement/${agreementId}`),

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
    // Скачать PDF инвойса
    downloadInvoicePDF: (id: number) => {
      const token = localStorage.getItem('token');
      return api.get(`/financial-documents/invoices/${id}/pdf`, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    },

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
// Публичные эндпоинты для верификации
  getInvoiceByUuid: (uuid: string) =>
    api.get<{ success: boolean; data: Invoice }>(`/financial-documents/public/invoice/${uuid}`),

  getReceiptByUuid: (uuid: string) =>
    api.get<{ success: boolean; data: Receipt }>(`/financial-documents/public/receipt/${uuid}`),

  downloadInvoicePDFByUuid: (uuid: string) => {
    return api.get(`/financial-documents/public/invoice/${uuid}/pdf`, {
      responseType: 'blob'
    });
  },

  downloadReceiptPDFByUuid: (uuid: string) => {
    return api.get(`/financial-documents/public/receipt/${uuid}/pdf`, {
      responseType: 'blob'
    });
  }
};