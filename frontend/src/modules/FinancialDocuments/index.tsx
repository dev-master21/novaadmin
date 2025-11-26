// frontend/src/modules/FinancialDocuments/index.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Button,
  Table,
  Space,
  Tag,
  Input,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FileTextOutlined,
  DollarOutlined,
  MoreOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Invoice, Receipt } from '@/api/financialDocuments.api';
import CreateInvoiceModal from './components/CreateInvoiceModal';
import CreateReceiptModal from './components/CreateReceiptModal';
import dayjs from 'dayjs';

const { Option } = Select;

const FinancialDocuments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts'>('invoices');
  
  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  
  // Receipts state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptStatus, setReceiptStatus] = useState<string>('');
  
  // Modals
  const [createInvoiceModalVisible, setCreateInvoiceModalVisible] = useState(false);
  const [createReceiptModalVisible, setCreateReceiptModalVisible] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    totalAmount: 0,
    amountReceived: 0
  });

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices();
    } else {
      fetchReceipts();
    }
  }, [activeTab, invoiceSearch, invoiceStatus, receiptSearch, receiptStatus]);

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const response = await financialDocumentsApi.getAllInvoices({
        status: invoiceStatus || undefined,
        search: invoiceSearch || undefined
      });
      setInvoices(response.data.data);
      
      // Calculate stats
      const total = response.data.data.reduce((sum, inv) => sum + inv.total_amount, 0);
      const received = response.data.data.reduce((sum, inv) => sum + inv.amount_paid, 0);
      const paid = response.data.data.filter(inv => inv.status === 'paid').length;
      
      setStats({
        totalInvoices: response.data.data.length,
        paidInvoices: paid,
        totalAmount: total,
        amountReceived: received
      });
    } catch (error: any) {
      message.error(t('financialDocuments.messages.invoicesLoadError'));
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const response = await financialDocumentsApi.getAllReceipts({
        status: receiptStatus || undefined,
        search: receiptSearch || undefined
      });
      setReceipts(response.data.data);
    } catch (error: any) {
      message.error(t('financialDocuments.messages.receiptsLoadError'));
    } finally {
      setLoadingReceipts(false);
    }
  };

  const handleDownloadInvoicePDF = async (id: number) => {
    try {
      const response = await financialDocumentsApi.downloadInvoicePDF(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success(t('financialDocuments.messages.pdfDownloaded'));
    } catch (error: any) {
      message.error(t('financialDocuments.messages.pdfDownloadError'));
    }
  };

  const handleDownloadReceiptPDF = async (id: number) => {
    try {
      const response = await financialDocumentsApi.downloadReceiptPDF(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success(t('financialDocuments.messages.pdfDownloaded'));
    } catch (error: any) {
      message.error(t('financialDocuments.messages.pdfDownloadError'));
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    try {
      await financialDocumentsApi.deleteInvoice(id);
      message.success(t('financialDocuments.messages.invoiceDeleted'));
      fetchInvoices();
    } catch (error: any) {
      message.error(t('financialDocuments.messages.invoiceDeleteError'));
    }
  };

  const handleDeleteReceipt = async (id: number) => {
    try {
      await financialDocumentsApi.deleteReceipt(id);
      message.success(t('financialDocuments.messages.receiptDeleted'));
      fetchReceipts();
    } catch (error: any) {
      message.error(t('financialDocuments.messages.receiptDeleteError'));
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: t('financialDocuments.statuses.draft') },
      sent: { color: 'blue', text: t('financialDocuments.statuses.sent') },
      partially_paid: { color: 'orange', text: t('financialDocuments.statuses.partiallyPaid') },
      paid: { color: 'green', text: t('financialDocuments.statuses.paid') },
      overdue: { color: 'red', text: t('financialDocuments.statuses.overdue') },
      cancelled: { color: 'default', text: t('financialDocuments.statuses.cancelled') },
      pending: { color: 'orange', text: t('financialDocuments.statuses.pending') },
      verified: { color: 'green', text: t('financialDocuments.statuses.verified') },
      rejected: { color: 'red', text: t('financialDocuments.statuses.rejected') }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: t('financialDocuments.paymentMethods.bankTransfer'),
      cash: t('financialDocuments.paymentMethods.cash'),
      crypto: t('financialDocuments.paymentMethods.crypto'),
      barter: t('financialDocuments.paymentMethods.barter')
    };
    return methods[method] || method;
  };

  const invoiceColumns = [
    {
      title: t('financialDocuments.table.invoices.number'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string, record: Invoice) => (
        <a onClick={() => navigate(`/financial-documents/invoices/${record.id}`)}>
          {text}
        </a>
      )
    },
    {
      title: t('financialDocuments.table.invoices.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: t('financialDocuments.table.invoices.agreement'),
      dataIndex: 'agreement_number',
      key: 'agreement_number',
      render: (text: string) => text || '-'
    },
    {
      title: t('financialDocuments.table.invoices.amount'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} THB`
    },
    {
      title: t('financialDocuments.table.invoices.paid'),
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      render: (amount: number, record: Invoice) => (
        <div>
          <div>{new Intl.NumberFormat('en-US').format(amount)} THB</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {Math.round((amount / record.total_amount) * 100)}%
          </div>
        </div>
      )
    },
    {
      title: t('financialDocuments.table.invoices.date'),
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY')
    },
    {
      title: t('financialDocuments.table.invoices.actions'),
      key: 'actions',
      render: (_: any, record: Invoice) => {
        const items: MenuProps['items'] = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: t('financialDocuments.actions.view'),
            onClick: () => navigate(`/financial-documents/invoices/${record.id}`)
          },
          {
            key: 'download',
            icon: <DownloadOutlined />,
            label: t('financialDocuments.actions.downloadPDF'),
            onClick: () => handleDownloadInvoicePDF(record.id)
          },
          {
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('common.delete'),
            danger: true,
            onClick: () => handleDeleteInvoice(record.id)
          }
        ];

        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      }
    }
  ];

  const receiptColumns = [
    {
      title: t('financialDocuments.table.receipts.number'),
      dataIndex: 'receipt_number',
      key: 'receipt_number',
      render: (text: string, record: Receipt) => (
        <a onClick={() => navigate(`/financial-documents/receipts/${record.id}`)}>
          {text}
        </a>
      )
    },
    {
      title: t('financialDocuments.table.receipts.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: t('financialDocuments.table.receipts.invoice'),
      dataIndex: 'invoice_number',
      key: 'invoice_number'
    },
    {
      title: t('financialDocuments.table.receipts.amount'),
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      render: (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} THB`
    },
    {
      title: t('financialDocuments.table.receipts.paymentMethod'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => getPaymentMethodText(method)
    },
    {
      title: t('financialDocuments.table.receipts.date'),
      dataIndex: 'receipt_date',
      key: 'receipt_date',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY')
    },
    {
      title: t('financialDocuments.table.receipts.actions'),
      key: 'actions',
      render: (_: any, record: Receipt) => {
        const items: MenuProps['items'] = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: t('financialDocuments.actions.view'),
            onClick: () => navigate(`/financial-documents/receipts/${record.id}`)
          },
          {
            key: 'download',
            icon: <DownloadOutlined />,
            label: t('financialDocuments.actions.downloadPDF'),
            onClick: () => handleDownloadReceiptPDF(record.id)
          },
          {
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('common.delete'),
            danger: true,
            onClick: () => handleDeleteReceipt(record.id)
          }
        ];

        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      }
    }
  ];

  return (
      <div className="financial-documents-page">
        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('financialDocuments.stats.totalInvoices')}
                value={stats.totalInvoices}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('financialDocuments.stats.paidInvoices')}
                value={stats.paidInvoices}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('financialDocuments.stats.totalAmount')}
                value={stats.totalAmount}
                formatter={(value) => new Intl.NumberFormat('en-US', { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                }).format(value as number)}
                prefix={<DollarOutlined />}
                suffix="THB"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('financialDocuments.stats.amountReceived')}
                value={stats.amountReceived}
                formatter={(value) => new Intl.NumberFormat('en-US', { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                }).format(value as number)}
                prefix={<DollarOutlined />}
                suffix="THB"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title={<span style={{ fontSize: '18px', fontWeight: 600 }}>{t('financialDocuments.title')}</span>}
          className="financial-documents-card"
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'invoices' | 'receipts')}
            items={[
              {
                key: 'invoices',
                label: (
                  <span>
                    <FileTextOutlined /> {t('financialDocuments.tabs.invoices')}
                  </span>
                ),
                children: (
                  <>
                    <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Input
                          placeholder={t('financialDocuments.search')}
                          prefix={<SearchOutlined />}
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          style={{ width: 250 }}
                          allowClear
                        />
                        <Select
                          placeholder={t('financialDocuments.filters.status')}
                          value={invoiceStatus}
                          onChange={setInvoiceStatus}
                          style={{ width: 200 }}
                          allowClear
                        >
                          <Option value="">{t('financialDocuments.filters.all')}</Option>
                          <Option value="draft">{t('financialDocuments.statuses.draft')}</Option>
                          <Option value="sent">{t('financialDocuments.statuses.sent')}</Option>
                          <Option value="partially_paid">{t('financialDocuments.statuses.partiallyPaid')}</Option>
                          <Option value="paid">{t('financialDocuments.statuses.paid')}</Option>
                          <Option value="overdue">{t('financialDocuments.statuses.overdue')}</Option>
                          <Option value="cancelled">{t('financialDocuments.statuses.cancelled')}</Option>
                        </Select>
                      </Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateInvoiceModalVisible(true)}
                      >
                        {t('financialDocuments.buttons.createInvoice')}
                      </Button>
                    </Space>
                    <Table
                      columns={invoiceColumns}
                      dataSource={invoices}
                      rowKey="id"
                      loading={loadingInvoices}
                      pagination={{ pageSize: 20 }}
                    />
                  </>
                )
              },
              {
                key: 'receipts',
                label: (
                  <span>
                    <DollarOutlined /> {t('financialDocuments.tabs.receipts')}
                  </span>
                ),
                children: (
                  <>
                    <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Input
                          placeholder={t('financialDocuments.search')}
                          prefix={<SearchOutlined />}
                          value={receiptSearch}
                          onChange={(e) => setReceiptSearch(e.target.value)}
                          style={{ width: 250 }}
                          allowClear
                        />
                        <Select
                          placeholder={t('financialDocuments.filters.status')}
                          value={receiptStatus}
                          onChange={setReceiptStatus}
                          style={{ width: 200 }}
                          allowClear
                        >
                          <Option value="">{t('financialDocuments.filters.all')}</Option>
                          <Option value="pending">{t('financialDocuments.statuses.pending')}</Option>
                          <Option value="verified">{t('financialDocuments.statuses.verified')}</Option>
                          <Option value="rejected">{t('financialDocuments.statuses.rejected')}</Option>
                        </Select>
                      </Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateReceiptModalVisible(true)}
                      >
                        {t('financialDocuments.buttons.createReceipt')}
                      </Button>
                    </Space>
                    <Table
                      columns={receiptColumns}
                      dataSource={receipts}
                      rowKey="id"
                      loading={loadingReceipts}
                      pagination={{ pageSize: 20 }}
                    />
                  </>
                )
              }
            ]}
          />
        </Card>

        {/* Modals */}
        <CreateInvoiceModal
          visible={createInvoiceModalVisible}
          onCancel={() => setCreateInvoiceModalVisible(false)}
          onSuccess={() => {
            setCreateInvoiceModalVisible(false);
            fetchInvoices();
          }}
        />

        <CreateReceiptModal
          visible={createReceiptModalVisible}
          onCancel={() => setCreateReceiptModalVisible(false)}
          onSuccess={() => {
            setCreateReceiptModalVisible(false);
            fetchReceipts();
          }}
        />
      </div>
  );
};

export default FinancialDocuments;