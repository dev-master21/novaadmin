// frontend/src/modules/FinancialDocuments/Public/ReceiptVerify.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Button,
  Descriptions,
  message,
  Typography,
  Spin,
  Tag,
  Row,
  Col,
  Image
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  FileImageOutlined,
  DollarOutlined,
  CalendarOutlined,
  BankOutlined,
  FileProtectOutlined
} from '@ant-design/icons';
import { financialDocumentsApi, Receipt } from '@/api/financialDocuments.api';
import './ReceiptVerify.css';

const { Title, Text, Paragraph } = Typography;

const ReceiptVerify = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uuid) {
      fetchReceipt();
    }
  }, [uuid]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getReceiptByUuid(uuid!);
      setReceipt(response.data.data);
    } catch (error: any) {
      message.error('Receipt not found or has been deleted');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf' });
      const response = await financialDocumentsApi.downloadReceiptPDFByUuid(uuid!);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt?.receipt_number || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: 'PDF downloaded successfully', key: 'pdf' });
    } catch (error: any) {
      message.error({ content: 'Error downloading PDF', key: 'pdf' });
    }
  };

  const handleDownloadInvoice = async () => {
    if (!receipt?.invoice_uuid) return;
    
    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf' });
      const response = await financialDocumentsApi.downloadInvoicePDFByUuid(receipt.invoice_uuid);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: 'PDF downloaded successfully', key: 'pdf' });
    } catch (error: any) {
      message.error({ content: 'Error downloading PDF', key: 'pdf' });
    }
  };

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: any }> = {
      pending: { color: '#3b82f6', text: 'Pending', icon: <FileTextOutlined /> },
      verified: { color: '#10b981', text: 'Verified', icon: <CheckCircleOutlined /> },
      rejected: { color: '#ef4444', text: 'Rejected', icon: <CloseCircleOutlined /> }
    };
    
    return statusConfig[status] || { color: '#6b7280', text: status, icon: <FileTextOutlined /> };
  };

  const getPaymentMethodText = (method: string) => {
    const methodConfig: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
      crypto: 'Cryptocurrency',
      barter: 'Barter'
    };
    
    return methodConfig[method] || method;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (loading) {
    return (
      <div className="receipt-verify-loading">
        <Spin size="large" />
        <p>Loading receipt...</p>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="receipt-verify-error">
        <div className="error-icon">
          <CloseCircleOutlined />
        </div>
        <Title level={3}>Receipt Not Found</Title>
        <Text type="secondary">
          The receipt you're looking for doesn't exist or has been deleted.
        </Text>
      </div>
    );
  }

  const statusInfo = getStatusInfo(receipt.status);

  return (
    <div className="receipt-verify-container">
      {/* Header */}
      <div className="verify-header">
        <div className="verify-brand">
          <img src="/nova-logo.svg" alt="NOVAESTATE" className="brand-logo" />
        </div>
        <div className="verify-title-section">
          <div className="verify-icon-wrapper">
            <SafetyOutlined className="verify-icon" />
          </div>
          <Title level={2} className="verify-title">Receipt Verification</Title>
          <Paragraph className="verify-subtitle">
            Official payment receipt issued by NOVAESTATE
          </Paragraph>
        </div>
      </div>

      <div className="content-wrapper">
        {/* Status Card */}
        <Card className="status-card">
          <div className="status-section">
            <div className="status-icon" style={{ color: statusInfo.color }}>
              {statusInfo.icon}
            </div>
            <div className="status-info">
              <div className="status-label">Status</div>
              <div className="status-value" style={{ color: statusInfo.color }}>
                {statusInfo.text}
              </div>
              <div className="status-number">Receipt #{receipt.receipt_number}</div>
            </div>
          </div>
        </Card>

        {/* Payment Amount Card */}
        <Card className="payment-amount-card">
          <div className="payment-content">
            <div className="payment-icon">
              <DollarOutlined />
            </div>
            <div className="payment-info">
              <div className="payment-label">Payment Received</div>
              <div className="payment-value">{formatCurrency(receipt.amount_paid)} <span className="currency">THB</span></div>
              <div className="payment-method">
                <BankOutlined /> {getPaymentMethodText(receipt.payment_method)}
              </div>
            </div>
          </div>
        </Card>

        {/* Receipt Details */}
        <Card title={<><FileTextOutlined /> Receipt Details</>} className="info-card">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Receipt Number">
              <Text strong style={{ color: '#1f2937' }}>{receipt.receipt_number}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Receipt Date">
              <Text style={{ color: '#1f2937' }}>
                <CalendarOutlined /> {new Date(receipt.receipt_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </Descriptions.Item>
            {receipt.invoice_number && (
              <Descriptions.Item label="Invoice">
                <Tag 
                  style={{ 
                    fontSize: '13px', 
                    padding: '4px 12px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #93c5fd'
                  }}
                >
                  {receipt.invoice_number}
                </Tag>
              </Descriptions.Item>
            )}
            {receipt.agreement_number && (
              <Descriptions.Item label="Agreement">
                <Tag 
                  style={{ 
                    fontSize: '13px', 
                    padding: '4px 12px',
                    background: '#f3e8ff',
                    color: '#7c3aed',
                    border: '1px solid #c084fc'
                  }}
                >
                  {receipt.agreement_number}
                </Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Payment Method">
              <Text style={{ color: '#1f2937' }}>
                <BankOutlined /> {getPaymentMethodText(receipt.payment_method)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Amount Paid">
              <Text strong style={{ color: '#10b981', fontSize: '15px' }}>
                {formatCurrency(receipt.amount_paid)} THB
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Related Invoice */}
        {receipt.invoice && (
          <Card title={<><FileTextOutlined /> Related Invoice</>} className="info-card">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Invoice Number">
                <Text strong style={{ color: '#1f2937' }}>{receipt.invoice.invoice_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Invoice Date">
                <Text style={{ color: '#1f2937' }}>
                  {new Date(receipt.invoice.invoice_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ color: '#1f2937' }}>{formatCurrency(receipt.invoice.total_amount)} THB</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Amount Paid">
                <Text strong style={{ color: '#10b981' }}>
                  {formatCurrency(receipt.invoice.amount_paid)} THB
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Remaining">
                <Text strong style={{ color: '#f59e0b' }}>
                  {formatCurrency(receipt.invoice.total_amount - receipt.invoice.amount_paid)} THB
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={receipt.invoice.status === 'paid' ? 'success' : 'warning'}>
                  {receipt.invoice.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {receipt.invoice.items && receipt.invoice.items.length > 0 && (
              <>
                <div style={{ marginTop: '20px', marginBottom: '12px', fontWeight: 600, fontSize: '15px', color: '#1f2937' }}>
                  Invoice Items
                </div>
                <div className="items-mobile">
                  {receipt.invoice.items.map((item: any, index: number) => (
                    <div key={index} className="mobile-item-card">
                      <div className="mobile-item-header">
                        <span className="mobile-item-number">#{index + 1}</span>
                        <span className="mobile-item-title">{item.description}</span>
                      </div>
                      <div className="mobile-item-details">
                        <div className="mobile-item-row">
                          <span className="mobile-item-label">Quantity:</span>
                          <span className="mobile-item-value">{item.quantity}</span>
                        </div>
                        <div className="mobile-item-row">
                          <span className="mobile-item-label">Unit Price:</span>
                          <span className="mobile-item-value">{formatCurrency(item.unit_price)} THB</span>
                        </div>
                        <div className="mobile-item-row total">
                          <span className="mobile-item-label">Total:</span>
                          <span className="mobile-item-value">{formatCurrency(item.total_price)} THB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {/* Paid Items */}
        {receipt.items && receipt.items.length > 0 && (
          <Card title={<><CheckCircleOutlined /> Paid Items</>} className="info-card">
            <div className="items-mobile">
              {receipt.items.map((item, index) => (
                <div key={item.id || index} className="mobile-item-card paid">
                  <div className="mobile-item-header">
                    <span className="mobile-item-number">#{index + 1}</span>
                    <span className="mobile-item-title">{item.description}</span>
                  </div>
                  <div className="mobile-item-details">
                    <div className="mobile-item-row">
                      <span className="mobile-item-label">Quantity:</span>
                      <span className="mobile-item-value">{item.quantity}</span>
                    </div>
                    <div className="mobile-item-row">
                      <span className="mobile-item-label">Unit Price:</span>
                      <span className="mobile-item-value">{formatCurrency(item.unit_price || 0)} THB</span>
                    </div>
                    <div className="mobile-item-row total">
                      <span className="mobile-item-label">Total:</span>
                      <span className="mobile-item-value">{formatCurrency(item.total_price || 0)} THB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Payment Confirmation Files */}
        {receipt.files && receipt.files.length > 0 && (
          <Card title={<><FileImageOutlined /> Payment Confirmation</>} className="info-card">
            <Row gutter={[16, 16]}>
              {receipt.files.map((file, index) => (
                <Col key={file.id || index} xs={12} sm={8} md={6}>
                  <div className="file-preview">
                    <Image
                      src={`${import.meta.env.VITE_API_BASE_URL || 'https://admin.novaestate.company'}${file.file_path}`}
                      alt={file.file_name}
                      className="file-image"
                    />
                    <div className="file-name">{file.file_name}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* Notes */}
        {receipt.notes && (
          <Card title="Notes" className="info-card">
            <Paragraph className="notes-text">{receipt.notes}</Paragraph>
          </Card>
        )}

        {/* Spacer for mobile sticky buttons */}
        <div className="mobile-spacer"></div>
      </div>

      {/* Action Buttons - Fixed on mobile */}
      <div className="action-buttons-wrapper">
        <div className="action-buttons">
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleDownloadReceipt}
            className="action-button primary"
          >
            Download Receipt
          </Button>
          
          {receipt.invoice_uuid && (
            <>
              <Button
                size="large"
                icon={<FileTextOutlined />}
                onClick={() => window.open(`https://admin.novaestate.company/invoice-verify/${receipt.invoice_uuid}`, '_blank')}
                className="action-button secondary"
              >
                View Invoice
              </Button>
              
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownloadInvoice}
                className="action-button secondary"
              >
                Download Invoice
              </Button>
            </>
          )}
          
          {receipt.agreement_verify_link && (
            <Button
              size="large"
              icon={<FileProtectOutlined />}
              onClick={() => window.open(`https://agreement.novaestate.company/agreement-verify/${receipt.agreement_verify_link}`, '_blank')}
              className="action-button secondary"
            >
              View Agreement
            </Button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="verify-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/nova-logo.svg" alt="NOVAESTATE" />
          </div>
          <div className="footer-text">
            <SafetyOutlined /> Secure and verified document
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} NOVAESTATE. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptVerify;