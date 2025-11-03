// frontend/src/modules/Properties/components/VideoUploader.tsx
import { useState } from 'react';
import { Card, Button, Progress, Space, message, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { propertiesApi } from '@/api/properties.api';

interface VideoUploaderProps {
  propertyId: number;
  videoUrl?: string | null;
  onUpdate: () => void;
}

const VideoUploader = ({ propertyId, videoUrl, onUpdate }: VideoUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера (макс 500MB)
    if (file.size > 500 * 1024 * 1024) {
      message.error('Размер видео не должен превышать 500MB');
      return;
    }

    // Проверка типа
    if (!file.type.startsWith('video/')) {
      message.error('Разрешены только видео файлы');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      await propertiesApi.uploadVideo(propertyId, file, (progress) => {
        setUploadProgress(progress);
      });

      message.success('Видео успешно загружено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки видео');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    try {
      await propertiesApi.deleteVideo(propertyId);
      message.success('Видео удалено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления видео');
    }
  };

  return (
    <Card title="Видео объекта" size="small">
      {videoUrl ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
            <video
              src={videoUrl}
              controls
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
            />
          </div>
          <Popconfirm
            title="Удалить видео?"
            onConfirm={handleDelete}
            okText="Да"
            cancelText="Нет"
          >
            <Button danger icon={<DeleteOutlined />} block>
              Удалить видео
            </Button>
          </Popconfirm>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {uploading ? (
            <>
              <Progress percent={uploadProgress} status="active" />
              <p style={{ textAlign: 'center', color: '#999' }}>
                Загрузка видео... {uploadProgress}%
              </p>
            </>
          ) : (
            <>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => document.getElementById('video-input')?.click()}
                block
              >
                Загрузить видео
              </Button>
              <input
                id="video-input"
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                Максимальный размер: 500MB
                <br />
                Форматы: MP4, AVI, MOV, WMV, FLV, MKV, WEBM
              </p>
            </>
          )}
        </Space>
      )}
    </Card>
  );
};

export default VideoUploader;