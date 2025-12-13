// frontend/src/modules/FinancialDocuments/components/CreateReservationConfirmationModal.tsx
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
  Stepper,
  Alert,
  Switch,
  Collapse,
  Badge,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
  ScrollArea,
  Box,
  SimpleGrid
} from '@mantine/core';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconTrash,
  IconUser,
  IconFileText,
  IconCheck,
  IconX,
  IconHome,
  IconChevronRight,
  IconChevronLeft,
  IconCalendar,
  IconInfoCircle,
  IconPhone,
  IconMail,
  IconBuilding,
  IconUsers,
  IconPlane,
  IconCar,
  IconClock,
  IconNote,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconEdit,
  IconCalendarEvent,
  IconMapPin,
  IconBed,
  IconCurrencyBaht,
  IconBolt,
  IconDroplet,
  IconTemplate,
  IconMessageCircle,
  IconCash
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { 
  financialDocumentsApi, 
  CreateReservationConfirmationDTO,
  ConfirmationGuest,
  ConfirmationTemplate
} from '@/api/financialDocuments.api';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import api from '@/api/axios';
import dayjs from 'dayjs';

interface CreateReservationConfirmationModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  agreementId?: number;
  mode?: 'create' | 'edit';
  confirmationId?: number;
}

// Значения по умолчанию
const DEFAULT_ARRIVAL_TIME = '14:00';
const DEFAULT_DEPARTURE_TIME = '12:00';
const DEFAULT_CHECK_IN_TIME = '14:00';
const DEFAULT_CHECK_OUT_TIME = '12:00';
const DEFAULT_ELECTRICITY_RATE = 8;
const DEFAULT_WATER_RATE = 30;
const DEFAULT_DEPOSIT_AMOUNT = 20000;
const DEFAULT_CANCELLATION_POLICY = 'Order confirmed, No change, No refund';
const DEFAULT_WELCOME_MESSAGE = "Thank you for making a reservation at our Villa. We're delighted to confirm the details for your upcoming stay.";
const DEFAULT_PHONE = '+6661008937';
const DEFAULT_EMAIL = 'service@novaestate.company';

const CreateReservationConfirmationModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  agreementId,
  mode = 'create',
  confirmationId
}: CreateReservationConfirmationModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [templates, setTemplates] = useState<ConfirmationTemplate[]>([]);

  // Partner defaults (загружаются из БД)
  const [partnerDefaults, setPartnerDefaults] = useState<{
    phone: string;
    email: string;
    name: string;
  }>({
    phone: DEFAULT_PHONE,
    email: DEFAULT_EMAIL,
    name: ''
  });

  // Form state
  const [agreementIdState, setAgreementIdState] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  
  // Property Info
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  
  // From (Sender)
  const [fromCompanyName, setFromCompanyName] = useState('');
  const [fromTelephone, setFromTelephone] = useState(DEFAULT_PHONE);
  const [fromEmail, setFromEmail] = useState(DEFAULT_EMAIL);
  
  // Dates
  const [confirmationDate, setConfirmationDate] = useState<Date | null>(new Date());
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [arrivalTime, setArrivalTime] = useState(DEFAULT_ARRIVAL_TIME);
  const [departureTime, setDepartureTime] = useState(DEFAULT_DEPARTURE_TIME);
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [checkOutTime, setCheckOutTime] = useState(DEFAULT_CHECK_OUT_TIME);
  
  // Booking Details
  const [roomType, setRoomType] = useState('');
  const [rateType, setRateType] = useState<'daily' | 'monthly'>('daily');
  const [rateAmount, setRateAmount] = useState<number>(0);
  const [numRooms, setNumRooms] = useState<number>(1);
  const [numGuests, setNumGuests] = useState<number>(1);
  const [depositAmount, setDepositAmount] = useState<number>(DEFAULT_DEPOSIT_AMOUNT);
  
  // Services
  const [pickUpService, setPickUpService] = useState(false);
  const [dropOffService, setDropOffService] = useState(false);
  const [arrivalFlight, setArrivalFlight] = useState('');
  const [departureFlight, setDepartureFlight] = useState('');
  
  // Guests
  const [guests, setGuests] = useState<ConfirmationGuest[]>([
    { guest_name: '', passport_number: '', passport_country: '', phone: '', email: '' }
  ]);
  
  // Notice & Policy
  const [noticeContent, setNoticeContent] = useState('');
  const [originalTemplateContent, setOriginalTemplateContent] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState(DEFAULT_CANCELLATION_POLICY);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME_MESSAGE);
  const [remarks, setRemarks] = useState('');
  
  // Rates
  const [electricityRate, setElectricityRate] = useState<number>(DEFAULT_ELECTRICITY_RATE);
  const [waterRate, setWaterRate] = useState<number>(DEFAULT_WATER_RATE);

  // Success Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdConfirmationId, setCreatedConfirmationId] = useState<number | null>(null);
  const [createdConfirmationNumber, setCreatedConfirmationNumber] = useState<string>('');

  // Guest details collapse state
  const [expandedGuests, setExpandedGuests] = useState<Record<number, boolean>>({});
  
  // Errors state
  const [, setErrors] = useState<Record<string, string>>({});

  // Функция для замены переменных в шаблоне
  const replaceTemplateVariables = (template: string): string => {
    if (!template) return '';
    
    const variables: Record<string, string> = {
      '{{check_in_time}}': checkInTime || DEFAULT_CHECK_IN_TIME,
      '{{check_out_time}}': checkOutTime || DEFAULT_CHECK_OUT_TIME,
      '{{deposit_amount}}': depositAmount ? new Intl.NumberFormat('en-US').format(depositAmount) : String(DEFAULT_DEPOSIT_AMOUNT),
      '{{electricity_rate}}': String(electricityRate || DEFAULT_ELECTRICITY_RATE),
      '{{water_rate}}': String(waterRate || DEFAULT_WATER_RATE),
      '{{property_name}}': propertyName || '________',
      '{{property_address}}': propertyAddress || '________',
      '{{arrival_date}}': arrivalDate ? dayjs(arrivalDate).format('DD.MM.YYYY') : '________',
      '{{departure_date}}': departureDate ? dayjs(departureDate).format('DD.MM.YYYY') : '________',
      '{{rate_amount}}': rateAmount ? new Intl.NumberFormat('en-US').format(rateAmount) : '________',
      '{{num_guests}}': numGuests ? String(numGuests) : '________',
      '{{num_rooms}}': numRooms ? String(numRooms) : '________',
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  };

  // Загрузка данных партнёра текущего пользователя
  const fetchCurrentPartner = async () => {
    try {
      const response = await api.get('/partners/current');
      if (response.data.success && response.data.data) {
        const partner = response.data.data;
        const newDefaults = {
          phone: partner.phone || DEFAULT_PHONE,
          email: partner.email || DEFAULT_EMAIL,
          name: partner.partner_name || ''
        };
        setPartnerDefaults(newDefaults);
        
        // Устанавливаем значения по умолчанию из партнёра
        setFromTelephone(newDefaults.phone);
        setFromEmail(newDefaults.email);
        if (newDefaults.name) {
          setFromCompanyName(newDefaults.name);
        }
      }
    } catch (error) {
      console.error('Error fetching current partner:', error);
      // Используем дефолтные значения
    }
  };

  useEffect(() => {
    if (visible) {
      fetchAgreements();
      fetchTemplates();
      fetchCurrentPartner(); // Загружаем данные партнёра
      
      if (mode === 'create') {
        resetForm();
        if (agreementId) {
          setAgreementIdState(agreementId);
          loadAgreementData(agreementId);
        }
      } else if (mode === 'edit' && confirmationId) {
        loadConfirmationForEdit(confirmationId);
      }
    }
  }, [visible, agreementId, mode, confirmationId]);

  const loadConfirmationForEdit = async (id: number) => {
    try {
      setLoading(true);
      const response = await financialDocumentsApi.getReservationConfirmationById(id);
      const confirmation = response.data.data;

      setAgreementIdState(confirmation.agreement_id || null);
      setTemplateId(confirmation.template_id || null);
      
      setPropertyName(confirmation.property_name || '');
      setPropertyAddress(confirmation.property_address || '');
      
      setFromCompanyName(confirmation.from_company_name || '');
      setFromTelephone(confirmation.from_telephone || partnerDefaults.phone);
      setFromEmail(confirmation.from_email || partnerDefaults.email);
      
      setConfirmationDate(confirmation.confirmation_date ? new Date(confirmation.confirmation_date) : new Date());
      setArrivalDate(confirmation.arrival_date ? new Date(confirmation.arrival_date) : null);
      setDepartureDate(confirmation.departure_date ? new Date(confirmation.departure_date) : null);
      setArrivalTime(confirmation.arrival_time || DEFAULT_ARRIVAL_TIME);
      setDepartureTime(confirmation.departure_time || DEFAULT_DEPARTURE_TIME);
      setCheckInTime(confirmation.check_in_time || DEFAULT_CHECK_IN_TIME);
      setCheckOutTime(confirmation.check_out_time || DEFAULT_CHECK_OUT_TIME);
      
      setRoomType(confirmation.room_type || '');
      setRateType(confirmation.rate_type || 'daily');
      setRateAmount(confirmation.rate_amount || 0);
      setNumRooms(confirmation.num_rooms || 1);
      setNumGuests(confirmation.num_guests || 1);
      setDepositAmount((confirmation as any).deposit_amount || DEFAULT_DEPOSIT_AMOUNT);
      
      setPickUpService(confirmation.pick_up_service || false);
      setDropOffService(confirmation.drop_off_service || false);
      setArrivalFlight(confirmation.arrival_flight || '');
      setDepartureFlight(confirmation.departure_flight || '');
      
      if (confirmation.guests && confirmation.guests.length > 0) {
        setGuests(confirmation.guests);
      }
      
      setNoticeContent(confirmation.notice_content || '');
      setCancellationPolicy(confirmation.cancellation_policy || DEFAULT_CANCELLATION_POLICY);
      setWelcomeMessage(confirmation.welcome_message || DEFAULT_WELCOME_MESSAGE);
      setRemarks(confirmation.remarks || '');
      
      setElectricityRate(confirmation.electricity_rate || DEFAULT_ELECTRICITY_RATE);
      setWaterRate(confirmation.water_rate || DEFAULT_WATER_RATE);

      notifications.show({
        title: t('common.success'),
        message: t('reservationConfirmation.messages.loaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      console.error('Error loading confirmation:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('reservationConfirmation.messages.loadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      const response = await agreementsApi.getAll({ limit: 100 });
      setAgreements(response.data.data);
    } catch (error: any) {
      console.error('Error loading agreements:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await financialDocumentsApi.getAllConfirmationTemplates();
      setTemplates(response.data.data);
      
      // Установить шаблон по умолчанию если есть
      if (response.data.data.length > 0 && !templateId) {
        const defaultTemplate = response.data.data.find(t => t.is_active) || response.data.data[0];
        setTemplateId(defaultTemplate.id);
        setOriginalTemplateContent(defaultTemplate.content);
        setNoticeContent(defaultTemplate.content);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
    }
  };

  const loadAgreementData = async (id: number) => {
    try {
      const response = await agreementsApi.getAgreementWithParties(id);
      const agreementData = response.data.data;

      // Заполняем данные из договора
      if (agreementData.property_name) {
        setPropertyName(agreementData.property_name);
      }
      
      if ((agreementData as any).property_address) {
        setPropertyAddress((agreementData as any).property_address);
      }

      // From (Lessor/Landlord)
      if (agreementData.lessor) {
        const lessor = agreementData.lessor as any;
        if (lessor.type === 'company') {
          setFromCompanyName(lessor.company_name || '');
          // Телефон и email остаются из партнёра (уже установлены)
        } else {
          setFromCompanyName(lessor.individual_name || '');
        }
      }

      // Даты из договора
      if (agreementData.date_from) {
        setArrivalDate(new Date(agreementData.date_from));
      }
      if (agreementData.date_to) {
        setDepartureDate(new Date(agreementData.date_to));
      }

      // Ставки из договора
      if (agreementData.rent_amount_monthly) {
        setRateType('monthly');
        setRateAmount(agreementData.rent_amount_monthly);
      }

      // Депозит из договора
      if ((agreementData as any).deposit_amount) {
        setDepositAmount((agreementData as any).deposit_amount);
      } else if ((agreementData as any).security_deposit) {
        setDepositAmount((agreementData as any).security_deposit);
      }

      // Дополнительные поля
      if ((agreementData as any).electricity_rate) {
        setElectricityRate((agreementData as any).electricity_rate);
      }
      if ((agreementData as any).water_rate) {
        setWaterRate((agreementData as any).water_rate);
      }

      // Tenant как гость
      if (agreementData.tenant) {
        const tenant = agreementData.tenant as any;
        const guestName = tenant.type === 'company' 
          ? tenant.director_name || tenant.company_name 
          : tenant.individual_name;
        const guestPassport = tenant.type === 'company'
          ? tenant.director_passport
          : tenant.individual_passport;
        const guestCountry = tenant.type === 'company'
          ? tenant.director_country
          : tenant.individual_country;
          
        if (guestName) {
          setGuests([{
            guest_name: guestName,
            passport_number: guestPassport || '',
            passport_country: guestCountry || '',
            phone: '',
            email: ''
          }]);
        }
      }

      notifications.show({
        title: t('common.success'),
        message: t('reservationConfirmation.messages.agreementDataLoaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      console.error('Error loading agreement data:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('reservationConfirmation.messages.agreementDataLoadError'),
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
    } else {
      setAgreementIdState(null);
    }
  };

  const handleTemplateChange = (value: string | null) => {
    if (value) {
      const id = Number(value);
      setTemplateId(id);
      const template = templates.find(t => t.id === id);
      if (template) {
        setOriginalTemplateContent(template.content);
        setNoticeContent(template.content);
      }
    } else {
      setTemplateId(null);
      setOriginalTemplateContent('');
      setNoticeContent('');
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setAgreementIdState(null);
    setTemplateId(null);
    
    setPropertyName('');
    setPropertyAddress('');
    
    // Используем данные партнёра как дефолтные
    setFromCompanyName(partnerDefaults.name);
    setFromTelephone(partnerDefaults.phone);
    setFromEmail(partnerDefaults.email);
    
    setConfirmationDate(new Date());
    setArrivalDate(null);
    setDepartureDate(null);
    setArrivalTime(DEFAULT_ARRIVAL_TIME);
    setDepartureTime(DEFAULT_DEPARTURE_TIME);
    setCheckInTime(DEFAULT_CHECK_IN_TIME);
    setCheckOutTime(DEFAULT_CHECK_OUT_TIME);
    
    setRoomType('');
    setRateType('daily');
    setRateAmount(0);
    setNumRooms(1);
    setNumGuests(1);
    setDepositAmount(DEFAULT_DEPOSIT_AMOUNT);
    
    setPickUpService(false);
    setDropOffService(false);
    setArrivalFlight('');
    setDepartureFlight('');
    
    setGuests([{ guest_name: '', passport_number: '', passport_country: '', phone: '', email: '' }]);
    
    setNoticeContent('');
    setOriginalTemplateContent('');
    setCancellationPolicy(DEFAULT_CANCELLATION_POLICY);
    setWelcomeMessage(DEFAULT_WELCOME_MESSAGE);
    setRemarks('');
    
    setElectricityRate(DEFAULT_ELECTRICITY_RATE);
    setWaterRate(DEFAULT_WATER_RATE);
    
    setErrors({});
    setExpandedGuests({});
    setShowSuccessModal(false);
    setCreatedConfirmationId(null);
    setCreatedConfirmationNumber('');
    
    // Загрузить шаблон по умолчанию
    if (templates.length > 0) {
      const defaultTemplate = templates.find(t => t.is_active) || templates[0];
      setTemplateId(defaultTemplate.id);
      setOriginalTemplateContent(defaultTemplate.content);
      setNoticeContent(defaultTemplate.content);
    }
  };

  // Guest management
  const addGuest = () => {
    setGuests([...guests, { guest_name: '', passport_number: '', passport_country: '', phone: '', email: '' }]);
  };

  const removeGuest = (index: number) => {
    if (guests.length > 1) {
      const newGuests = guests.filter((_, i) => i !== index);
      setGuests(newGuests);
    }
  };

  const updateGuest = (index: number, field: keyof ConfirmationGuest, value: string) => {
    const newGuests = [...guests];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setGuests(newGuests);
  };

  const toggleGuestExpanded = (index: number) => {
    setExpandedGuests(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      // Базовая информация - необязательные поля
    } else if (step === 1) {
      // Property & From - необязательные поля
    } else if (step === 2) {
      // Guests - хотя бы один гость с именем
      const hasValidGuest = guests.some(guest => guest.guest_name.trim() !== '');
      if (!hasValidGuest) {
        notifications.show({
          title: t('errors.validation'),
          message: t('reservationConfirmation.validation.addAtLeastOneGuest'),
          color: 'red',
          icon: <IconX size={18} />
        });
        return false;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      // При переходе на шаг 4 (Details) подставляем значения в шаблон
      if (currentStep === 2) {
        if (originalTemplateContent) {
          const processedContent = replaceTemplateVariables(originalTemplateContent);
          setNoticeContent(processedContent);
        }
      }
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

      const validGuests = guests.filter(guest => guest.guest_name.trim() !== '');

      if (validGuests.length === 0) {
        notifications.show({
          title: t('errors.validation'),
          message: t('reservationConfirmation.validation.addAtLeastOneGuest'),
          color: 'red',
          icon: <IconX size={18} />
        });
        setLoading(false);
        return;
      }

      const confirmationData: CreateReservationConfirmationDTO = {
        agreement_id: agreementIdState || undefined,
        template_id: templateId || undefined,
        
        property_name: propertyName || undefined,
        property_address: propertyAddress || undefined,
        
        from_company_name: fromCompanyName || undefined,
        from_telephone: fromTelephone || partnerDefaults.phone,
        from_email: fromEmail || partnerDefaults.email,
        
        confirmation_date: dayjs(confirmationDate).format('YYYY-MM-DD'),
        arrival_date: arrivalDate ? dayjs(arrivalDate).format('YYYY-MM-DD') : undefined,
        departure_date: departureDate ? dayjs(departureDate).format('YYYY-MM-DD') : undefined,
        arrival_time: arrivalTime || DEFAULT_ARRIVAL_TIME,
        departure_time: departureTime || DEFAULT_DEPARTURE_TIME,
        check_in_time: checkInTime || DEFAULT_CHECK_IN_TIME,
        check_out_time: checkOutTime || DEFAULT_CHECK_OUT_TIME,
        
        room_type: roomType || undefined,
        rate_type: rateType,
        rate_amount: rateAmount || undefined,
        num_rooms: numRooms || undefined,
        num_guests: numGuests || undefined,
        deposit_amount: depositAmount || DEFAULT_DEPOSIT_AMOUNT,
        
        pick_up_service: pickUpService,
        drop_off_service: dropOffService,
        arrival_flight: arrivalFlight || undefined,
        departure_flight: departureFlight || undefined,
        
        remarks: remarks !== '' ? remarks : null,
        notice_content: noticeContent !== '' ? noticeContent : null,
        cancellation_policy: cancellationPolicy || DEFAULT_CANCELLATION_POLICY,
        welcome_message: welcomeMessage || DEFAULT_WELCOME_MESSAGE,
        
        electricity_rate: electricityRate || DEFAULT_ELECTRICITY_RATE,
        water_rate: waterRate || DEFAULT_WATER_RATE,
        
        guests: validGuests.map((guest, index) => ({
          ...guest,
          sort_order: index
        }))
      } as any; // as any чтобы обойти TypeScript ошибку пока не обновим DTO

      if (mode === 'edit' && confirmationId) {
        await financialDocumentsApi.updateReservationConfirmation(confirmationId, confirmationData);
        notifications.show({
          title: t('common.success'),
          message: t('reservationConfirmation.messages.updated'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        onSuccess();
        resetForm();
      } else {
        const response = await financialDocumentsApi.createReservationConfirmation(confirmationData);
        setCreatedConfirmationId(response.data.data.id);
        setCreatedConfirmationNumber(response.data.data.confirmation_number);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Error submitting confirmation:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('reservationConfirmation.messages.createError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!createdConfirmationId) return;
    
    try {
      notifications.show({
        id: 'pdf-download',
        loading: true,
        title: t('reservationConfirmation.messages.generatingPDF'),
        message: t('common.pleaseWait'),
        autoClose: false,
        withCloseButton: false
      });

      const response = await financialDocumentsApi.downloadReservationConfirmationPDF(createdConfirmationId);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${createdConfirmationNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.update({
        id: 'pdf-download',
        color: 'green',
        title: t('common.success'),
        message: t('reservationConfirmation.messages.pdfDownloaded'),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });
    } catch (error: any) {
      notifications.update({
        id: 'pdf-download',
        color: 'red',
        title: t('errors.generic'),
        message: t('reservationConfirmation.messages.pdfDownloadError'),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  // Calculate nights
  const calculateNights = () => {
    if (arrivalDate && departureDate) {
      return dayjs(departureDate).diff(dayjs(arrivalDate), 'day');
    }
    return 0;
  };

  // Стили для DatePicker
  const datePickerWrapperStyle: React.CSSProperties = {
    width: '100%'
  };

  return (
    <>
      {/* SUCCESS MODAL */}
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
              {t('reservationConfirmation.success.title')}
            </Text>
          </Group>
        }
        size="md"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Alert color="green" icon={<IconCheck size={18} />}>
            {t('reservationConfirmation.success.message')}
          </Alert>

          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {t('reservationConfirmation.success.confirmationNumber')}:
              </Text>
              <Text size="md" fw={700} c="green">
                {createdConfirmationNumber}
              </Text>
            </Group>
          </Paper>

          <Group grow>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconDownload size={18} />}
              onClick={handleDownloadPDF}
            >
              {t('reservationConfirmation.success.downloadPDF')}
            </Button>
            <Button
              variant="light"
              color="violet"
              leftSection={<IconEdit size={18} />}
              onClick={() => {
                setShowSuccessModal(false);
                if (createdConfirmationId) {
                  window.location.href = `/financial-documents/confirmations/${createdConfirmationId}`;
                }
              }}
            >
              {t('reservationConfirmation.success.edit')}
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

      {/* MAIN MODAL */}
      <Modal
        opened={visible && !showSuccessModal}
        onClose={onCancel}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'green', to: 'teal' }}>
              <IconCalendarEvent size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>
              {mode === 'edit' ? t('reservationConfirmation.titleEdit') : t('reservationConfirmation.title')}
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
              label={!isMobile ? t('reservationConfirmation.steps.basic') : undefined}
              description={!isMobile ? t('reservationConfirmation.steps.basicDesc') : undefined}
              icon={<IconFileText size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('reservationConfirmation.steps.property') : undefined}
              description={!isMobile ? t('reservationConfirmation.steps.propertyDesc') : undefined}
              icon={<IconHome size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('reservationConfirmation.steps.guests') : undefined}
              description={!isMobile ? t('reservationConfirmation.steps.guestsDesc') : undefined}
              icon={<IconUsers size={18} />}
            />
            <Stepper.Step
              label={!isMobile ? t('reservationConfirmation.steps.details') : undefined}
              description={!isMobile ? t('reservationConfirmation.steps.detailsDesc') : undefined}
              icon={<IconNote size={18} />}
            />
          </Stepper>

          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <Stack gap="md">
              <Alert
                icon={<IconInfoCircle size={18} />}
                title={t('reservationConfirmation.alerts.basicInfoTitle')}
                color="blue"
                variant="light"
              >
                {t('reservationConfirmation.alerts.basicInfoDesc')}
              </Alert>

              <Select
                label={t('reservationConfirmation.fields.agreement')}
                placeholder={t('reservationConfirmation.placeholders.selectAgreement')}
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

              <Select
                label={t('reservationConfirmation.fields.noticeTemplate')}
                placeholder={t('reservationConfirmation.placeholders.selectTemplate')}
                leftSection={<IconTemplate size={18} />}
                data={templates.map(template => ({
                  value: String(template.id),
                  label: template.name
                }))}
                value={templateId ? String(templateId) : null}
                onChange={handleTemplateChange}
                searchable
                clearable
                styles={{ input: { fontSize: '16px' } }}
              />

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Text size="sm" fw={500} mb={4}>{t('reservationConfirmation.fields.confirmationDate')}</Text>
                  <div style={datePickerWrapperStyle}>
                    <DatePicker
                      selected={confirmationDate}
                      onChange={(date) => setConfirmationDate(date)}
                      dateFormat="dd.MM.yyyy"
                      placeholderText={t('reservationConfirmation.placeholders.selectDate')}
                      customInput={
                        <TextInput
                          leftSection={<IconCalendar size={18} />}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      }
                      wrapperClassName="datepicker-wrapper"
                    />
                  </div>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Text size="sm" fw={500} mb={4}>{t('reservationConfirmation.fields.arrivalDate')}</Text>
                  <div style={datePickerWrapperStyle}>
                    <DatePicker
                      selected={arrivalDate}
                      onChange={(date) => setArrivalDate(date)}
                      dateFormat="dd.MM.yyyy"
                      placeholderText={t('reservationConfirmation.placeholders.selectDate')}
                      isClearable
                      customInput={
                        <TextInput
                          leftSection={<IconCalendar size={18} />}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      }
                      wrapperClassName="datepicker-wrapper"
                    />
                  </div>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Text size="sm" fw={500} mb={4}>{t('reservationConfirmation.fields.departureDate')}</Text>
                  <div style={datePickerWrapperStyle}>
                    <DatePicker
                      selected={departureDate}
                      onChange={(date) => setDepartureDate(date)}
                      dateFormat="dd.MM.yyyy"
                      placeholderText={t('reservationConfirmation.placeholders.selectDate')}
                      isClearable
                      minDate={arrivalDate || undefined}
                      customInput={
                        <TextInput
                          leftSection={<IconCalendar size={18} />}
                          styles={{ input: { fontSize: '16px' } }}
                        />
                      }
                      wrapperClassName="datepicker-wrapper"
                    />
                  </div>
                </Grid.Col>
              </Grid>

              {arrivalDate && departureDate && (
                <Paper 
                  p="md" 
                  radius="md" 
                  withBorder
                  style={{
                    backgroundColor: isDark ? theme.colors.blue[9] : theme.colors.blue[0],
                    borderColor: isDark ? theme.colors.blue[7] : theme.colors.blue[3]
                  }}
                >
                  <Group justify="center" gap="md">
                    <IconClock size={20} color={isDark ? theme.colors.blue[4] : theme.colors.blue[6]} />
                    <Text size="sm" fw={500} c={isDark ? 'blue.4' : 'blue.7'}>
                      {t('reservationConfirmation.fields.nights')}: {calculateNights()}
                    </Text>
                  </Group>
                </Paper>
              )}

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label={t('reservationConfirmation.fields.arrivalTime')}
                    leftSection={<IconClock size={18} />}
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label={t('reservationConfirmation.fields.departureTime')}
                    leftSection={<IconClock size={18} />}
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          )}

          {/* Step 2: Property & From */}
          {currentStep === 1 && (
            <Stack gap="md">
              {/* Property Info */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="green">
                      <IconHome size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.property')}
                    </Text>
                  </Group>

                  <TextInput
                    label={t('reservationConfirmation.fields.propertyName')}
                    placeholder="Villa Paradise"
                    leftSection={<IconHome size={18} />}
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    styles={{ input: { fontSize: '16px' } }}
                  />

                  <Textarea
                    label={t('reservationConfirmation.fields.propertyAddress')}
                    placeholder="123 Beach Road, Phuket"
                    leftSection={<IconMapPin size={18} />}
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    minRows={2}
                    styles={{ input: { fontSize: '16px' } }}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label={t('reservationConfirmation.fields.roomType')}
                        placeholder="Deluxe Pool Villa"
                        leftSection={<IconBed size={18} />}
                        value={roomType}
                        onChange={(e) => setRoomType(e.target.value)}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.numRooms')}
                        value={numRooms}
                        onChange={(value) => setNumRooms(typeof value === 'number' ? value : 1)}
                        min={1}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.numGuests')}
                        value={numGuests}
                        onChange={(value) => setNumGuests(typeof value === 'number' ? value : 1)}
                        min={1}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <Select
                        label={t('reservationConfirmation.fields.rateType')}
                        leftSection={<IconCurrencyBaht size={18} />}
                        data={[
                          { value: 'daily', label: t('reservationConfirmation.rateTypes.daily') },
                          { value: 'monthly', label: t('reservationConfirmation.rateTypes.monthly') }
                        ]}
                        value={rateType}
                        onChange={(value) => setRateType(value as 'daily' | 'monthly')}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.rateAmount')}
                        placeholder="5000"
                        leftSection={<IconCurrencyBaht size={18} />}
                        value={rateAmount}
                        onChange={(value) => setRateAmount(typeof value === 'number' ? value : 0)}
                        min={0}
                        thousandSeparator=" "
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.depositAmount')}
                        placeholder="20000"
                        leftSection={<IconCash size={18} />}
                        value={depositAmount}
                        onChange={(value) => setDepositAmount(typeof value === 'number' ? value : DEFAULT_DEPOSIT_AMOUNT)}
                        min={0}
                        thousandSeparator=" "
                        suffix=" THB"
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <TextInput
                        label={t('reservationConfirmation.fields.checkInTime')}
                        leftSection={<IconClock size={18} />}
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <TextInput
                        label={t('reservationConfirmation.fields.checkOutTime')}
                        leftSection={<IconClock size={18} />}
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.electricityRate')}
                        leftSection={<IconBolt size={18} />}
                        value={electricityRate}
                        onChange={(value) => setElectricityRate(typeof value === 'number' ? value : DEFAULT_ELECTRICITY_RATE)}
                        min={0}
                        decimalScale={2}
                        suffix=" THB/unit"
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <NumberInput
                        label={t('reservationConfirmation.fields.waterRate')}
                        leftSection={<IconDroplet size={18} />}
                        value={waterRate}
                        onChange={(value) => setWaterRate(typeof value === 'number' ? value : DEFAULT_WATER_RATE)}
                        min={0}
                        decimalScale={2}
                        suffix=" THB/unit"
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Card>

              {/* From (Sender) */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                      <IconBuilding size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.from')}
                    </Text>
                  </Group>

                  <TextInput
                    label={t('reservationConfirmation.fields.fromCompanyName')}
                    placeholder="NOVA Estate Co., Ltd."
                    leftSection={<IconBuilding size={18} />}
                    value={fromCompanyName}
                    onChange={(e) => setFromCompanyName(e.target.value)}
                    styles={{ input: { fontSize: '16px' } }}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label={t('reservationConfirmation.fields.fromTelephone')}
                        placeholder={partnerDefaults.phone}
                        leftSection={<IconPhone size={18} />}
                        value={fromTelephone}
                        onChange={(e) => setFromTelephone(e.target.value)}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label={t('reservationConfirmation.fields.fromEmail')}
                        placeholder={partnerDefaults.email}
                        leftSection={<IconMail size={18} />}
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Card>
            </Stack>
          )}

          {/* Step 3: Guests */}
          {currentStep === 2 && (
            <Stack gap="md">
              <Alert
                icon={<IconInfoCircle size={18} />}
                title={t('reservationConfirmation.alerts.guestsTitle')}
                color="blue"
                variant="light"
              >
                {t('reservationConfirmation.alerts.guestsDesc')}
              </Alert>

              {guests.map((guest, index) => (
                <Card
                  key={index}
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    borderLeft: `4px solid ${theme.colors.green[6]}`
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon 
                          size="md" 
                          radius="md" 
                          variant="light" 
                          color="green"
                        >
                          <IconUser size={18} />
                        </ThemeIcon>
                        <Text size="sm" fw={600}>
                          {t('reservationConfirmation.guest.title', { number: index + 1 })}
                        </Text>
                        {index === 0 && (
                          <Badge size="xs" color="green" variant="light">
                            {t('reservationConfirmation.guest.primary')}
                          </Badge>
                        )}
                      </Group>
                      <Group gap="xs">
                        <Tooltip label={expandedGuests[index] ? t('common.collapse') : t('common.expand')}>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => toggleGuestExpanded(index)}
                          >
                            {expandedGuests[index] ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                          </ActionIcon>
                        </Tooltip>
                        {guests.length > 1 && (
                          <Tooltip label={t('common.delete')}>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => removeGuest(index)}
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>

                    <TextInput
                      placeholder={t('reservationConfirmation.placeholders.guestName')}
                      leftSection={<IconUser size={18} />}
                      value={guest.guest_name}
                      onChange={(e) => updateGuest(index, 'guest_name', e.target.value)}
                      styles={{ input: { fontSize: '16px' } }}
                      required
                    />

                    <Collapse in={expandedGuests[index] || false}>
                      <Stack gap="md" pt="md">
                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <TextInput
                              label={t('reservationConfirmation.fields.passportNumber')}
                              placeholder="AB1234567"
                              value={guest.passport_number || ''}
                              onChange={(e) => updateGuest(index, 'passport_number', e.target.value)}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <TextInput
                              label={t('reservationConfirmation.fields.passportCountry')}
                              placeholder="Russia"
                              value={guest.passport_country || ''}
                              onChange={(e) => updateGuest(index, 'passport_country', e.target.value)}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Grid.Col>
                        </Grid>

                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <TextInput
                              label={t('reservationConfirmation.fields.guestPhone')}
                              placeholder="+7 999 123 45 67"
                              leftSection={<IconPhone size={18} />}
                              value={guest.phone || ''}
                              onChange={(e) => updateGuest(index, 'phone', e.target.value)}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <TextInput
                              label={t('reservationConfirmation.fields.guestEmail')}
                              placeholder="guest@email.com"
                              leftSection={<IconMail size={18} />}
                              value={guest.email || ''}
                              onChange={(e) => updateGuest(index, 'email', e.target.value)}
                              styles={{ input: { fontSize: '16px' } }}
                            />
                          </Grid.Col>
                        </Grid>
                      </Stack>
                    </Collapse>
                  </Stack>
                </Card>
              ))}

              <Button
                variant="light"
                leftSection={<IconPlus size={18} />}
                onClick={addGuest}
                fullWidth
              >
                {t('reservationConfirmation.buttons.addGuest')}
              </Button>

              {/* Services */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="orange">
                      <IconCar size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.services')}
                    </Text>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Switch
                        label={t('reservationConfirmation.fields.pickUpService')}
                        description={t('reservationConfirmation.fields.pickUpServiceDesc')}
                        checked={pickUpService}
                        onChange={(e) => setPickUpService(e.currentTarget.checked)}
                        size="md"
                        thumbIcon={
                          pickUpService ? (
                            <IconCheck size={12} color={theme.colors.teal[6]} stroke={3} />
                          ) : (
                            <IconX size={12} color={theme.colors.red[6]} stroke={3} />
                          )
                        }
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Switch
                        label={t('reservationConfirmation.fields.dropOffService')}
                        description={t('reservationConfirmation.fields.dropOffServiceDesc')}
                        checked={dropOffService}
                        onChange={(e) => setDropOffService(e.currentTarget.checked)}
                        size="md"
                        thumbIcon={
                          dropOffService ? (
                            <IconCheck size={12} color={theme.colors.teal[6]} stroke={3} />
                          ) : (
                            <IconX size={12} color={theme.colors.red[6]} stroke={3} />
                          )
                        }
                      />
                    </Grid.Col>
                  </Grid>

                  <Collapse in={pickUpService || dropOffService}>
                    <Grid gutter="md" pt="md">
                      {pickUpService && (
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('reservationConfirmation.fields.arrivalFlight')}
                            placeholder="TG 123"
                            leftSection={<IconPlane size={18} />}
                            value={arrivalFlight}
                            onChange={(e) => setArrivalFlight(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                      )}
                      {dropOffService && (
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('reservationConfirmation.fields.departureFlight')}
                            placeholder="TG 456"
                            leftSection={<IconPlane size={18} />}
                            value={departureFlight}
                            onChange={(e) => setDepartureFlight(e.target.value)}
                            styles={{ input: { fontSize: '16px' } }}
                          />
                        </Grid.Col>
                      )}
                    </Grid>
                  </Collapse>
                </Stack>
              </Card>
            </Stack>
          )}

          {/* Step 4: Notice & Policy */}
          {currentStep === 3 && (
            <Stack gap="md">
              {/* Notice */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="yellow">
                      <IconAlertCircle size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.notice')}
                    </Text>
                  </Group>

                  <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />}>
                    {t('reservationConfirmation.alerts.noticeVariables')}
                  </Alert>

                  <Textarea
                    label={t('reservationConfirmation.fields.noticeContent')}
                    placeholder={t('reservationConfirmation.placeholders.noticeContent')}
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    minRows={12}
                    maxRows={20}
                    autosize
                    styles={{ input: { fontSize: '14px', fontFamily: 'monospace' } }}
                  />
                </Stack>
              </Card>

              {/* Cancellation Policy */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="red">
                      <IconX size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.cancellationPolicy')}
                    </Text>
                  </Group>

                  <TextInput
                    label={t('reservationConfirmation.fields.cancellationPolicy')}
                    value={cancellationPolicy}
                    onChange={(e) => setCancellationPolicy(e.target.value)}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Stack>
              </Card>

              {/* Welcome Message */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="pink">
                      <IconMessageCircle size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.welcomeMessage')}
                    </Text>
                  </Group>

                  <Textarea
                    label={t('reservationConfirmation.fields.welcomeMessage')}
                    placeholder={t('reservationConfirmation.placeholders.welcomeMessage')}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    minRows={3}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Stack>
              </Card>

              {/* Remarks */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                      <IconNote size={20} />
                    </ThemeIcon>
                    <Text size="md" fw={600}>
                      {t('reservationConfirmation.sections.remarks')}
                    </Text>
                  </Group>

                  <Textarea
                    label={t('reservationConfirmation.fields.remarks')}
                    placeholder={t('reservationConfirmation.placeholders.remarks')}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    minRows={3}
                    styles={{ input: { fontSize: '16px' } }}
                  />
                </Stack>
              </Card>

              {/* Summary */}
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
                      {t('reservationConfirmation.sections.summary')}
                    </Text>
                  </Group>

                  <SimpleGrid cols={2} spacing="md">
                    <Box>
                      <Text size="xs" c="white" opacity={0.8}>
                        {t('reservationConfirmation.summary.property')}
                      </Text>
                      <Text size="sm" c="white" fw={500}>
                        {propertyName || '—'}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="white" opacity={0.8}>
                        {t('reservationConfirmation.summary.guests')}
                      </Text>
                      <Text size="sm" c="white" fw={500}>
                        {guests.filter(g => g.guest_name).length}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="white" opacity={0.8}>
                        {t('reservationConfirmation.summary.dates')}
                      </Text>
                      <Text size="sm" c="white" fw={500}>
                        {arrivalDate && departureDate 
                          ? `${dayjs(arrivalDate).format('DD.MM')} - ${dayjs(departureDate).format('DD.MM.YYYY')}`
                          : '—'
                        }
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="white" opacity={0.8}>
                        {t('reservationConfirmation.summary.deposit')}
                      </Text>
                      <Text size="sm" c="white" fw={500}>
                        {formatCurrency(depositAmount)} THB
                      </Text>
                    </Box>
                  </SimpleGrid>

                  {rateAmount > 0 && (
                    <>
                      <Divider color="rgba(255, 255, 255, 0.2)" />
                      <Group justify="space-between">
                        <Text size="sm" c="white" opacity={0.9}>
                          {t('reservationConfirmation.summary.rate')}:
                        </Text>
                        <Text size="lg" fw={700} c="white">
                          {formatCurrency(rateAmount)} THB / {rateType === 'daily' ? t('reservationConfirmation.rateTypes.day') : t('reservationConfirmation.rateTypes.month')}
                        </Text>
                      </Group>
                    </>
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* Navigation Buttons */}
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
                  {t('reservationConfirmation.buttons.back')}
                </Button>
              )}
              {currentStep < 3 ? (
                <Button
                  rightSection={<IconChevronRight size={18} />}
                  onClick={handleNext}
                >
                  {t('reservationConfirmation.buttons.next')}
                </Button>
              ) : (
                <Button
                  leftSection={<IconCheck size={18} />}
                  onClick={handleSubmit}
                  loading={loading}
                  gradient={{ from: 'green', to: 'teal' }}
                  variant="gradient"
                >
                  {mode === 'edit' ? t('reservationConfirmation.buttons.update') : t('reservationConfirmation.buttons.create')}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Стили для DatePicker */}
      <style>{`
        .datepicker-wrapper {
          width: 100%;
        }
        .react-datepicker-wrapper {
          width: 100%;
        }
        .react-datepicker__input-container {
          width: 100%;
        }
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
      `}</style>
    </>
  );
};

export default CreateReservationConfirmationModal;