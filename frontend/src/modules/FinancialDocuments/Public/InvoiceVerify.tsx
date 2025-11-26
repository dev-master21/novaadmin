// frontend/src/modules/FinancialDocuments/Public/InvoiceVerify.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Button,
  Descriptions,
  message,
  Modal,
  Typography,
  Spin,
  Tag,
  Progress,
  Row,
  Col
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  SafetyOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { financialDocumentsApi, Invoice } from '@/api/financialDocuments.api';
import './InvoiceVerify.css';

const { Title, Text, Paragraph } = Typography;

const InvoiceVerify = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptsModalVisible, setReceiptsModalVisible] = useState(false);

  useEffect(() => {
    if (uuid) {
      fetchInvoice();
    }
  }, [uuid]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const response = await financialDocumentsApi.getInvoiceByUuid(uuid!);
      setInvoice(response.data.data);
    } catch (error: any) {
      message.error('Invoice not found or has been deleted');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf' });
      const response = await financialDocumentsApi.downloadInvoicePDFByUuid(uuid!);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: 'PDF downloaded successfully', key: 'pdf' });
    } catch (error: any) {
      message.error({ content: 'Error downloading PDF', key: 'pdf' });
    }
  };

  const handleDownloadReceipt = async (receiptUuid: string, receiptNumber: string) => {
    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf' });
      const response = await financialDocumentsApi.downloadReceiptPDFByUuid(receiptUuid);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: 'PDF downloaded successfully', key: 'pdf' });
      setReceiptsModalVisible(false);
    } catch (error: any) {
      message.error({ content: 'Error downloading PDF', key: 'pdf' });
    }
  };

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: any }> = {
      draft: { color: '#6b7280', text: 'Draft', icon: <FileTextOutlined /> },
      sent: { color: '#3b82f6', text: 'Sent', icon: <FileTextOutlined /> },
      partially_paid: { color: '#f59e0b', text: 'Partially Paid', icon: <DollarOutlined /> },
      paid: { color: '#10b981', text: 'Paid', icon: <CheckCircleOutlined /> },
      overdue: { color: '#ef4444', text: 'Overdue', icon: <ClockCircleOutlined /> },
      cancelled: { color: '#6b7280', text: 'Cancelled', icon: <CloseCircleOutlined /> }
    };
    
    return statusConfig[status] || { color: '#6b7280', text: status, icon: <FileTextOutlined /> };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (loading) {
    return (
      <div className="invoice-verify-loading">
        <Spin size="large" />
        <p>Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-verify-error">
        <div className="error-icon">
          <CloseCircleOutlined />
        </div>
        <Title level={3}>Invoice Not Found</Title>
        <Text type="secondary">
          The invoice you're looking for doesn't exist or has been deleted.
        </Text>
      </div>
    );
  }

  const statusInfo = getStatusInfo(invoice.status);
  const isPaid = invoice.status === 'paid';
  const paymentProgress = (invoice.amount_paid / invoice.total_amount) * 100;

  return (
    <div className="invoice-verify-container">
      {/* Header */}
      <div className="verify-header">
        <div className="verify-brand">
          <img src="/nova-logo.svg" alt="NOVAESTATE" className="brand-logo" />
        </div>
        <div className="verify-title-section">
          <div className="verify-icon-wrapper">
            <SafetyOutlined className="verify-icon" />
          </div>
          <Title level={2} className="verify-title">Invoice Verification</Title>
          <Paragraph className="verify-subtitle">
            Official invoice document issued by NOVAESTATE
          </Paragraph>
        </div>
      </div>

      <div className="content-wrapper">
        {/* Status Card */}
        <Card className="status-card">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12}>
              <div className="status-section">
                <div className="status-icon" style={{ color: statusInfo.color }}>
                  {statusInfo.icon}
                </div>
                <div className="status-info">
                  <div className="status-label">Status</div>
                  <div className="status-value" style={{ color: statusInfo.color }}>
                    {statusInfo.text}
                  </div>
                  <div className="status-number">Invoice #{invoice.invoice_number}</div>
                </div>
              </div>
            </Col>
            {!isPaid && (
              <Col xs={24} sm={12}>
                <div className="progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Payment Progress</span>
                    <span className="progress-percentage">{Math.round(paymentProgress)}%</span>
                  </div>
                  <Progress 
                    percent={paymentProgress} 
                    strokeColor={{
                      '0%': '#3b82f6',
                      '100%': '#10b981',
                    }}
                    showInfo={false}
                    strokeWidth={10}
                  />
                  <div className="progress-amounts">
                    <span className="paid-amount">{formatCurrency(invoice.amount_paid)} THB</span>
                    <span className="remaining-amount">{formatCurrency(invoice.total_amount - invoice.amount_paid)} THB</span>
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </Card>

        {/* Financial Summary Cards */}
        <Row gutter={[12, 12]} className="financial-summary">
          <Col xs={24} sm={8}>
            <Card className="summary-card total">
              <div className="summary-content">
                <div className="summary-icon">
                  <FileTextOutlined />
                </div>
                <div className="summary-info">
                  <div className="summary-label">Total Amount</div>
                  <div className="summary-value">{formatCurrency(invoice.total_amount)} <span className="currency">THB</span></div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card className="summary-card paid">
              <div className="summary-content">
                <div className="summary-icon">
                  <CheckCircleOutlined />
                </div>
                <div className="summary-info">
                  <div className="summary-label">Amount Paid</div>
                  <div className="summary-value">{formatCurrency(invoice.amount_paid)} <span className="currency">THB</span></div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card className="summary-card remaining">
              <div className="summary-content">
                <div className="summary-icon">
                  <DollarOutlined />
                </div>
                <div className="summary-info">
                  <div className="summary-label">Remaining</div>
                  <div className="summary-value">{formatCurrency(invoice.total_amount - invoice.amount_paid)} <span className="currency">THB</span></div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Invoice Details */}
        <Card title={<><FileTextOutlined /> Invoice Details</>} className="info-card">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Invoice Number">
              <Text strong style={{ color: '#1f2937' }}>{invoice.invoice_number}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Invoice Date">
              <Text style={{ color: '#1f2937' }}><CalendarOutlined /> {new Date(invoice.invoice_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</Text>
            </Descriptions.Item>
            {invoice.due_date && (
              <Descriptions.Item label="Due Date">
                <Tag icon={<ClockCircleOutlined />} color="orange">
                  {new Date(invoice.due_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Tag>
              </Descriptions.Item>
            )}
            {invoice.agreement_number && (
              <Descriptions.Item label="Agreement">
                <Tag 
                  color="purple"
                  style={{ 
                    fontSize: '13px', 
                    padding: '4px 12px',
                    background: '#f3e8ff',
                    color: '#7c3aed',
                    border: '1px solid #c084fc'
                  }}
                >
                  {invoice.agreement_number}
                </Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Parties */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} md={12}>
            <Card title={<><UserOutlined /> Bill From</>} className="party-card">
              {invoice.from_type === 'company' ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company">
                    <Text strong style={{ color: '#1f2937' }}>{invoice.from_company_name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="TAX ID">
                    <Text style={{ color: '#1f2937' }}>{invoice.from_company_tax_id}</Text>
                  </Descriptions.Item>
                  {invoice.from_company_address && (
                    <Descriptions.Item label="Address">
                      <Text style={{ color: '#1f2937' }}>{invoice.from_company_address}</Text>
                    </Descriptions.Item>
                  )}
                  {invoice.from_director_name && (
                    <Descriptions.Item label="Director">
                      <Text style={{ color: '#1f2937' }}>{invoice.from_director_name}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong style={{ color: '#1f2937' }}>{invoice.from_individual_name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Country">
                    <Text style={{ color: '#1f2937' }}>{invoice.from_individual_country}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Passport">
                    <Text style={{ color: '#1f2937' }}>{invoice.from_individual_passport}</Text>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title={<><UserOutlined /> Bill To</>} className="party-card">
              {invoice.to_type === 'company' ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company">
                    <Text strong style={{ color: '#1f2937' }}>{invoice.to_company_name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="TAX ID">
                    <Text style={{ color: '#1f2937' }}>{invoice.to_company_tax_id}</Text>
                  </Descriptions.Item>
                  {invoice.to_company_address && (
                    <Descriptions.Item label="Address">
                      <Text style={{ color: '#1f2937' }}>{invoice.to_company_address}</Text>
                    </Descriptions.Item>
                  )}
                  {invoice.to_director_name && (
                    <Descriptions.Item label="Director">
                      <Text style={{ color: '#1f2937' }}>{invoice.to_director_name}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong style={{ color: '#1f2937' }}>{invoice.to_individual_name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Country">
                    <Text style={{ color: '#1f2937' }}>{invoice.to_individual_country}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Passport">
                    <Text style={{ color: '#1f2937' }}>{invoice.to_individual_passport}</Text>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>
        </Row>

        {/* Items */}
        <Card title={<><FileTextOutlined /> Invoice Items</>} className="info-card items-card">
          {/* Desktop Table */}
          <div className="items-table desktop-only">
            <div className="items-header">
              <div className="header-item header-num">#</div>
              <div className="header-item header-desc">Description</div>
              <div className="header-item header-qty">Qty</div>
              <div className="header-item header-price">Unit Price</div>
              <div className="header-item header-total">Total</div>
            </div>
            
            <div className="items-body">
              {invoice.items && invoice.items.map((item, index) => (
                <div key={item.id || index} className="item-row-table">
                  <div className="item-cell cell-num">{index + 1}</div>
                  <div className="item-cell cell-desc">{item.description}</div>
                  <div className="item-cell cell-qty">{item.quantity}</div>
                  <div className="item-cell cell-price">{formatCurrency(item.unit_price)} THB</div>
                  <div className="item-cell cell-total">{formatCurrency(item.total_price)} THB</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="items-mobile mobile-only">
            {invoice.items && invoice.items.map((item, index) => (
              <div key={item.id || index} className="mobile-item-card">
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

          <div className="items-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoice.subtotal)} THB</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="summary-row">
                <span>Tax:</span>
                <span>{formatCurrency(invoice.tax_amount)} THB</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total:</span>
              <span>{formatCurrency(invoice.total_amount)} THB</span>
            </div>
          </div>
        </Card>

        {/* Bank Details */}
        {(invoice.bank_name || invoice.bank_account_name || invoice.bank_account_number) && (
          <Card title={<><BankOutlined /> Bank Details for Payment</>} className="info-card">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              {invoice.bank_name && (
                <Descriptions.Item label="Bank Name">
                  <Text strong style={{ color: '#1f2937' }}>{invoice.bank_name}</Text>
                </Descriptions.Item>
              )}
              {invoice.bank_account_name && (
                <Descriptions.Item label="Account Name">
                  <Text style={{ color: '#1f2937' }}>{invoice.bank_account_name}</Text>
                </Descriptions.Item>
              )}
              {invoice.bank_account_number && (
                <Descriptions.Item label="Account Number" span={2}>
                  <Text strong className="account-number">{invoice.bank_account_number}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Card title="Notes" className="info-card">
            <Paragraph className="notes-text">{invoice.notes}</Paragraph>
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
            onClick={handleDownloadInvoice}
            className="action-button primary"
          >
            Download Invoice
          </Button>
          
          {invoice.agreement_verify_link && (
            <Button
              size="large"
              icon={<FileProtectOutlined />}
              onClick={() => window.open(`https://agreement.novaestate.company/agreement-verify/${invoice.agreement_verify_link}`, '_blank')}
              className="action-button secondary"
            >
              View Agreement
            </Button>
          )}
          
          {invoice.receipts && invoice.receipts.length > 0 && (
            <Button
              size="large"
              icon={<DollarOutlined />}
              onClick={() => {
                if (invoice.receipts!.length === 1) {
                  handleDownloadReceipt(invoice.receipts![0].uuid, invoice.receipts![0].receipt_number);
                } else {
                  setReceiptsModalVisible(true);
                }
              }}
              className="action-button secondary"
            >
              Download Receipt{invoice.receipts.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Receipts Modal */}
      <Modal
        open={receiptsModalVisible}
        onCancel={() => setReceiptsModalVisible(false)}
        footer={null}
        width={600}
        className="receipts-modal-custom"
        closeIcon={<CloseCircleOutlined style={{ fontSize: '20px', color: '#6b7280' }} />}
      >
        <div className="receipts-modal-header">
          <DollarOutlined className="receipts-modal-icon" />
          <h3 className="receipts-modal-title">Select Receipt to Download</h3>
          <p className="receipts-modal-subtitle">Choose which receipt you would like to download</p>
        </div>

        <div className="receipts-list">
          {invoice.receipts && invoice.receipts.map((receipt: any, index: number) => (
            <div key={receipt.uuid} className="receipt-card">
              <div className="receipt-card-left">
                <div className="receipt-number-badge">{index + 1}</div>
                <div className="receipt-info">
                  <div className="receipt-number">{receipt.receipt_number}</div>
                  <div className="receipt-date">
                    <CalendarOutlined /> {new Date(receipt.receipt_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
              <div className="receipt-card-right">
                <div className="receipt-amount">{formatCurrency(receipt.amount_paid)} THB</div>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadReceipt(receipt.uuid, receipt.receipt_number)}
                  className="receipt-download-btn"
                >
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

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

export default InvoiceVerify;