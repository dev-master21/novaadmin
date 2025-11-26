// frontend/src/modules/FinancialDocuments/components/EditReceiptModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  DatePicker,
  message,
  InputNumber,
  Row,
  Col,
  Card,
  Checkbox,
  Space
} from 'antd';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, CreateReceiptDTO, Receipt } from '@/api/financialDocuments.api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface EditReceiptModalProps {
  visible: boolean;
  receipt: Receipt | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditReceiptModal = ({ visible, receipt, onCancel, onSuccess }: EditReceiptModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  useEffect(() => {
    if (visible && receipt) {
      loadReceiptData();
    }
  }, [visible, receipt]);

  const loadReceiptData = async () => {
    if (!receipt) return;

    form.setFieldsValue({
      invoice_id: receipt.invoice_id,
      agreement_id: receipt.agreement_id,
      receipt_date: receipt.receipt_date ? dayjs(receipt.receipt_date) : undefined,
      amount_paid: receipt.amount_paid,
      payment_method: receipt.payment_method,
      notes: receipt.notes
    });

    // Загружаем позиции инвойса
    if (receipt.invoice_id) {
      await fetchInvoiceItems(receipt.invoice_id);
    }

    // Устанавливаем выбранные позиции
    if (receipt.items && receipt.items.length > 0) {
      const itemIds = receipt.items.map(item => item.invoice_item_id);
      setSelectedItems(itemIds);
    }
  };

  const fetchInvoiceItems = async (invoiceId: number) => {
    try {
      const response = await financialDocumentsApi.getInvoiceById(invoiceId);
      const invoice = response.data.data;
      setInvoiceItems(invoice.items || []);
    } catch (error: any) {
      message.error(t('editReceiptModal.messages.invoiceItemsLoadError'));
    }
  };

  const handleInvoiceChange = async (value: number) => {
    if (value) {
      await fetchInvoiceItems(value);
      setSelectedItems([]);
    } else {
      setInvoiceItems([]);
      setSelectedItems([]);
    }
  };

  const handleItemCheck = (itemId: number, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const handleSubmit = async () => {
    if (!receipt) return;

    try {
      setLoading(true);
      const values = await form.validateFields();

      const receiptData: Partial<CreateReceiptDTO> = {
        invoice_id: values.invoice_id,
        agreement_id: values.agreement_id || undefined,
        receipt_date: values.receipt_date ? dayjs(values.receipt_date).format('YYYY-MM-DD') : undefined,
        amount_paid: values.amount_paid,
        payment_method: values.payment_method,
        notes: values.notes,
        selected_items: selectedItems
      };

      await financialDocumentsApi.updateReceipt(receipt.id, receiptData);
      
      message.success(t('editReceiptModal.messages.updated'));
      onSuccess();
    } catch (error: any) {
      console.error('Error updating receipt:', error);
      message.error(error.response?.data?.message || t('editReceiptModal.messages.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('editReceiptModal.title')}
      open={visible}
      onCancel={onCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('common.cancel')}
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {t('editReceiptModal.buttons.save')}
        </Button>
      ]}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
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
            disabled
          >
            {/* Здесь можно добавить список инвойсов если нужно */}
          </Select>
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item 
              name="receipt_date" 
              label={t('createReceiptModal.fields.paymentDate')}
              rules={[{ required: true, message: t('createReceiptModal.validation.specifyDate') }]}
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
              rules={[{ required: true, message: t('createReceiptModal.validation.specifyAmount') }]}
            >
              <InputNumber<number>
                style={{ width: '100%' }}
                min={0}
                step={100}
                size="large"
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => {
                  const num = value ? parseFloat(value.replace(/,/g, '')) : 0;
                  return isNaN(num) ? 0 : num;
                }}
                addonAfter="THB"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item 
          name="payment_method" 
          label={t('createReceiptModal.fields.paymentMethod')}
          rules={[{ required: true, message: t('createReceiptModal.validation.selectPaymentMethod') }]}
        >
          <Select placeholder={t('createReceiptModal.placeholders.selectMethod')} size="large">
            <Option value="bank_transfer">{t('createReceiptModal.paymentMethods.bankTransfer')}</Option>
            <Option value="cash">{t('createReceiptModal.paymentMethods.cash')}</Option>
            <Option value="crypto">{t('createReceiptModal.paymentMethods.crypto')}</Option>
            <Option value="barter">{t('createReceiptModal.paymentMethods.barter')}</Option>
          </Select>
        </Form.Item>

        {invoiceItems.length > 0 && (
          <Card size="small" title={t('editReceiptModal.sections.paidItems')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {invoiceItems.map((item) => (
                <Checkbox
                  key={item.id}
                  checked={selectedItems.includes(item.id)}
                  onChange={(e) => handleItemCheck(item.id, e.target.checked)}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.description}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                      {item.quantity} x {new Intl.NumberFormat('en-US').format(item.unit_price)} THB = {new Intl.NumberFormat('en-US').format(item.total_price)} THB
                    </div>
                  </div>
                </Checkbox>
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
            placeholder={t('editReceiptModal.placeholders.receiptNotes')} 
            size="large"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditReceiptModal;