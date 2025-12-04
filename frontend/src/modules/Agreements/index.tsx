// frontend/src/modules/Agreements/index.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  TextInput,
  Grid,
  Badge,
  Menu,
  Stack,
  Group,
  Text,
  Title,
  Select,
  ActionIcon,
  Center,
  Loader,
  Pagination,
  useMantineTheme,
  Paper
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconFileText,
  IconDots,
  IconEdit,
  IconTrash,
  IconEye,
  IconLink,
  IconCurrencyDollar,
  IconSearch,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import CreateAgreementModal from './components/CreateAgreementModal';

const Agreements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  const stats = {
    total: agreements.length,
    draft: agreements.filter(a => a.status === 'draft').length,
    pending: agreements.filter(a => a.status === 'pending_signatures').length,
    signed: agreements.filter(a => a.status === 'signed').length,
    active: agreements.filter(a => a.status === 'active').length
  };

  useEffect(() => {
    const requestUuid = searchParams.get('request_uuid');
    if (requestUuid) {
      setCreateModalVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAgreements();
  }, [pagination.current, pagination.pageSize, searchText, filterType, filterStatus]);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined
      });

      setAgreements(response.data.data);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }));
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('agreements.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: t('agreements.confirm.deleteTitle'),
      children: (
        <Text size="sm">
          {t('agreements.confirm.deleteDescription')}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await agreementsApi.delete(id);
          notifications.show({
            title: t('common.success'),
            message: t('agreements.messages.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          fetchAgreements();
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: error.response?.data?.message || t('agreements.messages.deleteError'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  const copyPublicLink = (link: string) => {
    navigator.clipboard.writeText(link);
    notifications.show({
      title: t('common.success'),
      message: t('agreements.messages.linkCopied'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'gray', text: t('agreements.statuses.draft') },
      pending_signatures: { color: 'blue', text: t('agreements.statuses.pendingSignatures') },
      signed: { color: 'green', text: t('agreements.statuses.signed') },
      active: { color: 'teal', text: t('agreements.statuses.active') },
      expired: { color: 'yellow', text: t('agreements.statuses.expired') },
      cancelled: { color: 'red', text: t('agreements.statuses.cancelled') }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    return <Badge color={config.color} variant="light">{config.text}</Badge>;
  };

  const getTypeTag = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      rent: { color: 'blue', text: t('agreements.types.rent') },
      sale: { color: 'green', text: t('agreements.types.sale') },
      bilateral: { color: 'violet', text: t('agreements.types.bilateral') },
      trilateral: { color: 'orange', text: t('agreements.types.trilateral') },
      agency: { color: 'pink', text: t('agreements.types.agency') },
      transfer_act: { color: 'cyan', text: t('agreements.types.transferAct') }
    };
    
    const config = typeConfig[type] || { color: 'gray', text: type };
    return <Badge color={config.color} variant="light">{config.text}</Badge>;
  };

  const StatCard = ({ title, value, color }: { title: string; value: number; color: string }) => (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = theme.shadows.md;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = theme.shadows.sm;
      }}
    >
      <Stack gap={4}>
        <Text size="xs" c="dimmed" fw={500}>
          {title}
        </Text>
        <Text size="xl" fw={700} c={color}>
          {value}
        </Text>
      </Stack>
    </Card>
  );

  const renderActionsMenu = (record: Agreement) => (
    <Menu position="bottom-end" shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEye size={16} />}
          onClick={() => navigate(`/agreements/${record.id}`)}
        >
          {t('agreements.actions.view')}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEdit size={16} />}
          onClick={() => navigate(`/agreements/${record.id}?edit=true`)}
        >
          {t('agreements.actions.edit')}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLink size={16} />}
          onClick={() => copyPublicLink(record.public_link)}
        >
          {t('agreements.actions.publicLink')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={() => handleDelete(record.id)}
        >
          {t('common.delete')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const MobileCard = ({ agreement }: { agreement: Agreement }) => (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'pointer'
      }}
      onClick={() => navigate(`/agreements/${agreement.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = theme.shadows.md;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = theme.shadows.sm;
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Text fw={600} size="sm" style={{ flex: 1 }}>
            {agreement.agreement_number}
          </Text>
          <Group gap={4}>
            {getTypeTag(agreement.type)}
            {getStatusTag(agreement.status)}
          </Group>
        </Group>

        {agreement.property_name && (
          <div>
            <Text size="xs" c="dimmed">
              {t('agreements.mobile.property')}:
            </Text>
            <Text size="sm" fw={500}>
              {agreement.property_name}
            </Text>
          </div>
        )}

        <Group justify="space-between" mt="xs">
          <Text size="xs" c="dimmed">
            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
          </Text>
          <Button
            size="xs"
            variant="light"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/agreements/${agreement.id}`);
            }}
          >
            {t('agreements.mobile.view')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg" p={isMobile ? 'sm' : 'md'}>
      <Grid gutter="md">
        <Grid.Col span={{ base: 6, xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={t('agreements.stats.total')}
            value={stats.total}
            color={theme.colors.blue[6]}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={t('agreements.stats.drafts')}
            value={stats.draft}
            color={theme.colors.gray[6]}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={t('agreements.stats.pending')}
            value={stats.pending}
            color={theme.colors.orange[6]}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={t('agreements.stats.signed')}
            value={stats.signed}
            color={theme.colors.green[6]}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={t('agreements.stats.active')}
            value={stats.active}
            color={theme.colors.teal[6]}
          />
        </Grid.Col>
      </Grid>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <IconFileText size={24} />
              <Title order={4}>{t('agreements.title')}</Title>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Button
                variant="subtle"
                onClick={() => navigate('/agreements/templates')}
                size={isMobile ? 'xs' : 'sm'}
              >
                {t('agreements.buttons.templates')}
              </Button>
              <Button
                variant="light"
                leftSection={<IconCurrencyDollar size={18} />}
                onClick={() => navigate('/financial-documents')}
                size={isMobile ? 'xs' : 'sm'}
              >
                {!isMobile && t('agreements.buttons.invoicesAndReceipts')}
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={() => setCreateModalVisible(true)}
                size={isMobile ? 'xs' : 'sm'}
              >
                {!isMobile && t('agreements.buttons.createAgreement')}
              </Button>
            </Group>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
              <TextInput
                placeholder={t('agreements.placeholders.search')}
                leftSection={<IconSearch size={18} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                styles={{
                  input: { fontSize: '16px' }
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder={t('agreements.filters.type')}
                clearable
                value={filterType || null}
                onChange={(value) => setFilterType(value || '')}
                data={[
                  { value: 'rent', label: t('agreements.types.rent') },
                  { value: 'sale', label: t('agreements.types.sale') },
                  { value: 'bilateral', label: t('agreements.types.bilateral') },
                  { value: 'trilateral', label: t('agreements.types.trilateral') },
                  { value: 'agency', label: t('agreements.types.agency') },
                  { value: 'transfer_act', label: t('agreements.types.transferAct') }
                ]}
                styles={{
                  input: { fontSize: '16px' }
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder={t('agreements.filters.status')}
                clearable
                value={filterStatus || null}
                onChange={(value) => setFilterStatus(value || '')}
                data={[
                  { value: 'draft', label: t('agreements.statuses.draft') },
                  { value: 'pending_signatures', label: t('agreements.statuses.pendingSignatures') },
                  { value: 'signed', label: t('agreements.statuses.signed') },
                  { value: 'active', label: t('agreements.statuses.active') },
                  { value: 'expired', label: t('agreements.statuses.expired') },
                  { value: 'cancelled', label: t('agreements.statuses.cancelled') }
                ]}
                styles={{
                  input: { fontSize: '16px' }
                }}
              />
            </Grid.Col>
          </Grid>

          {isMobile ? (
            <Stack gap="md">
              {loading ? (
                <Center py={60}>
                  <Stack align="center" gap="md">
                    <Loader size="lg" />
                    <Text size="sm" c="dimmed">
                      {t('agreements.loading')}
                    </Text>
                  </Stack>
                </Center>
              ) : agreements.length === 0 ? (
                <Paper p="xl" radius="md" withBorder>
                  <Center>
                    <Stack align="center" gap="md">
                      <IconFileText size={48} color={theme.colors.gray[5]} />
                      <Text size="lg" c="dimmed">
                        {t('agreements.noAgreements')}
                      </Text>
                    </Stack>
                  </Center>
                </Paper>
              ) : (
                <>
                  {agreements.map(agreement => (
                    <MobileCard key={agreement.id} agreement={agreement} />
                  ))}

                  {pagination.total > pagination.pageSize && (
                    <Group justify="space-between" mt="md">
                      <Button
                        variant="light"
                        disabled={pagination.current === 1}
                        onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                        size="xs"
                      >
                        {t('agreements.pagination.back')}
                      </Button>
                      <Text size="xs" c="dimmed">
                        {t('agreements.pagination.pageInfo', {
                          current: pagination.current,
                          total: Math.ceil(pagination.total / pagination.pageSize)
                        })}
                      </Text>
                      <Button
                        variant="light"
                        disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                        onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                        size="xs"
                      >
                        {t('agreements.pagination.forward')}
                      </Button>
                    </Group>
                  )}
                </>
              )}
            </Stack>
          ) : (
            <>
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('agreements.table.number')}</Table.Th>
                    <Table.Th>{t('agreements.table.type')}</Table.Th>
                    <Table.Th>{t('agreements.table.status')}</Table.Th>
                    <Table.Th>{t('agreements.table.property')}</Table.Th>
                    <Table.Th>{t('agreements.table.description')}</Table.Th>
                    <Table.Th>{t('agreements.table.signatures')}</Table.Th>
                    <Table.Th>{t('agreements.table.created')}</Table.Th>
                    <Table.Th>{t('agreements.table.actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loading ? (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Center py={40}>
                          <Loader size="lg" />
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : agreements.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Center py={40}>
                          <Text c="dimmed">{t('agreements.noAgreements')}</Text>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    agreements.map((agreement) => (
                      <Table.Tr key={agreement.id}>
                        <Table.Td>
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => navigate(`/agreements/${agreement.id}`)}
                          >
                            {agreement.agreement_number}
                          </Button>
                        </Table.Td>
                        <Table.Td>{getTypeTag(agreement.type)}</Table.Td>
                        <Table.Td>{getStatusTag(agreement.status)}</Table.Td>
                        <Table.Td>
                          {agreement.property_name ? (
                            <div>
                              <Text size="sm" fw={500}>
                                {agreement.property_name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {agreement.property_number}
                              </Text>
                            </div>
                          ) : (
                            <Text size="sm" c="dimmed">
                              {t('agreements.notSpecified')}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" lineClamp={1}>
                            {agreement.description || '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ta="center">
                            {agreement.signed_count || 0} / {agreement.signature_count || 0}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {renderActionsMenu(agreement)}
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>

              {pagination.total > pagination.pageSize && (
                <Group justify="space-between" mt="lg">
                  <Text size="sm" c="dimmed">
                    {t('agreements.pagination.total', { total: pagination.total })}
                  </Text>
                  <Pagination
                    total={Math.ceil(pagination.total / pagination.pageSize)}
                    value={pagination.current}
                    onChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
                    size={isMobile ? 'sm' : 'md'}
                  />
                </Group>
              )}
            </>
          )}
        </Stack>
      </Card>

      <CreateAgreementModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSearchParams({});
        }}
        onSuccess={() => {
          setCreateModalVisible(false);
          setSearchParams({});
          fetchAgreements();
        }}
      />
    </Stack>
  );
};

export default Agreements;