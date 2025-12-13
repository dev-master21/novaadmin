// frontend/src/modules/FinancialDocuments/ReservationConfirmationDetail.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Badge,
  Stack,
  Group,
  Text,
  Title,
  Grid,
  Paper,
  Center,
  Loader,
  Divider,
  Box,
  ThemeIcon,
  useMantineTheme,
  useMantineColorScheme,
  SimpleGrid,
  Table,
  alpha
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconTrash,
  IconDownload,
  IconFileText,
  IconEdit,
  IconLink,
  IconCheck,
  IconX,
  IconCalendar,
  IconUser,
  IconHome,
  IconPhone,
  IconMail,
  IconBuilding,
  IconUsers,
  IconPlane,
  IconCar,
  IconClock,
  IconAlertCircle,
  IconBed,
  IconCurrencyBaht,
  IconBolt,
  IconDroplet,
  IconCalendarEvent,
  IconMapPin,
  IconNote,
  IconMessageCircle
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, ReservationConfirmation } from '@/api/financialDocuments.api';
import CreateReservationConfirmationModal from './components/CreateReservationConfirmationModal';
import dayjs from 'dayjs';

const ReservationConfirmationDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [confirmation, setConfirmation] = useState<ReservationConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchConfirmation();
    }
  }, [id]);

  const fetchConfirmation = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getReservationConfirmationById(Number(id));
      setConfirmation(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('confirmationDetail.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/financial-documents?tab=confirmations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('confirmationDetail.confirm.deleteTitle'),
      children: (
        <Text size="sm">
          {t('confirmationDetail.confirm.deleteDescription')}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await financialDocumentsApi.deleteReservationConfirmation(Number(id));
          notifications.show({
            title: t('common.success'),
            message: t('confirmationDetail.messages.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          navigate('/financial-documents?tab=confirmations');
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: t('confirmationDetail.messages.deleteError'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  const handleCopyLink = async () => {
    if (!confirmation?.confirmation_number) {
      notifications.show({
        title: t('errors.generic'),
        message: t('confirmationDetail.messages.numberNotFound'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }
    
    const link = `https://admin.novaestate.company/confirmation-verify/${confirmation.confirmation_number}`;
    try {
      await navigator.clipboard.writeText(link);
      notifications.show({
        title: t('common.success'),
        message: t('confirmationDetail.messages.linkCopied'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error) {
      notifications.show({
        title: t('errors.generic'),
        message: t('confirmationDetail.messages.linkCopyError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleDownloadPDF = async () => {
    try {
      notifications.show({
        id: 'pdf-download',
        loading: true,
        title: t('confirmationDetail.messages.generatingPDF'),
        message: t('common.pleaseWait'),
        autoClose: false,
        withCloseButton: false
      });

      const response = await financialDocumentsApi.downloadReservationConfirmationPDF(Number(id));
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${confirmation?.confirmation_number || 'confirmation'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.update({
        id: 'pdf-download',
        color: 'green',
        title: t('common.success'),
        message: t('confirmationDetail.messages.pdfDownloaded'),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });
    } catch (error: any) {
      notifications.update({
        id: 'pdf-download',
        color: 'red',
        title: t('errors.generic'),
        message: t('confirmationDetail.messages.pdfDownloadError'),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '—';
    return dayjs(date).format('DD.MM.YYYY');
  };

  const calculateNights = () => {
    if (confirmation?.arrival_date && confirmation?.departure_date) {
      return dayjs(confirmation.departure_date).diff(dayjs(confirmation.arrival_date), 'day');
    }
    return 0;
  };

  // Функции для получения адаптивных цветов - мягкие оттенки для тёмной темы
  const getTransferBgColor = (isActive: boolean) => {
    if (isActive) {
      // Для активного: мягкий зелёный
      return isDark 
        ? alpha(theme.colors.green[8], 0.15) 
        : theme.colors.green[0];
    }
    // Для неактивного: нейтральный серый
    return isDark 
      ? alpha(theme.colors.gray[6], 0.1) 
      : theme.colors.gray[0];
  };

  const getTransferBorderColor = (isActive: boolean) => {
    if (isActive) {
      return isDark ? theme.colors.green[7] : theme.colors.green[3];
    }
    return isDark ? theme.colors.dark[4] : theme.colors.gray[3];
  };

  const getNoticeBgColor = () => {
    // Мягкий жёлтый/янтарный для тёмной темы
    return isDark 
      ? alpha(theme.colors.yellow[8], 0.12) 
      : theme.colors.yellow[0];
  };

  const getNoticeBorderColor = () => {
    return isDark ? theme.colors.yellow[6] : theme.colors.yellow[4];
  };

  const getNoticeTextColor = () => {
    return isDark ? theme.colors.yellow[3] : theme.colors.dark[9];
  };

  const getCancellationBgColor = () => {
    // Мягкий красный для тёмной темы
    return isDark 
      ? alpha(theme.colors.red[8], 0.12) 
      : theme.colors.red[0];
  };

  const getCancellationBorderColor = () => {
    return isDark ? theme.colors.red[6] : theme.colors.red[4];
  };

  const getCancellationTextColor = () => {
    return isDark ? theme.colors.red[4] : theme.colors.red[8];
  };

  if (loading) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            {t('confirmationDetail.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!confirmation) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={80} radius="xl" variant="light" color="red">
            <IconCalendarEvent size={40} />
          </ThemeIcon>
          <Text size="lg" fw={600}>
            {t('confirmationDetail.notFound')}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => navigate('/financial-documents?tab=confirmations')}
          >
            {t('confirmationDetail.buttons.backToList')}
          </Button>
        </Stack>
      </Center>
    );
  }

  const InfoItem = ({ 
    icon, 
    label, 
    value, 
    color = 'gray' 
  }: { 
    icon: React.ReactNode; 
    label: string; 
    value: React.ReactNode; 
    color?: string;
  }) => (
    <Paper p="md" radius="md" withBorder>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size="lg" radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Box style={{ flex: 1 }}>
          <Text size="xs" c="dimmed" mb={4}>
            {label}
          </Text>
          <Text size="sm" fw={500}>
            {value}
          </Text>
        </Box>
      </Group>
    </Paper>
  );

  return (
    <Stack gap="lg" p={isMobile ? 'sm' : 'md'}>
      {/* Кнопка назад для мобильных */}
      {isMobile && (
        <Button
          variant="light"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => navigate('/financial-documents?tab=confirmations')}
          fullWidth
        >
          {t('confirmationDetail.buttons.backToList')}
        </Button>
      )}

      {/* Заголовок и действия */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          {/* Заголовок */}
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon 
                size="xl" 
                radius="md" 
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
              >
                <IconCalendarEvent size={24} />
              </ThemeIcon>
              <Box>
                <Group gap="xs">
                  <Title order={isMobile ? 4 : 3}>
                    {confirmation.confirmation_number}
                  </Title>
                  <Badge size="lg" color="green" variant="light" leftSection={<IconCheck size={14} />}>
                    Success
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {t('confirmationDetail.title')}
                </Text>
              </Box>
            </Group>

            {!isMobile && (
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => navigate('/financial-documents?tab=confirmations')}
              >
                {t('confirmationDetail.buttons.back')}
              </Button>
            )}
          </Group>

          <Divider />

          {/* Кнопки действий */}
          <Group gap="xs" wrap="wrap">
            <Button
              variant="light"
              leftSection={<IconEdit size={18} />}
              onClick={() => setEditModalVisible(true)}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('confirmationDetail.buttons.edit')}
            </Button>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconLink size={18} />}
              onClick={handleCopyLink}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('confirmationDetail.buttons.copyLink')}
            </Button>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={18} />}
              onClick={handleDownloadPDF}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('confirmationDetail.buttons.downloadPDF')}
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={18} />}
              onClick={handleDelete}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Даты бронирования */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
              background: `linear-gradient(135deg, ${theme.colors.blue[9]} 0%, ${theme.colors.cyan[9]} 100%)`,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.blue[9]}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon size="md" radius="md" variant="white" color="blue">
                  <IconCalendar size={20} />
                </ThemeIcon>
                <Text size="sm" c="white" opacity={0.9}>
                  {t('confirmationDetail.fields.arrival')}
                </Text>
              </Group>
              <Text size="xl" fw={700} c="white" style={{ lineHeight: 1.2 }}>
                {formatDate(confirmation.arrival_date)}
              </Text>
              {confirmation.arrival_time && (
                <Text size="sm" c="white" opacity={0.8}>
                  {confirmation.arrival_time}
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
              background: `linear-gradient(135deg, ${theme.colors.orange[9]} 0%, ${theme.colors.red[9]} 100%)`,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.orange[9]}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon size="md" radius="md" variant="white" color="orange">
                  <IconCalendar size={20} />
                </ThemeIcon>
                <Text size="sm" c="white" opacity={0.9}>
                  {t('confirmationDetail.fields.departure')}
                </Text>
              </Group>
              <Text size="xl" fw={700} c="white" style={{ lineHeight: 1.2 }}>
                {formatDate(confirmation.departure_date)}
              </Text>
              {confirmation.departure_time && (
                <Text size="sm" c="white" opacity={0.8}>
                  {confirmation.departure_time}
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
              background: `linear-gradient(135deg, ${theme.colors.green[9]} 0%, ${theme.colors.teal[9]} 100%)`,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.green[9]}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon size="md" radius="md" variant="white" color="green">
                  <IconClock size={20} />
                </ThemeIcon>
                <Text size="sm" c="white" opacity={0.9}>
                  {t('confirmationDetail.fields.nights')}
                </Text>
              </Group>
              <Text size="2rem" fw={700} c="white" style={{ lineHeight: 1 }}>
                {calculateNights()}
              </Text>
              <Text size="sm" c="white" opacity={0.8}>
                {t('confirmationDetail.nightsLabel')}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Информация об объекте */}
      {(confirmation.property_name || confirmation.property_address) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconHome size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.property')}</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {confirmation.property_name && (
                <InfoItem
                  icon={<IconHome size={20} />}
                  label={t('confirmationDetail.fields.propertyName')}
                  value={confirmation.property_name}
                  color="green"
                />
              )}

              {confirmation.property_address && (
                <InfoItem
                  icon={<IconMapPin size={20} />}
                  label={t('confirmationDetail.fields.propertyAddress')}
                  value={confirmation.property_address}
                  color="teal"
                />
              )}

              {confirmation.room_type && (
                <InfoItem
                  icon={<IconBed size={20} />}
                  label={t('confirmationDetail.fields.roomType')}
                  value={confirmation.room_type}
                  color="blue"
                />
              )}

              {confirmation.num_rooms && (
                <InfoItem
                  icon={<IconBed size={20} />}
                  label={t('confirmationDetail.fields.numRooms')}
                  value={confirmation.num_rooms}
                  color="cyan"
                />
              )}

              {confirmation.num_guests && (
                <InfoItem
                  icon={<IconUsers size={20} />}
                  label={t('confirmationDetail.fields.numGuests')}
                  value={confirmation.num_guests}
                  color="violet"
                />
              )}

              {confirmation.rate_amount && (
                <InfoItem
                  icon={<IconCurrencyBaht size={20} />}
                  label={t('confirmationDetail.fields.rate')}
                  value={`${formatCurrency(confirmation.rate_amount)} THB / ${confirmation.rate_type === 'daily' ? t('confirmationDetail.rateTypes.day') : t('confirmationDetail.rateTypes.month')}`}
                  color="orange"
                />
              )}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* Информация о контакте */}
      {(confirmation.from_company_name || confirmation.from_telephone || confirmation.from_email) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconBuilding size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.contact')}</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {confirmation.from_company_name && (
                <InfoItem
                  icon={<IconBuilding size={20} />}
                  label={t('confirmationDetail.fields.companyName')}
                  value={confirmation.from_company_name}
                  color="blue"
                />
              )}

              {confirmation.from_telephone && (
                <InfoItem
                  icon={<IconPhone size={20} />}
                  label={t('confirmationDetail.fields.telephone')}
                  value={confirmation.from_telephone}
                  color="green"
                />
              )}

              {confirmation.from_email && (
                <InfoItem
                  icon={<IconMail size={20} />}
                  label={t('confirmationDetail.fields.email')}
                  value={confirmation.from_email}
                  color="violet"
                />
              )}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* Check-in / Check-out времена и тарифы */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="orange">
              <IconClock size={20} />
            </ThemeIcon>
            <Title order={4}>{t('confirmationDetail.sections.timesAndRates')}</Title>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <InfoItem
              icon={<IconClock size={20} />}
              label={t('confirmationDetail.fields.checkIn')}
              value={confirmation.check_in_time || '14:00'}
              color="green"
            />

            <InfoItem
              icon={<IconClock size={20} />}
              label={t('confirmationDetail.fields.checkOut')}
              value={confirmation.check_out_time || '12:00'}
              color="orange"
            />

            {confirmation.electricity_rate ? (
              <InfoItem
                icon={<IconBolt size={20} />}
                label={t('confirmationDetail.fields.electricityRate')}
                value={`${confirmation.electricity_rate} THB/unit`}
                color="yellow"
              />
            ) : null}

            {confirmation.water_rate ? (
              <InfoItem
                icon={<IconDroplet size={20} />}
                label={t('confirmationDetail.fields.waterRate')}
                value={`${confirmation.water_rate} THB/unit`}
                color="blue"
              />
            ) : null}
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Гости */}
      {confirmation.guests && confirmation.guests.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                <IconUsers size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.guests')}</Title>
              <Badge size="sm" variant="light" color="violet">
                {confirmation.guests.length}
              </Badge>
            </Group>

            {isMobile ? (
              <Stack gap="sm">
                {confirmation.guests.map((guest, index) => (
                  <Paper
                    key={guest.id || index}
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      borderLeft: `4px solid ${theme.colors.violet[6]}`
                    }}
                  >
                    <Stack gap="xs">
                      <Group gap="xs">
                        <ThemeIcon size="sm" radius="md" variant="light" color="violet">
                          <IconUser size={14} />
                        </ThemeIcon>
                        <Text fw={600} size="sm">
                          {guest.guest_name}
                        </Text>
                        {index === 0 && (
                          <Badge size="xs" color="green" variant="light">
                            {t('confirmationDetail.guest.primary')}
                          </Badge>
                        )}
                      </Group>
                      
                      {guest.passport_number && (
                        <Text size="xs" c="dimmed">
                          {t('confirmationDetail.fields.passport')}: {guest.passport_number}
                        </Text>
                      )}
                      {guest.passport_country && (
                        <Text size="xs" c="dimmed">
                          {t('confirmationDetail.fields.country')}: {guest.passport_country}
                        </Text>
                      )}
                      {guest.phone && (
                        <Group gap={4}>
                          <IconPhone size={12} color={theme.colors.gray[6]} />
                          <Text size="xs">{guest.phone}</Text>
                        </Group>
                      )}
                      {guest.email && (
                        <Group gap={4}>
                          <IconMail size={12} color={theme.colors.gray[6]} />
                          <Text size="xs">{guest.email}</Text>
                        </Group>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={600}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>#</Table.Th>
                      <Table.Th>{t('confirmationDetail.table.guestName')}</Table.Th>
                      <Table.Th>{t('confirmationDetail.table.passport')}</Table.Th>
                      <Table.Th>{t('confirmationDetail.table.country')}</Table.Th>
                      <Table.Th>{t('confirmationDetail.table.phone')}</Table.Th>
                      <Table.Th>{t('confirmationDetail.table.email')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {confirmation.guests.map((guest, index) => (
                      <Table.Tr key={guest.id || index}>
                        <Table.Td>{index + 1}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={500}>{guest.guest_name}</Text>
                            {index === 0 && (
                              <Badge size="xs" color="green" variant="light">
                                {t('confirmationDetail.guest.primary')}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>{guest.passport_number || '—'}</Table.Td>
                        <Table.Td>{guest.passport_country || '—'}</Table.Td>
                        <Table.Td>{guest.phone || '—'}</Table.Td>
                        <Table.Td>{guest.email || '—'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Card>
      )}

      {/* Трансфер */}
      {(confirmation.pick_up_service || confirmation.drop_off_service) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="orange">
                <IconCar size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.transfer')}</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper
                p="md"
                radius="md"
                withBorder
                style={{
                  backgroundColor: getTransferBgColor(confirmation.pick_up_service),
                  borderColor: getTransferBorderColor(confirmation.pick_up_service)
                }}
              >
                <Group gap="sm">
                  <ThemeIcon 
                    size="lg" 
                    radius="md" 
                    variant="light" 
                    color={confirmation.pick_up_service ? 'green' : 'gray'}
                  >
                    {confirmation.pick_up_service ? <IconCheck size={20} /> : <IconX size={20} />}
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>
                      {t('confirmationDetail.fields.pickUp')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {confirmation.pick_up_service 
                        ? t('confirmationDetail.services.included') 
                        : t('confirmationDetail.services.notIncluded')}
                    </Text>
                    {confirmation.pick_up_service && confirmation.arrival_flight && (
                      <Group gap={4} mt={4}>
                        <IconPlane size={14} color={theme.colors.blue[isDark ? 4 : 6]} />
                        <Text size="xs" c={isDark ? 'blue.4' : 'blue.6'}>
                          {t('confirmationDetail.fields.flight')}: {confirmation.arrival_flight}
                        </Text>
                      </Group>
                    )}
                  </Box>
                </Group>
              </Paper>

              <Paper
                p="md"
                radius="md"
                withBorder
                style={{
                  backgroundColor: getTransferBgColor(confirmation.drop_off_service),
                  borderColor: getTransferBorderColor(confirmation.drop_off_service)
                }}
              >
                <Group gap="sm">
                  <ThemeIcon 
                    size="lg" 
                    radius="md" 
                    variant="light" 
                    color={confirmation.drop_off_service ? 'green' : 'gray'}
                  >
                    {confirmation.drop_off_service ? <IconCheck size={20} /> : <IconX size={20} />}
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>
                      {t('confirmationDetail.fields.dropOff')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {confirmation.drop_off_service 
                        ? t('confirmationDetail.services.included') 
                        : t('confirmationDetail.services.notIncluded')}
                    </Text>
                    {confirmation.drop_off_service && confirmation.departure_flight && (
                      <Group gap={4} mt={4}>
                        <IconPlane size={14} color={theme.colors.blue[isDark ? 4 : 6]} />
                        <Text size="xs" c={isDark ? 'blue.4' : 'blue.6'}>
                          {t('confirmationDetail.fields.flight')}: {confirmation.departure_flight}
                        </Text>
                      </Group>
                    )}
                  </Box>
                </Group>
              </Paper>
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* Notice */}
      {confirmation.notice_content && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.notice')}</Title>
            </Group>

            <Paper 
              p="md" 
              radius="md" 
              withBorder
              style={{ 
                backgroundColor: getNoticeBgColor(),
                borderColor: getNoticeBorderColor()
              }}
            >
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', color: getNoticeTextColor() }}>
                {confirmation.notice_content}
              </Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* Cancellation Policy */}
      {confirmation.cancellation_policy && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="red">
                <IconX size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.cancellationPolicy')}</Title>
            </Group>

            <Paper 
              p="md" 
              radius="md" 
              withBorder
              style={{ 
                backgroundColor: getCancellationBgColor(),
                borderColor: getCancellationBorderColor()
              }}
            >
              <Text size="sm" style={{ color: getCancellationTextColor() }}>
                {confirmation.cancellation_policy}
              </Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* Welcome Message */}
      {confirmation.welcome_message && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="pink">
                <IconMessageCircle size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.welcomeMessage')}</Title>
            </Group>

            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fs="italic">
                {confirmation.welcome_message}
              </Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* Remarks */}
      {confirmation.remarks && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                <IconNote size={20} />
              </ThemeIcon>
              <Title order={4}>{t('confirmationDetail.sections.remarks')}</Title>
            </Group>

            <Paper p="md" radius="md" withBorder>
              <Text size="sm">{confirmation.remarks}</Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* Метаинформация */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="gray">
              <IconFileText size={20} />
            </ThemeIcon>
            <Title order={4}>{t('confirmationDetail.sections.meta')}</Title>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <InfoItem
              icon={<IconCalendar size={20} />}
              label={t('confirmationDetail.fields.confirmationDate')}
              value={formatDate(confirmation.confirmation_date)}
              color="blue"
            />

            <InfoItem
              icon={<IconUser size={20} />}
              label={t('confirmationDetail.fields.createdBy')}
              value={confirmation.created_by_name || '—'}
              color="gray"
            />

            <InfoItem
              icon={<IconCalendar size={20} />}
              label={t('confirmationDetail.fields.createdAt')}
              value={dayjs(confirmation.created_at).format('DD.MM.YYYY HH:mm')}
              color="gray"
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Модальное окно редактирования */}
      <CreateReservationConfirmationModal
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchConfirmation();
        }}
        mode="edit"
        confirmationId={confirmation.id}
      />
    </Stack>
  );
};

export default ReservationConfirmationDetail;