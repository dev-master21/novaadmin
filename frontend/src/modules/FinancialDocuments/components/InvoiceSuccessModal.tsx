// frontend/src/modules/FinancialDocuments/components/InvoiceSuccessModal.tsx
import { useState } from 'react';
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
  useMantineTheme,
  Loader,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDownload,
  IconEdit,
  IconX,
  IconFileInvoice,
  IconAlertCircle,
  IconCurrencyBaht,
  IconCalendar,
  IconPackage
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi } from '@/api/financialDocuments.api';
import dayjs from 'dayjs';

interface InvoiceSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  invoiceId: number | null;
  invoiceNumber?: string;
  mode: 'create' | 'edit';
}

const InvoiceSuccessModal = ({
  visible,
  onClose,
  onEdit,
  invoiceId,
  invoiceNumber,
  mode
}: InvoiceSuccessModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  
  const [downloading, setDownloading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Загружаем данные инвойса при открытии модалки
  const loadInvoiceData = async () => {
    if (!invoiceId) return;
    
    try {
      setLoading(true);
      const response = await financialDocumentsApi.getInvoiceById(invoiceId);
      setInvoiceData(response.data.data);
    } catch (error) {
      console.error('Error loading invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем данные при открытии
  useState(() => {
    if (visible && invoiceId) {
      loadInvoiceData();
    }
  });

  const handleDownloadPDF = async () => {
    if (!invoiceId) return;

    try {
      setDownloading(true);

      // Получаем ID выбранных позиций из инвойса
      let selectedItemsIds: number[] = [];
      if (invoiceData && invoiceData.items) {
        selectedItemsIds = invoiceData.items
          .filter((item: any) => item.is_currently_selected === 1)
          .map((item: any) => item.id);
      }

      // Скачиваем PDF с выбранными позициями
      const response = await financialDocumentsApi.downloadInvoicePDF(
        invoiceId, 
        selectedItemsIds.length > 0 ? selectedItemsIds : undefined
      );

      // Создаём blob и скачиваем файл
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNumber || `invoice-${invoiceId}`}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: t('common.success'),
        message: t('financialDocuments.invoice.pdfDownloaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('financialDocuments.invoice.pdfDownloadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const getSelectedItemsCount = () => {
    if (!invoiceData || !invoiceData.items) return 0;
    return invoiceData.items.filter((item: any) => item.is_currently_selected === 1).length;
  };

  const getTotalSelectedAmount = () => {
    if (!invoiceData || !invoiceData.items) return 0;
    return invoiceData.items
      .filter((item: any) => item.is_currently_selected === 1)
      .reduce((sum: number, item: any) => sum + item.total_price, 0);
  };

  return (
    <Modal
      opened={visible}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon 
            size="xl" 
            radius="xl" 
            variant="gradient" 
            gradient={{ from: 'teal', to: 'green' }}
          >
            <IconCheck size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text size="lg" fw={700}>
              {mode === 'create' 
                ? t('financialDocuments.invoice.successCreated')
                : t('financialDocuments.invoice.successUpdated')}
            </Text>
            {invoiceNumber && (
              <Text size="sm" c="dimmed">
                {invoiceNumber}
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
        {/* Сообщение об успехе */}
        <Alert
          icon={<IconCheck size={18} />}
          title={
            mode === 'create'
              ? t('financialDocuments.invoice.createdSuccessfully')
              : t('financialDocuments.invoice.updatedSuccessfully')
          }
          color="green"
          variant="light"
        >
          {mode === 'create'
            ? t('financialDocuments.invoice.createdDescription')
            : t('financialDocuments.invoice.updatedDescription')}
        </Alert>

        {/* Информация об инвойсе */}
        {loading ? (
          <Paper p="lg" radius="md" withBorder style={{ textAlign: 'center' }}>
            <Loader size="md" />
          </Paper>
        ) : invoiceData ? (
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{
              background: `linear-gradient(135deg, ${theme.colors.blue[0]} 0%, ${theme.colors.cyan[0]} 100%)`
            }}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                    <IconFileInvoice size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    {t('financialDocuments.invoice.invoiceDetails')}
                  </Text>
                </Group>
                <Badge color="blue" variant="light">
                  {invoiceData.status}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Group gap="xs">
                  <IconCalendar size={16} color={theme.colors.gray[6]} />
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.date')}:
                  </Text>
                </Group>
                <Text size="sm" fw={600}>
                  {dayjs(invoiceData.invoice_date).format('DD.MM.YYYY')}
                </Text>
              </Group>

              {invoiceData.due_date && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCalendar size={16} color={theme.colors.orange[6]} />
                    <Text size="sm" c="dimmed">
                      {t('financialDocuments.invoice.dueDate')}:
                    </Text>
                  </Group>
                  <Text size="sm" fw={600}>
                    {dayjs(invoiceData.due_date).format('DD.MM.YYYY')}
                  </Text>
                </Group>
              )}

              <Group justify="space-between">
                <Group gap="xs">
                  <IconPackage size={16} color={theme.colors.blue[6]} />
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.totalItems')}:
                  </Text>
                </Group>
                <Text size="sm" fw={600}>
                  {invoiceData.items?.length || 0}
                </Text>
              </Group>

              <Group justify="space-between">
                <Group gap="xs">
                  <IconPackage size={16} color={theme.colors.green[6]} />
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.selectedItems')}:
                  </Text>
                </Group>
                <Badge color="green" variant="light">
                  {getSelectedItemsCount()}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Group gap="xs">
                  <IconCurrencyBaht size={16} color={theme.colors.gray[6]} />
                  <Text size="sm" c="dimmed">
                    {t('financialDocuments.invoice.totalAmount')}:
                  </Text>
                </Group>
                <Text size="md" fw={700} c="blue">
                  {formatCurrency(invoiceData.total_amount)} THB
                </Text>
              </Group>

              {getSelectedItemsCount() > 0 && getSelectedItemsCount() < (invoiceData.items?.length || 0) && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCurrencyBaht size={16} color={theme.colors.green[6]} />
                    <Text size="sm" c="dimmed">
                      {t('financialDocuments.invoice.amountToPay')}:
                    </Text>
                  </Group>
                  <Text size="md" fw={700} c="green">
                    {formatCurrency(getTotalSelectedAmount())} THB
                  </Text>
                </Group>
              )}

              {invoiceData.amount_paid > 0 && (
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCheck size={16} color={theme.colors.teal[6]} />
                    <Text size="sm" c="dimmed">
                      {t('financialDocuments.invoice.alreadyPaid')}:
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} c="teal">
                    {formatCurrency(invoiceData.amount_paid)} THB
                  </Text>
                </Group>
              )}
            </Stack>
          </Paper>
        ) : null}

        {/* Предупреждение о выбранных позициях */}
        {invoiceData && getSelectedItemsCount() < (invoiceData.items?.length || 0) && (
          <Alert
            icon={<IconAlertCircle size={18} />}
            title={t('financialDocuments.invoice.partialPayment')}
            color="yellow"
            variant="light"
          >
            {t('financialDocuments.invoice.partialPaymentDescription', {
              selected: getSelectedItemsCount(),
              total: invoiceData.items?.length || 0
            })}
          </Alert>
        )}

        {/* Кнопки действий */}
        <Stack gap="sm">
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={handleDownloadPDF}
            loading={downloading}
            size="lg"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            fullWidth
          >
            {t('financialDocuments.invoice.downloadPDF')}
          </Button>

          <Group grow>
            {onEdit && (
              <Button
                leftSection={<IconEdit size={18} />}
                onClick={handleEdit}
                variant="light"
                color="blue"
              >
                {t('financialDocuments.invoice.editInvoice')}
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="subtle"
              color="gray"
            >
              {t('common.close')}
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Modal>
  );
};

export default InvoiceSuccessModal;