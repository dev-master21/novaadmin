// frontend/src/modules/FinancialDocuments/components/ReceiptsList.tsx
import {
  Table,
  Button,
  Tag,
  Space,
  Dropdown,
  Modal,
  message,
  Card
} from 'antd';
import {
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileImageOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Receipt } from '@/api/financialDocuments.api';
import type { ColumnsType } from 'antd/es/table';

interface ReceiptsListProps {
  receipts: Receipt[];
  loading: boolean;
  onRefresh: () => void;
}

const ReceiptsList = ({ receipts, loading, onRefresh }: ReceiptsListProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: t('receiptsList.confirm.deleteTitle'),
      content: t('receiptsList.confirm.deleteDescription'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await financialDocumentsApi.deleteReceipt(id);
          message.success(t('receiptsList.messages.deleted'));
          onRefresh();
        } catch (error: any) {
          message.error(error.response?.data?.message || t('receiptsList.messages.deleteError'));
        }
      }
    });
  };

  const handleCopyLink = async (uuid: string) => {
    const link = `https://admin.novaestate.company/receipt-verify/${uuid}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success(t('receiptsList.messages.linkCopied'));
    } catch (error) {
      message.error(t('receiptsList.messages.linkCopyError'));
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: t('receiptsList.statuses.pending') },
      verified: { color: 'success', text: t('receiptsList.statuses.verified') },
      rejected: { color: 'error', text: t('receiptsList.statuses.rejected') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPaymentMethodTag = (method: string) => {
    const methodConfig: Record<string, { color: string; text: string }> = {
      bank_transfer: { color: 'blue', text: t('createReceiptModal.paymentMethods.bankTransfer') },
      cash: { color: 'green', text: t('createReceiptModal.paymentMethods.cash') },
      crypto: { color: 'purple', text: t('createReceiptModal.paymentMethods.crypto') },
      barter: { color: 'orange', text: t('createReceiptModal.paymentMethods.barter') }
    };
    
    const config = methodConfig[method] || { color: 'default', text: method };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const columns: ColumnsType<Receipt> = [
    {
      title: t('receiptsList.table.number'),
      dataIndex: 'receipt_number',
      key: 'receipt_number',
      width: 180,
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/financial-documents/receipts/${record.id}`)}
        >
          {text}
        </Button>
      ),
      responsive: ['md']
    },
    {
      title: t('receiptsList.table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
      responsive: ['md']
    },
    {
      title: t('receiptsList.table.invoice'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 180,
      render: (text, record) => (
        text ? (
          <Button 
            type="link" 
            size="small"
            onClick={() => navigate(`/financial-documents/invoices/${record.invoice_id}`)}
          >
            {text}
          </Button>
        ) : '-'
      ),
      responsive: ['lg']
    },
    {
      title: t('receiptsList.table.amountPaid'),
      dataIndex: 'amount_paid',
      key: 'amount_paid',
      width: 150,
      render: (amount) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          {formatCurrency(amount)} THB
        </span>
      ),
      responsive: ['md']
    },
    {
      title: t('receiptsList.table.paymentMethod'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 150,
      render: (method) => getPaymentMethodTag(method),
      responsive: ['lg']
    },
    {
      title: t('receiptsList.table.files'),
      key: 'files',
      width: 80,
      align: 'center',
      render: (_, record) => (
        record.files_count && record.files_count > 0 ? (
          <Tag icon={<FileImageOutlined />} color="cyan">
            {record.files_count}
          </Tag>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      ),
      responsive: ['xl']
    },
    {
      title: t('receiptsList.table.date'),
      dataIndex: 'receipt_date',
      key: 'receipt_date',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
      responsive: ['lg']
    },
    {
      title: t('receiptsList.table.actions'),
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: t('receiptsList.actions.view'),
                onClick: () => navigate(`/financial-documents/receipts/${record.id}`)
              },
              {
                key: 'copy-link',
                icon: <LinkOutlined />,
                label: t('receiptsList.actions.copyLink'),
                onClick: () => handleCopyLink(record.uuid)
              },
              {
                key: 'download',
                icon: <DownloadOutlined />,
                label: t('receiptsList.actions.downloadPDF'),
                onClick: () => message.info(t('receiptsList.messages.pdfInDevelopment'))
              },
              {
                type: 'divider'
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('common.delete'),
                danger: true,
                onClick: () => handleDelete(record.id)
              }
            ]
          }}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      )
    }
  ];

  return (
    <>
      {/* Таблица для десктопа */}
      <div className="desktop-table">
        <Table
          columns={columns}
          dataSource={receipts}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => t('receiptsList.pagination.total', { total })
          }}
          scroll={{ x: 1000 }}
        />
      </div>

      {/* Карточки для мобильных */}
      <div className="mobile-cards">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>{t('receiptsList.mobile.loading')}</div>
        ) : receipts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            {t('receiptsList.mobile.noReceipts')}
          </div>
        ) : (
          <>
            {receipts.map(receipt => (
              <Card 
                key={receipt.id} 
                size="small" 
                className="mobile-receipt-card"
                onClick={() => navigate(`/financial-documents/receipts/${receipt.id}`)}
              >
                <div className="mobile-card-header">
                  <div className="mobile-card-number">{receipt.receipt_number}</div>
                  <div className="mobile-card-badges">
                    {getStatusTag(receipt.status)}
                  </div>
                </div>
                
                <div className="mobile-card-amount">
                  {formatCurrency(receipt.amount_paid)} THB
                </div>
                
                <div className="mobile-card-info">
                  <strong>{t('receiptsList.mobile.method')}:</strong> {getPaymentMethodTag(receipt.payment_method)}
                </div>
                
                {receipt.invoice_number && (
                  <div className="mobile-card-info">
                    <strong>{t('receiptsList.mobile.invoice')}:</strong> {receipt.invoice_number}
                  </div>
                )}
                
                {receipt.files_count && receipt.files_count > 0 && (
                  <div className="mobile-card-info">
                    <FileImageOutlined /> {t('receiptsList.mobile.filesCount', { count: receipt.files_count })}
                  </div>
                )}
                
                <div className="mobile-card-footer">
                  <div className="mobile-card-date">
                    {new Date(receipt.receipt_date).toLocaleDateString('ru-RU')}
                  </div>
                  <Space>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/financial-documents/receipts/${receipt.id}`);
                      }}
                    >
                      {t('receiptsList.mobile.open')}
                    </Button>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'copy-link',
                            icon: <LinkOutlined />,
                            label: t('receiptsList.actions.copyLink'),
                            onClick: () => handleCopyLink(receipt.uuid)
                          },
                          {
                            key: 'delete',
                            icon: <DeleteOutlined />,
                            label: t('common.delete'),
                            danger: true,
                            onClick: () => handleDelete(receipt.id)
                          }
                        ]
                      }}
                      trigger={['click']}
                    >
                      <Button 
                        type="text" 
                        icon={<MoreOutlined />} 
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </Space>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </>
  );
};

export default ReceiptsList;