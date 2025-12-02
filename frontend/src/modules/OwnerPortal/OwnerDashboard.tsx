// frontend/src/modules/OwnerPortal/OwnerDashboard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  Button,
  Stack,
  Group,
  Text,
  Select,
  Loader,
  Modal,
  Paper,
  Badge,
  ThemeIcon,
  Alert,
  Divider,
  ActionIcon,
  Box,
  Center,
  Image,
  Progress,
  Timeline,
  Grid,
  Title,
  PasswordInput,
  Tooltip,
  Tabs,
  Table,
  ScrollArea
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconHome,
  IconLogout,
  IconSettings,
  IconCurrencyDollar,
  IconCalendar,
  IconWorld,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconExclamationCircle,
  IconShieldCheck,
  IconLock,
  IconBuildingEstate,
  IconBed,
  IconBath,
  IconChartBar,
  IconCalendarOff,
  IconSparkles,
  IconExternalLink,
  IconAlertCircle,
  IconCircleCheck,
  IconLockOpen
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useOwnerStore } from '@/store/ownerStore';
import { propertyOwnersApi, OwnerProperty, MonthlyPriceDetail } from '@/api/propertyOwners.api';
import dayjs from 'dayjs';

const OwnerDashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, clearAuth, canEditCalendar, canEditPricing } = useOwnerStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [changePasswordModalOpened, { open: openPasswordModal, close: closePasswordModal }] = useDisclosure(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [completenessModalOpened, { open: openCompletenessModal, close: closeCompletenessModal }] = useDisclosure(false);
  const [monthlyPricesModalOpened, { open: openMonthlyPricesModal, close: closeMonthlyPricesModal }] = useDisclosure(false);
  const [selectedProperty, setSelectedProperty] = useState<OwnerProperty | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<number | null>(null);

  const passwordForm = useForm({
    initialValues: {
      current_password: '',
      new_password: '',
      confirm_password: ''
    },
    validate: {
      current_password: (value) => (!value ? t('ownerPortal.currentPasswordRequired') : null),
      new_password: (value) => {
        if (!value) return t('ownerPortal.newPasswordRequired');
        if (value.length < 6) return t('ownerPortal.passwordMinLength');
        return null;
      },
      confirm_password: (value, values) => {
        if (!value) return t('ownerPortal.confirmPasswordRequired');
        if (value !== values.new_password) return t('ownerPortal.passwordsNotMatch');
        return null;
      }
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/owner/login');
      return;
    }
    loadProperties();
  }, [isAuthenticated]);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const { data } = await propertyOwnersApi.getProperties();
      if (data.success) {
        setProperties(data.data);
      }
    } catch (error) {
      notifications.show({
        title: t('ownerPortal.loadPropertiesError'),
        message: '',
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    notifications.show({
      title: t('ownerPortal.logoutSuccess'),
      message: '',
      color: 'teal',
      icon: <IconCheck size={18} />
    });
    navigate('/owner/login');
  };

  const handleChangeLanguage = (lang: string | null) => {
    if (lang) {
      i18n.changeLanguage(lang);
    }
  };

const handleManageProperty = (propertyId: number, type: 'pricing' | 'calendar') => {
  // Убираем проверку прав - просто переходим на страницу
  // Режим просмотра будет определяться внутри компонентов
  if (type === 'pricing') {
    navigate(`/owner/property/${propertyId}/pricing`);
  } else {
    navigate(`/owner/property/${propertyId}/calendar`);
  }
};

  const handleChangePassword = async (values: any) => {
    setChangingPassword(true);
    try {
      await propertyOwnersApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password
      });
      
      notifications.show({
        title: t('common.success'),
        message: t('ownerPortal.passwordChanged'),
        color: 'teal',
        icon: <IconCheck size={18} />
      });
      
      passwordForm.reset();
      closePasswordModal();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('ownerPortal.passwordChangeError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleShowCompleteness = (property: OwnerProperty) => {
    setSelectedProperty(property);
    openCompletenessModal();
  };

  const handleShowMonthlyPrices = (property: OwnerProperty) => {
    setSelectedProperty(property);
    openMonthlyPricesModal();
  };

const handleViewOnSite = async (propertyId: number) => {
  setLoadingPreview(propertyId);
  
  try {
    const response = await propertyOwnersApi.getPropertyPreviewUrl(propertyId);
    
    if (response.data?.success && response.data.data?.previewUrl) {
      // Просто открываем в новой вкладке - это работает на мобильных устройствах
      window.open(response.data.data.previewUrl, '_blank', 'noopener,noreferrer');
    } else {
      notifications.show({
        title: t('errors.generic'),
        message: t('ownerPortal.previewUrlError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  } catch (error) {
    console.error('Error generating preview URL:', error);
    notifications.show({
      title: t('errors.generic'),
      message: t('ownerPortal.previewUrlError'),
      color: 'red',
      icon: <IconX size={18} />
    });
  } finally {
    setLoadingPreview(null);
  }
};

  const formatRoomCount = (count: number | null | undefined): string => {
    if (count === null || count === undefined || count === 0 || count < 0) {
      return '';
    }
    const num = typeof count === 'number' ? count : parseFloat(String(count));
    if (isNaN(num) || num <= 0) {
      return '';
    }
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  };

  const hasValidRoomCount = (count: number | null | undefined): boolean => {
    if (count === null || count === undefined || count === 0) {
      return false;
    }
    const num = typeof count === 'number' ? count : parseFloat(String(count));
    return !isNaN(num) && num > 0;
  };

  const getRoomLabel = (count: number, type: 'bedroom' | 'bathroom'): string => {
    const num = Math.floor(count);
    
    if (i18n.language === 'ru') {
      const lastDigit = num % 10;
      const lastTwoDigits = num % 100;
      
      if (type === 'bedroom') {
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'спален';
        if (lastDigit === 1) return 'спальня';
        if (lastDigit >= 2 && lastDigit <= 4) return 'спальни';
        return 'спален';
      } else {
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'ванных';
        if (lastDigit === 1) return 'ванная';
        if (lastDigit >= 2 && lastDigit <= 4) return 'ванные';
        return 'ванных';
      }
    }
    
    const key = type === 'bedroom' ? 'ownerPortal.bedrooms' : 'ownerPortal.bathrooms';
    return t(key);
  };

  const getDealTypeLabel = (dealType: string) => {
    switch (dealType) {
      case 'sale':
        return t('properties.dealTypes.sale');
      case 'rent':
        return t('properties.dealTypes.rent');
      case 'both':
        return t('properties.dealTypes.both');
      default:
        return dealType;
    }
  };

  const getDealTypeColor = (dealType: string) => {
    switch (dealType) {
      case 'sale':
        return 'green';
      case 'rent':
        return 'blue';
      case 'both':
        return 'grape';
      default:
        return 'gray';
    }
  };

  const getCompletenessColor = (completeness: number) => {
    if (completeness >= 80) return 'teal';
    if (completeness >= 50) return 'yellow';
    return 'red';
  };

  const getMonthName = (month: number): string => {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[month - 1] || `Месяц ${month}`;
  };

  const formatPrice = (price: number | null): string => {
    if (!price) return '—';
    return `฿${price.toLocaleString()}`;
  };

  const languages = [
    { value: 'ru', label: 'Русский 🇷🇺' },
    { value: 'en', label: 'English 🇬🇧' },
    { value: 'zh', label: '中文 🇨🇳' }
  ];

  const renderOccupancyInfo = (property: OwnerProperty) => {
    if (!property.has_blocked_dates) {
      return (
        <Alert icon={<IconCheck size={16} />} color="green" variant="light" p="xs">
          <Text size="xs" fw={500}>
            {t('ownerPortal.noBlockedDates')}
          </Text>
        </Alert>
      );
    }

    if (property.nearest_blocked_period) {
      const start = dayjs(property.nearest_blocked_period.start_date);
      const end = dayjs(property.nearest_blocked_period.end_date);
      const isToday = start.isSame(dayjs(), 'day');
      const daysUntil = start.diff(dayjs(), 'day');

      let statusText = '';
      if (isToday) {
        statusText = t('ownerPortal.occupiedToday');
      } else if (daysUntil > 0) {
        statusText = t('ownerPortal.nextOccupiedIn', { days: daysUntil });
      } else {
        statusText = t('ownerPortal.currentlyOccupied');
      }

      return (
        <Alert icon={<IconCalendarOff size={16} />} color="red" variant="light" p="xs">
          <Stack gap={4}>
            <Text size="xs" fw={500}>
              {statusText}
            </Text>
            <Text size="xs" c="dimmed">
              {start.format('DD.MM')} - {end.format('DD.MM.YYYY')}
            </Text>
          </Stack>
        </Alert>
      );
    }

    return null;
  };

  const renderPropertyPhotos = (property: OwnerProperty) => {
    const photos = property.photos && property.photos.length > 0 
      ? property.photos 
      : property.cover_photo 
        ? [{ url: property.cover_photo }] 
        : [];

    if (photos.length === 0) {
      return (
        <Center h={220} bg="dark.6">
          <ThemeIcon size={70} radius="xl" variant="light" color="gray">
            <IconBuildingEstate size={35} />
          </ThemeIcon>
        </Center>
      );
    }

    if (photos.length === 1) {
      return (
        <Image
          src={photos[0].url}
          alt={property.property_name || property.property_number}
          height={220}
          fit="cover"
        />
      );
    }

    return (
      <Carousel
        withIndicators
        height={220}
        slideSize="100%"
        loop
        styles={{
          control: {
            '&[data-inactive]': {
              opacity: 0,
              cursor: 'default',
            },
          },
        }}
      >
        {photos.map((photo, index) => (
          <Carousel.Slide key={index}>
            <Image
              src={photo.url}
              alt={`${property.property_name || property.property_number} ${index + 1}`}
              height={220}
              fit="cover"
            />
          </Carousel.Slide>
        ))}
      </Carousel>
    );
  };

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--mantine-color-dark-8)' }}>
      {/* Header */}
      <Paper
        shadow="md"
        p="md"
        radius={0}
        style={{
          background: 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <Container size="xl">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon
                size={isMobile ? 'lg' : 'xl'}
                radius="md"
                variant="white"
                color="violet"
              >
                <IconHome size={isMobile ? 20 : 24} stroke={1.5} />
              </ThemeIcon>
              {!isMobile && (
                <Stack gap={0}>
                  <Text size="lg" fw={700} c="white">
                    NOVA ESTATE
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)">
                    {t('ownerPortal.portal')}
                  </Text>
                </Stack>
              )}
            </Group>

            <Group gap="xs">
              <Select
                value={i18n.language}
                onChange={handleChangeLanguage}
                data={languages}
                size={isMobile ? 'sm' : 'md'}
                w={isMobile ? 90 : 140}
                leftSection={<IconWorld size={16} />}
                comboboxProps={{ withinPortal: true }}
                styles={{
                  input: {
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    fontWeight: 500,
                    fontSize: '16px',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                  },
                }}
              />

              <Tooltip label={t('ownerPortal.changePassword')}>
                <ActionIcon
                  variant="white"
                  color="violet"
                  size={isMobile ? 'md' : 'lg'}
                  onClick={openPasswordModal}
                >
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>

              <Button
                variant="white"
                color="violet"
                leftSection={<IconLogout size={18} />}
                onClick={handleLogout}
                size={isMobile ? 'sm' : 'md'}
              >
                {!isMobile && t('ownerPortal.logout')}
              </Button>
            </Group>
          </Group>
        </Container>
      </Paper>

      {/* Content */}
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Welcome Card */}
          <Card shadow="lg" padding="xl" radius="md" withBorder style={{ 
            background: 'linear-gradient(135deg, var(--mantine-color-violet-9) 0%, var(--mantine-color-grape-9) 100%)' 
          }}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs">
                  <Title order={2} c="white">
                    {t('ownerPortal.welcome')}
                  </Title>
                  {!loading && properties.length > 0 && (
                    <Text size="sm" c="rgba(255, 255, 255, 0.8)">
                      {t('ownerPortal.totalProperties')}: {properties.length}
                    </Text>
                  )}
                </Stack>
                <Group gap="xs">
                  <Badge
                    size="lg"
                    variant="white"
                    leftSection={canEditCalendar() ? <IconLockOpen size={14} /> : <IconLock size={14} />}
                    color={canEditCalendar() ? 'teal' : 'gray'}
                  >
                    {t('ownerPortal.calendar')}
                  </Badge>
                  <Badge
                    size="lg"
                    variant="white"
                    leftSection={canEditPricing() ? <IconLockOpen size={14} /> : <IconLock size={14} />}
                    color={canEditPricing() ? 'teal' : 'gray'}
                  >
                    {t('ownerPortal.pricing')}
                  </Badge>
                </Group>
              </Group>

              {(!canEditCalendar() || !canEditPricing()) && (
                <Alert icon={<IconInfoCircle size={16} />} color="cyan" variant="white" styles={{
                  root: { background: 'rgba(255, 255, 255, 0.15)', border: 'none' }
                }}>
                  <Text size="sm" c="white">
                    {t('ownerPortal.limitedAccessInfo')}
                  </Text>
                </Alert>
              )}
            </Stack>
          </Card>

          {loading ? (
            <Card shadow="sm" padding="xl" radius="md" withBorder>
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="xl" variant="dots" />
                  <Text c="dimmed">{t('common.loading')}</Text>
                </Stack>
              </Center>
            </Card>
          ) : properties.length === 0 ? (
            <Card shadow="sm" padding="xl" radius="md" withBorder>
              <Center>
                <Stack align="center" gap="lg" py="xl">
                  <ThemeIcon
                    size={100}
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'grape', deg: 135 }}
                  >
                    <IconBuildingEstate size={50} />
                  </ThemeIcon>
                  <Stack align="center" gap="xs">
                    <Text size="xl" fw={700} c="dimmed">
                      {t('ownerPortal.noProperties')}
                    </Text>
                    <Text size="sm" c="dimmed" ta="center" maw={400}>
                      {t('ownerPortal.noPropertiesDescription')}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Card>
          ) : (
            <Grid gutter="lg">
              {properties.map((property) => (
                <Grid.Col key={property.id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <Card
                    shadow="sm"
                    padding={0}
                    radius="md"
                    withBorder
                    style={{
                      height: '100%',
                      overflow: 'hidden',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(121, 80, 242, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <Card.Section>
                      {renderPropertyPhotos(property)}
                    </Card.Section>

                    <Stack gap="md" p="lg">
                      {/* Заголовок */}
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Text fw={700} size="lg" lineClamp={2} style={{ flex: 1 }}>
                            {property.property_name || property.property_number}
                          </Text>
                        </Group>

                        <Group gap="xs" wrap="wrap">
                          <Badge size="sm" variant="dot" color="blue">
                            #{property.property_number}
                          </Badge>
                          <Badge
                            size="sm"
                            variant="light"
                            color={getDealTypeColor(property.deal_type)}
                          >
                            {getDealTypeLabel(property.deal_type)}
                          </Badge>
                        </Group>
                      </Stack>

                      {/* Информация о комнатах */}
                      {(hasValidRoomCount(property.bedrooms) || hasValidRoomCount(property.bathrooms)) && (
                        <Group gap="md">
                          {hasValidRoomCount(property.bedrooms) && (
                            <Group gap={4}>
                              <ThemeIcon size="sm" radius="xl" variant="light" color="blue">
                                <IconBed size={14} />
                              </ThemeIcon>
                              <Text size="sm" c="dimmed">
                                {formatRoomCount(property.bedrooms)} {getRoomLabel(property.bedrooms || 0, 'bedroom')}
                              </Text>
                            </Group>
                          )}
                          {hasValidRoomCount(property.bathrooms) && (
                            <Group gap={4}>
                              <ThemeIcon size="sm" radius="xl" variant="light" color="cyan">
                                <IconBath size={14} />
                              </ThemeIcon>
                              <Text size="sm" c="dimmed">
                                {formatRoomCount(property.bathrooms)} {getRoomLabel(property.bathrooms || 0, 'bathroom')}
                              </Text>
                            </Group>
                          )}
                        </Group>
                      )}

                      {/* Заполненность */}
                      <Paper
                        p="sm"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handleShowCompleteness(property)}
                      >
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Group gap="xs">
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                variant="light"
                                color={getCompletenessColor(property.completeness)}
                              >
                                {property.completeness === 100 ? (
                                  <IconCheck size={12} />
                                ) : (
                                  <IconChartBar size={12} />
                                )}
                              </ThemeIcon>
                              <Text size="xs" fw={500}>
                                {t('ownerPortal.completeness')}
                              </Text>
                            </Group>
                            <Group gap={4}>
                              <Text size="xs" fw={700}>
                                {property.completeness}%
                              </Text>
                              <ActionIcon size="xs" variant="subtle" color="gray">
                                <IconInfoCircle size={12} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          <Progress
                            value={property.completeness}
                            color={getCompletenessColor(property.completeness)}
                            size="sm"
                            radius="xl"
                          />
                        </Stack>
                      </Paper>

                      {/* Информация о занятости */}
                      {renderOccupancyInfo(property)}

                      <Divider />

                      {/* Кнопки действий */}
                      <Stack gap="xs">
                        <Button
                          variant="light"
                          color="blue"
                          fullWidth
                          leftSection={<IconExternalLink size={18} />}
                          onClick={() => handleViewOnSite(property.id)}
                          loading={loadingPreview === property.id}
                          styles={{
                            root: {
                              transition: 'all 0.2s',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                              }
                            }
                          }}
                        >
                          {t('ownerPortal.viewOnSite')}
                        </Button>

                        <Group grow>
                          <Button
                            variant="gradient"
                            gradient={{ from: 'teal', to: 'green' }}
                            leftSection={<IconCurrencyDollar size={18} />}
                            onClick={() => handleManageProperty(property.id, 'pricing')}
                          >
                            {t('ownerPortal.pricing')}
                          </Button>

                          <Button
                            variant="light"
                            color="blue"
                            leftSection={<IconCalendar size={18} />}
                            onClick={() => handleManageProperty(property.id, 'calendar')}
                          >
                            {t('ownerPortal.calendar')}
                          </Button>
                        </Group>
                      </Stack>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>

      {/* Password Change Modal */}
      <Modal
        opened={changePasswordModalOpened}
        onClose={() => {
          closePasswordModal();
          passwordForm.reset();
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
              <IconLock size={20} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600}>{t('ownerPortal.changePassword')}</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'md'}
        centered
      >
        <form onSubmit={passwordForm.onSubmit(handleChangePassword)}>
          <Stack gap="md">
            <Alert icon={<IconShieldCheck size={18} />} color="blue" variant="light">
              <Text size="sm">{t('ownerPortal.passwordChangeInfo')}</Text>
            </Alert>

            <PasswordInput
              label={t('ownerPortal.currentPassword')}
              placeholder={t('ownerPortal.enterCurrentPassword')}
              leftSection={
                <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
                  <IconLock size={14} />
                </ThemeIcon>
              }
              styles={{ input: { fontSize: '16px' } }}
              {...passwordForm.getInputProps('current_password')}
            />

            <PasswordInput
              label={t('ownerPortal.newPassword')}
              placeholder={t('ownerPortal.enterNewPassword')}
              leftSection={
                <ThemeIcon size="sm" variant="light" color="violet" radius="xl">
                  <IconLock size={14} />
                </ThemeIcon>
              }
              styles={{ input: { fontSize: '16px' } }}
              {...passwordForm.getInputProps('new_password')}
            />

            <PasswordInput
              label={t('ownerPortal.confirmPassword')}
              placeholder={t('ownerPortal.confirmNewPassword')}
              leftSection={
                <ThemeIcon size="sm" variant="light" color="violet" radius="xl">
                  <IconLock size={14} />
                </ThemeIcon>
              }
              styles={{ input: { fontSize: '16px' } }}
              {...passwordForm.getInputProps('confirm_password')}
            />

            <Divider />

            <Group justify="flex-end" gap="sm">
              <Button
                variant="subtle"
                onClick={() => {
                  closePasswordModal();
                  passwordForm.reset();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="gradient"
                gradient={{ from: 'violet', to: 'grape' }}
                loading={changingPassword}
                leftSection={<IconCheck size={18} />}
              >
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Completeness Modal */}
      <Modal
        opened={completenessModalOpened}
        onClose={closeCompletenessModal}
        title={
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: 'orange', to: 'yellow' }}
            >
              <IconChartBar size={20} stroke={1.5} />
            </ThemeIcon>
            <div>
              <Text fw={600}>{t('ownerPortal.propertyCompleteness')}</Text>
              {selectedProperty && (
                <Text size="xs" c="dimmed">
                  {selectedProperty.property_name || selectedProperty.property_number}
                </Text>
              )}
            </div>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        {selectedProperty && (
          <Stack gap="lg">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon
                      size="xl"
                      radius="md"
                      variant="light"
                      color={selectedProperty.completeness === 100 ? 'teal' : 'yellow'}
                    >
                      <IconChartBar size={24} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{t('ownerPortal.overallCompleteness')}</Text>
                      <Text size="xs" c="dimmed">
                        {selectedProperty.completeness === 100
                          ? t('ownerPortal.allFieldsComplete')
                          : t('ownerPortal.someFieldsMissing')}
                      </Text>
                    </div>
                  </Group>
                  <Badge
                    size="xl"
                    variant="gradient"
                    gradient={
                      selectedProperty.completeness === 100
                        ? { from: 'teal', to: 'green' }
                        : { from: 'yellow', to: 'orange' }
                    }
                  >
                    {selectedProperty.completeness}%
                  </Badge>
                </Group>
                <Progress
                  value={selectedProperty.completeness}
                  size="xl"
                  radius="xl"
                  color={selectedProperty.completeness === 100 ? 'teal' : 'yellow'}
                  striped={selectedProperty.completeness < 100}
                  animated={selectedProperty.completeness < 100}
                />
              </Stack>
            </Card>

            {selectedProperty.completeness === 100 ? (
              <Alert icon={<IconCheck size={20} />} color="teal" variant="light">
                <Stack gap="xs">
                  <Text fw={600}>{t('ownerPortal.allFieldsFilled')}</Text>
                  <Text size="sm">{t('ownerPortal.allFieldsFilledDescription')}</Text>
                </Stack>
              </Alert>
            ) : (
              <Tabs defaultValue="missing" variant="pills">
                <Tabs.List grow>
                  <Tabs.Tab
                    value="missing"
                    leftSection={<IconExclamationCircle size={16} />}
                    color="yellow"
                  >
                    {t('ownerPortal.missingFields')}
                    {selectedProperty.completeness_details?.missing && (
                      <Badge size="sm" variant="filled" color="yellow" ml={8}>
                        {selectedProperty.completeness_details.missing.length}
                      </Badge>
                    )}
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="filled"
                    leftSection={<IconCheck size={16} />}
                    color="teal"
                  >
                    {t('ownerPortal.filledFields')}
                    {selectedProperty.completeness_details?.filled && (
                      <Badge size="sm" variant="filled" color="teal" ml={8}>
                        {selectedProperty.completeness_details.filled.length}
                      </Badge>
                    )}
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="missing" pt="md">
                  {selectedProperty.completeness_details?.missing &&
                  selectedProperty.completeness_details.missing.length > 0 ? (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Timeline active={-1} bulletSize={24} lineWidth={2} color="yellow">
                        {selectedProperty.completeness_details.missing.map((item: any, index: number) => {
                          const isMonthlyPrices = item.field_key === 'monthly_prices';
                          return (
                            <Timeline.Item
                              key={index}
                              bullet={<IconExclamationCircle size={12} />}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm" fw={500} style={{ flex: 1 }}>
                                  {item.name}
                                </Text>
                                {isMonthlyPrices && (
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => handleShowMonthlyPrices(selectedProperty)}
                                  >
                                    {t('ownerPortal.details')}
                                  </Button>
                                )}
                              </Group>
                            </Timeline.Item>
                          );
                        })}
                      </Timeline>
                    </Card>
                  ) : (
                    <Center py="md">
                      <Text size="sm" c="dimmed">
                        {t('ownerPortal.noMissingFields')}
                      </Text>
                    </Center>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="filled" pt="md">
                  {selectedProperty.completeness_details?.filled &&
                  selectedProperty.completeness_details.filled.length > 0 ? (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Timeline active={selectedProperty.completeness_details.filled.length} bulletSize={24} lineWidth={2} color="teal">
                        {selectedProperty.completeness_details.filled.map((item: any, index: number) => {
                          const isMonthlyPrices = item.field_key === 'monthly_prices';
                          return (
                            <Timeline.Item key={index} bullet={<IconCircleCheck size={12} />}>
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm" fw={500} style={{ flex: 1 }}>
                                  {item.name}
                                </Text>
                                {isMonthlyPrices && (
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => handleShowMonthlyPrices(selectedProperty)}
                                  >
                                    {t('ownerPortal.details')}
                                  </Button>
                                )}
                              </Group>
                            </Timeline.Item>
                          );
                        })}
                      </Timeline>
                    </Card>
                  ) : (
                    <Center py="md">
                      <Text size="sm" c="dimmed">
                        {t('ownerPortal.noFilledFields')}
                      </Text>
                    </Center>
                  )}
                </Tabs.Panel>
              </Tabs>
            )}

            <Group justify="space-between">
              <Button
                variant="subtle"
                onClick={closeCompletenessModal}
              >
                {t('common.close')}
              </Button>
              {selectedProperty.completeness < 100 && (
                <Button
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'grape' }}
                  leftSection={<IconSparkles size={18} />}
                  onClick={() => {
                    closeCompletenessModal();
                    handleManageProperty(selectedProperty.id, 'pricing');
                  }}
                >
                  {t('ownerPortal.fillData')}
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Monthly Prices Details Modal */}
      <Modal
        opened={monthlyPricesModalOpened}
        onClose={closeMonthlyPricesModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconCalendar size={20} stroke={1.5} />
            </ThemeIcon>
            <div>
              <Text fw={600}>{t('ownerPortal.monthlyPricesDetails')}</Text>
              {selectedProperty && (
                <Text size="xs" c="dimmed">
                  {selectedProperty.property_name || selectedProperty.property_number}
                </Text>
              )}
            </div>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        {selectedProperty?.completeness_details?.monthly_prices && (
          <Stack gap="lg">
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Text size="sm">
                {t('ownerPortal.monthlyPricesDescription')}
              </Text>
            </Alert>

            <ScrollArea>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('ownerPortal.month')}</Table.Th>
                    <Table.Th>{t('ownerPortal.sourcePrice')}</Table.Th>
                    <Table.Th>{t('ownerPortal.status')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedProperty.completeness_details.monthly_prices.map((monthData: MonthlyPriceDetail) => (
                    <Table.Tr key={monthData.month}>
                      <Table.Td>
                        <Text fw={500}>{getMonthName(monthData.month)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c={monthData.is_filled ? 'teal' : 'dimmed'}>
                          {formatPrice(monthData.source_price)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {monthData.is_filled ? (
                          <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                            {t('ownerPortal.filled')}
                          </Badge>
                        ) : (
                          <Badge color="yellow" variant="light" leftSection={<IconAlertCircle size={12} />}>
                            {t('ownerPortal.notFilled')}
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            <Button
              variant="subtle"
              onClick={closeMonthlyPricesModal}
              fullWidth
            >
              {t('common.close')}
            </Button>
          </Stack>
        )}
      </Modal>
    </Box>
  );
};

export default OwnerDashboard;