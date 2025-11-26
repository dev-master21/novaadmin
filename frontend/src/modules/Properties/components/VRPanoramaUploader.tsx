// frontend/src/modules/Properties/components/VRPanoramaUploader.tsx
import { useState, useEffect } from 'react';
import { Card, Button, Space, Select, Image, Popconfirm, message, Progress, Tag, Tooltip } from 'antd';
import { UploadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';

interface VRPanorama {
  id: number;
  location_type: string;
  location_number: number | null;
  front_image: string;
  back_image: string;
  left_image: string;
  right_image: string;
  top_image: string;
  bottom_image: string;
  sort_order: number;
}

interface VRPanoramaUploaderProps {
  propertyId: number;
  onUpdate: () => void;
  viewMode?: boolean;
}

const VRPanoramaUploader = ({ propertyId, onUpdate, viewMode = false }: VRPanoramaUploaderProps) => {
  const { t } = useTranslation();
  
  const [panoramas, setPanoramas] = useState<VRPanorama[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [locationType, setLocationType] = useState('bedroom');
  const [locationNumber, setLocationNumber] = useState<number>(1);
  const [selectedFiles, setSelectedFiles] = useState<{
    front?: File;
    back?: File;
    left?: File;
    right?: File;
    top?: File;
    bottom?: File;
  }>({});

  const locationTypes = [
    'bedroom', 'bathroom', 'living_room', 'kitchen', 'pool',
    'terrace', 'wardrobe', 'gym', 'sauna', 'balcony',
    'dining_room', 'office', 'laundry', 'garage', 'entrance'
  ];

  const directions = ['front', 'back', 'left', 'right', 'top', 'bottom'];

  useEffect(() => {
    loadPanoramas();
  }, [propertyId]);

  const loadPanoramas = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getVRPanoramas(propertyId);
      setPanoramas(data.data || []);
    } catch (error: any) {
      message.error(error.response?.data?.message || t('vr.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (direction: string, file: File | null) => {
    if (!file) {
      setSelectedFiles(prev => {
        const updated = { ...prev };
        delete updated[direction as keyof typeof selectedFiles];
        return updated;
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      message.error(t('vr.errors.fileTooLarge'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      message.error(t('vr.errors.invalidFileType'));
      return;
    }

    setSelectedFiles(prev => ({
      ...prev,
      [direction]: file
    }));
  };

  const handleUpload = async () => {
    if (Object.keys(selectedFiles).length !== 6) {
      message.error(t('vr.errors.fillAllFields'));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('location_type', locationType);
      formData.append('location_number', String(locationNumber));
      
      Object.entries(selectedFiles).forEach(([direction, file]) => {
        if (file) {
          formData.append(direction, file);
        }
      });

      await propertiesApi.createVRPanorama(propertyId, formData);

      message.success(t('vr.success.created'));
      
      setSelectedFiles({});
      setLocationNumber(1);
      
      loadPanoramas();
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('vr.errors.createFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (panoramaId: number) => {
    try {
      await propertiesApi.deleteVRPanorama(panoramaId);
      message.success(t('vr.success.deleted'));
      loadPanoramas();
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('vr.errors.deleteFailed'));
    }
  };

  const handleDownloadImage = (imageUrl: string, direction: string, panoramaId: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `vr_panorama_${panoramaId}_${direction}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(t('vr.success.imageDownloaded'));
  };

  return (
    <Card title={t('vr.editor.title')} loading={loading}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {!viewMode && (
          <Card type="inner" title={t('vr.editor.newPanorama')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  {t('vr.editor.locationType')}
                </label>
                <Select
                  style={{ width: '100%' }}
                  value={locationType}
                  onChange={setLocationType}
                >
                  {locationTypes.map(type => (
                    <Select.Option key={type} value={type}>
                      {t(`vr.locations.${type}`)}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {['bedroom', 'bathroom', 'wardrobe', 'balcony'].includes(locationType) && (
                <div>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    {t('vr.editor.locationNumber')}
                  </label>
                  <Select
                    style={{ width: '100%' }}
                    value={locationNumber}
                    onChange={setLocationNumber}
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <Select.Option key={num} value={num}>
                        {num}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  {t('vr.editor.uploadImages')}
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 16 
                }}>
                  {directions.map(direction => (
                    <div key={direction}>
                      <div style={{ 
                        border: '2px dashed #d9d9d9',
                        borderRadius: 8,
                        padding: 16,
                        textAlign: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        height: 120,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selectedFiles[direction as keyof typeof selectedFiles] ? '#f0f0f0' : 'transparent'
                      }}
                      onClick={() => document.getElementById(`vr-${direction}`)?.click()}
                      >
                        {selectedFiles[direction as keyof typeof selectedFiles] ? (
                          <>
                            <Image
                              src={URL.createObjectURL(selectedFiles[direction as keyof typeof selectedFiles]!)}
                              width={80}
                              height={80}
                              style={{ objectFit: 'cover', borderRadius: 4 }}
                              preview={false}
                            />
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileSelect(direction, null);
                              }}
                              style={{ position: 'absolute', top: 4, right: 4 }}
                            />
                          </>
                        ) : (
                          <>
                            <UploadOutlined style={{ fontSize: 24, color: '#999' }} />
                            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                              {t(`vr.directions.${direction}`)}
                            </div>
                          </>
                        )}
                      </div>
                      <input
                        id={`vr-${direction}`}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect(direction, e.target.files?.[0] || null)}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  {t('vr.editor.uploadHint')}
                </p>
              </div>

              {uploading ? (
                <Progress percent={uploadProgress} status="active" />
              ) : (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleUpload}
                  disabled={Object.keys(selectedFiles).length !== 6}
                  block
                >
                  {t('vr.editor.create')}
                </Button>
              )}
            </Space>
          </Card>
        )}

        {panoramas.length > 0 && (
          <div>
            <h4>{t('vr.editor.panoramasCount', { count: panoramas.length })}</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              {panoramas.map(panorama => (
                <Card
                  key={panorama.id}
                  size="small"
                  title={
                    <Space>
                      <span>
                        {t(`vr.locations.${panorama.location_type}`)}
                        {panorama.location_number && ` ${panorama.location_number}`}
                      </span>
                      <Tag>{t('vr.editor.imagesCount', { count: 6 })}</Tag>
                    </Space>
                  }
                  extra={
                    !viewMode && (
                      <Popconfirm
                        title={t('vr.confirm.delete')}
                        onConfirm={() => handleDelete(panorama.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                      >
                        <Button danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )
                  }
                >
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {directions.map(dir => (
                      <div key={dir} style={{ position: 'relative' }}>
                        <Image
                          src={panorama[`${dir}_image` as keyof VRPanorama] as string}
                          width={80}
                          height={80}
                          style={{ objectFit: 'cover', borderRadius: 4 }}
                        />
                        <Tooltip title={t('vr.editor.downloadDirection', { direction: t(`vr.directions.${dir}`) })}>
                          <Button
                            type="text"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadImage(
                              panorama[`${dir}_image` as keyof VRPanorama] as string,
                              dir,
                              panorama.id
                            )}
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              background: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              padding: 2,
                              minWidth: 20,
                              height: 20
                            }}
                          />
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default VRPanoramaUploader;