// frontend/src/modules/Agreements/components/SignaturesModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Input,
  Button,
  Space,
  Card,
  message,
  Select,
  Table,
  Tooltip,
  Typography,
  Tag,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  EditOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { agreementsApi, AgreementParty, AgreementSignature } from '@/api/agreements.api';
import type { ColumnsType } from 'antd/es/table';
import './SignaturesModal.css';

const { Option } = Select;
const { Text } = Typography;

interface SignaturesModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  agreementId: number;
  parties: AgreementParty[];
  existingSignatures?: AgreementSignature[];
  requestUuid?: string;
}

interface SignerData {
  id?: string;
  signer_name: string;
  signer_role: string;
}

interface EditingData {
  signer_name: string;
  signer_role: string;
}

const SignaturesModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  agreementId, 
  parties,
  existingSignatures = [],
  requestUuid
}: SignaturesModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [signers, setSigners] = useState<SignerData[]>([]);
  const [showExisting, setShowExisting] = useState(existingSignatures.length > 0);
  const [generatedLinks, setGeneratedLinks] = useState<any[]>([]);
  const [step, setStep] = useState<'create' | 'links'>('create');
  const [editingSignature, setEditingSignature] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EditingData | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const partyRoles = [...new Set(parties.map(p => p.role))];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (visible) {
      if (existingSignatures.length > 0) {
        setShowExisting(true);
        setStep('create');
      } else {
        setShowExisting(false);
        setSigners([{ id: '1', signer_name: '', signer_role: '' }]);
        setStep('create');
      }
      setGeneratedLinks([]);
      setEditingSignature(null);
      setEditingData(null);
    }
  }, [visible, existingSignatures]);

  useEffect(() => {
    console.log('🔍 SignaturesModal Debug:', {
      requestUuid,
      existingSignatures: existingSignatures.length,
      hasRequestUuid: !!requestUuid
    });
  }, [requestUuid, existingSignatures]);

  const addSigner = () => {
    setSigners([...signers, { 
      id: Date.now().toString(), 
      signer_name: '', 
      signer_role: '' 
    }]);
  };

  const removeSigner = (id: string) => {
    setSigners(signers.filter(s => s.id !== id));
  };

  const updateSigner = (id: string, updates: Partial<SignerData>) => {
    setSigners(signers.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const handleNotifyAgent = async () => {
    if (!requestUuid) {
      message.error(t('signaturesModal.errors.cannotNotify'));
      return;
    }

    try {
      await agreementsApi.notifyAgent(agreementId, requestUuid);
      message.success(t('signaturesModal.messages.agentNotified'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('signaturesModal.errors.notificationFailed'));
    }
  };

  const validateUniqueRoles = (signersToValidate: SignerData[]): boolean => {
    const roles = signersToValidate
      .map(s => s.signer_role.trim())
      .filter(role => role !== '');

    const roleSet = new Set(roles);
    
    if (roles.length !== roleSet.size) {
      const duplicates = roles.filter((role, index) => roles.indexOf(role) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      message.error(t('signaturesModal.errors.duplicateRole', { role: uniqueDuplicates[0] }));
      return false;
    }

    const existingRoles = existingSignatures.map(s => s.signer_role);
    const conflictingRoles = roles.filter(role => existingRoles.includes(role));
    
    if (conflictingRoles.length > 0) {
      message.error(t('signaturesModal.errors.roleAlreadyExists', { role: conflictingRoles[0] }));
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    const invalidSigners = signers.filter(s => 
      !s.signer_name.trim() || !s.signer_role.trim()
    );

    if (invalidSigners.length > 0) {
      message.error(t('signaturesModal.errors.fillAllFields'));
      return;
    }

    if (!validateUniqueRoles(signers)) {
      return;
    }

    setLoading(true);
    try {
      const signaturesData = signers.map(s => ({
        signer_name: s.signer_name.trim(),
        signer_role: s.signer_role.trim(),
        position_x: 100,
        position_y: 100,
        position_page: 1
      }));

      const response = await agreementsApi.createSignatures(agreementId, {
        signatures: signaturesData
      });

      setGeneratedLinks(response.data.data.signatureLinks);
      setStep('links');
      message.success(t('signaturesModal.messages.signaturesCreated'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('signaturesModal.errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    message.success(t('signaturesModal.messages.linkCopied'));
  };

  const handleUpdateSignature = async (id: number) => {
    if (!editingData) {
      message.error(t('signaturesModal.errors.noDataToSave'));
      return;
    }

    if (!editingData.signer_name.trim()) {
      message.error(t('signaturesModal.errors.enterSignerName'));
      return;
    }

    if (!editingData.signer_role.trim()) {
      message.error(t('signaturesModal.errors.selectRole'));
      return;
    }

    const otherSignatures = existingSignatures.filter(s => s.id !== id);
    const roleExists = otherSignatures.some(s => s.signer_role === editingData.signer_role);
    
    if (roleExists) {
      message.error(t('signaturesModal.errors.roleUsedByOther', { role: editingData.signer_role }));
      return;
    }

    try {
      await agreementsApi.updateSignature(id, {
        signer_name: editingData.signer_name.trim(),
        signer_role: editingData.signer_role.trim()
      });
      
      message.success(t('signaturesModal.messages.signatureUpdated'));
      setEditingSignature(null);
      setEditingData(null);
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('signaturesModal.errors.updateFailed'));
    }
  };

  const handleRegenerateLink = async (id: number) => {
    try {
      const response = await agreementsApi.regenerateSignatureLink(id);
      message.success(t('signaturesModal.messages.linkRegenerated'));
      copyLink(response.data.data.public_url);
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('signaturesModal.errors.regenerateFailed'));
    }
  };

  const handleDeleteSignature = async (id: number) => {
    try {
      await agreementsApi.deleteSignature(id);
      message.success(t('signaturesModal.messages.signatureDeleted'));
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('signaturesModal.errors.deleteFailed'));
    }
  };

  const getAvailableRoles = (currentSignerId: string) => {
    const usedRolesInNewSigners = signers
      .filter(s => s.id !== currentSignerId)
      .map(s => s.signer_role)
      .filter(role => role !== '');

    const usedRolesInExisting = existingSignatures.map(s => s.signer_role);
    const allUsedRoles = [...usedRolesInNewSigners, ...usedRolesInExisting];

    return partyRoles.filter(role => !allUsedRoles.includes(role));
  };

  const renderMobileSignatureCard = (record: AgreementSignature) => {
    const isEditing = editingSignature === record.id;

    return (
      <Card key={record.id} size="small" className="signature-mobile-card">
        <div className="signature-mobile-header">
          <div className="signature-mobile-info">
            {isEditing ? (
              <Input 
                size="small" 
                placeholder={t('signaturesModal.fields.name')}
                defaultValue={record.signer_name}
                onChange={(e) => {
                  setEditingData(prev => ({
                    signer_name: e.target.value,
                    signer_role: prev?.signer_role || record.signer_role
                  }));
                }}
                style={{ marginBottom: 8 }}
              />
            ) : (
              <>
                <div className="signature-mobile-name">{record.signer_name}</div>
                {record.first_visit_at && (
                  <div className="signature-mobile-visit">
                    <ClockCircleOutlined /> {t('signaturesModal.fields.visited')} {new Date(record.first_visit_at).toLocaleString('ru-RU')}
                  </div>
                )}
              </>
            )}
            
            {isEditing ? (
              <Select 
                size="small" 
                placeholder={t('signaturesModal.placeholders.selectRole')}
                defaultValue={record.signer_role}
                onChange={(value) => {
                  setEditingData(prev => ({
                    signer_name: prev?.signer_name || record.signer_name,
                    signer_role: value
                  }));
                }}
                style={{ width: '100%', marginTop: 8 }}
              >
                {partyRoles
                  .filter(role => {
                    return role === record.signer_role || !existingSignatures.some(s => s.id !== record.id && s.signer_role === role);
                  })
                  .map(role => (
                    <Option key={role} value={role}>{role}</Option>
                  ))
                }
              </Select>
            ) : (
              <Tag color="blue" className="signature-mobile-role">{record.signer_role}</Tag>
            )}
          </div>
          
          <div className="signature-mobile-status">
            <Space direction="vertical" size={2}>
              <Tag 
                color={record.is_signed ? 'success' : 'default'} 
                icon={record.is_signed ? <CheckOutlined /> : null}
              >
                {record.is_signed ? t('signaturesModal.status.signed') : t('signaturesModal.status.waiting')}
              </Tag>
              {record.is_signed && record.signed_at && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(record.signed_at).toLocaleDateString('ru-RU')}
                </Text>
              )}
            </Space>
          </div>
        </div>

        <div className="signature-mobile-actions">
          {isEditing ? (
            <>
              <Button 
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleUpdateSignature(record.id)}
              >
                {t('common.save')}
              </Button>
              <Button 
                size="small"
                onClick={() => {
                  setEditingSignature(null);
                  setEditingData(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
              >
                {t('signaturesModal.actions.copy')}
              </Button>
              <Button 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingData({
                    signer_name: record.signer_name,
                    signer_role: record.signer_role
                  });
                  setEditingSignature(record.id);
                }}
              >
                {t('signaturesModal.actions.edit')}
              </Button>
              <Popconfirm
                title={t('signaturesModal.confirm.regenerateTitle')}
                description={t('signaturesModal.confirm.regenerateDescription')}
                onConfirm={() => handleRegenerateLink(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                >
                  {t('signaturesModal.actions.update')}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t('signaturesModal.confirm.deleteTitle')}
                description={t('signaturesModal.confirm.deleteDescription')}
                onConfirm={() => handleDeleteSignature(record.id)}
                okText={t('common.delete')}
                okType="danger"
                cancelText={t('common.cancel')}
              >
                <Button 
                  size="small" 
                  danger
                  icon={<DeleteOutlined />}
                >
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            </>
          )}
        </div>
      </Card>
    );
  };

  // Колонки для десктопной таблицы
  const existingColumns: ColumnsType<AgreementSignature> = [
    {
      title: t('signaturesModal.table.signer'),
      dataIndex: 'signer_name',
      key: 'signer_name',
      width: '25%',
      render: (text, record) => {
        if (editingSignature === record.id) {
          return (
            <Input 
              size="small" 
              placeholder={t('signaturesModal.fields.name')}
              defaultValue={text}
              onChange={(e) => {
                setEditingData(prev => ({
                  signer_name: e.target.value,
                  signer_role: prev?.signer_role || record.signer_role
                }));
              }}
            />
          );
        }
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{text}</Text>
            {record.first_visit_at && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                <ClockCircleOutlined /> {t('signaturesModal.fields.visited')} {new Date(record.first_visit_at).toLocaleString('ru-RU')}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: t('signaturesModal.table.role'),
      dataIndex: 'signer_role',
      key: 'signer_role',
      width: '20%',
      render: (text, record) => {
        if (editingSignature === record.id) {
          return (
            <Select 
              size="small" 
              placeholder={t('signaturesModal.placeholders.selectRole')}
              defaultValue={text}
              onChange={(value) => {
                setEditingData(prev => ({
                  signer_name: prev?.signer_name || record.signer_name,
                  signer_role: value
                }));
              }}
              style={{ width: '100%' }}
            >
              {partyRoles
                .filter(role => {
                  return role === text || !existingSignatures.some(s => s.id !== record.id && s.signer_role === role);
                })
                .map(role => (
                  <Option key={role} value={role}>{role}</Option>
                ))
              }
            </Select>
          );
        }
        return <Tag color="blue">{text}</Tag>;
      }
    },
    {
      title: t('signaturesModal.table.status'),
      dataIndex: 'is_signed',
      key: 'is_signed',
      width: '15%',
      render: (is_signed, record) => (
        <Space direction="vertical" size={2}>
          <Tag 
            color={is_signed ? 'success' : 'default'} 
            icon={is_signed ? <CheckOutlined /> : null}
          >
            {is_signed ? t('signaturesModal.status.signed') : t('signaturesModal.status.waiting')}
          </Tag>
          {is_signed && record.signed_at && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(record.signed_at).toLocaleDateString('ru-RU')}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: t('signaturesModal.table.actions'),
      key: 'actions',
      width: '40%',
      render: (_, record) => {
        if (editingSignature === record.id) {
          return (
            <Space size="small">
              <Button 
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleUpdateSignature(record.id)}
              >
                {t('common.save')}
              </Button>
              <Button 
                size="small"
                onClick={() => {
                  setEditingSignature(null);
                  setEditingData(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </Space>
          );
        }

        return (
          <Space size="small" wrap>
            <Tooltip title={t('signaturesModal.tooltips.copyLink')}>
              <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
              />
            </Tooltip>
            <Tooltip title={t('signaturesModal.tooltips.edit')}>
              <Button 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingData({
                    signer_name: record.signer_name,
                    signer_role: record.signer_role
                  });
                  setEditingSignature(record.id);
                }}
              />
            </Tooltip>
            <Tooltip title={t('signaturesModal.tooltips.regenerate')}>
              <Popconfirm
                title={t('signaturesModal.confirm.regenerateTitle')}
                description={t('signaturesModal.confirm.regenerateDescription')}
                onConfirm={() => handleRegenerateLink(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                />
              </Popconfirm>
            </Tooltip>
            <Tooltip title={t('common.delete')}>
              <Popconfirm
                title={t('signaturesModal.confirm.deleteTitle')}
                description={t('signaturesModal.confirm.deleteDescription')}
                onConfirm={() => handleDeleteSignature(record.id)}
                okText={t('common.delete')}
                okType="danger"
                cancelText={t('common.cancel')}
              >
                <Button 
                  size="small" 
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  return (
    <Modal
      title={t('signaturesModal.title')}
      open={visible}
      onCancel={onCancel}
      width={isMobile ? '100%' : 900}
      footer={null}
      destroyOnClose
      className="signatures-modal-dark"
      style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0, paddingBottom: 0 } : {}}
    >
      {showExisting && existingSignatures.length > 0 && step === 'create' && (
        <Card 
          size="small" 
          title={
            <Space>
              <span>{t('signaturesModal.cards.existingSignatures')}</span>
              <Tag color="blue">
                {t('signaturesModal.cards.signedCount', {
                  signed: existingSignatures.filter(s => s.is_signed).length,
                  total: existingSignatures.length
                })}
              </Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {/* Desktop Table */}
          <div className="signatures-desktop-table">
            <Table
              dataSource={existingSignatures}
              columns={existingColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>

          {/* Mobile Cards */}
          <div className="signatures-mobile-cards">
            {existingSignatures.map(record => renderMobileSignatureCard(record))}
          </div>
        </Card>
      )}

      {step === 'create' ? (
        <>
          <Card size="small" title={t('signaturesModal.cards.addNewSigners')}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {signers.map((signer, index) => (
                <Card 
                  key={signer.id} 
                  size="small"
                  style={{ background: '#141414' }}
                  title={t('signaturesModal.cards.signerNumber', { number: index + 1 })}
                  extra={
                    signers.length > 1 && (
                      <Button 
                        danger 
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeSigner(signer.id!)}
                      >
                        {t('common.delete')}
                      </Button>
                    )
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary" strong>{t('signaturesModal.fields.signerName')} *</Text>
                      <Input
                        placeholder={t('signaturesModal.placeholders.signerName')}
                        value={signer.signer_name}
                        onChange={(e) => updateSigner(signer.id!, { signer_name: e.target.value })}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    <div>
                      <Text type="secondary" strong>{t('signaturesModal.fields.role')} *</Text>
                      <Select
                        placeholder={t('signaturesModal.placeholders.selectRole')}
                        value={signer.signer_role || undefined}
                        onChange={(value) => updateSigner(signer.id!, { signer_role: value })}
                        style={{ width: '100%', marginTop: 4 }}
                        showSearch
                        allowClear
                      >
                        {getAvailableRoles(signer.id!).map(role => (
                          <Option key={role} value={role}>{role}</Option>
                        ))}
                      </Select>
                      <Input
                        placeholder={t('signaturesModal.placeholders.customRole')}
                        value={!partyRoles.includes(signer.signer_role) ? signer.signer_role : ''}
                        onChange={(e) => updateSigner(signer.id!, { signer_role: e.target.value })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </Space>
                </Card>
              ))}
              
              <Button 
                type="dashed" 
                icon={<PlusOutlined />}
                onClick={addSigner}
                block
              >
                {t('signaturesModal.actions.addAnotherSigner')}
              </Button>
            </Space>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
              {requestUuid && existingSignatures.length > 0 && (
                <Button 
                  type="primary"
                  icon={<BellOutlined />}
                  onClick={handleNotifyAgent}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  {t('signaturesModal.actions.notifyAgent')}
                </Button>
              )}
            </div>
            <Button 
              type="primary" 
              onClick={handleCreate}
              loading={loading}
            >
              {t('signaturesModal.actions.createSignatures')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card size="small" title={t('signaturesModal.cards.signatureLinks')}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {generatedLinks.map((link, index) => (
                <Card key={index} size="small" style={{ background: '#f0f0f0' }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{link.signer_name}</Text>
                  </div>
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 100px)' }}
                      value={link.link}
                      readOnly
                    />
                    <Button 
                      icon={<CopyOutlined />}
                      onClick={() => copyLink(link.link)}
                    >
                      {t('signaturesModal.actions.copy')}
                    </Button>
                  </Input.Group>
                </Card>
              ))}
            </Space>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {requestUuid && (
                <Button 
                  type="primary"
                  icon={<BellOutlined />}
                  onClick={handleNotifyAgent}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  {t('signaturesModal.actions.notifyAgent')}
                </Button>
              )}
            </div>
            <Button type="primary" onClick={() => { onSuccess(); onCancel(); }}>
              {t('signaturesModal.actions.done')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default SignaturesModal;