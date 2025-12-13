// frontend/src/api/partners.api.ts
import api from './axios'; // ✅ Используем существующий axios с авторизацией

export interface Partner {
  id: number;
  partner_name: string | null;
  domain: string | null;
  logo_filename: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnerDTO {
  partner_name?: string;
  domain?: string;
  logo?: File;
  is_active?: boolean;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  phone?: string;
  email?: string;
}

export interface UpdatePartnerDTO {
  partner_name?: string;
  domain?: string;
  logo?: File;
  is_active?: boolean;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  phone?: string;
  email?: string;
}

export interface PartnerInfo {
  logo_filename: string;
  partner_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  phone: string | null;
  email: string | null;
}

export const partnersApi = {
  /**
   * Получить всех партнёров (SuperAdmin only)
   */
  async getAll(): Promise<Partner[]> {
    const response = await api.get('/partners');
    return response.data.data;
  },

  /**
   * Получить партнёра по ID (SuperAdmin only)
   */
  async getById(id: number): Promise<Partner> {
    const response = await api.get(`/partners/${id}`);
    return response.data.data;
  },

  /**
   * Получить партнёра по домену (публичный endpoint)
   */
  async getByDomain(domain: string): Promise<PartnerInfo> {
    const response = await api.get(`/partners/by-domain/${domain}`);
    return response.data.data;
  },

  /**
   * Создать партнёра с загрузкой логотипа (SuperAdmin only)
   */
  async create(data: CreatePartnerDTO): Promise<{ id: number; logo_filename: string | null }> {
    const formData = new FormData();
    
    if (data.partner_name) {
      formData.append('partner_name', data.partner_name);
    }
    if (data.domain) {
      formData.append('domain', data.domain);
    }
    if (data.logo) {
      formData.append('logo', data.logo);
    }
    if (data.is_active !== undefined) {
      formData.append('is_active', data.is_active ? '1' : '0');
    }
    // Цвета
    if (data.primary_color) {
      formData.append('primary_color', data.primary_color);
    }
    if (data.secondary_color) {
      formData.append('secondary_color', data.secondary_color);
    }
    if (data.accent_color) {
      formData.append('accent_color', data.accent_color);
    }
    // Контакты
    if (data.phone) {
      formData.append('phone', data.phone);
    }
    if (data.email) {
      formData.append('email', data.email);
    }

    const response = await api.post('/partners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  },

  /**
   * Обновить партнёра (SuperAdmin only)
   */
  async update(id: number, data: UpdatePartnerDTO): Promise<{ logo_filename?: string }> {
    const formData = new FormData();
    
    if (data.partner_name !== undefined) {
      formData.append('partner_name', data.partner_name || '');
    }
    if (data.domain !== undefined) {
      formData.append('domain', data.domain || '');
    }
    if (data.logo) {
      formData.append('logo', data.logo);
    }
    if (data.is_active !== undefined) {
      formData.append('is_active', data.is_active ? '1' : '0');
    }
    // Цвета
    if (data.primary_color !== undefined) {
      formData.append('primary_color', data.primary_color || '');
    }
    if (data.secondary_color !== undefined) {
      formData.append('secondary_color', data.secondary_color || '');
    }
    if (data.accent_color !== undefined) {
      formData.append('accent_color', data.accent_color || '');
    }
    // Контакты
    if (data.phone !== undefined) {
      formData.append('phone', data.phone || '');
    }
    if (data.email !== undefined) {
      formData.append('email', data.email || '');
    }

    const response = await api.put(`/partners/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  },

  /**
   * Удалить партнёра (SuperAdmin only)
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/partners/${id}`);
  },
};