// frontend/src/modules/Properties/components/VRPanoramaUploader.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Button,
  Text,
  Select,
  Image,
  Badge,
  Paper,
  ActionIcon,
  ThemeIcon,
  Tooltip,
  Center,
  SimpleGrid,
  Box,
  Loader,
  Alert,
  Divider
} from '@mantine/core';
import {
  IconUpload,
  IconTrash,
  IconDownload,
  IconCube,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowNarrowUp,
  IconArrowNarrowDown
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
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

// ✅ НОВОЕ: Интерфейс для временной VR панорамы
interface TempVRPanorama {
  location_type: string;
  location_number: number;
  files: {
    front: File;
    back: File;
    left: File;
    right: File;
    top: File;
    bottom: File;
  };
  previews: {
    front: string;
    back: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
}

interface VRPanoramaUploaderProps {
  propertyId: number;
  onUpdate: () => void;
  viewMode?: boolean;
  onChange?: (panoramas: TempVRPanorama[]) => void; // ✅ НОВОЕ: Колбэк для передачи данных
}

const VRPanoramaUploader = ({ 
  propertyId, 
  onUpdate, 
  viewMode = false,
  onChange // ✅ НОВОЕ
}: VRPanoramaUploaderProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [panoramas, setPanoramas] = useState<VRPanorama[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // ✅ НОВОЕ: Состояние для временных панорам
  const [tempPanoramas, setTempPanoramas] = useState<TempVRPanorama[]>([]);
  const isCreatingMode = propertyId === 0;
  
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

  const directions = [
    { key: 'front', icon: IconArrowUp, color: 'blue' },
    { key: 'back', icon: IconArrowDown, color: 'cyan' },
    { key: 'left', icon: IconArrowLeft, color: 'green' },
    { key: 'right', icon: IconArrowRight, color: 'orange' },
    { key: 'top', icon: IconArrowNarrowUp, color: 'violet' },
    { key: 'bottom', icon: IconArrowNarrowDown, color: 'grape' }
  ];

  // ✅ НОВОЕ: Эффект для передачи данных через колбэк
  useEffect(() => {
    if (isCreatingMode && onChange) {
      onChange(tempPanoramas);
    }
  }, [tempPanoramas, isCreatingMode, onChange]);

  // ✅ НОВОЕ: Cleanup для preview URLs
  useEffect(() => {
    return () => {
      tempPanoramas.forEach(panorama => {
        Object.values(panorama.previews).forEach(url => {
          URL.revokeObjectURL(url);
        });
      });
    };
  }, []);

  useEffect(() => {
    if (propertyId && !isCreatingMode) {
      loadPanoramas();
    }
  }, [propertyId]);

  const loadPanoramas = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getVRPanoramas(propertyId);
      setPanoramas(data.data || []);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('vr.errors.loadFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
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
      notifications.show({
        title: t('errors.generic'),
        message: t('vr.errors.fileTooLarge'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      notifications.show({
        title: t('errors.generic'),
        message: t('vr.errors.invalidFileType'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    setSelectedFiles(prev => ({
      ...prev,
      [direction]: file
    }));
  };

  const handleUpload = async () => {
    if (Object.keys(selectedFiles).length !== 6) {
      notifications.show({
        title: t('vr.errors.fillAllFields'),
        message: t('vr.editor.uploadHint'),
        color: 'orange',
        icon: <IconInfoCircle size={18} />
      });
      return;
    }

    // ✅ ИЗМЕНЕНО: Режим создания - сохраняем в память
    if (isCreatingMode) {
      const previews = {
        front: URL.createObjectURL(selectedFiles.front!),
        back: URL.createObjectURL(selectedFiles.back!),
        left: URL.createObjectURL(selectedFiles.left!),
        right: URL.createObjectURL(selectedFiles.right!),
        top: URL.createObjectURL(selectedFiles.top!),
        bottom: URL.createObjectURL(selectedFiles.bottom!)
      };

      const tempPanorama: TempVRPanorama = {
        location_type: locationType,
        location_number: locationNumber,
        files: selectedFiles as TempVRPanorama['files'],
        previews
      };

      setTempPanoramas([...tempPanoramas, tempPanorama]);
      
      notifications.show({
        title: t('common.success'),
        message: t('vr.success.addedToList'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      
      setSelectedFiles({});
      setLocationNumber(1);
      return;
    }

    // Режим редактирования - загружаем на сервер
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('location_type', locationType);
      formData.append('location_number', String(locationNumber));
      
      Object.entries(selectedFiles).forEach(([direction, file]) => {
        if (file) {
          formData.append(direction, file);
        }
      });

      await propertiesApi.createVRPanorama(propertyId, formData);

      notifications.show({
        title: t('common.success'),
        message: t('vr.success.created'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      
      setSelectedFiles({});
      setLocationNumber(1);
      
      loadPanoramas();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('vr.errors.createFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setUploading(false);
    }
  };

  // ✅ НОВОЕ: Удаление временной панорамы
  const handleRemoveTempPanorama = (index: number) => {
    const panoramaToDelete = tempPanoramas[index];
    
    // Cleanup всех preview URLs
    Object.values(panoramaToDelete.previews).forEach(url => {
      URL.revokeObjectURL(url);
    });
    
    setTempPanoramas(tempPanoramas.filter((_, i) => i !== index));
    
    notifications.show({
      title: t('common.success'),
      message: t('vr.success.removedFromList'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  const handleDelete = async (panoramaId: number) => {
    try {
      await propertiesApi.deleteVRPanorama(panoramaId);
      notifications.show({
        title: t('common.success'),
        message: t('vr.success.deleted'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      loadPanoramas();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('vr.errors.deleteFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleDownloadImage = (imageUrl: string, direction: string, panoramaId: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `vr_panorama_${panoramaId}_${direction}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    notifications.show({
      title: t('common.success'),
      message: t('vr.success.imageDownloaded'),
      color: 'blue',
      icon: <IconDownload size={18} />
    });
  };

  const selectedFilesCount = Object.keys(selectedFiles).length;
  const isUploadDisabled = selectedFilesCount !== 6;

  return (
    <Stack gap="lg">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <IconCube size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">
                  {t('vr.editor.title')}
                </Text>
                {(panoramas.length > 0 || tempPanoramas.length > 0) && (
                  <Text size="sm" c="dimmed">
                    {t('vr.editor.panoramasCount', { count: panoramas.length + tempPanoramas.length })}
                  </Text>
                )}
              </div>
            </Group>
            
            {(panoramas.length > 0 || tempPanoramas.length > 0) && (
              <Badge size="lg" variant="filled" color="indigo">
                {panoramas.length + tempPanoramas.length}
              </Badge>
            )}
          </Group>

          {loading && (
            <Center p="xl">
              <Loader size="xl" variant="dots" />
            </Center>
          )}

          {/* ✅ НОВОЕ: Alert о временном хранении */}
          {isCreatingMode && tempPanoramas.length > 0 && (
            <Alert icon={<IconInfoCircle size={18} />} color="orange" variant="light">
              <Text size="sm">
                {t('vr.editor.tempStorageInfo', { count: tempPanoramas.length })}
              </Text>
            </Alert>
          )}

          {/* Upload Form */}
          {!viewMode && !loading && (
            <>
              <Divider />
              
              <Paper p="md" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="md" radius="md" variant="light" color="indigo">
                      <IconUpload size={16} />
                    </ThemeIcon>
                    <Text fw={600}>{t('vr.editor.newPanorama')}</Text>
                  </Group>

                  {/* Location Type */}
                  <Select
                    label={t('vr.editor.locationType')}
                    placeholder={t('vr.editor.selectLocationType')}
                    value={locationType}
                    onChange={(value) => setLocationType(value || 'bedroom')}
                    data={locationTypes.map(type => ({
                      value: type,
                      label: t(`vr.locations.${type}`)
                    }))}
                    styles={{
                      input: { fontSize: '16px' }
                    }}
                  />

                  {/* Location Number */}
                  {['bedroom', 'bathroom', 'wardrobe', 'balcony'].includes(locationType) && (
                    <Select
                      label={t('vr.editor.locationNumber')}
                      placeholder={t('vr.editor.selectLocationNumber')}
                      value={String(locationNumber)}
                      onChange={(value) => setLocationNumber(Number(value))}
                      data={[1, 2, 3, 4, 5].map(num => ({
                        value: String(num),
                        label: String(num)
                      }))}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  )}

                  {/* Upload Images */}
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500} size="sm">
                        {t('vr.editor.uploadImages')}
                      </Text>
                      <Badge 
                        variant={selectedFilesCount === 6 ? 'filled' : 'light'} 
                        color={selectedFilesCount === 6 ? 'green' : 'orange'}
                      >
                        {selectedFilesCount}/6
                      </Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 2, xs: 3, sm: 6 }} spacing="md">
                      {directions.map((direction) => {
                        const Icon = direction.icon;
                        const hasFile = selectedFiles[direction.key as keyof typeof selectedFiles];

                        return (
                          <Paper
                            key={direction.key}
                            pos="relative"
                            radius="md"
                            withBorder
                            style={{
                              cursor: 'pointer',
                              borderColor: hasFile ? `var(--mantine-color-${direction.color}-6)` : undefined,
                              borderWidth: hasFile ? 2 : 1,
                              overflow: 'hidden'
                            }}
                            onClick={() => document.getElementById(`vr-${direction.key}`)?.click()}
                          >
                            {hasFile ? (
                              <>
                                <Image
                                  src={URL.createObjectURL(hasFile)}
                                  alt={t(`vr.directions.${direction.key}`)}
                                  height={120}
                                  fit="cover"
                                />
                                <ActionIcon
                                  color="red"
                                  variant="filled"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFileSelect(direction.key, null);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4
                                  }}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                                
                                <Badge
                                  variant="filled"
                                  color={direction.color}
                                  style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    left: 4
                                  }}
                                >
                                  {t(`vr.directions.${direction.key}`)}
                                </Badge>
                              </>
                            ) : (
                              <Center style={{ height: 120 }}>
                                <Stack align="center" gap="xs">
                                  <ThemeIcon 
                                    size="xl" 
                                    radius="md" 
                                    variant="light" 
                                    color={direction.color}
                                  >
                                    <Icon size={24} />
                                  </ThemeIcon>
                                  <Text size="xs" ta="center" c="dimmed">
                                    {t(`vr.directions.${direction.key}`)}
                                  </Text>
                                </Stack>
                              </Center>
                            )}

                            <input
                              id={`vr-${direction.key}`}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleFileSelect(direction.key, e.target.files?.[0] || null)}
                            />
                          </Paper>
                        );
                      })}
                    </SimpleGrid>

                    <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                      {t('vr.editor.uploadHint')}
                    </Alert>
                  </Stack>

                  {/* Upload Button */}
                  <Button
                    size="lg"
                    variant="gradient"
                    gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
                    leftSection={<IconUpload size={20} />}
                    onClick={handleUpload}
                    disabled={isUploadDisabled}
                    loading={uploading}
                    fullWidth
                  >
                    {uploading 
                      ? t('vr.editor.uploading')
                      : isCreatingMode
                      ? t('vr.editor.addToList')
                      : t('vr.editor.create')
                    }
                  </Button>
                </Stack>
              </Paper>
            </>
          )}

          {/* ✅ НОВОЕ: Temporary Panoramas List */}
          {isCreatingMode && tempPanoramas.length > 0 && (
            <>
              <Divider />
              
              <Stack gap="md">
                <Text fw={600}>
                  {t('vr.editor.tempPanoramas')} ({tempPanoramas.length})
                </Text>

                {tempPanoramas.map((panorama, index) => (
                  <Paper key={index} p="md" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-orange-6)' }}>
                    <Stack gap="md">
                      {/* Panorama Header */}
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm">
                          <ThemeIcon size="lg" radius="md" variant="light" color="orange">
                            <IconCube size={20} />
                          </ThemeIcon>
                          <div>
                            <Group gap="xs">
                              <Text fw={600} size={isMobile ? 'sm' : 'md'}>
                                {t(`vr.locations.${panorama.location_type}`)}
                                {panorama.location_number && ` ${panorama.location_number}`}
                              </Text>
                              <Badge variant="filled" color="orange" size="sm">
                                {t('vr.editor.tempStorage')}
                              </Badge>
                            </Group>
                            <Badge variant="light" color="indigo" size="sm">
                              {t('vr.editor.imagesReady', { count: 6 })}
                            </Badge>
                          </div>
                        </Group>

                        {!viewMode && (
                          <Tooltip label={t('common.delete')}>
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="lg"
                              onClick={() => handleRemoveTempPanorama(index)}
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>

                      {/* Images Grid - показываем 3 изображения (left, front, right) */}
                      <SimpleGrid cols={{ base: 3 }} spacing="xs">
                        {['left', 'front', 'right'].map(dir => {
                          const direction = directions.find(d => d.key === dir)!;
                          return (
                            <Box key={dir} pos="relative">
                              <Image
                                src={panorama.previews[dir as keyof typeof panorama.previews]}
                                alt={t(`vr.directions.${dir}`)}
                                height={isMobile ? 60 : 80}
                                fit="cover"
                                radius="md"
                                style={{ border: '2px dashed var(--mantine-color-orange-6)' }}
                              />
                              
                              <Badge
                                variant="filled"
                                color={direction.color}
                                size="xs"
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  left: 4
                                }}
                              >
                                {t(`vr.directions.${dir}`)}
                              </Badge>
                            </Box>
                          );
                        })}
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
          )}

          {/* Panoramas List */}
          {!loading && panoramas.length > 0 && (
            <>
              <Divider />
              
              <Stack gap="md">
                <Text fw={600}>
                  {isCreatingMode 
                    ? t('vr.editor.uploadedPanoramas')
                    : t('vr.editor.existingPanoramas')
                  } ({panoramas.length})
                </Text>

                {panoramas.map(panorama => (
                  <Paper key={panorama.id} p="md" radius="md" withBorder>
                    <Stack gap="md">
                      {/* Panorama Header */}
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm">
                          <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                            <IconCube size={20} />
                          </ThemeIcon>
                          <div>
                            <Text fw={600} size={isMobile ? 'sm' : 'md'}>
                              {t(`vr.locations.${panorama.location_type}`)}
                              {panorama.location_number && ` ${panorama.location_number}`}
                            </Text>
                            <Badge variant="light" color="indigo" size="sm">
                              {t('vr.editor.imagesCount', { count: 6 })}
                            </Badge>
                          </div>
                        </Group>

                        {!viewMode && (
                          <Tooltip label={t('common.delete')}>
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="lg"
                              onClick={() => {
                                modals.openConfirmModal({
                                  title: t('vr.confirm.delete'),
                                  children: <Text>{t('common.confirmDelete')}</Text>,
                                  labels: { confirm: t('common.yes'), cancel: t('common.no') },
                                  confirmProps: { color: 'red' },
                                  onConfirm: () => handleDelete(panorama.id)
                                });
                              }}
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>

                      {/* Images Grid */}
                      <SimpleGrid cols={{ base: 3, xs: 6 }} spacing="xs">
                        {directions.map(dir => (
                          <Box key={dir.key} pos="relative">
                            <Image
                              src={panorama[`${dir.key}_image` as keyof VRPanorama] as string}
                              alt={t(`vr.directions.${dir.key}`)}
                              height={isMobile ? 60 : 80}
                              fit="cover"
                              radius="md"
                            />
                            
                            <Badge
                              variant="filled"
                              color={dir.color}
                              size="xs"
                              style={{
                                position: 'absolute',
                                top: 4,
                                left: 4
                              }}
                            >
                              {t(`vr.directions.${dir.key}`)}
                            </Badge>

                            <Tooltip label={t('vr.editor.downloadDirection', { direction: t(`vr.directions.${dir.key}`) })}>
                              <ActionIcon
                                variant="filled"
                                color="dark"
                                size="sm"
                                onClick={() => handleDownloadImage(
                                  panorama[`${dir.key}_image` as keyof VRPanorama] as string,
                                  dir.key,
                                  panorama.id
                                )}
                                style={{
                                  position: 'absolute',
                                  bottom: 4,
                                  right: 4
                                }}
                              >
                                <IconDownload size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Box>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
          )}

          {/* Empty State */}
          {!loading && panoramas.length === 0 && tempPanoramas.length === 0 && viewMode && (
            <Paper p="xl" radius="md" withBorder>
              <Center>
                <Stack align="center" gap="md">
                  <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                    <IconCube size={40} />
                  </ThemeIcon>
                  <Text size="lg" c="dimmed" ta="center">
                    {t('vr.editor.noPanoramas')}
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

export default VRPanoramaUploader;