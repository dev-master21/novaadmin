// frontend/src/modules/Agreements/components/CreateAgreementModal.tsx
import { useState, useEffect, forwardRef, useRef } from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Stepper,
  Stack,
  Card,
  Grid,
  NumberInput,
  Divider,
  Image,
  Alert,
  Checkbox,
  Accordion,
  Badge,
  Group,
  Text,
  Paper,
  Radio,
  Switch,
  Textarea,
  Center,
  Loader,
  ActionIcon,
  ThemeIcon,
  FileButton,
  Progress,
  Tooltip,
  Box,
  Timeline,
  Transition,
  rem,
  useMantineColorScheme
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconFileText,
  IconCalendar,
  IconUser,
  IconPlus,
  IconTrash,
  IconCurrencyBaht,
  IconUpload,
  IconPhoto,
  IconInfoCircle,
  IconDeviceFloppy,
  IconCheck,
  IconArrowLeft,
  IconArrowRight,
  IconCheckupList,
  IconX,
  IconBuildingBank,
  IconHome,
  IconId,
  IconWorld,
  IconNumber,
  IconBuilding,
  IconMapPin,
  IconUsers,
  IconCalculator,
  IconSparkles,
  IconClipboardCheck,
  IconFileDescription,
  IconClock,
  IconTrendingUp,
  IconPigMoney,
  IconReceipt,
  IconBriefcase,
  IconUserCheck
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import { requestsApi, Request } from '@/api/requests.api';
import { contactsApi } from '@/api/contacts.api';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './CreateAgreementModal.css';

interface CreateAgreementModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface PartyData {
  role: string;
  name: string;
  passport_country: string;
  passport_number: string;
  is_company: boolean;
  company_name?: string;
  company_address?: string;
  company_tax_id?: string;
  director_name?: string;
  director_passport?: string;
  director_country?: string;
  documents?: Array<{ file: File; preview: string; uploading?: boolean }>;
}

interface Property {
  id: number;
  property_number: string;
  property_name: string;
  complex_name?: string;
  address: string;
}

// Кастомный input для DatePicker без клавиатуры на мобильных
const DatePickerInput = forwardRef<HTMLButtonElement, any>(
  ({ value, onClick, placeholder, icon }, ref) => (
    <Button
      ref={ref}
      onClick={onClick}
      variant="default"
      leftSection={icon}
      fullWidth
      justify="space-between"
      styles={{
        root: {
          height: rem(42),
          fontSize: rem(16),
          fontWeight: 400,
          color: value ? 'var(--mantine-color-text)' : 'var(--mantine-color-placeholder)',
          border: '1px solid var(--mantine-color-default-border)',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-default-hover)',
            borderColor: 'var(--mantine-color-violet-5)'
          }
        }
      }}
    >
      {value || placeholder}
    </Button>
  )
);

const CreateAgreementModal = ({ visible, onCancel, onSuccess }: CreateAgreementModalProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useMantineColorScheme();
  const [searchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgreementTemplate | null>(null);
  const [parties, setParties] = useState<PartyData[]>([]);

  const [savedContacts, setSavedContacts] = useState<any[]>([]);
  const [saveContactFlags, setSaveContactFlags] = useState<Record<number, boolean>>({});

  const [properties, setProperties] = useState<any>({ complexes: {}, standalone: [], all: [] });
  const [selectedComplex, setSelectedComplex] = useState<string | null>(null);
  const [complexProperties, setComplexProperties] = useState<Property[]>([]);
  const [manualPropertyInput, setManualPropertyInput] = useState(false);
  const [selectedMainValue, setSelectedMainValue] = useState<string | number | null>(null);

  const [requestData, setRequestData] = useState<Request | null>(null);
  const [requestUuid, setRequestUuid] = useState<string | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  // Form state
  const [formData, setFormData] = useState<any>({
    template_id: null,
    date_from: null,
    date_to: null,
    city: 'Phuket',
    description: '',
    property_id: null,
    property_name_manual: '',
    property_number_manual: '',
    property_address_manual: '',
    property_address_override: '',
    rent_amount_monthly: null,
    rent_amount_total: null,
    deposit_amount: null,
    utilities_included: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    upon_signed_pay: null,
    upon_checkin_pay: null,
    upon_checkout_pay: null
  });

  // Прокрутка вверх при смене шага
  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  // Вычисляем прогресс заполнения
  const calculateProgress = () => {
    let total = 0;
    let filled = 0;

    if (currentStep >= 0) {
      total += 1;
      if (selectedTemplate) filled += 1;
    }

    if (currentStep >= 1) {
      total += 3;
      if (formData.date_from) filled += 1;
      if (formData.date_to) filled += 1;
      if (manualPropertyInput ? formData.property_name_manual : formData.property_id) filled += 1;
    }

    if (currentStep >= 2) {
      total += parties.length * 3;
      parties.forEach(p => {
        if (p.is_company) {
          if (p.company_name) filled += 1;
          if (p.company_tax_id) filled += 1;
          if (p.director_name) filled += 1;
        } else {
          if (p.name) filled += 1;
          if (p.passport_country) filled += 1;
          if (p.passport_number) filled += 1;
        }
      });
    }

    if (currentStep >= 3) {
      total += 3;
      if (formData.rent_amount_monthly) filled += 1;
      if (formData.deposit_amount) filled += 1;
      if (formData.bank_name) filled += 1;
    }

    return total > 0 ? Math.round((filled / total) * 100) : 0;
  };

  // Автоматический расчет total из monthly
  useEffect(() => {
    if (formData.rent_amount_monthly && formData.date_from && formData.date_to) {
      const months = dayjs(formData.date_to).diff(dayjs(formData.date_from), 'month', true);
      if (months > 0) {
        const calculatedTotal = Math.round(formData.rent_amount_monthly * months);
        setFormData((prev: any) => ({ ...prev, rent_amount_total: calculatedTotal }));
      }
    }
  }, [formData.rent_amount_monthly, formData.date_from, formData.date_to]);

  useEffect(() => {
    if (visible) {
      fetchTemplates();
      fetchProperties();
      fetchSavedContacts();
      
      const uuid = searchParams.get('request_uuid');
      if (uuid) {
        setRequestUuid(uuid);
        loadRequestData(uuid);
      } else {
        resetForm();
      }
    }
  }, [visible, searchParams]);

  const fetchSavedContacts = async () => {
    try {
      const response = await contactsApi.getAll();
      setSavedContacts(response.data.data);
    } catch (error: any) {
      console.error('Error loading saved contacts:', error);
    }
  };

  const base64ToFile = (base64: string, filename: string): File => {
    try {
      const arr = base64.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error('Error converting base64 to file:', error);
      return new File([], filename, { type: 'image/jpeg' });
    }
  };

  const fillPartyFromContact = (index: number, contact: any) => {
    const newParties = [...parties];
    
    if (contact.type === 'individual') {
      newParties[index] = {
        ...newParties[index],
        name: contact.name,
        passport_country: contact.passport_country,
        passport_number: contact.passport_number,
        is_company: false,
        documents: contact.documents?.map((doc: any, docIdx: number) => ({
          file: base64ToFile(doc.document_base64, `passport_${contact.name}_${docIdx}.jpg`),
          preview: doc.document_base64,
          uploading: false
        })) || []
      };
    } else {
      newParties[index] = {
        ...newParties[index],
        company_name: contact.company_name,
        company_address: contact.company_address,
        company_tax_id: contact.company_tax_id,
        director_name: contact.director_name,
        director_passport: contact.director_passport,
        director_country: contact.director_country,
        is_company: true,
        documents: contact.documents?.map((doc: any, docIdx: number) => ({
          file: base64ToFile(doc.document_base64, `company_docs_${contact.company_name}_${docIdx}.jpg`),
          preview: doc.document_base64,
          uploading: false
        })) || []
      };
    }
    
    setParties(newParties);
    notifications.show({
      title: t('common.success'),
      message: t('createAgreementModal.messages.contactApplied'),
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  const saveContact = async (party: PartyData) => {
    try {
      const documentsToSave = party.documents?.map(doc => ({
        document_base64: doc.preview,
        mime_type: doc.file.type,
        file_size: doc.file.size
      })) || [];

      const contactData = party.is_company ? {
        type: 'company' as const,
        company_name: party.company_name,
        company_address: party.company_address,
        company_tax_id: party.company_tax_id,
        director_name: party.director_name,
        director_passport: party.director_passport,
        director_country: party.director_country,
        documents: documentsToSave
      } : {
        type: 'individual' as const,
        name: party.name,
        passport_country: party.passport_country,
        passport_number: party.passport_number,
        documents: documentsToSave
      };

      await contactsApi.create(contactData);
      await fetchSavedContacts();
      notifications.show({
        title: t('common.success'),
        message: t('createAgreementModal.messages.contactSaved'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      console.error('Error saving contact:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('createAgreementModal.messages.contactSaveError'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const loadRequestData = async (uuid: string) => {
    setLoadingRequest(true);
    try {
      const response = await requestsApi.getRequestForAgreement(uuid);
      const request = response.data.data;
      setRequestData(request);
      prefillFormFromRequest(request);
      notifications.show({
        title: t('common.success'),
        message: t('createAgreementModal.messages.requestDataLoaded'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createAgreementModal.messages.requestLoadError'),
        color: 'red',
        icon: <IconX size={16} />
      });
      console.error('Load request error:', error);
    } finally {
      setLoadingRequest(false);
    }
  };

  const prefillFormFromRequest = (request: Request) => {
    if (request.rental_dates) {
      try {
        const dates = request.rental_dates.split(' - ');
        if (dates.length === 2) {
          setFormData((prev: any) => ({
            ...prev,
            date_from: dayjs(dates[0], 'DD.MM.YYYY').toDate(),
            date_to: dayjs(dates[1], 'DD.MM.YYYY').toDate()
          }));
        }
      } catch (e) {
        console.error('Error parsing rental dates:', e);
      }
    }

    if (request.villa_name_address) {
      setFormData((prev: any) => ({
        ...prev,
        property_address_manual: request.villa_name_address,
        property_name_manual: request.villa_name_address ? request.villa_name_address.split(',')[0] || '' : ''
      }));
      setManualPropertyInput(true);
    }

    if (request.rental_cost) {
      try {
        const cost = parseFloat(request.rental_cost.replace(/[^\d.]/g, ''));
        if (!isNaN(cost)) {
          setFormData((prev: any) => ({ ...prev, rent_amount_monthly: cost }));
        }
      } catch (e) {
        console.error('Error parsing rental cost:', e);
      }
    }

    if (request.client_name || request.client_phone) {
      const tenantParty: PartyData = {
        role: 'tenant',
        name: request.client_name || '',
        passport_country: '',
        passport_number: '',
        is_company: false
      };
      setParties([tenantParty]);
    }

    if (request.additional_info) {
      setFormData((prev: any) => ({ ...prev, description: request.additional_info }));
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await agreementsApi.getTemplates({ active: true });
      setTemplates(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createAgreementModal.messages.templatesLoadError'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await agreementsApi.getProperties();
      setProperties(response.data.data);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('createAgreementModal.messages.propertiesLoadError'),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedTemplate(null);
    setParties([]);
    setSaveContactFlags({});
    setSelectedComplex(null);
    setComplexProperties([]);
    setManualPropertyInput(false);
    setSelectedMainValue(null);
    setRequestData(null);
    setRequestUuid(null);
    setFormData({
      template_id: null,
      date_from: null,
      date_to: null,
      city: 'Phuket',
      description: '',
      property_id: null,
      property_name_manual: '',
      property_number_manual: '',
      property_address_manual: '',
      property_address_override: '',
      rent_amount_monthly: null,
      rent_amount_total: null,
      deposit_amount: null,
      utilities_included: '',
      bank_name: '',
      bank_account_name: '',
      bank_account_number: '',
      upon_signed_pay: null,
      upon_checkin_pay: null,
      upon_checkout_pay: null
    });
  };

  const getTypeLabel = (type: string) => {
    return t(`createAgreementModal.agreementTypes.${type}`, type);
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      rent: 'blue',
      sale: 'green',
      bilateral: 'violet',
      trilateral: 'orange',
      agency: 'pink',
      transfer_act: 'teal'
    };
    return colors[type] || 'gray';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      rent: IconHome,
      sale: IconTrendingUp,
      bilateral: IconUsers,
      trilateral: IconUsers,
      agency: IconBriefcase,
      transfer_act: IconFileDescription
    };
    const Icon = icons[type] || IconFileText;
    return <Icon size={20} />;
  };

  const handleTemplateSelect = (templateId: string | null) => {
    if (!templateId) return;
    
    const template = templates.find(t => t.id === Number(templateId));
    if (template) {
      setSelectedTemplate(template);
      setFormData((prev: any) => ({ ...prev, template_id: template.id }));
      if (parties.length === 0) {
        const defaultParties = getDefaultParties(template.type);
        setParties(defaultParties);
      }
    }
  };

  const getDefaultParties = (type: string): PartyData[] => {
    const partyTemplates: Record<string, PartyData[]> = {
      rent: [
        { role: 'tenant', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'lessor', name: '', passport_country: '', passport_number: '', is_company: false }
      ],
      sale: [
        { role: 'seller', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'buyer', name: '', passport_country: '', passport_number: '', is_company: false }
      ],
      bilateral: [
        { role: 'tenant', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'lessor', name: '', passport_country: '', passport_number: '', is_company: false }
      ],
      trilateral: [
        { role: 'landlord', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'representative', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'tenant', name: '', passport_country: '', passport_number: '', is_company: false }
      ],
      agency: [
        { role: 'principal', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'agent', name: '', passport_country: '', passport_number: '', is_company: false }
      ],
      transfer_act: [
        { role: 'principal', name: '', passport_country: '', passport_number: '', is_company: false },
        { role: 'agent', name: '', passport_country: '', passport_number: '', is_company: false }
      ]
    };

    return partyTemplates[type] || [
      { role: 'landlord', name: '', passport_country: '', passport_number: '', is_company: false }
    ];
  };

  const updateParty = (index: number, field: keyof PartyData, value: any) => {
    const newParties = [...parties];
    newParties[index] = { ...newParties[index], [field]: value };
    setParties(newParties);
  };

  const handleDocumentUpload = (index: number, file: File) => {
    const newParties = [...parties];
    if (!newParties[index].documents) {
      newParties[index].documents = [];
    }
  
    const reader = new FileReader();
    reader.onload = (e) => {
      const newDoc = { 
        file: file, 
        preview: e.target?.result as string,
        uploading: false 
      };
      newParties[index].documents!.push(newDoc);
      setParties([...newParties]);
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = (partyIndex: number, docIndex: number) => {
    const newParties = [...parties];
    newParties[partyIndex].documents?.splice(docIndex, 1);
    setParties(newParties);
  };

  const addParty = () => {
    setParties([...parties, { 
      role: 'witness', 
      name: '', 
      passport_country: '', 
      passport_number: '', 
      is_company: false 
    }]);
  };

  const removeParty = (index: number) => {
    if (parties.length > 1) {
      setParties(parties.filter((_, i) => i !== index));
    }
  };

  const availableRoles = [
    { value: 'tenant', label: t('createAgreementModal.roles.tenant') },
    { value: 'lessor', label: t('createAgreementModal.roles.lessor') },
    { value: 'landlord', label: t('createAgreementModal.roles.landlord') },
    { value: 'representative', label: t('createAgreementModal.roles.representative') },
    { value: 'principal', label: t('createAgreementModal.roles.principal') },
    { value: 'agent', label: t('createAgreementModal.roles.agent') },
    { value: 'buyer', label: t('createAgreementModal.roles.buyer') },
    { value: 'seller', label: t('createAgreementModal.roles.seller') },
    { value: 'witness', label: t('createAgreementModal.roles.witness') },
    { value: 'company', label: t('createAgreementModal.roles.company') }
  ];

  const handleNext = () => {
    if (currentStep === 0) {
      if (!selectedTemplate) {
        notifications.show({
          title: t('errors.generic'),
          message: t('createAgreementModal.validation.selectTemplate'),
          color: 'red',
          icon: <IconX size={16} />
        });
        return;
      }
    } else if (currentStep === 1) {
      if (formData.rent_amount_monthly && (!formData.date_from || !formData.date_to)) {
        notifications.show({
          title: t('errors.generic'),
          message: t('createAgreementModal.validation.datesRequired'),
          color: 'red',
          icon: <IconX size={16} />
        });
        return;
      }
      
      if (formData.date_from && formData.date_to && dayjs(formData.date_to).isBefore(dayjs(formData.date_from))) {
        notifications.show({
          title: t('errors.generic'),
          message: t('createAgreementModal.validation.dateToAfterFrom'),
          color: 'red',
          icon: <IconX size={16} />
        });
        return;
      }
    } else if (currentStep === 2) {
      const hasEmptyParty = parties.some(p => {
        if (p.is_company) {
          return !p.company_name || !p.company_tax_id || !p.director_name;
        }
        return !p.name || !p.passport_country || !p.passport_number;
      });
      
      if (hasEmptyParty) {
        notifications.show({
          title: t('errors.generic'),
          message: t('createAgreementModal.validation.fillAllParties'),
          color: 'red',
          icon: <IconX size={16} />
        });
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const propertyId = manualPropertyInput ? undefined : formData.property_id;

      const partiesData = parties
        .filter(p => {
          if (p.is_company) return p.company_name && p.role;
          return p.name && p.role;
        })
        .map(party => ({
          role: party.role,
          name: party.name,
          passport_country: party.passport_country,
          passport_number: party.passport_number,
          is_company: party.is_company,
          type: (party.is_company ? 'company' : 'individual') as 'company' | 'individual',
          company_name: party.company_name,
          company_address: party.company_address,
          company_tax_id: party.company_tax_id,
          director_name: party.director_name,
          director_passport: party.director_passport,
          director_country: party.director_country,
          individual_name: !party.is_company ? party.name : undefined,
          individual_country: !party.is_company ? party.passport_country : undefined,
          individual_passport: !party.is_company ? party.passport_number : undefined
        }));

      const agreementData = {
        template_id: selectedTemplate!.id,
        property_id: propertyId,
        request_uuid: requestUuid || undefined,
        description: formData.description || '',
        date_from: formData.date_from ? dayjs(formData.date_from).format('YYYY-MM-DD') : undefined,
        date_to: formData.date_to ? dayjs(formData.date_to).format('YYYY-MM-DD') : undefined,
        city: formData.city || 'Phuket',
        parties: partiesData,
        rent_amount_monthly: formData.rent_amount_monthly,
        rent_amount_total: formData.rent_amount_total,
        deposit_amount: formData.deposit_amount,
        utilities_included: formData.utilities_included,
        bank_name: formData.bank_name,
        bank_account_name: formData.bank_account_name,
        bank_account_number: formData.bank_account_number,
        property_address: manualPropertyInput ? formData.property_address_manual : undefined,
        property_address_override: manualPropertyInput ? formData.property_address_manual : formData.property_address_override,
        property_name: manualPropertyInput ? formData.property_name_manual : undefined,
        property_name_manual: manualPropertyInput ? formData.property_name_manual : undefined,
        property_number: manualPropertyInput ? formData.property_number_manual : undefined,
        property_number_manual: manualPropertyInput ? formData.property_number_manual : undefined,
        upon_signed_pay: formData.upon_signed_pay,
        upon_checkin_pay: formData.upon_checkin_pay,
        upon_checkout_pay: formData.upon_checkout_pay
      };

      const createResponse = await agreementsApi.create(agreementData);
      const agreementId = createResponse.data.data.id;
      const createdParties = createResponse.data.data.parties || [];

      for (let i = 0; i < parties.length; i++) {
        if (saveContactFlags[i]) {
          await saveContact(parties[i]);
        }
      }

      if (requestUuid) {
        try {
          await requestsApi.linkAgreementToRequest(requestUuid, agreementId);
          notifications.show({
            title: t('common.success'),
            message: t('createAgreementModal.messages.createdAndLinkedWithSignatures'),
            color: 'green',
            icon: <IconCheck size={16} />
          });
        } catch (linkError) {
          console.error('Link to request failed:', linkError);
          notifications.show({
            title: t('common.success'),
            message: t('createAgreementModal.messages.createdNotLinkedWithSignatures'),
            color: 'orange',
            icon: <IconCheck size={16} />
          });
        }
      } else {
        notifications.show({
          title: t('common.success'),
          message: t('createAgreementModal.messages.createdWithSignatures'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }

      const hasFiles = parties.some(p => p.documents && p.documents.length > 0);
      
      if (hasFiles && createdParties.length > 0) {
        const formDataToSend = new FormData();
        const partyMapping: Record<string, number> = {};
        
        parties.forEach((party, partyIndex) => {
          const createdParty = createdParties.find((cp: any) => cp.role === party.role);
          if (createdParty) {
            partyMapping[partyIndex.toString()] = createdParty.id;
            
            if (party.documents && party.documents.length > 0) {
              party.documents.forEach((doc, docIndex) => {
                if (doc.file) {
                  formDataToSend.append(
                    `party_${partyIndex}_doc_${docIndex}`,
                    doc.file
                  );
                }
              });
            }
          }
        });

        formDataToSend.append('partyMapping', JSON.stringify(partyMapping));

        try {
          await agreementsApi.uploadAgreementDocuments(agreementId, formDataToSend);
        } catch (uploadError) {
          console.error('Documents upload failed:', uploadError);
        }
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error('Error creating agreement:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || error.message || t('createAgreementModal.messages.createError'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const mobileInputStyles = {
    input: { fontSize: '16px' }
  };

  const isDark = colorScheme === 'dark';

  const steps = [
    { 
      icon: <IconFileText size={18} />
    },
    { 
      icon: <IconBuilding size={18} />
    },
    { 
      icon: <IconUsers size={18} />
    },
    { 
      icon: <IconCurrencyBaht size={18} />
    }
  ];

  const progress = calculateProgress();

  return (
    <Modal
      opened={visible}
      onClose={onCancel}
      title={
        <Stack gap="xs">
          <Group>
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape', deg: 45 }}>
              <IconFileText size={24} />
            </ThemeIcon>
            <Box>
              <Text size={isMobile ? 'sm' : 'lg'} fw={700}>
                {requestData 
                  ? t('createAgreementModal.titleWithRequest', { number: requestData.request_number }) 
                  : t('createAgreementModal.title')}
              </Text>
              {!isMobile && (
                <Group gap="xs" mt={4}>
                  <Badge size="sm" variant="light" leftSection={<IconSparkles size={12} />}>
                    {t('createAgreementModal.stepLabel', { current: currentStep + 1, total: steps.length })}
                  </Badge>
                  <Badge size="sm" variant="light" color="teal">
                    {progress}% {t('createAgreementModal.completed')}
                  </Badge>
                </Group>
              )}
            </Box>
          </Group>
          
          {isMobile && (
            <Group gap="xs">
              <Badge size="xs" variant="light">
                {currentStep + 1}/{steps.length}
              </Badge>
              <Progress value={progress} size="sm" style={{ flex: 1 }} color="violet" />
              <Text size="xs" c="dimmed">{progress}%</Text>
            </Group>
          )}
        </Stack>
      }
      size={isMobile ? '100%' : 'xl'}
      fullScreen={isMobile}
      padding={isMobile ? 'sm' : 'lg'}
      styles={{
        body: isMobile ? { 
          paddingBottom: '80px',
          height: 'calc(100vh - 80px)',
          overflowY: 'auto'
        } : {},
        header: {
          borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-3)'}`
        }
      }}
      closeButtonProps={{
        icon: <IconX size={20} />,
        size: 'lg'
      }}
      scrollAreaComponent={Box}
    >
      <div ref={modalContentRef} style={{ height: '100%', overflowY: 'auto' }}>
        {!isMobile && (
          <Paper p="md" mb="lg" withBorder>
            <Progress 
              value={progress} 
              size="lg" 
              radius="xl"
              animated
              color="violet"
            />
          </Paper>
        )}

        {loadingRequest && (
          <Center p="xl">
            <Stack align="center" gap="md">
              <Loader size="xl" variant="dots" />
              <Text size="sm" c="dimmed">
                {t('createAgreementModal.messages.loadingRequest')}
              </Text>
            </Stack>
          </Center>
        )}

        {requestData && (
          <Alert
            icon={<IconInfoCircle size={20} />}
            title={
              <Group gap="xs">
                <IconClipboardCheck size={18} />
                <Text fw={600}>{t('createAgreementModal.requestAlert.title')}</Text>
              </Group>
            }
            color="blue"
            mb="lg"
            variant="light"
          >
            <Stack gap={6}>
              <Group gap="xs">
                <IconFileText size={14} />
                <Text size="sm">
                  <strong>{t('createAgreementModal.requestAlert.request')}:</strong> {requestData.request_number}
                </Text>
              </Group>
              {requestData.client_name && (
                <Group gap="xs">
                  <IconUser size={14} />
                  <Text size="sm">
                    <strong>{t('createAgreementModal.requestAlert.client')}:</strong> {requestData.client_name}
                  </Text>
                </Group>
              )}
              {requestData.rental_dates && (
                <Group gap="xs">
                  <IconCalendar size={14} />
                  <Text size="sm">
                    <strong>{t('createAgreementModal.requestAlert.rentalDates')}:</strong> {requestData.rental_dates}
                  </Text>
                </Group>
              )}
              <Text size="xs" c="dimmed" mt={4}>
                <IconSparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {t('createAgreementModal.requestAlert.prefilled')}
              </Text>
            </Stack>
          </Alert>
        )}

        <Stepper 
          active={currentStep}
          size={isMobile ? 'xs' : 'sm'}
          mb="xl"
          allowNextStepsSelect={false}
          color="violet"
        >
          {steps.map((step, index) => (
            <Stepper.Step 
              key={index}
              icon={step.icon}
              loading={loading && index === currentStep}
            />
          ))}
        </Stepper>

        <Transition
          mounted={true}
          transition="fade"
          duration={300}
          timingFunction="ease"
        >
          {(styles) => (
            <div style={styles}>
              {/* Шаг 1: Выбор шаблона */}
              {currentStep === 0 && (
                <Stack gap="md">
                  <Alert
                    icon={<IconSparkles size={18} />}
                    title={t('createAgreementModal.hints.selectTemplate')}
                    color="violet"
                    variant="light"
                  >
                    {t('createAgreementModal.hints.selectTemplateDesc')}
                  </Alert>

                  <Select
                    label={
                      <Group gap={6}>
                        <ThemeIcon size="sm" variant="light" color="violet">
                          <IconFileText size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={600}>{t('createAgreementModal.fields.template')}</Text>
                      </Group>
                    }
                    placeholder={t('createAgreementModal.placeholders.selectTemplate')}
                    data={templates.map(t => ({ value: String(t.id), label: t.name }))}
                    value={formData.template_id ? String(formData.template_id) : null}
                    onChange={handleTemplateSelect}
                    searchable
                    size={isMobile ? 'md' : 'lg'}
                    styles={mobileInputStyles}
                    required
                    leftSection={<IconFileText size={16} />}
                  />

                  {selectedTemplate && (
                    <Card 
                      shadow="sm" 
                      padding="lg" 
                      radius="md" 
                      withBorder
                      style={{
                        borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Stack gap="md">
                        <Group justify="space-between">
                          <Group gap="sm">
                            <ThemeIcon 
                              size="xl" 
                              radius="md" 
                              color={getTypeColor(selectedTemplate.type)}
                              variant="light"
                            >
                              {getTypeIcon(selectedTemplate.type)}
                            </ThemeIcon>
                            <Box>
                              <Text size="lg" fw={700}>{selectedTemplate.name}</Text>
                              <Badge 
                                color={getTypeColor(selectedTemplate.type)} 
                                variant="light"
                                mt={4}
                              >
                                {getTypeLabel(selectedTemplate.type)}
                              </Badge>
                            </Box>
                          </Group>
                          <ActionIcon
                            size="xl"
                            variant="light"
                            color="green"
                            radius="xl"
                          >
                            <IconCheck size={24} />
                          </ActionIcon>
                        </Group>
                        
                        <Divider />
                        
                        <Text size="sm" c="dimmed">
                          {t('createAgreementModal.templateDescription', { type: getTypeLabel(selectedTemplate.type) })}
                        </Text>

                        {parties.length > 0 && (
                          <>
                            <Divider 
                              label={
                                <Group gap={4}>
                                  <IconUsers size={14} />
                                  <Text size="xs">{t('createAgreementModal.defaultParties')}</Text>
                                </Group>
                              }
                              labelPosition="center"
                            />
                            
                            <Group gap="xs">
                              {parties.map((p, idx) => (
                                <Badge key={idx} size="lg" variant="dot" color={getTypeColor(selectedTemplate.type)}>
                                  {t(`createAgreementModal.roles.${p.role}`)}
                                </Badge>
                              ))}
                            </Group>
                          </>
                        )}
                      </Stack>
                    </Card>
                  )}
                </Stack>
              )}

              {/* Шаг 2: Детали договора */}
              {currentStep === 1 && (
                <Stack gap="lg">
                  <Alert
                    icon={<IconInfoCircle size={18} />}
                    title={t('createAgreementModal.hints.propertyDetails')}
                    color="blue"
                    variant="light"
                  >
                    {t('createAgreementModal.hints.propertyDetailsDesc')}
                  </Alert>

                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Stack gap="md">
                      <Group gap={6}>
                        <ThemeIcon size="lg" color="blue" variant="light">
                          <IconBuilding size={20} />
                        </ThemeIcon>
                        <Text size="md" fw={700}>{t('createAgreementModal.sections.property')}</Text>
                      </Group>
                      
                      <Radio.Group
                        value={manualPropertyInput ? 'manual' : 'database'}
                        onChange={(value) => {
                          setManualPropertyInput(value === 'manual');
                          setSelectedComplex(null);
                          setComplexProperties([]);
                          setSelectedMainValue(null);
                          setFormData((prev: any) => ({ ...prev, property_id: null }));
                        }}
                      >
                        <Stack gap="sm">
                          <Paper p="sm" withBorder style={{ 
                            cursor: 'pointer',
                            background: !manualPropertyInput ? (isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)') : 'transparent',
                            borderColor: !manualPropertyInput ? 'var(--mantine-color-blue-6)' : (isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'),
                            transition: 'all 0.2s ease'
                          }}>
                            <Radio
                              value="database"
                              label={
                                <Group gap="xs">
                                  <IconBuilding size={16} />
                                  <Text size="sm">{t('createAgreementModal.propertyInput.selectFromDatabase')}</Text>
                                </Group>
                              }
                            />
                          </Paper>
                          <Paper p="sm" withBorder style={{ 
                            cursor: 'pointer',
                            background: manualPropertyInput ? (isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)') : 'transparent',
                            borderColor: manualPropertyInput ? 'var(--mantine-color-blue-6)' : (isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'),
                            transition: 'all 0.2s ease'
                          }}>
                            <Radio
                              value="manual"
                              label={
                                <Group gap="xs">
                                  <IconFileText size={16} />
                                  <Text size="sm">{t('createAgreementModal.propertyInput.enterManually')}</Text>
                                </Group>
                              }
                            />
                          </Paper>
                        </Stack>
                      </Radio.Group>

                      {!manualPropertyInput ? (
                        <Stack gap="md">
                          <Select
                            label={
                              <Group gap={6}>
                                <ThemeIcon size="sm" variant="light" color="blue">
                                  <IconMapPin size={14} />
                                </ThemeIcon>
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.selectProperty')}</Text>
                              </Group>
                            }
                            placeholder={t('createAgreementModal.placeholders.startTyping')}
                            data={[
                              ...Object.keys(properties.complexes).length > 0 ? [{
                                group: t('createAgreementModal.propertyGroups.complexes'),
                                items: Object.keys(properties.complexes).map(name => ({
                                  value: name,
                                  label: name
                                }))
                              }] : [],
                              ...properties.standalone.length > 0 ? [{
                                group: t('createAgreementModal.propertyGroups.standalone'),
                                items: properties.standalone.map((prop: Property) => ({
                                  value: String(prop.id),
                                  label: `${prop.property_name || t('createAgreementModal.propertyGroups.property')} (${prop.property_number})`
                                }))
                              }] : []
                            ]}
                            value={selectedMainValue as string}
                            onChange={(value) => {
                              setSelectedMainValue(value);
                              
                              if (value && isNaN(Number(value))) {
                                setSelectedComplex(value);
                                const props = properties.complexes[value] || [];
                                setComplexProperties(props);
                                setFormData((prev: any) => ({ ...prev, property_id: null }));
                              } else if (value) {
                                setSelectedComplex(null);
                                setComplexProperties([]);
                                setFormData((prev: any) => ({ ...prev, property_id: Number(value) }));
                              } else {
                                setSelectedComplex(null);
                                setComplexProperties([]);
                                setFormData((prev: any) => ({ ...prev, property_id: null }));
                              }
                            }}
                            clearable
                            searchable
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            leftSection={<IconBuilding size={16} />}
                          />
                            
                          {selectedComplex && complexProperties.length > 0 && (
                            <Select
                              label={
                                <Group gap={6}>
                                  <ThemeIcon size="sm" variant="light" color="blue">
                                    <IconNumber size={14} />
                                  </ThemeIcon>
                                  <Text size="sm" fw={500}>{t('createAgreementModal.fields.propertyNumber', { complex: selectedComplex })}</Text>
                                </Group>
                              }
                              placeholder={t('createAgreementModal.placeholders.selectPropertyNumber')}
                              data={complexProperties.map((prop: Property) => ({
                                value: String(prop.id),
                                label: `${prop.property_number}${prop.property_name ? ` - ${prop.property_name}` : ''}`
                              }))}
                              value={formData.property_id ? String(formData.property_id) : null}
                              onChange={(value) => value && setFormData((prev: any) => ({ ...prev, property_id: Number(value) }))}
                              searchable
                              size={isMobile ? 'md' : undefined}
                              styles={mobileInputStyles}
                              required
                              leftSection={<IconHome size={16} />}
                            />
                          )}
                  
                          {!selectedComplex && formData.property_id && (
                            <Alert color="green" icon={<IconCheck size={18} />} variant="light">
                              <Group gap="xs">
                                <IconHome size={16} />
                                <Text size="sm">{t('createAgreementModal.propertySelected', { id: formData.property_id })}</Text>
                              </Group>
                            </Alert>
                          )}
                  
                          <Textarea
                            label={
                              <Group gap={6}>
                                <ThemeIcon size="sm" variant="light" color="gray">
                                  <IconMapPin size={14} />
                                </ThemeIcon>
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.addressOverride')}</Text>
                              </Group>
                            }
                            placeholder={t('createAgreementModal.placeholders.addressOverride')}
                            rows={isMobile ? 3 : 2}
                            value={formData.property_address_override}
                            onChange={(e) => setFormData((prev: any) => ({ ...prev, property_address_override: e.target.value }))}
                            styles={mobileInputStyles}
                            description={t('createAgreementModal.hints.addressOverride')}
                          />
                        </Stack>
                      ) : (
                        <Stack gap="md">
                          <TextInput
                            label={
                              <Group gap={6}>
                                <ThemeIcon size="sm" variant="light" color="blue">
                                  <IconHome size={14} />
                                </ThemeIcon>
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.propertyName')}</Text>
                              </Group>
                            }
                            placeholder={t('createAgreementModal.placeholders.propertyName')}
                            value={formData.property_name_manual}
                            onChange={(e) => setFormData((prev: any) => ({ ...prev, property_name_manual: e.target.value }))}
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            required
                            leftSection={<IconHome size={16} />}
                          />
                          <TextInput
                            label={
                              <Group gap={6}>
                                <ThemeIcon size="sm" variant="light" color="blue">
                                  <IconNumber size={14} />
                                </ThemeIcon>
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.propertyNumberManual')}</Text>
                              </Group>
                            }
                            placeholder={t('createAgreementModal.placeholders.propertyNumber')}
                            value={formData.property_number_manual}
                            onChange={(e) => setFormData((prev: any) => ({ ...prev, property_number_manual: e.target.value }))}
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            required
                            leftSection={<IconNumber size={16} />}
                          />
                          <Textarea
                            label={
                              <Group gap={6}>
                                <ThemeIcon size="sm" variant="light" color="blue">
                                  <IconMapPin size={14} />
                                </ThemeIcon>
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.propertyAddress')}</Text>
                              </Group>
                            }
                            placeholder={t('createAgreementModal.placeholders.propertyAddress')}
                            rows={isMobile ? 3 : 2}
                            value={formData.property_address_manual}
                            onChange={(e) => setFormData((prev: any) => ({ ...prev, property_address_manual: e.target.value }))}
                            styles={mobileInputStyles}
                            required
                          />
                        </Stack>
                      )}
                    </Stack>
                  </Card>

                  {/* Визуализация периода аренды */}
                  {formData.date_from && formData.date_to && (
                    <Paper p="md" withBorder radius="md">
                      <Stack gap="md">
                        <Group gap={6}>
                          <ThemeIcon size="lg" color="teal" variant="light">
                            <IconClock size={20} />
                          </ThemeIcon>
                          <Box>
                            <Text size="sm" fw={700}>{t('createAgreementModal.rentalPeriod')}</Text>
                            <Text size="xs" c="dimmed">
                              {dayjs(formData.date_to).diff(dayjs(formData.date_from), 'day')} {t('createAgreementModal.days')} 
                              {' '}({dayjs(formData.date_to).diff(dayjs(formData.date_from), 'month', true).toFixed(1)} {t('createAgreementModal.months')})
                            </Text>
                          </Box>
                        </Group>
                        
                        <Timeline active={1} bulletSize={20} lineWidth={2} color="teal">
                          <Timeline.Item 
                            bullet={<IconCalendar size={12} />}
                            title={t('createAgreementModal.fields.dateFrom')}
                          >
                            <Text size="sm" c="dimmed">{dayjs(formData.date_from).format('DD.MM.YYYY')}</Text>
                          </Timeline.Item>
                          <Timeline.Item 
                            bullet={<IconCalendar size={12} />}
                            title={t('createAgreementModal.fields.dateTo')}
                          >
                            <Text size="sm" c="dimmed">{dayjs(formData.date_to).format('DD.MM.YYYY')}</Text>
                          </Timeline.Item>
                        </Timeline>
                      </Stack>
                    </Paper>
                  )}

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Stack gap={4}>
                        <Group gap={6}>
                          <ThemeIcon size="sm" variant="light" color="green">
                            <IconCalendar size={14} />
                          </ThemeIcon>
                          <Text size="sm" fw={500}>{t('createAgreementModal.fields.dateFrom')}</Text>
                        </Group>
                        <ReactDatePicker
                          selected={formData.date_from}
                          onChange={(date) => setFormData((prev: any) => ({ ...prev, date_from: date }))}
                          dateFormat="dd.MM.yyyy"
                          placeholderText={t('createAgreementModal.placeholders.selectDate')}
                          customInput={
                            <DatePickerInput 
                              icon={<IconCalendar size={16} />}
                              placeholder={t('createAgreementModal.placeholders.selectDate')}
                            />
                          }
                          popperPlacement="bottom-start"
                        />
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Stack gap={4}>
                        <Group gap={6}>
                          <ThemeIcon size="sm" variant="light" color="red">
                            <IconCalendar size={14} />
                          </ThemeIcon>
                          <Text size="sm" fw={500}>{t('createAgreementModal.fields.dateTo')}</Text>
                        </Group>
                        <ReactDatePicker
                          selected={formData.date_to}
                          onChange={(date) => setFormData((prev: any) => ({ ...prev, date_to: date }))}
                          dateFormat="dd.MM.yyyy"
                          placeholderText={t('createAgreementModal.placeholders.selectDate')}
                          minDate={formData.date_from}
                          customInput={
                            <DatePickerInput 
                              icon={<IconCalendar size={16} />}
                              placeholder={t('createAgreementModal.placeholders.selectDate')}
                            />
                          }
                          popperPlacement="bottom-start"
                        />
                      </Stack>
                    </Grid.Col>
                  </Grid>

                  <TextInput
                    label={
                      <Group gap={6}>
                        <ThemeIcon size="sm" variant="light" color="blue">
                          <IconWorld size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>{t('createAgreementModal.fields.city')}</Text>
                      </Group>
                    }
                    placeholder={t('createAgreementModal.placeholders.city')}
                    value={formData.city}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, city: e.target.value }))}
                    size={isMobile ? 'md' : undefined}
                    styles={mobileInputStyles}
                    leftSection={<IconWorld size={16} />}
                  />

                  <Textarea
                    label={
                      <Group gap={6}>
                        <ThemeIcon size="sm" variant="light" color="gray">
                          <IconFileDescription size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>{t('createAgreementModal.fields.description')}</Text>
                      </Group>
                    }
                    placeholder={t('createAgreementModal.placeholders.description')}
                    rows={isMobile ? 4 : 3}
                    value={formData.description}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                    styles={mobileInputStyles}
                    description={t('createAgreementModal.hints.description')}
                  />
                </Stack>
              )}

              {/* Шаг 3: Стороны */}
              {currentStep === 2 && (
                <Stack gap={isMobile ? 'md' : 'lg'}>
                  <Alert
                    icon={<IconUsers size={18} />}
                    title={t('createAgreementModal.hints.parties')}
                    color="cyan"
                    variant="light"
                  >
                    {t('createAgreementModal.hints.partiesDesc')}
                  </Alert>

                  {parties.map((party, index) => (
                    <Card
                      key={index}
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{
                        borderColor: party.is_company 
                          ? (isDark ? 'var(--mantine-color-orange-9)' : 'var(--mantine-color-orange-3)') 
                          : (isDark ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-blue-3)'),
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Stack gap="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" style={{ flex: 1 }}>
                            <ThemeIcon 
                              size="xl" 
                              radius="md" 
                              color={party.is_company ? 'orange' : 'blue'}
                              variant="light"
                            >
                              {party.is_company ? <IconBriefcase size={24} /> : <IconUser size={24} />}
                            </ThemeIcon>
                            
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Select
                                data={availableRoles}
                                value={party.role}
                                onChange={(value) => value && updateParty(index, 'role', value)}
                                size={isMobile ? 'sm' : 'md'}
                                styles={{ 
                                  input: { 
                                    fontSize: '16px',
                                    fontWeight: 600
                                  }
                                }}
                                leftSection={<IconUserCheck size={16} />}
                              />
                              
                              {isMobile && (
                                <Group gap="xs" mt="xs">
                                  <Badge size="xs" color={party.is_company ? 'orange' : 'blue'} variant="light">
                                    {party.is_company ? t('createAgreementModal.partyTypes.company') : t('createAgreementModal.partyTypes.individual')}
                                  </Badge>
                                  <Switch
                                    checked={party.is_company}
                                    onChange={(e) => updateParty(index, 'is_company', e.currentTarget.checked)}
                                    size="xs"
                                  />
                                </Group>
                              )}
                            </Box>
                          </Group>
                          
                          {!isMobile && (
                            <Group gap="xs">
                              <Tooltip label={party.is_company ? t('createAgreementModal.switchToIndividual') : t('createAgreementModal.switchToCompany')}>
                                <Switch
                                  checked={party.is_company}
                                  onChange={(e) => updateParty(index, 'is_company', e.currentTarget.checked)}
                                  onLabel={<IconBriefcase size={14} />}
                                  offLabel={<IconUser size={14} />}
                                  size="lg"
                                  color={party.is_company ? 'orange' : 'blue'}
                                />
                              </Tooltip>
                              
                              {parties.length > 1 && (
                                <Tooltip label={t('common.delete')}>
                                  <ActionIcon
                                    color="red"
                                    variant="light"
                                    size="lg"
                                    onClick={() => removeParty(index)}
                                  >
                                    <IconTrash size={18} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Group>
                          )}
                        </Group>

                        <Divider />

                        <Group grow={isMobile}>
                          <Checkbox
                            checked={saveContactFlags[index] || false}
                            onChange={(e) => setSaveContactFlags(prev => ({ ...prev, [index]: e.currentTarget.checked }))}
                            label={
                              <Group gap={6}>
                                <IconDeviceFloppy size={14} />
                                <Text size="xs" fw={500}>{t('createAgreementModal.saveContact')}</Text>
                              </Group>
                            }
                            size="sm"
                          />
                          {isMobile && parties.length > 1 && (
                            <Button
                              color="red"
                              variant="light"
                              leftSection={<IconTrash size={16} />}
                              onClick={() => removeParty(index)}
                              fullWidth
                              size="xs"
                            >
                              {t('common.delete')}
                            </Button>
                          )}
                        </Group>

                        <Select
                          placeholder={
                            party.is_company 
                              ? t('createAgreementModal.selectSavedCompany')
                              : t('createAgreementModal.selectSavedContact')
                          }
                          data={party.is_company 
                            ? savedContacts
                                .filter(c => c.type === 'company')
                                .map(contact => ({
                                  value: String(contact.id),
                                  label: contact.company_name
                                }))
                            : savedContacts
                                .filter(c => c.type === 'individual')
                                .map(contact => ({
                                  value: String(contact.id),
                                  label: contact.name
                                }))
                          }
                          onChange={(value) => {
                            if (value) {
                              const contact = savedContacts.find(c => c.id === Number(value));
                              if (contact) {
                                fillPartyFromContact(index, contact);
                              }
                            }
                          }}
                          clearable
                          searchable
                          size={isMobile ? 'md' : undefined}
                          styles={mobileInputStyles}
                          leftSection={<IconFileText size={16} />}
                        />

                        {!party.is_company ? (
                          <Grid gutter="md">
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconUser size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.fullName')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.fullName')}
                                value={party.name}
                                onChange={(e) => updateParty(index, 'name', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconUser size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconWorld size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.passportCountry')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.passportCountry')}
                                value={party.passport_country}
                                onChange={(e) => updateParty(index, 'passport_country', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconWorld size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconId size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.passportNumber')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.passportNumber')}
                                value={party.passport_number}
                                onChange={(e) => updateParty(index, 'passport_number', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconId size={16} />}
                              />
                            </Grid.Col>
                            
                            <Grid.Col span={12}>
                              <Divider 
                                label={
                                  <Group gap={6}>
                                    <IconPhoto size={14} />
                                    <Text size="sm" fw={600}>{t('createAgreementModal.sections.documents')}</Text>
                                  </Group>
                                }
                                labelPosition="center"
                              />
                              
                              {party.documents && party.documents.length > 0 && (
                                <Grid gutter="xs" mb="sm">
                                  {party.documents.map((doc, docIndex) => (
                                    <Grid.Col key={docIndex} span={{ base: 6, sm: 4, md: 3 }}>
                                      <Paper 
                                        p="xs" 
                                        withBorder 
                                        radius="md"
                                        style={{ 
                                          position: 'relative',
                                          transition: 'all 0.2s ease'
                                        }}
                                      >
                                        {doc.uploading ? (
                                          <Center h={isMobile ? 80 : 100}>
                                            <Loader size="sm" />
                                          </Center>
                                        ) : (
                                          <>
                                            <Image
                                              src={doc.preview}
                                              alt={t('createAgreementModal.documentAlt', { number: docIndex + 1 })}
                                              height={isMobile ? 80 : 100}
                                              fit="cover"
                                              radius="sm"
                                            />
                                            <ActionIcon
                                              color="red"
                                              size="sm"
                                              radius="xl"
                                              variant="filled"
                                              onClick={() => removeDocument(index, docIndex)}
                                              style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4
                                              }}
                                            >
                                              <IconTrash size={14} />
                                            </ActionIcon>
                                          </>
                                        )}
                                      </Paper>
                                    </Grid.Col>
                                  ))}
                                </Grid>
                              )}

                              <FileButton
                                onChange={(file) => file && handleDocumentUpload(index, file)}
                                accept="image/*,.pdf"
                              >
                                {(props) => (
                                  <Button
                                    {...props}
                                    variant={party.documents && party.documents.length > 0 ? 'light' : 'filled'}
                                    color="blue"
                                    leftSection={<IconUpload size={16} />}
                                    fullWidth
                                    size={isMobile ? 'md' : undefined}
                                  >
                                    {party.documents && party.documents.length > 0 
                                      ? t('createAgreementModal.buttons.uploadMore') 
                                      : t('createAgreementModal.buttons.uploadPassport')}
                                  </Button>
                                )}
                              </FileButton>
                            </Grid.Col>
                          </Grid>
                        ) : (
                          <Grid gutter="md">
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconBuildingBank size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.companyName')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.companyName')}
                                value={party.company_name}
                                onChange={(e) => updateParty(index, 'company_name', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconBuildingBank size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconNumber size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.taxId')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.taxId')}
                                value={party.company_tax_id}
                                onChange={(e) => updateParty(index, 'company_tax_id', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconNumber size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={12}>
                              <Textarea
                                label={
                                  <Group gap={6}>
                                    <IconMapPin size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.companyAddress')}</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.companyAddress')}
                                rows={isMobile ? 3 : 2}
                                value={party.company_address}
                                onChange={(e) => updateParty(index, 'company_address', e.target.value)}
                                styles={mobileInputStyles}
                              />
                            </Grid.Col>
                            <Grid.Col span={12}>
                              <Divider 
                                label={
                                  <Group gap={6}>
                                    <IconUser size={14} />
                                    <Text size="sm" fw={600}>{t('createAgreementModal.sections.directorInfo')}</Text>
                                  </Group>
                                }
                                labelPosition="center"
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconUser size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.directorName')} *</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.directorName')}
                                value={party.director_name}
                                onChange={(e) => updateParty(index, 'director_name', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                required
                                leftSection={<IconUser size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconWorld size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.directorCountry')}</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.directorCountry')}
                                value={party.director_country}
                                onChange={(e) => updateParty(index, 'director_country', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                leftSection={<IconWorld size={16} />}
                              />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                              <TextInput
                                label={
                                  <Group gap={6}>
                                    <IconId size={14} />
                                    <Text size="sm">{t('createAgreementModal.fields.directorPassport')}</Text>
                                  </Group>
                                }
                                placeholder={t('createAgreementModal.placeholders.directorPassport')}
                                value={party.director_passport}
                                onChange={(e) => updateParty(index, 'director_passport', e.target.value)}
                                size={isMobile ? 'md' : undefined}
                                styles={mobileInputStyles}
                                leftSection={<IconId size={16} />}
                              />
                            </Grid.Col>

                            <Grid.Col span={12}>
                              <Divider 
                                label={
                                  <Group gap={6}>
                                    <IconPhoto size={14} />
                                    <Text size="sm" fw={600}>{t('createAgreementModal.sections.registrationDocs')}</Text>
                                  </Group>
                                }
                                labelPosition="center"
                              />
                              
                              {party.documents && party.documents.length > 0 && (
                                <Grid gutter="xs" mb="sm">
                                  {party.documents.map((doc, docIndex) => (
                                    <Grid.Col key={docIndex} span={{ base: 6, sm: 4, md: 3 }}>
                                      <Paper 
                                        p="xs" 
                                        withBorder 
                                        radius="md"
                                        style={{ 
                                          position: 'relative',
                                          transition: 'all 0.2s ease'
                                        }}
                                      >
                                        {doc.uploading ? (
                                          <Center h={isMobile ? 80 : 100}>
                                            <Loader size="sm" />
                                          </Center>
                                        ) : (
                                          <>
                                            <Image
                                              src={doc.preview}
                                              alt={t('createAgreementModal.documentAlt', { number: docIndex + 1 })}
                                              height={isMobile ? 80 : 100}
                                              fit="cover"
                                              radius="sm"
                                            />
                                            <ActionIcon
                                              color="red"
                                              size="sm"
                                              radius="xl"
                                              variant="filled"
                                              onClick={() => removeDocument(index, docIndex)}
                                              style={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4
                                              }}
                                            >
                                              <IconTrash size={14} />
                                            </ActionIcon>
                                          </>
                                        )}
                                      </Paper>
                                    </Grid.Col>
                                  ))}
                                </Grid>
                              )}

                              <FileButton
                                onChange={(file) => file && handleDocumentUpload(index, file)}
                                accept="image/*,.pdf"
                              >
                                {(props) => (
                                  <Button
                                    {...props}
                                    variant={party.documents && party.documents.length > 0 ? 'light' : 'filled'}
                                    color="orange"
                                    leftSection={<IconPhoto size={16} />}
                                    fullWidth
                                    size={isMobile ? 'md' : undefined}
                                  >
                                    {party.documents && party.documents.length > 0 
                                      ? t('createAgreementModal.buttons.uploadMore') 
                                      : t('createAgreementModal.buttons.uploadCompanyDoc')}
                                  </Button>
                                )}
                              </FileButton>
                            </Grid.Col>
                          </Grid>
                        )}
                      </Stack>
                    </Card>
                  ))}

                  <Button
                    variant="light"
                    color="violet"
                    leftSection={<IconPlus size={16} />}
                    onClick={addParty}
                    fullWidth
                    size={isMobile ? 'md' : 'lg'}
                  >
                    {t('createAgreementModal.buttons.addParty')}
                  </Button>
                </Stack>
              )}

              {/* Шаг 4: Финансовая информация */}
              {currentStep === 3 && (
                <Stack gap="lg">
                  <Alert
                    icon={<IconCalculator size={18} />}
                    title={t('createAgreementModal.hints.finance')}
                    color="green"
                    variant="light"
                  >
                    {t('createAgreementModal.hints.financeDesc')}
                  </Alert>

                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Stack gap="md">
                      <Group gap={6}>
                        <ThemeIcon size="xl" color="green" variant="light">
                          <IconCurrencyBaht size={24} />
                        </ThemeIcon>
                        <Box>
                          <Text size="lg" fw={700}>{t('createAgreementModal.sections.financialInfo')}</Text>
                          <Text size="xs" c="dimmed">{t('createAgreementModal.hints.autoCalculation')}</Text>
                        </Box>
                      </Group>
                      
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput
                            label={
                              <Group gap={6}>
                                <IconCurrencyBaht size={14} />
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.rentMonthly')}</Text>
                              </Group>
                            }
                            placeholder="50000"
                            value={formData.rent_amount_monthly}
                            onChange={(value) => setFormData((prev: any) => ({ ...prev, rent_amount_monthly: value }))}
                            thousandSeparator=","
                            suffix=" THB"
                            min={0}
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            leftSection={<IconPigMoney size={16} />}
                            description={t('createAgreementModal.hints.monthlyRent')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput
                            label={
                              <Group gap={6}>
                                <IconReceipt size={14} />
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.rentTotal')}</Text>
                              </Group>
                            }
                            placeholder="600000"
                            value={formData.rent_amount_total}
                            onChange={(value) => setFormData((prev: any) => ({ ...prev, rent_amount_total: value }))}
                            thousandSeparator=","
                            suffix=" THB"
                            min={0}
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            leftSection={<IconReceipt size={16} />}
                            description={t('createAgreementModal.hints.totalRent')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput
                            label={
                              <Group gap={6}>
                                <IconPigMoney size={14} />
                                <Text size="sm" fw={500}>{t('createAgreementModal.fields.deposit')}</Text>
                              </Group>
                            }
                            placeholder="100000"
                            value={formData.deposit_amount}
                            onChange={(value) => setFormData((prev: any) => ({ ...prev, deposit_amount: value }))}
                            thousandSeparator=","
                            suffix=" THB"
                            min={0}
                            size={isMobile ? 'md' : undefined}
                            styles={mobileInputStyles}
                            leftSection={<IconPigMoney size={16} />}
                            description={t('createAgreementModal.hints.deposit')}
                          />
                        </Grid.Col>
                      </Grid>

                      {/* Breakdown визуализация */}
                      {(formData.rent_amount_monthly || formData.deposit_amount) && (
                        <Paper p="md" withBorder radius="md">
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">{t('createAgreementModal.totalCost')}</Text>
                              <Text size="lg" fw={700}>
                                {((formData.rent_amount_total || 0) + (formData.deposit_amount || 0)).toLocaleString()} THB
                              </Text>
                            </Group>
                            {formData.rent_amount_total && (
                              <Group justify="space-between">
                                <Badge color="green" variant="dot">{t('createAgreementModal.fields.rentTotal')}</Badge>
                                <Text size="sm">{formData.rent_amount_total.toLocaleString()} THB</Text>
                              </Group>
                            )}
                            {formData.deposit_amount && (
                              <Group justify="space-between">
                                <Badge color="blue" variant="dot">{t('createAgreementModal.fields.deposit')}</Badge>
                                <Text size="sm">{formData.deposit_amount.toLocaleString()} THB</Text>
                              </Group>
                            )}
                          </Stack>
                        </Paper>
                      )}

                      <Textarea
                        label={
                          <Group gap={6}>
                            <IconInfoCircle size={14} />
                            <Text size="sm" fw={500}>{t('createAgreementModal.fields.utilitiesIncluded')}</Text>
                          </Group>
                        }
                        placeholder={t('createAgreementModal.placeholders.utilities')}
                        rows={isMobile ? 4 : 3}
                        value={formData.utilities_included}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, utilities_included: e.target.value }))}
                        styles={mobileInputStyles}
                        description={t('createAgreementModal.hints.utilities')}
                      />
                    </Stack>
                  </Card>

                  {isMobile ? (
                    <Accordion>
                      <Accordion.Item value="payment-terms">
                        <Accordion.Control
                          icon={
                            <ThemeIcon variant="light" color="violet" size="lg">
                              <IconCurrencyBaht size={18} />
                            </ThemeIcon>
                          }
                        >
                          <Text fw={600}>{t('createAgreementModal.paymentTerms.title')}</Text>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="md">
                            <Alert color="blue" icon={<IconInfoCircle size={16} />} variant="light">
                              <Text size="xs">{t('createAgreementModal.paymentTerms.description')}</Text>
                            </Alert>
                            
                            <NumberInput
                              label={t('createAgreementModal.paymentTerms.uponSigned')}
                              description={t('createAgreementModal.paymentTerms.uponSignedTooltip')}
                              placeholder="200000"
                              value={formData.upon_signed_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_signed_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              styles={mobileInputStyles}
                              leftSection={<IconFileText size={16} />}
                            />
                            
                            <NumberInput
                              label={t('createAgreementModal.paymentTerms.uponCheckin')}
                              description={t('createAgreementModal.paymentTerms.uponCheckinTooltip')}
                              placeholder="200000"
                              value={formData.upon_checkin_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_checkin_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              styles={mobileInputStyles}
                              leftSection={<IconCalendar size={16} />}
                            />
                            
                            <NumberInput
                              label={t('createAgreementModal.paymentTerms.uponCheckout')}
                              description={t('createAgreementModal.paymentTerms.uponCheckoutTooltip')}
                              placeholder="200000"
                              value={formData.upon_checkout_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_checkout_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              styles={mobileInputStyles}
                              leftSection={<IconCalendar size={16} />}
                            />
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  ) : (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Stack gap="md">
                        <Group gap={6}>
                          <ThemeIcon size="lg" color="violet" variant="light">
                            <IconCurrencyBaht size={20} />
                          </ThemeIcon>
                          <Text size="md" fw={700}>{t('createAgreementModal.paymentTerms.title')}</Text>
                        </Group>
                        
                        <Alert color="blue" icon={<IconInfoCircle size={16} />} variant="light">
                          <Text size="sm">{t('createAgreementModal.paymentTerms.description')}</Text>
                        </Alert>
                        
                        <Grid gutter="md">
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <NumberInput
                              label={
                                <Group gap={6}>
                                  <IconFileText size={14} />
                                  <Text size="sm">{t('createAgreementModal.paymentTerms.uponSigned')}</Text>
                                </Group>
                              }
                              description={t('createAgreementModal.paymentTerms.uponSignedTooltip')}
                              placeholder="200000"
                              value={formData.upon_signed_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_signed_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              leftSection={<IconFileText size={16} />}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <NumberInput
                              label={
                                <Group gap={6}>
                                  <IconCalendar size={14} />
                                  <Text size="sm">{t('createAgreementModal.paymentTerms.uponCheckin')}</Text>
                                </Group>
                              }
                              description={t('createAgreementModal.paymentTerms.uponCheckinTooltip')}
                              placeholder="200000"
                              value={formData.upon_checkin_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_checkin_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              leftSection={<IconCalendar size={16} />}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <NumberInput
                              label={
                                <Group gap={6}>
                                  <IconCalendar size={14} />
                                  <Text size="sm">{t('createAgreementModal.paymentTerms.uponCheckout')}</Text>
                                </Group>
                              }
                              description={t('createAgreementModal.paymentTerms.uponCheckoutTooltip')}
                              placeholder="200000"
                              value={formData.upon_checkout_pay}
                              onChange={(value) => setFormData((prev: any) => ({ ...prev, upon_checkout_pay: value }))}
                              thousandSeparator=","
                              suffix=" THB"
                              min={0}
                              leftSection={<IconCalendar size={16} />}
                            />
                          </Grid.Col>
                        </Grid>
                      </Stack>
                    </Card>
                  )}

                  {isMobile ? (
                    <Accordion>
                      <Accordion.Item value="bank-details">
                        <Accordion.Control
                          icon={
                            <ThemeIcon variant="light" color="blue" size="lg">
                              <IconBuildingBank size={18} />
                            </ThemeIcon>
                          }
                        >
                          <Text fw={600}>{t('createAgreementModal.sections.bankDetails')}</Text>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="md">
                            <TextInput
                              label={
                                <Group gap={6}>
                                  <IconBuildingBank size={14} />
                                  <Text size="sm">{t('createAgreementModal.fields.bankName')}</Text>
                                </Group>
                              }
                              placeholder={t('createAgreementModal.placeholders.bankName')}
                              value={formData.bank_name}
                              onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_name: e.target.value }))}
                              styles={mobileInputStyles}
                              leftSection={<IconBuildingBank size={16} />}
                            />
                            <TextInput
                              label={
                                <Group gap={6}>
                                  <IconUser size={14} />
                                  <Text size="sm">{t('createAgreementModal.fields.accountHolder')}</Text>
                                </Group>
                              }
                              placeholder={t('createAgreementModal.placeholders.accountHolder')}
                              value={formData.bank_account_name}
                              onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_account_name: e.target.value }))}
                              styles={mobileInputStyles}
                              leftSection={<IconUser size={16} />}
                            />
                            <TextInput
                              label={
                                <Group gap={6}>
                                  <IconNumber size={14} />
                                  <Text size="sm">{t('createAgreementModal.fields.accountNumber')}</Text>
                                </Group>
                              }
                              placeholder={t('createAgreementModal.placeholders.accountNumber')}
                              value={formData.bank_account_number}
                              onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_account_number: e.target.value }))}
                              styles={mobileInputStyles}
                              leftSection={<IconNumber size={16} />}
                            />
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  ) : (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Stack gap="md">
                        <Group gap={6}>
                          <ThemeIcon size="lg" color="blue" variant="light">
                            <IconBuildingBank size={20} />
                          </ThemeIcon>
                          <Text size="md" fw={700}>{t('createAgreementModal.sections.bankDetails')}</Text>
                        </Group>
                        
                        <TextInput
                          label={
                            <Group gap={6}>
                              <IconBuildingBank size={14} />
                              <Text size="sm">{t('createAgreementModal.fields.bankName')}</Text>
                            </Group>
                          }
                          placeholder={t('createAgreementModal.placeholders.bankName')}
                          value={formData.bank_name}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_name: e.target.value }))}
                          leftSection={<IconBuildingBank size={16} />}
                          description={t('createAgreementModal.hints.bankName')}
                        />
                        <TextInput
                          label={
                            <Group gap={6}>
                              <IconUser size={14} />
                              <Text size="sm">{t('createAgreementModal.fields.accountHolder')}</Text>
                            </Group>
                          }
                          placeholder={t('createAgreementModal.placeholders.accountHolder')}
                          value={formData.bank_account_name}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_account_name: e.target.value }))}
                          leftSection={<IconUser size={16} />}
                          description={t('createAgreementModal.hints.accountHolder')}
                        />
                        <TextInput
                          label={
                            <Group gap={6}>
                              <IconNumber size={14} />
                              <Text size="sm">{t('createAgreementModal.fields.accountNumber')}</Text>
                            </Group>
                          }
                          placeholder={t('createAgreementModal.placeholders.accountNumber')}
                          value={formData.bank_account_number}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, bank_account_number: e.target.value }))}
                          leftSection={<IconNumber size={16} />}
                          description={t('createAgreementModal.hints.accountNumber')}
                        />
                      </Stack>
                    </Card>
                  )}
                </Stack>
              )}
            </div>
          )}
        </Transition>
      </div>

      {/* Кнопки навигации */}
      {isMobile ? (
        <Paper
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            zIndex: 1000,
            background: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)'
          }}
        >
          <Group gap="xs" grow>
            {currentStep > 0 && (
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={16} />}
                onClick={handlePrev}
                size="md"
              >
                {t('createAgreementModal.buttons.back')}
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                variant="filled"
                color="violet"
                rightSection={<IconArrowRight size={16} />}
                onClick={handleNext}
                size="md"
              >
                {t('createAgreementModal.buttons.next')}
              </Button>
            ) : (
              <Button
                variant="filled"
                color="green"
                leftSection={<IconCheckupList size={18} />}
                onClick={handleSubmit}
                loading={loading}
                size="md"
              >
                {t('createAgreementModal.buttons.create')}
              </Button>
            )}
          </Group>
        </Paper>
      ) : (
        <Group justify="space-between" mt="xl" pt="lg" style={{
          borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`
        }}>
          <Button 
            variant="subtle" 
            onClick={onCancel}
            leftSection={<IconX size={16} />}
            size="lg"
          >
            {t('common.cancel')}
          </Button>
          <Group gap="xs">
            {currentStep > 0 && (
              <Button 
                variant="light" 
                onClick={handlePrev}
                leftSection={<IconArrowLeft size={16} />}
                size="lg"
              >
                {t('createAgreementModal.buttons.back')}
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button 
                variant="filled"
                color="violet"
                onClick={handleNext}
                rightSection={<IconArrowRight size={16} />}
                size="lg"
              >
                {t('createAgreementModal.buttons.next')}
              </Button>
            ) : (
              <Button 
                variant="filled"
                color="green"
                onClick={handleSubmit} 
                loading={loading}
                leftSection={<IconCheck size={18} />}
                size="lg"
              >
                {t('createAgreementModal.buttons.create')}
              </Button>
            )}
          </Group>
        </Group>
      )}
    </Modal>
  );
};

export default CreateAgreementModal;