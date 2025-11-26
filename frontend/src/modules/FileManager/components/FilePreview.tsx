// frontend/src/modules/FileManager/components/FilePreview.tsx
import { Modal, Image } from 'antd';
import { useTranslation } from 'react-i18next';
import { FileItem } from '@/api/fileManager.api';

interface FilePreviewProps {
  visible: boolean;
  file: FileItem | null;
  onClose: () => void;
}

const FilePreview = ({ visible, file, onClose }: FilePreviewProps) => {
  const { t } = useTranslation();
  
  if (!file) return null;

  const renderPreview = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const fileUrl = `${baseUrl}${file.file_path}`;

    if (file.mime_type.startsWith('image/')) {
      return <Image src={fileUrl} alt={file.original_name} style={{ width: '100%' }} />;
    }

    if (file.mime_type.startsWith('video/')) {
      return (
        <video controls style={{ width: '100%' }}>
          <source src={fileUrl} type={file.mime_type} />
          {t('filePreview.videoNotSupported')}
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

    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        {t('filePreview.previewNotAvailable')}
      </div>
    );
  };

  return (
    <Modal
      title={file.original_name}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
    >
      {renderPreview()}
    </Modal>
  );
};

export default FilePreview;