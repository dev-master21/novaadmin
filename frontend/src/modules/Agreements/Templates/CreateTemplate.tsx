// frontend/src/modules/Agreements/Templates/CreateTemplate.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Switch,
  Tag,
  Divider,
  Collapse,
  Row,
  Col,
  Typography
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { agreementsApi } from '@/api/agreements.api';
import './CreateTemplate.css';

const { Option } = Select;
const { Text } = Typography;

const CreateTemplate = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [editorContent, setEditorContent] = useState('');

  // Загрузка данных при редактировании
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const templateId = pathParts[3]; // /agreements/templates/:id/edit
    
    if (templateId && templateId !== 'create' && !isNaN(Number(templateId))) {
      fetchTemplateData(Number(templateId));
    }
  }, [location.pathname]);

  const fetchTemplateData = async (templateId: number) => {
    try {
      setLoading(true);
      const response = await agreementsApi.getTemplateById(templateId);
      const data = response.data.data;
      
      // Заполняем форму
      form.setFieldsValue({
        name: data.name,
        type: data.type,
        is_active: data.is_active ?? true
      });

      // Устанавливаем контент в редактор
      setEditorContent(data.content || '');

      message.success('Данные шаблона загружены');
    } catch (error: any) {
      message.error('Ошибка загрузки шаблона');
      navigate('/agreements/templates');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = () => {
    const pathParts = location.pathname.split('/');
    const templateId = pathParts[3];
    return templateId && templateId !== 'create' && !isNaN(Number(templateId));
  };

  const getTemplateId = () => {
    const pathParts = location.pathname.split('/');
    return Number(pathParts[3]);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      if (!editorContent || editorContent.trim() === '<p><br></p>') {
        message.error('Содержимое шаблона не может быть пустым');
        setLoading(false);
        return;
      }

      const data = {
        name: values.name,
        type: values.type,
        content: editorContent,
        structure: undefined,
        is_active: values.is_active ?? true
      };

      if (isEditing()) {
        // Редактирование
        await agreementsApi.updateTemplate(getTemplateId(), data);
        message.success('Шаблон успешно обновлен');
      } else {
        // Создание
        await agreementsApi.createTemplate(data);
        message.success('Шаблон успешно создан');
      }

      navigate('/agreements/templates');
    } catch (error: any) {
      console.error('Error saving template:', error);
      message.error(error.response?.data?.message || 'Ошибка сохранения шаблона');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`;
    setEditorContent(prev => prev + placeholder);
    message.success(`Переменная {{${variable}}} вставлена`);
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ]
  };

  const commonVariables = [
    // Основные
    { key: 'contract_number', label: 'Номер договора', example: 'NOVA-123456' },
    { key: 'agreement_number', label: 'Номер договора (альт)', example: 'NOVA-123456' },
    { key: 'date', label: 'Текущая дата', example: 'November 6, 2025' },
    { key: 'city', label: 'Город', example: 'Phuket' },
    { key: 'date_from', label: 'Дата начала', example: 'January 1, 2025' },
    { key: 'date_to', label: 'Дата окончания', example: 'December 31, 2025' },
    
    // Объект недвижимости
    { key: 'property_name', label: 'Название объекта', example: 'Villa Sunset' },
    { key: 'property_address', label: 'Адрес объекта', example: '123 Beach Road' },
    { key: 'property_number', label: 'Номер объекта', example: 'PROP-001' },
    
    // Финансы
    { key: 'rent_amount', label: 'Сумма аренды (месяц)', example: '50,000 THB' },
    { key: 'rent_amount_monthly', label: 'Сумма аренды (месяц)', example: '50,000 THB' },
    { key: 'rent_amount_total', label: 'Общая сумма аренды', example: '600,000 THB' },
    { key: 'deposit_amount', label: 'Сумма депозита', example: '100,000 THB' },
    { key: 'utilities_included', label: 'Включенные услуги', example: 'Gardening, Wi-Fi' },
    
    // Банк
    { key: 'bank_name', label: 'Название банка', example: 'Bangkok Bank' },
    { key: 'bank_account_name', label: 'Владелец счета', example: 'John Doe' },
    { key: 'bank_account_number', label: 'Номер счета', example: '123-4-56789-0' },
    
    // Landlord
    { key: 'landlord_name', label: 'Имя арендодателя', example: 'John Smith' },
    { key: 'landlord_country', label: 'Страна (арендодатель)', example: 'Thailand' },
    { key: 'landlord_passport', label: 'Паспорт (арендодатель)', example: 'AB1234567' },
    { key: 'landlord_passport_number', label: 'Паспорт (арендодатель, альт)', example: 'AB1234567' },
    
    // Representative
    { key: 'representative_name', label: 'Имя представителя', example: 'Sarah Johnson' },
    { key: 'representative_country', label: 'Страна (представитель)', example: 'USA' },
    { key: 'representative_passport', label: 'Паспорт (представитель)', example: 'US7654321' },
    { key: 'representative_passport_number', label: 'Паспорт (представитель, альт)', example: 'US7654321' },
    
    // Tenant
    { key: 'tenant_name', label: 'Имя арендатора', example: 'Jane Doe' },
    { key: 'tenant_country', label: 'Страна (арендатор)', example: 'USA' },
    { key: 'tenant_passport', label: 'Паспорт (арендатор)', example: 'CD9876543' },
    { key: 'tenant_passport_number', label: 'Паспорт (арендатор, альт)', example: 'CD9876543' },
    
    // Lessor
    { key: 'lessor_name', label: 'Имя лессора', example: 'Company Ltd' },
    { key: 'lessor_country', label: 'Страна (лессор)', example: 'Thailand' },
    { key: 'lessor_passport', label: 'Паспорт (лессор)', example: 'EF1234567' },
    { key: 'lessor_passport_number', label: 'Паспорт (лессор, альт)', example: 'EF1234567' },
    
    // Agent
    { key: 'agent_name', label: 'Имя агента', example: 'Real Estate Co.' },
    { key: 'agent_country', label: 'Страна (агент)', example: 'Thailand' },
    { key: 'agent_passport', label: 'Паспорт (агент)', example: 'GH1234567' },
    { key: 'agent_passport_number', label: 'Паспорт (агент, альт)', example: 'GH1234567' },
    
    // Seller
    { key: 'seller_name', label: 'Имя продавца', example: 'Seller Name' },
    { key: 'seller_country', label: 'Страна (продавец)', example: 'Thailand' },
    { key: 'seller_passport', label: 'Паспорт (продавец)', example: 'IJ1234567' },
    { key: 'seller_passport_number', label: 'Паспорт (продавец, альт)', example: 'IJ1234567' },
    
    // Buyer
    { key: 'buyer_name', label: 'Имя покупателя', example: 'Buyer Name' },
    { key: 'buyer_country', label: 'Страна (покупатель)', example: 'USA' },
    { key: 'buyer_passport', label: 'Паспорт (покупатель)', example: 'KL9876543' },
    { key: 'buyer_passport_number', label: 'Паспорт (покупатель, альт)', example: 'KL9876543' },
    
    // Principal
    { key: 'principal_name', label: 'Имя принципала', example: 'Principal Name' },
    { key: 'principal_country', label: 'Страна (принципал)', example: 'Russia' },
    { key: 'principal_passport', label: 'Паспорт (принципал)', example: 'MN1234567' },
    { key: 'principal_passport_number', label: 'Паспорт (принципал, альт)', example: 'MN1234567' },
    
    // Witnesses (до 5 свидетелей)
    { key: 'witness_name', label: 'Имя свидетеля 1', example: 'Witness Name' },
    { key: 'witness_country', label: 'Страна (свидетель 1)', example: 'Thailand' },
    { key: 'witness_passport', label: 'Паспорт (свидетель 1)', example: 'OP1234567' },
    
    { key: 'witness2_name', label: 'Имя свидетеля 2', example: 'Witness 2 Name' },
    { key: 'witness2_country', label: 'Страна (свидетель 2)', example: 'USA' },
    { key: 'witness2_passport', label: 'Паспорт (свидетель 2)', example: 'QR1234567' },
    
    { key: 'witness3_name', label: 'Имя свидетеля 3', example: 'Witness 3 Name' },
    { key: 'witness3_country', label: 'Страна (свидетель 3)', example: 'UK' },
    { key: 'witness3_passport', label: 'Паспорт (свидетель 3)', example: 'ST1234567' },
    
    { key: 'witness4_name', label: 'Имя свидетеля 4', example: 'Witness 4 Name' },
    { key: 'witness4_country', label: 'Страна (свидетель 4)', example: 'Australia' },
    { key: 'witness4_passport', label: 'Паспорт (свидетель 4)', example: 'UV1234567' },
    
    { key: 'witness5_name', label: 'Имя свидетеля 5', example: 'Witness 5 Name' },
    { key: 'witness5_country', label: 'Страна (свидетель 5)', example: 'Canada' },
    { key: 'witness5_passport', label: 'Паспорт (свидетель 5)', example: 'WX1234567' },
    
    // Companies (до 3 компаний)
    { key: 'company1_name', label: 'Название компании 1', example: 'Company Ltd' },
    { key: 'company1_address', label: 'Адрес компании 1', example: '123 Business St' },
    { key: 'company1_tax_id', label: 'TAX ID компании 1', example: '1234567890' },
    { key: 'company1_director_name', label: 'Директор компании 1', example: 'John Smith' },
    { key: 'company1_director_passport', label: 'Паспорт директора 1', example: 'AB1234567' },
    { key: 'company1_director_country', label: 'Страна директора 1', example: 'Thailand' },
    
    { key: 'company2_name', label: 'Название компании 2', example: 'Second Co Ltd' },
    { key: 'company2_address', label: 'Адрес компании 2', example: '456 Trade Ave' },
    { key: 'company2_tax_id', label: 'TAX ID компании 2', example: '0987654321' },
    { key: 'company2_director_name', label: 'Директор компании 2', example: 'Jane Doe' },
    { key: 'company2_director_passport', label: 'Паспорт директора 2', example: 'CD9876543' },
    { key: 'company2_director_country', label: 'Страна директора 2', example: 'USA' },
    
    { key: 'company3_name', label: 'Название компании 3', example: 'Third Corp' },
    { key: 'company3_address', label: 'Адрес компании 3', example: '789 Market Rd' },
    { key: 'company3_tax_id', label: 'TAX ID компании 3', example: '1122334455' },
    { key: 'company3_director_name', label: 'Директор компании 3', example: 'Mike Johnson' },
    { key: 'company3_director_passport', label: 'Паспорт директора 3', example: 'EF1122334' },
    { key: 'company3_director_country', label: 'Страна директора 3', example: 'Singapore' }
  ];

  return (
    <div className="create-template-container">
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/agreements/templates')}
          >
            Назад к списку
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading}
          >
            {isEditing() ? 'Сохранить изменения' : 'Создать шаблон'}
          </Button>
        </Space>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="name"
                label="Название шаблона"
                rules={[{ required: true, message: 'Введите название шаблона' }]}
              >
                <Input placeholder="Договор аренды жилого помещения" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="type"
                label="Тип договора"
                rules={[{ required: true, message: 'Выберите тип' }]}
              >
                <Select placeholder="Выберите тип" size="large">
                  <Option value="rent">Аренда</Option>
                  <Option value="sale">Купли-продажа</Option>
                  <Option value="bilateral">Двухсторонний</Option>
                  <Option value="trilateral">Трёхсторонний</Option>
                  <Option value="agency">Агентский</Option>
                  <Option value="transfer_act">Акт приёма-передачи</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="is_active" label="Статус" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Активен" unCheckedChildren="Неактивен" />
          </Form.Item>

          <Divider />

          <Collapse
            defaultActiveKey={['variables']}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'variables',
                label: (
                  <Space>
                    <InfoCircleOutlined />
                    <strong>Доступные переменные (кликните для вставки)</strong>
                  </Space>
                ),
                children: (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <Row gutter={[8, 8]}>
                      {commonVariables.map(variable => (
                        <Col key={variable.key} xs={24} sm={12} md={8} lg={6}>
                          <Tag
                            color="blue"
                            style={{ 
                              cursor: 'pointer', 
                              width: '100%',
                              textAlign: 'center',
                              padding: '4px 8px'
                            }}
                            onClick={() => insertVariable(variable.key)}
                          >
                            {variable.label}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>
                            {`{{${variable.key}}}`}
                          </Text>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )
              }
            ]}
          />

          <Form.Item
            label="Содержимое шаблона"
            required
            help="Используйте переменные выше для вставки динамических данных"
          >
            <ReactQuill
              value={editorContent}
              onChange={setEditorContent}
              modules={modules}
              theme="snow"
              style={{ height: '500px', marginBottom: '60px' }}
              placeholder="Введите текст договора. Используйте переменные в формате {{имя_переменной}} для динамических данных..."
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateTemplate;