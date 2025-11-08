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
  ClockCircleOutlined
} from '@ant-design/icons';
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
  existingSignatures = []
}: SignaturesModalProps) => {
  const [loading, setLoading] = useState(false);
  const [signers, setSigners] = useState<SignerData[]>([]);
  const [showExisting, setShowExisting] = useState(existingSignatures.length > 0);
  const [generatedLinks, setGeneratedLinks] = useState<any[]>([]);
  const [step, setStep] = useState<'create' | 'links'>('create');
  const [editingSignature, setEditingSignature] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EditingData | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Извлекаем уникальные роли из parties
  const partyRoles = [...new Set(parties.map(p => p.role))];

  // Отслеживаем размер экрана
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

  const validateUniqueRoles = (signersToValidate: SignerData[]): boolean => {
    const roles = signersToValidate
      .map(s => s.signer_role.trim())
      .filter(role => role !== '');

    const roleSet = new Set(roles);
    
    if (roles.length !== roleSet.size) {
      const duplicates = roles.filter((role, index) => roles.indexOf(role) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      message.error(`Роль "${uniqueDuplicates[0]}" указана для нескольких подписантов. Каждая роль должна быть уникальной.`);
      return false;
    }

    const existingRoles = existingSignatures.map(s => s.signer_role);
    const conflictingRoles = roles.filter(role => existingRoles.includes(role));
    
    if (conflictingRoles.length > 0) {
      message.error(`Роль "${conflictingRoles[0]}" уже используется в существующих подписях. Выберите другую роль.`);
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    const invalidSigners = signers.filter(s => 
      !s.signer_name.trim() || !s.signer_role.trim()
    );

    if (invalidSigners.length > 0) {
      message.error('Заполните имя и роль для всех подписантов');
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
      message.success('Подписи успешно созданы');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания подписей');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    message.success('Ссылка скопирована');
  };

  const handleUpdateSignature = async (id: number) => {
    if (!editingData) {
      message.error('Нет данных для сохранения');
      return;
    }

    if (!editingData.signer_name.trim()) {
      message.error('Введите имя подписанта');
      return;
    }

    if (!editingData.signer_role.trim()) {
      message.error('Выберите роль');
      return;
    }

    const otherSignatures = existingSignatures.filter(s => s.id !== id);
    const roleExists = otherSignatures.some(s => s.signer_role === editingData.signer_role);
    
    if (roleExists) {
      message.error(`Роль "${editingData.signer_role}" уже используется другим подписантом. Выберите другую роль.`);
      return;
    }

    try {
      await agreementsApi.updateSignature(id, {
        signer_name: editingData.signer_name.trim(),
        signer_role: editingData.signer_role.trim()
      });
      
      message.success('Подпись успешно обновлена');
      setEditingSignature(null);
      setEditingData(null);
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления');
    }
  };

  const handleRegenerateLink = async (id: number) => {
    try {
      const response = await agreementsApi.regenerateSignatureLink(id);
      message.success('Ссылка перегенерирована');
      copyLink(response.data.data.public_url);
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка перегенерации');
    }
  };

  const handleDeleteSignature = async (id: number) => {
    try {
      await agreementsApi.deleteSignature(id);
      message.success('Подпись удалена');
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка удаления');
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

  // Рендер мобильной карточки
  const renderMobileSignatureCard = (record: AgreementSignature) => {
    const isEditing = editingSignature === record.id;

    return (
      <Card key={record.id} size="small" className="signature-mobile-card">
        <div className="signature-mobile-header">
          <div className="signature-mobile-info">
            {isEditing ? (
              <Input 
                size="small" 
                placeholder="Имя"
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
                    <ClockCircleOutlined /> Посещал {new Date(record.first_visit_at).toLocaleString('ru-RU')}
                  </div>
                )}
              </>
            )}
            
            {isEditing ? (
              <Select 
                size="small" 
                placeholder="Выберите роль"
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
                {record.is_signed ? 'Подписано' : 'Ожидает'}
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
                Сохранить
              </Button>
              <Button 
                size="small"
                onClick={() => {
                  setEditingSignature(null);
                  setEditingData(null);
                }}
              >
                Отмена
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
              >
                Копировать
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
                Редактировать
              </Button>
              <Popconfirm
                title="Перегенерировать ссылку?"
                description="Старая ссылка станет недействительной"
                onConfirm={() => handleRegenerateLink(record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                >
                  Обновить
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Удалить подпись?"
                description="Это действие нельзя отменить"
                onConfirm={() => handleDeleteSignature(record.id)}
                okText="Удалить"
                okType="danger"
                cancelText="Отмена"
              >
                <Button 
                  size="small" 
                  danger
                  icon={<DeleteOutlined />}
                >
                  Удалить
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
      title: 'Подписант',
      dataIndex: 'signer_name',
      key: 'signer_name',
      width: '25%',
      render: (text, record) => {
        if (editingSignature === record.id) {
          return (
            <Input 
              size="small" 
              placeholder="Имя"
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
                <ClockCircleOutlined /> Посещал {new Date(record.first_visit_at).toLocaleString('ru-RU')}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Роль',
      dataIndex: 'signer_role',
      key: 'signer_role',
      width: '20%',
      render: (text, record) => {
        if (editingSignature === record.id) {
          return (
            <Select 
              size="small" 
              placeholder="Выберите роль"
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
      title: 'Статус',
      dataIndex: 'is_signed',
      key: 'is_signed',
      width: '15%',
      render: (is_signed, record) => (
        <Space direction="vertical" size={2}>
          <Tag 
            color={is_signed ? 'success' : 'default'} 
            icon={is_signed ? <CheckOutlined /> : null}
          >
            {is_signed ? 'Подписано' : 'Ожидает'}
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
      title: 'Действия',
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
                Сохранить
              </Button>
              <Button 
                size="small"
                onClick={() => {
                  setEditingSignature(null);
                  setEditingData(null);
                }}
              >
                Отмена
              </Button>
            </Space>
          );
        }

        return (
          <Space size="small" wrap>
            <Tooltip title="Копировать ссылку">
              <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyLink(`https://agreement.novaestate.company/sign/${record.signature_link}`)}
              />
            </Tooltip>
            <Tooltip title="Редактировать">
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
            <Tooltip title="Перегенерировать ссылку">
              <Popconfirm
                title="Перегенерировать ссылку?"
                description="Старая ссылка станет недействительной"
                onConfirm={() => handleRegenerateLink(record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                />
              </Popconfirm>
            </Tooltip>
            <Tooltip title="Удалить">
              <Popconfirm
                title="Удалить подпись?"
                description="Это действие нельзя отменить"
                onConfirm={() => handleDeleteSignature(record.id)}
                okText="Удалить"
                okType="danger"
                cancelText="Отмена"
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
      title="Управление подписями"
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
              <span>Существующие подписи</span>
              <Tag color="blue">
                {existingSignatures.filter(s => s.is_signed).length} / {existingSignatures.length} подписано
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
          <Card size="small" title="Добавить новых подписантов">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {signers.map((signer, index) => (
                <Card 
                  key={signer.id} 
                  size="small"
                  style={{ background: '#141414' }}
                  title={`Подписант ${index + 1}`}
                  extra={
                    signers.length > 1 && (
                      <Button 
                        danger 
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeSigner(signer.id!)}
                      >
                        Удалить
                      </Button>
                    )
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary" strong>Имя подписанта *</Text>
                      <Input
                        placeholder="Иван Иванов"
                        value={signer.signer_name}
                        onChange={(e) => updateSigner(signer.id!, { signer_name: e.target.value })}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    <div>
                      <Text type="secondary" strong>Роль *</Text>
                      <Select
                        placeholder="Выберите роль"
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
                        placeholder="Или введите кастомную роль"
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
                Добавить ещё подписанта
              </Button>
            </Space>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onCancel}>Отмена</Button>
            <Button 
              type="primary" 
              onClick={handleCreate}
              loading={loading}
            >
              Создать подписи
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card size="small" title="Ссылки для подписания">
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
                      Копировать
                    </Button>
                  </Input.Group>
                </Card>
              ))}
            </Space>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => { onSuccess(); onCancel(); }}>
              Готово
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default SignaturesModal;