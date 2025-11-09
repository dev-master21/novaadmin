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
  Image
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  DollarOutlined,
  UploadOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import dayjs from 'dayjs';
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
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgreementTemplate | null>(null);
  const [parties, setParties] = useState<PartyData[]>([]);
  
    // Property selection
  const [properties, setProperties] = useState<any>({ complexes: {}, standalone: [], all: [] });
  const [selectedComplex, setSelectedComplex] = useState<string | null>(null);
  const [complexProperties, setComplexProperties] = useState<Property[]>([]);
  const [manualPropertyInput, setManualPropertyInput] = useState(false);
  const [selectedMainValue, setSelectedMainValue] = useState<string | number | null>(null);

  useEffect(() => {
    if (visible) {
      fetchTemplates();
      fetchProperties();
      resetForm();
    }
  }, [visible]);

  const fetchTemplates = async () => {
    try {
      const response = await agreementsApi.getTemplates({ active: true });
      setTemplates(response.data.data);
    } catch (error: any) {
      message.error('Ошибка загрузки шаблонов');
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await agreementsApi.getProperties();
      console.log('Properties loaded:', response.data.data);
      setProperties(response.data.data);
    } catch (error: any) {
      message.error('Ошибка загрузки объектов');
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedTemplate(null);
    setParties([]);
    setSelectedComplex(null);
    setComplexProperties([]);
    setManualPropertyInput(false);
    setSelectedMainValue(null);
    form.resetFields();
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      rent: 'Аренда',
      sale: 'Купли-продажа',
      bilateral: 'Двухсторонний',
      trilateral: 'Трёхсторонний',
      agency: 'Агентский',
      transfer_act: 'Акт приёма-передачи'
    };
    return types[type] || type;
  };

  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      const defaultParties = getDefaultParties(template.type);
      setParties(defaultParties);
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
  
    // Создаем превью для отображения
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
  
    return false; // Предотвращаем автоматическую загрузку
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
    { value: 'tenant', label: 'Арендатор (Tenant)' },
    { value: 'lessor', label: 'Лессор (Lessor)' },
    { value: 'landlord', label: 'Арендодатель (Landlord)' },
    { value: 'representative', label: 'Представитель арендодателя' },
    { value: 'principal', label: 'Принципал (Доверитель)' },
    { value: 'agent', label: 'Агент' },
    { value: 'buyer', label: 'Покупатель' },
    { value: 'seller', label: 'Продавец' },
    { value: 'witness', label: 'Свидетель' },
    { value: 'company', label: 'Компания' }
  ];

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['template_id']);
        if (!selectedTemplate) {
          message.error('Выберите шаблон');
          return;
        }
      } else if (currentStep === 1) {
        // Детали - не обязательные поля
      } else if (currentStep === 2) {
        // Проверяем стороны
        const hasEmptyParty = parties.some(p => {
          if (p.is_company) {
            return !p.company_name || !p.company_tax_id || !p.director_name;
          }
          return !p.name || !p.passport_country || !p.passport_number;
        });
        
        if (hasEmptyParty) {
          message.error('Заполните все обязательные поля сторон');
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

    // Получаем property_id
    const propertyId = manualPropertyInput 
      ? undefined 
      : (values.property_id || form.getFieldValue('property_id'));

    console.log('📝 Form values:', values);
    console.log('🏠 Property ID:', propertyId);

    // Подготавливаем стороны БЕЗ документов
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
        company_name: party.company_name,
        company_address: party.company_address,
        company_tax_id: party.company_tax_id,
        director_name: party.director_name,
        director_passport: party.director_passport,
        director_country: party.director_country
      }));

    // Шаг 1: Создаем договор БЕЗ файлов через обычный API
    const agreementData = {
      template_id: selectedTemplate!.id,
      property_id: propertyId,
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
      property_address_override: manualPropertyInput ? values.property_address_manual : values.property_address_override,
      property_name_manual: manualPropertyInput ? values.property_name_manual : undefined,
      property_number_manual: manualPropertyInput ? values.property_number_manual : undefined
    };

    console.log('📤 Creating agreement...');
    const createResponse = await agreementsApi.create(agreementData);
    const agreementId = createResponse.data.data.id;
    const createdParties = createResponse.data.data.parties || [];

    console.log('✅ Agreement created:', agreementId);
    console.log('👥 Created parties:', createdParties);

    // Шаг 2: Загружаем файлы, если есть
    const hasFiles = parties.some(p => p.documents && p.documents.length > 0);
    
    if (hasFiles && createdParties.length > 0) {
      console.log('📎 Uploading documents...');

      const formDataToSend = new FormData();
      
      // Создаем маппинг: индекс стороны -> ID стороны
      const partyMapping: Record<string, number> = {};
      
      parties.forEach((party, partyIndex) => {
        // Находим созданную сторону по роли
        const createdParty = createdParties.find((cp: any) => cp.role === party.role);
        if (createdParty) {
          partyMapping[partyIndex.toString()] = createdParty.id;
          
          // Добавляем файлы этой стороны
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

      console.log('🗺️ Party mapping:', partyMapping);

      try {
        await agreementsApi.uploadAgreementDocuments(agreementId, formDataToSend);
        console.log('✅ Documents uploaded successfully');
        message.success('Договор создан, документы загружены');
      } catch (uploadError) {
        console.error('⚠️ Documents upload failed:', uploadError);
        message.warning('Договор создан, но не удалось загрузить некоторые документы');
      }
    } else {
      message.success('Договор успешно создан');
    }

    onSuccess();
    resetForm();
  } catch (error: any) {
    console.error('Error creating agreement:', error);
    message.error(error.response?.data?.message || error.message || 'Ошибка создания договора');
  } finally {
    setLoading(false);
  }
};

  const steps = [
    { title: 'Шаблон', icon: <FileTextOutlined /> },
    { title: 'Детали', icon: <CalendarOutlined /> },
    { title: 'Стороны', icon: <UserOutlined /> },
    { title: 'Финансы', icon: <DollarOutlined /> }
  ];

  return (
    <Modal
      title="Создание договора"
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      className="create-agreement-modal dark-theme"
      destroyOnClose
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      <Form form={form} layout="vertical">
        {/* Шаг 1: Выбор шаблона */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <Form.Item
            name="template_id"
            label="Шаблон договора"
            rules={[{ required: true, message: 'Выберите шаблон' }]}
          >
            <Select
              placeholder="Выберите шаблон"
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
                <strong>Тип:</strong> {getTypeLabel(selectedTemplate.type)}
              </p>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)' }}>
                <strong>Описание:</strong> Шаблон для создания договора типа "{getTypeLabel(selectedTemplate.type)}"
              </p>
            </Card>
          )}
        </div>

        {/* Шаг 2: Детали договора */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          {/* Выбор объекта */}
          <Card size="small" title="Объект недвижимости" style={{ marginBottom: 16 }}>
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
                <Radio value={false}>Выбрать из базы</Radio>
                <Radio value={true}>Ввести вручную</Radio>
              </Radio.Group>

                {!manualPropertyInput ? (
                  <>
                    {/* Сначала выбираем комплекс ИЛИ отдельный объект */}
                    <Form.Item label="Выберите объект или комплекс">
                      <Select
                        placeholder="Начните вводить название..."
                        allowClear
                        showSearch
                        value={selectedMainValue}
                        onChange={(value) => {
                          console.log('🔍 Selected value:', value, 'Type:', typeof value);
                          setSelectedMainValue(value);
                          
                          // Если значение - строка, это комплекс
                          if (typeof value === 'string') {
                            console.log('✅ This is a COMPLEX:', value);
                            setSelectedComplex(value);
                            const props = properties.complexes[value] || [];
                            console.log('📦 Complex properties:', props);
                            setComplexProperties(props);
                            form.setFieldValue('property_id', undefined);
                          } 
                          // Если значение - число, это отдельный объект
                          else if (typeof value === 'number') {
                            console.log('✅ This is a STANDALONE property ID:', value);
                            setSelectedComplex(null);
                            setComplexProperties([]);
                            form.setFieldValue('property_id', value);
                          }
                          // Если value undefined/null - очистка
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
                        {/* Комплексы - value будет STRING (название комплекса) */}
                        {Object.keys(properties.complexes).length > 0 && (
                          <OptGroup label="🏢 Комплексы">
                            {Object.keys(properties.complexes).map(complexName => (
                              <Option key={`complex-${complexName}`} value={complexName}>
                                {complexName}
                              </Option>
                            ))}
                          </OptGroup>
                        )}
                        
                        {/* Отдельные объекты - value будет NUMBER (ID объекта) */}
                        {properties.standalone.length > 0 && (
                          <OptGroup label="🏠 Отдельные объекты">
                            {properties.standalone.map((prop: Property) => (
                              <Option key={`standalone-${prop.id}`} value={prop.id}>
                                {prop.property_name || 'Объект'} ({prop.property_number})
                              </Option>
                            ))}
                          </OptGroup>
                        )}
                      </Select>
                    </Form.Item>
                      
                    {/* Если выбран комплекс - показываем выбор номера объекта */}
                    {selectedComplex && complexProperties.length > 0 && (
                      <Form.Item 
                        name="property_id" 
                        label={`Номер объекта в комплексе "${selectedComplex}"`}
                        rules={[{ required: true, message: 'Выберите номер объекта' }]}
                      >
                        <Select
                          placeholder="Выберите номер объекта"
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
                
                    {/* ✅ ДОБАВЛЯЕМ: Скрытый Form.Item для отдельных объектов */}
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
                            Выбран объект ID: {form.getFieldValue('property_id')}
                          </span>
                        </div>
                      </>
                    )}
                
                    <Form.Item name="property_address_override" label="Адрес объекта (переопределить)">
                      <TextArea rows={2} placeholder="Оставьте пустым для использования адреса из базы" />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Form.Item 
                      name="property_name_manual" 
                      label="Название объекта"
                      rules={[{ required: manualPropertyInput, message: 'Введите название' }]}
                    >
                      <Input placeholder="Villa Sunset" />
                    </Form.Item>
                    <Form.Item 
                      name="property_number_manual" 
                      label="Номер объекта"
                      rules={[{ required: manualPropertyInput, message: 'Введите номер' }]}
                    >
                      <Input placeholder="PROP-001" />
                    </Form.Item>
                    <Form.Item 
                      name="property_address_manual" 
                      label="Адрес объекта"
                      rules={[{ required: manualPropertyInput, message: 'Введите адрес' }]}
                    >
                      <TextArea rows={2} placeholder="123 Beach Road, Phuket" />
                    </Form.Item>
                  </>
                )}
            </Space>
          </Card>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="date_from" label="Дата начала">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder="Выберите дату" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="date_to" label="Дата окончания">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder="Выберите дату" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="city" label="Город" initialValue="Phuket">
            <Input placeholder="Город" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <TextArea rows={3} placeholder="Краткое описание договора" />
          </Form.Item>
        </div>

        {/* Шаг 3: Стороны договора */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {parties.map((party, index) => (
              <Card
                key={index}
                size="small"
                title={
                  <Space>
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
                      checkedChildren="Компания"
                      unCheckedChildren="Физ. лицо"
                      size="small"
                    />
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
                {!party.is_company ? (
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>ФИО *</label>
                        <Input
                          value={party.name}
                          onChange={(e) => updateParty(index, 'name', e.target.value)}
                          placeholder="John Doe"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Страна паспорта *</label>
                        <Input
                          value={party.passport_country}
                          onChange={(e) => updateParty(index, 'passport_country', e.target.value)}
                          placeholder="Russia"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Номер паспорта *</label>
                        <Input
                          value={party.passport_number}
                          onChange={(e) => updateParty(index, 'passport_number', e.target.value)}
                          placeholder="AB1234567"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    
                    {/* Загрузка документов */}
                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>Документы (паспорт) - необязательно</Divider>
                      
                      {/* Отображаем загруженные документы */}
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
                                        Загрузка...
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <Image
                                        src={doc.preview}
                                        alt={`Document ${docIndex + 1}`}
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

                      {/* Кнопка добавления документа */}
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
                            ? 'Загрузить ещё документ' 
                            : 'Загрузить фото паспорта'}
                        </Button>
                      </Upload>
                    </Col>
                  </Row>
                ) : (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Название компании *</label>
                        <Input
                          value={party.company_name}
                          onChange={(e) => updateParty(index, 'company_name', e.target.value)}
                          placeholder="Company Ltd"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>TAX ID *</label>
                        <Input
                          value={party.company_tax_id}
                          onChange={(e) => updateParty(index, 'company_tax_id', e.target.value)}
                          placeholder="1234567890"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Адрес компании</label>
                        <TextArea
                          value={party.company_address}
                          onChange={(e) => updateParty(index, 'company_address', e.target.value)}
                          placeholder="123 Business Street"
                          rows={2}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>Информация о директоре</Divider>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Имя директора *</label>
                        <Input
                          value={party.director_name}
                          onChange={(e) => updateParty(index, 'director_name', e.target.value)}
                          placeholder="John Smith"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Страна паспорта</label>
                        <Input
                          value={party.director_country}
                          onChange={(e) => updateParty(index, 'director_country', e.target.value)}
                          placeholder="Thailand"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Паспорт директора</label>
                        <Input
                          value={party.director_passport}
                          onChange={(e) => updateParty(index, 'director_passport', e.target.value)}
                          placeholder="AB1234567"
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>

                    {/* Загрузка документов компании */}
                    <Col xs={24}>
                      <Divider style={{ margin: '8px 0' }}>Регистрационные документы - необязательно</Divider>
                      
                      {/* Отображаем загруженные документы */}
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
                                        Загрузка...
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <Image
                                        src={doc.preview}
                                        alt={`Document ${docIndex + 1}`}
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

                      {/* Кнопка добавления документа */}
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
                            ? 'Загрузить ещё документ' 
                            : 'Загрузить документ компании'}
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
              Добавить сторону
            </Button>
          </Space>
        </div>

        {/* Шаг 4: Финансовая информация */}
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <Card size="small" title="Финансовая информация" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="rent_amount_monthly" label="Сумма аренды (в месяц)">
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
                <Form.Item name="rent_amount_total" label="Общая сумма аренды">
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
                <Form.Item name="deposit_amount" label="Сумма депозита">
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

            <Form.Item name="utilities_included" label="Включенные услуги">
              <TextArea
                rows={3}
                placeholder="Gardening, pool cleaning, Wi-Fi, TV"
              />
            </Form.Item>
          </Card>

          <Card size="small" title="Банковские реквизиты">
            <Form.Item name="bank_name" label="Название банка">
              <Input placeholder="Bangkok Bank" />
            </Form.Item>
            <Form.Item name="bank_account_name" label="Имя владельца счета">
              <Input placeholder="John Doe" />
            </Form.Item>
            <Form.Item name="bank_account_number" label="Номер счета">
              <Input placeholder="123-4-56789-0" />
            </Form.Item>
          </Card>
        </div>
      </Form>

      {/* Footer с кнопками навигации */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>Отмена</Button>
        <Space>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>Назад</Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>Далее</Button>
          ) : (
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              Создать договор
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default CreateAgreementModal;