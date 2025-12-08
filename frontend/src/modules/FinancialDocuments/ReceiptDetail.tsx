// frontend/src/modules/FinancialDocuments/ReceiptDetail.tsx
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
  SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconTrash,
  IconDownload,
  IconFileText,
  IconQrcode,
  IconPhoto,
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
  IconCash,
  IconBuildingBank,
  IconCoins,
  IconPackage,
  IconAlertCircle
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Receipt } from '@/api/financialDocuments.api';
import CreateReceiptModal from './components/CreateReceiptModal';

const ReceiptDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchReceipt();
    }
  }, [id]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getReceiptById(Number(id));
      setReceipt(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('receiptDetail.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/financial-documents?tab=receipts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('receiptDetail.confirm.deleteTitle'),
      children: (
        <Text size="sm">
          {t('receiptDetail.confirm.deleteDescription')}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await financialDocumentsApi.deleteReceipt(Number(id));
          notifications.show({
            title: t('common.success'),
            message: t('receiptDetail.messages.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          navigate('/financial-documents?tab=receipts');
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: t('receiptDetail.messages.deleteError'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  const handleCopyLink = async () => {
    if (!receipt?.uuid) {
      notifications.show({
        title: t('errors.generic'),
        message: t('receiptDetail.messages.uuidNotFound'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }
    
    const link = `https://admin.novaestate.company/receipt-verify/${receipt.uuid}`;
    try {
      await navigator.clipboard.writeText(link);
      notifications.show({
        title: t('common.success'),
        message: t('receiptDetail.messages.linkCopied'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error) {
      notifications.show({
        title: t('errors.generic'),
        message: t('receiptDetail.messages.linkCopyError'),
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
        title: t('receiptDetail.messages.generatingPDF'),
        message: t('common.pleaseWait'),
        autoClose: false,
        withCloseButton: false
      });

      const response = await financialDocumentsApi.downloadReceiptPDF(Number(id));
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt?.receipt_number || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.update({
        id: 'pdf-download',
        color: 'green',
        title: t('common.success'),
        message: t('receiptDetail.messages.pdfDownloaded'),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });
    } catch (error: any) {
      notifications.update({
        id: 'pdf-download',
        color: 'red',
        title: t('errors.generic'),
        message: t('receiptDetail.messages.pdfDownloadError'),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { 
        color: 'blue', 
        icon: <IconAlertCircle size={14} /> 
      },
      verified: { 
        color: 'green', 
        icon: <IconCheck size={14} /> 
      },
      rejected: { 
        color: 'red', 
        icon: <IconX size={14} /> 
      }
    };
    
    const config = statusConfig[status] || { color: 'gray', icon: null };
    const text = t(`receiptDetail.statuses.${status}`);
    
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

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, React.ReactNode> = {
      bank_transfer: <IconBuildingBank size={20} />,
      cash: <IconCash size={20} />,
      crypto: <IconCoins size={20} />,
      barter: <IconPackage size={20} />
    };
    return icons[method] || <IconCreditCard size={20} />;
  };

  const getPaymentMethodText = (method: string) => {
    return t(`receiptDetail.paymentMethods.${method}`);
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
            {t('receiptDetail.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!receipt) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={80} radius="xl" variant="light" color="red">
            <IconFileText size={40} />
          </ThemeIcon>
          <Text size="lg" fw={600}>
            {t('receiptDetail.notFound')}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => navigate('/financial-documents?tab=receipts')}
          >
            {t('receiptDetail.buttons.backToList')}
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
          onClick={() => navigate('/financial-documents?tab=receipts')}
          fullWidth
        >
          {t('receiptDetail.buttons.backToList')}
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
                gradient={{ from: 'teal', to: 'green' }}
              >
                <IconReceipt size={24} />
              </ThemeIcon>
              <Box>
                <Group gap="xs">
                  <Title order={isMobile ? 4 : 3}>
                    {receipt.receipt_number}
                  </Title>
                  {getStatusBadge(receipt.status)}
                </Group>
                <Text size="xs" c="dimmed">
                  {t('receiptDetail.title')}
                </Text>
              </Box>
            </Group>

            {!isMobile && (
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => navigate('/financial-documents?tab=receipts')}
              >
                {t('receiptDetail.buttons.back')}
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
              {!isMobile && t('receiptDetail.buttons.edit')}
            </Button>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconLink size={18} />}
              onClick={handleCopyLink}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('receiptDetail.buttons.copyLink')}
            </Button>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={18} />}
              onClick={handleDownloadPDF}
              flex={isMobile ? 1 : undefined}
            >
              {!isMobile && t('receiptDetail.buttons.downloadPDF')}
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

      {/* Статистика */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6 }}>
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
                  <IconCurrencyBaht size={20} />
                </ThemeIcon>
                <Text size="sm" c="white" opacity={0.9}>
                  {t('receiptDetail.fields.amountPaid')}
                </Text>
              </Group>
              <Group align="baseline" gap={4}>
                <Text size="2rem" fw={700} c="white" style={{ lineHeight: 1 }}>
                  {formatCurrency(receipt.amount_paid)}
                </Text>
                <Text size="lg" c="white" opacity={0.9}>
                  {t('common.currencyTHB')}
                </Text>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6 }}>
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
                  {getPaymentMethodIcon(receipt.payment_method)}
                </ThemeIcon>
                <Text size="sm" c="white" opacity={0.9}>
                  {t('receiptDetail.fields.paymentMethod')}
                </Text>
              </Group>
              <Text size="xl" fw={700} c="white" style={{ lineHeight: 1.2 }}>
                {getPaymentMethodText(receipt.payment_method)}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Основная информация */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconFileText size={20} />
            </ThemeIcon>
            <Title order={4}>{t('receiptDetail.sections.mainInfo')}</Title>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <InfoItem
              icon={<IconCalendar size={20} />}
              label={t('receiptDetail.fields.paymentDate')}
              value={new Date(receipt.receipt_date).toLocaleDateString('ru-RU')}
              color="teal"
            />

            <InfoItem
              icon={getPaymentMethodIcon(receipt.payment_method)}
              label={t('receiptDetail.fields.paymentMethod')}
              value={getPaymentMethodText(receipt.payment_method)}
              color="blue"
            />

            {receipt.invoice_number && (
              <InfoItem
                icon={<IconFileInvoice size={20} />}
                label={t('receiptDetail.fields.invoice')}
                value={
                  <Button
                    variant="subtle"
                    size="xs"
                    p={0}
                    onClick={() => navigate(`/financial-documents/invoices/${receipt.invoice_id}`)}
                  >
                    {receipt.invoice_number}
                  </Button>
                }
                color="violet"
              />
            )}

            {receipt.agreement_number && (
              <InfoItem
                icon={<IconFileText size={20} />}
                label={t('receiptDetail.fields.agreement')}
                value={
                  <Button
                    variant="subtle"
                    size="xs"
                    p={0}
                    onClick={() => navigate(`/agreements/${receipt.agreement_id}`)}
                  >
                    {receipt.agreement_number}
                  </Button>
                }
                color="orange"
              />
            )}

            <InfoItem
              icon={<IconUser size={20} />}
              label={t('receiptDetail.fields.created')}
              value={
                <>
                  {new Date(receipt.created_at).toLocaleDateString('ru-RU')}
                  {receipt.created_by_name && (
                    <>
                      <br />
                      <Text size="xs" c="dimmed">
                        {receipt.created_by_name}
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

      {/* Банковские реквизиты */}
      {(receipt.bank_details_type === 'simple' || receipt.bank_details_type === 'international' || receipt.bank_details_type === 'custom') && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <IconBuildingBank size={20} />
              </ThemeIcon>
              <Title order={4}>{t('receiptDetail.sections.bankDetails')}</Title>
            </Group>

            {receipt.bank_details_type === 'simple' && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {receipt.bank_name && (
                  <InfoItem
                    icon={<IconBuildingBank size={20} />}
                    label={t('financialDocuments.bankDetails.simple.bankName')}
                    value={receipt.bank_name}
                    color="blue"
                  />
                )}

                {receipt.bank_account_name && (
                  <InfoItem
                    icon={<IconUser size={20} />}
                    label={t('financialDocuments.bankDetails.simple.accountName')}
                    value={receipt.bank_account_name}
                    color="cyan"
                  />
                )}

                {receipt.bank_account_number && (
                  <InfoItem
                    icon={<IconCreditCard size={20} />}
                    label={t('financialDocuments.bankDetails.simple.accountNumber')}
                    value={receipt.bank_account_number}
                    color="teal"
                  />
                )}
              </SimpleGrid>
            )}

            {receipt.bank_details_type === 'international' && (
              <Stack gap="sm">
                <Paper p="md" radius="md" withBorder style={{ background: theme.colors.blue[0] }}>
                  <Text size="xs" c="dimmed" mb={8} fw={600} tt="uppercase">
                    {t('financialDocuments.bankDetails.international.accountInfo')}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {receipt.bank_account_name && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.accountName')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_account_name}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_account_address && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.accountAddress')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_account_address}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_currency && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.currency')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_currency}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_account_number && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.accountNumber')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_account_number}
                        </Text>
                      </Box>
                    )}
                  </SimpleGrid>
                </Paper>

                <Paper p="md" radius="md" withBorder style={{ background: theme.colors.violet[0] }}>
                  <Text size="xs" c="dimmed" mb={8} fw={600} tt="uppercase">
                    {t('financialDocuments.bankDetails.international.bankInfo')}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {receipt.bank_name && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.bankName')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_name}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_address && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.bankAddress')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_address}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_code && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.bankCode')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_code}
                        </Text>
                      </Box>
                    )}

                    {receipt.bank_swift_code && (
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t('financialDocuments.bankDetails.international.swiftCode')}
                        </Text>
                        <Text size="sm" fw={600}>
                          {receipt.bank_swift_code}
                        </Text>
                      </Box>
                    )}
                  </SimpleGrid>
                </Paper>
              </Stack>
            )}

            {receipt.bank_details_type === 'custom' && receipt.bank_custom_details && (
              <Paper p="md" radius="md" withBorder>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {receipt.bank_custom_details}
                </Text>
              </Paper>
            )}
          </Stack>
        </Card>
      )}

      {/* Оплаченные позиции */}
      {receipt.items && receipt.items.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconPackage size={20} />
              </ThemeIcon>
              <Title order={4}>{t('receiptDetail.sections.paidItems')}</Title>
            </Group>

            <Stack gap="xs">
              {receipt.items.map((item, index) => (
                <Paper
                  key={item.id || index}
                  p="md"
                  radius="md"
                  withBorder
                  style={{
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    cursor: 'default'
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
                  <Group justify="space-between" wrap="nowrap">
                    <Box style={{ flex: 1 }}>
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
                      <Text size="lg" fw={700} c="green">
                        {formatCurrency(item.total_price || 0)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('common.currencyTHB')}
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Card>
      )}

      {/* Прикрепленные файлы */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="violet">
              <IconPhoto size={20} />
            </ThemeIcon>
            <Title order={4}>{t('receiptDetail.sections.paymentProofs')}</Title>
          </Group>

          {receipt.files && receipt.files.length > 0 ? (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
              {receipt.files.map((file, index) => (
                <Box key={file.id || index}>
                  <Image
                    src={`${import.meta.env.VITE_API_BASE_URL || ''}${file.file_path}`}
                    alt={file.file_name}
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                  <Text size="xs" c="dimmed" mt={4} ta="center" lineClamp={1}>
                    {file.file_name}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Paper p="xl" radius="md" withBorder>
              <Center>
                <Stack align="center" gap="md">
                  <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                    <IconPhoto size={30} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed" ta="center">
                    {t('receiptDetail.noFiles')}
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}
        </Stack>
      </Card>

      {/* QR код */}
      {receipt.qr_code_base64 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <IconQrcode size={20} />
              </ThemeIcon>
              <Title order={4}>{t('receiptDetail.sections.qrCode')}</Title>
            </Group>

            <Center>
              <Paper p="md" radius="md" withBorder>
                <Image
                  src={receipt.qr_code_base64}
                  alt="QR Code"
                  w={200}
                  h={200}
                />
              </Paper>
            </Center>
          </Stack>
        </Card>
      )}

      {/* Примечания */}
      {receipt.notes && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <Title order={4}>{t('receiptDetail.sections.notes')}</Title>
            </Group>

            <Paper p="md" radius="md" withBorder>
              <Text size="sm">{receipt.notes}</Text>
            </Paper>
          </Stack>
        </Card>
      )}

      {/* Модальное окно редактирования */}
      <CreateReceiptModal
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchReceipt();
        }}
        mode="edit"
        receiptId={receipt.id}
      />
    </Stack>
  );
};

export default ReceiptDetail;