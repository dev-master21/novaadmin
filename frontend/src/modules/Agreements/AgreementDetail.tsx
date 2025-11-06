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
  Table
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';

const AgreementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedStructure, setEditedStructure] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAgreement();
    }
  }, [id]);

  useEffect(() => {
    // Проверяем query параметр edit
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      setIsEditing(true);
      setActiveTab('document');
    }
  }, [searchParams]);

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getById(Number(id));
      setAgreement(response.data.data);
      setEditedContent(response.data.data.content || '');
      setEditedStructure(response.data.data.structure || '');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки договора');
      navigate('/agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Удалить договор?',
      content: 'Это действие нельзя отменить',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await agreementsApi.delete(Number(id));
          message.success('Договор успешно удалён');
          navigate('/agreements');
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Ошибка удаления договора');
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
      message.success('Ссылка скопирована в буфер обмена');
    }
  };

  const handleContentChange = (content: string, structure?: string) => {
    setEditedContent(content);
    if (structure) {
      setEditedStructure(structure);
    }
  };

  const handleSaveEdit = async () => {
    if (!agreement) return;
    
    setSaving(true);
    try {
      await agreementsApi.update(agreement.id, {
        content: editedContent,
        structure: editedStructure
      });
      message.success('Договор успешно сохранён');
      setIsEditing(false);
      await fetchAgreement();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка сохранения договора');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    Modal.confirm({
      title: 'Отменить редактирование?',
      content: 'Несохранённые изменения будут потеряны',
      okText: 'Да, отменить',
      cancelText: 'Продолжить редактирование',
      onOk: () => {
        setIsEditing(false);
        setEditedContent(agreement?.content || '');
        setEditedStructure(agreement?.structure || '');
      }
    });
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
      draft: { color: 'default', text: 'Черновик' },
      pending_signatures: { color: 'processing', text: 'Ожидает подписей' },
      signed: { color: 'success', text: 'Подписан' },
      active: { color: 'success', text: 'Активен' },
      expired: { color: 'warning', text: 'Истёк' },
      cancelled: { color: 'error', text: 'Отменён' }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      rent: 'Аренда',
      sale: 'Продажа',
      bilateral: 'Двухсторонний',
      trilateral: 'Трёхсторонний',
      agency: 'Агентский',
      transfer_act: 'Акт передачи'
    };
    return types[type] || type;
  };

  const tabItems = [
    {
      key: 'document',
      label: 'Документ',
      children: (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
          {isEditing ? (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button 
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                >
                  Отмена
                </Button>
                <Button 
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveEdit}
                  loading={saving}
                >
                  Сохранить изменения
                </Button>
              </div>
              <div style={{ 
                background: '#fffbe6', 
                border: '1px solid #ffe58f', 
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <strong>Режим редактирования:</strong> Кликните на любой текст для редактирования. 
                Используйте зелёные кнопки для добавления секций, параграфов и списков.
              </div>
            </div>
          ) : null}
          
          <DocumentEditor
            ref={printRef}
            agreement={agreement}
            isEditing={isEditing}
            onContentChange={handleContentChange}
            logoUrl="/nova-logo.svg"
          />
        </div>
      )
    },
    {
      key: 'details',
      label: 'Детали',
      children: (
        <Card>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Номер договора" span={2}>
              {agreement.agreement_number}
            </Descriptions.Item>
            <Descriptions.Item label="Тип">
              {getTypeLabel(agreement.type)}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">
              {getStatusTag(agreement.status)}
            </Descriptions.Item>
            {agreement.property_name && (
              <Descriptions.Item label="Объект" span={2}>
                {agreement.property_name} ({agreement.property_number})
              </Descriptions.Item>
            )}
            {agreement.description && (
              <Descriptions.Item label="Описание" span={2}>
                {agreement.description}
              </Descriptions.Item>
            )}
            {agreement.date_from && (
              <Descriptions.Item label="Дата начала">
                {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            {agreement.date_to && (
              <Descriptions.Item label="Дата окончания">
                {new Date(agreement.date_to).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Город">
              {agreement.city}
            </Descriptions.Item>
            <Descriptions.Item label="Создан">
              {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
            </Descriptions.Item>
            {agreement.created_by_name && (
              <Descriptions.Item label="Создал" span={2}>
                {agreement.created_by_name}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )
    },
    {
      key: 'parties',
      label: 'Стороны',
      children: (
        <Card>
          {agreement.parties && agreement.parties.length > 0 ? (
            <Table
              dataSource={agreement.parties}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Роль',
                  dataIndex: 'role',
                  key: 'role',
                  render: (role) => {
                    const roles: Record<string, string> = {
                      landlord: 'Арендодатель',
                      tenant: 'Арендатор',
                      agent: 'Агент',
                      principal: 'Принципал',
                      seller: 'Продавец',
                      buyer: 'Покупатель',
                      party1: 'Сторона 1',
                      party2: 'Сторона 2',
                      party3: 'Сторона 3'
                    };
                    return roles[role] || role;
                  }
                },
                {
                  title: 'Имя',
                  dataIndex: 'name',
                  key: 'name'
                },
                {
                  title: 'Страна паспорта',
                  dataIndex: 'passport_country',
                  key: 'passport_country'
                },
                {
                  title: 'Номер паспорта',
                  dataIndex: 'passport_number',
                  key: 'passport_number'
                }
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Стороны не указаны
            </div>
          )}
        </Card>
      )
    },
    {
      key: 'signatures',
      label: 'Подписи',
      children: (
        <Card>
          {agreement.signatures && agreement.signatures.length > 0 ? (
            <Table
              dataSource={agreement.signatures}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Имя',
                  dataIndex: 'signer_name',
                  key: 'signer_name'
                },
                {
                  title: 'Роль',
                  dataIndex: 'signer_role',
                  key: 'signer_role'
                },
                {
                  title: 'Статус',
                  dataIndex: 'is_signed',
                  key: 'is_signed',
                  render: (is_signed) => (
                    <Tag color={is_signed ? 'success' : 'default'}>
                      {is_signed ? 'Подписано' : 'Ожидает'}
                    </Tag>
                  )
                },
                {
                  title: 'Дата подписания',
                  dataIndex: 'signed_at',
                  key: 'signed_at',
                  render: (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-'
                }
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Подписи не настроены
            </div>
          )}
        </Card>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <Space style={{ marginBottom: '16px', width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/agreements')}
            >
              Назад
            </Button>
            <h2 style={{ margin: 0 }}>Договор {agreement.agreement_number}</h2>
            {getStatusTag(agreement.status)}
          </Space>
          
          <Space>
            {!isEditing && (
              <>
                <Button 
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                >
                  Редактировать
                </Button>
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={handlePrint}
                >
                  PDF
                </Button>
                <Button 
                  icon={<LinkOutlined />}
                  onClick={copyPublicLink}
                >
                  Скопировать ссылку
                </Button>
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                >
                  Удалить
                </Button>
              </>
            )}
          </Space>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default AgreementDetail;