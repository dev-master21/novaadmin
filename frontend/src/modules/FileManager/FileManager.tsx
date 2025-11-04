// frontend/src/modules/FileManager/FileManager.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Table,
  message,
  Breadcrumb,
  Modal,
  Input,
  Popconfirm,
  Progress,
  Checkbox,
  Empty,
  Tooltip,
  Tag,
  Drawer,
  Spin
} from 'antd';
import {
  FolderOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  CloseSquareOutlined,
  EyeOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { fileManagerApi, FileItem, FolderItem } from '@/api/fileManager.api';
import { useAuthStore } from '@/store/authStore';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import FolderPermissionsModal from './components/FolderPermissionsModal';
import './FileManager.css';


// Компонент для загрузки изображений с авторизацией
const ImageWithAuth = ({ fileId, alt }: { fileId: number; filePath: string; alt: string }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        
        // ИСПРАВЛЕНО: используем ID вместо пути
        const fileUrl = `${baseUrl}/file-manager/file/${fileId}`;
        
        console.log('Loading image by ID:', fileId);
        console.log('URL:', fileUrl);

        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        if (!response.ok) {
          console.error('Response error:', response.status, response.statusText);
          throw new Error('Failed to load image');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [fileId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>Ошибка загрузки изображения</div>;
  }

  return <img src={imageUrl} alt={alt} style={{ width: '100%' }} />;
};

const FileManager = () => {
  const { hasPermission, isSuperAdmin } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number; folder_name: string }>>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [renameModal, setRenameModal] = useState<{ visible: boolean; type: 'file' | 'folder'; id: number; currentName: string }>({
    visible: false,
    type: 'file',
    id: 0,
    currentName: ''
  });
  const [newName, setNewName] = useState('');

  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<number[]>([]);

  const [permissionsModal, setPermissionsModal] = useState<{ visible: boolean; folderId: number }>({
    visible: false,
    folderId: 0
  });

  const [previewModal, setPreviewModal] = useState<{ visible: boolean; file: FileItem | null }>({
    visible: false,
    file: null
  });

  const [actionsDrawer, setActionsDrawer] = useState<{ visible: boolean; item: FileItem | FolderItem | null; type: 'file' | 'folder' }>({
    visible: false,
    item: null,
    type: 'file'
  });

  useEffect(() => {
    loadContent();
  }, [currentFolderId]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadContent = async () => {
    setLoading(true);
    try {
      const { data } = await fileManagerApi.browse(currentFolderId || undefined);
      setFolders(data.data.folders);
      setFiles(data.data.files);
      setBreadcrumbs(data.data.breadcrumbs);
      setSelectedFiles([]);
      setSelectedFolders([]);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки содержимого');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderId: number) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId: number | null) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('Введите название папки');
      return;
    }

    setCreatingFolder(true);
    try {
      await fileManagerApi.createFolder({
        folder_name: newFolderName,
        parent_id: currentFolderId || undefined
      });
      message.success('Папка создана');
      setCreateFolderModal(false);
      setNewFolderName('');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания папки');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      await fileManagerApi.uploadFiles(currentFolderId, selectedFiles, (progress) => {
        setUploadProgress(progress);
      });

      message.success(`Загружено файлов: ${selectedFiles.length}`);
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки файлов');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      await fileManagerApi.downloadFile(file.id, file.original_name);
      message.success('Файл загружен');
    } catch (error: any) {
      message.error('Ошибка скачивания файла');
    }
  };

  const handleDownloadFolder = async (folder: FolderItem) => {
    try {
      message.loading('Подготовка архива...', 0);
      await fileManagerApi.downloadFolder(folder.id, folder.folder_name);
      message.destroy();
      message.success('Папка загружена');
    } catch (error: any) {
      message.destroy();
      message.error('Ошибка скачивания папки');
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.length === 0) {
      message.warning('Выберите файлы для скачивания');
      return;
    }

    try {
      message.loading('Подготовка архива...', 0);
      await fileManagerApi.downloadMultiple(selectedFiles);
      message.destroy();
      message.success('Файлы загружены');
    } catch (error: any) {
      message.destroy();
      message.error('Ошибка скачивания файлов');
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await fileManagerApi.deleteFile(fileId);
      message.success('Файл удален');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления файла');
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      await fileManagerApi.deleteFolder(folderId);
      message.success('Папка удалена');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления папки');
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      message.error('Введите новое имя');
      return;
    }

    try {
      if (renameModal.type === 'file') {
        await fileManagerApi.renameFile(renameModal.id, newName);
      } else {
        await fileManagerApi.renameFolder(renameModal.id, newName);
      }
      message.success('Переименовано успешно');
      setRenameModal({ visible: false, type: 'file', id: 0, currentName: '' });
      setNewName('');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка переименования');
    }
  };

  const openRenameModal = (type: 'file' | 'folder', id: number, currentName: string) => {
    setRenameModal({ visible: true, type, id, currentName });
    setNewName(currentName);
    setActionsDrawer({ visible: false, item: null, type: 'file' });
  };

  const openPreview = (file: FileItem) => {
    setPreviewModal({ visible: true, file });
    setActionsDrawer({ visible: false, item: null, type: 'file' });
  };

  const closePreview = () => {
    setPreviewModal({ visible: false, file: null });
  };

  // Функция для сокращения имени файла на мобильных
  const truncateFileName = (name: string, maxLength: number = 15): string => {
    if (!isMobile || name.length <= maxLength) return name;
    
    const ext = name.substring(name.lastIndexOf('.'));
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    
    if (nameWithoutExt.length <= maxLength - ext.length) return name;
    
    return nameWithoutExt.substring(0, maxLength - ext.length - 3) + '...' + ext;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';
    return '📁';
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith('image/') || 
           mimeType.startsWith('video/') || 
           mimeType === 'application/pdf';
  };

  const renderPreview = () => {
    if (!previewModal.file) return null;

    const file = previewModal.file;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

    if (file.mime_type.startsWith('image/')) {
      return (
        <ImageWithAuth 
          fileId={file.id}
          filePath={file.file_path}
          alt={file.original_name}
        />
      );
    }

    // Для видео и PDF используем ID
    const fileUrl = `${baseUrl}/file-manager/file/${file.id}`;

    if (file.mime_type.startsWith('video/')) {
      return (
        <video controls style={{ width: '100%', maxHeight: '70vh' }}>
          <source src={fileUrl} type={file.mime_type} />
          Ваш браузер не поддерживает видео.
        </video>
      );
    }

    if (file.mime_type === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          style={{ width: '100%', height: '70vh', border: 'none' }}
          title={file.original_name}
        />
      );
    }

    return <div style={{ textAlign: 'center', padding: '40px' }}>Предпросмотр недоступен для этого типа файла</div>;
  };

  const getCurrentFolderPermissions = () => {
    if (isSuperAdmin()) {
      return {
        can_view: true,
        can_upload: true,
        can_download: true,
        can_edit: true,
        can_delete: true
      };
    }

    if (!currentFolderId) {
      return {
        can_view: true,
        can_upload: hasPermission('file_manager.upload'),
        can_download: hasPermission('file_manager.download'),
        can_edit: hasPermission('file_manager.edit'),
        can_delete: hasPermission('file_manager.delete')
      };
    }

    const currentFolder = folders.find(f => f.id === currentFolderId);
    return currentFolder?.permissions || {
      can_view: false,
      can_upload: false,
      can_download: false,
      can_edit: false,
      can_delete: false
    };
  };

  const canUpload = getCurrentFolderPermissions().can_upload || hasPermission('file_manager.upload');
  const canDownload = getCurrentFolderPermissions().can_download || hasPermission('file_manager.download');
  const canEdit = getCurrentFolderPermissions().can_edit || hasPermission('file_manager.edit');
  const canDelete = getCurrentFolderPermissions().can_delete || hasPermission('file_manager.delete');
  const canManagePermissions = hasPermission('file_manager.manage_permissions') || isSuperAdmin();

  // Мобильное меню действий
  const openActionsDrawer = (item: FileItem | FolderItem, type: 'file' | 'folder') => {
    setActionsDrawer({ visible: true, item, type });
  };

  const renderMobileActions = () => {
    if (!actionsDrawer.item) return null;

    const item = actionsDrawer.item;
    const isFolder = actionsDrawer.type === 'folder';

    return (
      <Drawer
        title="Действия"
        placement="bottom"
        onClose={() => setActionsDrawer({ visible: false, item: null, type: 'file' })}
        open={actionsDrawer.visible}
        height="auto"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {!isFolder && canPreview((item as FileItem).mime_type) && (
            <Button
              block
              icon={<EyeOutlined />}
              onClick={() => openPreview(item as FileItem)}
            >
              Просмотр
            </Button>
          )}
          
          {canDownload && (
            <Button
              block
              icon={<DownloadOutlined />}
              onClick={() => {
                if (isFolder) {
                  handleDownloadFolder(item as FolderItem);
                } else {
                  handleDownloadFile(item as FileItem);
                }
                setActionsDrawer({ visible: false, item: null, type: 'file' });
              }}
            >
              Скачать
            </Button>
          )}

          {canEdit && (
            <Button
              block
              icon={<EditOutlined />}
              onClick={() => openRenameModal(
                isFolder ? 'folder' : 'file',
                item.id,
                isFolder ? (item as FolderItem).folder_name : (item as FileItem).original_name
              )}
            >
              Переименовать
            </Button>
          )}

          {isFolder && canManagePermissions && (
            <Button
              block
              icon={<SettingOutlined />}
              onClick={() => {
                setPermissionsModal({ visible: true, folderId: item.id });
                setActionsDrawer({ visible: false, item: null, type: 'file' });
              }}
            >
              Права доступа
            </Button>
          )}

          {canDelete && (
            <Popconfirm
              title={isFolder ? "Удалить папку?" : "Удалить файл?"}
              description={isFolder ? "Все файлы и подпапки будут удалены" : undefined}
              onConfirm={() => {
                if (isFolder) {
                  handleDeleteFolder(item.id);
                } else {
                  handleDeleteFile(item.id);
                }
                setActionsDrawer({ visible: false, item: null, type: 'file' });
              }}
              okText="Да"
              cancelText="Нет"
            >
              <Button block danger icon={<DeleteOutlined />}>
                Удалить
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Drawer>
    );
  };

  const folderColumns: TableColumnsType<FolderItem> = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, record: FolderItem) => (
        <Checkbox
          checked={selectedFolders.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedFolders([...selectedFolders, record.id]);
            } else {
              setSelectedFolders(selectedFolders.filter(id => id !== record.id));
            }
          }}
        />
      ),
    },
    {
      title: 'Папка',
      key: 'name',
      render: (_: any, record: FolderItem) => (
        <div
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => handleFolderClick(record.id)}
        >
          <FolderOpenOutlined style={{ fontSize: '20px', color: '#faad14' }} />
          <Tooltip title={record.folder_name}>
            <span style={{ fontWeight: 500 }}>
              {truncateFileName(record.folder_name, 15)}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      responsive: ['lg'],
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Автор',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      responsive: ['xl'],
    },
    {
      title: '',
      key: 'actions',
      width: isMobile ? 60 : 180,
      fixed: isMobile ? 'right' : undefined,
      render: (_: any, record: FolderItem) => {
        if (isMobile) {
          return (
            <Button
              type="primary"
              icon={<MoreOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openActionsDrawer(record, 'folder');
              }}
              style={{ 
                minWidth: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          );
        }

        return (
          <Space size="small">
            {(canDownload || record.permissions.can_download) && (
              <Tooltip title="Скачать папку">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadFolder(record);
                  }}
                />
              </Tooltip>
            )}
            {(canEdit || record.permissions.can_edit) && (
              <Tooltip title="Переименовать">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openRenameModal('folder', record.id, record.folder_name);
                  }}
                />
              </Tooltip>
            )}
            {canManagePermissions && (
              <Tooltip title="Настроить права">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPermissionsModal({ visible: true, folderId: record.id });
                  }}
                />
              </Tooltip>
            )}
            {(canDelete || record.permissions.can_delete) && (
              <Popconfirm
                title="Удалить папку?"
                description="Все файлы и подпапки будут удалены"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteFolder(record.id);
                }}
                okText="Да"
                cancelText="Нет"
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const fileColumns: TableColumnsType<FileItem> = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, record: FileItem) => (
        <Checkbox
          checked={selectedFiles.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedFiles([...selectedFiles, record.id]);
            } else {
              setSelectedFiles(selectedFiles.filter(id => id !== record.id));
            }
          }}
        />
      ),
    },
    {
      title: 'Файл',
      key: 'name',
      render: (_: any, record: FileItem) => (
        <Space>
          <span style={{ fontSize: '18px' }}>{getFileIcon(record.mime_type)}</span>
          <Tooltip title={record.original_name}>
            <span>{truncateFileName(record.original_name)}</span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Размер',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 80,
      responsive: ['md'],
      render: (size: number) => formatFileSize(size),
    },
    {
      title: 'Загружен',
      dataIndex: 'created_at',
      key: 'created_at',
      responsive: ['lg'],
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Автор',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      responsive: ['xl'],
    },
    {
      title: '',
      key: 'actions',
      width: isMobile ? 60 : 180,
      fixed: isMobile ? 'right' : undefined,
      render: (_: any, record: FileItem) => {
        if (isMobile) {
          return (
            <Button
              type="primary"
              icon={<MoreOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openActionsDrawer(record, 'file');
              }}
              style={{ 
                minWidth: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          );
        }

        return (
          <Space size="small">
            {canPreview(record.mime_type) && (
              <Tooltip title="Просмотр">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => openPreview(record)}
                />
              </Tooltip>
            )}
            {canDownload && (
              <Tooltip title="Скачать">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadFile(record)}
                />
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Переименовать">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openRenameModal('file', record.id, record.original_name)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Удалить файл?"
                onConfirm={() => handleDeleteFile(record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="file-manager-container">
      <Card
        title={
          <Space>
            <FolderOutlined />
            <span>Файлообменник</span>
          </Space>
        }
        extra={
          !isMobile && (
            <Space wrap>
              {selectedFiles.length > 0 && canDownload && (
                <>
                  <Tag color="blue">{selectedFiles.length} выбрано</Tag>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadSelected}
                    size="small"
                  >
                    Скачать выбранные
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedFiles([])}
                    icon={<CloseSquareOutlined />}
                  >
                    Снять выделение
                  </Button>
                </>
              )}
              {canEdit && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateFolderModal(true)}
                >
                  Создать папку
                </Button>
              )}
              {canUpload && (
                <>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    Загрузить файлы
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </>
              )}
            </Space>
          )
        }
      >
        {/* Breadcrumbs */}
        <div className="file-manager-breadcrumbs">
          <Breadcrumb>
            <Breadcrumb.Item>
              <div
                onClick={() => handleBreadcrumbClick(null)}
                style={{ 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'rgba(255, 255, 255, 0.85)'
                }}
              >
                <HomeOutlined /> {isMobile ? '' : 'Корневая папка'}
              </div>
            </Breadcrumb.Item>
            {breadcrumbs.map((crumb) => (
              <Breadcrumb.Item key={crumb.id}>
                <div
                  onClick={() => handleBreadcrumbClick(crumb.id)}
                  style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  {truncateFileName(crumb.folder_name, 10)}
                </div>
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>

        {/* Мобильные кнопки */}
        {isMobile && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="small">
            {canEdit && (
              <Button
                block
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateFolderModal(true)}
              >
                Создать папку
              </Button>
            )}
            {canUpload && (
              <>
                <Button
                  block
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  Загрузить файлы
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </>
            )}
            {selectedFiles.length > 0 && canDownload && (
              <>
                <Tag color="blue">{selectedFiles.length} выбрано</Tag>
                <Button
                  block
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadSelected}
                >
                  Скачать выбранные
                </Button>
                <Button
                  block
                  onClick={() => setSelectedFiles([])}
                  icon={<CloseSquareOutlined />}
                >
                  Снять выделение
                </Button>
              </>
            )}
          </Space>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}

        {/* Folders */}
        {folders.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Table
              columns={folderColumns}
              dataSource={folders}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              className="file-manager-table"
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}

        {/* Files */}
        {files.length > 0 ? (
          <Table
            columns={fileColumns}
            dataSource={files}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Всего ${total}` }}
            size="small"
            className="file-manager-table"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          !loading && folders.length === 0 && (
            <Empty
              description="Папка пуста"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        )}
      </Card>

      {/* Create Folder Modal */}
      <Modal
        title="Создать папку"
        open={createFolderModal}
        onOk={handleCreateFolder}
        onCancel={() => {
          setCreateFolderModal(false);
          setNewFolderName('');
        }}
        confirmLoading={creatingFolder}
        okText="Создать"
        cancelText="Отмена"
      >
        <Input
          placeholder="Название папки"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      {/* Rename Modal */}
      <Modal
        title={`Переименовать ${renameModal.type === 'file' ? 'файл' : 'папку'}`}
        open={renameModal.visible}
        onOk={handleRename}
        onCancel={() => {
          setRenameModal({ visible: false, type: 'file', id: 0, currentName: '' });
          setNewName('');
        }}
        okText="Переименовать"
        cancelText="Отмена"
      >
        <Input
          placeholder="Новое имя"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleRename}
          autoFocus
        />
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={previewModal.file?.original_name}
        open={previewModal.visible}
        onCancel={closePreview}
        footer={null}
        width={isMobile ? '100%' : 800}
        centered
        style={isMobile ? { top: 0, maxWidth: '100%', padding: 0 } : undefined}
      >
        {renderPreview()}
      </Modal>

      {/* Folder Permissions Modal */}
      <FolderPermissionsModal
        visible={permissionsModal.visible}
        folderId={permissionsModal.folderId}
        onClose={() => setPermissionsModal({ visible: false, folderId: 0 })}
        onSuccess={loadContent}
      />

      {/* Mobile Actions Drawer */}
      {renderMobileActions()}
    </div>
  );
};

export default FileManager;