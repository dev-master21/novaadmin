// frontend/src/modules/Properties/components/PhotosUploader.tsx
import { useState, useRef } from 'react';
import { Card, Button, Select, Progress, Space, Image, Tag, Popconfirm, message } from 'antd';
import { UploadOutlined, DeleteOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { propertiesApi } from '@/api/properties.api';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface Photo {
  id: number;
  photo_url: string;
  category: string;
  sort_order: number;
  is_primary: boolean;
}

interface PhotosUploaderProps {
  propertyId: number;
  photos: Photo[];
  bedrooms: number;
  onUpdate: () => void;
}

const PhotosUploader = ({ propertyId, photos, bedrooms, onUpdate }: PhotosUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Генерируем категории с учетом спален
  const categories = [
    { value: 'general', label: 'Общие' },
    ...Array.from({ length: bedrooms }, (_, i) => ({
      value: `bedroom-${i + 1}`,
      label: `Спальня ${i + 1}`
    })),
    { value: 'bathroom', label: 'Ванная' },
    { value: 'kitchen', label: 'Кухня' },
    { value: 'living', label: 'Гостиная' },
    { value: 'exterior', label: 'Экстерьер' },
    { value: 'pool', label: 'Бассейн' },
    { value: 'view', label: 'Вид' }
  ];

  // Группируем фото по категориям
  const groupedPhotos = photos.reduce((acc, photo) => {
    const cat = photo.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  // Сортируем фото в каждой категории
  Object.keys(groupedPhotos).forEach(cat => {
    groupedPhotos[cat].sort((a, b) => a.sort_order - b.sort_order);
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Проверка размера
    const oversized = files.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      message.error('Размер файла не должен превышать 50MB');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach(file => formData.append('photos', file));
      formData.append('category', selectedCategory);

      await propertiesApi.uploadPhotos(propertyId, formData, (progress) => {
        setUploadProgress(progress);
      });

      message.success(`Загружено ${files.length} фото`);
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimary = async (photoId: number) => {
    try {
      await propertiesApi.setPrimaryPhoto(photoId);
      message.success('Главное фото установлено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка');
    }
  };

  const handleDelete = async (photoId: number) => {
    try {
      await propertiesApi.deletePhoto(photoId);
      message.success('Фото удалено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceCategory = source.droppableId;
    const destCategory = destination.droppableId;

    if (sourceCategory === destCategory) {
      // Перемещение внутри категории
      const categoryPhotos = [...groupedPhotos[sourceCategory]];
      const [moved] = categoryPhotos.splice(source.index, 1);
      categoryPhotos.splice(destination.index, 0, moved);

      // Обновляем sort_order
      const updates = categoryPhotos.map((photo, index) => ({
        id: photo.id,
        sort_order: index,
        category: sourceCategory
      }));

      try {
        await propertiesApi.updatePhotosOrder(propertyId, updates);
        onUpdate();
      } catch (error: any) {
        message.error('Ошибка изменения порядка');
      }
    } else {
      // Перемещение между категориями
      const sourcePhotos = [...groupedPhotos[sourceCategory]];
      const [moved] = sourcePhotos.splice(source.index, 1);
      
      const destPhotos = groupedPhotos[destCategory] ? [...groupedPhotos[destCategory]] : [];
      destPhotos.splice(destination.index, 0, moved);

      const updates = [
        ...sourcePhotos.map((photo, index) => ({
          id: photo.id,
          sort_order: index,
          category: sourceCategory
        })),
        ...destPhotos.map((photo, index) => ({
          id: photo.id,
          sort_order: index,
          category: destCategory
        }))
      ];

      try {
        await propertiesApi.updatePhotosOrder(propertyId, updates);
        message.success('Фото перемещено');
        onUpdate();
      } catch (error: any) {
        message.error('Ошибка перемещения');
      }
    }
  };

  return (
    <Card title={`Фотографии (${photos.length})`}>
      {/* Upload Section */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
        <Select
          style={{ width: '100%' }}
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categories}
        />
        
        {uploading ? (
          <Progress percent={uploadProgress} status="active" />
        ) : (
          <>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              block
            >
              Загрузить фото
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </>
        )}
      </Space>

      {/* Photos by Category */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {categories.map(category => {
            const categoryPhotos = groupedPhotos[category.value] || [];
            if (categoryPhotos.length === 0) return null;

            return (
              <div key={category.value}>
                <h4>{category.label} ({categoryPhotos.length})</h4>
                <Droppable droppableId={category.value} direction="horizontal">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        minHeight: 120
                      }}
                    >
                      {categoryPhotos.map((photo, index) => (
                        <Draggable
                          key={photo.id}
                          draggableId={String(photo.id)}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                position: 'relative',
                                width: 120,
                                height: 120,
                                ...provided.draggableProps.style
                              }}
                            >
                              <Image
                                src={photo.photo_url}
                                width={120}
                                height={120}
                                style={{ objectFit: 'cover', borderRadius: 8 }}
                              />
                              {photo.is_primary && (
                                <Tag
                                  color="gold"
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4
                                  }}
                                >
                                  Главное
                                </Tag>
                              )}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  display: 'flex',
                                  gap: 4
                                }}
                              >
                                <Button
                                  size="small"
                                  type={photo.is_primary ? 'primary' : 'default'}
                                  icon={photo.is_primary ? <StarFilled /> : <StarOutlined />}
                                  onClick={() => handleSetPrimary(photo.id)}
                                />
                                <Popconfirm
                                  title="Удалить фото?"
                                  onConfirm={() => handleDelete(photo.id)}
                                >
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                  />
                                </Popconfirm>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </Space>
      </DragDropContext>
    </Card>
  );
};

export default PhotosUploader;