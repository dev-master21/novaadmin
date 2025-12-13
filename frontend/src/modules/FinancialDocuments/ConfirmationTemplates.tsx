// frontend/src/modules/FinancialDocuments/ConfirmationTemplates.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Table,
  ActionIcon,
  Badge,
  Loader,
  Center,
  ThemeIcon,
  Paper,
  Menu,
  Modal,
  TextInput,
  Textarea,
  Switch,
  Alert,
  useMantineTheme,
  Box,
  Divider,
  ScrollArea
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconArrowLeft,
  IconPlus,
  IconTemplate,
  IconEdit,
  IconTrash,
  IconDots,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconEye,
  IconCopy
} from '@tabler/icons-react';
import { 
  financialDocumentsApi, 
  ConfirmationTemplate, 
  CreateConfirmationTemplateDTO 
} from '@/api/financialDocuments.api';
import dayjs from 'dayjs';

const ConfirmationTemplates = () => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [templates, setTemplates] = useState<ConfirmationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalOpened, setModalOpened] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConfirmationTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ConfirmationTemplate | null>(null);
  const [previewModalOpened, setPreviewModalOpened] = useState(false);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getAllConfirmationTemplates();
      setTemplates(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('confirmationTemplates.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormContent(getDefaultTemplateContent());
    setFormIsActive(true);
    setModalOpened(true);
  };

  const openEditModal = (template: ConfirmationTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setFormIsActive(template.is_active);
    setModalOpened(true);
  };

  const openPreviewModal = (template: ConfirmationTemplate) => {
    setPreviewTemplate(template);
    setPreviewModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      notifications.show({
        title: t('errors.validation'),
        message: t('confirmationTemplates.validation.nameRequired'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    if (!formContent.trim()) {
      notifications.show({
        title: t('errors.validation'),
        message: t('confirmationTemplates.validation.contentRequired'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    setFormLoading(true);
    try {
      const data: CreateConfirmationTemplateDTO = {
        name: formName.trim(),
        content: formContent.trim(),
        is_active: formIsActive
      };

      if (editingTemplate) {
        await financialDocumentsApi.updateConfirmationTemplate(editingTemplate.id, data);
        notifications.show({
          title: t('common.success'),
          message: t('confirmationTemplates.messages.updated'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      } else {
        await financialDocumentsApi.createConfirmationTemplate(data);
        notifications.show({
          title: t('common.success'),
          message: t('confirmationTemplates.messages.created'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      setModalOpened(false);
      fetchTemplates();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('confirmationTemplates.messages.saveError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (template: ConfirmationTemplate) => {
    modals.openConfirmModal({
      title: t('confirmationTemplates.confirm.deleteTitle'),
      children: (
        <Text size="sm">
          {t('confirmationTemplates.confirm.deleteMessage', { name: template.name })}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await financialDocumentsApi.deleteConfirmationTemplate(template.id);
          notifications.show({
            title: t('common.success'),
            message: t('confirmationTemplates.messages.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          fetchTemplates();
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: t('confirmationTemplates.messages.deleteError'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  const handleDuplicate = async (template: ConfirmationTemplate) => {
    try {
      const data: CreateConfirmationTemplateDTO = {
        name: `${template.name} (копия)`,
        content: template.content,
        is_active: false
      };

      await financialDocumentsApi.createConfirmationTemplate(data);
      notifications.show({
        title: t('common.success'),
        message: t('confirmationTemplates.messages.duplicated'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      fetchTemplates();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('confirmationTemplates.messages.duplicateError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const getDefaultTemplateContent = () => {
    return `IMPORTANT NOTICE:

1. Check-in time: {{check_in_time}}
2. Check-out time: {{check_out_time}}
3. A security deposit of {{deposit_amount}} THB is required upon check-in.
4. Electricity rate: {{electricity_rate}} THB/unit
5. Water rate: {{water_rate}} THB/unit
6. No smoking inside the property.
7. No parties or events without prior approval.
8. Please take care of the property and report any damages immediately.`;
  };

  // Mobile Card Component
  const TemplateCard = ({ template }: { template: ConfirmationTemplate }) => (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{
        borderLeft: `4px solid ${template.is_active ? theme.colors.green[6] : theme.colors.gray[5]}`
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Box style={{ flex: 1 }}>
            <Text fw={700} size="md" lineClamp={1}>
              {template.name}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              {t('confirmationTemplates.createdAt')}: {dayjs(template.created_at).format('DD.MM.YYYY')}
            </Text>
          </Box>
          <Badge 
            size="sm" 
            color={template.is_active ? 'green' : 'gray'} 
            variant="light"
          >
            {template.is_active ? t('common.active') : t('common.inactive')}
          </Badge>
        </Group>

        <Text size="sm" c="dimmed" lineClamp={3}>
          {template.content}
        </Text>

        <Group gap="xs" grow>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={16} />}
            onClick={() => openPreviewModal(template)}
          >
            {t('common.view')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconEdit size={16} />}
            onClick={() => openEditModal(template)}
          >
            {t('common.edit')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => handleDelete(template)}
          >
            {t('common.delete')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg">
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" wrap="wrap">
          <Group gap="md">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => navigate('/financial-documents')}
            >
              {t('common.back')}
            </Button>
            <Divider orientation="vertical" />
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
                <IconTemplate size={20} />
              </ThemeIcon>
              <div>
                <Title order={3}>{t('confirmationTemplates.title')}</Title>
                <Text size="sm" c="dimmed">
                  {t('confirmationTemplates.subtitle')}
                </Text>
              </div>
            </Group>
          </Group>

          <Button
            leftSection={<IconPlus size={18} />}
            onClick={openCreateModal}
          >
            {t('confirmationTemplates.buttons.create')}
          </Button>
        </Group>
      </Card>

      {/* Templates List */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {loading ? (
          <Center py={60}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text size="sm" c="dimmed">
                {t('common.loading')}
              </Text>
            </Stack>
          </Center>
        ) : templates.length === 0 ? (
          <Paper p="xl" radius="md" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                  <IconTemplate size={30} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {t('confirmationTemplates.noTemplates')}
                </Text>
                <Button
                  variant="light"
                  leftSection={<IconPlus size={18} />}
                  onClick={openCreateModal}
                >
                  {t('confirmationTemplates.buttons.createFirst')}
                </Button>
              </Stack>
            </Center>
          </Paper>
        ) : isMobile ? (
          <Stack gap="md">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('confirmationTemplates.table.name')}</Table.Th>
                  <Table.Th>{t('confirmationTemplates.table.status')}</Table.Th>
                  <Table.Th>{t('confirmationTemplates.table.createdAt')}</Table.Th>
                  <Table.Th>{t('confirmationTemplates.table.createdBy')}</Table.Th>
                  <Table.Th w={80}>{t('confirmationTemplates.table.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templates.map((template) => (
                  <Table.Tr key={template.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <ThemeIcon size="sm" variant="light" color="teal">
                          <IconTemplate size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>
                          {template.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        size="sm" 
                        color={template.is_active ? 'green' : 'gray'} 
                        variant="light"
                      >
                        {template.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {dayjs(template.created_at).format('DD.MM.YYYY HH:mm')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {template.created_by_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEye size={16} />}
                            onClick={() => openPreviewModal(template)}
                          >
                            {t('common.view')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconEdit size={16} />}
                            onClick={() => openEditModal(template)}
                          >
                            {t('common.edit')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconCopy size={16} />}
                            onClick={() => handleDuplicate(template)}
                          >
                            {t('common.duplicate')}
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => handleDelete(template)}
                          >
                            {t('common.delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
              <IconTemplate size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {editingTemplate 
                ? t('confirmationTemplates.modal.editTitle') 
                : t('confirmationTemplates.modal.createTitle')
              }
            </Text>
          </Group>
        }
        size="lg"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack gap="md">
          <TextInput
            label={t('confirmationTemplates.fields.name')}
            placeholder={t('confirmationTemplates.placeholders.name')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            styles={{ input: { fontSize: '16px' } }}
          />

          <Alert
            icon={<IconInfoCircle size={18} />}
            title={t('confirmationTemplates.variables.title')}
            color="blue"
            variant="light"
          >
            <Text size="xs">
              {t('confirmationTemplates.variables.description')}
            </Text>
            <Text size="xs" mt="xs" style={{ fontFamily: 'monospace' }}>
              {'{{check_in_time}}, {{check_out_time}}, {{deposit_amount}}, {{electricity_rate}}, {{water_rate}}, {{property_name}}, {{property_address}}, {{arrival_date}}, {{departure_date}}, {{rate_amount}}, {{num_guests}}, {{num_rooms}}'}
            </Text>
          </Alert>

          <Textarea
            label={t('confirmationTemplates.fields.content')}
            placeholder={t('confirmationTemplates.placeholders.content')}
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            required
            minRows={10}
            maxRows={20}
            autosize
            styles={{ 
              input: { 
                fontSize: '14px', 
                fontFamily: 'monospace',
                lineHeight: 1.6
              } 
            }}
          />

          <Switch
            label={t('confirmationTemplates.fields.isActive')}
            description={t('confirmationTemplates.fields.isActiveDesc')}
            checked={formIsActive}
            onChange={(e) => setFormIsActive(e.currentTarget.checked)}
            size="md"
            thumbIcon={
              formIsActive ? (
                <IconCheck size={12} color={theme.colors.teal[6]} stroke={3} />
              ) : (
                <IconX size={12} color={theme.colors.red[6]} stroke={3} />
              )
            }
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setModalOpened(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              leftSection={<IconCheck size={18} />}
              onClick={handleSubmit}
              loading={formLoading}
              gradient={{ from: 'teal', to: 'green' }}
              variant="gradient"
            >
              {editingTemplate ? t('common.save') : t('common.create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Preview Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={() => setPreviewModalOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="teal">
              <IconEye size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {previewTemplate?.name}
            </Text>
          </Group>
        }
        size="lg"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {previewTemplate && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge 
                size="sm" 
                color={previewTemplate.is_active ? 'green' : 'gray'} 
                variant="light"
              >
                {previewTemplate.is_active ? t('common.active') : t('common.inactive')}
              </Badge>
              <Text size="xs" c="dimmed">
                {t('confirmationTemplates.createdAt')}: {dayjs(previewTemplate.created_at).format('DD.MM.YYYY HH:mm')}
              </Text>
            </Group>

            <Paper 
              p="md" 
              radius="md" 
              withBorder 
              style={{ 
                backgroundColor: theme.colors.gray[0],
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: 1.6
              }}
            >
              {previewTemplate.content}
            </Paper>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setPreviewModalOpened(false)}>
                {t('common.close')}
              </Button>
              <Button
                leftSection={<IconEdit size={18} />}
                onClick={() => {
                  setPreviewModalOpened(false);
                  openEditModal(previewTemplate);
                }}
              >
                {t('common.edit')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default ConfirmationTemplates;