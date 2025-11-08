// frontend/src/modules/Agreements/components/SignaturesModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
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
  const [editForm] = Form.useForm();

  // Извлекаем уникальные роли из parties
  const partyRoles = [...new Set(parties.map(p => p.role))];

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

  const handleCreate = async () => {
    // Валидация
    const invalidSigners = signers.filter(s => 
      !s.signer_name.trim() || !s.signer_role.trim()
    );

    if (invalidSigners.length > 0) {
      message.error('Заполните имя и роль для всех подписантов');
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
    try {
      const values = await editForm.validateFields();
      await agreementsApi.updateSignature(id, {
        signer_name: values.signer_name,
        signer_role: values.signer_role
      });
      message.success('Подпись обновлена');
      setEditingSignature(null);
      onSuccess();
    } catch (error: any) {
      if (error.errorFields) return; // Validation error
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

  const existingColumns: ColumnsType<AgreementSignature> = [
    {
      title: 'Подписант',
      dataIndex: 'signer_name',
      key: 'signer_name',
      width: '25%',
      render: (text, record) => {
        if (editingSignature === record.id) {
          return (
            <Form.Item
              name="signer_name"
              style={{ margin: 0 }}
              rules={[{ required: true, message: 'Введите имя' }]}
            >
              <Input size="small" placeholder="Имя" />
            </Form.Item>
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
            <Form.Item
              name="signer_role"
              style={{ margin: 0 }}
              rules={[{ required: true, message: 'Введите роль' }]}
            >
              <Input size="small" placeholder="Роль" />
            </Form.Item>
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
                onClick={() => setEditingSignature(null)}
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
                  setEditingSignature(record.id);
                  editForm.setFieldsValue({
                    signer_name: record.signer_name,
                    signer_role: record.signer_role
                  });
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
      width={900}
      footer={null}
      destroyOnClose
      className="signatures-modal-dark"
    >
      <Form form={editForm} component={false} />

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
          <Table
            dataSource={existingSignatures}
            columns={existingColumns}
            rowKey="id"
            pagination={false}
            size="small"
          />
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
                  style={{ background: '#fafafa' }}
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
                        {partyRoles.map(role => (
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