// backend/src/types/financialDocuments.types.ts

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
  selected_items: number[]; // IDs of invoice_items
}