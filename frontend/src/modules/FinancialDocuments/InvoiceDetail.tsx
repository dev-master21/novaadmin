// frontend/src/modules/FinancialDocuments/InvoiceDetail.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Table,
  Tag,
  Divider,
  message,
  Modal,
  Row,
  Col,
  Statistic,
  Typography,
  Image
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  QrcodeOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Invoice, Receipt } from '@/api/financialDocuments.api';
import type { ColumnsType } from 'antd/es/table';
import './InvoiceDetail.css';
import EditInvoiceModal from './components/EditInvoiceModal';

const { Title, Text } = Typography;

const InvoiceDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getInvoiceById(Number(id));
      setInvoice(response.data.data);
    } catch (error: any) {
      message.error(t('invoiceDetail.messages.loadError'));
      navigate('/financial-documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('invoiceDetail.confirm.deleteTitle'),
      content: t('invoiceDetail.confirm.deleteDescription'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await financialDocumentsApi.deleteInvoice(Number(id));
          message.success(t('invoiceDetail.messages.deleted'));
          navigate('/financial-documents');
        } catch (error: any) {
          message.error(t('invoiceDetail.messages.deleteError'));
        }
      }
    });
  };

  const handleCopyLink = async () => {
    if (!invoice?.uuid) {
      message.error(t('invoiceDetail.messages.uuidNotFound'));
      return;
    }
    
    const link = `https://admin.novaestate.company/invoice-verify/${invoice.uuid}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success(t('invoiceDetail.messages.linkCopied'));
    } catch (error) {
      message.error(t('invoiceDetail.messages.linkCopyError'));
    }
  };

  const handleDownloadPDF = async () => {
    try {
      message.loading({ content: t('invoiceDetail.messages.generatingPDF'), key: 'pdf' });
      const response = await financialDocumentsApi.downloadInvoicePDF(Number(id));
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: t('invoiceDetail.messages.pdfDownloaded'), key: 'pdf' });
    } catch (error: any) {
      message.error({ content: t('invoiceDetail.messages.pdfDownloadError'), key: 'pdf' });
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: t('invoiceDetail.statuses.draft') },
      sent: { color: 'processing', text: t('invoiceDetail.statuses.sent') },
      partially_paid: { color: 'warning', text: t('invoiceDetail.statuses.partiallyPaid') },
      paid: { color: 'success', text: t('invoiceDetail.statuses.paid') },
      overdue: { color: 'error', text: t('invoiceDetail.statuses.overdue') },
      cancelled: { color: 'default', text: t('invoiceDetail.statuses.cancelled') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: t('invoiceDetail.paymentMethods.bank'),
      cash: t('invoiceDetail.paymentMethods.cash'),
      crypto: t('invoiceDetail.paymentMethods.crypto'),
      barter: t('invoiceDetail.paymentMethods.barter')
    };
    return methods[method] || method;
  };

  const getReceiptStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: t('invoiceDetail.receiptStatuses.pending') },
      verified: { color: 'success', text: t('invoiceDetail.receiptStatuses.verified') },
      rejected: { color: 'error', text: t('invoiceDetail.receiptStatuses.rejected') }
    };
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const itemColumns: ColumnsType<any> = [
    {
      title: t('invoiceDetail.table.items.number'),
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1,
      responsive: ['md']
    },
    {
      title: t('invoiceDetail.table.items.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('invoiceDetail.table.items.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
      responsive: ['md']
    },
    {
      title: t('invoiceDetail.table.items.price'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      align: 'right',
      render: (price) => `${formatCurrency(price)} THB`,
      responsive: ['lg']
    },
    {
      title: t('invoiceDetail.table.items.total'),
      dataIndex: 'total_price',
      key: 'total_price',
      width: 140,
      align: 'right',
      render: (price) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(price)} THB
        </span>
      )
    }
  ];

  const receiptColumns: ColumnsType<Receipt> = [
    {
      title: t('invoiceDetail.table.receipts.receiptNumber'),
      dataIndex: 'receipt_number',
      key: 'receipt_number',
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/financial-documents/receipts/${record.id}`)}
        >
          {text}
        </Button>
      )
    },
    {
      title: t('invoiceDetail.table.receipts.date'),
      dataIndex: 'receipt_date',
      key: 'receipt_date',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
      responsive: ['md']
    },
    {
      title: t('invoiceDetail.table.receipts.amount'),
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      width: 140,
      align: 'right',
      render: (amount) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          {formatCurrency(amount)} THB
        </span>
      )
    },
    {
      title: t('invoiceDetail.table.receipts.method'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 150,
      render: (method) => getPaymentMethodText(method),
      responsive: ['lg']
    },
    {
      title: t('invoiceDetail.table.receipts.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getReceiptStatusTag(status),
      responsive: ['md']
    }
  ];

  if (!invoice) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        {loading ? t('invoiceDetail.loading') : t('invoiceDetail.notFound')}
      </div>
    );
  }

  return (
    <div className="invoice-detail-container">
      <div className="mobile-back-button">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/financial-documents')}
          block
        >
          {t('invoiceDetail.buttons.backToList')}
        </Button>
      </div>

      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>{t('invoiceDetail.title')} {invoice.invoice_number}</span>
            {getStatusTag(invoice.status)}
          </Space>
        }
        extra={
          <Space wrap className="detail-actions">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/financial-documents')}
              className="desktop-only"
            >
              {t('invoiceDetail.buttons.back')}
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditModalVisible(true)}
            >
              <span className="button-text">{t('invoiceDetail.buttons.edit')}</span>
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={handleCopyLink}
            >
              <span className="button-text">{t('invoiceDetail.buttons.copyLink')}</span>
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadPDF}
            >
              <span className="button-text">{t('invoiceDetail.buttons.downloadPDF')}</span>
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              <span className="button-text">{t('common.delete')}</span>
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={t('invoiceDetail.stats.totalAmount')}
                value={invoice.total_amount}
                suffix="THB"
                valueStyle={{ color: '#1890ff' }}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={t('invoiceDetail.stats.paid')}
                value={invoice.amount_paid}
                suffix="THB"
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title={t('invoiceDetail.stats.remaining')}
                value={invoice.total_amount - invoice.amount_paid}
                suffix="THB"
                valueStyle={{ color: '#faad14' }}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
        </Row>

        <Descriptions 
          title={t('invoiceDetail.sections.mainInfo')} 
          bordered 
          column={{ xs: 1, sm: 2, md: 2 }}
          size="small"
        >
          <Descriptions.Item label={t('invoiceDetail.fields.invoiceDate')}>
            {new Date(invoice.invoice_date).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
          <Descriptions.Item label={t('invoiceDetail.fields.dueDate')}>
            {invoice.due_date 
              ? new Date(invoice.due_date).toLocaleDateString('ru-RU')
              : t('invoiceDetail.notSpecified')
            }
          </Descriptions.Item>
          {invoice.agreement_number && (
            <Descriptions.Item label={t('invoiceDetail.fields.agreement')}>
              <Button 
                type="link" 
                size="small"
                onClick={() => navigate(`/agreements/${invoice.agreement_id}`)}
              >
                {invoice.agreement_number}
              </Button>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('invoiceDetail.fields.created')}>
            {new Date(invoice.created_at).toLocaleDateString('ru-RU')}{' '}
            {invoice.created_by_name && `(${invoice.created_by_name})`}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card size="small" title={t('invoiceDetail.sections.from')} style={{ marginBottom: 16 }}>
              {invoice.from_type === 'company' ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('invoiceDetail.fields.company')}>
                    {invoice.from_company_name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.taxId')}>
                    {invoice.from_company_tax_id}
                  </Descriptions.Item>
                  {invoice.from_company_address && (
                    <Descriptions.Item label={t('invoiceDetail.fields.address')}>
                      {invoice.from_company_address}
                    </Descriptions.Item>
                  )}
                  {invoice.from_director_name && (
                    <Descriptions.Item label={t('invoiceDetail.fields.director')}>
                      {invoice.from_director_name}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('invoiceDetail.fields.fullName')}>
                    {invoice.from_individual_name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.country')}>
                    {invoice.from_individual_country}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.passport')}>
                    {invoice.from_individual_passport}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" title={t('invoiceDetail.sections.to')} style={{ marginBottom: 16 }}>
              {invoice.to_type === 'company' ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('invoiceDetail.fields.company')}>
                    {invoice.to_company_name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.taxId')}>
                    {invoice.to_company_tax_id}
                  </Descriptions.Item>
                  {invoice.to_company_address && (
                    <Descriptions.Item label={t('invoiceDetail.fields.address')}>
                      {invoice.to_company_address}
                    </Descriptions.Item>
                  )}
                  {invoice.to_director_name && (
                    <Descriptions.Item label={t('invoiceDetail.fields.director')}>
                      {invoice.to_director_name}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('invoiceDetail.fields.fullName')}>
                    {invoice.to_individual_name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.country')}>
                    {invoice.to_individual_country}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('invoiceDetail.fields.passport')}>
                    {invoice.to_individual_passport}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>
        </Row>

        <Divider />

        <Title level={5}>{t('invoiceDetail.sections.items')}</Title>
        <Table
          columns={itemColumns}
          dataSource={invoice.items || []}
          rowKey="id"
          pagination={false}
          scroll={{ x: 600 }}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right">
                  <strong>{t('invoiceDetail.summary.subtotal')}:</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong>{formatCurrency(invoice.subtotal)} THB</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              {invoice.tax_amount > 0 && (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right">
                    <strong>{t('invoiceDetail.summary.tax')}:</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong>{formatCurrency(invoice.tax_amount)} THB</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right">
                  <strong style={{ fontSize: '16px' }}>{t('invoiceDetail.summary.total')}:</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong style={{ fontSize: '16px', color: '#52c41a' }}>
                    {formatCurrency(invoice.total_amount)} THB
                  </strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        {(invoice.bank_name || invoice.bank_account_name || invoice.bank_account_number) && (
          <>
            <Divider />
            <Card size="small" title={t('invoiceDetail.sections.bankDetails')}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                {invoice.bank_name && (
                  <Descriptions.Item label={t('invoiceDetail.fields.bank')}>
                    {invoice.bank_name}
                  </Descriptions.Item>
                )}
                {invoice.bank_account_name && (
                  <Descriptions.Item label={t('invoiceDetail.fields.accountHolder')}>
                    {invoice.bank_account_name}
                  </Descriptions.Item>
                )}
                {invoice.bank_account_number && (
                  <Descriptions.Item label={t('invoiceDetail.fields.accountNumber')} span={2}>
                    {invoice.bank_account_number}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </>
        )}

        {invoice.qr_code_base64 && (
          <>
            <Divider />
            <Card size="small" title={<><QrcodeOutlined /> {t('invoiceDetail.sections.qrCode')}</>}>
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={invoice.qr_code_base64}
                  alt="QR Code"
                  style={{ maxWidth: '200px' }}
                  preview={false}
                />
              </div>
            </Card>
          </>
        )}

        {invoice.receipts && invoice.receipts.length > 0 && (
          <>
            <Divider />
            <Title level={5}>{t('invoiceDetail.sections.paymentHistory')}</Title>
            <Table
              columns={receiptColumns}
              dataSource={invoice.receipts}
              rowKey="id"
              pagination={false}
              scroll={{ x: 600 }}
            />
          </>
        )}

        {invoice.notes && (
          <>
            <Divider />
            <Card size="small" title={t('invoiceDetail.sections.notes')}>
              <Text>{invoice.notes}</Text>
            </Card>
          </>
        )}
      </Card>

      <EditInvoiceModal
        visible={editModalVisible}
        invoice={invoice}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchInvoice();
        }}
      />
    </div>
  );
};

export default InvoiceDetail;