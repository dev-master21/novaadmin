// frontend/src/api/fileManager.api.ts
import api from './axios';
import axios from 'axios';

export interface FileItem {
  id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  created_by: number;
  created_by_name: string;
}

export interface FolderItem {
  id: number;
  folder_name: string;
  parent_id: number | null;
  full_path: string;
  created_at: string;
  created_by: number;
  created_by_name: string;
  permissions: {
    can_view: boolean;
    can_upload: boolean;
    can_download: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

export interface BrowseResponse {
  success: boolean;
  data: {
    folders: FolderItem[];
    files: FileItem[];
    breadcrumbs: Array<{ id: number; folder_name: string }>;
    currentFolderId: number | null;
  };
}

export interface FolderPermission {
  id?: number;
  folder_id: number;
  user_id: number;
  username?: string;
  full_name?: string;
  can_view: boolean;
  can_upload: boolean;
  can_download: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const fileManagerApi = {
  // Просмотр содержимого папки
  browse: (folderId?: number) => 
    api.get<BrowseResponse>(`/file-manager/browse${folderId ? `?folderId=${folderId}` : ''}`),

  // Создать папку
  createFolder: (data: { folder_name: string; parent_id?: number }) =>
    api.post('/file-manager/folders', data),

  // Загрузить файлы
  uploadFiles: (folderId: number | null, files: File[], onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (folderId) {
      formData.append('folderId', folderId.toString());
    }

    return api.post('/file-manager/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  // Скачать файл
  downloadFile: async (fileId: number, fileName: string) => {
    const response = await axios.get(
      `${api.defaults.baseURL}/file-manager/download/${fileId}`,
      {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Скачать папку (ZIP)
  downloadFolder: async (folderId: number, folderName: string) => {
    const response = await axios.get(
      `${api.defaults.baseURL}/file-manager/download-folder/${folderId}`,
      {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${folderName}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Скачать выбранные файлы (ZIP)
  downloadMultiple: async (fileIds: number[]) => {
    const response = await axios.post(
      `${api.defaults.baseURL}/file-manager/download-multiple`,
      { fileIds },
      {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'files.zip');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Удалить файл
  deleteFile: (fileId: number) =>
    api.delete(`/file-manager/files/${fileId}`),

  // Удалить папку
  deleteFolder: (folderId: number) =>
    api.delete(`/file-manager/folders/${folderId}`),

  // Переименовать файл
  renameFile: (fileId: number, new_name: string) =>
    api.put(`/file-manager/files/${fileId}/rename`, { new_name }),

  // Переименовать папку
  renameFolder: (folderId: number, new_name: string) =>
    api.put(`/file-manager/folders/${folderId}/rename`, { new_name }),

  // Получить права доступа к папке
  getFolderPermissions: (folderId: number) =>
    api.get<{ success: boolean; data: FolderPermission[] }>(`/file-manager/folders/${folderId}/permissions`),

  // Установить права доступа к папке
  setFolderPermissions: (folderId: number, permissions: Omit<FolderPermission, 'id' | 'folder_id' | 'username' | 'full_name'>[]) =>
    api.post(`/file-manager/folders/${folderId}/permissions`, { permissions }),

    // Импорт из Google Drive
  importFromGoogleDrive: (googleDriveUrl: string, folderId?: number) =>
    api.post('/file-manager/import-from-google-drive', { googleDriveUrl, folderId }),

  // Массовое удаление файлов
  deleteMultipleFiles: (fileIds: number[]) =>
    api.post('/file-manager/delete-multiple', { fileIds }),
  
};