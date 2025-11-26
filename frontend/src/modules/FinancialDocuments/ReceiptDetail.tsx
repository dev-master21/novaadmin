// frontend/src/modules/FinancialDocuments/ReceiptDetail.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Divider,
  message,
  Modal,
  Row,
  Col,
  Statistic,
  Typography,
  Image,
  Empty
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  QrcodeOutlined,
  FileImageOutlined,
  EditOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { financialDocumentsApi, Receipt } from '@/api/financialDocuments.api';
import './ReceiptDetail.css';
import EditReceiptModal from './components/EditReceiptModal';

const { Title, Text } = Typography;

const ReceiptDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchReceipt();
    }
  }, [id]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getReceiptById(Number(id));
      setReceipt(response.data.data);
    } catch (error: any) {
      message.error(t('receiptDetail.messages.loadError'));
      navigate('/financial-documents?tab=receipts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('receiptDetail.confirm.deleteTitle'),
      content: t('receiptDetail.confirm.deleteDescription'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await financialDocumentsApi.deleteReceipt(Number(id));
          message.success(t('receiptDetail.messages.deleted'));
          navigate('/financial-documents?tab=receipts');
        } catch (error: any) {
          message.error(t('receiptDetail.messages.deleteError'));
        }
      }
    });
  };

  const handleCopyLink = async () => {
    if (!receipt?.uuid) {
      message.error(t('receiptDetail.messages.uuidNotFound'));
      return;
    }
    
    const link = `https://admin.novaestate.company/receipt-verify/${receipt.uuid}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success(t('receiptDetail.messages.linkCopied'));
    } catch (error) {
      message.error(t('receiptDetail.messages.linkCopyError'));
    }
  };

  const handleDownloadPDF = async () => {
    try {
      message.loading({ content: t('receiptDetail.messages.generatingPDF'), key: 'pdf' });
      const response = await financialDocumentsApi.downloadReceiptPDF(Number(id));
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt?.receipt_number || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: t('receiptDetail.messages.pdfDownloaded'), key: 'pdf' });
    } catch (error: any) {
      message.error({ content: t('receiptDetail.messages.pdfDownloadError'), key: 'pdf' });
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: t('receiptDetail.statuses.pending') },
      verified: { color: 'success', text: t('receiptDetail.statuses.verified') },
      rejected: { color: 'error', text: t('receiptDetail.statuses.rejected') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPaymentMethodText = (method: string) => {
    const methodConfig: Record<string, string> = {
      bank_transfer: t('receiptDetail.paymentMethods.bankTransfer'),
      cash: t('receiptDetail.paymentMethods.cash'),
      crypto: t('receiptDetail.paymentMethods.crypto'),
      barter: t('receiptDetail.paymentMethods.barter')
    };
    
    return methodConfig[method] || method;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (!receipt) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        {loading ? t('receiptDetail.loading') : t('receiptDetail.notFound')}
      </div>
    );
  }

  return (
    <div className="receipt-detail-container">
      {/* Кнопка назад для мобильных */}
      <div className="mobile-back-button">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/financial-documents?tab=receipts')}
          block
        >
          {t('receiptDetail.buttons.backToList')}
        </Button>
      </div>

      {/* Заголовок и действия */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>{t('receiptDetail.title')} {receipt.receipt_number}</span>
            {getStatusTag(receipt.status)}
          </Space>
        }
        extra={
          <Space wrap className="detail-actions">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/financial-documents?tab=receipts')}
              className="desktop-only"
            >
              {t('receiptDetail.buttons.back')}
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditModalVisible(true)}
            >
              <span className="button-text">{t('receiptDetail.buttons.edit')}</span>
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={handleCopyLink}
            >
              <span className="button-text">{t('receiptDetail.buttons.copyLink')}</span>
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadPDF}
            >
              <span className="button-text">{t('receiptDetail.buttons.downloadPDF')}</span>
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
        {/* Статистика */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title={t('receiptDetail.fields.amountPaid')}
                value={receipt.amount_paid}
                suffix="THB"
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => formatCurrency(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title={t('receiptDetail.fields.paymentMethod')}
                value={getPaymentMethodText(receipt.payment_method)}
                valueStyle={{ fontSize: '18px' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Основная информация */}
        <Descriptions 
          title={t('receiptDetail.sections.mainInfo')} 
          bordered 
          column={{ xs: 1, sm: 2 }}
          size="small"
        >
          <Descriptions.Item label={t('receiptDetail.fields.paymentDate')}>
            {new Date(receipt.receipt_date).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
          <Descriptions.Item label={t('receiptDetail.fields.paymentMethod')}>
            {getPaymentMethodText(receipt.payment_method)}
          </Descriptions.Item>
          {receipt.invoice_number && (
            <Descriptions.Item label={t('receiptDetail.fields.invoice')}>
              <Button 
                type="link" 
                size="small"
                onClick={() => navigate(`/financial-documents/invoices/${receipt.invoice_id}`)}
              >
                {receipt.invoice_number}
              </Button>
            </Descriptions.Item>
          )}
          {receipt.agreement_number && (
            <Descriptions.Item label={t('receiptDetail.fields.agreement')}>
              <Button 
                type="link" 
                size="small"
                onClick={() => navigate(`/agreements/${receipt.agreement_id}`)}
              >
                {receipt.agreement_number}
              </Button>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('receiptDetail.fields.created')}>
            {new Date(receipt.created_at).toLocaleDateString('ru-RU')}{' '}
            {receipt.created_by_name && `(${receipt.created_by_name})`}
          </Descriptions.Item>
        </Descriptions>

        {/* Оплаченные позиции */}
        {receipt.items && receipt.items.length > 0 && (
          <>
            <Divider />
            <Title level={5}>{t('receiptDetail.sections.paidItems')}</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {receipt.items.map((item, index) => (
                <Card 
                  key={item.id || index} 
                  size="small"
                  style={{ background: '#141414', border: '1px solid #303030' }}
                >
                  <Row justify="space-between" align="middle">
                    <Col xs={18}>
                      <div style={{ fontWeight: 600 }}>{item.description}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                        {item.quantity} x {formatCurrency(item.unit_price || 0)} THB
                      </div>
                    </Col>
                    <Col xs={6} style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>
                        {formatCurrency(item.total_price || 0)} THB
                      </div>
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>
          </>
        )}

        {/* Прикрепленные файлы */}
        {receipt.files && receipt.files.length > 0 ? (
          <>
            <Divider />
            <Card size="small" title={<><FileImageOutlined /> {t('receiptDetail.sections.paymentProofs')}</>}>
              <Row gutter={[16, 16]}>
                {receipt.files.map((file, index) => (
                  <Col key={file.id || index} xs={12} sm={8} md={6}>
                    <Image
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}${file.file_path}`}
                      alt={file.file_name}
                      style={{ 
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #303030'
                      }}
                    />
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'rgba(255,255,255,0.45)',
                      marginTop: '4px',
                      textAlign: 'center'
                    }}>
                      {file.file_name}
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </>
        ) : (
          <>
            <Divider />
            <Card size="small" title={<><FileImageOutlined /> {t('receiptDetail.sections.paymentProofs')}</>}>
              <Empty 
                description={t('receiptDetail.noFiles')} 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          </>
        )}

        {/* QR код */}
        {receipt.qr_code_base64 && (
          <>
            <Divider />
            <Card size="small" title={<><QrcodeOutlined /> {t('receiptDetail.sections.qrCode')}</>}>
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={receipt.qr_code_base64}
                  alt="QR Code"
                  style={{ maxWidth: '200px' }}
                  preview={false}
                />
              </div>
            </Card>
          </>
        )}

        {/* Примечания */}
        {receipt.notes && (
          <>
            <Divider />
            <Card size="small" title={t('receiptDetail.sections.notes')}>
              <Text>{receipt.notes}</Text>
            </Card>
          </>
        )}
      </Card>
      {/* Модальное окно редактирования */}
      <EditReceiptModal
        visible={editModalVisible}
        receipt={receipt}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchReceipt();
        }}
      />
    </div>
  );
};

export default ReceiptDetail;