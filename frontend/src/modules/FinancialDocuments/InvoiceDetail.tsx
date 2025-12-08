// frontend/src/modules/FinancialDocuments/InvoiceDetail.tsx
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
  Image,
  Center,
  Loader,
  Divider,
  Box,
  ThemeIcon,
  useMantineTheme,
  RingProgress,
  SimpleGrid,
  Table,
  Progress
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconTrash,
  IconDownload,
  IconFileText,
  IconQrcode,
  IconEdit,
  IconLink,
  IconCheck,
  IconX,
  IconCurrencyBaht,
  IconCalendar,
  IconUser,
  IconFileInvoice,
  IconReceipt,
  IconCreditCard,
  IconBuildingBank,
  IconPackage,
  IconAlertCircle,
  IconBuilding,
  IconClock,
  IconInfoCircle,
  IconChartPie,
  IconPercentage,
  IconCheckbox
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Invoice } from '@/api/financialDocuments.api';
import CreateInvoiceModal from './components/CreateInvoiceModal';
import DeleteInvoiceModal from './components/DeleteInvoiceModal';
import SelectInvoiceItemsModal from './components/SelectInvoiceItemsModal';

const InvoiceDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  // 🆕 МОДАЛЬНОЕ ОКНО ВЫБОРА ПОЗИЦИЙ ДЛЯ PDF
  const [pdfSelectionModalVisible, setPdfSelectionModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getInvoiceById(Number(id));
      setInvoice(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('invoiceDetail.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/financial-documents');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invoice?.uuid) {
      notifications.show({
        title: t('errors.generic'),
        message: t('invoiceDetail.messages.uuidNotFound'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }
    
    const link = `https://admin.novaestate.company/invoice-verify/${invoice.uuid}`;
    try {
      await navigator.clipboard.writeText(link);
      notifications.show({
        title: t('common.success'),
        message: t('invoiceDetail.messages.linkCopied'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error) {
      notifications.show({
        title: t('errors.generic'),
        message: t('invoiceDetail.messages.linkCopyError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  // 🆕 ОТКРЫВАЕМ МОДАЛЬНОЕ ОКНО ВЫБОРА ПОЗИЦИЙ
  const handleDownloadPDF = () => {
    setPdfSelectionModalVisible(true);
  };

  // 🆕 СКАЧИВАНИЕ PDF С ВЫБРАННЫМИ ПОЗИЦИЯМИ
  const handleDownloadPDFWithSelection = async (selectedIds: number[]) => {
    try {
      setPdfSelectionModalVisible(false);
      
      notifications.show({
        id: 'pdf-download',
        loading: true,
        title: t('invoiceDetail.messages.generatingPDF'),
        message: t('common.pleaseWait'),
        autoClose: false,
        withCloseButton: false
      });

      const response = await financialDocumentsApi.downloadInvoicePDF(
        Number(id),
        selectedIds.length > 0 ? selectedIds : undefined
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.update({
        id: 'pdf-download',
        color: 'green',
        title: t('common.success'),
        message: t('invoiceDetail.messages.pdfDownloaded'),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });
    } catch (error: any) {
      notifications.update({
        id: 'pdf-download',
        color: 'red',
        title: t('errors.generic'),
        message: t('invoiceDetail.messages.pdfDownloadError'),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000
      });
    }
  };

  // 🆕 ПОЛУЧАЕМ СПИСОК НЕОПЛАЧЕННЫХ ПОЗИЦИЙ ПО УМОЛЧАНИЮ
  const getDefaultSelectedItems = (): number[] => {
    if (!invoice?.items) return [];
    return invoice.items
      .filter((item: any) => item.is_fully_paid !== 1)
      .map((item: any) => item.id);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      draft: { color: 'gray', icon: <IconEdit size={14} /> },
      sent: { color: 'blue', icon: <IconClock size={14} /> },
      partially_paid: { color: 'yellow', icon: <IconPercentage size={14} /> },
      paid: { color: 'green', icon: <IconCheck size={14} /> },
      overdue: { color: 'red', icon: <IconAlertCircle size={14} /> },
      cancelled: { color: 'gray', icon: <IconX size={14} /> }
    };
    
    const config = statusConfig[status] || { color: 'gray', icon: null };
    const text = t(`invoiceDetail.statuses.${status}`);
    
    return (
      <Badge 
        size="lg" 
        color={config.color} 
        variant="light"
        leftSection={config.icon}
      >
        {text}
      </Badge>
    );
  };

  const getPaymentMethodText = (method: string) => {
    return t(`invoiceDetail.paymentMethods.${method}`);
  };

  const getReceiptStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: 'blue', icon: <IconClock size={12} /> },
      verified: { color: 'green', icon: <IconCheck size={12} /> },
      rejected: { color: 'red', icon: <IconX size={12} /> }
    };
    
    const config = statusConfig[status] || { color: 'gray', icon: null };
    const text = t(`invoiceDetail.receiptStatuses.${status}`);
    
    return (
      <Badge 
        size="sm" 
        color={config.color} 
        variant="light"
        leftSection={config.icon}
      >
        {text}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (loading) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            {t('invoiceDetail.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!invoice) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={80} radius="xl" variant="light" color="red">
            <IconFileInvoice size={40} />
          </ThemeIcon>
          <Text size="lg" fw={600}>
            {t('invoiceDetail.notFound')}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => navigate('/financial-documents')}
          >
            {t('invoiceDetail.buttons.backToList')}
          </Button>
        </Stack>
      </Center>
    );
  }

  const paymentProgress = (invoice.amount_paid / invoice.total_amount) * 100;
  const remainingAmount = invoice.total_amount - invoice.amount_paid;

  // 🆕 Подсчёт оплаченных позиций
  const paidItemsCount = invoice.items?.filter((item: any) => item.is_fully_paid === 1).length || 0;
  const totalItemsCount = invoice.items?.length || 0;

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

  const PartyCard = ({ 
    title, 
    type, 
    data 
  }: { 
    title: string; 
    type: 'company' | 'individual'; 
    data: any;
  }) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="violet">
            {type === 'company' ? <IconBuilding size={20} /> : <IconUser size={20} />}
          </ThemeIcon>
          <Title order={5}>{title}</Title>
        </Group>

        <Stack gap="xs">
          {type === 'company' ? (
            <>
              <InfoItem
                icon={<IconBuilding size={18} />}
                label={t('invoiceDetail.fields.company')}
                value={data.company_name}
                color="blue"
              />
              <InfoItem
                icon={<IconFileText size={18} />}
                label={t('invoiceDetail.fields.taxId')}
                value={data.company_tax_id}
                color="gray"
              />
              {data.company_address && (
                <InfoItem
                  icon={<IconInfoCircle size={18} />}
                  label={t('invoiceDetail.fields.address')}
                  value={data.company_address}
                  color="teal"
                />
              )}
              {data.director_name && (
                <InfoItem
                  icon={<IconUser size={18} />}
                  label={t('invoiceDetail.fields.director')}
                  value={data.director_name}
                  color="violet"
                />
              )}
            </>
          ) : (
            <>
              <InfoItem
                icon={<IconUser size={18} />}
                label={t('invoiceDetail.fields.fullName')}
                value={data.individual_name}
                color="blue"
              />
              <InfoItem
                icon={<IconInfoCircle size={18} />}
                label={t('invoiceDetail.fields.country')}
                value={data.individual_country}
                color="teal"
              />
              <InfoItem
                icon={<IconFileText size={18} />}
                label={t('invoiceDetail.fields.passport')}
                value={data.individual_passport}
                color="gray"
              />
            </>
          )}
        </Stack>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg" p={isMobile ? 'sm' : 'md'}>
      {/* Кнопка назад для мобильных */}
      {isMobile && (
        <Button
          variant="light"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => navigate('/financial-documents')}
          fullWidth
        >
          {t('invoiceDetail.buttons.backToList')}
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
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                <IconFileInvoice size={24} />
              </ThemeIcon>
              <Box>
                <Group gap="xs">
                  <Title order={isMobile ? 4 : 3}>
                    {invoice.invoice_number}
                  </Title>
                  {getStatusBadge(invoice.status)}
                </Group>
                <Text size="xs" c="dimmed">
                  {t('invoiceDetail.title')}
                </Text>
              </Box>
            </Group>

            {!isMobile && (
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => navigate('/financial-documents')}
              >
                {t('invoiceDetail.buttons.back')}
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
              {!isMobile && t('invoiceDetail.buttons.edit')}
            </Button>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconLink size={18} />}
              onClick={handleCopyLink}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('invoiceDetail.buttons.copyLink')}
            </Button>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={18} />}
              onClick={handleDownloadPDF}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('invoiceDetail.buttons.downloadPDF')}
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={18} />}
              onClick={() => setDeleteModalVisible(true)}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Статистика с прогрессом */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                <IconChartPie size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.paymentStatus')}</Title>
            </Group>

            <RingProgress
              size={80}
              thickness={8}
              sections={[
                { value: paymentProgress, color: 'green' },
                { value: 100 - paymentProgress, color: 'gray' }
              ]}
              label={
                <Center>
                  <Text size="xs" fw={700}>
                    {Math.round(paymentProgress)}%
                  </Text>
                </Center>
              }
            />
          </Group>

          <Progress.Root size="xl">
            <Progress.Section value={paymentProgress} color="green">
              <Progress.Label>{t('invoiceDetail.stats.paid')}</Progress.Label>
            </Progress.Section>
            <Progress.Section value={100 - paymentProgress} color="yellow">
              <Progress.Label>{t('invoiceDetail.stats.remaining')}</Progress.Label>
            </Progress.Section>
          </Progress.Root>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Paper
                p="lg"
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
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon size="md" radius="md" variant="white" color="blue">
                      <IconCurrencyBaht size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="white" opacity={0.9}>
                      {t('invoiceDetail.stats.totalAmount')}
                    </Text>
                  </Group>
                  <Group align="baseline" gap={4}>
                    <Text size="1.8rem" fw={700} c="white" style={{ lineHeight: 1 }}>
                      {formatCurrency(invoice.total_amount)}
                    </Text>
                    <Text size="md" c="white" opacity={0.9}>
                      {t('common.currencyTHB')}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Paper
                p="lg"
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
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon size="md" radius="md" variant="white" color="green">
                      <IconCheck size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="white" opacity={0.9}>
                      {t('invoiceDetail.stats.paid')}
                    </Text>
                  </Group>
                  <Group align="baseline" gap={4}>
                    <Text size="1.8rem" fw={700} c="white" style={{ lineHeight: 1 }}>
                      {formatCurrency(invoice.amount_paid)}
                    </Text>
                    <Text size="md" c="white" opacity={0.9}>
                      {t('common.currencyTHB')}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Paper
                p="lg"
                radius="md"
                withBorder
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.yellow[9]} 0%, ${theme.colors.orange[9]} 100%)`,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.yellow[9]}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon size="md" radius="md" variant="white" color="yellow">
                      <IconAlertCircle size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="white" opacity={0.9}>
                      {t('invoiceDetail.stats.remaining')}
                    </Text>
                  </Group>
                  <Group align="baseline" gap={4}>
                    <Text size="1.8rem" fw={700} c="white" style={{ lineHeight: 1 }}>
                      {formatCurrency(remainingAmount)}
                    </Text>
                    <Text size="md" c="white" opacity={0.9}>
                      {t('common.currencyTHB')}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Основная информация */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconInfoCircle size={20} />
            </ThemeIcon>
            <Title order={4}>{t('invoiceDetail.sections.mainInfo')}</Title>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <InfoItem
              icon={<IconCalendar size={20} />}
              label={t('invoiceDetail.fields.invoiceDate')}
              value={new Date(invoice.invoice_date).toLocaleDateString('ru-RU')}
              color="teal"
            />

            <InfoItem
              icon={<IconClock size={20} />}
              label={t('invoiceDetail.fields.dueDate')}
              value={
                invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString('ru-RU')
                  : t('invoiceDetail.notSpecified')
              }
              color="orange"
            />

            {invoice.agreement_number && (
              <InfoItem
                icon={<IconFileText size={20} />}
                label={t('invoiceDetail.fields.agreement')}
                value={
                  <Button
                    variant="subtle"
                    size="xs"
                    p={0}
                    onClick={() => navigate(`/agreements/${invoice.agreement_id}`)}
                  >
                    {invoice.agreement_number}
                  </Button>
                }
                color="violet"
              />
            )}

            <InfoItem
              icon={<IconUser size={20} />}
              label={t('invoiceDetail.fields.created')}
              value={
                <>
                  {new Date(invoice.created_at).toLocaleDateString('ru-RU')}
                  {invoice.created_by_name && (
                    <>
                      <br />
                      <Text size="xs" c="dimmed">
                        {invoice.created_by_name}
                      </Text>
                    </>
                  )}
                </>
              }
              color="gray"
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* От / Кому */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <PartyCard
          title={t('invoiceDetail.sections.from')}
          type={invoice.from_type as 'company' | 'individual'}
          data={{
            company_name: invoice.from_company_name,
            company_tax_id: invoice.from_company_tax_id,
            company_address: invoice.from_company_address,
            director_name: invoice.from_director_name,
            individual_name: invoice.from_individual_name,
            individual_country: invoice.from_individual_country,
            individual_passport: invoice.from_individual_passport
          }}
        />

        <PartyCard
          title={t('invoiceDetail.sections.to')}
          type={invoice.to_type as 'company' | 'individual'}
          data={{
            company_name: invoice.to_company_name,
            company_tax_id: invoice.to_company_tax_id,
            company_address: invoice.to_company_address,
            director_name: invoice.to_director_name,
            individual_name: invoice.to_individual_name,
            individual_country: invoice.to_individual_country,
            individual_passport: invoice.to_individual_passport
          }}
        />
      </SimpleGrid>

      {/* Позиции инвойса */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconPackage size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.items')}</Title>
            </Group>
            {/* 🆕 BADGE С КОЛИЧЕСТВОМ ОПЛАЧЕННЫХ ПОЗИЦИЙ */}
            <Badge 
              size="lg" 
              color={paidItemsCount === totalItemsCount ? 'green' : 'yellow'}
              variant="light"
              leftSection={<IconCheckbox size={16} />}
            >
              Paid {paidItemsCount}/{totalItemsCount} items
            </Badge>
          </Group>

          {isMobile ? (
            <Stack gap="xs">
              {invoice.items && invoice.items.map((item: any, index) => {
                const isPaid = item.is_fully_paid === 1;
                
                return (
                  <Paper
                    key={item.id || index}
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      borderLeft: `4px solid ${isPaid ? theme.colors.green[6] : theme.colors.blue[6]}`,
                      backgroundColor: isPaid ? theme.colors.green[0] : 'white',
                      opacity: isPaid ? 0.9 : 1
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = theme.shadows.md;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start">
                        <Box style={{ flex: 1 }}>
                          <Group gap="xs" mb={4}>
                            <Badge size="xs" variant="light">
                              {index + 1}
                            </Badge>
                            {/* 🆕 BADGE [PAID] */}
                            {isPaid && (
                              <Badge size="xs" color="green" variant="filled">
                                PAID
                              </Badge>
                            )}
                          </Group>
                          <Text fw={600} size="sm" mb={4}>
                            {item.description}
                          </Text>
                          <Group gap={4}>
                            <Badge size="sm" variant="light" color="gray">
                              {item.quantity} x {formatCurrency(item.unit_price || 0)} {t('common.currencyTHB')}
                            </Badge>
                          </Group>
                        </Box>
                        <Box ta="right">
                          <Text size="lg" fw={700} c={isPaid ? 'green' : 'blue'}>
                            {formatCurrency(item.total_price || 0)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {t('common.currencyTHB')}
                          </Text>
                        </Box>
                      </Group>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>{t('invoiceDetail.table.items.number')}</Table.Th>
                    <Table.Th>{t('invoiceDetail.table.items.description')}</Table.Th>
                    <Table.Th ta="center" w={100}>{t('invoiceDetail.table.items.quantity')}</Table.Th>
                    <Table.Th ta="right" w={150}>{t('invoiceDetail.table.items.price')}</Table.Th>
                    <Table.Th ta="right" w={150}>{t('invoiceDetail.table.items.total')}</Table.Th>
                    <Table.Th ta="center" w={100}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoice.items && invoice.items.map((item: any, index) => {
                    const isPaid = item.is_fully_paid === 1;
                    
                    return (
                      <Table.Tr 
                        key={item.id || index}
                        style={{
                          backgroundColor: isPaid ? theme.colors.green[0] : 'transparent',
                          opacity: isPaid ? 0.9 : 1
                        }}
                      >
                        <Table.Td>{index + 1}</Table.Td>
                        <Table.Td>{item.description}</Table.Td>
                        <Table.Td ta="center">{item.quantity}</Table.Td>
                        <Table.Td ta="right">
                          {formatCurrency(item.unit_price || 0)} {t('common.currencyTHB')}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c={isPaid ? 'green' : 'blue'}>
                            {formatCurrency(item.total_price || 0)} {t('common.currencyTHB')}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          {/* 🆕 BADGE [PAID] В ТАБЛИЦЕ */}
                          {isPaid ? (
                            <Badge size="sm" color="green" variant="filled">
                              PAID
                            </Badge>
                          ) : (
                            <Badge size="sm" color="gray" variant="light">
                              UNPAID
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr>
                    <Table.Td colSpan={4} ta="right">
                      <Text fw={600}>{t('invoiceDetail.summary.subtotal')}:</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fw={600}>
                        {formatCurrency(invoice.subtotal)} {t('common.currencyTHB')}
                      </Text>
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                  {invoice.tax_amount > 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4} ta="right">
                        <Text fw={600}>{t('invoiceDetail.summary.tax')}:</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600}>
                          {formatCurrency(invoice.tax_amount)} {t('common.currencyTHB')}
                        </Text>
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  )}
                  <Table.Tr>
                    <Table.Td colSpan={4} ta="right">
                      <Text size="lg" fw={700}>{t('invoiceDetail.summary.total')}:</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="lg" fw={700} c="green">
                        {formatCurrency(invoice.total_amount)} {t('common.currencyTHB')}
                      </Text>
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Card>

      {/* Банковские реквизиты */}
      {(invoice.bank_name || invoice.bank_account_name || invoice.bank_account_number) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <IconBuildingBank size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.bankDetails')}</Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {invoice.bank_name && (
                <InfoItem
                  icon={<IconBuildingBank size={18} />}
                  label={t('invoiceDetail.fields.bank')}
                  value={invoice.bank_name}
                  color="blue"
                />
              )}
              {invoice.bank_account_name && (
                <InfoItem
                  icon={<IconUser size={18} />}
                  label={t('invoiceDetail.fields.accountHolder')}
                  value={invoice.bank_account_name}
                  color="violet"
                />
              )}
              {invoice.bank_account_number && (
                <Box style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                  <InfoItem
                    icon={<IconCreditCard size={18} />}
                    label={t('invoiceDetail.fields.accountNumber')}
                    value={invoice.bank_account_number}
                    color="teal"
                  />
                </Box>
              )}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* QR код */}
      {invoice.qr_code_base64 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <IconQrcode size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.qrCode')}</Title>
            </Group>

            <Center>
              <Paper p="md" radius="md" withBorder>
                <Image
                  src={invoice.qr_code_base64}
                  alt="QR Code"
                  w={200}
                  h={200}
                />
              </Paper>
            </Center>
          </Stack>
        </Card>
      )}

      {/* История платежей */}
      {invoice.receipts && invoice.receipts.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconReceipt size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.paymentHistory')}</Title>
            </Group>

            {isMobile ? (
              <Stack gap="xs">
                {invoice.receipts.map((receipt) => (
                  <Paper
                    key={receipt.id}
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/financial-documents/receipts/${receipt.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = theme.shadows.md;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          {receipt.receipt_number}
                        </Text>
                        {getReceiptStatusBadge(receipt.status)}
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          {new Date(receipt.receipt_date).toLocaleDateString('ru-RU')}
                        </Text>
                        <Text size="lg" fw={700} c="green">
                          {formatCurrency(receipt.amount_paid)} {t('common.currencyTHB')}
                        </Text>
                      </Group>
                      <Badge size="sm" variant="light">
                        {getPaymentMethodText(receipt.payment_method)}
                      </Badge>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={600}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('invoiceDetail.table.receipts.receiptNumber')}</Table.Th>
                      <Table.Th w={120}>{t('invoiceDetail.table.receipts.date')}</Table.Th>
                      <Table.Th ta="right" w={150}>{t('invoiceDetail.table.receipts.amount')}</Table.Th>
                      <Table.Th w={150}>{t('invoiceDetail.table.receipts.method')}</Table.Th>
                      <Table.Th w={120}>{t('invoiceDetail.table.receipts.status')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {invoice.receipts.map((receipt) => (
                      <Table.Tr
                        key={receipt.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/financial-documents/receipts/${receipt.id}`)}
                      >
                        <Table.Td>
                          <Button variant="subtle" size="xs" p={0}>
                            {receipt.receipt_number}
                          </Button>
                        </Table.Td>
                        <Table.Td>
                          {new Date(receipt.receipt_date).toLocaleDateString('ru-RU')}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c="green">
                            {formatCurrency(receipt.amount_paid)} {t('common.currencyTHB')}
                          </Text>
                        </Table.Td>
                        <Table.Td>{getPaymentMethodText(receipt.payment_method)}</Table.Td>
                        <Table.Td>{getReceiptStatusBadge(receipt.status)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Card>
      )}

      {/* Примечания */}
      {invoice.notes && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <Title order={4}>{t('invoiceDetail.sections.notes')}</Title>
            </Group>

            <Paper p="md" radius="md" withBorder>
              <Text size="sm">{invoice.notes}</Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* 🆕 МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ */}
      <CreateInvoiceModal
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchInvoice();
        }}
        mode="edit"
        invoiceId={invoice.id}
      />

      {/* 🆕 МОДАЛЬНОЕ ОКНО УДАЛЕНИЯ */}
      <DeleteInvoiceModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onSuccess={() => {
          navigate('/financial-documents');
        }}
        invoiceId={invoice.id}
      />

      {/* 🆕 МОДАЛЬНОЕ ОКНО ВЫБОРА ПОЗИЦИЙ ДЛЯ PDF */}
      <SelectInvoiceItemsModal
        opened={pdfSelectionModalVisible}
        onClose={() => setPdfSelectionModalVisible(false)}
        items={invoice?.items || []}
        onDownload={handleDownloadPDFWithSelection}
        defaultSelectedItems={getDefaultSelectedItems()}
      />
    </Stack>
  );
};

export default InvoiceDetail;