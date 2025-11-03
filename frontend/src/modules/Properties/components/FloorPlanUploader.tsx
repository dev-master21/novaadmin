// frontend/src/modules/Properties/components/FloorPlanUploader.tsx
import { useState, useRef } from 'react';
import { Card, Button, Image, Space, message, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { propertiesApi } from '@/api/properties.api';

interface FloorPlanUploaderProps {
  propertyId: number;
  floorPlanUrl?: string | null;
  onUpdate: () => void;
}

const FloorPlanUploader = ({ propertyId, floorPlanUrl, onUpdate }: FloorPlanUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера
    if (file.size > 50 * 1024 * 1024) {
      message.error('Размер файла не должен превышать 50MB');
      return;
    }

    // Проверка типа
    if (!file.type.startsWith('image/')) {
      message.error('Разрешены только изображения');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('floorPlan', file);

      await propertiesApi.uploadFloorPlan(propertyId, formData);
      message.success('Планировка загружена');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    try {
      await propertiesApi.update(propertyId, { floor_plan_url: null });
      message.success('Планировка удалена');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления');
    }
  };

  return (
    <Card title="Планировка" size="small">
      {floorPlanUrl ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Image
            src={floorPlanUrl}
            style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }}
          />
          <Popconfirm
            title="Удалить планировку?"
            onConfirm={handleDelete}
            okText="Да"
            cancelText="Нет"
          >
            <Button danger icon={<DeleteOutlined />} block>
              Удалить планировку
            </Button>
          </Popconfirm>
        </Space>
      ) : (
        <>
          <Button
            type="dashed"
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            block
          >
            Загрузить планировку
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </>
      )}
    </Card>
  );
};

export default FloorPlanUploader;