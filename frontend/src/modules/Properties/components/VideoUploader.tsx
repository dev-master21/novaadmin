// frontend/src/modules/Properties/components/VideoUploader.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Button,
  Text,
  Progress,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Paper,
  ActionIcon,
  ThemeIcon,
  Tooltip,
  Center,
  Box,
  Image,
  FileButton,
  Divider,
  Alert
} from '@mantine/core';
import {
  IconUpload,
  IconTrash,
  IconEdit,
  IconPlayerPlay,
  IconDownload,
  IconVideo,
  IconX,
  IconCheck,
  IconInfoCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
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

// ✅ НОВОЕ: Интерфейс для временного видео
interface TempVideo {
  file: File;
  title?: string;
  description?: string;
  preview: string;
}

interface VideoUploaderProps {
  propertyId: number;
  videos?: Video[];
  onUpdate: () => void;
  viewMode?: boolean;
  onChange?: (videos: TempVideo[]) => void; // ✅ НОВОЕ: Колбэк для передачи данных
}

const VideoUploader = ({ 
  propertyId, 
  videos = [], 
  onUpdate, 
  viewMode = false,
  onChange // ✅ НОВОЕ
}: VideoUploaderProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // ✅ НОВОЕ: Состояние для временных видео
  const [tempVideos, setTempVideos] = useState<TempVideo[]>([]);
  const isCreatingMode = propertyId === 0;

  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // ✅ НОВОЕ: Состояния для редактирования временного видео
  const [editingTempVideoIndex, setEditingTempVideoIndex] = useState<number | null>(null);
  const [tempEditTitle, setTempEditTitle] = useState('');
  const [tempEditDescription, setTempEditDescription] = useState('');
  
  const [playerModalOpened, { open: openPlayerModal, close: closePlayerModal }] = useDisclosure(false);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  
  // ✅ НОВОЕ: Состояние для проигрывания временного видео
  const [playingTempVideo, setPlayingTempVideo] = useState<TempVideo | null>(null);
  
  // Модальное окно для удаления
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ НОВОЕ: Эффект для передачи данных через колбэк
  useEffect(() => {
    if (isCreatingMode && onChange) {
      onChange(tempVideos);
    }
  }, [tempVideos, isCreatingMode, onChange]);

  // ✅ НОВОЕ: Cleanup для preview URLs
  useEffect(() => {
    return () => {
      tempVideos.forEach(video => {
        URL.revokeObjectURL(video.preview);
      });
    };
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    const invalidFiles = files.filter(file => !file.type.startsWith('video/'));
    if (invalidFiles.length > 0) {
      notifications.show({
        title: t('errors.generic'),
        message: t('videoUploader.invalidFiles', { files: invalidFiles.map(f => f.name).join(', ') }),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    // ✅ ИЗМЕНЕНО: Режим создания - сохраняем в память
    if (isCreatingMode) {
      const newTempVideos: TempVideo[] = files.map(file => {
        const preview = URL.createObjectURL(file);
        return {
          file,
          preview
        };
      });

      setTempVideos([...tempVideos, ...newTempVideos]);
      
      notifications.show({
        title: t('common.success'),
        message: t('videoUploader.videosAddedTemp', { count: files.length }),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      return;
    }

    // Режим редактирования - загружаем на сервер
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

      notifications.show({
        title: t('common.success'),
        message: t('videoUploader.videosUploaded', { count: files.length }),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('videoUploader.errorUploading'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ✅ НОВОЕ: Удаление временного видео
  const handleRemoveTempVideo = (index: number) => {
    const videoToDelete = tempVideos[index];
    URL.revokeObjectURL(videoToDelete.preview);
    setTempVideos(tempVideos.filter((_, i) => i !== index));
    
    notifications.show({
      title: t('common.success'),
      message: t('videoUploader.videoRemoved'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  // ✅ НОВОЕ: Редактирование временного видео
  const handleEditTempVideo = (index: number) => {
    const video = tempVideos[index];
    setEditingTempVideoIndex(index);
    setTempEditTitle(video.title || '');
    setTempEditDescription(video.description || '');
    openEditModal();
  };

  // ✅ НОВОЕ: Сохранение изменений временного видео
  const handleSaveTempVideoEdit = () => {
    if (editingTempVideoIndex === null) return;

    const updatedVideos = [...tempVideos];
    updatedVideos[editingTempVideoIndex] = {
      ...updatedVideos[editingTempVideoIndex],
      title: tempEditTitle,
      description: tempEditDescription
    };
    
    setTempVideos(updatedVideos);
    
    notifications.show({
      title: t('common.success'),
      message: t('common.saveSuccess'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
    
    closeEditModal();
    setEditingTempVideoIndex(null);
    setTempEditTitle('');
    setTempEditDescription('');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVideo) return;
    
    setDeleting(true);
    closeDeleteModal();

    try {
      await propertiesApi.deleteVideo(propertyId, deletingVideo.id);
      notifications.show({
        title: t('common.success'),
        message: t('common.deleteSuccess'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('errors.generic'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setDeleting(false);
      setDeletingVideo(null);
    }
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setEditTitle(video.title || '');
    setEditDescription(video.description || '');
    setEditingTempVideoIndex(null);
    openEditModal();
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;

    try {
      await propertiesApi.updateVideo(propertyId, editingVideo.id, {
        title: editTitle,
        description: editDescription
      });
      
      notifications.show({
        title: t('common.success'),
        message: t('common.saveSuccess'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      
      closeEditModal();
      setEditingVideo(null);
      setEditTitle('');
      setEditDescription('');
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('errors.generic'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handlePlayVideo = (video: Video) => {
    setPlayingVideo(video);
    setPlayingTempVideo(null);
    openPlayerModal();
  };

  // ✅ НОВОЕ: Воспроизведение временного видео
  const handlePlayTempVideo = (video: TempVideo) => {
    setPlayingTempVideo(video);
    setPlayingVideo(null);
    openPlayerModal();
  };

  const handleClosePlayer = () => {
    closePlayerModal();
    setTimeout(() => {
      setPlayingVideo(null);
      setPlayingTempVideo(null);
    }, 300);
  };

  const handleDownloadVideo = (video: Video) => {
    const link = document.createElement('a');
    link.href = `https://novaestate.company${video.video_url}`;
    link.download = `video_${video.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    notifications.show({
      title: t('common.success'),
      message: t('videoUploader.videoDownloading'),
      color: 'blue',
      icon: <IconDownload size={18} />
    });
  };

  return (
    <Stack gap="lg">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="grape">
                <IconVideo size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">
                  {t('videoUploader.title')}
                </Text>
                {(videos.length > 0 || tempVideos.length > 0) && (
                  <Text size="sm" c="dimmed">
                    {t('videoUploader.videoCount', { count: videos.length + tempVideos.length })}
                  </Text>
                )}
              </div>
            </Group>

            {!viewMode && (
              <FileButton onChange={handleFileSelect} accept="video/*" multiple>
                {(props) => (
                  <Button
                    {...props}
                    variant="gradient"
                    gradient={{ from: 'grape', to: 'pink', deg: 90 }}
                    leftSection={<IconUpload size={18} />}
                    disabled={uploading}
                    size={isMobile ? 'sm' : 'md'}
                  >
                    {isMobile ? t('videoUploader.upload') : t('videoUploader.uploadVideo')}
                  </Button>
                )}
              </FileButton>
            )}
          </Group>

          {/* Upload Progress */}
          {uploading && (
            <Paper p="md" radius="md" withBorder>
              <Stack gap="sm">
                <Progress 
                  value={uploadProgress} 
                  size="lg" 
                  radius="xl"
                  striped
                  animated
                  color="grape"
                />
                <Text size="sm" ta="center" c="dimmed">
                  {t('videoUploader.uploadingProgress', { percent: uploadProgress })}
                </Text>
              </Stack>
            </Paper>
          )}

          {/* Info Alert */}
          {!viewMode && videos.length === 0 && tempVideos.length === 0 && !uploading && (
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Text size="sm">
                {t('videoUploader.supportedFormats')}
              </Text>
              <Text size="sm">
                {t('videoUploader.maxSize')}
              </Text>
            </Alert>
          )}

          {/* ✅ НОВОЕ: Alert о временном хранении */}
          {isCreatingMode && tempVideos.length > 0 && (
            <Alert icon={<IconInfoCircle size={18} />} color="orange" variant="light">
              <Text size="sm">
                {t('videoUploader.tempStorageInfo', { count: tempVideos.length })}
              </Text>
            </Alert>
          )}

          <Divider />

          {/* Empty State */}
          {videos.length === 0 && tempVideos.length === 0 && !uploading && (
            <Paper p="xl" radius="md" withBorder>
              <Center>
                <Stack align="center" gap="md">
                  <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                    <IconVideo size={40} />
                  </ThemeIcon>
                  <Text size="lg" c="dimmed" ta="center">
                    {t('videoUploader.noVideos')}
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}

          {/* ✅ НОВОЕ: Temporary Videos List */}
          {isCreatingMode && tempVideos.length > 0 && (
            <Stack gap="md">
              <Text size="sm" fw={600} c="dimmed">
                {t('videoUploader.tempVideos')} ({tempVideos.length})
              </Text>
              
              {tempVideos.map((video, index) => (
                <Paper key={index} p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-orange-6)' }}>
                  <Group align="flex-start" wrap="nowrap" gap="md">
                    {/* Video Thumbnail */}
                    <Box
                      pos="relative"
                      style={{
                        width: isMobile ? 100 : 160,
                        height: isMobile ? 56 : 90,
                        minWidth: isMobile ? 100 : 160,
                        cursor: 'pointer',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '2px dashed var(--mantine-color-orange-6)'
                      }}
                      onClick={() => handlePlayTempVideo(video)}
                    >
                      <video
                        src={video.preview}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                      />
                      
                      {/* Play Button Overlay */}
                      <Center
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          transition: 'all 0.3s',
                          opacity: 0.8
                        }}
                        className="play-button-overlay"
                      >
                        <IconPlayerPlay 
                          size={24}
                          style={{ color: 'white' }}
                        />
                      </Center>
                    </Box>

                    {/* Video Info */}
                    <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text fw={600} size={isMobile ? 'sm' : 'md'} lineClamp={1}>
                          {video.title || video.file.name}
                        </Text>
                        <Badge variant="filled" color="orange" size="sm">
                          {t('videoUploader.tempStorage')}
                        </Badge>
                      </Group>
                      
                      {video.description && (
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {video.description}
                        </Text>
                      )}
                      
                      <Group gap="xs">
                        <Badge variant="light" color="grape" size={isMobile ? 'sm' : 'md'}>
                          {formatFileSize(video.file.size)}
                        </Badge>
                      </Group>
                    </Stack>

                    {/* Action Buttons */}
                    {!viewMode && (
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label={t('videoUploader.edit')}>
                          <ActionIcon
                            variant="light"
                            color="grape"
                            size={isMobile ? 'md' : 'lg'}
                            onClick={() => handleEditTempVideo(index)}
                          >
                            <IconEdit size={isMobile ? 16 : 18} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label={t('common.delete')}>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size={isMobile ? 'md' : 'lg'}
                            onClick={() => handleRemoveTempVideo(index)}
                          >
                            <IconTrash size={isMobile ? 16 : 18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}

          {/* Videos List */}
          {videos.length > 0 && (
            <Stack gap="md">
              {tempVideos.length > 0 && (
                <>
                  <Text size="sm" fw={600} c="dimmed">
                    {t('videoUploader.uploadedVideos')} ({videos.length})
                  </Text>
                </>
              )}
              
              {videos.map((video) => (
                <Paper key={video.id} p="md" radius="md" withBorder>
                  <Group align="flex-start" wrap="nowrap" gap="md">
                    {/* Video Thumbnail */}
                    <Box
                      pos="relative"
                      style={{
                        width: isMobile ? 100 : 160,
                        height: isMobile ? 56 : 90,
                        minWidth: isMobile ? 100 : 160,
                        cursor: 'pointer',
                        borderRadius: 8,
                        overflow: 'hidden'
                      }}
                      onClick={() => handlePlayVideo(video)}
                    >
                      {video.thumbnail_url ? (
                        <Image
                          src={`https://novaestate.company${video.thumbnail_url}`}
                          alt={t('videoUploader.thumbnailAlt')}
                          height="100%"
                          fit="cover"
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
                      
                      {/* Play Button Overlay */}
                      <Center
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          transition: 'all 0.3s',
                          opacity: 0.8
                        }}
                        className="play-button-overlay"
                      >
                        <IconPlayerPlay 
                          size={24}
                          style={{ color: 'white' }}
                        />
                      </Center>
                    </Box>

                    {/* Video Info */}
                    <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size={isMobile ? 'sm' : 'md'} lineClamp={1}>
                        {video.title || t('videoUploader.noTitle')}
                      </Text>
                      
                      {video.description && (
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {video.description}
                        </Text>
                      )}
                      
                      <Group gap="xs">
                        <Badge variant="light" color="grape" size={isMobile ? 'sm' : 'md'}>
                          {formatFileSize(video.file_size)}
                        </Badge>
                      </Group>
                    </Stack>

                    {/* Action Buttons */}
                    <Group gap="xs" wrap="nowrap">
                      <Tooltip label={t('videoUploader.downloadVideo')}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size={isMobile ? 'md' : 'lg'}
                          onClick={() => handleDownloadVideo(video)}
                        >
                          <IconDownload size={isMobile ? 16 : 18} />
                        </ActionIcon>
                      </Tooltip>

                      {!viewMode && (
                        <>
                          <Tooltip label={t('videoUploader.edit')}>
                            <ActionIcon
                              variant="light"
                              color="grape"
                              size={isMobile ? 'md' : 'lg'}
                              onClick={() => handleEdit(video)}
                            >
                              <IconEdit size={isMobile ? 16 : 18} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label={t('common.delete')}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size={isMobile ? 'md' : 'lg'}
                              onClick={() => {
                                setDeletingVideo(video);
                                openDeleteModal();
                              }}
                              loading={deleting && deletingVideo?.id === video.id}
                            >
                              <IconTrash size={isMobile ? 16 : 18} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setDeletingVideo(null);
        }}
        title={t('common.confirmDelete')}
        centered
      >
        <Stack gap="md">
          <Text>{t('videoUploader.confirmDeleteVideo')}</Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                closeDeleteModal();
                setDeletingVideo(null);
              }}
            >
              {t('common.no')}
            </Button>
            <Button color="red" onClick={handleDeleteConfirm} loading={deleting}>
              {t('common.yes')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => {
          closeEditModal();
          setEditingVideo(null);
          setEditingTempVideoIndex(null);
          setEditTitle('');
          setEditDescription('');
          setTempEditTitle('');
          setTempEditDescription('');
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="grape">
              <IconEdit size={20} />
            </ThemeIcon>
            <Text fw={600}>{t('videoUploader.editVideoTitle')}</Text>
          </Group>
        }
        centered
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label={t('videoUploader.titleLabel')}
            placeholder={t('videoUploader.titlePlaceholder')}
            value={editingTempVideoIndex !== null ? tempEditTitle : editTitle}
            onChange={(e) => {
              if (editingTempVideoIndex !== null) {
                setTempEditTitle(e.currentTarget.value);
              } else {
                setEditTitle(e.currentTarget.value);
              }
            }}
            styles={{
              input: { fontSize: '16px' }
            }}
          />

          <Textarea
            label={t('videoUploader.descriptionLabel')}
            placeholder={t('videoUploader.descriptionPlaceholder')}
            value={editingTempVideoIndex !== null ? tempEditDescription : editDescription}
            onChange={(e) => {
              if (editingTempVideoIndex !== null) {
                setTempEditDescription(e.currentTarget.value);
              } else {
                setEditDescription(e.currentTarget.value);
              }
            }}
            minRows={4}
            maxRows={8}
            autosize
            styles={{
              input: { fontSize: '16px' }
            }}
          />

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                closeEditModal();
                setEditingVideo(null);
                setEditingTempVideoIndex(null);
                setEditTitle('');
                setEditDescription('');
                setTempEditTitle('');
                setTempEditDescription('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'grape', to: 'pink', deg: 90 }}
              onClick={editingTempVideoIndex !== null ? handleSaveTempVideoEdit : handleSaveEdit}
            >
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Player Modal */}
      <Modal
        opened={playerModalOpened}
        onClose={handleClosePlayer}
        title={
          playingVideo?.title || 
          playingTempVideo?.title || 
          playingTempVideo?.file.name || 
          t('videoUploader.playingVideo')
        }
        size={isMobile ? 'full' : 'xl'}
        centered
        styles={{
          body: { padding: 0 }
        }}
      >
        {(playingVideo || playingTempVideo) && (
          <Stack gap={0}>
            <Box pos="relative" style={{ paddingTop: '56.25%' }}>
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
                src={
                  playingVideo 
                    ? `https://novaestate.company${playingVideo.video_url}`
                    : playingTempVideo?.preview
                }
              >
                {t('videoUploader.browserNotSupported')}
              </video>
            </Box>
            
            {((playingVideo && playingVideo.description) || (playingTempVideo && playingTempVideo.description)) && (
              <Box p="md">
                <Text size="sm" c="dimmed">
                  {playingVideo?.description || playingTempVideo?.description}
                </Text>
              </Box>
            )}
          </Stack>
        )}
      </Modal>

      <style>{`
        .play-button-overlay:hover {
          opacity: 1 !important;
          transform: translate(-50%, -50%) scale(1.1) !important;
        }
      `}</style>
    </Stack>
  );
};

export default VideoUploader;