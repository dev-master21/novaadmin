// frontend/src/modules/Properties/components/PhotosUploader.tsx
import { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Popconfirm, 
  message, 
  Progress, 
  Badge,
  Modal,
  Input,
  Tag,
  Collapse,
  Tooltip
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  ArrowRightOutlined,
  PlusOutlined,
  MinusOutlined,
  DragOutlined,
  PictureOutlined,
  NumberOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { propertiesApi } from '@/api/properties.api';

const { Panel } = Collapse;

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

// Иконки для категорий
const CategoryIcons: { [key: string]: React.ReactNode } = {
  general: <PictureOutlined />,
  bedroom: '🛏️',
  bathroom: '🚿',
  kitchen: '🍳',
  living: '🛋️',
  exterior: '🏠',
  pool: '🏊',
  view: '👁️'
};

const PhotosUploader = ({ propertyId, photos, bedrooms: initialBedrooms, onUpdate }: PhotosUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [bedroomCount, setBedroomCount] = useState(initialBedrooms || 1);
  const [movingPhotoId, setMovingPhotoId] = useState<number | null>(null);
  const [positionChangePhotoId, setPositionChangePhotoId] = useState<number | null>(null);
  const [newPosition, setNewPosition] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>(['general']);

  // Базовые категории
  const baseCategories = [
    { value: 'general', label: 'Общие фотографии' },
    { value: 'bedroom', label: 'Спальня' },
    { value: 'bathroom', label: 'Ванная' },
    { value: 'kitchen', label: 'Кухня' },
    { value: 'living', label: 'Гостиная' },
    { value: 'exterior', label: 'Экстерьер' },
    { value: 'pool', label: 'Бассейн' },
    { value: 'view', label: 'Вид' }
  ];

  // Генерация категорий с учетом количества спален
  const generateCategories = () => {
    const cats: Array<{ value: string; label: string; isSubcategory?: boolean }> = [];

    for (const cat of baseCategories) {
      if (cat.value === 'bedroom') {
        // Добавляем спальни с номерами
        for (let i = 1; i <= bedroomCount; i++) {
          cats.push({
            value: `bedroom-${i}`,
            label: `Спальня ${i}`,
            isSubcategory: true
          });
        }
      } else {
        cats.push(cat);
      }
    }

    return cats;
  };

  const categories = generateCategories();

  // Синхронизация с props
  useEffect(() => {
    setLocalPhotos(photos);

    // Определяем максимальное количество спален из существующих фото
    const maxBedroom = photos.reduce((max, photo) => {
      if (photo.category && photo.category.startsWith('bedroom-')) {
        const num = parseInt(photo.category.split('-')[1]);
        return Math.max(max, num);
      }
      return max;
    }, initialBedrooms || 1);

    setBedroomCount(maxBedroom);
  }, [photos, initialBedrooms]);

  // Группировка фотографий по категориям
  const groupedPhotos = localPhotos.reduce((acc, photo) => {
    const category = photo.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  // Сортировка фото по sort_order
  Object.keys(groupedPhotos).forEach(category => {
    groupedPhotos[category].sort((a, b) => a.sort_order - b.sort_order);
  });

  // Получение иконки категории
  const getCategoryIcon = (categoryValue: string) => {
    if (categoryValue.startsWith('bedroom-')) {
      return '🛏️';
    }
    return CategoryIcons[categoryValue] || <PictureOutlined />;
  };

  // Добавление спальни
  const handleAddBedroom = () => {
    setBedroomCount(prev => prev + 1);
    message.success(`Спальня ${bedroomCount + 1} добавлена`);
  };

  // Удаление спальни
  const handleRemoveBedroom = async (bedroomNumber: number) => {
    const bedroomCategory = `bedroom-${bedroomNumber}`;
    const bedroomPhotos = groupedPhotos[bedroomCategory] || [];

    if (bedroomPhotos.length > 0) {
      Modal.confirm({
        title: `Удалить спальню ${bedroomNumber}?`,
        content: `В этой спальне ${bedroomPhotos.length} фото. Все фотографии будут удалены.`,
        okText: 'Удалить',
        okType: 'danger',
        cancelText: 'Отмена',
        onOk: async () => {
          // Удаляем все фото этой спальни
          for (const photo of bedroomPhotos) {
            try {
              await propertiesApi.deletePhoto(photo.id);
            } catch (error) {
              console.error('Failed to delete photo:', error);
            }
          }

          setBedroomCount(prev => Math.max(1, prev - 1));
          onUpdate();
          message.success(`Спальня ${bedroomNumber} удалена`);
        }
      });
    } else {
      setBedroomCount(prev => Math.max(1, prev - 1));
      message.success(`Спальня ${bedroomNumber} удалена`);
    }
  };

  // Загрузка файлов
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
  
    // Проверка размера каждого файла
    const oversizedFiles = files.filter(file => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      message.error(`Некоторые файлы превышают 50MB: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
  
    // Проверка типов файлов
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      message.error(`Некоторые файлы не являются изображениями: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }
  
    try {
      setUploading(true);
      setUploadProgress(0);
    
      const formData = new FormData();
      files.forEach(file => {
        formData.append('photos', file);
      });
      formData.append('category', selectedCategory);
    
      // Загружаем все файлы одним запросом (обработка на сервере будет параллельной)
      await propertiesApi.uploadPhotos(propertyId, formData, (progress) => {
        setUploadProgress(progress);
      });
    
      message.success(`Загружено ${files.length} фото`);
      onUpdate();
      setSelectedCategory('general');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки фотографий');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Удаление фотографии
  const handleDeletePhoto = async (photoId: number) => {
    const oldPhotos = [...localPhotos];
    setLocalPhotos(localPhotos.filter(p => p.id !== photoId));

    try {
      await propertiesApi.deletePhoto(photoId);
      message.success('Фото удалено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления');
      setLocalPhotos(oldPhotos);
    }
  };

  // Установка главной фотографии
  const handleSetPrimary = async (photoId: number) => {
    const oldPhotos = [...localPhotos];
    setLocalPhotos(localPhotos.map(p => ({
      ...p,
      is_primary: p.id === photoId
    })));

    try {
      await propertiesApi.setPrimaryPhoto(photoId);
      message.success('Главное фото установлено');
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка');
      setLocalPhotos(oldPhotos);
    }
  };

  // Получение категории фотографии
  const getPhotoCategory = (photoId: number) => {
    const photo = localPhotos.find(p => p.id === photoId);
    return photo?.category || 'general';
  };

  // Перемещение фотографии в другую категорию
  const handleMovePhoto = async (photoId: number, newCategory: string) => {
    const oldPhotos = [...localPhotos];

    setLocalPhotos(localPhotos.map(p =>
      p.id === photoId ? { ...p, category: newCategory } : p
    ));

    setMovingPhotoId(null);

    try {
      // Обновляем категорию фотографии
      const photo = localPhotos.find(p => p.id === photoId);
      if (!photo) return;

      const updates = [{
        id: photoId,
        sort_order: groupedPhotos[newCategory]?.length || 0,
        category: newCategory
      }];

      await propertiesApi.updatePhotosOrder(propertyId, updates);
      message.success('Фото перемещено');
      onUpdate();
    } catch (error) {
      console.error('Failed to move photo:', error);
      message.error('Ошибка перемещения');
      setLocalPhotos(oldPhotos);
    }
  };

  // Изменение позиции фотографии вручную
  const handleChangePosition = async () => {
    const position = parseInt(newPosition);
    const photo = localPhotos.find(p => p.id === positionChangePhotoId);
    if (!photo) return;

    const categoryPhotos = groupedPhotos[photo.category || 'general'];

    if (isNaN(position) || position < 1 || position > categoryPhotos.length) {
      message.error('Неверная позиция');
      return;
    }

    const oldPhotos = [...localPhotos];
    const newIndex = position - 1;

    // Обновляем порядок фотографий в категории
    const updatedCategoryPhotos = categoryPhotos.filter(p => p.id !== positionChangePhotoId);
    updatedCategoryPhotos.splice(newIndex, 0, photo);

    // Обновляем sort_order для всех фото в категории
    const updatedPhotos = updatedCategoryPhotos.map((p, index) => ({
      ...p,
      sort_order: index
    }));

    const newLocalPhotos = localPhotos.map(p => {
      const updated = updatedPhotos.find(up => up.id === p.id);
      return updated || p;
    });

    setLocalPhotos(newLocalPhotos);
    setPositionChangePhotoId(null);
    setNewPosition('');

    try {
      const photosToUpdate = updatedPhotos.map((p, index) => ({
        id: p.id,
        sort_order: index,
        category: p.category
      }));

      await propertiesApi.updatePhotosOrder(propertyId, photosToUpdate);
      message.success('Позиция изменена');
    } catch (error) {
      console.error('Failed to change position:', error);
      message.error('Ошибка изменения позиции');
      setLocalPhotos(oldPhotos);
    }
  };

  // Drag & Drop - поддержка перемещения между категориями
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceCategory = result.source.droppableId;
    const destinationCategory = result.destination.droppableId;

    const oldPhotos = [...localPhotos];

    // Перемещение между категориями
    if (sourceCategory !== destinationCategory) {
      const sourceItems = Array.from(groupedPhotos[sourceCategory]);
      const [movedItem] = sourceItems.splice(result.source.index, 1);

      // Optimistic update - меняем категорию
      const updatedPhoto = { ...movedItem, category: destinationCategory };
      const newLocalPhotos = localPhotos.map(p =>
        p.id === movedItem.id ? updatedPhoto : p
      );

      setLocalPhotos(newLocalPhotos);

      try {
        const updates = [{
          id: movedItem.id,
          sort_order: result.destination.index,
          category: destinationCategory
        }];

        await propertiesApi.updatePhotosOrder(propertyId, updates);
        message.success('Фото перемещено');
        onUpdate();
      } catch (error) {
        console.error('Failed to move photo:', error);
        message.error('Ошибка перемещения');
        setLocalPhotos(oldPhotos);
      }
    } else {
      // Перемещение внутри одной категории
      const items = Array.from(groupedPhotos[sourceCategory]);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      // Обновляем sort_order
      const updatedPhotos = items.map((item, index) => ({
        ...item,
        sort_order: index
      }));

      const newLocalPhotos = localPhotos.map(p => {
        const updated = updatedPhotos.find(up => up.id === p.id);
        return updated || p;
      });

      setLocalPhotos(newLocalPhotos);

      try {
        const photosToUpdate = updatedPhotos.map((p, index) => ({
          id: p.id,
          sort_order: index,
          category: p.category
        }));

        await propertiesApi.updatePhotosOrder(propertyId, photosToUpdate);
      } catch (error) {
        console.error('Failed to reorder photos:', error);
        message.error('Ошибка изменения порядка');
        setLocalPhotos(oldPhotos);
      }
    }
  };

  return (
    <Card>
      {/* Секция загрузки */}
      <Card
        type="inner"
        title={
          <Space>
            <UploadOutlined />
            <span>Загрузка фотографий</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {/* Выбор категории */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>Выберите категорию:</span>
            {selectedCategory.startsWith('bedroom-') && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddBedroom}
              >
                Добавить спальню
              </Button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.value;
              const photoCount = groupedPhotos[cat.value]?.length || 0;

              return (
                <div key={cat.value} style={{ position: 'relative' }}>
                  <Button
                    type={isSelected ? 'primary' : 'default'}
                    onClick={() => setSelectedCategory(cat.value)}
                    style={{ 
                      width: '100%', 
                      height: 'auto', 
                      padding: '12px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{getCategoryIcon(cat.value)}</span>
                    <span style={{ fontSize: 12, textAlign: 'center' }}>{cat.label}</span>
                    <Badge count={photoCount} style={{ fontSize: 10 }} />
                  </Button>

                  {/* Кнопка удаления спальни */}
                  {cat.value.startsWith('bedroom-') && photoCount === 0 && bedroomCount > 1 && (
                    <Tooltip title="Удалить спальню">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBedroom(parseInt(cat.value.split('-')[1]));
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          padding: 2,
                          minWidth: 20,
                          height: 20
                        }}
                      />
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Кнопка загрузки */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          block
          size="large"
        >
          {uploading ? `Загрузка ${uploadProgress}%` : 'Выбрать файлы'}
        </Button>

        {uploading && (
          <Progress percent={uploadProgress} status="active" style={{ marginTop: 12 }} />
        )}

        <div style={{ marginTop: 8, textAlign: 'center', color: '#999', fontSize: 12 }}>
          Максимальный размер файла: 50MB
        </div>
      </Card>

      {/* Фотографии по категориям */}
      {localPhotos.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <PictureOutlined style={{ fontSize: 64, color: '#ccc' }} />
          <div style={{ marginTop: 16, fontSize: 16, color: '#999' }}>
            Нет загруженных фотографий
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#bbb' }}>
            Загрузите фотографии, выбрав категорию выше
          </div>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Collapse
            activeKey={activeCategories}
            onChange={(keys) => setActiveCategories(keys as string[])}
          >
            {categories
              .filter(cat => groupedPhotos[cat.value])
              .map((category) => {
                const categoryPhotos = groupedPhotos[category.value];

                return (
                  <Panel
                    header={
                      <Space>
                        <span style={{ fontSize: 20 }}>{getCategoryIcon(category.value)}</span>
                        <span style={{ fontWeight: 600 }}>{category.label}</span>
                        <Badge count={categoryPhotos.length} />
                      </Space>
                    }
                    key={category.value}
                  >
                    <Droppable droppableId={category.value} direction="horizontal">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: 16,
                            padding: 16,
                            backgroundColor: snapshot.isDraggingOver ? '#f0f5ff' : 'transparent',
                            border: snapshot.isDraggingOver ? '2px dashed #1890ff' : 'none',
                            borderRadius: 8,
                            minHeight: 200
                          }}
                        >
                          {categoryPhotos.map((photo, index) => (
                            <Draggable
                              key={photo.id}
                              draggableId={photo.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.8 : 1,
                                    transform: snapshot.isDragging
                                      ? `${provided.draggableProps.style?.transform} scale(1.05)`
                                      : provided.draggableProps.style?.transform
                                  }}
                                >
<Card
  hoverable
  styles={{ 
    body: { padding: 8 },
    cover: { overflow: 'hidden' }
  }}
  cover={
    <div style={{ position: 'relative', width: '100%', height: 180, overflow: 'hidden' }}>
      <img
        src={photo.photo_url}
        alt={`Photo ${index + 1}`}
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover', 
          display: 'block' 
        }}
        onClick={() => {
          Modal.info({
            width: '90vw',
            centered: true,
            icon: null,
            content: (
              <img 
                src={photo.photo_url} 
                alt={`Photo ${index + 1}`} 
                style={{ width: '100%', height: 'auto' }} 
              />
            ),
            okText: 'Закрыть'
          });
        }}
      />
      {photo.is_primary ? (
        <Tag
          icon={<StarFilled />}
          color="gold"
          style={{
            position: 'absolute',
            top: 8,
            left: 8
          }}
        >
          Главное
        </Tag>
      ) : null}
      <Tag
        style={{
          position: 'absolute',
          top: 8,
          right: 8
        }}
      >
        #{index + 1}
      </Tag>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
          opacity: 0.7
        }}
      >
        <DragOutlined style={{ fontSize: 24, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }} />
      </div>
    </div>
  }
>
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 4,
    minHeight: 32
  }}>
    {photo.is_primary ? null : (
      <Tooltip title="Главное">
        <Button
          type="text"
          icon={<StarOutlined />}
          onClick={() => handleSetPrimary(photo.id)}
          size="small"
          style={{ padding: '4px 8px' }}
        />
      </Tooltip>
    )}
    <Tooltip title="Переместить">
      <Button
        type="text"
        icon={<ArrowRightOutlined />}
        onClick={() => setMovingPhotoId(photo.id)}
        size="small"
        style={{ padding: '4px 8px' }}
      />
    </Tooltip>
    <Tooltip title="Позиция">
      <Button
        type="text"
        icon={<NumberOutlined />}
        onClick={() => {
          setPositionChangePhotoId(photo.id);
          setNewPosition((index + 1).toString());
        }}
        size="small"
        style={{ padding: '4px 8px' }}
      />
    </Tooltip>
    <Popconfirm
      title="Удалить фото?"
      onConfirm={() => handleDeletePhoto(photo.id)}
      okText="Да"
      cancelText="Нет"
    >
      <Tooltip title="Удалить">
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
          style={{ padding: '4px 8px' }}
        />
      </Tooltip>
    </Popconfirm>
  </div>
</Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </Panel>
                );
              })}
          </Collapse>
        </DragDropContext>
      )}

      {/* Модальное окно перемещения фотографии */}
      <Modal
        title="Переместить фото в категорию"
        open={movingPhotoId !== null}
        onCancel={() => setMovingPhotoId(null)}
        footer={null}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {categories
            .filter(cat => cat.value !== getPhotoCategory(movingPhotoId!))
            .map((cat) => (
              <Button
                key={cat.value}
                onClick={() => handleMovePhoto(movingPhotoId!, cat.value)}
                block
                style={{
                  height: 'auto',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Space>
                  <span style={{ fontSize: 18 }}>{getCategoryIcon(cat.value)}</span>
                  <span>{cat.label}</span>
                </Space>
                <Badge count={groupedPhotos[cat.value]?.length || 0} />
              </Button>
            ))}
        </Space>
      </Modal>

      {/* Модальное окно изменения позиции */}
      <Modal
        title="Изменить позицию фотографии"
        open={positionChangePhotoId !== null}
        onOk={handleChangePosition}
        onCancel={() => {
          setPositionChangePhotoId(null);
          setNewPosition('');
        }}
        okText="Изменить"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 16 }}>
          Максимальная позиция:{' '}
          {positionChangePhotoId
            ? groupedPhotos[getPhotoCategory(positionChangePhotoId)]?.length || 0
            : 0}
        </div>
        <Input
          type="number"
          min="1"
          max={
            positionChangePhotoId
              ? groupedPhotos[getPhotoCategory(positionChangePhotoId)]?.length || 0
              : 0
          }
          value={newPosition}
          onChange={(e) => setNewPosition(e.target.value)}
          placeholder="Введите новую позицию"
          autoFocus
        />
      </Modal>
    </Card>
  );
};

export default PhotosUploader;