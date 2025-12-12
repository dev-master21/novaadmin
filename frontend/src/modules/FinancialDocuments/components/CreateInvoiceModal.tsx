// frontend/src/modules/FinancialDocuments/components/CreateInvoiceModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Card,
  Grid,
  Divider,
  Paper,
  ActionIcon,
  ThemeIcon,
  Radio,
  Stepper,
  Alert,
  Checkbox,
  Switch,
  useMantineTheme,
  ScrollArea
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconTrash,
  IconUser,
  IconFileText,
  IconCurrencyBaht,
  IconCheck,
  IconX,
  IconFileInvoice,
  IconBuilding,
  IconBuildingBank,
  IconChevronRight,
  IconChevronLeft,
  IconCalendar,
  IconInfoCircle,
  IconPackage,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconQrcode
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { 
  financialDocumentsApi, 
  CreateInvoiceDTO, 
  InvoiceItem,
  BankDetailsType,
  SavedBankDetails
} from '@/api/financialDocuments.api';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import SelectInvoiceItemsModal from './SelectInvoiceItemsModal'; // ✅ ДОБАВЛЕНО
import dayjs from 'dayjs';

interface CreateInvoiceModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  agreementId?: number;
  mode?: 'create' | 'edit';
  invoiceId?: number;
}

const CreateInvoiceModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  agreementId,
  mode = 'create',
  invoiceId
}: CreateInvoiceModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  // Form state
  const [agreementIdState, setAgreementIdState] = useState<number | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  // From/To party types
  const [fromType, setFromType] = useState<'company' | 'individual'>('company');
  const [toType, setToType] = useState<'company' | 'individual'>('individual');

  // From fields
  const [fromCompanyName, setFromCompanyName] = useState('');
  const [fromCompanyTaxId, setFromCompanyTaxId] = useState('');
  const [fromCompanyAddress, setFromCompanyAddress] = useState('');
  const [fromDirectorName, setFromDirectorName] = useState('');
  const [fromDirectorCountry, setFromDirectorCountry] = useState('');
  const [fromDirectorPassport, setFromDirectorPassport] = useState('');
  const [fromIndividualName, setFromIndividualName] = useState('');
  const [fromIndividualCountry, setFromIndividualCountry] = useState('');
  const [fromIndividualPassport, setFromIndividualPassport] = useState('');

  // To fields
  const [toCompanyName, setToCompanyName] = useState('');
  const [toCompanyTaxId, setToCompanyTaxId] = useState('');
  const [toCompanyAddress, setToCompanyAddress] = useState('');
  const [toDirectorName, setToDirectorName] = useState('');
  const [toDirectorCountry, setToDirectorCountry] = useState('');
  const [toDirectorPassport, setToDirectorPassport] = useState('');
  const [toIndividualName, setToIndividualName] = useState('');
  const [toIndividualCountry, setToIndividualCountry] = useState('');
  const [toIndividualPassport, setToIndividualPassport] = useState('');

  // Bank details
  const [savedBankDetailsList, setSavedBankDetailsList] = useState<SavedBankDetails[]>([]);
  const [selectedSavedBankDetailsId, setSelectedSavedBankDetailsId] = useState<number | null>(null);
  const [bankDetailsType, setBankDetailsType] = useState<BankDetailsType>('simple');
  
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountAddress, setBankAccountAddress] = useState('');
  const [bankAddress, setBankAddress] = useState('');
  const [bankCurrency, setBankCurrency] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [bankCustomDetails, setBankCustomDetails] = useState('');
  
  const [saveBankDetails, setSaveBankDetails] = useState(false);
  const [bankDetailsName, setBankDetailsName] = useState('');

  const [taxAmount, setTaxAmount] = useState<number>(0);

  // ✅ QR Code toggle
  const [showQrCode, setShowQrCode] = useState<boolean>(true);

  // Duplicate warning
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [existingInvoiceId, setExistingInvoiceId] = useState<number | null>(null);

  // 🆕 SUCCESS MODAL
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);
  const [createdInvoiceData, setCreatedInvoiceData] = useState<any>(null); // ✅ ДОБАВЛЕНО

  // 🆕 PDF SELECTION MODAL
  const [pdfSelectionModalVisible, setPdfSelectionModalVisible] = useState(false); // ✅ ДОБАВЛЕНО

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      fetchAgreements();
      fetchSavedBankDetails();
      
      if (mode === 'create') {
        resetForm();
        if (agreementId) {
          setAgreementIdState(agreementId);
          loadAgreementData(agreementId);
          checkExistingInvoices(agreementId);
        }
      } else if (mode === 'edit' && invoiceId) {
        loadInvoiceForEdit(invoiceId);
      }
    }
  }, [visible, agreementId, mode, invoiceId]);

  const loadInvoiceForEdit = async (id: number) => {
    try {
      setLoading(true);
      const response = await financialDocumentsApi.getInvoiceById(id);
      const invoice = response.data.data;

      setAgreementIdState(invoice.agreement_id || null);
      setInvoiceDate(invoice.invoice_date ? new Date(invoice.invoice_date) : new Date());
      setDueDate(invoice.due_date ? new Date(invoice.due_date) : null);
      setNotes(invoice.notes || '');
      setTaxAmount(invoice.tax_amount || 0);

      setFromType(invoice.from_type);
      if (invoice.from_type === 'company') {
        setFromCompanyName(invoice.from_company_name || '');
        setFromCompanyTaxId(invoice.from_company_tax_id || '');
        setFromCompanyAddress(invoice.from_company_address || '');
        setFromDirectorName(invoice.from_director_name || '');
        setFromDirectorCountry(invoice.from_director_country || '');
        setFromDirectorPassport(invoice.from_director_passport || '');
      } else {
        setFromIndividualName(invoice.from_individual_name || '');
        setFromIndividualCountry(invoice.from_individual_country || '');
        setFromIndividualPassport(invoice.from_individual_passport || '');
      }

      setToType(invoice.to_type);
      if (invoice.to_type === 'company') {
        setToCompanyName(invoice.to_company_name || '');
        setToCompanyTaxId(invoice.to_company_tax_id || '');
        setToCompanyAddress(invoice.to_company_address || '');
        setToDirectorName(invoice.to_director_name || '');
        setToDirectorCountry(invoice.to_director_country || '');
        setToDirectorPassport(invoice.to_director_passport || '');
      } else {
        setToIndividualName(invoice.to_individual_name || '');
        setToIndividualCountry(invoice.to_individual_country || '');
        setToIndividualPassport(invoice.to_individual_passport || '');
      }

      if (invoice.items && invoice.items.length > 0) {
        setItems(invoice.items);
      }

      if (invoice.bank_details_type) {
        setBankDetailsType(invoice.bank_details_type);

        if (invoice.bank_details_type === 'simple') {
          setBankName(invoice.bank_name || '');
          setBankAccountName(invoice.bank_account_name || '');
          setBankAccountNumber(invoice.bank_account_number || '');
        } else if (invoice.bank_details_type === 'international') {
          setBankName(invoice.bank_name || '');
          setBankAccountName(invoice.bank_account_name || '');
          setBankAccountNumber(invoice.bank_account_number || '');
          setBankAccountAddress(invoice.bank_account_address || '');
          setBankAddress(invoice.bank_address || '');
          setBankCurrency(invoice.bank_currency || '');
          setBankCode(invoice.bank_code || '');
          setBankSwiftCode(invoice.bank_swift_code || '');
        } else if (invoice.bank_details_type === 'custom') {
          setBankCustomDetails(invoice.bank_custom_details || '');
        }
      }

      // ✅ QR Code setting
      setShowQrCode(invoice.show_qr_code === 1);

      notifications.show({
        title: t('common.success'),
        message: t('createInvoiceModal.messages.invoiceLoaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('createInvoiceModal.messages.invoiceLoadError'),
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

  const checkExistingInvoices = async (agreementIdToCheck: number) => {
    try {
      const response = await financialDocumentsApi.checkExistingInvoicesForAgreement(agreementIdToCheck);
      if (response.data.data.hasExisting && response.data.data.firstInvoice) {
        setExistingInvoiceId(response.data.data.firstInvoice.id);
        setShowDuplicateWarning(true);
      }
    } catch (error: any) {
      console.error('Error checking existing invoices:', error);
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
      setBankAddress(saved.bank_address || ''); // ✅ ДОБАВИТЬ ЭТУ СТРОКУ
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
    setBankAddress(''); // ✅ ДОБАВИТЬ ЭТУ СТРОКУ
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
        message: t('createInvoiceModal.messages.agreementsLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const loadAgreementData = async (id: number) => {
    try {
      const response = await agreementsApi.getAgreementWithParties(id);
      const agreementData = response.data.data;

      if (agreementData.lessor) {
        const lessor = agreementData.lessor;
        setFromType(lessor.type);
        
        if (lessor.type === 'company') {
          setFromCompanyName(lessor.company_name || '');
          setFromCompanyTaxId(lessor.company_tax_id || '');
          setFromCompanyAddress(lessor.company_address || '');
          setFromDirectorName(lessor.director_name || '');
          setFromDirectorCountry(lessor.director_country || '');
          setFromDirectorPassport(lessor.director_passport || '');
        } else {
          setFromIndividualName(lessor.individual_name || '');
          setFromIndividualCountry(lessor.individual_country || '');
          setFromIndividualPassport(lessor.individual_passport || '');
        }
      }

      if (agreementData.tenant) {
        const tenant = agreementData.tenant;
        setToType(tenant.type);
        
        if (tenant.type === 'company') {
          setToCompanyName(tenant.company_name || '');
          setToCompanyTaxId(tenant.company_tax_id || '');
          setToCompanyAddress(tenant.company_address || '');
          setToDirectorName(tenant.director_name || '');
          setToDirectorCountry(tenant.director_country || '');
          setToDirectorPassport(tenant.director_passport || '');
        } else {
          setToIndividualName(tenant.individual_name || '');
          setToIndividualCountry(tenant.individual_country || '');
          setToIndividualPassport(tenant.individual_passport || '');
        }
      }

      notifications.show({
        title: t('common.success'),
        message: t('createInvoiceModal.messages.agreementDataLoaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createInvoiceModal.messages.agreementDataLoadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleAgreementChange = (value: string | null) => {
    if (value) {
      const id = Number(value);
      setAgreementIdState(id);
      loadAgreementData(id);
      if (mode === 'create') {
        checkExistingInvoices(id);
      }
    } else {
      setAgreementIdState(null);
    }
  };

const resetForm = () => {
  setCurrentStep(0);
  setFromType('company');
  setToType('individual');
  setItems([{ description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  setAgreementIdState(null);
  setInvoiceDate(new Date());
  setDueDate(null);
  setNotes('');
  setFromCompanyName('');
  setFromCompanyTaxId('');
  setFromCompanyAddress('');
  setFromDirectorName('');
  setFromDirectorCountry('');
  setFromDirectorPassport('');
  setFromIndividualName('');
  setFromIndividualCountry('');
  setFromIndividualPassport('');
  setToCompanyName('');
  setToCompanyTaxId('');
  setToCompanyAddress('');
  setToDirectorName('');
  setToDirectorCountry('');
  setToDirectorPassport('');
  setToIndividualName('');
  setToIndividualCountry('');
  setToIndividualPassport('');
  setSelectedSavedBankDetailsId(null);
  setBankDetailsType('simple');
  setBankName('');
  setBankAccountName('');
  setBankAccountNumber('');
  setBankAccountAddress('');
  setBankAddress('');
  setBankCurrency('');
  setBankCode('');
  setBankSwiftCode('');
  setBankCustomDetails('');
  setSaveBankDetails(false);
  setBankDetailsName('');
  setTaxAmount(0);
  setShowQrCode(true);
  setErrors({});
  setShowDuplicateWarning(false);
  setExistingInvoiceId(null);
  setShowSuccessModal(false);
  setCreatedInvoiceId(null);
  setCreatedInvoiceData(null);
  setPdfSelectionModalVisible(false);
};

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!invoiceDate) {
        newErrors.invoiceDate = t('createInvoiceModal.validation.specifyDate');
      }
    } else if (step === 1) {
      if (fromType === 'company') {
        if (!fromCompanyName) newErrors.fromCompanyName = t('createInvoiceModal.validation.specifyName');
        if (!fromCompanyTaxId) newErrors.fromCompanyTaxId = t('createInvoiceModal.validation.specifyTaxId');
        if (!fromDirectorName) newErrors.fromDirectorName = t('createInvoiceModal.validation.specifyName');
      } else {
        if (!fromIndividualName) newErrors.fromIndividualName = t('createInvoiceModal.validation.specifyFullName');
        if (!fromIndividualCountry) newErrors.fromIndividualCountry = t('createInvoiceModal.validation.specifyCountry');
        if (!fromIndividualPassport) newErrors.fromIndividualPassport = t('createInvoiceModal.validation.specifyPassport');
      }

      if (toType === 'company') {
        if (!toCompanyName) newErrors.toCompanyName = t('createInvoiceModal.validation.specifyName');
        if (!toCompanyTaxId) newErrors.toCompanyTaxId = t('createInvoiceModal.validation.specifyTaxId');
        if (!toDirectorName) newErrors.toDirectorName = t('createInvoiceModal.validation.specifyName');
      } else {
        if (!toIndividualName) newErrors.toIndividualName = t('createInvoiceModal.validation.specifyFullName');
        if (!toIndividualCountry) newErrors.toIndividualCountry = t('createInvoiceModal.validation.specifyCountry');
        if (!toIndividualPassport) newErrors.toIndividualPassport = t('createInvoiceModal.validation.specifyPassport');
      }
    } else if (step === 2) {
      const hasValidItem = items.some(item => 
        item.description && item.quantity > 0 && item.unit_price > 0
      );
      
      if (!hasValidItem) {
        notifications.show({
          title: t('errors.validation'),
          message: t('createInvoiceModal.validation.addAtLeastOneItem'),
          color: 'red',
          icon: <IconX size={18} />
        });
        return false;
      }
    } else if (step === 3) {
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

      const validItems = items.filter(item => 
        item.description && item.quantity > 0 && item.unit_price > 0
      );

      if (validItems.length === 0) {
        notifications.show({
          title: t('errors.validation'),
          message: t('createInvoiceModal.validation.addAtLeastOneItem'),
          color: 'red',
          icon: <IconX size={18} />
        });
        setLoading(false);
        return;
      }

      const invoiceData: CreateInvoiceDTO = {
        agreement_id: agreementIdState || undefined,
        invoice_date: dayjs(invoiceDate).format('YYYY-MM-DD'),
        due_date: dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : undefined,
        
        from_type: fromType,
        from_company_name: fromType === 'company' ? fromCompanyName : undefined,
        from_company_tax_id: fromType === 'company' ? fromCompanyTaxId : undefined,
        from_company_address: fromType === 'company' ? fromCompanyAddress : undefined,
        from_director_name: fromType === 'company' ? fromDirectorName : undefined,
        from_director_country: fromType === 'company' ? fromDirectorCountry : undefined,
        from_director_passport: fromType === 'company' ? fromDirectorPassport : undefined,
        from_individual_name: fromType === 'individual' ? fromIndividualName : undefined,
        from_individual_country: fromType === 'individual' ? fromIndividualCountry : undefined,
        from_individual_passport: fromType === 'individual' ? fromIndividualPassport : undefined,
        
        to_type: toType,
        to_company_name: toType === 'company' ? toCompanyName : undefined,
        to_company_tax_id: toType === 'company' ? toCompanyTaxId : undefined,
        to_company_address: toType === 'company' ? toCompanyAddress : undefined,
        to_director_name: toType === 'company' ? toDirectorName : undefined,
        to_director_country: toType === 'company' ? toDirectorCountry : undefined,
        to_director_passport: toType === 'company' ? toDirectorPassport : undefined,
        to_individual_name: toType === 'individual' ? toIndividualName : undefined,
        to_individual_country: toType === 'individual' ? toIndividualCountry : undefined,
        to_individual_passport: toType === 'individual' ? toIndividualPassport : undefined,
        
        items: validItems,
        
        bank_details_type: bankDetailsType,
        saved_bank_details_id: selectedSavedBankDetailsId || undefined,
        
        bank_name: bankDetailsType !== 'custom' ? bankName : undefined,
        bank_account_name: bankDetailsType !== 'custom' ? bankAccountName : undefined,
        bank_account_number: bankDetailsType !== 'custom' ? bankAccountNumber : undefined,
        
        bank_account_address: bankDetailsType === 'international' ? bankAccountAddress : undefined,
        bank_address: bankDetailsType === 'international' ? bankAddress : undefined, // ✅ ДОБАВИТЬ ЭТУ СТРОКУ
        bank_currency: bankDetailsType === 'international' ? bankCurrency : undefined,
        bank_code: bankDetailsType === 'international' ? bankCode : undefined,
        bank_swift_code: bankDetailsType === 'international' ? bankSwiftCode : undefined,
        
        bank_custom_details: bankDetailsType === 'custom' ? bankCustomDetails : undefined,
        
        save_bank_details: saveBankDetails,
        bank_details_name: saveBankDetails ? bankDetailsName : undefined,
        
        notes: notes,
        tax_amount: taxAmount,
        
        show_qr_code: showQrCode ? 1 : 0
      };

      if (mode === 'edit' && invoiceId) {
        await financialDocumentsApi.updateInvoice(invoiceId, invoiceData);
        notifications.show({
          title: t('common.success'),
          message: t('createInvoiceModal.messages.updated'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        onSuccess();
        resetForm();
      } else {
        const response = await financialDocumentsApi.createInvoice(invoiceData);
        const newInvoiceId = response.data.data.id;
        
        // 🆕 ЗАГРУЖАЕМ ПОЛНЫЙ ИНВОЙС С ITEMS
        const fullInvoiceResponse = await financialDocumentsApi.getInvoiceById(newInvoiceId);
        const fullInvoice = fullInvoiceResponse.data.data;
        
        setCreatedInvoiceId(newInvoiceId);
        setCreatedInvoiceData(fullInvoice); // ✅ ДОБАВЛЕНО
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('createInvoiceModal.messages.createError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  // 🆕 СКАЧИВАНИЕ PDF С ВЫБРАННЫМИ ПОЗИЦИЯМИ ИЗ SUCCESS MODAL
  const handleDownloadPDFFromSuccess = async (selectedIds: number[]) => {
    try {
      setPdfSelectionModalVisible(false);
      
      notifications.show({
        id: 'pdf-download',
        loading: true,
        title: t('createInvoiceModal.messages.generatingPDF'),
        message: t('common.pleaseWait'),
        autoClose: false,
        withCloseButton: false
      });

      const response = await financialDocumentsApi.downloadInvoicePDF(
        createdInvoiceId!,
        selectedIds.length > 0 ? selectedIds : undefined
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${createdInvoiceData?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.update({
        id: 'pdf-download',
        color: 'green',
        title: t('common.success'),
        message: t('createInvoiceModal.messages.pdfDownloaded'),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });
    } catch (error: any) {
      notifications.update({
        id: 'pdf-download',
        color: 'red',
        title: t('errors.generic'),
        message: t('createInvoiceModal.messages.pdfDownloadError'),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000
      });
    }
  };

  // 🆕 ПОЛУЧАЕМ СПИСОК НЕОПЛАЧЕННЫХ ПОЗИЦИЙ ПО УМОЛЧАНИЮ
  const getDefaultSelectedItemsForPDF = (): number[] => {
    if (!createdInvoiceData?.items) return [];
    return createdInvoiceData.items
      .filter((item: any) => item.is_fully_paid !== 1)
      .map((item: any) => item.id);
  };

  const totals = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  return (
    <>
      {/* 🆕 МОДАЛЬНОЕ ОКНО ПРЕДУПРЕЖДЕНИЯ О ДУБЛИКАТЕ С zIndex */}
      <Modal
        opened={showDuplicateWarning}
        onClose={() => setShowDuplicateWarning(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" color="yellow">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {t('financialDocuments.invoice.duplicateWarning')}
            </Text>
          </Group>
        }
        size="md"
        centered
        zIndex={10000}
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
            {t('financialDocuments.invoice.duplicateMessage')}
          </Alert>

          <Group justify="space-between">
            <Button
              variant="light"
              color="blue"
              onClick={() => {
                setShowDuplicateWarning(false);
                if (existingInvoiceId) {
                  window.location.href = `/financial-documents/invoices/${existingInvoiceId}`;
                }
              }}
            >
              {t('financialDocuments.invoice.viewExisting')}
            </Button>
            <Button
              variant="filled"
              color="green"
              onClick={() => setShowDuplicateWarning(false)}
            >
              {t('financialDocuments.invoice.createNew')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* 🆕 SUCCESS MODAL */}
      <Modal
        opened={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          resetForm();
          onSuccess();
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" color="green" variant="light">
              <IconCheck size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {t('createInvoiceModal.success.title')}
            </Text>
          </Group>
        }
        size="md"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Alert color="green" icon={<IconCheck size={18} />}>
            {t('createInvoiceModal.success.message')}
          </Alert>

          <Group grow>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconDownload size={18} />}
              onClick={() => setPdfSelectionModalVisible(true)} // ✅ ИЗМЕНЕНО: открывает модальное окно выбора позиций
            >
              {t('createInvoiceModal.success.downloadPDF')}
            </Button>
            <Button
              variant="light"
              color="violet"
              leftSection={<IconEdit size={18} />}
              onClick={() => {
                setShowSuccessModal(false);
                if (createdInvoiceId) {
                  window.location.href = `/financial-documents/invoices/${createdInvoiceId}`;
                }
              }}
            >
              {t('createInvoiceModal.success.edit')}
            </Button>
          </Group>

          <Button
            fullWidth
            onClick={() => {
              setShowSuccessModal(false);
              resetForm();
              onSuccess();
            }}
          >
            {t('common.close')}
          </Button>
        </Stack>
      </Modal>

      {/* ОСНОВНОЕ МОДАЛЬНОЕ ОКНО С SCROLLAREA */}
      <Modal
        opened={visible && !showSuccessModal}
        onClose={onCancel}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconFileInvoice size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {mode === 'edit' ? t('createInvoiceModal.titleEdit') : t('createInvoiceModal.title')}
            </Text>
          </Group>
        }
        size={isMobile ? 'full' : 'xl'}
        centered={!isMobile}
        padding="lg"
        scrollAreaComponent={ScrollArea.Autosize}
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
              label={!isMobile ? t('createInvoiceModal.steps.basic') : undefined}
              description={!isMobile ? t('createInvoiceModal.steps.basicDesc') : undefined}
              icon={<IconFileText size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('createInvoiceModal.steps.parties') : undefined}
              description={!isMobile ? t('createInvoiceModal.steps.partiesDesc') : undefined}
              icon={<IconUser size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('createInvoiceModal.steps.items') : undefined}
              description={!isMobile ? t('createInvoiceModal.steps.itemsDesc') : undefined}
              icon={<IconPackage size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('createInvoiceModal.steps.bank') : undefined}
              description={!isMobile ? t('createInvoiceModal.steps.bankDesc') : undefined}
              icon={<IconBuildingBank size={18} />}
            />
          </Stepper>

          {/* Шаг 1: Основная информация */}
          {currentStep === 0 && (
            <Stack gap="md">
              <Alert
                icon={<IconInfoCircle size={18} />}
                title={t('createInvoiceModal.alerts.basicInfoTitle')}
                color="blue"
                variant="light"
              >
                {t('createInvoiceModal.alerts.basicInfoDesc')}
              </Alert>

              <Select
                label={t('createInvoiceModal.fields.agreement')}
                placeholder={t('createInvoiceModal.placeholders.selectAgreement')}
                leftSection={<IconFileText size={18} />}
                data={agreements.map(agreement => ({
                  value: String(agreement.id),
                  label: agreement.agreement_number + (agreement.property_name ? ` - ${agreement.property_name}` : '')
                }))}
                value={agreementIdState ? String(agreementIdState) : null}
                onChange={handleAgreementChange}
                searchable
                clearable
                disabled={mode === 'edit'}
                styles={{ input: { fontSize: '16px' } }}
              />

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label={t('createInvoiceModal.fields.invoiceDate')}
                    placeholder={t('createInvoiceModal.placeholders.selectDate')}
                    leftSection={<IconCalendar size={18} />}
                    value={invoiceDate}
                    onChange={setInvoiceDate}
                    valueFormat="DD.MM.YYYY"
                    clearable={false}
                    error={errors.invoiceDate}
                    styles={{ input: { fontSize: '16px' } }}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label={t('createInvoiceModal.fields.dueDate')}
                    placeholder={t('createInvoiceModal.placeholders.selectDate')}
                    leftSection={<IconCalendar size={18} />}
                    value={dueDate}
                    onChange={setDueDate}
                    valueFormat="DD.MM.YYYY"
                    clearable
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Grid.Col>
              </Grid>

              <Textarea
                label={t('createInvoiceModal.fields.notes')}
                placeholder={t('createInvoiceModal.placeholders.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                minRows={3}
                styles={{ input: { fontSize: '16px' } }}
              />
            </Stack>
          )}

          {/* Шаг 2: Стороны - БЕЗ ИЗМЕНЕНИЙ */}
          {currentStep === 1 && (
            <Stack gap="md">
              {/* От кого (From) */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      <IconUser size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('createInvoiceModal.sections.from')}
                    </Text>
                  </Group>

                  <Radio.Group
                    value={fromType}
                    onChange={(value) => setFromType(value as 'company' | 'individual')}
                    label={t('createInvoiceModal.fields.type')}
                  >
                    <Group mt="xs">
                      <Radio value="company" label={t('createInvoiceModal.partyTypes.company')} />
                      <Radio value="individual" label={t('createInvoiceModal.partyTypes.individual')} />
                    </Group>
                  </Radio.Group>

                  {fromType === 'company' ? (
                    <>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.companyName')}
                            placeholder="Company Ltd"
                            leftSection={<IconBuilding size={18} />}
                            value={fromCompanyName}
                            onChange={(e) => setFromCompanyName(e.target.value)}
                            error={errors.fromCompanyName}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.taxId')}
                            placeholder="1234567890"
                            value={fromCompanyTaxId}
                            onChange={(e) => setFromCompanyTaxId(e.target.value)}
                            error={errors.fromCompanyTaxId}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                      </Grid>

                      <Textarea
                        label={t('createInvoiceModal.fields.companyAddress')}
                        placeholder="123 Business Street"
                        value={fromCompanyAddress}
                        onChange={(e) => setFromCompanyAddress(e.target.value)}
                        minRows={2}
                        styles={{ input: { fontSize: '16px' } }}
                      />

                      <Divider 
                        label={t('createInvoiceModal.sections.director')} 
                        labelPosition="center"
                      />

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.directorName')}
                            placeholder="John Smith"
                            leftSection={<IconUser size={18} />}
                            value={fromDirectorName}
                            onChange={(e) => setFromDirectorName(e.target.value)}
                            error={errors.fromDirectorName}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.passportCountry')}
                            placeholder="Thailand"
                            value={fromDirectorCountry}
                            onChange={(e) => setFromDirectorCountry(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.directorPassport')}
                            placeholder="AB1234567"
                            value={fromDirectorPassport}
                            onChange={(e) => setFromDirectorPassport(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                      </Grid>
                    </>
                  ) : (
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.fullName')}
                          placeholder="John Doe"
                          leftSection={<IconUser size={18} />}
                          value={fromIndividualName}
                          onChange={(e) => setFromIndividualName(e.target.value)}
                          error={errors.fromIndividualName}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.country')}
                          placeholder="Russia"
                          value={fromIndividualCountry}
                          onChange={(e) => setFromIndividualCountry(e.target.value)}
                          error={errors.fromIndividualCountry}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.passportNumber')}
                          placeholder="AB1234567"
                          value={fromIndividualPassport}
                          onChange={(e) => setFromIndividualPassport(e.target.value)}
                          error={errors.fromIndividualPassport}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </Stack>
              </Card>

              {/* Кому (To) */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                      <IconUser size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('createInvoiceModal.sections.to')}
                    </Text>
                  </Group>

                  <Radio.Group
                    value={toType}
                    onChange={(value) => setToType(value as 'company' | 'individual')}
                    label={t('createInvoiceModal.fields.type')}
                  >
                    <Group mt="xs">
                      <Radio value="company" label={t('createInvoiceModal.partyTypes.company')} />
                      <Radio value="individual" label={t('createInvoiceModal.partyTypes.individual')} />
                    </Group>
                  </Radio.Group>

                  {toType === 'company' ? (
                    <>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.companyName')}
                            placeholder="Company Ltd"
                            leftSection={<IconBuilding size={18} />}
                            value={toCompanyName}
                            onChange={(e) => setToCompanyName(e.target.value)}
                            error={errors.toCompanyName}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.taxId')}
                            placeholder="1234567890"
                            value={toCompanyTaxId}
                            onChange={(e) => setToCompanyTaxId(e.target.value)}
                            error={errors.toCompanyTaxId}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                      </Grid>

                      <Textarea
                        label={t('createInvoiceModal.fields.companyAddress')}
                        placeholder="123 Business Street"
                        value={toCompanyAddress}
                        onChange={(e) => setToCompanyAddress(e.target.value)}
                        minRows={2}
                        styles={{ input: { fontSize: '16px' } }}
                      />

                      <Divider 
                        label={t('createInvoiceModal.sections.director')} 
                        labelPosition="center"
                      />

                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.directorName')}
                            placeholder="John Smith"
                            leftSection={<IconUser size={18} />}
                            value={toDirectorName}
                            onChange={(e) => setToDirectorName(e.target.value)}
                            error={errors.toDirectorName}
                            styles={{ input: { fontSize: '16px' } }}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.passportCountry')}
                            placeholder="Thailand"
                            value={toDirectorCountry}
                            onChange={(e) => setToDirectorCountry(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('createInvoiceModal.fields.directorPassport')}
                            placeholder="AB1234567"
                            value={toDirectorPassport}
                            onChange={(e) => setToDirectorPassport(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                      </Grid>
                    </>
                  ) : (
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.fullName')}
                          placeholder="John Doe"
                          leftSection={<IconUser size={18} />}
                          value={toIndividualName}
                          onChange={(e) => setToIndividualName(e.target.value)}
                          error={errors.toIndividualName}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.country')}
                          placeholder="Russia"
                          value={toIndividualCountry}
                          onChange={(e) => setToIndividualCountry(e.target.value)}
                          error={errors.toIndividualCountry}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <TextInput
                          label={t('createInvoiceModal.fields.passportNumber')}
                          placeholder="AB1234567"
                          value={toIndividualPassport}
                          onChange={(e) => setToIndividualPassport(e.target.value)}
                          error={errors.toIndividualPassport}
                          styles={{ input: { fontSize: '16px' } }}
                          required
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </Stack>
              </Card>
            </Stack>
          )}

          {/* Шаг 3: Позиции инвойса БЕЗ ЧЕКБОКСОВ */}
          {currentStep === 2 && (
            <Stack gap="md">
              <Alert
                icon={<IconInfoCircle size={18} />}
                title={t('createInvoiceModal.alerts.itemsTitle')}
                color="blue"
                variant="light"
              >
                {t('createInvoiceModal.alerts.itemsDesc')}
              </Alert>

              {items.map((item, index) => (
                <Card
                  key={index}
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    borderLeft: `4px solid ${theme.colors.blue[6]}`
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon 
                          size="md" 
                          radius="md" 
                          variant="light" 
                          color="blue"
                        >
                          <IconPackage size={18} />
                        </ThemeIcon>
                        <Text size="sm" fw={600}>
                          {t('createInvoiceModal.items.position', { number: index + 1 })}
                        </Text>
                      </Group>
                      {items.length > 1 && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeItem(index)}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      )}
                    </Group>

                    <TextInput
                      placeholder={t('createInvoiceModal.placeholders.itemDescription')}
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      styles={{ input: { fontSize: '16px' } }}
                    />

                    <Grid gutter="xs">
                      <Grid.Col span={{ base: 12, xs: 3 }}>
                        <NumberInput
                          label={t('createInvoiceModal.items.quantity')}
                          value={item.quantity}
                          onChange={(value) => updateItem(index, 'quantity', typeof value === 'number' ? value : 1)}
                          min={0.01}
                          step={1}
                          decimalScale={2}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, xs: 3 }}>
                        <NumberInput
                          label={t('createInvoiceModal.items.price')}
                          value={item.unit_price}
                          onChange={(value) => updateItem(index, 'unit_price', typeof value === 'number' ? value : 0)}
                          min={0}
                          step={100}
                          thousandSeparator=" "
                          leftSection={<IconCurrencyBaht size={18} />}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, xs: 3 }}>
                        <NumberInput
                          label={t('createInvoiceModal.items.total')}
                          value={item.total_price}
                          disabled
                          thousandSeparator=" "
                          leftSection={<IconCurrencyBaht size={18} />}
                          styles={{ 
                            input: { 
                              fontSize: '16px',
                              fontWeight: 600,
                              color: theme.colors.blue[6]
                            } 
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, xs: 3 }}>
                        <DateInput
                          label={t('createInvoiceModal.items.dueDate')}
                          placeholder={t('createInvoiceModal.placeholders.selectDate')}
                          leftSection={<IconCalendar size={16} />}
                          value={item.due_date ? new Date(item.due_date) : null}
                          onChange={(date) => updateItem(index, 'due_date', date ? dayjs(date).format('YYYY-MM-DD') : undefined)}
                          valueFormat="DD.MM.YYYY"
                          clearable
                          styles={{ input: { fontSize: '14px' } }}
                        />
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Card>
              ))}

              <Button
                variant="light"
                leftSection={<IconPlus size={18} />}
                onClick={addItem}
                fullWidth
              >
                {t('createInvoiceModal.buttons.addItem')}
              </Button>

              {/* Итоговые суммы */}
              <Paper
                p="lg"
                radius="md"
                withBorder
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.teal[9]} 0%, ${theme.colors.green[9]} 100%)`
                }}
              >
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="sm" c="white" opacity={0.9}>
                      {t('createInvoiceModal.totals.subtotal')}:
                    </Text>
                    <Text size="md" fw={600} c="white">
                      {formatCurrency(totals.subtotal)} {t('common.currencyTHB')}
                    </Text>
                  </Group>

                  <NumberInput
                    label={
                      <Text size="sm" c="white" opacity={0.9}>
                        {t('createInvoiceModal.fields.tax')}
                      </Text>
                    }
                    value={taxAmount}
                    onChange={(value) => setTaxAmount(typeof value === 'number' ? value : 0)}
                    min={0}
                    step={100}
                    thousandSeparator=" "
                    leftSection={<IconCurrencyBaht size={18} />}
                    styles={{ 
                      input: { 
                        fontSize: '16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: 'white'
                      },
                      label: { color: 'white' }
                    }}
                  />

                  <Divider color="rgba(255, 255, 255, 0.2)" />

                  <Group justify="space-between">
                    <Text size="lg" fw={700} c="white">
                      {t('createInvoiceModal.totals.total')}:
                    </Text>
                    <Text size="xl" fw={700} c="white">
                      {formatCurrency(totals.total)} {t('common.currencyTHB')}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* Шаг 4: Банковские реквизиты */}
          {currentStep === 3 && (
            <Stack gap="md">
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
                            placeholder="123 Main Street, New York"
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
                            value={bankAddress}
                            onChange={(e) => setBankAddress(e.target.value)}
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

              {/* ✅ НАСТРОЙКИ ДОКУМЕНТА */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                      <IconQrcode size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('createInvoiceModal.sections.documentSettings')}
                    </Text>
                  </Group>

                  <Switch
                    label={t('createInvoiceModal.fields.showQrCode')}
                    description={t('createInvoiceModal.fields.showQrCodeDesc')}
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.currentTarget.checked)}
                    size="md"
                    thumbIcon={
                      showQrCode ? (
                        <IconCheck size={12} color={theme.colors.teal[6]} stroke={3} />
                      ) : (
                        <IconX size={12} color={theme.colors.red[6]} stroke={3} />
                      )
                    }
                  />
                </Stack>
              </Card>

              {/* Предпросмотр итогов */}
              <Paper
                p="lg"
                radius="md"
                withBorder
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.violet[9]} 0%, ${theme.colors.grape[9]} 100%)`
                }}
              >
                <Stack gap="md">
                  <Group gap="xs">
                    <ThemeIcon size="md" radius="md" variant="white" color="violet">
                      <IconCheck size={18} />
                    </ThemeIcon>
                    <Text size="md" fw={600} c="white">
                      {t('createInvoiceModal.sections.summary')}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text size="sm" c="white" opacity={0.9}>
                      {t('createInvoiceModal.summary.itemsCount')}:
                    </Text>
                    <Text size="md" fw={600} c="white">
                      {items.filter(i => i.description).length}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text size="lg" fw={700} c="white">
                      {t('createInvoiceModal.summary.totalAmount')}:
                    </Text>
                    <Text size="xl" fw={700} c="white">
                      {formatCurrency(totals.total)} {t('common.currencyTHB')}
                    </Text>
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
                  {t('createInvoiceModal.buttons.back')}
                </Button>
              )}
              {currentStep < 3 ? (
                <Button
                  rightSection={<IconChevronRight size={18} />}
                  onClick={handleNext}
                >
                  {t('createInvoiceModal.buttons.next')}
                </Button>
              ) : (
                <Button
                  leftSection={<IconCheck size={18} />}
                  onClick={handleSubmit}
                  loading={loading}
                  gradient={{ from: 'teal', to: 'green' }}
                  variant="gradient"
                >
                  {mode === 'edit' ? t('createInvoiceModal.buttons.update') : t('createInvoiceModal.buttons.create')}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* 🆕 МОДАЛЬНОЕ ОКНО ВЫБОРА ПОЗИЦИЙ ДЛЯ PDF */}
      {createdInvoiceData && (
        <SelectInvoiceItemsModal
          opened={pdfSelectionModalVisible}
          onClose={() => setPdfSelectionModalVisible(false)}
          items={createdInvoiceData.items || []}
          onDownload={handleDownloadPDFFromSuccess}
          defaultSelectedItems={getDefaultSelectedItemsForPDF()}
        />
      )}
    </>
  );
};

export default CreateInvoiceModal;