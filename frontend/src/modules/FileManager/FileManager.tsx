// frontend/src/modules/FileManager/FileManager.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Breadcrumb,
  Modal,
  Input,
  Popconfirm,
  Tag,
  Checkbox,
  Progress,
  Tooltip,
  Empty,
  Drawer,
  Spin,
  Descriptions,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  FolderOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  HomeOutlined,
  SettingOutlined,
  CloseSquareOutlined,
  CloudDownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { fileManagerApi, FileItem, FolderItem } from '@/api/fileManager.api';
import FolderPermissionsModal from './components/FolderPermissionsModal';
import dayjs from 'dayjs';
import axios from 'axios';
import './FileManager.css';

const { Text } = Typography;

// Компонент для предпросмотра изображений с авторизацией
const SecureImage = ({ fileId, alt }: { fileId: number; alt: string }) => {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const response = await axios.get(`/api/file-manager/file/${fileId}`, {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        const blob = new Blob([response.data]);
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
    return <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{t('fileManager.errors.imageLoadError')}</div>;
  }

  return <img src={imageUrl} alt={alt} style={{ width: '100%' }} />;
};

// Компонент для предпросмотра текстовых файлов
const TextFilePreview = ({ fileId }: { fileId: number }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadText = async () => {
      try {
        const response = await axios.get(`/api/file-manager/file/${fileId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
        setContent(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading text:', err);
        setContent(t('fileManager.errors.textLoadError'));
        setLoading(false);
      }
    };
    loadText();
  }, [fileId, t]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#fff', 
      color: '#000',
      maxHeight: '70vh',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace',
      fontSize: '14px'
    }}>
      {content}
    </div>
  );
};

// Компонент для предпросмотра PDF через Blob URL
const SecurePDFPreview = ({ fileId, fileName }: { fileId: number; fileName: string }) => {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        const response = await axios.get(`/api/file-manager/file/${fileId}`, {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [fileId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>{t('fileManager.loading.pdf')}</div>
      </div>
    );
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{t('fileManager.errors.pdfLoadError')}</div>;
  }

  return (
    <iframe
      src={pdfUrl}
      style={{ width: '100%', height: '70vh', border: 'none' }}
      title={fileName}
    />
  );
};

// Компонент для видео с авторизацией
const SecureVideoPreview = ({ fileId, mimeType }: { fileId: number; fileName: string; mimeType: string }) => {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        const response = await axios.get(`/api/file-manager/file/${fileId}`, {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error loading video:', err);
        setLoading(false);
      }
    };
    loadVideo();

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
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

  return (
    <video controls style={{ width: '100%' }}>
      <source src={videoUrl} type={mimeType} />
      {t('filePreview.videoNotSupported')}
    </video>
  );
};

// Компонент для аудио с авторизацией
const SecureAudioPreview = ({ fileId, mimeType }: { fileId: number; fileName: string; mimeType: string }) => {
  const { t } = useTranslation();
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const response = await axios.get(`/api/file-manager/file/${fileId}`, {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error loading audio:', err);
        setLoading(false);
      }
    };
    loadAudio();

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
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

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <audio controls style={{ width: '100%' }}>
        <source src={audioUrl} type={mimeType} />
        {t('fileManager.audioNotSupported')}
      </audio>
    </div>
  );
};

const FileManager = () => {
  const { t } = useTranslation();
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

  const [googleDriveModal, setGoogleDriveModal] = useState(false);
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [importingFromDrive, setImportingFromDrive] = useState(false);

  const [fileInfoModal, setFileInfoModal] = useState<{ visible: boolean; file: FileItem | null }>({
    visible: false,
    file: null
  });

  const pollingIntervalRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
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
      message.error(error.response?.data?.message || t('fileManager.errors.loadContent'));
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
      message.error(t('fileManager.validation.enterFolderName'));
      return;
    }

    setCreatingFolder(true);
    try {
      await fileManagerApi.createFolder({
        folder_name: newFolderName,
        parent_id: currentFolderId || undefined
      });
      message.success(t('fileManager.messages.folderCreated'));
      setCreateFolderModal(false);
      setNewFolderName('');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.createFolder'));
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

      message.success(t('fileManager.messages.filesUploaded', { count: selectedFiles.length }));
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.uploadFiles'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      await fileManagerApi.downloadFile(file.id, file.original_name);
      message.success(t('fileManager.messages.fileDownloaded'));
    } catch (error: any) {
      message.error(t('fileManager.errors.downloadFile'));
    }
  };

  const handleDownloadFolder = async (folder: FolderItem) => {
    try {
      message.loading(t('fileManager.loading.preparingArchive'), 0);
      await fileManagerApi.downloadFolder(folder.id, folder.folder_name);
      message.destroy();
      message.success(t('fileManager.messages.folderDownloaded'));
    } catch (error: any) {
      message.destroy();
      message.error(t('fileManager.errors.downloadFolder'));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.length === 0) {
      message.warning(t('fileManager.warnings.selectFilesToDownload'));
      return;
    }

    try {
      message.loading(t('fileManager.loading.preparingArchive'), 0);
      await fileManagerApi.downloadMultiple(selectedFiles);
      message.destroy();
      message.success(t('fileManager.messages.filesDownloaded'));
    } catch (error: any) {
      message.destroy();
      message.error(t('fileManager.errors.downloadFiles'));
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await fileManagerApi.deleteFile(fileId);
      message.success(t('fileManager.messages.fileDeleted'));
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.deleteFile'));
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      await fileManagerApi.deleteFolder(folderId);
      message.success(t('fileManager.messages.folderDeleted'));
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.deleteFolder'));
    }
  };

  const handleDeleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      message.warning(t('fileManager.warnings.selectFilesToDelete'));
      return;
    }

    try {
      await fileManagerApi.deleteMultipleFiles(selectedFiles);
      message.success(t('fileManager.messages.filesDeleted', { count: selectedFiles.length }));
      setSelectedFiles([]);
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.deleteFiles'));
    }
  };

  const handleImportFromGoogleDrive = async () => {
    if (!googleDriveUrl.trim()) {
      message.error(t('fileManager.validation.enterDriveLink'));
      return;
    }

    setImportingFromDrive(true);
    try {
      await fileManagerApi.importFromGoogleDrive(googleDriveUrl, currentFolderId || undefined);
      
      message.success(t('fileManager.messages.driveImportStarted'), 2);
      setGoogleDriveModal(false);
      setGoogleDriveUrl('');

      setUploading(true);
      setUploadProgress(0);

      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress >= 90) {
          clearInterval(progressInterval);
        }
        setUploadProgress(Math.min(progress, 90));
      }, 1000);

      let pollCount = 0;
      const maxPolls = 30;
      
      pollingIntervalRef.current = window.setInterval(async () => {
        pollCount++;
        
        try {
          const { data } = await fileManagerApi.browse(currentFolderId || undefined);
          setFiles(data.data.files);
          setFolders(data.data.folders);
          
          if (pollCount >= maxPolls) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              clearInterval(progressInterval);
            }
            setUploading(false);
            setUploadProgress(100);
            message.success(t('fileManager.messages.uploadComplete'));
            
            setTimeout(() => {
              loadContent();
            }, 500);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);

    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.driveImport'));
      setUploading(false);
      setUploadProgress(0);
    } finally {
      setImportingFromDrive(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      message.error(t('fileManager.validation.enterNewName'));
      return;
    }

    try {
      if (renameModal.type === 'file') {
        await fileManagerApi.renameFile(renameModal.id, newName);
      } else {
        await fileManagerApi.renameFolder(renameModal.id, newName);
      }
      message.success(t('fileManager.messages.renamed'));
      setRenameModal({ visible: false, type: 'file', id: 0, currentName: '' });
      setNewName('');
      loadContent();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('fileManager.errors.rename'));
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

  const openFileInfo = (file: FileItem) => {
    setFileInfoModal({ visible: true, file });
    setActionsDrawer({ visible: false, item: null, type: 'file' });
  };

  const truncateFileName = (name: string, maxLength: number = 20): string => {
    if (name.length <= maxLength) return name;
    
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex === -1) {
      return name.substring(0, maxLength - 3) + '...';
    }
    
    const ext = name.substring(dotIndex);
    const nameWithoutExt = name.substring(0, dotIndex);
    
    const maxNameLength = maxLength - ext.length - 3;
    if (maxNameLength <= 0) {
      return name.substring(0, maxLength - 3) + '...';
    }
    
    return nameWithoutExt.substring(0, maxNameLength) + '...' + ext;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';
    if (mimeType === 'text/plain') return '📄';
    return '📎';
  };

  const canPreview = (mimeType: string): boolean => {
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain' ||
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('presentation')
    );
  };


  const renderPreview = () => {
    if (!previewModal.file) return null;

    const file = previewModal.file;

    if (file.mime_type.startsWith('image/')) {
      return <SecureImage fileId={file.id} alt={file.original_name} />;
    }

    if (file.mime_type.startsWith('video/')) {
      return <SecureVideoPreview fileId={file.id} fileName={file.original_name} mimeType={file.mime_type} />;
    }

    if (file.mime_type.startsWith('audio/')) {
      return <SecureAudioPreview fileId={file.id} fileName={file.original_name} mimeType={file.mime_type} />;
    }

    if (file.mime_type === 'application/pdf') {
      return <SecurePDFPreview fileId={file.id} fileName={file.original_name} />;
    }

    if (file.mime_type === 'text/plain') {
      return <TextFilePreview fileId={file.id} />;
    }

    if (
      file.mime_type.includes('word') ||
      file.mime_type.includes('document') ||
      file.mime_type.includes('excel') ||
      file.mime_type.includes('spreadsheet') ||
      file.mime_type.includes('powerpoint') ||
      file.mime_type.includes('presentation')
    ) {
      const fileUrl = `/api/file-manager/file/${file.id}`;
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + fileUrl)}&embedded=true`;
      
      return (
        <div style={{ width: '100%', height: '70vh' }}>
          <iframe
            src={viewerUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={file.original_name}
          />
          <div style={{ marginTop: 8, textAlign: 'center', color: '#888', fontSize: '12px' }}>
            {t('fileManager.previewFallback')}
          </div>
        </div>
      );
    }

    return <div style={{ textAlign: 'center', padding: '40px' }}>{t('filePreview.previewNotAvailable')}</div>;
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

  const openActionsDrawer = (item: FileItem | FolderItem, type: 'file' | 'folder') => {
    setActionsDrawer({ visible: true, item, type });
  };

  const renderMobileActions = () => {
    if (!actionsDrawer.item) return null;

    const item = actionsDrawer.item;
    const isFolder = actionsDrawer.type === 'folder';

    return (
      <Drawer
        title={t('fileManager.drawer.actions')}
        placement="bottom"
        onClose={() => setActionsDrawer({ visible: false, item: null, type: 'file' })}
        open={actionsDrawer.visible}
        height="auto"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {!isFolder && (
            <Button
              block
              icon={<InfoCircleOutlined />}
              onClick={() => openFileInfo(item as FileItem)}
            >
              {t('fileManager.actions.info')}
            </Button>
          )}
          
          {!isFolder && canPreview((item as FileItem).mime_type) && (
            <Button
              block
              icon={<EyeOutlined />}
              onClick={() => openPreview(item as FileItem)}
            >
              {t('fileManager.actions.preview')}
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
              {t('fileManager.actions.download')}
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
              {t('fileManager.actions.rename')}
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
              {t('fileManager.actions.permissions')}
            </Button>
          )}

          {canDelete && (
            <Popconfirm
              title={isFolder ? t('fileManager.confirm.deleteFolder') : t('fileManager.confirm.deleteFile')}
              description={isFolder ? t('fileManager.confirm.deleteFolderDescription') : undefined}
              onConfirm={() => {
                if (isFolder) {
                  handleDeleteFolder(item.id);
                } else {
                  handleDeleteFile(item.id);
                }
                setActionsDrawer({ visible: false, item: null, type: 'file' });
              }}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button block danger icon={<DeleteOutlined />}>
                {t('common.delete')}
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
      title: t('fileManager.table.folder'),
      key: 'name',
      render: (_: any, record: FolderItem) => (
        <div
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => handleFolderClick(record.id)}
        >
          <FolderOpenOutlined style={{ fontSize: '20px', color: '#faad14' }} />
          <Tooltip title={record.folder_name}>
            <div className="file-name-cell">
              {isMobile ? truncateFileName(record.folder_name, 15) : record.folder_name}
            </div>
          </Tooltip>
        </div>
      ),
    },
    {
      title: t('fileManager.table.created'),
      dataIndex: 'created_at',
      key: 'created_at',
      responsive: ['lg'] as any,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: t('fileManager.table.author'),
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      responsive: ['xl'] as any,
    },
    {
      title: '',
      key: 'actions',
      width: isMobile ? 60 : 180,
      render: (_: any, record: FolderItem) => {
        if (isMobile) {
          return (
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openActionsDrawer(record, 'folder');
              }}
            />
          );
        }

        return (
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            {canDownload && (
              <Tooltip title={t('fileManager.tooltips.downloadFolder')}>
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
            {canEdit && (
              <Tooltip title={t('fileManager.tooltips.rename')}>
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
              <Tooltip title={t('fileManager.tooltips.permissions')}>
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
            {canDelete && (
              <Popconfirm
                title={t('fileManager.confirm.deleteFolder')}
                description={t('fileManager.confirm.deleteFolderDescription')}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteFolder(record.id);
                }}
                okText={t('common.yes')}
                cancelText={t('common.no')}
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
      title: t('fileManager.table.file'),
      key: 'name',
      render: (_: any, record: FileItem) => (
        <Space>
          <span style={{ fontSize: '18px' }}>{getFileIcon(record.mime_type)}</span>
          <Tooltip title={record.original_name}>
            <div className="file-name-cell">
              {isMobile ? truncateFileName(record.original_name, 15) : record.original_name}
            </div>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('fileManager.table.size'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 80,
      responsive: ['md'] as any,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: t('fileManager.table.uploaded'),
      dataIndex: 'created_at',
      key: 'created_at',
      responsive: ['lg'] as any,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: t('fileManager.table.author'),
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      responsive: ['xl'] as any,
    },
    {
      title: '',
      key: 'actions',
      width: isMobile ? 200 : 200,
      render: (_: any, record: FileItem) => {
        return (
          <Space size={isMobile ? 2 : 'small'}>
            <Tooltip title={t('fileManager.tooltips.info')}>
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => openFileInfo(record)}
              />
            </Tooltip>
            {canPreview(record.mime_type) && (
              <Tooltip title={t('fileManager.tooltips.preview')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => openPreview(record)}
                />
              </Tooltip>
            )}
            {canDownload && (
              <Tooltip title={t('fileManager.tooltips.download')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadFile(record)}
                />
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title={t('fileManager.tooltips.rename')}>
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
                title={t('fileManager.confirm.deleteFile')}
                onConfirm={() => handleDeleteFile(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
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
            <span>{t('fileManager.title')}</span>
          </Space>
        }
        extra={
          !isMobile && (
            <Space wrap>
              {selectedFiles.length > 0 && canDownload && (
                <>
                  <Tag color="blue">{t('fileManager.selected', { count: selectedFiles.length })}</Tag>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadSelected}
                    size="small"
                  >
                    {t('fileManager.buttons.downloadSelected')}
                  </Button>
                  {canDelete && (
                    <Popconfirm
                      title={t('fileManager.confirm.deleteSelectedFiles')}
                      description={t('fileManager.confirm.deleteSelectedFilesDescription', { count: selectedFiles.length })}
                      onConfirm={handleDeleteSelectedFiles}
                      okText={t('common.yes')}
                      cancelText={t('common.no')}
                    >
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                      >
                        {t('fileManager.buttons.deleteSelected')}
                      </Button>
                    </Popconfirm>
                  )}
                  <Button
                    size="small"
                    onClick={() => setSelectedFiles([])}
                    icon={<CloseSquareOutlined />}
                  >
                    {t('fileManager.buttons.clearSelection')}
                  </Button>
                </>
              )}
              {canEdit && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateFolderModal(true)}
                >
                  {t('fileManager.buttons.createFolder')}
                </Button>
              )}
              {canUpload && (
                <>
                  <Button
                    type="primary"
                    icon={<CloudDownloadOutlined />}
                    onClick={() => setGoogleDriveModal(true)}
                  >
                    {t('fileManager.buttons.fromGoogleDrive')}
                  </Button>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    {t('fileManager.buttons.uploadFiles')}
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
                <HomeOutlined /> {isMobile ? '' : t('fileManager.rootFolder')}
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

        {isMobile && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="small">
            {canEdit && (
              <Button
                block
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateFolderModal(true)}
              >
                {t('fileManager.buttons.createFolder')}
              </Button>
            )}
            {canUpload && (
              <>
                <Button
                  block
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={() => setGoogleDriveModal(true)}
                >
                  {t('fileManager.buttons.uploadFromGoogleDrive')}
                </Button>
                <Button
                  block
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  {t('fileManager.buttons.uploadFiles')}
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
                <Tag color="blue">{t('fileManager.selected', { count: selectedFiles.length })}</Tag>
                <Button
                  block
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadSelected}
                >
                  {t('fileManager.buttons.downloadSelected')}
                </Button>
                {canDelete && (
                  <Popconfirm
                    title={t('fileManager.confirm.deleteSelectedFiles')}
                    description={t('fileManager.confirm.deleteSelectedFilesDescription', { count: selectedFiles.length })}
                    onConfirm={handleDeleteSelectedFiles}
                    okText={t('common.yes')}
                    cancelText={t('common.no')}
                  >
                    <Button
                      block
                      danger
                      icon={<DeleteOutlined />}
                    >
                      {t('fileManager.buttons.deleteSelected')}
                    </Button>
                  </Popconfirm>
                )}
                <Button
                  block
                  onClick={() => setSelectedFiles([])}
                  icon={<CloseSquareOutlined />}
                >
                  {t('fileManager.buttons.clearSelection')}
                </Button>
              </>
            )}
          </Space>
        )}

        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text>{t('fileManager.loading.uploadingFiles')}</Text>
            </div>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}

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

        {files.length > 0 ? (
          <Table
            columns={fileColumns}
            dataSource={files}
            rowKey="id"
            loading={loading}
            pagination={{ 
              pageSize: 20, 
              showSizeChanger: true, 
              showTotal: (total) => t('fileManager.total', { total }) 
            }}
            size="small"
            className="file-manager-table"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          !loading && folders.length === 0 && (
            <Empty
              description={t('fileManager.emptyFolder')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        )}
      </Card>

      <Modal
        title={t('fileManager.modals.createFolder')}
        open={createFolderModal}
        onOk={handleCreateFolder}
        onCancel={() => {
          setCreateFolderModal(false);
          setNewFolderName('');
        }}
        confirmLoading={creatingFolder}
        okText={t('fileManager.buttons.create')}
        cancelText={t('common.cancel')}
      >
        <Input
          placeholder={t('fileManager.placeholders.folderName')}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      <Modal
        title={t('fileManager.modals.uploadFromGoogleDrive')}
        open={googleDriveModal}
        onOk={handleImportFromGoogleDrive}
        onCancel={() => {
          setGoogleDriveModal(false);
          setGoogleDriveUrl('');
        }}
        confirmLoading={importingFromDrive}
        okText={t('fileManager.buttons.upload')}
        cancelText={t('common.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>{t('fileManager.googleDrive.instruction')}</p>
          <Input
            placeholder={t('fileManager.placeholders.googleDriveUrl')}
            value={googleDriveUrl}
            onChange={(e) => setGoogleDriveUrl(e.target.value)}
            onPressEnter={handleImportFromGoogleDrive}
            autoFocus
          />
          <p style={{ fontSize: '12px', color: '#888' }}>
            {t('fileManager.googleDrive.note')}
          </p>
        </Space>
      </Modal>

      <Modal
        title={t('fileManager.modals.fileInfo')}
        open={fileInfoModal.visible}
        onCancel={() => setFileInfoModal({ visible: false, file: null })}
        footer={[
          <Button key="close" onClick={() => setFileInfoModal({ visible: false, file: null })}>
            {t('fileManager.buttons.close')}
          </Button>
        ]}
      >
        {fileInfoModal.file && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('fileManager.fileInfo.name')}>
              {fileInfoModal.file.original_name}
            </Descriptions.Item>
            <Descriptions.Item label={t('fileManager.fileInfo.size')}>
              {formatFileSize(fileInfoModal.file.file_size)}
            </Descriptions.Item>
            <Descriptions.Item label={t('fileManager.fileInfo.type')}>
              {fileInfoModal.file.mime_type}
            </Descriptions.Item>
            <Descriptions.Item label={t('fileManager.fileInfo.uploaded')}>
              {dayjs(fileInfoModal.file.created_at).format('DD.MM.YYYY HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('fileManager.fileInfo.author')}>
              {fileInfoModal.file.created_by_name}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={t('fileManager.modals.rename', { 
          type: renameModal.type === 'file' ? t('fileManager.renameTypes.file') : t('fileManager.renameTypes.folder') 
        })}
        open={renameModal.visible}
        onOk={handleRename}
        onCancel={() => {
          setRenameModal({ visible: false, type: 'file', id: 0, currentName: '' });
          setNewName('');
        }}
        okText={t('fileManager.buttons.rename')}
        cancelText={t('common.cancel')}
      >
        <Input
          placeholder={t('fileManager.placeholders.newName')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleRename}
          autoFocus
        />
      </Modal>

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

      <FolderPermissionsModal
        visible={permissionsModal.visible}
        folderId={permissionsModal.folderId}
        onClose={() => setPermissionsModal({ visible: false, folderId: 0 })}
        onSuccess={loadContent}
      />

      {renderMobileActions()}
    </div>
  );
};

export default FileManager;