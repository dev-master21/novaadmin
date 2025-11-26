// frontend/src/modules/FinancialDocuments/components/CreateReceiptModal.tsx
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
  InputNumber,
  Checkbox,
  Upload,
  Image,
  Alert
} from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, CreateReceiptDTO, Invoice, InvoiceItem } from '@/api/financialDocuments.api';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import dayjs from 'dayjs';
import './CreateReceiptModal.css';

const { Option } = Select;
const { TextArea } = Input;

interface CreateReceiptModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  invoiceId?: number;
}

const CreateReceiptModal = ({ visible, onCancel, onSuccess, invoiceId }: CreateReceiptModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: UploadFile; preview: string }>>([]);

  useEffect(() => {
    if (visible) {
      fetchAgreements();
      resetForm();
      
      if (invoiceId) {
        loadInvoiceData(invoiceId);
      }
    }
  }, [visible, invoiceId]);

  const fetchAgreements = async () => {
    try {
      const response = await agreementsApi.getAll({ limit: 100 });
      setAgreements(response.data.data);
    } catch (error: any) {
      message.error(t('createReceiptModal.messages.agreementsLoadError'));
    }
  };

  const loadInvoiceData = async (id: number) => {
    try {
      const response = await financialDocumentsApi.getInvoiceById(id);
      const invoice = response.data.data;
      setSelectedInvoice(invoice);
      form.setFieldValue('invoice_id', invoice.id);
      form.setFieldValue('agreement_id', invoice.agreement_id);
      
      // Автоматически выбираем все неоплаченные позиции
      if (invoice.items) {
        setSelectedItems(invoice.items.map(item => item.id!));
      }
    } catch (error: any) {
      message.error(t('createReceiptModal.messages.invoiceLoadError'));
    }
  };

  const handleAgreementChange = async (agreementId: number) => {
    try {
      const response = await financialDocumentsApi.getInvoicesByAgreement(agreementId);
      setInvoices(response.data.data);
      setSelectedInvoice(null);
      setSelectedItems([]);
      form.setFieldValue('invoice_id', undefined);
    } catch (error: any) {
      message.error(t('createReceiptModal.messages.invoicesLoadError'));
    }
  };

  const handleInvoiceChange = async (invoiceId: number) => {
    try {
      const response = await financialDocumentsApi.getInvoiceById(invoiceId);
      const invoice = response.data.data;
      setSelectedInvoice(invoice);
      
      // Автоматически выбираем все позиции
      if (invoice.items) {
        setSelectedItems(invoice.items.map(item => item.id!));
      }
      
      // Предзаполняем сумму оплаты (остаток к оплате)
      const remaining = invoice.total_amount - invoice.amount_paid;
      form.setFieldValue('amount_paid', remaining);
    } catch (error: any) {
      message.error(t('createReceiptModal.messages.invoiceLoadError'));
    }
  };

  const handleFileUpload = (file: UploadFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newFile = { 
        file: file, 
        preview: e.target?.result as string
      };
      setUploadedFiles([...uploadedFiles, newFile]);
    };
    reader.readAsDataURL(file as any);
    return false;
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
    form.resetFields();
    form.setFieldValue('receipt_date', dayjs());
    form.setFieldValue('payment_method', 'bank_transfer');
  };

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['agreement_id', 'invoice_id', 'receipt_date', 'amount_paid', 'payment_method']);
        
        if (selectedItems.length === 0) {
          message.error(t('createReceiptModal.validation.selectAtLeastOneItem'));
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

      if (selectedItems.length === 0) {
        message.error(t('createReceiptModal.validation.selectAtLeastOneItem'));
        setLoading(false);
        return;
      }

      const receiptData: CreateReceiptDTO = {
        invoice_id: values.invoice_id,
        agreement_id: values.agreement_id || undefined,
        receipt_date: dayjs(values.receipt_date).format('YYYY-MM-DD'),
        amount_paid: values.amount_paid,
        payment_method: values.payment_method,
        notes: values.notes,
        selected_items: selectedItems
      };

      const response = await financialDocumentsApi.createReceipt(receiptData);
      const receiptId = response.data.data.id;

      // Загружаем файлы если есть
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        uploadedFiles.forEach((fileObj, index) => {
          formData.append(`file_${index}`, fileObj.file as any);
        });

        try {
          await financialDocumentsApi.uploadReceiptFiles(receiptId, formData);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          message.warning(t('createReceiptModal.messages.createdButFilesNotUploaded'));
        }
      }

      message.success(t('createReceiptModal.messages.created'));
      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error('Error creating receipt:', error);
      message.error(error.response?.data?.message || t('createReceiptModal.messages.createError'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: t('createReceiptModal.steps.basic'), icon: <FileTextOutlined /> },
    { title: t('createReceiptModal.steps.files'), icon: <UploadOutlined /> }
  ];

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
      title={t('createReceiptModal.title')}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
      className="create-receipt-modal dark-theme"
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
                label={t('createReceiptModal.fields.agreement')}
                rules={[{ required: true, message: t('createReceiptModal.validation.selectAgreement') }]}
              >
                <Select
                  placeholder={t('createReceiptModal.placeholders.selectAgreement')}
                  showSearch
                  optionFilterProp="children"
                  size="large"
                  onChange={handleAgreementChange}
                  disabled={!!invoiceId}
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
                name="invoice_id" 
                label={t('createReceiptModal.fields.invoice')}
                rules={[{ required: true, message: t('createReceiptModal.validation.selectInvoice') }]}
              >
                <Select
                  placeholder={t('createReceiptModal.placeholders.selectInvoice')}
                  showSearch
                  optionFilterProp="children"
                  size="large"
                  onChange={handleInvoiceChange}
                  disabled={invoices.length === 0 || !!invoiceId}
                >
                  {invoices.map(invoice => (
                    <Option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {formatCurrency(invoice.total_amount - invoice.amount_paid)} THB {t('createReceiptModal.remaining')}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {selectedInvoice && (
            <Alert
              message={t('createReceiptModal.invoiceInfo.title')}
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>{t('createReceiptModal.invoiceInfo.totalAmount')}:</strong> {formatCurrency(selectedInvoice.total_amount)} THB
                  </div>
                  <div>
                    <strong>{t('createReceiptModal.invoiceInfo.alreadyPaid')}:</strong> {formatCurrency(selectedInvoice.amount_paid)} THB
                  </div>
                  <div>
                    <strong>{t('createReceiptModal.invoiceInfo.remainingToPay')}:</strong>{' '}
                    <span style={{ color: '#faad14', fontWeight: 600 }}>
                      {formatCurrency(remainingAmount)} THB
                    </span>
                  </div>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item 
                name="receipt_date" 
                label={t('createReceiptModal.fields.paymentDate')}
                rules={[{ required: true, message: t('createReceiptModal.validation.specifyDate') }]}
                initialValue={dayjs()}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="DD.MM.YYYY" 
                  size="large"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item 
                name="amount_paid" 
                label={t('createReceiptModal.fields.paymentAmount')}
                rules={[
                  { required: true, message: t('createReceiptModal.validation.specifyAmount') },
                  {
                    validator: (_, value) => {
                      if (selectedInvoice && value > remainingAmount) {
                        return Promise.reject(t('createReceiptModal.validation.amountExceedsRemaining'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0"
                  min={0.01}
                  max={remainingAmount || undefined}
                  step={100}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => parseFloat(value!.replace(/,/g, ''))}
                  addonAfter="THB"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            name="payment_method" 
            label={t('createReceiptModal.fields.paymentMethod')}
            rules={[{ required: true, message: t('createReceiptModal.validation.selectPaymentMethod') }]}
            initialValue="bank_transfer"
          >
            <Select size="large" placeholder={t('createReceiptModal.placeholders.selectMethod')}>
              <Option value="bank_transfer">{t('createReceiptModal.paymentMethods.bankTransfer')}</Option>
              <Option value="cash">{t('createReceiptModal.paymentMethods.cash')}</Option>
              <Option value="crypto">{t('createReceiptModal.paymentMethods.crypto')}</Option>
              <Option value="barter">{t('createReceiptModal.paymentMethods.barter')}</Option>
            </Select>
          </Form.Item>

          {/* Выбор позиций для оплаты */}
          {selectedInvoice && selectedInvoice.items && selectedInvoice.items.length > 0 && (
            <Card 
              size="small" 
              title={t('createReceiptModal.sections.selectItems')} 
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={selectedItems.length === selectedInvoice.items.length}
                  indeterminate={
                    selectedItems.length > 0 && 
                    selectedItems.length < selectedInvoice.items.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems(selectedInvoice.items!.map(item => item.id!));
                    } else {
                      setSelectedItems([]);
                    }
                  }}
                  style={{ fontWeight: 600 }}
                >
                  {t('createReceiptModal.selectAll')}
                </Checkbox>

                {selectedInvoice.items.map((item: InvoiceItem) => (
                  <Card 
                    key={item.id} 
                    size="small"
                    style={{ 
                      background: '#141414', 
                      border: selectedItems.includes(item.id!) ? '1px solid #1890ff' : '1px solid #303030'
                    }}
                  >
                    <Checkbox
                      checked={selectedItems.includes(item.id!)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id!]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                    >
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <div style={{ fontWeight: 600 }}>{item.description}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                          {item.quantity} x {formatCurrency(item.unit_price)} THB = {formatCurrency(item.total_price)} THB
                        </div>
                      </Space>
                    </Checkbox>
                  </Card>
                ))}
              </Space>
            </Card>
          )}

          <Form.Item 
            name="notes" 
            label={t('createReceiptModal.fields.notes')}
          >
            <TextArea 
              rows={3} 
              placeholder={t('createReceiptModal.placeholders.notes')} 
              size="large"
            />
          </Form.Item>
        </div>

        {/* Шаг 2: Загрузка файлов */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <Alert
            message={t('createReceiptModal.fileUpload.title')}
            description={t('createReceiptModal.fileUpload.description')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Row gutter={[8, 8]}>
                {uploadedFiles.map((fileObj, index) => (
                  <Col key={index} xs={12} sm={8} md={6}>
                    <div style={{ 
                      position: 'relative',
                      border: '1px solid #303030',
                      borderRadius: '4px',
                      padding: '8px',
                      background: '#141414'
                    }}>
                      <Image
                        src={fileObj.preview}
                        alt={`File ${index + 1}`}
                        style={{ 
                          width: '100%', 
                          height: '120px', 
                          objectFit: 'cover',
                          borderRadius: '2px'
                        }}
                      />
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeFile(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          minWidth: 'auto',
                          padding: '4px 8px'
                        }}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          )}

          <Upload
            accept="image/*"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            maxCount={10}
            multiple
          >
            <Button 
              icon={<UploadOutlined />} 
              block
              size="large"
              type={uploadedFiles.length > 0 ? 'dashed' : 'default'}
            >
              {uploadedFiles.length > 0 
                ? t('createReceiptModal.fileUpload.uploadedMore', { count: uploadedFiles.length })
                : t('createReceiptModal.fileUpload.uploadButton')}
            </Button>
          </Upload>

          {/* Итоговая информация */}
          <Card 
            size="small" 
            title={t('createReceiptModal.sections.summary')} 
            style={{ 
              marginTop: 16, 
              background: '#141414', 
              border: '1px solid #303030' 
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row justify="space-between">
                <Col>{t('createReceiptModal.summary.paymentAmount')}:</Col>
                <Col style={{ fontSize: '18px', fontWeight: 700, color: '#52c41a' }}>
                  {formatCurrency(form.getFieldValue('amount_paid') || 0)} THB
                </Col>
              </Row>
              <Row justify="space-between">
                <Col>{t('createReceiptModal.summary.paymentMethod')}:</Col>
                <Col style={{ fontWeight: 600 }}>
                  {getPaymentMethodText(form.getFieldValue('payment_method'))}
                </Col>
              </Row>
              <Row justify="space-between">
                <Col>{t('createReceiptModal.summary.itemsPaid')}:</Col>
                <Col style={{ fontWeight: 600 }}>
                  {selectedItems.length}
                </Col>
              </Row>
              <Row justify="space-between">
                <Col>{t('createReceiptModal.summary.filesAttached')}:</Col>
                <Col style={{ fontWeight: 600 }}>
                  {uploadedFiles.length}
                </Col>
              </Row>
            </Space>
          </Card>
        </div>
      </Form>

      {/* Футер с кнопками навигации */}
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
            <Button onClick={handlePrev}>{t('createReceiptModal.buttons.back')}</Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>{t('createReceiptModal.buttons.next')}</Button>
          ) : (
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={loading}
              icon={<CheckCircleOutlined />}
            >
              {t('createReceiptModal.buttons.create')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default CreateReceiptModal;