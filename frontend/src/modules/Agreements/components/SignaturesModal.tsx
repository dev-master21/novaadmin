// frontend/src/modules/Agreements/components/SignaturesModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Card,
  Select,
  Table,
  Tooltip,
  Text,
  Badge,
  Stack,
  Group,
  Divider,
  ActionIcon,
  Box,
  ThemeIcon,
  useMantineColorScheme
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconTrash,
  IconCopy,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconClock,
  IconBell,
  IconX,
  IconUserCheck,
  IconSignature,
  IconLink,
  IconUserPlus,
  IconChecks,
  IconAlertTriangle,
  IconSparkles
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { agreementsApi, AgreementParty, AgreementSignature } from '@/api/agreements.api';

interface SignaturesModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  agreementId: number;
  parties: AgreementParty[];
  existingSignatures?: AgreementSignature[];
  requestUuid?: string;
}

interface SignerData {
  id?: string;
  signer_name: string;
  signer_role: string;
}

interface EditingData {
  signer_name: string;
  signer_role: string;
}

const SignaturesModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  agreementId, 
  parties,
  existingSignatures = [],
  requestUuid
}: SignaturesModalProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [loading, setLoading] = useState(false);
  const [signers, setSigners] = useState<SignerData[]>([]);
  const [showExisting, setShowExisting] = useState(existingSignatures.length > 0);
  const [generatedLinks, setGeneratedLinks] = useState<any[]>([]);
  const [step, setStep] = useState<'create' | 'links'>('create');
  const [editingSignature, setEditingSignature] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EditingData | null>(null);

  const partyRoles = [...new Set(parties.map(p => p.role))];
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (visible) {
      if (existingSignatures.length > 0) {
        setShowExisting(true);
        setStep('create');
      } else {
        setShowExisting(false);
        setSigners([{ id: '1', signer_name: '', signer_role: '' }]);
        setStep('create');
      }
      setGeneratedLinks([]);
      setEditingSignature(null);
      setEditingData(null);
    }
  }, [visible, existingSignatures]);

  useEffect(() => {
    console.log('🔍 SignaturesModal Debug:', {
      requestUuid,
      existingSignatures: existingSignatures.length,
      hasRequestUuid: !!requestUuid
    });
  }, [requestUuid, existingSignatures]);

  const addSigner = () => {
    setSigners([...signers, { 
      id: Date.now().toString(), 
      signer_name: '', 
      signer_role: '' 
    }]);
  };

  const removeSigner = (id: string) => {
    setSigners(signers.filter(s => s.id !== id));
  };

  const updateSigner = (id: string, updates: Partial<SignerData>) => {
    setSigners(signers.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const handleNotifyAgent = async () => {
    if (!requestUuid) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.cannotNotify'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    try {
      await agreementsApi.notifyAgent(agreementId, requestUuid);
      notifications.show({
        title: t('common.success'),
        message: t('signaturesModal.messages.agentNotified'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('signaturesModal.errors.notificationFailed'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const validateUniqueRoles = (signersToValidate: SignerData[]): boolean => {
    const roles = signersToValidate
      .map(s => s.signer_role.trim())
      .filter(role => role !== '');

    const roleSet = new Set(roles);
    
    if (roles.length !== roleSet.size) {
      const duplicates = roles.filter((role, index) => roles.indexOf(role) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.duplicateRole', { role: uniqueDuplicates[0] }),
        color: 'red',
        icon: <IconAlertTriangle size={16} />
      });
      return false;
    }

    const existingRoles = existingSignatures.map(s => s.signer_role);
    const conflictingRoles = roles.filter(role => existingRoles.includes(role));
    
    if (conflictingRoles.length > 0) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.roleAlreadyExists', { role: conflictingRoles[0] }),
        color: 'red',
        icon: <IconAlertTriangle size={16} />
      });
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    const invalidSigners = signers.filter(s => 
      !s.signer_name.trim() || !s.signer_role.trim()
    );

    if (invalidSigners.length > 0) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.fillAllFields'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    if (!validateUniqueRoles(signers)) {
      return;
    }

    setLoading(true);
    try {
      const signaturesData = signers.map(s => ({
        signer_name: s.signer_name.trim(),
        signer_role: s.signer_role.trim(),
        position_x: 100,
        position_y: 100,
        position_page: 1
      }));

      const response = await agreementsApi.createSignatures(agreementId, {
        signatures: signaturesData
      });

      setGeneratedLinks(response.data.data.signatureLinks);
      setStep('links');
      notifications.show({
        title: t('common.success'),
        message: t('signaturesModal.messages.signaturesCreated'),
        color: 'green',
        icon: <IconChecks size={16} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('signaturesModal.errors.createFailed'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    notifications.show({
      title: t('common.success'),
      message: t('signaturesModal.messages.linkCopied'),
      color: 'green',
      icon: <IconCopy size={16} />
    });
  };

  const handleUpdateSignature = async (id: number) => {
    if (!editingData) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.noDataToSave'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    if (!editingData.signer_name.trim()) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.enterSignerName'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    if (!editingData.signer_role.trim()) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.selectRole'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    const otherSignatures = existingSignatures.filter(s => s.id !== id);
    const roleExists = otherSignatures.some(s => s.signer_role === editingData.signer_role);
    
    if (roleExists) {
      notifications.show({
        title: t('errors.generic'),
        message: t('signaturesModal.errors.roleUsedByOther', { role: editingData.signer_role }),
        color: 'red',
        icon: <IconAlertTriangle size={16} />
      });
      return;
    }

    try {
      await agreementsApi.updateSignature(id, {
        signer_name: editingData.signer_name.trim(),
        signer_role: editingData.signer_role.trim()
      });
      
      notifications.show({
        title: t('common.success'),
        message: t('signaturesModal.messages.signatureUpdated'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
      setEditingSignature(null);
      setEditingData(null);
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('signaturesModal.errors.updateFailed'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const handleRegenerateLink = async (id: number) => {
    try {
      const response = await agreementsApi.regenerateSignatureLink(id);
      notifications.show({
        title: t('common.success'),
        message: t('signaturesModal.messages.linkRegenerated'),
        color: 'green',
        icon: <IconRefresh size={16} />
      });
      copyLink(response.data.data.public_url);
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('signaturesModal.errors.regenerateFailed'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const handleDeleteSignature = async (id: number) => {
    try {
      await agreementsApi.deleteSignature(id);
      notifications.show({
        title: t('common.success'),
        message: t('signaturesModal.messages.signatureDeleted'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('signaturesModal.errors.deleteFailed'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const openRegenerateConfirm = (id: number) => {
    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <ThemeIcon size="sm" color="blue" variant="light">
            <IconRefresh size={16} />
          </ThemeIcon>
          <Text fw={600}>{t('signaturesModal.confirm.regenerateTitle')}</Text>
        </Group>
      ),
      children: (
        <Text size="sm">
          {t('signaturesModal.confirm.regenerateDescription')}
        </Text>
      ),
      labels: { confirm: t('common.yes'), cancel: t('common.no') },
      confirmProps: { color: 'blue', leftSection: <IconCheck size={16} /> },
      cancelProps: { variant: 'subtle' },
      onConfirm: () => handleRegenerateLink(id)
    });
  };

  const openDeleteConfirm = (id: number) => {
    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <ThemeIcon size="sm" color="red" variant="light">
            <IconTrash size={16} />
          </ThemeIcon>
          <Text fw={600}>{t('signaturesModal.confirm.deleteTitle')}</Text>
        </Group>
      ),
      children: (
        <Text size="sm">
          {t('signaturesModal.confirm.deleteDescription')}
        </Text>
      ),
      labels: { confirm: t('common.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red', leftSection: <IconTrash size={16} /> },
      cancelProps: { variant: 'subtle' },
      onConfirm: () => handleDeleteSignature(id)
    });
  };

  const getAvailableRoles = (currentSignerId: string) => {
    const usedRolesInNewSigners = signers
      .filter(s => s.id !== currentSignerId)
      .map(s => s.signer_role)
      .filter(role => role !== '');

    const usedRolesInExisting = existingSignatures.map(s => s.signer_role);
    const allUsedRoles = [...usedRolesInNewSigners, ...usedRolesInExisting];

    return partyRoles.filter(role => !allUsedRoles.includes(role));
  };

  const renderMobileSignatureCard = (record: AgreementSignature) => {
    const isEditing = editingSignature === record.id;

    return (
      <Card 
        key={record.id} 
        p="md" 
        mb="sm"
        withBorder
        style={{
          borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
        }}
      >
        <Stack gap="md">
          {/* Информация о подписанте */}
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Box style={{ flex: 1 }}>
              {isEditing ? (
                <Stack gap="xs">
                  <TextInput
                    size="sm"
                    placeholder={t('signaturesModal.fields.name')}
                    defaultValue={record.signer_name}
                    onChange={(e) => {
                      setEditingData(prev => ({
                        signer_name: e.target.value,
                        signer_role: prev?.signer_role || record.signer_role
                      }));
                    }}
                    leftSection={<IconUserCheck size={16} />}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                  <Select
                    size="sm"
                    placeholder={t('signaturesModal.placeholders.selectRole')}
                    defaultValue={record.signer_role}
                    data={partyRoles
                      .filter(role => {
                        return role === record.signer_role || !existingSignatures.some(s => s.id !== record.id && s.signer_role === role);
                      })
                      .map(role => ({ value: role, label: role }))
                    }
                    onChange={(value) => {
                      if (value) {
                        setEditingData(prev => ({
                          signer_name: prev?.signer_name || record.signer_name,
                          signer_role: value
                        }));
                      }
                    }}
                    leftSection={<IconSignature size={16} />}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Stack>
              ) : (
                <>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon size="sm" variant="light" color="blue">
                      <IconUserCheck size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm">{record.signer_name}</Text>
                  </Group>
                  {record.first_visit_at && (
                    <Group gap={4} mt={6}>
                      <IconClock size={12} style={{ opacity: 0.6 }} />
                      <Text size="xs" c="dimmed">
                        {t('signaturesModal.fields.visited')} {new Date(record.first_visit_at).toLocaleString('ru-RU')}
                      </Text>
                    </Group>
                  )}
                  <Badge size="sm" variant="light" color="blue" mt={8} leftSection={<IconSignature size={12} />}>
                    {record.signer_role}
                  </Badge>
                </>
              )}
            </Box>
            
            {/* Статус */}
            <Stack gap={4} align="flex-end">
              <Badge 
                size="sm"
                color={record.is_signed ? 'green' : 'gray'}
                variant="light"
                leftSection={record.is_signed ? <IconCheck size={12} /> : <IconClock size={12} />}
              >
                {record.is_signed ? t('signaturesModal.status.signed') : t('signaturesModal.status.waiting')}
              </Badge>
              {record.is_signed && record.signed_at && (
                <Text size="xs" c="dimmed">
                  {new Date(record.signed_at).toLocaleDateString('ru-RU')}
                </Text>
              )}
            </Stack>
          </Group>

          <Divider />

          {/* Действия */}
          <Group gap="xs" grow={isMobile}>
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="filled"
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => handleUpdateSignature(record.id)}
                >
                  {t('common.save')}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconX size={16} />}
                  onClick={() => {
                    setEditingSignature(null);
                    setEditingData(null);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
                >
                  {t('signaturesModal.actions.copy')}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => {
                    setEditingData({
                      signer_name: record.signer_name,
                      signer_role: record.signer_role
                    });
                    setEditingSignature(record.id);
                  }}
                >
                  {t('signaturesModal.actions.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="blue"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => openRegenerateConfirm(record.id)}
                >
                  {t('signaturesModal.actions.update')}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => openDeleteConfirm(record.id)}
                >
                  {t('common.delete')}
                </Button>
              </>
            )}
          </Group>
        </Stack>
      </Card>
    );
  };

  // Колонки для десктопной таблицы
  const existingColumns = [
    {
      accessor: 'signer_name',
      title: t('signaturesModal.table.signer'),
      width: '25%',
      render: (record: AgreementSignature) => {
        if (editingSignature === record.id) {
          return (
            <TextInput
              size="sm"
              placeholder={t('signaturesModal.fields.name')}
              defaultValue={record.signer_name}
              onChange={(e) => {
                setEditingData(prev => ({
                  signer_name: e.target.value,
                  signer_role: prev?.signer_role || record.signer_role
                }));
              }}
              leftSection={<IconUserCheck size={16} />}
            />
          );
        }
        return (
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconUserCheck size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm">{record.signer_name}</Text>
            </Group>
            {record.first_visit_at && (
              <Group gap={4}>
                <IconClock size={12} style={{ opacity: 0.6 }} />
                <Text size="xs" c="dimmed">
                  {t('signaturesModal.fields.visited')} {new Date(record.first_visit_at).toLocaleString('ru-RU')}
                </Text>
              </Group>
            )}
          </Stack>
        );
      }
    },
    {
      accessor: 'signer_role',
      title: t('signaturesModal.table.role'),
      width: '20%',
      render: (record: AgreementSignature) => {
        if (editingSignature === record.id) {
          return (
            <Select
              size="sm"
              placeholder={t('signaturesModal.placeholders.selectRole')}
              defaultValue={record.signer_role}
              data={partyRoles
                .filter(role => {
                  return role === record.signer_role || !existingSignatures.some(s => s.id !== record.id && s.signer_role === role);
                })
                .map(role => ({ value: role, label: role }))
              }
              onChange={(value) => {
                if (value) {
                  setEditingData(prev => ({
                    signer_name: prev?.signer_name || record.signer_name,
                    signer_role: value
                  }));
                }
              }}
              leftSection={<IconSignature size={16} />}
            />
          );
        }
        return (
          <Badge variant="light" color="blue" leftSection={<IconSignature size={12} />}>
            {record.signer_role}
          </Badge>
        );
      }
    },
    {
      accessor: 'is_signed',
      title: t('signaturesModal.table.status'),
      width: '15%',
      render: (record: AgreementSignature) => (
        <Stack gap={4}>
          <Badge
            variant="light"
            color={record.is_signed ? 'green' : 'gray'}
            leftSection={record.is_signed ? <IconCheck size={12} /> : <IconClock size={12} />}
          >
            {record.is_signed ? t('signaturesModal.status.signed') : t('signaturesModal.status.waiting')}
          </Badge>
          {record.is_signed && record.signed_at && (
            <Text size="xs" c="dimmed">
              {new Date(record.signed_at).toLocaleDateString('ru-RU')}
            </Text>
          )}
        </Stack>
      )
    },
    {
      accessor: 'actions',
      title: t('signaturesModal.table.actions'),
      width: '40%',
      render: (record: AgreementSignature) => {
        if (editingSignature === record.id) {
          return (
            <Group gap="xs">
              <Button
                size="sm"
                variant="filled"
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleUpdateSignature(record.id)}
              >
                {t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={() => {
                  setEditingSignature(null);
                  setEditingData(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </Group>
          );
        }

        return (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={t('signaturesModal.tooltips.copyLink')}>
              <ActionIcon
                size="lg"
                variant="light"
                onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
              >
                <IconCopy size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('signaturesModal.tooltips.edit')}>
              <ActionIcon
                size="lg"
                variant="light"
                onClick={() => {
                  setEditingData({
                    signer_name: record.signer_name,
                    signer_role: record.signer_role
                  });
                  setEditingSignature(record.id);
                }}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('signaturesModal.tooltips.regenerate')}>
              <ActionIcon
                size="lg"
                variant="light"
                color="blue"
                onClick={() => openRegenerateConfirm(record.id)}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('common.delete')}>
              <ActionIcon
                size="lg"
                variant="light"
                color="red"
                onClick={() => openDeleteConfirm(record.id)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      }
    }
  ];

  return (
    <Modal
      opened={visible}
      onClose={onCancel}
      title={
        <Group>
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape', deg: 45 }}>
            <IconSignature size={20} />
          </ThemeIcon>
          <Text size="lg" fw={700}>
            {t('signaturesModal.title')}
          </Text>
        </Group>
      }
      size={isMobile ? '100%' : 900}
      fullScreen={isMobile}
      padding={isMobile ? 'sm' : 'lg'}
      closeButtonProps={{
        icon: <IconX size={20} />
      }}
      styles={{
        header: {
          borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-3)'}`
        }
      }}
    >
      <Stack gap="md">
        {/* Существующие подписи */}
        {showExisting && existingSignatures.length > 0 && step === 'create' && (
          <Card 
            withBorder
            p="md"
            style={{
              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
            }}
          >
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                    <IconUserCheck size={20} />
                  </ThemeIcon>
                  <Text fw={600} size="md">
                    {t('signaturesModal.cards.existingSignatures')}
                  </Text>
                </Group>
                <Badge variant="light" color="blue" size="lg" leftSection={<IconChecks size={14} />}>
                  {t('signaturesModal.cards.signedCount', {
                    signed: existingSignatures.filter(s => s.is_signed).length,
                    total: existingSignatures.length
                  })}
                </Badge>
              </Group>

              {/* Desktop Table */}
              {!isMobile && (
                <Table.ScrollContainer minWidth={700}>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        {existingColumns.map(col => (
                          <Table.Th key={col.accessor} style={{ width: col.width }}>
                            {col.title}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {existingSignatures.map(record => (
                        <Table.Tr key={record.id}>
                          {existingColumns.map(col => (
                            <Table.Td key={col.accessor}>
                              {col.render(record)}
                            </Table.Td>
                          ))}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}

              {/* Mobile Cards */}
              {isMobile && (
                <Stack gap="sm">
                  {existingSignatures.map(record => renderMobileSignatureCard(record))}
                </Stack>
              )}
            </Stack>
          </Card>
        )}

        {/* Создание новых подписантов */}
        {step === 'create' ? (
          <>
            <Card 
              withBorder
              p="md"
              style={{
                borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
              }}
            >
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" radius="md" variant="light" color="green">
                    <IconUserPlus size={20} />
                  </ThemeIcon>
                  <Text fw={600} size="md">
                    {t('signaturesModal.cards.addNewSigners')}
                  </Text>
                </Group>

                <Stack gap="md">
                  {signers.map((signer, index) => (
                    <Card 
                      key={signer.id} 
                      withBorder
                      p="md"
                      style={{
                        background: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
                        borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
                      }}
                    >
                      <Stack gap="md">
                        <Group justify="space-between">
                          <Badge variant="light" color="violet" size="lg" leftSection={<IconSparkles size={14} />}>
                            {t('signaturesModal.cards.signerNumber', { number: index + 1 })}
                          </Badge>
                          {signers.length > 1 && (
                            <Tooltip label={t('common.delete')}>
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="lg"
                                onClick={() => removeSigner(signer.id!)}
                              >
                                <IconTrash size={18} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>

                        <Stack gap="sm">
                          <Box>
                            <Text size="sm" fw={600} mb={4}>
                              {t('signaturesModal.fields.signerName')} *
                            </Text>
                            <TextInput
                              placeholder={t('signaturesModal.placeholders.signerName')}
                              value={signer.signer_name}
                              onChange={(e) => updateSigner(signer.id!, { signer_name: e.target.value })}
                              leftSection={<IconUserCheck size={16} />}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Box>

                          <Box>
                            <Text size="sm" fw={600} mb={4}>
                              {t('signaturesModal.fields.role')} *
                            </Text>
                            <Select
                              placeholder={t('signaturesModal.placeholders.selectRole')}
                              value={signer.signer_role || null}
                              data={getAvailableRoles(signer.id!).map(role => ({ 
                                value: role, 
                                label: role 
                              }))}
                              onChange={(value) => {
                                if (value) {
                                  updateSigner(signer.id!, { signer_role: value });
                                }
                              }}
                              searchable
                              clearable
                              leftSection={<IconSignature size={16} />}
                              styles={{ input: { fontSize: '16px' } }}
                              mb="xs"
                            />
                            <TextInput
                              placeholder={t('signaturesModal.placeholders.customRole')}
                              value={!partyRoles.includes(signer.signer_role) ? signer.signer_role : ''}
                              onChange={(e) => updateSigner(signer.id!, { signer_role: e.target.value })}
                              leftSection={<IconEdit size={16} />}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Box>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}

                  <Button
                    variant="light"
                    size="md"
                    leftSection={<IconPlus size={18} />}
                    onClick={addSigner}
                    fullWidth
                  >
                    {t('signaturesModal.actions.addAnotherSigner')}
                  </Button>
                </Stack>
              </Stack>
            </Card>

            {/* Кнопки навигации */}
            <Group justify="space-between" pt="md" style={{
              borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`
            }}>
              <Group gap="xs">
                <Button variant="subtle" onClick={onCancel} leftSection={<IconX size={16} />}>
                  {t('common.cancel')}
                </Button>
                {requestUuid && existingSignatures.length > 0 && (
                  <Button
                    variant="filled"
                    color="green"
                    leftSection={<IconBell size={18} />}
                    onClick={handleNotifyAgent}
                  >
                    {t('signaturesModal.actions.notifyAgent')}
                  </Button>
                )}
              </Group>
              <Button
                variant="filled"
                color="violet"
                size="md"
                onClick={handleCreate}
                loading={loading}
                leftSection={<IconChecks size={18} />}
              >
                {t('signaturesModal.actions.createSignatures')}
              </Button>
            </Group>
          </>
        ) : (
          /* Отображение сгенерированных ссылок */
          <>
            <Card 
              withBorder
              p="md"
              style={{
                borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
              }}
            >
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                    <IconLink size={20} />
                  </ThemeIcon>
                  <Text fw={600} size="md">
                    {t('signaturesModal.cards.signatureLinks')}
                  </Text>
                </Group>

                <Stack gap="sm">
                  {generatedLinks.map((link, index) => (
                    <Card 
                      key={index} 
                      p="md"
                      withBorder
                      style={{
                        background: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
                        borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'
                      }}
                    >
                      <Stack gap="xs">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="blue">
                            <IconUserCheck size={14} />
                          </ThemeIcon>
                          <Text fw={600} size="sm">{link.signer_name}</Text>
                        </Group>
                        <Group gap={0}>
                          <TextInput
                            value={link.link}
                            readOnly
                            style={{ flex: 1 }}
                            styles={{ 
                              input: { 
                                borderTopRightRadius: 0, 
                                borderBottomRightRadius: 0,
                                fontSize: '14px'
                              } 
                            }}
                            leftSection={<IconLink size={16} />}
                          />
                          <Button
                            variant="filled"
                            leftSection={<IconCopy size={16} />}
                            onClick={() => copyLink(link.link)}
                            style={{
                              borderTopLeftRadius: 0,
                              borderBottomLeftRadius: 0
                            }}
                          >
                            {t('signaturesModal.actions.copy')}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>

            {/* Кнопки завершения */}
            <Group justify="space-between" pt="md" style={{
              borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`
            }}>
              {requestUuid && (
                <Button
                  variant="filled"
                  color="green"
                  leftSection={<IconBell size={18} />}
                  onClick={handleNotifyAgent}
                >
                  {t('signaturesModal.actions.notifyAgent')}
                </Button>
              )}
              <Button 
                variant="filled"
                color="violet"
                size="md"
                onClick={() => { 
                  onSuccess(); 
                  onCancel(); 
                }}
                ml="auto"
                leftSection={<IconCheck size={18} />}
              >
                {t('signaturesModal.actions.done')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default SignaturesModal;