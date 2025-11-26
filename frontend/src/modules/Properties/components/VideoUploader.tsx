// frontend/src/modules/Properties/components/VideoUploader.tsx
import { useState, useRef } from 'react';
import {
  Card,
  Button,
  Progress,
  List,
  Space,
  message,
  Popconfirm,
  Input,
  Modal,
  Form,
  Tooltip
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';

interface Video {
  id: number;
  video_url: string;
  title?: string;
  description?: string;
  file_size: number;
  sort_order: number;
  thumbnail_url?: string;
}

interface VideoUploaderProps {
  propertyId: number;
  videos?: Video[];
  onUpdate: () => void;
  viewMode?: boolean;
}

const VideoUploader = ({ propertyId, videos = [], onUpdate, viewMode = false }: VideoUploaderProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidFiles = files.filter(file => !file.type.startsWith('video/'));
    if (invalidFiles.length > 0) {
      message.error(t('videoUploader.invalidFiles', { files: invalidFiles.map(f => f.name).join(', ') }));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach(file => {
        formData.append('videos', file);
      });

      await propertiesApi.uploadVideos(propertyId, formData, (progress) => {
        setUploadProgress(progress);
      });

      message.success(t('videoUploader.videosUploaded', { count: files.length }));
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('videoUploader.errorUploading'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (videoId: number) => {
    try {
      await propertiesApi.deleteVideo(propertyId, videoId);
      message.success(t('common.deleteSuccess'));
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    }
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    form.setFieldsValue({
      title: video.title,
      description: video.description
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      await propertiesApi.updateVideo(propertyId, editingVideo!.id, values);
      message.success(t('common.saveSuccess'));
      setEditModalVisible(false);
      onUpdate();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    }
  };

  const handlePlayVideo = (video: Video) => {
    setPlayingVideo(video);
    setPlayerModalVisible(true);
  };

  const handleClosePlayer = () => {
    setPlayerModalVisible(false);
    setTimeout(() => {
      setPlayingVideo(null);
    }, 300);
  };

  const handleDownloadVideo = (video: Video) => {
    const link = document.createElement('a');
    link.href = `https://novaestate.company${video.video_url}`;
    link.download = `video_${video.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(t('videoUploader.videoDownloading'));
  };

  return (
    <Card 
      title={t('videoUploader.title')}
      extra={
        !viewMode && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            disabled={uploading}
          >
            {t('videoUploader.uploadVideo')}
          </Button>
        )
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {uploading && (
        <div style={{ marginBottom: 24 }}>
          <Progress percent={uploadProgress} status="active" />
          <p style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
            {t('videoUploader.uploadingProgress', { percent: uploadProgress })}
          </p>
        </div>
      )}

      {videos.length === 0 && !uploading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 0',
          color: '#999'
        }}>
          <PlayCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>{t('videoUploader.noVideos')}</p>
          <p style={{ fontSize: 12 }}>
            {t('videoUploader.supportedFormats')}<br />
            {t('videoUploader.maxSize')}
          </p>
        </div>
      )}

      {videos.length > 0 && (
        <List
          dataSource={videos}
          renderItem={(video) => (
            <List.Item
              actions={[
                <Tooltip title={t('videoUploader.downloadVideo')} key="download">
                  <Button
                    type="text"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownloadVideo(video)}
                    disabled={false}
                  />
                </Tooltip>,
                ...(!viewMode ? [
                  <Tooltip title={t('videoUploader.edit')} key="edit">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(video)}
                    />
                  </Tooltip>,
                  <Popconfirm
                    key="delete"
                    title={t('common.confirmDelete')}
                    onConfirm={() => handleDelete(video.id)}
                    okText={t('common.yes')}
                    cancelText={t('common.no')}
                  >
                    <Tooltip title={t('common.delete')}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                ] : [])
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      position: 'relative',
                      width: 120,
                      height: 68,
                      cursor: 'pointer',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}
                    onClick={() => handlePlayVideo(video)}
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={`https://novaestate.company${video.thumbnail_url}`}
                        alt={t('videoUploader.thumbnailAlt')}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <video
                        src={`https://novaestate.company${video.video_url}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s'
                      }}
                      className="play-button-overlay"
                    >
                      <PlayCircleOutlined 
                        style={{ 
                          fontSize: 24, 
                          color: 'white'
                        }} 
                      />
                    </div>
                  </div>
                }
                title={video.title || t('videoUploader.noTitle')}
                description={
                  <Space direction="vertical" size={0}>
                    <span>{video.description || t('videoUploader.noDescription')}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {formatFileSize(video.file_size)}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title={t('videoUploader.editVideoTitle')}
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('videoUploader.titleLabel')}>
            <Input placeholder={t('videoUploader.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('videoUploader.descriptionLabel')}>
            <Input.TextArea rows={4} placeholder={t('videoUploader.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={playingVideo?.title || t('videoUploader.playingVideo')}
        open={playerModalVisible}
        onCancel={handleClosePlayer}
        footer={null}
        width={800}
        centered
        destroyOnClose
      >
        {playingVideo && (
          <div style={{ position: 'relative', paddingTop: '56.25%' }}>
            <video
              controls
              autoPlay
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#000'
              }}
              src={`https://novaestate.company${playingVideo.video_url}`}
            >
              {t('videoUploader.browserNotSupported')}
            </video>
          </div>
        )}
        {playingVideo?.description && (
          <p style={{ marginTop: 16, color: '#999' }}>
            {playingVideo.description}
          </p>
        )}
      </Modal>

      <style>{`
        .play-button-overlay {
          opacity: 0.8;
        }
        .play-button-overlay:hover {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.1);
        }
      `}</style>
    </Card>
  );
};

export default VideoUploader;