// frontend/src/modules/Agreements/AgreementDetail.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Modal,
  message,
  Spin,
  Tabs,
  Table,
  Drawer,
  Switch,
  Dropdown,
  Row,
  Col,
  Typography,
  Input
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  SaveOutlined,
  CloseOutlined,
  FileTextOutlined,
  CodeOutlined,
  MobileOutlined,
  DesktopOutlined,
  CheckOutlined,
  ReloadOutlined,
  CopyOutlined,
  MoreOutlined,
  FilePdfOutlined,
  PrinterOutlined,
  BellOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agreementsApi, Agreement, AgreementSignature } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AgreementDetail.css';
import SignaturesModal from './components/SignaturesModal';
import AIAgreementEditor from './components/AIAgreementEditor';

const { Text } = Typography;

const AgreementDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('document');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedStructure, setEditedStructure] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [signaturesModalVisible, setSignaturesModalVisible] = useState(false);
  const [aiEditorVisible, setAiEditorVisible] = useState(false);

  const [signatureDetailsModal, setSignatureDetailsModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<AgreementSignature | null>(null);

  const [viewMode, setViewMode] = useState<'formatted' | 'simple'>('formatted');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && !isEditing) {
        setViewMode('simple');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isEditing]);

  useEffect(() => {
    if (id) {
      fetchAgreement();
    }
  }, [id]);

  useEffect(() => {
    const editParam = searchParams.get('edit');

    if (editParam === 'true') {
      setIsEditing(true);
      setActiveTab('document');
    }
  }, [searchParams]);

  const handleNotifyAgent = async () => {
    if (!agreement || !agreement.request_uuid) {
      message.error(t('agreementDetail.errors.cannotNotify'));
      return;
    }

    try {
      await agreementsApi.notifyAgent(agreement.id, agreement.request_uuid);
      message.success(t('agreementDetail.success.agentNotified'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('agreementDetail.errors.notificationFailed'));
    }
  };

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getById(Number(id));
      setAgreement(response.data.data);
      setEditedContent(response.data.data.content || '');
      setEditedStructure(response.data.data.structure || '');
    } catch (error: any) {
      message.error(error.response?.data?.message || t('agreementDetail.errors.loadFailed'));
      navigate('/agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('agreementDetail.confirm.deleteTitle'),
      content: t('agreementDetail.confirm.deleteContent'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await agreementsApi.delete(Number(id));
          message.success(t('agreementDetail.success.deleted'));
          navigate('/agreements');
        } catch (error: any) {
          message.error(error.response?.data?.message || t('agreementDetail.errors.deleteFailed'));
        }
      }
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  const copyPublicLink = () => {
    if (agreement) {
      navigator.clipboard.writeText(agreement.public_link);
      message.success(t('agreementDetail.success.linkCopied'));
    }
  };

  const handleDownloadPDF = async () => {
    if (!agreement) return;

    try {
      const response = await agreementsApi.downloadPDF(agreement.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${agreement.agreement_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success(t('agreementDetail.success.pdfDownloaded'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('agreementDetail.errors.pdfDownloadFailed'));
    }
  };

  const handleContentChange = (content: string, structure?: string) => {
    setEditedContent(content);
    if (structure) {
      setEditedStructure(structure);
    }
  };

  const handleSimpleContentChange = (content: string) => {
    setEditedContent(content);
  };

  const handleSaveEdit = async () => {
    if (!agreement) return;
    
    setSaving(true);
    try {
      await agreementsApi.update(agreement.id, {
        content: editedContent,
        structure: editedStructure
      });
      message.success(t('agreementDetail.success.saved'));
      setIsEditing(false);
      await fetchAgreement();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('agreementDetail.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    Modal.confirm({
      title: t('agreementDetail.confirm.cancelEditTitle'),
      content: t('agreementDetail.confirm.cancelEditContent'),
      okText: t('agreementDetail.confirm.cancelEditOk'),
      cancelText: t('agreementDetail.confirm.cancelEditCancel'),
      onOk: () => {
        setIsEditing(false);
        setEditedContent(agreement?.content || '');
        setEditedStructure(agreement?.structure || '');
      }
    });
  };

  const handleAiEditorClose = () => {
    setAiEditorVisible(false);
  };

  const handleAiChangesApplied = async () => {
    setAiEditorVisible(false);
    setIsEditing(false);
    await fetchAgreement();
    message.success(t('aiAgreementEditor.success.complete'));
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'formatted' ? 'simple' : 'formatted');
    message.info(viewMode === 'formatted' ? t('agreementDetail.viewModes.simple') : t('agreementDetail.viewModes.formatted'));
  };

  const handleSignatureDetailsClick = (record: AgreementSignature) => {
    if (isMobile) {
      setSelectedSignature(record);
      setSignatureDetailsModal(true);
    }
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

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!agreement) {
    return null;
  }

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: t('agreementDetail.statuses.draft') },
      pending_signatures: { color: 'processing', text: t('agreementDetail.statuses.pendingSignatures') },
      signed: { color: 'success', text: t('agreementDetail.statuses.signed') },
      active: { color: 'success', text: t('agreementDetail.statuses.active') },
      expired: { color: 'warning', text: t('agreementDetail.statuses.expired') },
      cancelled: { color: 'error', text: t('agreementDetail.statuses.cancelled') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      rent: t('agreementDetail.types.rent'),
      sale: t('agreementDetail.types.sale'),
      bilateral: t('agreementDetail.types.bilateral'),
      trilateral: t('agreementDetail.types.trilateral'),
      agency: t('agreementDetail.types.agency'),
      transfer_act: t('agreementDetail.types.transferAct')
    };
    return types[type] || type;
  };

  const SignatureDetailsContent = ({ record }: { record: AgreementSignature }) => (
    <div style={{ 
      padding: '16px', 
      background: '#141414',
      borderRadius: '8px',
      color: 'rgba(255, 255, 255, 0.85)'
    }}>
      <h4 style={{ marginBottom: 16, color: 'rgba(255, 255, 255, 0.95)' }}>
        {t('agreementDetail.signatureDetails.title')}
      </h4>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card 
            size="small" 
            title={t('agreementDetail.signatureDetails.sessionInfo')}
            style={{ background: '#1f1f1f', borderColor: '#303030' }}
            headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.ipAddress')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.ip_address || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.device')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.device_type || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.browser')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.browser || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.os')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.os || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            size="small" 
            title={t('agreementDetail.signatureDetails.timeMetrics')}
            style={{ background: '#1f1f1f', borderColor: '#303030' }}
            headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.firstVisit')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.first_visit_at 
                    ? new Date(record.first_visit_at).toLocaleString('ru-RU')
                    : t('agreementDetail.signatureDetails.notVisited')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.viewDuration')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.agreement_view_duration 
                    ? t('agreementDetail.signatureDetails.timeFormat', {
                        minutes: Math.floor(record.agreement_view_duration / 60),
                        seconds: record.agreement_view_duration % 60
                      })
                    : '0 ' + t('agreementDetail.signatureDetails.seconds')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.totalDuration')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.total_session_duration 
                    ? t('agreementDetail.signatureDetails.timeFormat', {
                        minutes: Math.floor(record.total_session_duration / 60),
                        seconds: record.total_session_duration % 60
                      })
                    : '0 ' + t('agreementDetail.signatureDetails.seconds')}
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('agreementDetail.signatureDetails.clearCount')}:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.signature_clear_count || 0}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        {record.is_signed && record.signature_data && (
          <Col xs={24}>
            <Card 
              size="small" 
              title={t('agreementDetail.signatureDetails.signature')}
              style={{ background: '#1f1f1f', borderColor: '#303030' }}
              headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
            >
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={record.signature_data} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: '300px', 
                    border: '1px solid #303030',
                    borderRadius: '4px',
                    padding: '8px',
                    background: 'white'
                  }} 
                />
              </div>
            </Card>
          </Col>
        )}
        {record.signature_link && (
          <Col xs={24}>
            <Card 
              size="small" 
              title={t('agreementDetail.signatureDetails.signatureLink')}
              style={{ background: '#1f1f1f', borderColor: '#303030' }}
              headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
            >
              <Input.Group compact>
                <Input
                  style={{ width: 'calc(100% - 100px)' }}
                  value={`https://agreement.novaestate.company/sign/${record.signature_link}`}
                  readOnly
                />
                <Button 
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://agreement.novaestate.company/sign/${record.signature_link}`
                    );
                    message.success(t('agreementDetail.success.linkCopied'));
                  }}
                >
                  {t('agreementDetail.actions.copy')}
                </Button>
              </Input.Group>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );

  const tabItems = [
    {
      key: 'document',
      label: t('agreementDetail.tabs.document'),
      children: (
        <>
          {isEditing && (
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                size="large"
                icon={<RobotOutlined />}
                onClick={() => setAiEditorVisible(true)}
                style={{
                  background: '#52c41a',
                  borderColor: '#52c41a',
                  width: '100%',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {t('aiAgreementEditor.button')}
              </Button>
            </div>
          )}
          <div className="agreement-document-container">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px',
              padding: '12px',
              background: '#1f1f1f',
              borderRadius: '4px',
              border: '1px solid #303030',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isMobile ? <MobileOutlined /> : <DesktopOutlined />}
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {isMobile ? t('agreementDetail.deviceTypes.mobile') : t('agreementDetail.deviceTypes.desktop')}
                </span>
              </div>

              <Space>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                  {viewMode === 'formatted' 
                    ? t('agreementDetail.viewModes.formatted') 
                    : t('agreementDetail.viewModes.simple')}
                </span>
                <Switch
                  checked={viewMode === 'formatted'}
                  onChange={toggleViewMode}
                  checkedChildren={<FileTextOutlined />}
                  unCheckedChildren={<CodeOutlined />}
                />
              </Space>
            </div>

            <div style={{ display: 'none' }}>
              <div ref={printRef}>
                <DocumentEditor
                  agreement={agreement}
                  isEditing={false}
                  logoUrl="/nova-logo.svg"
                />
              </div>
            </div>

            {isEditing ? (
              viewMode === 'formatted' ? (
                <DocumentEditor
                  agreement={agreement}
                  isEditing={true}
                  onContentChange={handleContentChange}
                  logoUrl="/nova-logo.svg"
                />
              ) : (
                <div className="agreement-simple-view">
                  <ReactQuill
                    value={editedContent}
                    onChange={handleSimpleContentChange}
                    modules={modules}
                    theme="snow"
                    style={{ height: '600px', marginBottom: '50px' }}
                  />
                </div>
              )
            ) : (
              viewMode === 'formatted' ? (
                <div className={isMobile ? 'document-editor-wrapper mobile-zoom' : 'document-editor-wrapper'}>
                  <DocumentEditor
                    agreement={agreement}
                    isEditing={false}
                    logoUrl="/nova-logo.svg"
                  />
                </div>
              ) : (
                <div className="agreement-simple-view">
                  <ReactQuill
                    value={agreement.content}
                    readOnly={true}
                    theme="snow"
                    modules={{ toolbar: false }}
                    style={{ height: 'auto' }}
                  />
                </div>
              )
            )}
          </div>
        </>
      )
    },
    {
      key: 'details',
      label: t('agreementDetail.tabs.details'),
      children: (
        <Card>
          <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
            <Descriptions.Item label={t('agreementDetail.fields.agreementNumber')}>
              {agreement.agreement_number}
            </Descriptions.Item>
            <Descriptions.Item label={t('agreementDetail.fields.type')}>
              {getTypeLabel(agreement.type)}
            </Descriptions.Item>
            <Descriptions.Item label={t('agreementDetail.fields.status')}>
              {getStatusTag(agreement.status)}
            </Descriptions.Item>
            {agreement.property_name && (
              <Descriptions.Item label={t('agreementDetail.fields.property')}>
                {agreement.property_name} ({agreement.property_number})
              </Descriptions.Item>
            )}
            {agreement.description && (
              <Descriptions.Item label={t('agreementDetail.fields.description')} span={2}>
                {agreement.description}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('agreementDetail.fields.city')}>
              {agreement.city}
            </Descriptions.Item>
            {agreement.date_from && (
              <Descriptions.Item label={t('agreementDetail.fields.dateFrom')}>
                {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            {agreement.date_to && (
              <Descriptions.Item label={t('agreementDetail.fields.dateTo')}>
                {new Date(agreement.date_to).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            {agreement.rent_amount_monthly && (
              <Descriptions.Item label={t('agreementDetail.fields.rentMonthly')}>
                {agreement.rent_amount_monthly.toLocaleString('ru-RU')} ₿
              </Descriptions.Item>
            )}
            {agreement.deposit_amount && (
              <Descriptions.Item label={t('agreementDetail.fields.deposit')}>
                {agreement.deposit_amount.toLocaleString('ru-RU')} ₿
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('agreementDetail.fields.created')}>
              {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
            </Descriptions.Item>
            {agreement.created_by_name && (
              <Descriptions.Item label={t('agreementDetail.fields.author')}>
                {agreement.created_by_name}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )
    },
    {
      key: 'parties',
      label: t('agreementDetail.tabs.parties'),
      children: (
        <Card>
          {agreement.parties && agreement.parties.length > 0 ? (
            <div className="parties-list">
              {agreement.parties.map((party, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  style={{ marginBottom: '12px' }}
                  className="party-card"
                >
                  <div className="party-info">
                    <div className="party-role">
                      <Tag color="blue">{party.role}</Tag>
                    </div>
                    <div className="party-details">
                      <div><strong>{party.name}</strong></div>
                      <div className="party-passport">
                        {t('agreementDetail.fields.country')}: {party.passport_country}
                      </div>
                      <div className="party-passport">
                        {t('agreementDetail.fields.passport')}: {party.passport_number}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {t('agreementDetail.messages.noParties')}
            </div>
          )}
        </Card>
      )
    },
    {
      key: 'signatures',
      label: t('agreementDetail.tabs.signatures'),
      children: (
        <Card>
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setSignaturesModalVisible(true)}
              disabled={!agreement.parties || agreement.parties.length === 0}
            >
              {agreement.signatures && agreement.signatures.length > 0 
                ? t('agreementDetail.actions.manageSignatures') 
                : t('agreementDetail.actions.sendForSignature')}
            </Button>
            {agreement.signatures && agreement.signatures.length > 0 && (
              <Tag color={agreement.signatures.every(s => s.is_signed) ? 'success' : 'processing'}>
                {t('agreementDetail.fields.signedCount', {
                  signed: agreement.signatures.filter(s => s.is_signed).length,
                  total: agreement.signatures.length
                })}
              </Tag>
            )}
          </Space>

          {agreement.signatures && agreement.signatures.length > 0 ? (
            <Table
              dataSource={agreement.signatures}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 1200 }}
              expandable={
                isMobile ? undefined : {
                  expandedRowRender: (record) => (
                    <SignatureDetailsContent record={record} />
                  ),
                  rowExpandable: () => true,
                }
              }
              onRow={(record) => {
                return isMobile ? {
                  onClick: () => handleSignatureDetailsClick(record),
                } : {};
              }}
              columns={[
                {
                  title: t('agreementDetail.table.signer'),
                  dataIndex: 'signer_name',
                  key: 'signer_name',
                  width: 200,
                  render: (text, record) => (
                    <Space direction="vertical" size="small">
                      <Text strong>{text}</Text>
                      <Tag color="blue">{record.signer_role}</Tag>
                    </Space>
                  )
                },
                {
                  title: t('agreementDetail.table.status'),
                  dataIndex: 'is_signed',
                  key: 'is_signed',
                  width: 120,
                  render: (is_signed, record) => (
                    <Space direction="vertical" size="small">
                      <Tag color={is_signed ? 'success' : 'default'} icon={is_signed ? <CheckOutlined /> : null}>
                        {is_signed ? t('agreementDetail.statuses.signed') : t('agreementDetail.statuses.waiting')}
                      </Tag>
                      {is_signed && record.signed_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(record.signed_at).toLocaleDateString('ru-RU')}
                        </Text>
                      )}
                    </Space>
                  )
                },
                {
                  title: t('agreementDetail.table.device'),
                  dataIndex: 'device_type',
                  key: 'device_type',
                  width: 120,
                  responsive: ['lg'],
                  render: (device) => device || '-'
                },
                {
                  title: t('agreementDetail.table.ipAddress'),
                  dataIndex: 'ip_address',
                  key: 'ip_address',
                  width: 140,
                  responsive: ['lg'],
                  render: (ip) => ip || '-'
                },
                {
                  title: t('agreementDetail.table.viewTime'),
                  dataIndex: 'agreement_view_duration',
                  key: 'agreement_view_duration',
                  width: 140,
                  responsive: ['xl'],
                  render: (duration) => duration 
                    ? t('agreementDetail.signatureDetails.timeFormat', {
                        minutes: Math.floor(duration / 60),
                        seconds: duration % 60
                      })
                    : '-'
                },
                {
                  title: t('agreementDetail.table.actions'),
                  key: 'actions',
                  width: 80,
                  fixed: 'right',
                  render: (_, record) => (
                    <Dropdown
                      menu={{
                        items: [
                          ...(record.signature_link && !record.is_signed ? [{
                            key: 'copy',
                            icon: <CopyOutlined />,
                            label: t('agreementDetail.actions.copyLink'),
                            onClick: () => {
                              navigator.clipboard.writeText(
                                `https://agreement.novaestate.company/sign/${record.signature_link}`
                              );
                              message.success(t('agreementDetail.success.linkCopied'));
                            }
                          },
                          {
                            key: 'regenerate',
                            icon: <ReloadOutlined />,
                            label: t('agreementDetail.actions.regenerateLink'),
                            onClick: async () => {
                              try {
                                const response = await agreementsApi.regenerateSignatureLink(record.id);
                                message.success(t('agreementDetail.success.linkRegenerated'));
                                navigator.clipboard.writeText(response.data.data.public_url);
                                fetchAgreement();
                              } catch (error: any) {
                                message.error(t('agreementDetail.errors.regenerateFailed'));
                              }
                            }
                          }] : []),
                          {
                            type: 'divider'
                          },
                          {
                            key: 'delete',
                            icon: <DeleteOutlined />,
                            label: t('common.delete'),
                            danger: true,
                            onClick: () => {
                              Modal.confirm({
                                title: t('agreementDetail.confirm.deleteSignatureTitle'),
                                content: t('agreementDetail.confirm.deleteContent'),
                                okText: t('common.delete'),
                                okType: 'danger',
                                cancelText: t('common.cancel'),
                                onOk: async () => {
                                  try {
                                    await agreementsApi.deleteSignature(record.id);
                                    message.success(t('agreementDetail.success.signatureDeleted'));
                                    fetchAgreement();
                                  } catch (error: any) {
                                    message.error(t('agreementDetail.errors.deleteFailed'));
                                  }
                                }
                              });
                            }
                          }
                        ]
                      }}
                    >
                      <Button size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  )
                }
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
              <div>{t('agreementDetail.messages.noSignatures')}</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                {t('agreementDetail.messages.noSignaturesHint')}
              </div>
            </div>
          )}
        </Card>
      )
    }
  ];

  return (
    <div className="agreement-detail-container">
      <Card className="agreement-header-card">
        <div className="agreement-header-content">
          <div className="agreement-header-left">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/agreements')}
              className="back-button"
            >
              <span className="back-button-text">{t('agreementDetail.actions.back')}</span>
            </Button>
            <div className="agreement-title-section">
              <h2 className="agreement-title">
                {t('agreementDetail.title', { number: agreement.agreement_number })}
              </h2>
              {getStatusTag(agreement.status)}
            </div>
          </div>
          
          <Space className="agreement-actions" wrap>
            {!isEditing ? (
              <>
                <Button 
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                  className="action-button"
                >
                  <span className="action-button-text">{t('agreementDetail.actions.edit')}</span>
                </Button>
                <Button 
                  type="primary"
                  icon={<FilePdfOutlined />}
                  onClick={handleDownloadPDF}
                  className="action-button"
                >
                  <span className="action-button-text">{t('agreementDetail.actions.downloadPDF')}</span>
                </Button>
                <Button 
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                  className="action-button"
                >
                  <span className="action-button-text">{t('agreementDetail.actions.print')}</span>
                </Button>
                <Button 
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={copyPublicLink}
                  className="action-button"
                >
                  <span className="action-button-text">{t('agreementDetail.actions.link')}</span>
                </Button>
                {agreement.request_uuid && agreement.signatures && agreement.signatures.length > 0 && (
                  <Button 
                    icon={<BellOutlined />}
                    onClick={handleNotifyAgent}
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    className="action-button"
                  >
                    <span className="action-button-text">{t('agreementDetail.actions.notifyAgent')}</span>
                  </Button>
                )}
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  className="action-button delete-button"
                >
                  <span className="action-button-text">{t('common.delete')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveEdit}
                  loading={saving}
                >
                  {t('common.save')}
                </Button>
                <Button 
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                >
                  {t('common.cancel')}
                </Button>
              </>
            )}
          </Space>
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="agreement-tabs"
      />

      <Drawer
        title={t('agreementDetail.drawer.title')}
        placement="bottom"
        onClose={() => setDetailsDrawerVisible(false)}
        open={detailsDrawerVisible}
        height="80%"
        className="details-drawer"
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('agreementDetail.fields.agreementNumber')}>
            {agreement.agreement_number}
          </Descriptions.Item>
          <Descriptions.Item label={t('agreementDetail.fields.type')}>
            {getTypeLabel(agreement.type)}
          </Descriptions.Item>
          <Descriptions.Item label={t('agreementDetail.fields.status')}>
            {getStatusTag(agreement.status)}
          </Descriptions.Item>
          {agreement.property_name && (
            <Descriptions.Item label={t('agreementDetail.fields.property')}>
              {agreement.property_name} ({agreement.property_number})
            </Descriptions.Item>
          )}
          {agreement.description && (
            <Descriptions.Item label={t('agreementDetail.fields.description')}>
              {agreement.description}
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('agreementDetail.fields.city')}>
            {agreement.city}
          </Descriptions.Item>
          <Descriptions.Item label={t('agreementDetail.fields.created')}>
            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>
      </Drawer>

      <Modal
        title={t('agreementDetail.signatureDetails.title')}
        open={signatureDetailsModal}
        onCancel={() => {
          setSignatureDetailsModal(false);
          setSelectedSignature(null);
        }}
        footer={null}
        width="95%"
        style={{ top: 20 }}
        bodyStyle={{ 
          maxHeight: 'calc(100vh - 200px)', 
          overflowY: 'auto',
          padding: '16px'
        }}
      >
        {selectedSignature && (
          <SignatureDetailsContent record={selectedSignature} />
        )}
      </Modal>

      <SignaturesModal
        visible={signaturesModalVisible}
        onCancel={() => setSignaturesModalVisible(false)}
        onSuccess={() => {
          fetchAgreement();
          setSignaturesModalVisible(false);
        }}
        agreementId={agreement.id}
        parties={agreement.parties || []}
        existingSignatures={agreement.signatures}
        requestUuid={agreement.request_uuid}
      />

      <Modal
        title={null}
        open={aiEditorVisible}
        onCancel={handleAiEditorClose}
        footer={null}
        width="90%"
        style={{ top: 20, maxWidth: 1400 }}
        bodyStyle={{
          height: 'calc(100vh - 100px)',
          padding: 0,
          overflow: 'hidden',
          background: '#141414'
        }}
        destroyOnClose
        className="ai-editor-modal"
      >
        <AIAgreementEditor
          agreementId={agreement.id}
          onChangesApplied={handleAiChangesApplied}
          onClose={handleAiEditorClose}
        />
      </Modal>
    </div>
  );
};

export default AgreementDetail;