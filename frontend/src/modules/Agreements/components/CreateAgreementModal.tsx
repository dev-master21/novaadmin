// frontend/src/modules/Agreements/components/CreateAgreementModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Steps,
  Space,
  Card,
  Row,
  Col,
  DatePicker,
  message,
  Radio,
  Switch,
  InputNumber,
  Divider,
  Upload,
  Image,
  Alert,
  Checkbox
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  DollarOutlined,
  UploadOutlined,
  FileImageOutlined,
  InfoCircleOutlined,
  SaveOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import { requestsApi, Request } from '@/api/requests.api';
import { contactsApi } from '@/api/contacts.api';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import './CreateAgreementModal.css';

const { Option, OptGroup } = Select;
const { TextArea } = Input;

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
  documents?: Array<{ file: UploadFile; preview: string; uploading?: boolean }>;
}

interface Property {
  id: number;
  property_number: string;
  property_name: string;
  complex_name?: string;
  address: string;
}

const CreateAgreementModal = ({ visible, onCancel, onSuccess }: CreateAgreementModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgreementTemplate | null>(null);
  const [parties, setParties] = useState<PartyData[]>([]);

  // ✅ НОВЫЕ СОСТОЯНИЯ ДЛЯ СОХРАНЕННЫХ КОНТАКТОВ
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

  useEffect(() => {
    if (visible) {
      fetchTemplates();
      fetchProperties();
      fetchSavedContacts(); // ✅ ДОБАВИЛИ
      
      const uuid = searchParams.get('request_uuid');
      if (uuid) {
        setRequestUuid(uuid);
        loadRequestData(uuid);
      } else {
        resetForm();
      }
    }
  }, [visible, searchParams]);

  // ✅ ФУНКЦИЯ ЗАГРУЗКИ СОХРАНЕННЫХ КОНТАКТОВ
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
    // Возвращаем пустой файл в случае ошибки
    return new File([], filename, { type: 'image/jpeg' });
  }
};

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ fillPartyFromContact
const fillPartyFromContact = (index: number, contact: any) => {
  const newParties = [...parties];
  
  if (contact.type === 'individual') {
    newParties[index] = {
      ...newParties[index],
      name: contact.name,
      passport_country: contact.passport_country,
      passport_number: contact.passport_number,
      is_company: false,
      // ✅ ИСПРАВЛЕНИЕ: конвертируем base64 в File objects
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
      // ✅ ИСПРАВЛЕНИЕ: конвертируем base64 в File objects для компании тоже
      documents: contact.documents?.map((doc: any, docIdx: number) => ({
        file: base64ToFile(doc.document_base64, `company_docs_${contact.company_name}_${docIdx}.jpg`),
        preview: doc.document_base64,
        uploading: false
      })) || []
    };
  }
  
  setParties(newParties);
  message.success(t('createAgreementModal.messages.contactApplied'));
};

const saveContact = async (party: PartyData) => {
  try {
    console.log('💾 Saving contact...', party);
    
    // ✅ Собираем документы в нужном формате
    const documentsToSave = party.documents?.map(doc => ({
      document_base64: doc.preview,
      mime_type: (doc.file as any)?.type,
      file_size: (doc.file as any)?.size
    })) || [];

    console.log('📎 Documents to save:', documentsToSave.length);

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

    console.log('📤 Sending contact data:', contactData);

    const response = await contactsApi.create(contactData);
    console.log('✅ Contact saved:', response.data);
    
    await fetchSavedContacts();
    message.success(t('createAgreementModal.messages.contactSaved'));
  } catch (error) {
    console.error('❌ Error saving contact:', error);
    message.error(t('createAgreementModal.messages.contactSaveError'));
  }
};

  const loadRequestData = async (uuid: string) => {
    setLoadingRequest(true);
    try {
      const response = await requestsApi.getRequestForAgreement(uuid);
      const request = response.data.data;
      setRequestData(request);
      
      prefillFormFromRequest(request);
      
      message.success(t('createAgreementModal.messages.requestDataLoaded'));
    } catch (error: any) {
      message.error(t('createAgreementModal.messages.requestLoadError'));
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
          form.setFieldValue('date_from', dayjs(dates[0], 'DD.MM.YYYY'));
          form.setFieldValue('date_to', dayjs(dates[1], 'DD.MM.YYYY'));
        }
      } catch (e) {
        console.error('Error parsing rental dates:', e);
      }
    }

    if (request.villa_name_address) {
      form.setFieldValue('property_address_manual', request.villa_name_address);
      form.setFieldValue('property_name_manual', request.villa_name_address.split(',')[0] || '');
      setManualPropertyInput(true);
    }

    if (request.rental_cost) {
      try {
        const cost = parseFloat(request.rental_cost.replace(/[^\d.]/g, ''));
        if (!isNaN(cost)) {
          form.setFieldValue('rent_amount_monthly', cost);
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
      form.setFieldValue('description', request.additional_info);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await agreementsApi.getTemplates({ active: true });
      setTemplates(response.data.data);
    } catch (error: any) {
      message.error(t('createAgreementModal.messages.templatesLoadError'));
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await agreementsApi.getProperties();
      console.log('Properties loaded:', response.data.data);
      setProperties(response.data.data);
    } catch (error: any) {
      message.error(t('createAgreementModal.messages.propertiesLoadError'));
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedTemplate(null);
    setParties([]);
    setSaveContactFlags({}); // ✅ ДОБАВИЛИ
    setSelectedComplex(null);
    setComplexProperties([]);
    setManualPropertyInput(false);
    setSelectedMainValue(null);
    setRequestData(null);
    setRequestUuid(null);
    form.resetFields();
  };

  const getTypeLabel = (type: string) => {
    return t(`createAgreementModal.agreementTypes.${type}`, type);
  };

  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      
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

  const handleDocumentUpload = (index: number, file: UploadFile) => {
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
    reader.readAsDataURL(file as any);
  
    return false;
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

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['template_id']);
        if (!selectedTemplate) {
          message.error(t('createAgreementModal.validation.selectTemplate'));
          return;
        }
      } else if (currentStep === 1) {
        const values = form.getFieldsValue(['date_from', 'date_to', 'rent_amount_monthly']);
        
        if (values.rent_amount_monthly && (!values.date_from || !values.date_to)) {
          message.error(t('createAgreementModal.validation.datesRequired'));
          return;
        }
        
        if (values.date_from && values.date_to && dayjs(values.date_to).isBefore(dayjs(values.date_from))) {
          message.error(t('createAgreementModal.validation.dateToAfterFrom'));
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
          message.error(t('createAgreementModal.validation.fillAllParties'));
          return;
        }
      }
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const propertyId = manualPropertyInput 
        ? undefined 
        : (values.property_id || form.getFieldValue('property_id'));

      console.log('📝 Form values:', values);
      console.log('🏠 Property ID:', propertyId);

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
        description: values.description || '',
        date_from: values.date_from ? dayjs(values.date_from).format('YYYY-MM-DD') : undefined,
        date_to: values.date_to ? dayjs(values.date_to).format('YYYY-MM-DD') : undefined,
        city: values.city || 'Phuket',
        parties: partiesData,
        rent_amount_monthly: values.rent_amount_monthly,
        rent_amount_total: values.rent_amount_total,
        deposit_amount: values.deposit_amount,
        utilities_included: values.utilities_included,
        bank_name: values.bank_name,
        bank_account_name: values.bank_account_name,
        bank_account_number: values.bank_account_number,
        property_address: manualPropertyInput ? values.property_address_manual : undefined,
        property_address_override: manualPropertyInput ? values.property_address_manual : values.property_address_override,
        property_name: manualPropertyInput ? values.property_name_manual : undefined,
        property_name_manual: manualPropertyInput ? values.property_name_manual : undefined,
        property_number: manualPropertyInput ? values.property_number_manual : undefined,
        property_number_manual: manualPropertyInput ? values.property_number_manual : undefined,
        upon_signed_pay: values.upon_signed_pay,
        upon_checkin_pay: values.upon_checkin_pay,
        upon_checkout_pay: values.upon_checkout_pay
      };

      console.log('📤 Creating agreement...');
      const createResponse = await agreementsApi.create(agreementData);
      const agreementId = createResponse.data.data.id;
      const createdParties = createResponse.data.data.parties || [];

      console.log('✅ Agreement created:', agreementId);

      // ✅ СОХРАНЯЕМ КОНТАКТЫ ЕСЛИ СТОЯТ ГАЛОЧКИ
      for (let i = 0; i < parties.length; i++) {
        if (saveContactFlags[i]) {
          await saveContact(parties[i]);
        }
      }

      if (requestUuid) {
        try {
          await requestsApi.linkAgreementToRequest(requestUuid, agreementId);
          console.log('✅ Agreement linked to request');
          message.success(t('createAgreementModal.messages.createdAndLinkedWithSignatures'));
        } catch (linkError) {
          console.error('⚠️ Link to request failed:', linkError);
          message.warning(t('createAgreementModal.messages.createdNotLinkedWithSignatures'));
        }
      } else {
        message.success(t('createAgreementModal.messages.createdWithSignatures'));
      }

      const hasFiles = parties.some(p => p.documents && p.documents.length > 0);
      
      if (hasFiles && createdParties.length > 0) {
        console.log('📎 Uploading documents...');

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
                    doc.file as any
                  );
                }
              });
            }
          }
        });

        formDataToSend.append('partyMapping', JSON.stringify(partyMapping));

        try {
          await agreementsApi.uploadAgreementDocuments(agreementId, formDataToSend);
          console.log('✅ Documents uploaded successfully');
        } catch (uploadError) {
          console.error('⚠️ Documents upload failed:', uploadError);
        }
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error('Error creating agreement:', error);
      message.error(error.response?.data?.message || error.message || t('createAgreementModal.messages.createError'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: t('createAgreementModal.steps.template'), icon: <FileTextOutlined /> },
    { title: t('createAgreementModal.steps.details'), icon: <CalendarOutlined /> },
    { title: t('createAgreementModal.steps.parties'), icon: <UserOutlined /> },
    { title: t('createAgreementModal.steps.finance'), icon: <DollarOutlined /> }
  ];

  return (
    <Modal
      title={requestData ? t('createAgreementModal.titleWithRequest', { number: requestData.request_number }) : t('createAgreementModal.title')}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      className="create-agreement-modal dark-theme"
      destroyOnClose
    >
      {loadingRequest && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <span>{t('createAgreementModal.messages.loadingRequest')}</span>
        </div>
      )}

      {requestData && (
        <Alert
          message={t('createAgreementModal.requestAlert.title')}
          description={
            <div>
              <p><strong>{t('createAgreementModal.requestAlert.request')}:</strong> {requestData.request_number}</p>
              {requestData.client_name && <p><strong>{t('createAgreementModal.requestAlert.client')}:</strong> {requestData.client_name}</p>}
              {requestData.rental_dates && <p><strong>{t('createAgreementModal.requestAlert.rentalDates')}:</strong> {requestData.rental_dates}</p>}
              <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                {t('createAgreementModal.requestAlert.prefilled')}
              </p>
            </div>
          }
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 24 }}
          showIcon
        />
      )}

      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      <Form form={form} layout="vertical">
        {/* Шаг 1: Выбор шаблона */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <Form.Item
            name="template_id"
            label={t('createAgreementModal.fields.template')}
            rules={[{ required: true, message: t('createAgreementModal.validation.selectTemplate') }]}
          >
            <Select
              placeholder={t('createAgreementModal.placeholders.selectTemplate')}
              onChange={handleTemplateSelect}
              showSearch
              optionFilterProp="children"
              size="large"
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedTemplate && (
            <Card 
              size="small" 
              style={{ 
                background: '#141414', 
                marginTop: 16,
                border: '1px solid #303030'
              }}
              className="template-info-card-dark"
            >
              <p style={{ color: 'rgba(255, 255, 255, 0.85)', marginBottom: 8 }}>
                <strong>{t('createAgreementModal.fields.type')}:</strong> {getTypeLabel(selectedTemplate.type)}
              </p>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)' }}>
                <strong>{t('createAgreementModal.fields.description')}:</strong> {t('createAgreementModal.templateDescription', { type: getTypeLabel(selectedTemplate.type) })}
              </p>
            </Card>
          )}
        </div>

        {/* Шаг 2: Детали договора */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <Card size="small" title={t('createAgreementModal.sections.property')} style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio.Group 
                value={manualPropertyInput} 
                onChange={(e) => {
                  setManualPropertyInput(e.target.value);
                  setSelectedComplex(null);
                  setComplexProperties([]);
                  setSelectedMainValue(null);
                  form.setFieldValue('property_id', undefined);
                }}
              >
                <Radio value={false}>{t('createAgreementModal.propertyInput.selectFromDatabase')}</Radio>
                <Radio value={true}>{t('createAgreementModal.propertyInput.enterManually')}</Radio>
              </Radio.Group>

              {!manualPropertyInput ? (
                <>
                  <Form.Item label={t('createAgreementModal.fields.selectProperty')}>
                    <Select
                      placeholder={t('createAgreementModal.placeholders.startTyping')}
                      allowClear
                      showSearch
                      value={selectedMainValue}
                      onChange={(value) => {
                        console.log('🔍 Selected value:', value, 'Type:', typeof value);
                        setSelectedMainValue(value);
                        
                        if (typeof value === 'string') {
                          console.log('✅ This is a COMPLEX:', value);
                          setSelectedComplex(value);
                          const props = properties.complexes[value] || [];
                          console.log('📦 Complex properties:', props);
                          setComplexProperties(props);
                          form.setFieldValue('property_id', undefined);
                        } 
                        else if (typeof value === 'number') {
                          console.log('✅ This is a STANDALONE property ID:', value);
                          setSelectedComplex(null);
                          setComplexProperties([]);
                          form.setFieldValue('property_id', value);
                        }
                        else {
                          console.log('🧹 Clearing selection');
                          setSelectedComplex(null);
                          setComplexProperties([]);
                          form.setFieldValue('property_id', undefined);
                        }
                      }}
                      onClear={() => {
                        console.log('🧹 Clear button clicked');
                        setSelectedMainValue(null);
                        setSelectedComplex(null);
                        setComplexProperties([]);
                        form.setFieldValue('property_id', undefined);
                      }}
                      optionFilterProp="children"
                      filterOption={(input, option: any) => {
                        const label = option.children?.props?.children 
                          ? option.children.props.children.join('') 
                          : option.children?.toString() || '';
                        return label.toLowerCase().includes(input.toLowerCase());
                      }}
                    >
                      {Object.keys(properties.complexes).length > 0 && (
                        <OptGroup label={t('createAgreementModal.propertyGroups.complexes')}>
                          {Object.keys(properties.complexes).map(complexName => (
                            <Option key={`complex-${complexName}`} value={complexName}>
                              {complexName}
                            </Option>
                          ))}
                        </OptGroup>
                      )}
                      
                      {properties.standalone.length > 0 && (
                        <OptGroup label={t('createAgreementModal.propertyGroups.standalone')}>
                          {properties.standalone.map((prop: Property) => (
                            <Option key={`standalone-${prop.id}`} value={prop.id}>
                              {prop.property_name || t('createAgreementModal.propertyGroups.property')} ({prop.property_number})
                            </Option>
                          ))}
                        </OptGroup>
                      )}
                    </Select>
                  </Form.Item>
                    
                  {selectedComplex && complexProperties.length > 0 && (
                    <Form.Item 
                      name="property_id" 
                      label={t('createAgreementModal.fields.propertyNumber', { complex: selectedComplex })}
                      rules={[{ required: true, message: t('createAgreementModal.validation.selectPropertyNumber') }]}
                    >
                      <Select
                        placeholder={t('createAgreementModal.placeholders.selectPropertyNumber')}
                        showSearch
                        optionFilterProp="children"
                      >
                        {complexProperties.map((prop: Property) => (
                          <Option key={prop.id} value={prop.id}>
                            {prop.property_number} {prop.property_name ? `- ${prop.property_name}` : ''}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}
              
                  {!selectedComplex && form.getFieldValue('property_id') && (
                    <>
                      <Form.Item 
                        name="property_id" 
                        hidden
                        rules={[{ required: true }]}
                      >
                        <Input />
                      </Form.Item>
                      
                      <div style={{ 
                        padding: '8px 12px', 
                        background: '#141414', 
                        border: '1px solid #303030',
                        borderRadius: '4px',
                        marginTop: '8px'
                      }}>
                        <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.propertySelected', { id: form.getFieldValue('property_id') })}
                        </span>
                      </div>
                    </>
                  )}
              
                  <Form.Item name="property_address_override" label={t('createAgreementModal.fields.addressOverride')}>
                    <TextArea rows={2} placeholder={t('createAgreementModal.placeholders.addressOverride')} />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item 
                    name="property_name_manual" 
                    label={t('createAgreementModal.fields.propertyName')}
                    rules={[{ required: manualPropertyInput, message: t('createAgreementModal.validation.enterName') }]}
                  >
                    <Input placeholder={t('createAgreementModal.placeholders.propertyName')} />
                  </Form.Item>
                  <Form.Item 
                    name="property_number_manual" 
                    label={t('createAgreementModal.fields.propertyNumberManual')}
                    rules={[{ required: manualPropertyInput, message: t('createAgreementModal.validation.enterNumber') }]}
                  >
                    <Input placeholder={t('createAgreementModal.placeholders.propertyNumber')} />
                  </Form.Item>
                  <Form.Item 
                    name="property_address_manual" 
                    label={t('createAgreementModal.fields.propertyAddress')}
                    rules={[{ required: manualPropertyInput, message: t('createAgreementModal.validation.enterAddress') }]}
                  >
                    <TextArea rows={2} placeholder={t('createAgreementModal.placeholders.propertyAddress')} />
                  </Form.Item>
                </>
              )}
            </Space>
          </Card>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="date_from" label={t('createAgreementModal.fields.dateFrom')}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder={t('createAgreementModal.placeholders.selectDate')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="date_to" label={t('createAgreementModal.fields.dateTo')}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder={t('createAgreementModal.placeholders.selectDate')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="city" label={t('createAgreementModal.fields.city')} initialValue="Phuket">
            <Input placeholder={t('createAgreementModal.placeholders.city')} />
          </Form.Item>

          <Form.Item name="description" label={t('createAgreementModal.fields.description')}>
            <TextArea rows={3} placeholder={t('createAgreementModal.placeholders.description')} />
          </Form.Item>
        </div>

        {/* Шаг 3: Стороны */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {parties.map((party, index) => (
              <Card
                key={index}
                size="small"
                title={
                  <Space style={{ flexWrap: 'wrap' }}>
                    <Select
                      value={party.role}
                      onChange={(value) => updateParty(index, 'role', value)}
                      style={{ width: 200 }}
                      size="small"
                    >
                      {availableRoles.map(role => (
                        <Option key={role.value} value={role.value}>
                          {role.label}
                        </Option>
                      ))}
                    </Select>
                    <Switch
                      checked={party.is_company}
                      onChange={(checked) => updateParty(index, 'is_company', checked)}
                      checkedChildren={t('createAgreementModal.partyTypes.company')}
                      unCheckedChildren={t('createAgreementModal.partyTypes.individual')}
                      size="small"
                    />
                    {/* ✅ НОВЫЙ ЧЕКБОКС ДЛЯ СОХРАНЕНИЯ */}
                    <Divider type="vertical" style={{ margin: '0 8px' }} />
                    <Checkbox
                      checked={saveContactFlags[index] || false}
                      onChange={(e) => {
                        setSaveContactFlags(prev => ({ ...prev, [index]: e.target.checked }));
                      }}
                    >
                      <SaveOutlined style={{ marginRight: 4 }} />
                      <span style={{ fontSize: '12px' }}>
                        {t('createAgreementModal.saveContact')}
                      </span>
                    </Checkbox>
                  </Space>
                }
                extra={
                  parties.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeParty(index)}
                      size="small"
                    />
                  )
                }
                className="party-card-dark"
              >
                {/* ✅ ВЫПАДАЮЩИЙ СПИСОК СОХРАНЕННЫХ КОНТАКТОВ */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col xs={24}>
                    <Select
                      placeholder={
                        party.is_company 
                          ? t('createAgreementModal.selectSavedCompany')
                          : t('createAgreementModal.selectSavedContact')
                      }
                      style={{ width: '100%' }}
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      onChange={(contactId) => {
                        if (contactId) {
                          const contact = savedContacts.find(c => c.id === contactId);
                          if (contact) {
                            fillPartyFromContact(index, contact);
                          }
                        }
                      }}
                      filterOption={(input, option: any) => {
                        return option.children.toLowerCase().includes(input.toLowerCase());
                      }}
                    >
                      {party.is_company ? (
                        // Только компании
                        savedContacts
                          .filter(c => c.type === 'company')
                          .map(contact => (
                            <Option key={contact.id} value={contact.id}>
                              {contact.company_name}
                            </Option>
                          ))
                      ) : (
                        // Только физ.лица
                        savedContacts
                          .filter(c => c.type === 'individual')
                          .map(contact => (
                            <Option key={contact.id} value={contact.id}>
                              {contact.name}
                            </Option>
                          ))
                      )}
                    </Select>
                  </Col>
                </Row>

                {!party.is_company ? (
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.fullName')} *
                        </label>
                        <Input
                          value={party.name}
                          onChange={(e) => updateParty(index, 'name', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.fullName')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.passportCountry')} *
                        </label>
                        <Input
                          value={party.passport_country}
                          onChange={(e) => updateParty(index, 'passport_country', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.passportCountry')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.passportNumber')} *
                        </label>
                        <Input
                          value={party.passport_number}
                          onChange={(e) => updateParty(index, 'passport_number', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.passportNumber')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    
                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>
                        {t('createAgreementModal.sections.documents')}
                      </Divider>
                      
                      {party.documents && party.documents.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Row gutter={[8, 8]}>
                            {party.documents.map((doc, docIndex) => (
                              <Col key={docIndex} xs={12} sm={8} md={6}>
                                <div style={{ 
                                  position: 'relative',
                                  border: '1px solid #303030',
                                  borderRadius: '4px',
                                  padding: '8px',
                                  background: doc.uploading ? '#1f1f1f' : '#141414'
                                }}>
                                  {doc.uploading ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                      <div className="loading-spinner" style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #303030',
                                        borderTop: '2px solid #1890ff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto'
                                      }} />
                                      <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                                        {t('createAgreementModal.uploading')}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <Image
                                        src={doc.preview}
                                        alt={t('createAgreementModal.documentAlt', { number: docIndex + 1 })}
                                        style={{ 
                                          width: '100%', 
                                          height: '100px', 
                                          objectFit: 'cover',
                                          borderRadius: '2px'
                                        }}
                                      />
                                      <Button
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => removeDocument(index, docIndex)}
                                        style={{
                                          position: 'absolute',
                                          top: '4px',
                                          right: '4px',
                                          minWidth: 'auto',
                                          padding: '4px 8px'
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}

                      <Upload
                        accept="image/*,.pdf"
                        beforeUpload={(file) => handleDocumentUpload(index, file)}
                        showUploadList={false}
                        maxCount={1}
                      >
                        <Button 
                          icon={<UploadOutlined />} 
                          block
                          type={party.documents && party.documents.length > 0 ? 'dashed' : 'default'}
                        >
                          {party.documents && party.documents.length > 0 
                            ? t('createAgreementModal.buttons.uploadMore') 
                            : t('createAgreementModal.buttons.uploadPassport')}
                        </Button>
                      </Upload>
                    </Col>
                  </Row>
                ) : (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.companyName')} *
                        </label>
                        <Input
                          value={party.company_name}
                          onChange={(e) => updateParty(index, 'company_name', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.companyName')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.taxId')} *
                        </label>
                        <Input
                          value={party.company_tax_id}
                          onChange={(e) => updateParty(index, 'company_tax_id', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.taxId')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.companyAddress')}
                        </label>
                        <TextArea
                          value={party.company_address}
                          onChange={(e) => updateParty(index, 'company_address', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.companyAddress')}
                          rows={2}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>
                        {t('createAgreementModal.sections.directorInfo')}
                      </Divider>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.directorName')} *
                        </label>
                        <Input
                          value={party.director_name}
                          onChange={(e) => updateParty(index, 'director_name', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.directorName')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.directorCountry')}
                        </label>
                        <Input
                          value={party.director_country}
                          onChange={(e) => updateParty(index, 'director_country', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.directorCountry')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {t('createAgreementModal.fields.directorPassport')}
                        </label>
                        <Input
                          value={party.director_passport}
                          onChange={(e) => updateParty(index, 'director_passport', e.target.value)}
                          placeholder={t('createAgreementModal.placeholders.directorPassport')}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>

                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>
                        {t('createAgreementModal.sections.registrationDocs')}
                      </Divider>
                      
                      {party.documents && party.documents.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Row gutter={[8, 8]}>
                            {party.documents.map((doc, docIndex) => (
                              <Col key={docIndex} xs={12} sm={8} md={6}>
                                <div style={{ 
                                  position: 'relative',
                                  border: '1px solid #303030',
                                  borderRadius: '4px',
                                  padding: '8px',
                                  background: doc.uploading ? '#1f1f1f' : '#141414'
                                }}>
                                  {doc.uploading ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                      <div className="loading-spinner" style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #303030',
                                        borderTop: '2px solid #1890ff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto'
                                      }} />
                                      <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                                        {t('createAgreementModal.uploading')}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <Image
                                        src={doc.preview}
                                        alt={t('createAgreementModal.documentAlt', { number: docIndex + 1 })}
                                        style={{ 
                                          width: '100%', 
                                          height: '100px', 
                                          objectFit: 'cover',
                                          borderRadius: '2px'
                                        }}
                                      />
                                      <Button
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => removeDocument(index, docIndex)}
                                        style={{
                                          position: 'absolute',
                                          top: '4px',
                                          right: '4px',
                                          minWidth: 'auto',
                                          padding: '4px 8px'
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}

                      <Upload
                        accept="image/*,.pdf"
                        beforeUpload={(file) => handleDocumentUpload(index, file)}
                        showUploadList={false}
                        maxCount={1}
                      >
                        <Button 
                          icon={<FileImageOutlined />} 
                          block
                          type={party.documents && party.documents.length > 0 ? 'dashed' : 'default'}
                        >
                          {party.documents && party.documents.length > 0 
                            ? t('createAgreementModal.buttons.uploadMore') 
                            : t('createAgreementModal.buttons.uploadCompanyDoc')}
                        </Button>
                      </Upload>
                    </Col>
                  </Row>
                )}
              </Card>
            ))}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addParty}
              block
            >
              {t('createAgreementModal.buttons.addParty')}
            </Button>
          </Space>
        </div>

        {/* Шаг 4: Финансовая информация */}
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <Card size="small" title={t('createAgreementModal.sections.financialInfo')} style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="rent_amount_monthly" label={t('createAgreementModal.fields.rentMonthly')}>
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="50000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/,/g, '')}
                    addonAfter="THB"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="rent_amount_total" label={t('createAgreementModal.fields.rentTotal')}>
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="600000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/,/g, '')}
                    addonAfter="THB"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="deposit_amount" label={t('createAgreementModal.fields.deposit')}>
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="100000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/,/g, '')}
                    addonAfter="THB"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="utilities_included" label={t('createAgreementModal.fields.utilitiesIncluded')}>
              <TextArea
                rows={3}
                placeholder={t('createAgreementModal.placeholders.utilities')}
              />
            </Form.Item>
          </Card>

          <Card 
            size="small" 
            title={
              <Space>
                <DollarOutlined />
                <span>{t('createAgreementModal.paymentTerms.title')}</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Alert
              message={t('createAgreementModal.paymentTerms.optionalInfo')}
              description={t('createAgreementModal.paymentTerms.description')}
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item 
                  name="upon_signed_pay" 
                  label={t('createAgreementModal.paymentTerms.uponSigned')}
                  tooltip={t('createAgreementModal.paymentTerms.uponSignedTooltip')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="200000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    min={0}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item 
                  name="upon_checkin_pay" 
                  label={t('createAgreementModal.paymentTerms.uponCheckin')}
                  tooltip={t('createAgreementModal.paymentTerms.uponCheckinTooltip')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="200000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    min={0}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item 
                  name="upon_checkout_pay" 
                  label={t('createAgreementModal.paymentTerms.uponCheckout')}
                  tooltip={t('createAgreementModal.paymentTerms.uponCheckoutTooltip')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="200000"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    min={0}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title={t('createAgreementModal.sections.bankDetails')}>
            <Form.Item name="bank_name" label={t('createAgreementModal.fields.bankName')}>
              <Input placeholder={t('createAgreementModal.placeholders.bankName')} />
            </Form.Item>
            <Form.Item name="bank_account_name" label={t('createAgreementModal.fields.accountHolder')}>
              <Input placeholder={t('createAgreementModal.placeholders.accountHolder')} />
            </Form.Item>
            <Form.Item name="bank_account_number" label={t('createAgreementModal.fields.accountNumber')}>
              <Input placeholder={t('createAgreementModal.placeholders.accountNumber')} />
            </Form.Item>
          </Card>
        </div>
      </Form>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Space>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>{t('createAgreementModal.buttons.back')}</Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>{t('createAgreementModal.buttons.next')}</Button>
          ) : (
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              {t('createAgreementModal.buttons.create')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default CreateAgreementModal;