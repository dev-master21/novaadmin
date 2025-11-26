// frontend/src/modules/FinancialDocuments/components/EditInvoiceModal.tsx
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
  InputNumber,
  Divider
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  FileTextOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, CreateInvoiceDTO, InvoiceItem, Invoice } from '@/api/financialDocuments.api';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import dayjs from 'dayjs';
import './CreateInvoiceModal.css';

const { Option } = Select;
const { TextArea } = Input;

interface EditInvoiceModalProps {
  visible: boolean;
  invoice: Invoice | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditInvoiceModal = ({ visible, invoice, onCancel, onSuccess }: EditInvoiceModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  // From/To party types
  const [fromType, setFromType] = useState<'company' | 'individual'>('company');
  const [toType, setToType] = useState<'company' | 'individual'>('individual');

  useEffect(() => {
    if (visible && invoice) {
      fetchAgreements();
      loadInvoiceData();
    }
  }, [visible, invoice]);

  const fetchAgreements = async () => {
    try {
      const response = await agreementsApi.getAll({ limit: 100 });
      setAgreements(response.data.data);
    } catch (error: any) {
      message.error(t('createInvoiceModal.messages.agreementsLoadError'));
    }
  };

  const loadInvoiceData = () => {
    if (!invoice) return;

    setFromType(invoice.from_type);
    setToType(invoice.to_type);

    // Загружаем позиции - КРИТИЧНО: парсим числа правильно
    if (invoice.items && invoice.items.length > 0) {
      const parsedItems = invoice.items.map(item => ({
        description: item.description || '',
        quantity: parseFloat(String(item.quantity)) || 1,
        unit_price: parseFloat(String(item.unit_price)) || 0,
        total_price: parseFloat(String(item.total_price)) || 0
      }));
      setItems(parsedItems);
    }

    // Заполняем форму
    form.setFieldsValue({
      agreement_id: invoice.agreement_id,
      invoice_date: invoice.invoice_date ? dayjs(invoice.invoice_date) : undefined,
      due_date: invoice.due_date ? dayjs(invoice.due_date) : undefined,
      notes: invoice.notes,
      tax_amount: parseFloat(String(invoice.tax_amount)) || 0,
      
      // From fields
      from_company_name: invoice.from_company_name,
      from_company_tax_id: invoice.from_company_tax_id,
      from_company_address: invoice.from_company_address,
      from_director_name: invoice.from_director_name,
      from_director_country: invoice.from_director_country,
      from_director_passport: invoice.from_director_passport,
      from_individual_name: invoice.from_individual_name,
      from_individual_country: invoice.from_individual_country,
      from_individual_passport: invoice.from_individual_passport,
      
      // To fields
      to_company_name: invoice.to_company_name,
      to_company_tax_id: invoice.to_company_tax_id,
      to_company_address: invoice.to_company_address,
      to_director_name: invoice.to_director_name,
      to_director_country: invoice.to_director_country,
      to_director_passport: invoice.to_director_passport,
      to_individual_name: invoice.to_individual_name,
      to_individual_country: invoice.to_individual_country,
      to_individual_passport: invoice.to_individual_passport,
      
      // Bank fields
      bank_name: invoice.bank_name,
      bank_account_name: invoice.bank_account_name,
      bank_account_number: invoice.bank_account_number
    });
  };

  const handleAgreementChange = async (value: number) => {
    try {
      const response = await agreementsApi.getAgreementWithParties(value);
      const agreementData = response.data.data;

      // Автозаполнение FROM (lessor)
      if (agreementData.lessor) {
        const lessor = agreementData.lessor;
        setFromType(lessor.type);
        
        if (lessor.type === 'company') {
          form.setFieldsValue({
            from_company_name: lessor.company_name,
            from_company_tax_id: lessor.company_tax_id,
            from_company_address: lessor.company_address,
            from_director_name: lessor.director_name,
            from_director_country: lessor.director_country,
            from_director_passport: lessor.director_passport
          });
        } else {
          form.setFieldsValue({
            from_individual_name: lessor.individual_name,
            from_individual_country: lessor.individual_country,
            from_individual_passport: lessor.individual_passport
          });
        }
      }

      // Автозаполнение TO (tenant)
      if (agreementData.tenant) {
        const tenant = agreementData.tenant;
        setToType(tenant.type);
        
        if (tenant.type === 'company') {
          form.setFieldsValue({
            to_company_name: tenant.company_name,
            to_company_tax_id: tenant.company_tax_id,
            to_company_address: tenant.company_address,
            to_director_name: tenant.director_name,
            to_director_country: tenant.director_country,
            to_director_passport: tenant.director_passport
          });
        } else {
          form.setFieldsValue({
            to_individual_name: tenant.individual_name,
            to_individual_country: tenant.individual_country,
            to_individual_passport: tenant.individual_passport
          });
        }
      }

      message.success(t('editInvoiceModal.messages.agreementDataLoaded'));
    } catch (error: any) {
      message.error(t('createInvoiceModal.messages.agreementDataLoadError'));
    }
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
    
    // КРИТИЧНО: парсим значение правильно
    let parsedValue = value;
    if (field === 'quantity' || field === 'unit_price') {
      parsedValue = typeof value === 'number' ? value : (parseFloat(String(value)) || 0);
    }
    
    newItems[index] = { ...newItems[index], [field]: parsedValue };
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = typeof newItems[index].quantity === 'number' ? newItems[index].quantity : parseFloat(String(newItems[index].quantity)) || 0;
      const price = typeof newItems[index].unit_price === 'number' ? newItems[index].unit_price : parseFloat(String(newItems[index].unit_price)) || 0;
      newItems[index].total_price = qty * price;
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const total = typeof item.total_price === 'number' ? item.total_price : parseFloat(String(item.total_price)) || 0;
      return sum + total;
    }, 0);
    
    const taxValue = form.getFieldValue('tax_amount');
    const tax_amount = typeof taxValue === 'number' ? taxValue : parseFloat(String(taxValue)) || 0;
    const total = subtotal + tax_amount;
    
    return { subtotal, tax_amount, total };
  };

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['invoice_date']);
      } else if (currentStep === 1) {
        if (fromType === 'company') {
          await form.validateFields([
            'from_company_name',
            'from_company_tax_id',
            'from_director_name'
          ]);
        } else {
          await form.validateFields([
            'from_individual_name',
            'from_individual_country',
            'from_individual_passport'
          ]);
        }
        
        if (toType === 'company') {
          await form.validateFields([
            'to_company_name',
            'to_company_tax_id',
            'to_director_name'
          ]);
        } else {
          await form.validateFields([
            'to_individual_name',
            'to_individual_country',
            'to_individual_passport'
          ]);
        }
      } else if (currentStep === 2) {
        const hasValidItem = items.some(item => 
          item.description && item.quantity > 0 && item.unit_price > 0
        );
        
        if (!hasValidItem) {
          message.error(t('createInvoiceModal.validation.addAtLeastOneItem'));
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
    if (!invoice) return;

    try {
      setLoading(true);
      const values = await form.validateFields();

      const validItems = items.filter(item => 
        item.description && item.quantity > 0 && item.unit_price > 0
      ).map(item => ({
        description: item.description,
        quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity)) || 1,
        unit_price: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price)) || 0,
        total_price: typeof item.total_price === 'number' ? item.total_price : parseFloat(String(item.total_price)) || 0
      }));

      if (validItems.length === 0) {
        message.error(t('createInvoiceModal.validation.addAtLeastOneItem'));
        setLoading(false);
        return;
      }

      const taxValue = values.tax_amount;
      const taxAmount = typeof taxValue === 'number' ? taxValue : parseFloat(String(taxValue)) || 0;

      const invoiceData: Partial<CreateInvoiceDTO> = {
        agreement_id: values.agreement_id || undefined,
        invoice_date: values.invoice_date ? dayjs(values.invoice_date).format('YYYY-MM-DD') : undefined,
        due_date: values.due_date ? dayjs(values.due_date).format('YYYY-MM-DD') : undefined,
        
        from_type: fromType,
        from_company_name: fromType === 'company' ? values.from_company_name : undefined,
        from_company_tax_id: fromType === 'company' ? values.from_company_tax_id : undefined,
        from_company_address: fromType === 'company' ? values.from_company_address : undefined,
        from_director_name: fromType === 'company' ? values.from_director_name : undefined,
        from_director_country: fromType === 'company' ? values.from_director_country : undefined,
        from_director_passport: fromType === 'company' ? values.from_director_passport : undefined,
        from_individual_name: fromType === 'individual' ? values.from_individual_name : undefined,
        from_individual_country: fromType === 'individual' ? values.from_individual_country : undefined,
        from_individual_passport: fromType === 'individual' ? values.from_individual_passport : undefined,
        
        to_type: toType,
        to_company_name: toType === 'company' ? values.to_company_name : undefined,
        to_company_tax_id: toType === 'company' ? values.to_company_tax_id : undefined,
        to_company_address: toType === 'company' ? values.to_company_address : undefined,
        to_director_name: toType === 'company' ? values.to_director_name : undefined,
        to_director_country: toType === 'company' ? values.to_director_country : undefined,
        to_director_passport: toType === 'company' ? values.to_director_passport : undefined,
        to_individual_name: toType === 'individual' ? values.to_individual_name : undefined,
        to_individual_country: toType === 'individual' ? values.to_individual_country : undefined,
        to_individual_passport: toType === 'individual' ? values.to_individual_passport : undefined,
        
        items: validItems,
        
        bank_name: values.bank_name,
        bank_account_name: values.bank_account_name,
        bank_account_number: values.bank_account_number,
        
        notes: values.notes,
        tax_amount: taxAmount
      };

      await financialDocumentsApi.updateInvoice(invoice.id, invoiceData);
      
      message.success(t('editInvoiceModal.messages.updated'));
      onSuccess();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      message.error(error.response?.data?.message || t('editInvoiceModal.messages.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: t('createInvoiceModal.steps.basic'), icon: <FileTextOutlined /> },
    { title: t('createInvoiceModal.steps.parties'), icon: <UserOutlined /> },
    { title: t('createInvoiceModal.steps.items'), icon: <FileTextOutlined /> },
    { title: t('createInvoiceModal.steps.bank'), icon: <DollarOutlined /> }
  ];

  const totals = calculateTotals();

  return (
    <Modal
      title={t('editInvoiceModal.title')}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      className="create-invoice-modal dark-theme"
      destroyOnClose
    >
      <Steps 
        current={currentStep} 
        items={steps} 
        style={{ marginBottom: 24 }}
        responsive={false}
        size="small"
      />

      <Form form={form} layout="vertical">
        {/* Шаг 1: Основная информация */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item 
                name="agreement_id" 
                label={t('createInvoiceModal.fields.agreement')}
              >
                <Select
                  placeholder={t('createInvoiceModal.placeholders.selectAgreement')}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  size="large"
                  onChange={handleAgreementChange}
                >
                  {agreements.map(agreement => (
                    <Option key={agreement.id} value={agreement.id}>
                      {agreement.agreement_number}
                      {agreement.property_name && ` - ${agreement.property_name}`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item 
                name="invoice_date" 
                label={t('createInvoiceModal.fields.invoiceDate')}
                rules={[{ required: true, message: t('createInvoiceModal.validation.specifyDate') }]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="DD.MM.YYYY" 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            name="due_date" 
            label={t('createInvoiceModal.fields.dueDate')}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD.MM.YYYY" 
              size="large"
            />
          </Form.Item>

          <Form.Item 
            name="notes" 
            label={t('createInvoiceModal.fields.notes')}
          >
            <TextArea 
              rows={3} 
              placeholder={t('createInvoiceModal.placeholders.notes')} 
              size="large"
            />
          </Form.Item>
        </div>

{/* Шаг 2: Стороны */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <Card size="small" title={t('createInvoiceModal.sections.from')} style={{ marginBottom: 16 }}>
            <Form.Item label={t('createInvoiceModal.fields.type')}>
              <Radio.Group 
                value={fromType} 
                onChange={(e) => setFromType(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="company">{t('createInvoiceModal.partyTypes.company')}</Radio.Button>
                <Radio.Button value="individual">{t('createInvoiceModal.partyTypes.individual')}</Radio.Button>
              </Radio.Group>
            </Form.Item>

            {fromType === 'company' ? (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="from_company_name" 
                      label={t('createInvoiceModal.fields.companyName')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyName') }]}
                    >
                      <Input placeholder="Company Ltd" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="from_company_tax_id" 
                      label={t('createInvoiceModal.fields.taxId')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyTaxId') }]}
                    >
                      <Input placeholder="1234567890" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item 
                  name="from_company_address" 
                  label={t('createInvoiceModal.fields.companyAddress')}
                >
                  <TextArea rows={2} placeholder="123 Business Street" />
                </Form.Item>

                <Divider style={{ margin: '8px 0' }}>{t('createInvoiceModal.sections.director')}</Divider>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="from_director_name" 
                      label={t('createInvoiceModal.fields.directorName')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyName') }]}
                    >
                      <Input placeholder="John Smith" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="from_director_country" 
                      label={t('createInvoiceModal.fields.passportCountry')}
                    >
                      <Input placeholder="Thailand" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="from_director_passport" 
                      label={t('createInvoiceModal.fields.directorPassport')}
                    >
                      <Input placeholder="AB1234567" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ) : (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="from_individual_name" 
                    label={t('createInvoiceModal.fields.fullName')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyFullName') }]}
                  >
                    <Input placeholder="John Doe" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="from_individual_country" 
                    label={t('createInvoiceModal.fields.country')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyCountry') }]}
                  >
                    <Input placeholder="Russia" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="from_individual_passport" 
                    label={t('createInvoiceModal.fields.passportNumber')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyPassport') }]}
                  >
                    <Input placeholder="AB1234567" />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Card>

          <Card size="small" title={t('createInvoiceModal.sections.to')}>
            <Form.Item label={t('createInvoiceModal.fields.type')}>
              <Radio.Group 
                value={toType} 
                onChange={(e) => setToType(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="company">{t('createInvoiceModal.partyTypes.company')}</Radio.Button>
                <Radio.Button value="individual">{t('createInvoiceModal.partyTypes.individual')}</Radio.Button>
              </Radio.Group>
            </Form.Item>

            {toType === 'company' ? (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="to_company_name" 
                      label={t('createInvoiceModal.fields.companyName')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyName') }]}
                    >
                      <Input placeholder="Company Ltd" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="to_company_tax_id" 
                      label={t('createInvoiceModal.fields.taxId')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyTaxId') }]}
                    >
                      <Input placeholder="1234567890" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item 
                  name="to_company_address" 
                  label={t('createInvoiceModal.fields.companyAddress')}
                >
                  <TextArea rows={2} placeholder="123 Business Street" />
                </Form.Item>

                <Divider style={{ margin: '8px 0' }}>{t('createInvoiceModal.sections.director')}</Divider>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="to_director_name" 
                      label={t('createInvoiceModal.fields.directorName')}
                      rules={[{ required: true, message: t('createInvoiceModal.validation.specifyName') }]}
                    >
                      <Input placeholder="John Smith" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="to_director_country" 
                      label={t('createInvoiceModal.fields.passportCountry')}
                    >
                      <Input placeholder="Thailand" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item 
                      name="to_director_passport" 
                      label={t('createInvoiceModal.fields.directorPassport')}
                    >
                      <Input placeholder="AB1234567" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ) : (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="to_individual_name" 
                    label={t('createInvoiceModal.fields.fullName')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyFullName') }]}
                  >
                    <Input placeholder="John Doe" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="to_individual_country" 
                    label={t('createInvoiceModal.fields.country')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyCountry') }]}
                  >
                    <Input placeholder="Russia" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item 
                    name="to_individual_passport" 
                    label={t('createInvoiceModal.fields.passportNumber')}
                    rules={[{ required: true, message: t('createInvoiceModal.validation.specifyPassport') }]}
                  >
                    <Input placeholder="AB1234567" />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Card>
        </div>

        {/* Шаг 3: Позиции инвойса */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {items.map((item, index) => (
              <Card
                key={index}
                size="small"
                title={t('createInvoiceModal.items.position', { number: index + 1 })}
                extra={
                  items.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeItem(index)}
                      size="small"
                    />
                  )
                }
                className="invoice-item-card"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input
                    placeholder={t('createInvoiceModal.placeholders.itemDescription')}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    size="large"
                  />
                  
                  <Row gutter={8}>
                    <Col xs={8}>
                      <InputNumber
                        placeholder={t('createInvoiceModal.items.quantity')}
                        value={item.quantity}
                        onChange={(value) => updateItem(index, 'quantity', value || 1)}
                        min={0.01}
                        step={1}
                        style={{ width: '100%' }}
                        addonBefore={t('createInvoiceModal.items.quantity')}
                      />
                    </Col>
                    <Col xs={8}>
                      <InputNumber<number>
                        placeholder={t('createInvoiceModal.items.price')}
                        value={item.unit_price}
                        onChange={(value) => updateItem(index, 'unit_price', value || 0)}
                        min={0}
                        step={100}
                        style={{ width: '100%' }}
                        formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => {
                          const num = value ? parseFloat(value.replace(/,/g, '')) : 0;
                          return isNaN(num) ? 0 : num;
                        }}
                        addonBefore="THB"
                      />
                    </Col>
                    <Col xs={8}>
                      <InputNumber
                        value={item.total_price}
                        disabled
                        style={{ width: '100%' }}
                        formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        addonBefore={t('createInvoiceModal.items.total')}
                      />
                    </Col>
                  </Row>
                </Space>
              </Card>
            ))}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addItem}
              block
            >
              {t('createInvoiceModal.buttons.addItem')}
            </Button>

            <Card size="small" style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Col>{t('createInvoiceModal.totals.subtotal')}:</Col>
                  <Col style={{ fontWeight: 600 }}>
                    {new Intl.NumberFormat('en-US').format(totals.subtotal)} THB
                  </Col>
                </Row>

                <Row gutter={16} align="middle">
                  <Col xs={12}>
                    <Form.Item 
                      name="tax_amount" 
                      label={t('createInvoiceModal.fields.tax')} 
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber<number>
                        placeholder="0"
                        min={0}
                        step={100}
                        style={{ width: '100%' }}
                        formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => {
                          const num = value ? parseFloat(value.replace(/,/g, '')) : 0;
                          return isNaN(num) ? 0 : num;
                        }}
                        addonAfter="THB"
                        onChange={() => form.setFieldsValue({})}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                      +{new Intl.NumberFormat('en-US').format(totals.tax_amount)} THB
                    </div>
                  </Col>
                </Row>

                <Divider style={{ margin: '8px 0' }} />

                <Row justify="space-between">
                  <Col style={{ fontSize: '16px', fontWeight: 700 }}>{t('createInvoiceModal.totals.total')}:</Col>
                  <Col style={{ fontSize: '18px', fontWeight: 700, color: '#52c41a' }}>
                    {new Intl.NumberFormat('en-US').format(totals.total)} THB
                  </Col>
                </Row>
              </Space>
            </Card>
          </Space>
        </div>

        {/* Шаг 4: Банковские реквизиты */}
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <Card size="small" title={t('createInvoiceModal.sections.bankDetails')}>
            <Form.Item 
              name="bank_name" 
              label={t('createInvoiceModal.fields.bankName')}
            >
              <Input placeholder="Bangkok Bank" size="large" />
            </Form.Item>

            <Form.Item 
              name="bank_account_name" 
              label={t('createInvoiceModal.fields.accountHolder')}
            >
              <Input placeholder="John Doe" size="large" />
            </Form.Item>

            <Form.Item 
              name="bank_account_number" 
              label={t('createInvoiceModal.fields.accountNumber')}
            >
              <Input placeholder="123-4-56789-0" size="large" />
            </Form.Item>
          </Card>

          <Card 
            size="small" 
            title={t('createInvoiceModal.sections.summary')} 
            style={{ marginTop: 16, background: '#141414', border: '1px solid #303030' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row justify="space-between">
                <Col>{t('createInvoiceModal.summary.itemsCount')}:</Col>
                <Col style={{ fontWeight: 600 }}>
                  {items.filter(i => i.description).length}
                </Col>
              </Row>
              <Row justify="space-between">
                <Col>{t('createInvoiceModal.summary.totalAmount')}:</Col>
                <Col style={{ fontSize: '18px', fontWeight: 700, color: '#52c41a' }}>
                  {new Intl.NumberFormat('en-US').format(totals.total)} THB
                </Col>
              </Row>
            </Space>
          </Card>
        </div>
      </Form>

      <div style={{ 
        marginTop: 24, 
        display: 'flex', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Space>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>{t('createInvoiceModal.buttons.back')}</Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>{t('createInvoiceModal.buttons.next')}</Button>
          ) : (
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              {t('editInvoiceModal.buttons.save')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default EditInvoiceModal;