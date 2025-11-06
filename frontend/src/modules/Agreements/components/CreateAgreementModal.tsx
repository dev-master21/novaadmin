// frontend/src/modules/Agreements/components/CreateAgreementModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Steps,
  Space,
  Card,
  message,
  Row,
  Col,
  Divider
} from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { agreementsApi, AgreementTemplate, AgreementParty } from '@/api/agreements.api';
import { propertiesApi } from '@/api/properties.api';
import type { Property } from '@/api/properties.api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface CreateAgreementModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateAgreementModal = ({ visible, onCancel, onSuccess }: CreateAgreementModalProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgreementTemplate | null>(null);
  const [parties, setParties] = useState<AgreementParty[]>([]);

  useEffect(() => {
    if (visible) {
      fetchTemplates();
      fetchProperties();
    } else {
      // Сброс при закрытии
      form.resetFields();
      setCurrentStep(0);
      setSelectedTemplate(null);
      setParties([]);
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
      const response = await propertiesApi.getAll({ limit: 1000 });
      
      // ИСПРАВЛЕНО: Правильно извлекаем массив свойств из ответа
      // Проверяем структуру ответа и извлекаем данные соответственно
      if (response.data && Array.isArray(response.data.data)) {
        // Если data - это массив
        setProperties(response.data.data);
      } else if (response.data && response.data.data && Array.isArray((response.data.data as any).properties)) {
        // Если data.properties - это массив (альтернативная структура)
        setProperties((response.data.data as any).properties);
      } else if (response.data && Array.isArray((response.data as any).properties)) {
        // Если properties на верхнем уровне
        setProperties((response.data as any).properties);
      } else {
        console.warn('Unexpected API response structure:', response.data);
        setProperties([]);
      }
    } catch (error: any) {
      console.error('Error fetching properties:', error);
      message.error('Ошибка загрузки объектов');
    }
  };

  const handleTemplateSelect = async (templateId: number) => {
    try {
      const response = await agreementsApi.getTemplateById(templateId);
      setSelectedTemplate(response.data.data);
      
      // Устанавливаем начальные стороны в зависимости от типа
      const type = response.data.data.type;
      if (type === 'bilateral') {
        setParties([
          { role: 'landlord', name: '', passport_country: '', passport_number: '' },
          { role: 'tenant', name: '', passport_country: '', passport_number: '' }
        ]);
      } else if (type === 'trilateral') {
        setParties([
          { role: 'landlord', name: '', passport_country: '', passport_number: '' },
          { role: 'tenant', name: '', passport_country: '', passport_number: '' },
          { role: 'agent', name: '', passport_country: '', passport_number: '' }
        ]);
      } else if (type === 'agency') {
        setParties([
          { role: 'principal', name: '', passport_country: '', passport_number: '' },
          { role: 'agent', name: '', passport_country: '', passport_number: '' }
        ]);
      } else if (type === 'sale') {
        setParties([
          { role: 'seller', name: '', passport_country: '', passport_number: '' },
          { role: 'buyer', name: '', passport_country: '', passport_number: '' }
        ]);
      }
    } catch (error: any) {
      message.error('Ошибка загрузки шаблона');
    }
  };

  const addParty = () => {
    setParties([...parties, { role: '', name: '', passport_country: '', passport_number: '' }]);
  };

  const removeParty = (index: number) => {
    setParties(parties.filter((_, i) => i !== index));
  };

  const updateParty = (index: number, field: keyof AgreementParty, value: string) => {
    const newParties = [...parties];
    newParties[index] = { ...newParties[index], [field]: value };
    setParties(newParties);
  };

  const handleNext = async () => {
    try {
      await form.validateFields();
      setCurrentStep(currentStep + 1);
    } catch (error) {
      // Validation failed
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

    const handleSubmit = async () => {
    try {
        await form.validateFields();
        setLoading(true);

        const values = form.getFieldsValue();
        
        console.log('📤 Frontend sending data:', values); // ДОБАВЬТЕ ЭТО
        
        const data = {
        template_id: values.template_id, // УБЕДИТЕСЬ ЧТО ЭТО ЕСТЬ
        property_id: values.property_id,
        description: values.description,
        date_from: values.date_from ? dayjs(values.date_from).format('YYYY-MM-DD') : undefined,
        date_to: values.date_to ? dayjs(values.date_to).format('YYYY-MM-DD') : undefined,
        city: values.city || 'Phuket',
        parties: parties.filter(p => p.name && p.role)
        };

        console.log('📤 Final data to send:', data); // ДОБАВЬТЕ ЭТО

        await agreementsApi.create(data);
        message.success('Договор успешно создан');
        onSuccess();
    } catch (error: any) {
        console.error('❌ Error creating agreement:', error);
        message.error(error.response?.data?.message || 'Ошибка создания договора');
    } finally {
        setLoading(false);
    }
};

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      landlord: 'Арендодатель',
      tenant: 'Арендатор',
      agent: 'Агент',
      principal: 'Принципал',
      seller: 'Продавец',
      buyer: 'Покупатель',
      party1: 'Сторона 1',
      party2: 'Сторона 2',
      party3: 'Сторона 3'
    };
    return roleLabels[role] || role;
  };

  const steps = [
    {
      title: 'Шаблон',
      icon: <FileTextOutlined />
    },
    {
      title: 'Детали',
      icon: <CalendarOutlined />
    },
    {
      title: 'Стороны',
      icon: <UserOutlined />
    }
  ];

  return (
    <Modal
      title="Создание договора"
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={null}
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
        onChange={(value) => {
          console.log('✅ Template selected:', value);
          handleTemplateSelect(value);
        }}
        showSearch
        optionFilterProp="children"
      >
        {templates.map(template => (
          <Option key={template.id} value={template.id}>
            <div>
              <div>{template.name}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Версия {template.version} • Использован {template.usage_count} раз
              </div>
            </div>
          </Option>
        ))}
      </Select>
    </Form.Item>

    {selectedTemplate && (
      <Card size="small" style={{ background: '#f5f5f5' }}>
        <p><strong>Тип:</strong> {selectedTemplate.type}</p>
        <p><strong>Описание:</strong> Шаблон для создания договора типа "{selectedTemplate.type}"</p>
      </Card>
    )}
  </div>

  {/* Шаг 2: Детали договора */}
  <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
    <Form.Item
      name="property_id"
      label="Объект недвижимости"
    >
      <Select
        placeholder="Выберите объект (необязательно)"
        allowClear
        showSearch
        optionFilterProp="children"
      >
        {properties.map(property => (
          <Option key={property.id} value={property.id}>
            {property.property_name || property.property_number}
          </Option>
        ))}
      </Select>
    </Form.Item>

    <Row gutter={16}>
      <Col span={12}>
        <Form.Item
          name="date_from"
          label="Дата начала"
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="date_to"
          label="Дата окончания"
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item
      name="city"
      label="Город"
      initialValue="Phuket"
    >
      <Input placeholder="Город" />
    </Form.Item>

    <Form.Item
      name="description"
      label="Описание"
    >
      <TextArea rows={4} placeholder="Краткое описание договора" />
    </Form.Item>
  </div>

  {/* Шаг 3: Стороны договора */}
  <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
    <Space direction="vertical" style={{ width: '100%' }}>
      {parties.map((party, index) => (
        <Card
          key={index}
          size="small"
          title={`${getRoleLabel(party.role) || `Сторона ${index + 1}`}`}
          extra={
            parties.length > 1 && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeParty(index)}
              />
            )
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Роль" required>
                <Select
                  value={party.role}
                  onChange={(value) => updateParty(index, 'role', value)}
                  placeholder="Выберите роль"
                >
                  <Option value="landlord">Арендодатель</Option>
                  <Option value="tenant">Арендатор</Option>
                  <Option value="agent">Агент</Option>
                  <Option value="principal">Принципал</Option>
                  <Option value="seller">Продавец</Option>
                  <Option value="buyer">Покупатель</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="ФИО" required>
                <Input
                  value={party.name}
                  onChange={(e) => updateParty(index, 'name', e.target.value)}
                  placeholder="Полное имя"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Страна паспорта" required>
                <Input
                  value={party.passport_country}
                  onChange={(e) => updateParty(index, 'passport_country', e.target.value)}
                  placeholder="Например: Russia"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Номер паспорта" required>
                <Input
                  value={party.passport_number}
                  onChange={(e) => updateParty(index, 'passport_number', e.target.value)}
                  placeholder="Номер паспорта"
                />
              </Form.Item>
            </Col>
          </Row>
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
</Form>

      <Divider />

      {/* Навигация */}
      <Space style={{ float: 'right' }}>
        {currentStep > 0 && (
          <Button onClick={handlePrevious}>
            Назад
          </Button>
        )}
        {currentStep < steps.length - 1 && (
          <Button type="primary" onClick={handleNext}>
            Далее
          </Button>
        )}
        {currentStep === steps.length - 1 && (
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            Создать договор
          </Button>
        )}
      </Space>
    </Modal>
  );
};

export default CreateAgreementModal;