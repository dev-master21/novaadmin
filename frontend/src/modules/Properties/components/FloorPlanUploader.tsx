// frontend/src/modules/Properties/components/FloorPlanUploader.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Button,
  Text,
  Image,
  Center,
  ThemeIcon,
  Paper,
  FileButton,
  Box,
  ActionIcon,
  Tooltip,
  Modal,
  Badge,
  Alert
} from '@mantine/core';
import {
  IconUpload,
  IconTrash,
  IconDownload,
  IconFileDescription,
  IconCheck,
  IconX,
  IconZoomIn,
  IconInfoCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import { propertiesApi } from '@/api/properties.api';

interface FloorPlanUploaderProps {
  propertyId: number;
  floorPlanUrl?: string;
  onUpdate: () => void;
  viewMode?: boolean;
  onChange?: (file: File | null) => void; // ✅ НОВОЕ: Колбэк для передачи данных
}

const FloorPlanUploader = ({ 
  propertyId, 
  floorPlanUrl, 
  onUpdate,
  viewMode = false,
  onChange // ✅ НОВОЕ
}: FloorPlanUploaderProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // ✅ НОВОЕ: Состояния для временной планировки
  const [tempFloorPlan, setTempFloorPlan] = useState<File | null>(null);
  const [tempPreview, setTempPreview] = useState<string | null>(null);
  const isCreatingMode = propertyId === 0;
  
  const [imageModalOpened, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  // ✅ НОВОЕ: Эффект для передачи данных через колбэк
  useEffect(() => {
    if (isCreatingMode && onChange) {
      onChange(tempFloorPlan);
    }
  }, [tempFloorPlan, isCreatingMode, onChange]);

  // ✅ НОВОЕ: Cleanup для preview URL
  useEffect(() => {
    return () => {
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
      }
    };
  }, [tempPreview]);

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      notifications.show({
        title: t('errors.generic'),
        message: t('floorPlanUploader.fileSizeExceeds'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      notifications.show({
        title: t('errors.generic'),
        message: t('floorPlanUploader.fileMustBeImage'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    // ✅ ИЗМЕНЕНО: Режим создания - сохраняем в память
    if (isCreatingMode) {
      // Очищаем предыдущий preview если он был
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
      }

      const preview = URL.createObjectURL(file);
      setTempFloorPlan(file);
      setTempPreview(preview);

      notifications.show({
        title: t('common.success'),
        message: t('floorPlanUploader.floorPlanAddedTemp'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      return;
    }

    // Режим редактирования - загружаем на сервер
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('floorPlan', file);

      await propertiesApi.uploadFloorPlan(propertyId, formData);

      notifications.show({
        title: t('common.success'),
        message: t('floorPlanUploader.floorPlanUploaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('floorPlanUploader.errorUploading'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setUploading(false);
    }
  };

  // ✅ НОВОЕ: Удаление временной планировки
  const handleRemoveTempFloorPlan = () => {
    if (tempPreview) {
      URL.revokeObjectURL(tempPreview);
    }
    setTempFloorPlan(null);
    setTempPreview(null);

    notifications.show({
      title: t('common.success'),
      message: t('floorPlanUploader.floorPlanRemoved'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      closeDeleteModal();
      
      // Используем метод обновления свойства, передавая пустое значение для floor_plan
      await propertiesApi.update(propertyId, { 
        floor_plan_url: null 
      });
      
      notifications.show({
        title: t('common.success'),
        message: t('floorPlanUploader.floorPlanDeleted'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      
      onUpdate();
    } catch (error: any) {
      console.error('Delete error:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('floorPlanUploader.errorDeleting'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!floorPlanUrl) return;
    
    try {
      setDownloading(true);
      
      // Получаем изображение как blob
      const response = await fetch(floorPlanUrl);
      const blob = await response.blob();
      
      // Создаём временный URL для blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Создаём ссылку для скачивания
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `floor_plan_${propertyId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Освобождаем память
      window.URL.revokeObjectURL(blobUrl);
      
      notifications.show({
        title: t('common.success'),
        message: t('floorPlanUploader.floorPlanDownloaded'),
        color: 'blue',
        icon: <IconDownload size={18} />
      });
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('floorPlanUploader.errorDownloading'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setDownloading(false);
    }
  };

  // ✅ ИЗМЕНЕНО: Проверка наличия планировки для обоих режимов
  const hasFloorPlan = floorPlanUrl || tempFloorPlan;

  return (
    <Stack gap="lg">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                <IconFileDescription size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">
                  {t('properties.floorPlan')}
                </Text>
                <Text size="sm" c="dimmed">
                  {hasFloorPlan
                    ? t('floorPlanUploader.floorPlanExists') 
                    : t('floorPlanUploader.noFloorPlan')
                  }
                </Text>
              </div>
            </Group>

            {!viewMode && (
              <FileButton onChange={handleFileSelect} accept="image/*">
                {(props) => (
                  <Button
                    {...props}
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'lime', deg: 90 }}
                    leftSection={<IconUpload size={18} />}
                    loading={uploading}
                    size={isMobile ? 'sm' : 'md'}
                  >
                    {isMobile 
                      ? (hasFloorPlan ? t('common.change') : t('common.upload'))
                      : (hasFloorPlan ? t('floorPlanUploader.changeFloorPlan') : t('floorPlanUploader.uploadFloorPlan'))
                    }
                  </Button>
                )}
              </FileButton>
            )}
          </Group>

          {/* ✅ НОВОЕ: Alert о временном хранении */}
          {isCreatingMode && tempFloorPlan && (
            <Alert icon={<IconInfoCircle size={18} />} color="orange" variant="light">
              <Text size="sm">
                {t('floorPlanUploader.tempStorageInfo')}
              </Text>
            </Alert>
          )}

          {/* Floor Plan Display */}
          {floorPlanUrl && !isCreatingMode ? (
            // Отображение загруженной планировки
            <Stack gap="md">
              <Box pos="relative">
                <Image
                  src={floorPlanUrl}
                  alt={t('floorPlanUploader.floorPlanAlt')}
                  radius="md"
                  style={{ 
                    maxHeight: isMobile ? 300 : 600,
                    cursor: 'pointer'
                  }}
                  onClick={openImageModal}
                />
                
                {/* View Full Size Button Overlay */}
                <Tooltip label={t('floorPlanUploader.viewFullSize')}>
                  <ActionIcon
                    variant="filled"
                    color="dark"
                    size="lg"
                    onClick={openImageModal}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8
                    }}
                  >
                    <IconZoomIn size={20} />
                  </ActionIcon>
                </Tooltip>
              </Box>

              {/* Action Buttons */}
              <Group justify="center" gap="sm">
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconDownload size={18} />}
                  onClick={handleDownload}
                  loading={downloading}
                  size={isMobile ? 'sm' : 'md'}
                >
                  {isMobile ? t('common.download') : t('floorPlanUploader.downloadFloorPlan')}
                </Button>

                {!viewMode && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={18} />}
                    onClick={openDeleteModal}
                    loading={deleting}
                    size={isMobile ? 'sm' : 'md'}
                  >
                    {t('common.delete')}
                  </Button>
                )}
              </Group>
            </Stack>
          ) : tempFloorPlan && tempPreview ? (
            // ✅ НОВОЕ: Отображение временной планировки
            <Stack gap="md">
              <Paper p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-orange-6)' }}>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="xs">
                      <Badge variant="filled" color="orange" size="lg">
                        {t('floorPlanUploader.tempStorage')}
                      </Badge>
                      <Badge variant="light" color="teal" size="md">
                        {(tempFloorPlan.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                    </Group>
                  </Group>

                  <Box pos="relative">
                    <Image
                      src={tempPreview}
                      alt={t('floorPlanUploader.floorPlanAlt')}
                      radius="md"
                      style={{ 
                        maxHeight: isMobile ? 300 : 600,
                        cursor: 'pointer',
                        border: '2px dashed var(--mantine-color-orange-6)'
                      }}
                      onClick={openImageModal}
                    />
                    
                    {/* View Full Size Button Overlay */}
                    <Tooltip label={t('floorPlanUploader.viewFullSize')}>
                      <ActionIcon
                        variant="filled"
                        color="dark"
                        size="lg"
                        onClick={openImageModal}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8
                        }}
                      >
                        <IconZoomIn size={20} />
                      </ActionIcon>
                    </Tooltip>
                  </Box>

                  {/* Action Buttons */}
                  {!viewMode && (
                    <Group justify="center">
                      <Button
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={18} />}
                        onClick={handleRemoveTempFloorPlan}
                        size={isMobile ? 'sm' : 'md'}
                      >
                        {t('common.delete')}
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            </Stack>
          ) : (
            // Empty state
            <Paper p="xl" radius="md" withBorder style={{ borderStyle: 'dashed' }}>
              <Center>
                <Stack align="center" gap="md">
                  <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                    <IconFileDescription size={40} />
                  </ThemeIcon>
                  
                  <Text size="lg" c="dimmed" ta="center">
                    {t('floorPlanUploader.noFloorPlan')}
                  </Text>

                  {!viewMode && (
                    <Stack gap="xs" align="center">
                      <Text size="sm" c="dimmed" ta="center">
                        {t('floorPlanUploader.clickButtonAbove')}
                      </Text>
                      <Text size="xs" c="dimmed" ta="center">
                        {t('floorPlanUploader.supportedFormats')}
                      </Text>
                      <Text size="xs" c="dimmed" ta="center">
                        {t('floorPlanUploader.maxSize')}
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </Center>
            </Paper>
          )}
        </Stack>
      </Card>

      {/* Full Size Image Modal */}
      <Modal
        opened={imageModalOpened}
        onClose={closeImageModal}
        title={t('floorPlanUploader.floorPlanFullSize')}
        size={isMobile ? 'full' : 'xl'}
        centered
        styles={{
          body: { padding: 0 }
        }}
      >
        {(floorPlanUrl || tempPreview) && (
          <Image
            src={floorPlanUrl || tempPreview || ''}
            alt={t('floorPlanUploader.floorPlanAlt')}
            fit="contain"
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={t('common.confirmDelete')}
        centered
      >
        <Stack gap="md">
          <Text>
            {t('floorPlanUploader.confirmDeleteFloorPlan')}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeDeleteModal}>
              {t('common.no')}
            </Button>
            <Button color="red" onClick={handleDeleteConfirm} loading={deleting}>
              {t('common.yes')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default FloorPlanUploader;