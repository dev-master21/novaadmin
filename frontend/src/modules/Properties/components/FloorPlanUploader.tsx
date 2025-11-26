// frontend/src/modules/Properties/components/FloorPlanUploader.tsx
import { useState } from 'react';
import { Card, Button, Image, message, Progress } from 'antd';
import { UploadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';

interface FloorPlanUploaderProps {
  propertyId: number;
  floorPlanUrl?: string;
  onUpdate: () => void;
  viewMode?: boolean;
}

const FloorPlanUploader = ({ 
  propertyId, 
  floorPlanUrl, 
  onUpdate,
  viewMode = false 
}: FloorPlanUploaderProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      message.error(t('floorPlanUploader.fileSizeExceeds'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      message.error(t('floorPlanUploader.fileMustBeImage'));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('floorPlan', file);

      await propertiesApi.uploadFloorPlan(propertyId, formData);

      message.success(t('floorPlanUploader.floorPlanUploaded'));
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('floorPlanUploader.errorUploading'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    try {
      message.success(t('floorPlanUploader.floorPlanDeleted'));
      onUpdate();
    } catch (error: any) {
      message.error(t('floorPlanUploader.errorDeleting'));
    }
  };

  const handleDownload = () => {
    if (!floorPlanUrl) return;
    
    const link = document.createElement('a');
    link.href = floorPlanUrl;
    link.download = `floor_plan_${propertyId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(t('floorPlanUploader.floorPlanDownloaded'));
  };

  return (
    <Card 
      title={t('properties.floorPlan')}
      extra={
        !viewMode && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => document.getElementById('floor-plan-input')?.click()}
            loading={uploading}
            disabled={uploading}
          >
            {floorPlanUrl ? t('floorPlanUploader.changeFloorPlan') : t('floorPlanUploader.uploadFloorPlan')}
          </Button>
        )
      }
    >
      <input
        id="floor-plan-input"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {uploading && (
        <div style={{ marginBottom: 24 }}>
          <Progress percent={uploadProgress} status="active" />
          <p style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
            {t('floorPlanUploader.uploadingProgress', { percent: uploadProgress })}
          </p>
        </div>
      )}

      {floorPlanUrl ? (
        <div style={{ textAlign: 'center' }}>
          <Image
            src={floorPlanUrl}
            alt={t('floorPlanUploader.floorPlanAlt')}
            style={{ 
              maxWidth: '100%', 
              maxHeight: 600,
              borderRadius: 8,
              marginBottom: 16
            }}
            preview={{
              mask: t('floorPlanUploader.viewFullSize')
            }}
          />
          <div style={{ marginTop: 16 }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              style={{ marginRight: 8 }}
              disabled={false}
            >
              {t('floorPlanUploader.downloadFloorPlan')}
            </Button>
            {!viewMode && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: '#999',
          border: '2px dashed #d9d9d9',
          borderRadius: 8
        }}>
          <UploadOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>{t('floorPlanUploader.noFloorPlan')}</p>
          {!viewMode && (
            <p style={{ fontSize: 12 }}>
              {t('floorPlanUploader.clickButtonAbove')}<br />
              {t('floorPlanUploader.supportedFormats')}<br />
              {t('floorPlanUploader.maxSize')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

export default FloorPlanUploader;