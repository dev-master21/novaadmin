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
  Tooltip,
  Checkbox
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  ArrowRightOutlined,
  PlusOutlined,
  MinusOutlined,
  PictureOutlined,
  NumberOutlined,
  DownloadOutlined,
  CheckSquareOutlined,
  CloseSquareOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { saveAs } from 'file-saver';

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
  viewMode?: boolean;
}

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

const PhotosUploader = ({ propertyId, photos, bedrooms: initialBedrooms, onUpdate, viewMode = false }: PhotosUploaderProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [tempPhotos, setTempPhotos] = useState<Array<{ file: File; category: string; preview: string }>>([]);
  const isCreatingMode = propertyId === 0;
  const [bedroomCount, setBedroomCount] = useState(initialBedrooms || 1);
  const [movingPhotoId, setMovingPhotoId] = useState<number | null>(null);
  const [positionChangePhotoId, setPositionChangePhotoId] = useState<number | null>(null);
  const [newPosition, setNewPosition] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>(['general']);
  
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingSelected, setDownloadingSelected] = useState(false);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  const baseCategories = [
    { value: 'general', label: t('photosUploader.categories.general') },
    { value: 'bedroom', label: t('photosUploader.categories.bedroom') },
    { value: 'bathroom', label: t('photosUploader.categories.bathroom') },
    { value: 'kitchen', label: t('photosUploader.categories.kitchen') },
    { value: 'living', label: t('photosUploader.categories.living') },
    { value: 'exterior', label: t('photosUploader.categories.exterior') },
    { value: 'pool', label: t('photosUploader.categories.pool') },
    { value: 'view', label: t('photosUploader.categories.view') }
  ];

  const generateCategories = () => {
    const cats: Array<{ value: string; label: string; isSubcategory?: boolean }> = [...baseCategories];
    
    for (let i = 1; i <= bedroomCount; i++) {
      cats.push({
        value: `bedroom-${i}`,
        label: t('photosUploader.bedroomNumber', { number: i }),
        isSubcategory: true
      });
    }
    
    return cats;
  };

  const categories = generateCategories();

  const groupedPhotos = localPhotos.reduce((acc, photo) => {
    if (!acc[photo.category]) {
      acc[photo.category] = [];
    }
    acc[photo.category].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  Object.keys(groupedPhotos).forEach(category => {
    groupedPhotos[category].sort((a, b) => a.sort_order - b.sort_order);
  });

  const getCategoryIcon = (category: string) => {
    if (category.startsWith('bedroom-')) {
      return '🛏️';
    }
    return CategoryIcons[category] || <PictureOutlined />;
  };

  const handleAddBedroom = () => {
    setBedroomCount(prev => prev + 1);
    message.success(t('photosUploader.bedroomAdded', { number: bedroomCount + 1 }));
  };

  const handleRemoveBedroom = (bedroomNumber: number) => {
    const category = `bedroom-${bedroomNumber}`;
    const bedroomPhotos = groupedPhotos[category] || [];

    if (bedroomPhotos.length > 0) {
      Modal.confirm({
        title: t('photosUploader.removeBedroom'),
        content: t('photosUploader.removeBedroomConfirm', { 
          number: bedroomNumber, 
          count: bedroomPhotos.length 
        }),
        okText: t('common.delete'),
        okType: 'danger',
        cancelText: t('common.cancel'),
        onOk: async () => {
          if (!isCreatingMode) {
            for (const photo of bedroomPhotos) {
              try {
                await propertiesApi.deletePhoto(propertyId, photo.id);
              } catch (error) {
                console.error('Failed to delete photo:', error);
              }
            }
          }
          setBedroomCount(prev => Math.max(1, prev - 1));
          if (!isCreatingMode) {
            onUpdate();
          }
          message.success(t('photosUploader.bedroomRemoved', { number: bedroomNumber }));
        }
      });
    } else {
      setBedroomCount(prev => Math.max(1, prev - 1));
      message.success(t('photosUploader.bedroomRemoved', { number: bedroomNumber }));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const oversizedFiles = files.filter(file => file.size > 5000 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      message.error(t('photosUploader.filesExceedSize', { 
        files: oversizedFiles.map(f => f.name).join(', ') 
      }));
      return;
    }

    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      message.error(t('photosUploader.filesNotImages', { 
        files: invalidFiles.map(f => f.name).join(', ') 
      }));
      return;
    }

    if (isCreatingMode) {
      const newTempPhotos = await Promise.all(
        files.map(async (file) => {
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });

          return {
            file,
            category: selectedCategory,
            preview
          };
        })
      );

      setTempPhotos([...tempPhotos, ...newTempPhotos]);
      message.success(t('photosUploader.photosAddedTemp', { count: files.length }));
      setSelectedCategory('general');
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    
      await propertiesApi.uploadPhotos(propertyId, formData, (progress) => {
        setUploadProgress(progress);
      });
    
      message.success(t('photosUploader.photosUploaded', { count: files.length }));
      onUpdate();
      setSelectedCategory('general');
    } catch (error: any) {
      message.error(error.response?.data?.message || t('photosUploader.errorUploading'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteTempPhoto = (index: number) => {
    setTempPhotos(tempPhotos.filter((_, i) => i !== index));
    message.success(t('photosUploader.photoDeleted'));
  };

  const handleDeletePhoto = async (photoId: number) => {
    const oldPhotos = [...localPhotos];
    setLocalPhotos(localPhotos.filter(p => p.id !== photoId));

    try {
      await propertiesApi.deletePhoto(propertyId, photoId);
      message.success(t('photosUploader.photoDeleted'));
      onUpdate();
      setSelectedPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || t('photosUploader.errorDeleting'));
      setLocalPhotos(oldPhotos);
    }
  };

  const handleSetPrimary = async (photoId: number) => {
    const oldPhotos = [...localPhotos];
    setLocalPhotos(localPhotos.map(p => ({
      ...p,
      is_primary: p.id === photoId
    })));

    try {
      await propertiesApi.setPrimaryPhoto(propertyId, photoId);
      message.success(t('photosUploader.primaryPhotoSet'));
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('photosUploader.error'));
      setLocalPhotos(oldPhotos);
    }
  };

  const getPhotoCategory = (photoId: number) => {
    const photo = localPhotos.find(p => p.id === photoId);
    return photo?.category || 'general';
  };

  const handleMovePhoto = async (clickedPhotoId: number, newCategory: string) => {
    const oldPhotos = [...localPhotos];

    let photosToMove: number[];
    
    if (selectedPhotos.size > 0 && selectedPhotos.has(clickedPhotoId)) {
      photosToMove = Array.from(selectedPhotos);
    } else {
      photosToMove = [clickedPhotoId];
    }

    setLocalPhotos(localPhotos.map(p =>
      photosToMove.includes(p.id) ? { ...p, category: newCategory } : p
    ));

    setMovingPhotoId(null);

    try {
      const updates = photosToMove.map((photoId, index) => ({
        id: photoId,
        sort_order: (groupedPhotos[newCategory]?.length || 0) + index,
        category: newCategory
      }));

      await propertiesApi.updatePhotosOrder(propertyId, updates);
      
      if (photosToMove.length > 1) {
        message.success(t('photosUploader.photosMoved', { count: photosToMove.length }));
        setSelectedPhotos(new Set());
      } else {
        message.success(t('photosUploader.photoMoved'));
      }
      
      onUpdate();
    } catch (error) {
      console.error('Failed to move photo:', error);
      message.error(t('photosUploader.errorMoving'));
      setLocalPhotos(oldPhotos);
    }
  };

  const handleChangePosition = async () => {
    const position = parseInt(newPosition);
    const photo = localPhotos.find(p => p.id === positionChangePhotoId);
    if (!photo) return;

    const categoryPhotos = groupedPhotos[photo.category || 'general'];

    if (isNaN(position) || position < 1 || position > categoryPhotos.length) {
      message.error(t('photosUploader.positionRange', { max: categoryPhotos.length }));
      return;
    }

    const updatedPhotos = [...categoryPhotos];
    const currentIndex = updatedPhotos.findIndex(p => p.id === positionChangePhotoId);
    const [movedItem] = updatedPhotos.splice(currentIndex, 1);
    updatedPhotos.splice(position - 1, 0, movedItem);

    const reorderedPhotos = updatedPhotos.map((p, index) => ({
      ...p,
      sort_order: index
    }));

    const newLocalPhotos = localPhotos.map(p => {
      const updated = reorderedPhotos.find(rp => rp.id === p.id);
      return updated || p;
    });

    setLocalPhotos(newLocalPhotos);

    try {
      const photosToUpdate = reorderedPhotos.map((p, index) => ({
        id: p.id,
        sort_order: index,
        category: p.category
      }));

      await propertiesApi.updatePhotosOrder(propertyId, photosToUpdate);
      message.success(t('photosUploader.positionChanged'));
      setPositionChangePhotoId(null);
      setNewPosition('');
    } catch (error) {
      console.error('Failed to change position:', error);
      message.error(t('photosUploader.errorChangingPosition'));
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
  
    const sourceCategory = result.source.droppableId;
    const destinationCategory = result.destination.droppableId;
  
    const oldPhotos = [...localPhotos];
  
    if (sourceCategory !== destinationCategory) {
      const movedItem = groupedPhotos[sourceCategory][result.source.index];
      
      const updatedPhoto = {
        ...movedItem,
        category: destinationCategory,
        sort_order: result.destination.index
      };
    
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
        message.success(t('photosUploader.photoMoved'));
        onUpdate();
      } catch (error) {
        console.error('Failed to move photo:', error);
        message.error(t('photosUploader.errorMoving'));
        setLocalPhotos(oldPhotos);
      }
    } else {
      const items = Array.from(groupedPhotos[sourceCategory]);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
    
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
        message.error(t('photosUploader.errorReordering'));
        setLocalPhotos(oldPhotos);
      }
    }
  };

  const handleTogglePhoto = (photoId: number) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedPhotos(new Set(localPhotos.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPhotos(new Set());
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) {
      message.warning(t('photosUploader.selectPhotosToDownload'));
      return;
    }

    setDownloadingSelected(true);
    try {
      const photoIds = Array.from(selectedPhotos);
      const response = await propertiesApi.downloadPhotos(propertyId, photoIds);
      
      const filename = photoIds.length === 1
        ? `property_${propertyId}_photo_${photoIds[0]}.jpg`
        : `property_${propertyId}_selected_photos.zip`;
      
      const blob = new Blob([response.data]);
      saveAs(blob, filename);
      
      message.success(t('photosUploader.photosDownloaded', { count: photoIds.length }));
    } catch (error) {
      console.error('Download error:', error);
      message.error(t('photosUploader.errorDownloading'));
    } finally {
      setDownloadingSelected(false);
    }
  };

  const handleDownloadAll = async () => {
    if (localPhotos.length === 0) {
      message.warning(t('photosUploader.noPhotosToDownload'));
      return;
    }

    setDownloadingAll(true);
    try {
      const response = await propertiesApi.downloadPhotos(propertyId);
      
      const filename = localPhotos.length === 1
        ? `property_${propertyId}_photo_${localPhotos[0].id}.jpg`
        : `property_${propertyId}_all_photos.zip`;
      
      const blob = new Blob([response.data]);
      saveAs(blob, filename);
      
      message.success(t('photosUploader.photosDownloaded', { count: localPhotos.length }));
    } catch (error) {
      console.error('Download error:', error);
      message.error(t('photosUploader.errorDownloading'));
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <Card>
      {!isCreatingMode && localPhotos.length > 0 && (
        <Card
          type="inner"
          size="small"
          style={{ marginBottom: 16, background: '#1a1a1a' }}
        >
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Button
                size="small"
                icon={<CheckSquareOutlined />}
                onClick={handleSelectAll}
                disabled={false}
              >
                {t('photosUploader.selectAll', { count: localPhotos.length })}
              </Button>
              <Button
                size="small"
                icon={<CloseSquareOutlined />}
                onClick={handleDeselectAll}
                disabled={selectedPhotos.size === 0 ? true : false}
              >
                {t('photosUploader.deselectAll')}
              </Button>
              {selectedPhotos.size > 0 && (
                <Tag color="blue">{t('photosUploader.selected', { count: selectedPhotos.size })}</Tag>
              )}
            </Space>
            <Space wrap>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownloadSelected}
                loading={downloadingSelected}
                disabled={selectedPhotos.size === 0 ? true : false}
              >
                {t('photosUploader.downloadSelected', { count: selectedPhotos.size })}
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownloadAll}
                loading={downloadingAll}
                disabled={false}
              >
                {t('photosUploader.downloadAll', { count: localPhotos.length })}
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {!viewMode && (
        <Card
          type="inner"
          title={
            <Space>
              <UploadOutlined />
              <span>{t('photosUploader.uploadingPhotos')}</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{t('photosUploader.selectCategory')}</span>
              {selectedCategory.startsWith('bedroom-') && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddBedroom}
                >
                  {t('photosUploader.addBedroom')}
                </Button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.value;
                const photoCount = groupedPhotos[cat.value]?.length || 0;
                const tempPhotoCount = tempPhotos.filter(p => p.category === cat.value).length;
                const totalCount = photoCount + tempPhotoCount;

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
                      <Badge count={totalCount} style={{ fontSize: 10 }} />
                    </Button>

                    {cat.value.startsWith('bedroom-') && totalCount === 0 && bedroomCount > 1 && (
                      <Tooltip title={t('photosUploader.removeBedroom')}>
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
            {uploading ? t('photosUploader.uploadingProgress', { percent: uploadProgress }) : t('photosUploader.selectFiles')}
          </Button>

          {uploading && (
            <Progress percent={uploadProgress} status="active" style={{ marginTop: 12 }} />
          )}

          <div style={{ marginTop: 8, textAlign: 'center', color: '#999', fontSize: 12 }}>
            {isCreatingMode 
              ? t('photosUploader.uploadInfoCreating')
              : t('photosUploader.uploadInfo')
            }
          </div>
        </Card>
      )}

      {isCreatingMode && tempPhotos.length > 0 && (
        <Card
          title={
            <Space>
              <PictureOutlined />
              <span>{t('photosUploader.photosForUpload')}</span>
              <Tag color="blue">{t('photosUploader.photoCount', { count: tempPhotos.length })}</Tag>
            </Space>
          }
          extra={<Tag color="orange">{t('photosUploader.willBeUploadedAfterSave')}</Tag>}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
            padding: 16
          }}>
            {tempPhotos.map((photo, index) => (
              <div key={index} style={{ position: 'relative' }}>
                <img
                  src={photo.preview}
                  alt={t('photosUploader.tempPhotoAlt', { index: index })}
                  style={{
                    width: '100%',
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '2px dashed #1890ff'
                  }}
                />
                <Tag
                  color="blue"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 11
                  }}
                >
                  {categories.find(c => c.value === photo.category)?.label || photo.category}
                </Tag>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  #{index + 1}
                </div>
                {!viewMode && (
                  <Popconfirm
                    title={t('photosUploader.deletePhoto')}
                    onConfirm={() => handleDeleteTempPhoto(index)}
                    okText={t('common.yes')}
                    cancelText={t('common.no')}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#ff4d4f'
                      }}
                    />
                  </Popconfirm>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isCreatingMode && localPhotos.length === 0 && tempPhotos.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <PictureOutlined style={{ fontSize: 64, color: '#ccc' }} />
          <div style={{ marginTop: 16, fontSize: 16, color: '#999' }}>
            {t('photosUploader.noPhotos')}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#bbb' }}>
            {t('photosUploader.uploadPhotosInstruction')}
          </div>
        </Card>
      ) : !isCreatingMode && localPhotos.length > 0 && (
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
                    <Droppable droppableId={category.value} direction="horizontal" isDropDisabled={viewMode}>
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
                            minHeight: 100
                          }}
                        >
                          {categoryPhotos.map((photo, index) => (
                            <Draggable
                              key={photo.id}
                              draggableId={String(photo.id)}
                              index={index}
                              isDragDisabled={viewMode}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.5 : 1,
                                    position: 'relative'
                                  }}
                                >
                                  <Checkbox
                                    checked={selectedPhotos.has(photo.id)}
                                    onChange={() => handleTogglePhoto(photo.id)}
                                    disabled={false}
                                    style={{
                                      position: 'absolute',
                                      top: 8,
                                      left: 8,
                                      zIndex: 10,
                                      background: 'rgba(0,0,0,0.6)',
                                      borderRadius: 4,
                                      padding: 4
                                    }}
                                  />

                                  <img
                                    src={`${photo.photo_url}`}
                                    alt={t('photosUploader.photoAlt', { id: photo.id })}
                                    style={{
                                      width: '100%',
                                      height: 180,
                                      objectFit: 'cover',
                                      borderRadius: 8,
                                      cursor: viewMode ? 'default' : 'move'
                                    }}
                                  />

                                  {photo.is_primary && (
                                    <Tag
                                      color="gold"
                                      icon={<StarFilled />}
                                      style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        fontSize: 11
                                      }}
                                    >
                                      {t('photosUploader.primary')}
                                    </Tag>
                                  )}

                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: 8,
                                      left: 8,
                                      background: 'rgba(0, 0, 0, 0.7)',
                                      color: 'white',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontWeight: 600
                                    }}
                                  >
                                    #{index + 1}
                                  </div>

                                  {!viewMode && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                        padding: '24px 8px 8px 8px',
                                        display: 'flex',
                                        justifyContent: 'space-around',
                                        gap: 4
                                      }}
                                    >
                                      {!photo.is_primary && (
                                        <Tooltip title={t('photosUploader.makePrimary')}>
                                          <Button
                                            type="text"
                                            size="small"
                                            icon={<StarOutlined />}
                                            onClick={() => handleSetPrimary(photo.id)}
                                            style={{ color: 'white' }}
                                          />
                                        </Tooltip>
                                      )}
                                      <Tooltip title={
                                        selectedPhotos.has(photo.id) && selectedPhotos.size > 1
                                          ? t('photosUploader.moveMultiplePhotos', { count: selectedPhotos.size })
                                          : t('photosUploader.moveToCategory')
                                      }>
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<ArrowRightOutlined />}
                                          onClick={() => setMovingPhotoId(photo.id)}
                                          style={{ color: 'white' }}
                                        />
                                      </Tooltip>
                                      <Tooltip title={t('photosUploader.changePosition')}>
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<NumberOutlined />}
                                          onClick={() => {
                                            setPositionChangePhotoId(photo.id);
                                            setNewPosition(String(index + 1));
                                          }}
                                          style={{ color: 'white' }}
                                        />
                                      </Tooltip>
                                      <Popconfirm
                                        title={t('photosUploader.deletePhoto')}
                                        onConfirm={() => handleDeletePhoto(photo.id)}
                                        okText={t('common.yes')}
                                        cancelText={t('common.no')}
                                      >
                                        <Tooltip title={t('common.delete')}>
                                          <Button
                                            type="text"
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            style={{ color: '#ff4d4f' }}
                                          />
                                        </Tooltip>
                                      </Popconfirm>
                                    </div>
                                  )}
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

      <Modal
        title={
          movingPhotoId && selectedPhotos.has(movingPhotoId) && selectedPhotos.size > 1
            ? t('photosUploader.moveSelectedPhotosTitle', { count: selectedPhotos.size })
            : t('photosUploader.movePhotoTitle')
        }
        open={movingPhotoId !== null}
        onCancel={() => setMovingPhotoId(null)}
        footer={null}
      >
        {movingPhotoId && selectedPhotos.has(movingPhotoId) && selectedPhotos.size > 1 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <Space>
              <CheckSquareOutlined style={{ color: '#1890ff' }} />
              <span style={{ color: '#1890ff' }}>
                {t('photosUploader.willBeMoved', { count: selectedPhotos.size })}
              </span>
            </Space>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              onClick={() => handleMovePhoto(movingPhotoId!, cat.value)}
              disabled={getPhotoCategory(movingPhotoId!) === cat.value}
              style={{ height: 'auto', padding: '12px 8px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 20 }}>{getCategoryIcon(cat.value)}</span>
                <span style={{ fontSize: 12 }}>{cat.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        title={t('photosUploader.changePositionTitle')}
        open={positionChangePhotoId !== null}
        onOk={handleChangePosition}
        onCancel={() => {
          setPositionChangePhotoId(null);
          setNewPosition('');
        }}
        okText={t('photosUploader.change')}
        cancelText={t('common.cancel')}
      >
        <div>
          <p>{t('photosUploader.enterNewPosition')}</p>
          <Input
            type="number"
            min={1}
            max={groupedPhotos[getPhotoCategory(positionChangePhotoId!)]?.length || 1}
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value)}
            placeholder={t('photosUploader.position')}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default PhotosUploader;