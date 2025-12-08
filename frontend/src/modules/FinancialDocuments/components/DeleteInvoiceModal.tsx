// frontend/src/modules/FinancialDocuments/components/DeleteInvoiceModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Paper,
  Divider,
  Badge,
  Checkbox,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
  Loader
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconFileInvoice,
  IconReceipt,
  IconCurrencyBaht,
  IconCalendar,
  IconFileText
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi } from '@/api/financialDocuments.api';
import dayjs from 'dayjs';

interface DeleteInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoiceId: number | null;
}

const DeleteInvoiceModal = ({
  visible,
  onClose,
  onSuccess,
  invoiceId
}: DeleteInvoiceModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme(); // ✅ ДОБАВЛЕНО
  const isDark = colorScheme === 'dark'; // ✅ ДОБАВЛЕНО
  
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReceipts, setDeleteReceipts] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  useEffect(() => {
    if (visible && invoiceId) {
      loadInvoiceData();
    } else {
      setDeleteReceipts(false);
      setInvoiceData(null);
    }
  }, [visible, invoiceId]);

  const loadInvoiceData = async () => {
    if (!invoiceId) return;
    
    try {
      setLoading(true);
      const response = await financialDocumentsApi.getInvoiceById(invoiceId);
      setInvoiceData(response.data.data);
    } catch (error) {
      console.error('Error loading invoice data:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('financialDocuments.invoice.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoiceId) return;

    try {
      setDeleting(true);

      await financialDocumentsApi.deleteInvoice(invoiceId, deleteReceipts);

      notifications.show({
        title: t('common.success'),
        message: deleteReceipts 
          ? t('financialDocuments.invoice.deletedWithReceipts')
          : t('financialDocuments.invoice.deleted'),
        color: 'green',
        icon: <IconCheck size={18} />
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('financialDocuments.invoice.deleteError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const hasReceipts = invoiceData?.receipts_count > 0;

  return (
    <Modal
      opened={visible}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon 
            size="xl" 
            radius="xl" 
            color="red"
            variant="light"
          >
            <IconTrash size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text size="lg" fw={700} c="red">
              {t('financialDocuments.invoice.deleteTitle')}
            </Text>
            {invoiceData && (
              <Text size="sm" c="dimmed">
                {invoiceData.invoice_number}
              </Text>
            )}
          </Stack>
        </Group>
      }
      size="md"
      centered
      closeOnClickOutside={false}
    >
      <Stack gap="lg">
        {/* Предупреждение об удалении */}
        <Alert
          icon={<IconAlertTriangle size={18} />}
          title={t('financialDocuments.invoice.deleteWarning')}
          color="red"
          variant="light"
        >
          {t('financialDocuments.invoice.deleteWarningDescription')}
        </Alert>

        {/* Информация об инвойсе */}
        {loading ? (
          <Paper 
            p="lg" 
            radius="md" 
            withBorder 
            style={{ 
              textAlign: 'center',
              background: isDark ? theme.colors.dark[6] : 'white' // ✅ АДАПТИРОВАНО
            }}
          >
            <Loader size="md" />
          </Paper>
        ) : invoiceData ? (
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{
              background: isDark ? theme.colors.dark[6] : theme.colors.gray[0], // ✅ АДАПТИРОВАНО
              borderColor: theme.colors.red[isDark ? 7 : 3] // ✅ АДАПТИРОВАНО
            }}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="md" variant="light" color="red">
                    <IconFileInvoice size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={600} c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                    {t('financialDocuments.invoice.invoiceDetails')}
                  </Text>
                </Group>
                <Badge color="gray" variant="light">
                  {invoiceData.status}
                </Badge>
              </Group>

              <Divider color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} /> {/* ✅ АДАПТИРОВАНО */}

              <Group justify="space-between">
                <Group gap="xs">
                  <IconFileText size={16} color={isDark ? theme.colors.gray[5] : theme.colors.gray[6]} /> {/* ✅ АДАПТИРОВАНО */}
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.number')}:
                  </Text>
                </Group>
                <Text size="sm" fw={600} c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                  {invoiceData.invoice_number}
                </Text>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconCalendar size={16} color={isDark ? theme.colors.gray[5] : theme.colors.gray[6]} /> {/* ✅ АДАПТИРОВАНО */}
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.date')}:
                  </Text>
                </Group>
                <Text size="sm" fw={600} c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                  {dayjs(invoiceData.invoice_date).format('DD.MM.YYYY')}
                </Text>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconCurrencyBaht size={16} color={isDark ? theme.colors.gray[5] : theme.colors.gray[6]} /> {/* ✅ АДАПТИРОВАНО */}
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.totalAmount')}:
                  </Text>
                </Group>
                <Text size="sm" fw={700} c={isDark ? 'gray.2' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                  {formatCurrency(invoiceData.total_amount)} THB
                </Text>
              </Group>

              {invoiceData.amount_paid > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCheck size={16} color={theme.colors.green[6]} />
                    <Text size="sm" c="dimmed">
                      {t('financialDocuments.invoice.alreadyPaid')}:
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} c="green">
                    {formatCurrency(invoiceData.amount_paid)} THB
                  </Text>
                </Group>
              )}

              <Divider color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} /> {/* ✅ АДАПТИРОВАНО */}

              <Group justify="space-between">
                <Group gap="xs">
                  <IconReceipt size={16} color={isDark ? theme.colors.blue[4] : theme.colors.blue[6]} /> {/* ✅ АДАПТИРОВАНО */}
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.attachedReceipts')}:
                  </Text>
                </Group>
                <Badge 
                  color={hasReceipts ? 'blue' : 'gray'} 
                  variant="light"
                  size="lg"
                >
                  {invoiceData.receipts_count || 0}
                </Badge>
              </Group>

              {invoiceData.items && invoiceData.items.length > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconFileText size={16} color={isDark ? theme.colors.gray[5] : theme.colors.gray[6]} /> {/* ✅ АДАПТИРОВАНО */}
                    <Text size="sm" c="dimmed">
                      {t('financialDocuments.invoice.items')}:
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                    {invoiceData.items.length}
                  </Text>
                </Group>
              )}
            </Stack>
          </Paper>
        ) : null}

        {/* Чекбокс для удаления связанных чеков */}
        {hasReceipts && (
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{
              background: deleteReceipts 
                ? (isDark ? theme.colors.dark[5] : theme.colors.red[0]) // ✅ АДАПТИРОВАНО
                : (isDark ? theme.colors.dark[6] : theme.colors.yellow[0]), // ✅ АДАПТИРОВАНО
              borderColor: deleteReceipts 
                ? theme.colors.red[isDark ? 7 : 3] // ✅ АДАПТИРОВАНО
                : theme.colors.yellow[isDark ? 7 : 3] // ✅ АДАПТИРОВАНО
            }}
          >
            <Stack gap="sm">
              <Alert
                icon={<IconAlertTriangle size={18} />}
                title={t('financialDocuments.invoice.receiptsAttached')}
                color={deleteReceipts ? 'red' : 'yellow'}
                variant="light"
                styles={{
                  root: { background: 'transparent', border: 'none' }
                }}
              >
                <Text size="sm" c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                  {deleteReceipts 
                    ? t('financialDocuments.invoice.receiptsWillBeDeleted', { count: invoiceData.receipts_count })
                    : t('financialDocuments.invoice.receiptsWillRemain', { count: invoiceData.receipts_count })}
                </Text>
              </Alert>

              <Checkbox
                label={
                  <Text size="sm" fw={600} c={isDark ? 'gray.3' : 'dark'}> {/* ✅ АДАПТИРОВАНО */}
                    {t('financialDocuments.invoice.deleteReceiptsCheckbox')}
                  </Text>
                }
                checked={deleteReceipts}
                onChange={(e) => setDeleteReceipts(e.currentTarget.checked)}
                color="red"
                size="md"
              />
            </Stack>
          </Paper>
        )}

        {/* Финальное предупреждение */}
        <Alert
          icon={<IconAlertTriangle size={18} />}
          title={t('common.warning')}
          color="orange"
          variant="filled"
        >
          <Stack gap="xs">
            <Text size="sm" c="white" fw={600}>
              {t('financialDocuments.invoice.deleteConfirmation')}
            </Text>
            <Text size="xs" c="white" opacity={0.9}>
              {t('financialDocuments.invoice.cannotBeUndone')}
            </Text>
          </Stack>
        </Alert>

        {/* Кнопки действий */}
        <Group grow>
          <Button
            variant="light"
            color="gray"
            onClick={onClose}
            disabled={deleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            leftSection={<IconTrash size={18} />}
            onClick={handleDelete}
            loading={deleting}
            color="red"
            variant="filled"
          >
            {deleteReceipts 
              ? t('financialDocuments.invoice.deleteWithReceipts')
              : t('financialDocuments.invoice.deleteInvoice')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DeleteInvoiceModal;