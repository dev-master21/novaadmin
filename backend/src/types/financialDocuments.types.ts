// backend/src/types/financialDocuments.types.ts

// ==================== ТИПЫ БАНКОВСКИХ РЕКВИЗИТОВ ====================

export type BankDetailsType = 'simple' | 'international' | 'custom';

export interface SimpleBankDetails {
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
}

export interface InternationalBankDetails extends SimpleBankDetails {
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
}

export interface CustomBankDetails {
  bank_custom_details?: string;
}

// ==================== СОХРАНЁННЫЕ БАНКОВСКИЕ РЕКВИЗИТЫ ====================

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
  
  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Метаданные
  created_by: number;
  partner_id?: number;
  created_at: string;
  updated_at: string;
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
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_address?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
}

// ==================== ИНВОЙСЫ ====================

export interface Invoice {
  id: number;
  invoice_number: string;
  uuid?: string;
  agreement_id?: number;
  invoice_date: string;
  due_date?: string;
  
  // Данные отправителя
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
  
  // Данные получателя
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
  
  // Суммы
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
  
  // Прочее
  notes?: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  
  qr_code_base64?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
  
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Дополнительные поля для отображения
  agreement_number?: string;
  created_by_name?: string;
  receipts_count?: number;
  items_count?: number;
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
  
  // Данные отправителя
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
  
  // Данные получателя
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
  
  // Позиции
  items: InvoiceItem[];
  selected_items?: number[];
  // НОВЫЕ ПОЛЯ: Банковские реквизиты
  bank_details_type?: BankDetailsType;
  saved_bank_details_id?: number; // ID сохраненных реквизитов
  
  // Простые реквизиты
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
  // Международные реквизиты
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_address?: string;

  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Сохранение реквизитов
  save_bank_details?: boolean;
  bank_details_name?: string;
  
  // Прочее
  notes?: string;
  tax_amount?: number;
}

// ==================== ЧЕКИ ====================

export interface Receipt {
  id: number;
  receipt_number: string;
  uuid?: string;
  invoice_id: number;
  agreement_id?: number;
  receipt_date: string;
  amount_paid: number;
  payment_method: 'bank_transfer' | 'cash' | 'crypto' | 'barter';
  
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
  
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  
  qr_code_base64?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
  
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Дополнительные поля для отображения
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
  
  // Дополнительные поля для отображения
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
  saved_bank_details_id?: number; // ID сохраненных реквизитов
  show_qr_code?: number;
  
  // Простые реквизиты
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  
  // Международные реквизиты
  bank_account_address?: string;
  bank_currency?: string;
  bank_code?: string;
  bank_swift_code?: string;
  bank_address?: string;
  
  // Кастомные реквизиты
  bank_custom_details?: string;
  
  // Сохранение реквизитов
  save_bank_details?: boolean;
  bank_details_name?: string;
  
  notes?: string;
  selected_items: number[]; // IDs of invoice_items
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