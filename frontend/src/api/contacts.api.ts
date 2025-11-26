import axios from './axios';

export interface SavedContact {
  id: number;
  type: 'individual' | 'company';
  // Физ.лицо
  name?: string;
  passport_country?: string;
  passport_number?: string;
  // Компания
  company_name?: string;
  company_address?: string;
  company_tax_id?: string;
  director_name?: string;
  director_passport?: string;
  director_country?: string;
  // ✅ ДОБАВИЛИ ДОКУМЕНТЫ
  documents?: Array<{
    id?: number;
    document_base64: string;
    mime_type?: string;
    file_size?: number;
  }>;
  created_at: string;
  updated_at: string;
}

class ContactsApi {
  /**
   * Получить все сохраненные контакты
   */
  async getAll() {
    return axios.get<{ success: boolean; data: SavedContact[] }>('/contacts');
  }

  /**
   * Создать новый контакт
   */
  async create(data: Partial<SavedContact>) {
    return axios.post<{ success: boolean; data: SavedContact }>('/contacts', data);
  }

  /**
   * Удалить контакт
   */
  async delete(id: number) {
    return axios.delete(`/contacts/${id}`);
  }
}

export const contactsApi = new ContactsApi();