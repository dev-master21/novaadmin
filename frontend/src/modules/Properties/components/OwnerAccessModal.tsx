// frontend/src/modules/Properties/components/OwnerAccessModal.tsx
import { useState, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Stack, 
  Group, 
  Text, 
  TextInput, 
  Alert,
  Loader,
  Center,
  ThemeIcon,
  ActionIcon,
  Paper,
  Badge,
  Card,
  CopyButton,
  Tooltip,
  Divider,
  Timeline,
  Checkbox,
  Switch
} from '@mantine/core';
import { 
  IconCopy, 
  IconCheck, 
  IconInfoCircle, 
  IconKey,
  IconLink,
  IconShieldCheck,
  IconAlertTriangle,
  IconUserPlus,
  IconClock,
  IconExternalLink,
  IconLock,
  IconCalendar,
  IconCurrencyDollar,
  IconDeviceFloppy
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { propertyOwnersApi } from '@/api/propertyOwners.api';
import { useMediaQuery } from '@mantine/hooks';

interface OwnerAccessModalProps {
  visible: boolean;
  onClose: () => void;
  ownerName: string;
}

const OwnerAccessModal = ({ visible, onClose, ownerName }: OwnerAccessModalProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Разрешения
  const [canEditCalendar, setCanEditCalendar] = useState(true);
  const [canEditPricing, setCanEditPricing] = useState(true);
  
  // Данные доступа
  const [accessData, setAccessData] = useState<{
    access_url: string;
    password: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    can_edit_calendar: boolean;
    can_edit_pricing: boolean;
  } | null>(null);

  useEffect(() => {
    if (visible && ownerName) {
      checkExistingAccess();
    }
  }, [visible, ownerName]);

  const checkExistingAccess = async () => {
    setChecking(true);
    try {
      const { data } = await propertyOwnersApi.getOwnerInfo(ownerName);
      if (data.success) {
        setAccessData(data.data);
        setCanEditCalendar(data.data.can_edit_calendar);
        setCanEditPricing(data.data.can_edit_pricing);
        setShowDisclaimer(false);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error checking access:', error);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCreateAccess = async () => {
    setLoading(true);
    try {
      const { data } = await propertyOwnersApi.createOwnerAccess({ 
        owner_name: ownerName,
        can_edit_calendar: canEditCalendar,
        can_edit_pricing: canEditPricing
      });
      
      if (data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('properties.ownerAccess.created'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        
        setAccessData({
          access_url: data.data.access_url,
          password: data.data.password,
          is_active: true,
          last_login_at: null,
          created_at: new Date().toISOString(),
          can_edit_calendar: data.data.can_edit_calendar,
          can_edit_pricing: data.data.can_edit_pricing
        });
        setShowDisclaimer(false);
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('properties.ownerAccess.createError'),
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!accessData) return;
    
    setSavingPermissions(true);
    try {
      const { data } = await propertyOwnersApi.updateOwnerPermissions(ownerName, {
        can_edit_calendar: canEditCalendar,
        can_edit_pricing: canEditPricing
      });
      
      if (data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('properties.ownerAccess.permissionsUpdated'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        
        // Обновляем локальные данные
        setAccessData({
          ...accessData,
          can_edit_calendar: canEditCalendar,
          can_edit_pricing: canEditPricing
        });
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('properties.ownerAccess.permissionsUpdateError'),
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleClose = () => {
    setShowDisclaimer(true);
    setAccessData(null);
    setCanEditCalendar(true);
    setCanEditPricing(true);
    onClose();
  };

  // Проверка изменений в разрешениях
  const hasPermissionsChanged = accessData && (
    canEditCalendar !== accessData.can_edit_calendar || 
    canEditPricing !== accessData.can_edit_pricing
  );

  // Экран загрузки
  if (checking) {
    return (
      <Modal
        opened={visible}
        onClose={handleClose}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
              <IconKey size={20} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600}>{t('properties.ownerAccess.title')}</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Center p="xl">
          <Stack align="center" gap="md">
            <Loader size="xl" variant="dots" />
            <Text c="dimmed">{t('common.loading')}</Text>
          </Stack>
        </Center>
      </Modal>
    );
  }

  // Экран Disclaimer для первого создания
  if (showDisclaimer && !accessData) {
    return (
      <Modal
        opened={visible}
        onClose={handleClose}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
              <IconAlertTriangle size={20} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600}>{t('properties.ownerAccess.title')}</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Stack gap="lg">
          {/* Заголовок с именем владельца */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm">
              <ThemeIcon size="xl" radius="md" variant="light" color="blue">
                <IconUserPlus size={24} stroke={1.5} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">{t('properties.ownerAccess.creatingAccessFor')}</Text>
                <Text fw={600} size="lg">{ownerName}</Text>
              </div>
            </Group>
          </Card>

          {/* Разрешения при создании */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                  <IconShieldCheck size={20} stroke={1.5} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">{t('properties.ownerAccess.permissions')}</Text>
                  <Text size="xs" c="dimmed">{t('properties.ownerAccess.permissionsDescription')}</Text>
                </div>
              </Group>

              <Divider />

              <Stack gap="sm">
                <Checkbox
                  checked={canEditCalendar}
                  onChange={(event) => setCanEditCalendar(event.currentTarget.checked)}
                  label={
                    <Group gap="xs">
                      <IconCalendar size={16} stroke={1.5} />
                      <Text size="sm">{t('properties.ownerAccess.canEditCalendar')}</Text>
                    </Group>
                  }
                  description={t('properties.ownerAccess.canEditCalendarDescription')}
                />

                <Checkbox
                  checked={canEditPricing}
                  onChange={(event) => setCanEditPricing(event.currentTarget.checked)}
                  label={
                    <Group gap="xs">
                      <IconCurrencyDollar size={16} stroke={1.5} />
                      <Text size="sm">{t('properties.ownerAccess.canEditPricing')}</Text>
                    </Group>
                  }
                  description={t('properties.ownerAccess.canEditPricingDescription')}
                />
              </Stack>

              {!canEditCalendar && !canEditPricing && (
                <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                  <Text size="xs">
                    {t('properties.ownerAccess.readOnlyWarning')}
                  </Text>
                </Alert>
              )}
            </Stack>
          </Card>

          {/* Warning Alert */}
          <Alert
            icon={<IconAlertTriangle size={20} />}
            title={<Text fw={600}>{t('properties.ownerAccess.disclaimerTitle')}</Text>}
            color="orange"
            variant="light"
            styles={{
              message: { marginTop: 8 }
            }}
          >
            <Stack gap="md">
              <Text size="sm">
                {t('properties.ownerAccess.disclaimerText', { ownerName })}
              </Text>

              <Divider />

              <Timeline active={3} bulletSize={24} lineWidth={2} color="orange">
                <Timeline.Item
                  bullet={<IconLink size={12} />}
                  title={<Text size="sm" fw={500}>Уникальная ссылка</Text>}
                >
                  <Text size="xs" c="dimmed">
                    Будет создана персональная ссылка для доступа владельца
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconLock size={12} />}
                  title={<Text size="sm" fw={500}>Безопасный пароль</Text>}
                >
                  <Text size="xs" c="dimmed">
                    Одноразовый пароль для первого входа
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={<IconShieldCheck size={12} />}
                  title={<Text size="sm" fw={500}>Настраиваемый доступ</Text>}
                >
                  <Text size="xs" c="dimmed">
                    Владелец получит доступ согласно выбранным разрешениям
                  </Text>
                </Timeline.Item>
              </Timeline>

              <Paper p="md" radius="md" withBorder style={{ background: 'var(--mantine-color-red-0)' }}>
                <Group gap="xs">
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                  <Text size="xs" fw={600} c="red">
                    {t('properties.ownerAccess.disclaimerWarning')}
                  </Text>
                </Group>
              </Paper>
            </Stack>
          </Alert>

          {/* Кнопки */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={handleClose}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="gradient"
              gradient={{ from: 'orange', to: 'red' }}
              leftSection={<IconCheck size={18} />}
              onClick={handleCreateAccess}
              loading={loading}
            >
              {t('properties.ownerAccess.understand')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  // Экран с данными доступа и управлением разрешениями
  if (accessData) {
    return (
      <Modal
        opened={visible}
        onClose={handleClose}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
              <IconCheck size={20} stroke={1.5} />
            </ThemeIcon>
            <div>
              <Text fw={600}>{t('properties.ownerAccess.title')}</Text>
              <Text size="xs" c="dimmed">{ownerName}</Text>
            </div>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Stack gap="lg">
          {/* Success Alert */}
          <Alert
            icon={<IconCheck size={20} />}
            title={<Text fw={600}>{t('properties.ownerAccess.successTitle')}</Text>}
            color="green"
            variant="light"
          >
            <Text size="sm">
              {t('properties.ownerAccess.successDescription')}
            </Text>
          </Alert>

          {/* Управление разрешениями */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="sm" justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                    <IconShieldCheck size={20} stroke={1.5} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="sm">{t('properties.ownerAccess.permissions')}</Text>
                    <Text size="xs" c="dimmed">{t('properties.ownerAccess.managePermissions')}</Text>
                  </div>
                </Group>
                
                {hasPermissionsChanged && (
                  <Badge color="orange" variant="light">
                    {t('properties.ownerAccess.unsavedChanges')}
                  </Badge>
                )}
              </Group>

              <Divider />

              <Stack gap="md">
                <Paper p="md" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ThemeIcon size="md" radius="md" variant="light" color="blue">
                        <IconCalendar size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={500}>{t('properties.ownerAccess.calendarPermission')}</Text>
                        <Text size="xs" c="dimmed">{t('properties.ownerAccess.canEditCalendarDescription')}</Text>
                      </div>
                    </Group>
                    <Switch
                      checked={canEditCalendar}
                      onChange={(event) => setCanEditCalendar(event.currentTarget.checked)}
                      color="blue"
                      size="md"
                      onLabel={<IconCheck size={14} />}
                      offLabel={<IconLock size={14} />}
                    />
                  </Group>
                </Paper>

                <Paper p="md" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ThemeIcon size="md" radius="md" variant="light" color="green">
                        <IconCurrencyDollar size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={500}>{t('properties.ownerAccess.pricingPermission')}</Text>
                        <Text size="xs" c="dimmed">{t('properties.ownerAccess.canEditPricingDescription')}</Text>
                      </div>
                    </Group>
                    <Switch
                      checked={canEditPricing}
                      onChange={(event) => setCanEditPricing(event.currentTarget.checked)}
                      color="green"
                      size="md"
                      onLabel={<IconCheck size={14} />}
                      offLabel={<IconLock size={14} />}
                    />
                  </Group>
                </Paper>

                {!canEditCalendar && !canEditPricing && (
                  <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                    <Text size="xs">
                      {t('properties.ownerAccess.readOnlyWarning')}
                    </Text>
                  </Alert>
                )}

                {hasPermissionsChanged && (
                  <Button
                    variant="filled"
                    color="violet"
                    leftSection={<IconDeviceFloppy size={18} />}
                    onClick={handleUpdatePermissions}
                    loading={savingPermissions}
                    fullWidth
                  >
                    {t('properties.ownerAccess.savePermissions')}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Card>

          {/* Ссылка для владельца */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                  <IconLink size={20} stroke={1.5} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text fw={600} size="sm">{t('properties.ownerAccess.accessUrl')}</Text>
                  <Text size="xs" c="dimmed">Отправьте эту ссылку владельцу</Text>
                </div>
                <Badge color="blue" variant="light">URL</Badge>
              </Group>

              <Group gap="xs" wrap="nowrap">
                <TextInput
                  value={accessData.access_url}
                  readOnly
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: isMobile ? '12px' : '14px',
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--mantine-color-dark-6)'
                    }
                  }}
                />
                <CopyButton value={accessData.access_url}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? t('common.copied') : t('common.copy')}>
                      <ActionIcon
                        color={copied ? 'green' : 'blue'}
                        variant="filled"
                        onClick={copy}
                        size="lg"
                      >
                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
                <Tooltip label={t('common.open')}>
                  <ActionIcon
                    component="a"
                    href={accessData.access_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    color="blue"
                    size="lg"
                  >
                    <IconExternalLink size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Stack>
          </Card>

          {/* Пароль */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                  <IconKey size={20} stroke={1.5} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text fw={600} size="sm">{t('properties.ownerAccess.password')}</Text>
                  <Text size="xs" c="dimmed">Одноразовый пароль для входа</Text>
                </div>
                <Badge color="violet" variant="light">Password</Badge>
              </Group>

              <Group gap="xs" wrap="nowrap">
                <TextInput
                  value={accessData.password}
                  readOnly
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: isMobile ? '16px' : '20px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--mantine-color-dark-6)',
                      textAlign: 'center',
                      letterSpacing: '2px'
                    }
                  }}
                />
                <CopyButton value={accessData.password}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? t('common.copied') : t('common.copy')}>
                      <ActionIcon
                        color={copied ? 'green' : 'violet'}
                        variant="filled"
                        onClick={copy}
                        size="lg"
                      >
                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>

              <Paper p="sm" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
                <Group gap="xs">
                  <IconInfoCircle size={14} />
                  <Text size="xs" c="dimmed">
                    {t('properties.ownerAccess.passwordHint')}
                  </Text>
                </Group>
              </Paper>
            </Stack>
          </Card>

          {/* Статус последнего входа */}
          {accessData.last_login_at && (
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Group gap="sm">
                <ThemeIcon size="md" radius="md" variant="light" color="teal">
                  <IconClock size={16} stroke={1.5} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">{t('properties.ownerAccess.lastLogin')}</Text>
                  <Text size="sm" fw={500}>
                    {new Date(accessData.last_login_at).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          )}

          {/* Security Note */}
          <Alert
            icon={<IconShieldCheck size={20} />}
            title={<Text fw={500}>{t('properties.ownerAccess.securityNote')}</Text>}
            color="cyan"
            variant="light"
          >
            <Text size="sm">
              {t('properties.ownerAccess.securityNoteText')}
            </Text>
          </Alert>

          <Button 
            variant="gradient"
            gradient={{ from: 'violet', to: 'grape' }}
            fullWidth
            onClick={handleClose}
            size="md"
          >
            {t('common.close')}
          </Button>
        </Stack>
      </Modal>
    );
  }

  return null;
};

export default OwnerAccessModal;