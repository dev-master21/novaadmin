// frontend/src/modules/FinancialDocuments/components/CreateReceiptModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Textarea,
  NumberInput,
  Select,
  Card,
  Grid,
  Paper,
  ThemeIcon,
  Stepper,
  Alert,
  Checkbox,
  FileButton,
  Image,
  ActionIcon,
  Badge,
  useMantineTheme,
  SimpleGrid,
  Radio,
  TextInput,
  Divider
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconFileText,
  IconUpload,
  IconTrash,
  IconCheck,
  IconX,
  IconReceipt,
  IconCalendar,
  IconCurrencyBaht,
  IconFileInvoice,
  IconInfoCircle,
  IconChevronRight,
  IconChevronLeft,
  IconCheckbox,
  IconPhoto,
  IconAlertCircle,
  IconBuildingBank,
  IconUser,
  IconDeviceFloppy
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { 
  financialDocumentsApi, 
  CreateReceiptDTO, 
  Invoice, 
  InvoiceItem,
  BankDetailsType,
  SavedBankDetails
} from '@/api/financialDocuments.api';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import dayjs from 'dayjs';

interface CreateReceiptModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  invoiceId?: number;
  mode?: 'create' | 'edit';
  receiptId?: number;
}

interface UploadedFile {
  file: File;
  preview: string;
}

const CreateReceiptModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  invoiceId,
  mode = 'create',
  receiptId
}: CreateReceiptModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Form state
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [invoiceIdState, setInvoiceIdState] = useState<string | null>(null);
  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'crypto' | 'barter'>('bank_transfer');
  const [notes, setNotes] = useState('');

  // Bank details
  const [savedBankDetailsList, setSavedBankDetailsList] = useState<SavedBankDetails[]>([]);
  const [selectedSavedBankDetailsId, setSelectedSavedBankDetailsId] = useState<number | null>(null);
  const [bankDetailsType, setBankDetailsType] = useState<BankDetailsType>('simple');
  
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountAddress, setBankAccountAddress] = useState('');
  const [bankCurrency, setBankCurrency] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [bankCustomDetails, setBankCustomDetails] = useState('');
  
  const [saveBankDetails, setSaveBankDetails] = useState(false);
  const [bankDetailsName, setBankDetailsName] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      fetchAgreements();
      fetchSavedBankDetails();
      
      if (mode === 'create') {
        resetForm();
        if (invoiceId) {
          loadInvoiceData(invoiceId, false); // ✅ НЕ загружать реквизиты при первичной загрузке
        }
      } else if (mode === 'edit' && receiptId) {
        loadReceiptForEdit(receiptId);
      }
    }
  }, [visible, invoiceId, mode, receiptId]);

  // ✅ ЗАГРУЗКА ЧЕКА ДЛЯ РЕДАКТИРОВАНИЯ
  const loadReceiptForEdit = async (id: number) => {
    try {
      setLoading(true);
      const response = await financialDocumentsApi.getReceiptById(id);
      const receipt = response.data.data;

      // Основные поля
      setAgreementId(receipt.agreement_id ? String(receipt.agreement_id) : null);
      setInvoiceIdState(receipt.invoice_id ? String(receipt.invoice_id) : null);
      setReceiptDate(receipt.receipt_date ? new Date(receipt.receipt_date) : new Date());
      setAmountPaid(receipt.amount_paid || 0);
      setPaymentMethod(receipt.payment_method);
      setNotes(receipt.notes || '');

      // ✅ Загружаем инвойс если есть (БЕЗ перезаписи банковских реквизитов)
      if (receipt.invoice_id) {
        await loadInvoiceData(receipt.invoice_id, true); // ✅ skipBankDetails = true
      }

      // Выбранные позиции
      if (receipt.items && receipt.items.length > 0) {
        setSelectedItems(receipt.items.map((item: any) => item.id));
      }

      // ✅ Банковские реквизиты ИЗ ЧЕКА (приоритет над реквизитами invoice)
      if (receipt.bank_details_type) {
        setBankDetailsType(receipt.bank_details_type);
        
        if (receipt.bank_details_type === 'simple') {
          setBankName(receipt.bank_name || '');
          setBankAccountName(receipt.bank_account_name || '');
          setBankAccountNumber(receipt.bank_account_number || '');
        } else if (receipt.bank_details_type === 'international') {
          setBankName(receipt.bank_name || '');
          setBankAccountName(receipt.bank_account_name || '');
          setBankAccountNumber(receipt.bank_account_number || '');
          setBankAccountAddress(receipt.bank_account_address || '');
          setBankCurrency(receipt.bank_currency || '');
          setBankCode(receipt.bank_code || '');
          setBankSwiftCode(receipt.bank_swift_code || '');
        } else if (receipt.bank_details_type === 'custom') {
          setBankCustomDetails(receipt.bank_custom_details || '');
        }
      }

      notifications.show({
        title: t('common.success'),
        message: t('createReceiptModal.messages.receiptLoaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      console.error('Error loading receipt:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('createReceiptModal.messages.receiptLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedBankDetails = async () => {
    try {
      const response = await financialDocumentsApi.getAllSavedBankDetails();
      setSavedBankDetailsList(response.data.data);
    } catch (error: any) {
      console.error('Error loading saved bank details:', error);
    }
  };

  const loadSavedBankDetails = (id: number) => {
    const saved = savedBankDetailsList.find(s => s.id === id);
    if (!saved) return;

    setBankDetailsType(saved.bank_details_type);
    
    if (saved.bank_details_type === 'simple') {
      setBankName(saved.bank_name || '');
      setBankAccountName(saved.bank_account_name || '');
      setBankAccountNumber(saved.bank_account_number || '');
    } else if (saved.bank_details_type === 'international') {
      setBankName(saved.bank_name || '');
      setBankAccountName(saved.bank_account_name || '');
      setBankAccountNumber(saved.bank_account_number || '');
      setBankAccountAddress(saved.bank_account_address || '');
      setBankCurrency(saved.bank_currency || '');
      setBankCode(saved.bank_code || '');
      setBankSwiftCode(saved.bank_swift_code || '');
    } else if (saved.bank_details_type === 'custom') {
      setBankCustomDetails(saved.bank_custom_details || '');
    }
  };

  const handleSavedBankDetailsChange = (value: string | null) => {
    if (value) {
      const id = Number(value);
      setSelectedSavedBankDetailsId(id);
      loadSavedBankDetails(id);
    } else {
      setSelectedSavedBankDetailsId(null);
    }
  };

  const handleBankDetailsTypeChange = (type: BankDetailsType) => {
    setBankDetailsType(type);
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setBankAccountAddress('');
    setBankCurrency('');
    setBankCode('');
    setBankSwiftCode('');
    setBankCustomDetails('');
    setSelectedSavedBankDetailsId(null);
  };

  const fetchAgreements = async () => {
    try {
      const response = await agreementsApi.getAll({ limit: 100 });
      setAgreements(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createReceiptModal.messages.agreementsLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  // ✅ УЛУЧШЕННАЯ ФУНКЦИЯ: добавлен параметр skipBankDetails
  const loadInvoiceData = async (id: number, skipBankDetails: boolean = false) => {
    try {
      const response = await financialDocumentsApi.getInvoiceById(id);
      const invoice = response.data.data;
      setSelectedInvoice(invoice);
      setInvoiceIdState(String(invoice.id));
      setAgreementId(String(invoice.agreement_id));
      
      // Выбираем все позиции invoice
      if (invoice.items) {
        setSelectedItems(invoice.items.map(item => item.id!));
      }

      // Рассчитываем оставшуюся сумму к оплате
      const remaining = invoice.total_amount - invoice.amount_paid;
      setAmountPaid(remaining);

      // ✅ АВТОМАТИЧЕСКАЯ ПОДСТАНОВКА БАНКОВСКИХ РЕКВИЗИТОВ ИЗ INVOICE
      // (только если skipBankDetails = false)
      if (!skipBankDetails && invoice.bank_details_type) {
        console.log('📋 Загружаю банковские реквизиты из invoice:', invoice.bank_details_type);
        
        setBankDetailsType(invoice.bank_details_type);
        
        if (invoice.bank_details_type === 'simple') {
          setBankName(invoice.bank_name || '');
          setBankAccountName(invoice.bank_account_name || '');
          setBankAccountNumber(invoice.bank_account_number || '');
          console.log('✅ Загружены простые реквизиты:', {
            bankName: invoice.bank_name,
            accountName: invoice.bank_account_name,
            accountNumber: invoice.bank_account_number
          });
        } else if (invoice.bank_details_type === 'international') {
          setBankName(invoice.bank_name || '');
          setBankAccountName(invoice.bank_account_name || '');
          setBankAccountNumber(invoice.bank_account_number || '');
          setBankAccountAddress(invoice.bank_account_address || '');
          setBankCurrency(invoice.bank_currency || '');
          setBankCode(invoice.bank_code || '');
          setBankSwiftCode(invoice.bank_swift_code || '');
          console.log('✅ Загружены международные реквизиты:', {
            bankName: invoice.bank_name,
            accountName: invoice.bank_account_name,
            swift: invoice.bank_swift_code
          });
        } else if (invoice.bank_details_type === 'custom') {
          setBankCustomDetails(invoice.bank_custom_details || '');
          console.log('✅ Загружены пользовательские реквизиты');
        }

        // ✅ Показываем уведомление о загрузке реквизитов
        notifications.show({
          title: t('common.success'),
          message: t('createReceiptModal.messages.bankDetailsLoaded'),
          color: 'blue',
          icon: <IconBuildingBank size={18} />,
          autoClose: 3000
        });
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('createReceiptModal.messages.invoiceLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleAgreementChange = async (value: string | null) => {
    if (!value) {
      setAgreementId(null);
      setInvoices([]);
      setSelectedInvoice(null);
      setSelectedItems([]);
      setInvoiceIdState(null);
      return;
    }

    setAgreementId(value);

    try {
      const response = await financialDocumentsApi.getInvoicesByAgreement(Number(value));
      setInvoices(response.data.data);
      setSelectedInvoice(null);
      setSelectedItems([]);
      setInvoiceIdState(null);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createReceiptModal.messages.invoicesLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleInvoiceChange = async (value: string | null) => {
    if (!value) {
      setInvoiceIdState(null);
      setSelectedInvoice(null);
      setSelectedItems([]);
      return;
    }

    setInvoiceIdState(value);
    // ✅ При выборе invoice загружаем и подставляем банковские реквизиты
    await loadInvoiceData(Number(value), false);
  };

  const handleFilesUpload = (files: File[]) => {
    const newFiles: UploadedFile[] = [];
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newFiles.push({
          file: file,
          preview: e.target?.result as string
        });
        
        if (newFiles.length === files.length) {
          setUploadedFiles([...uploadedFiles, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedInvoice(null);
    setInvoices([]);
    setSelectedItems([]);
    setUploadedFiles([]);
    setAgreementId(null);
    setInvoiceIdState(null);
    setReceiptDate(new Date());
    setAmountPaid(0);
    setPaymentMethod('bank_transfer');
    setNotes('');
    setSelectedSavedBankDetailsId(null);
    setBankDetailsType('simple');
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setBankAccountAddress('');
    setBankCurrency('');
    setBankCode('');
    setBankSwiftCode('');
    setBankCustomDetails('');
    setSaveBankDetails(false);
    setBankDetailsName('');
    setErrors({});
  };

  const toggleItemSelection = (itemId: number) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const toggleSelectAll = () => {
    if (!selectedInvoice || !selectedInvoice.items) return;
    
    if (selectedItems.length === selectedInvoice.items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(selectedInvoice.items.map(item => item.id!));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!agreementId) {
        newErrors.agreementId = t('createReceiptModal.validation.selectAgreement');
      }
      if (!invoiceIdState) {
        newErrors.invoiceId = t('createReceiptModal.validation.selectInvoice');
      }
      if (!receiptDate) {
        newErrors.receiptDate = t('createReceiptModal.validation.specifyDate');
      }
      if (!amountPaid || amountPaid <= 0) {
        newErrors.amountPaid = t('createReceiptModal.validation.specifyAmount');
      }
      if (selectedInvoice && amountPaid > (selectedInvoice.total_amount - selectedInvoice.amount_paid)) {
        newErrors.amountPaid = t('createReceiptModal.validation.amountExceedsRemaining');
      }
      if (!paymentMethod) {
        newErrors.paymentMethod = t('createReceiptModal.validation.selectPaymentMethod');
      }
      if (selectedItems.length === 0) {
        notifications.show({
          title: t('errors.validation'),
          message: t('createReceiptModal.validation.selectAtLeastOneItem'),
          color: 'red',
          icon: <IconX size={18} />
        });
        return false;
      }
    } else if (step === 1) {
      if (saveBankDetails && !bankDetailsName) {
        newErrors.bankDetailsName = t('financialDocuments.savedBankDetails.saveNamePlaceholder');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);

      if (selectedItems.length === 0) {
        notifications.show({
          title: t('errors.validation'),
          message: t('createReceiptModal.validation.selectAtLeastOneItem'),
          color: 'red',
          icon: <IconX size={18} />
        });
        setLoading(false);
        return;
      }

      const receiptData: CreateReceiptDTO = {
        invoice_id: Number(invoiceIdState),
        agreement_id: agreementId ? Number(agreementId) : undefined,
        receipt_date: dayjs(receiptDate).format('YYYY-MM-DD'),
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        notes: notes,
        selected_items: selectedItems,
        
        bank_details_type: bankDetailsType,
        saved_bank_details_id: selectedSavedBankDetailsId || undefined,
        
        bank_name: bankDetailsType !== 'custom' ? bankName : undefined,
        bank_account_name: bankDetailsType !== 'custom' ? bankAccountName : undefined,
        bank_account_number: bankDetailsType !== 'custom' ? bankAccountNumber : undefined,
        
        bank_account_address: bankDetailsType === 'international' ? bankAccountAddress : undefined,
        bank_currency: bankDetailsType === 'international' ? bankCurrency : undefined,
        bank_code: bankDetailsType === 'international' ? bankCode : undefined,
        bank_swift_code: bankDetailsType === 'international' ? bankSwiftCode : undefined,
        
        bank_custom_details: bankDetailsType === 'custom' ? bankCustomDetails : undefined,
        
        save_bank_details: saveBankDetails,
        bank_details_name: saveBankDetails ? bankDetailsName : undefined
      };

      let receiptIdForFiles: number;

      if (mode === 'edit' && receiptId) {
        await financialDocumentsApi.updateReceipt(receiptId, receiptData);
        receiptIdForFiles = receiptId;
        notifications.show({
          title: t('common.success'),
          message: t('createReceiptModal.messages.updated'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      } else {
        const response = await financialDocumentsApi.createReceipt(receiptData);
        receiptIdForFiles = response.data.data.id;
        notifications.show({
          title: t('common.success'),
          message: t('createReceiptModal.messages.created'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      // Загружаем файлы если есть
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        uploadedFiles.forEach((fileObj, index) => {
          formData.append(`file_${index}`, fileObj.file);
        });

        try {
          await financialDocumentsApi.uploadReceiptFiles(receiptIdForFiles, formData);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          notifications.show({
            title: t('common.success'),
            message: t('createReceiptModal.messages.createdButFilesNotUploaded'),
            color: 'orange',
            icon: <IconAlertCircle size={18} />
          });
        }
      }
      
      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error('Error submitting receipt:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('createReceiptModal.messages.createError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: t('createReceiptModal.paymentMethods.bankTransfer'),
      cash: t('createReceiptModal.paymentMethods.cash'),
      crypto: t('createReceiptModal.paymentMethods.crypto'),
      barter: t('createReceiptModal.paymentMethods.barter')
    };
    return methods[method] || method;
  };

  const remainingAmount = selectedInvoice 
    ? selectedInvoice.total_amount - selectedInvoice.amount_paid 
    : 0;

  return (
    <Modal
      opened={visible}
      onClose={onCancel}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconReceipt size={20} />
          </ThemeIcon>
          <Text size="lg" fw={700}>
            {mode === 'edit' ? t('createReceiptModal.titleEdit') : t('createReceiptModal.title')}
          </Text>
        </Group>
      }
      size={isMobile ? 'full' : 'xl'}
      centered={!isMobile}
      padding="lg"
    >
      <Stack gap="lg">
        {/* Stepper */}
        <Stepper 
          active={currentStep} 
          onStepClick={setCurrentStep}
          size={isMobile ? 'xs' : 'sm'}
          iconSize={isMobile ? 32 : 42}
        >
          <Stepper.Step
            label={!isMobile ? t('createReceiptModal.steps.basic') : undefined}
            description={!isMobile ? t('createReceiptModal.steps.basicDesc') : undefined}
            icon={<IconFileText size={18} />}
          />
          <Stepper.Step
            label={!isMobile ? t('createReceiptModal.steps.bank') : undefined}
            description={!isMobile ? t('createReceiptModal.steps.bankDesc') : undefined}
            icon={<IconBuildingBank size={18} />}
          />
          <Stepper.Step
            label={!isMobile ? t('createReceiptModal.steps.files') : undefined}
            description={!isMobile ? t('createReceiptModal.steps.filesDesc') : undefined}
            icon={<IconUpload size={18} />}
          />
        </Stepper>

        {/* Шаг 1: Основная информация */}
        {currentStep === 0 && (
          <Stack gap="md">
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label={t('createReceiptModal.fields.agreement')}
                  placeholder={t('createReceiptModal.placeholders.selectAgreement')}
                  leftSection={<IconFileInvoice size={18} />}
                  data={agreements.map(agreement => ({
                    value: String(agreement.id),
                    label: agreement.agreement_number + (agreement.property_name ? ` - ${agreement.property_name}` : '')
                  }))}
                  value={agreementId}
                  onChange={handleAgreementChange}
                  searchable
                  clearable
                  disabled={!!invoiceId || mode === 'edit'}
                  error={errors.agreementId}
                  styles={{ input: { fontSize: '16px' } }}
                  required
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label={t('createReceiptModal.fields.invoice')}
                  placeholder={t('createReceiptModal.placeholders.selectInvoice')}
                  leftSection={<IconReceipt size={18} />}
                  data={invoices.map(invoice => ({
                    value: String(invoice.id),
                    label: `${invoice.invoice_number} - ${formatCurrency(invoice.total_amount - invoice.amount_paid)} THB ${t('createReceiptModal.remaining')}`
                  }))}
                  value={invoiceIdState}
                  onChange={handleInvoiceChange}
                  searchable
                  clearable
                  disabled={invoices.length === 0 || !!invoiceId || mode === 'edit'}
                  error={errors.invoiceId}
                  styles={{ input: { fontSize: '16px' } }}
                  required
                />
              </Grid.Col>
            </Grid>

            {selectedInvoice && (
              <Alert
                icon={<IconInfoCircle size={18} />}
                title={t('createReceiptModal.invoiceInfo.title')}
                color="blue"
                variant="light"
              >
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">
                      <strong>{t('createReceiptModal.invoiceInfo.totalAmount')}:</strong>
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatCurrency(selectedInvoice.total_amount)} THB
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">
                      <strong>{t('createReceiptModal.invoiceInfo.alreadyPaid')}:</strong>
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatCurrency(selectedInvoice.amount_paid)} THB
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">
                      <strong>{t('createReceiptModal.invoiceInfo.remainingToPay')}:</strong>
                    </Text>
                    <Text size="sm" fw={600} c="yellow">
                      {formatCurrency(remainingAmount)} THB
                    </Text>
                  </Group>
                </Stack>
              </Alert>
            )}

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <DateInput
                  label={t('createReceiptModal.fields.paymentDate')}
                  placeholder={t('createReceiptModal.placeholders.selectDate')}
                  leftSection={<IconCalendar size={18} />}
                  value={receiptDate}
                  onChange={(date) => setReceiptDate(date || new Date())}
                  valueFormat="DD.MM.YYYY"
                  clearable={false}
                  error={errors.receiptDate}
                  styles={{ input: { fontSize: '16px' } }}
                  required
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label={t('createReceiptModal.fields.paymentAmount')}
                  placeholder="0"
                  leftSection={<IconCurrencyBaht size={18} />}
                  value={amountPaid}
                  onChange={(value) => setAmountPaid(typeof value === 'number' ? value : 0)}
                  min={0.01}
                  max={remainingAmount || undefined}
                  step={100}
                  thousandSeparator=" "
                  suffix=" THB"
                  error={errors.amountPaid}
                  styles={{ input: { fontSize: '16px' } }}
                  required
                />
              </Grid.Col>
            </Grid>

            <Select
              label={t('createReceiptModal.fields.paymentMethod')}
              placeholder={t('createReceiptModal.placeholders.selectMethod')}
              data={[
                { value: 'bank_transfer', label: t('createReceiptModal.paymentMethods.bankTransfer') },
                { value: 'cash', label: t('createReceiptModal.paymentMethods.cash') },
                { value: 'crypto', label: t('createReceiptModal.paymentMethods.crypto') },
                { value: 'barter', label: t('createReceiptModal.paymentMethods.barter') }
              ]}
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as 'bank_transfer' | 'cash' | 'crypto' | 'barter')}
              error={errors.paymentMethod}
              styles={{ input: { fontSize: '16px' } }}
              required
            />

            {selectedInvoice && selectedInvoice.items && selectedInvoice.items.length > 0 && (
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon size="md" radius="md" variant="light" color="blue">
                        <IconCheckbox size={18} />
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        {t('createReceiptModal.sections.selectItems')}
                      </Text>
                    </Group>
                    <Badge color="blue" variant="light">
                      {selectedItems.length} / {selectedInvoice.items.length}
                    </Badge>
                  </Group>

                  <Checkbox
                    label={t('createReceiptModal.selectAll')}
                    checked={selectedItems.length === selectedInvoice.items.length}
                    indeterminate={
                      selectedItems.length > 0 && 
                      selectedItems.length < selectedInvoice.items.length
                    }
                    onChange={toggleSelectAll}
                    fw={600}
                  />

                  <Stack gap="xs">
                    {selectedInvoice.items.map((item: InvoiceItem) => (
                      <Card
                        key={item.id}
                        padding="sm"
                        radius="md"
                        withBorder
                        style={{
                          borderColor: selectedItems.includes(item.id!) 
                            ? theme.colors.blue[6] 
                            : undefined,
                          borderWidth: selectedItems.includes(item.id!) ? 2 : 1,
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleItemSelection(item.id!)}
                      >
                        <Checkbox
                          checked={selectedItems.includes(item.id!)}
                          onChange={() => toggleItemSelection(item.id!)}
                          label={
                            <Stack gap={4}>
                              <Group justify="space-between">
                                <Text size="sm" fw={600}>
                                  {item.description}
                                </Text>
                                {item.is_fully_paid && (
                                  <Badge color="green" size="sm" variant="light">
                                    {t('financialDocuments.invoice.itemPaid')}
                                  </Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">
                                {item.quantity} x {formatCurrency(item.unit_price)} THB = {formatCurrency(item.total_price)} THB
                              </Text>
                            </Stack>
                          }
                        />
                      </Card>
                    ))}
                  </Stack>
                </Stack>
              </Card>
            )}

            <Textarea
              label={t('createReceiptModal.fields.notes')}
              placeholder={t('createReceiptModal.placeholders.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              minRows={3}
              styles={{ input: { fontSize: '16px' } }}
            />
          </Stack>
        )}

        {/* Шаг 2: Банковские реквизиты */}
        {currentStep === 1 && (
          <Stack gap="md">
            {/* ✅ ИНФОРМАЦИОННЫЙ БЛОК О ЗАГРУЖЕННЫХ РЕКВИЗИТАХ */}
            {(bankName || bankAccountName || bankAccountNumber || bankCustomDetails) && (
              <Alert
                icon={<IconBuildingBank size={18} />}
                title={t('createReceiptModal.bankDetails.loadedFromInvoice')}
                color="green"
                variant="light"
              >
                {t('createReceiptModal.bankDetails.loadedFromInvoiceDesc')}
              </Alert>
            )}

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                    <IconBuildingBank size={20} />
                  </ThemeIcon>
                  <Text size="md" fw={600}>
                    {t('createInvoiceModal.sections.bankDetails')}
                  </Text>
                </Group>

                {savedBankDetailsList.length > 0 && (
                  <Select
                    label={t('financialDocuments.savedBankDetails.selectSaved')}
                    placeholder={t('financialDocuments.savedBankDetails.selectSaved')}
                    leftSection={<IconDeviceFloppy size={18} />}
                    data={savedBankDetailsList.map(saved => ({
                      value: String(saved.id),
                      label: `${saved.name} (${t(`financialDocuments.savedBankDetails.type${saved.bank_details_type.charAt(0).toUpperCase() + saved.bank_details_type.slice(1)}`)})`
                    }))}
                    value={selectedSavedBankDetailsId ? String(selectedSavedBankDetailsId) : null}
                    onChange={handleSavedBankDetailsChange}
                    searchable
                    clearable
                    styles={{ input: { fontSize: '16px' } }}
                  />
                )}

                <Radio.Group
                  value={bankDetailsType}
                  onChange={(value) => handleBankDetailsTypeChange(value as BankDetailsType)}
                  label={t('financialDocuments.savedBankDetails.type')}
                >
                  <Group mt="xs">
                    <Radio 
                      value="simple" 
                      label={t('financialDocuments.savedBankDetails.typeSimple')} 
                    />
                    <Radio 
                      value="international" 
                      label={t('financialDocuments.savedBankDetails.typeInternational')} 
                    />
                    <Radio 
                      value="custom" 
                      label={t('financialDocuments.savedBankDetails.typeCustom')} 
                    />
                  </Group>
                </Radio.Group>

                <Divider />

                {bankDetailsType === 'simple' && (
                  <>
                    <TextInput
                      label={t('financialDocuments.bankDetails.simple.bankName')}
                      placeholder="Bangkok Bank"
                      leftSection={<IconBuildingBank size={18} />}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      styles={{ input: { fontSize: '16px' } }}
                    />

                    <TextInput
                      label={t('financialDocuments.bankDetails.simple.accountName')}
                      placeholder="John Doe"
                      leftSection={<IconUser size={18} />}
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      styles={{ input: { fontSize: '16px' } }}
                    />

                    <TextInput
                      label={t('financialDocuments.bankDetails.simple.accountNumber')}
                      placeholder="123-4-56789-0"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      styles={{ input: { fontSize: '16px' } }}
                    />
                  </>
                )}

                {bankDetailsType === 'international' && (
                  <>
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.accountName')}
                          placeholder="John Doe"
                          leftSection={<IconUser size={18} />}
                          value={bankAccountName}
                          onChange={(e) => setBankAccountName(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.accountAddress')}
                          placeholder="123 Main Street"
                          value={bankAccountAddress}
                          onChange={(e) => setBankAccountAddress(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                    </Grid>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.currency')}
                          placeholder="THB"
                          value={bankCurrency}
                          onChange={(e) => setBankCurrency(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 8 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.accountNumber')}
                          placeholder="123-4-56789-0"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                    </Grid>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.bankName')}
                          placeholder="Bangkok Bank"
                          leftSection={<IconBuildingBank size={18} />}
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.bankAddress')}
                          placeholder="Bangkok, Thailand"
                          value={bankAccountAddress}
                          onChange={(e) => setBankAccountAddress(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                    </Grid>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.bankCode')}
                          placeholder="002"
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label={t('financialDocuments.bankDetails.international.swiftCode')}
                          placeholder="BKKBTHBK"
                          value={bankSwiftCode}
                          onChange={(e) => setBankSwiftCode(e.target.value)}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                    </Grid>
                  </>
                )}

                {bankDetailsType === 'custom' && (
                  <Textarea
                    label={t('financialDocuments.bankDetails.custom.details')}
                    placeholder={t('financialDocuments.bankDetails.custom.placeholder')}
                    value={bankCustomDetails}
                    onChange={(e) => setBankCustomDetails(e.target.value)}
                    minRows={6}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                )}

                <Checkbox
                  label={t('financialDocuments.savedBankDetails.saveAsNew')}
                  checked={saveBankDetails}
                  onChange={(e) => setSaveBankDetails(e.currentTarget.checked)}
                />

                {saveBankDetails && (
                  <TextInput
                    label={t('financialDocuments.savedBankDetails.saveName')}
                    placeholder={t('financialDocuments.savedBankDetails.saveNamePlaceholder')}
                    value={bankDetailsName}
                    onChange={(e) => setBankDetailsName(e.target.value)}
                    error={errors.bankDetailsName}
                    styles={{ input: { fontSize: '16px' } }}
                    required
                  />
                )}
              </Stack>
            </Card>
          </Stack>
        )}

        {/* Шаг 3: Загрузка файлов */}
        {currentStep === 2 && (
          <Stack gap="md">
            <Alert
              icon={<IconInfoCircle size={18} />}
              title={t('createReceiptModal.fileUpload.title')}
              color="blue"
              variant="light"
            >
              {t('createReceiptModal.fileUpload.description')}
            </Alert>

            {uploadedFiles.length > 0 && (
              <SimpleGrid cols={{ base: 2, xs: 3, sm: 4 }} spacing="xs">
                {uploadedFiles.map((fileObj, index) => (
                  <Card
                    key={index}
                    padding="xs"
                    radius="md"
                    withBorder
                    style={{ position: 'relative' }}
                  >
                    <Image
                      src={fileObj.preview}
                      alt={`File ${index + 1}`}
                      height={120}
                      fit="cover"
                      radius="sm"
                    />
                    <ActionIcon
                      color="red"
                      variant="filled"
                      size="sm"
                      radius="xl"
                      onClick={() => removeFile(index)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Card>
                ))}
              </SimpleGrid>
            )}

            <FileButton
              onChange={handleFilesUpload}
              accept="image/*"
              multiple
            >
              {(props) => (
                <Button
                  {...props}
                  leftSection={<IconUpload size={18} />}
                  variant={uploadedFiles.length > 0 ? 'light' : 'filled'}
                  fullWidth
                  size="lg"
                >
                  {uploadedFiles.length > 0 
                    ? t('createReceiptModal.fileUpload.uploadMore', { count: uploadedFiles.length })
                    : t('createReceiptModal.fileUpload.uploadButton')}
                </Button>
              )}
            </FileButton>

            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                background: `linear-gradient(135deg, ${theme.colors.green[9]} 0%, ${theme.colors.teal[9]} 100%)`
              }}
            >
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="md" radius="md" variant="white" color="green">
                    <IconCheck size={18} />
                  </ThemeIcon>
                  <Text size="md" fw={600} c="white">
                    {t('createReceiptModal.sections.summary')}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="white" opacity={0.9}>
                    {t('createReceiptModal.summary.paymentAmount')}:
                  </Text>
                  <Text size="lg" fw={700} c="white">
                    {formatCurrency(amountPaid)} THB
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="white" opacity={0.9}>
                    {t('createReceiptModal.summary.paymentMethod')}:
                  </Text>
                  <Text size="sm" fw={600} c="white">
                    {getPaymentMethodText(paymentMethod)}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="white" opacity={0.9}>
                    {t('createReceiptModal.summary.itemsPaid')}:
                  </Text>
                  <Text size="sm" fw={600} c="white">
                    {selectedItems.length}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="white" opacity={0.9}>
                    {t('createReceiptModal.summary.filesAttached')}:
                  </Text>
                  <Badge color="white" variant="light">
                    <Group gap={4}>
                      <IconPhoto size={14} />
                      {uploadedFiles.length}
                    </Group>
                  </Badge>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* Кнопки навигации */}
        <Group justify="space-between">
          <Button
            variant="subtle"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>

          <Group gap="xs">
            {currentStep > 0 && (
              <Button
                variant="light"
                leftSection={<IconChevronLeft size={18} />}
                onClick={handlePrev}
              >
                {t('createReceiptModal.buttons.back')}
              </Button>
            )}
            {currentStep < 2 ? (
              <Button
                rightSection={<IconChevronRight size={18} />}
                onClick={handleNext}
              >
                {t('createReceiptModal.buttons.next')}
              </Button>
            ) : (
              <Button
                leftSection={<IconCheck size={18} />}
                onClick={handleSubmit}
                loading={loading}
                gradient={{ from: 'green', to: 'teal' }}
                variant="gradient"
              >
                {mode === 'edit' ? t('createReceiptModal.buttons.update') : t('createReceiptModal.buttons.create')}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CreateReceiptModal;