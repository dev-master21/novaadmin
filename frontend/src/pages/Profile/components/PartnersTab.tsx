// frontend/src/pages/Profile/components/PartnersTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Button,
  Table,
  Modal,
  TextInput,
  Switch,
  Group,
  Text,
  Badge,
  ActionIcon,
  FileInput,
  Alert,
  LoadingOverlay,
  ColorInput,
  Box,
  Divider,
  Tooltip
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconUpload,
  IconAlertCircle,
  IconCheck,
  IconInfoCircle,
  IconPalette,
  IconPhone,
  IconMail,
  IconAddressBook
} from '@tabler/icons-react';
import { partnersApi, Partner, CreatePartnerDTO, UpdatePartnerDTO } from '@/api/partners.api';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

const PartnersTab: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Form state
  const [partnerName, setPartnerName] = useState('');
  const [domain, setDomain] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Color state
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');

  // Contact state
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const data = await partnersApi.getAll();
      setPartners(data);
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось загрузить список партнёров',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setPartnerName(partner.partner_name || '');
      setDomain(partner.domain || '');
      setIsActive(partner.is_active);
      // Загружаем цвета
      setPrimaryColor(partner.primary_color || '');
      setSecondaryColor(partner.secondary_color || '');
      setAccentColor(partner.accent_color || '');
      // Загружаем контакты
      setPhone(partner.phone || '');
      setEmail(partner.email || '');
    } else {
      setEditingPartner(null);
      setPartnerName('');
      setDomain('');
      setIsActive(true);
      // Сбрасываем цвета
      setPrimaryColor('');
      setSecondaryColor('');
      setAccentColor('');
      // Сбрасываем контакты
      setPhone('');
      setEmail('');
    }
    setLogoFile(null);
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setEditingPartner(null);
    setPartnerName('');
    setDomain('');
    setIsActive(true);
    setLogoFile(null);
    // Сбрасываем цвета
    setPrimaryColor('');
    setSecondaryColor('');
    setAccentColor('');
    // Сбрасываем контакты
    setPhone('');
    setEmail('');
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (editingPartner) {
        // Обновление
        const updateData: UpdatePartnerDTO = {
          partner_name: partnerName || undefined,
          domain: domain || undefined,
          is_active: isActive,
          primary_color: primaryColor || undefined,
          secondary_color: secondaryColor || undefined,
          accent_color: accentColor || undefined,
          phone: phone || undefined,
          email: email || undefined
        };
        if (logoFile) {
          updateData.logo = logoFile;
        }

        await partnersApi.update(editingPartner.id, updateData);
        notifications.show({
          title: 'Успешно',
          message: 'Партнёр обновлён',
          color: 'green'
        });
      } else {
        // Создание
        const createData: CreatePartnerDTO = {
          partner_name: partnerName || undefined,
          domain: domain || undefined,
          is_active: isActive,
          primary_color: primaryColor || undefined,
          secondary_color: secondaryColor || undefined,
          accent_color: accentColor || undefined,
          phone: phone || undefined,
          email: email || undefined
        };
        if (logoFile) {
          createData.logo = logoFile;
        }

        await partnersApi.create(createData);
        notifications.show({
          title: 'Успешно',
          message: 'Партнёр создан',
          color: 'green'
        });
      }

      handleCloseModal();
      loadPartners();
    } catch (error: any) {
      notifications.show({
        title: 'Ошибка',
        message: error.response?.data?.message || 'Не удалось сохранить партнёра',
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого партнёра?')) {
      return;
    }

    try {
      await partnersApi.delete(id);
      notifications.show({
        title: 'Успешно',
        message: 'Партнёр удалён',
        color: 'green'
      });
      loadPartners();
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось удалить партнёра',
        color: 'red'
      });
    }
  };

  // Компонент для отображения цветов в таблице
  const ColorPreview = ({ color, label }: { color: string | null; label: string }) => {
    if (!color) return null;
    return (
      <Group gap={4}>
        <Box
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: color,
            border: '1px solid #dee2e6'
          }}
        />
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
    );
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <Title order={4}>Партнёры</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => handleOpenModal()}
        >
          Добавить партнёра
        </Button>
      </Group>

      <Alert icon={<IconAlertCircle size={16} />} color="blue">
        Здесь вы можете управлять партнёрами и их логотипами. Логотип будет отображаться
        на главной странице в зависимости от домена.
      </Alert>

      {/* ✅ НОВОЕ: Информация о работе с поддоменами */}
      <Alert icon={<IconInfoCircle size={16} />} color="violet" title="Работа с доменами">
        <Text size="sm">
          При указании домена используйте <strong>только основной домен</strong> без поддоменов.
          <br />
          Например: укажите <code>warmplus.club</code>, и система автоматически определит партнёра для 
          <code> admin.warmplus.club</code>, <code>owner.warmplus.club</code> и других поддоменов.
        </Text>
      </Alert>

      <div style={{ position: 'relative', minHeight: 200 }}>
        <LoadingOverlay visible={loading} />

        {!loading && partners.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Партнёры не найдены. Добавьте первого партнёра.
          </Text>
        )}

        {!loading && partners.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Домен</Table.Th>
                <Table.Th>Логотип</Table.Th>
                <Table.Th>Контакты</Table.Th>
                <Table.Th>Цвета</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Создан</Table.Th>
                <Table.Th>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {partners.map((partner) => (
                <Table.Tr key={partner.id}>
                  <Table.Td>{partner.partner_name || '-'}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {partner.domain || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {partner.logo_filename && (
                      <Group gap="xs">
                        <img
                          src={`/${partner.logo_filename}`}
                          alt="Logo"
                          style={{ height: 24, width: 'auto' }}
                        />
                        <Text size="xs" c="dimmed">
                          {partner.logo_filename}
                        </Text>
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      {partner.phone && (
                        <Tooltip label={partner.phone} position="left">
                          <Group gap={4}>
                            <IconPhone size={14} style={{ color: 'var(--mantine-color-blue-5)' }} />
                            <Text size="xs" c="dimmed" lineClamp={1} maw={120}>
                              {partner.phone}
                            </Text>
                          </Group>
                        </Tooltip>
                      )}
                      {partner.email && (
                        <Tooltip label={partner.email} position="left">
                          <Group gap={4}>
                            <IconMail size={14} style={{ color: 'var(--mantine-color-green-5)' }} />
                            <Text size="xs" c="dimmed" lineClamp={1} maw={120}>
                              {partner.email}
                            </Text>
                          </Group>
                        </Tooltip>
                      )}
                      {!partner.phone && !partner.email && (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <ColorPreview color={partner.primary_color} label="Осн." />
                      <ColorPreview color={partner.secondary_color} label="Втор." />
                      <ColorPreview color={partner.accent_color} label="Поб." />
                      {!partner.primary_color && !partner.secondary_color && !partner.accent_color && (
                        <Text size="xs" c="dimmed">-</Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={partner.is_active ? 'green' : 'gray'}>
                      {partner.is_active ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {dayjs(partner.created_at).format('DD.MM.YYYY HH:mm')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleOpenModal(partner)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(partner.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>

      {/* Модальное окно для создания/редактирования */}
      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={editingPartner ? 'Редактировать партнёра' : 'Добавить партнёра'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Название партнёра"
            placeholder="WarmPlus"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
          />

          <TextInput
            label="Основной домен"
            placeholder="warmplus.club"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            description="Указывайте только основной домен без поддоменов (например: warmplus.club)"
          />

          <FileInput
            label="Логотип (.svg)"
            placeholder="Выберите файл"
            accept=".svg,image/svg+xml"
            leftSection={<IconUpload size={16} />}
            value={logoFile}
            onChange={setLogoFile}
            description="Только .svg файлы, максимум 5MB"
          />

          {editingPartner?.logo_filename && !logoFile && (
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              Текущий логотип: {editingPartner.logo_filename}
            </Alert>
          )}

          <Divider 
            label={
              <Group gap={6}>
                <IconAddressBook size={14} />
                <Text size="sm">Контактная информация</Text>
              </Group>
            } 
            labelPosition="center" 
          />

          <Group grow>
            <TextInput
              label="Телефон"
              placeholder="+6661008937"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftSection={<IconPhone size={16} />}
              description="Телефон для документов и связи"
            />

            <TextInput
              label="Email"
              placeholder="service@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftSection={<IconMail size={16} />}
              description="Email для документов и связи"
            />
          </Group>

          <Alert color="gray" icon={<IconInfoCircle size={16} />} variant="light">
            <Text size="xs">
              Если телефон и email не указаны, в документах будут использованы значения по умолчанию:
              <br />
              Телефон: <strong>+6661008937</strong>, Email: <strong>service@novaestate.company</strong>
            </Text>
          </Alert>

          <Divider 
            label={
              <Group gap={6}>
                <IconPalette size={14} />
                <Text size="sm">Цветовая схема</Text>
              </Group>
            } 
            labelPosition="center" 
          />

          <ColorInput
            label="Основной цвет (Primary)"
            placeholder="#4096ff"
            value={primaryColor}
            onChange={setPrimaryColor}
            format="hex"
            swatches={['#4096ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa541c']}
            description="Основной цвет бренда партнёра"
          />

          <ColorInput
            label="Вторичный цвет (Secondary)"
            placeholder="#f0f5ff"
            value={secondaryColor}
            onChange={setSecondaryColor}
            format="hex"
            swatches={['#f0f5ff', '#f6ffed', '#fffbe6', '#fff2f0', '#f9f0ff', '#e6fffb', '#fff0f6', '#fff7e6']}
            description="Вторичный/фоновый цвет"
          />

          <ColorInput
            label="Побочный цвет (Accent)"
            placeholder="#1890ff"
            value={accentColor}
            onChange={setAccentColor}
            format="hex"
            swatches={['#1890ff', '#389e0d', '#d48806', '#cf1322', '#531dab', '#08979c', '#c41d7f', '#d4380d']}
            description="Акцентный цвет для выделения элементов"
          />

          <Switch
            label="Активен"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleCloseModal}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              leftSection={<IconCheck size={16} />}
            >
              {editingPartner ? 'Сохранить' : 'Создать'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default PartnersTab;