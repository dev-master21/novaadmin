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
  Divider,
  QRCode
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';

const AgreementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (id) {
      fetchAgreement();
    }
  }, [id]);

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getById(Number(id));
      setAgreement(response.data.data);
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
    contentRef: printRef, // ИСПРАВЛЕНО: используем contentRef вместо content
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  const copyPublicLink = () => {
    if (agreement) {
      navigator.clipboard.writeText(agreement.public_link);
      message.success('Ссылка скопирована в буфер обмена');
    }
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
      active: { color: 'cyan', text: 'Активен' },
      expired: { color: 'warning', text: 'Истёк' },
      cancelled: { color: 'error', text: 'Отменён' }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      landlord: 'Арендодатель',
      tenant: 'Арендатор',
      agent: 'Агент',
      principal: 'Принципал',
      seller: 'Продавец',
      buyer: 'Покупатель'
    };
    return roleLabels[role] || role;
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Заголовок */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/agreements')}
            >
              Назад
            </Button>
            <div>
              <h2 style={{ margin: 0 }}>{agreement.agreement_number}</h2>
              <div style={{ color: '#999', fontSize: '14px' }}>
                {getStatusTag(agreement.status)}
              </div>
            </div>
          </Space>

          <Space>
            <Button icon={<LinkOutlined />} onClick={copyPublicLink}>
              Копировать ссылку
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handlePrint}>
              Скачать PDF
            </Button>
            <Button icon={<EditOutlined />}>
              Редактировать
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Удалить
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Вкладки */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Детали */}
        <Tabs.TabPane tab="Детали" key="details">
          <Card>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Номер договора">
                {agreement.agreement_number}
              </Descriptions.Item>
              <Descriptions.Item label="Тип">
                {agreement.type}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                {getStatusTag(agreement.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Город">
                {agreement.city}
              </Descriptions.Item>
              <Descriptions.Item label="Объект недвижимости" span={2}>
                {agreement.property_name ? (
                  <div>
                    {agreement.property_name}
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {agreement.property_number}
                    </div>
                  </div>
                ) : (
                  'Не указан'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Дата начала">
                {agreement.date_from ? new Date(agreement.date_from).toLocaleDateString('ru-RU') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Дата окончания">
                {agreement.date_to ? new Date(agreement.date_to).toLocaleDateString('ru-RU') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Описание" span={2}>
                {agreement.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Создан">
                {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
              <Descriptions.Item label="Создал">
                {agreement.created_by_name}
              </Descriptions.Item>
              <Descriptions.Item label="Публичная ссылка" span={2}>
                <a href={agreement.public_link} target="_blank" rel="noopener noreferrer">
                  {agreement.public_link}
                </a>
              </Descriptions.Item>
            </Descriptions>

            {agreement.qr_code_path && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Divider>QR код для быстрого доступа</Divider>
                <QRCode value={agreement.public_link} size={200} />
              </div>
            )}
          </Card>
        </Tabs.TabPane>

        {/* Стороны */}
        <Tabs.TabPane tab="Стороны" key="parties">
          <Card>
            <Table
              dataSource={agreement.parties || []}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Роль',
                  dataIndex: 'role',
                  key: 'role',
                  render: (role) => getRoleLabel(role) // ИСПОЛЬЗУЕМ функцию getRoleLabel
                },
                {
                  title: 'ФИО',
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
          </Card>
        </Tabs.TabPane>

        {/* Подписи */}
        <Tabs.TabPane tab="Подписи" key="signatures">
          <Card
            extra={
              <Button type="primary" icon={<PlusOutlined />}>
                Настроить подписи
              </Button>
            }
          >
            <Table
              dataSource={agreement.signatures || []}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Подписант',
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
                  title: 'Дата подписи',
                  dataIndex: 'signed_at',
                  key: 'signed_at',
                  render: (date) => date ? new Date(date).toLocaleString('ru-RU') : '-'
                },
                {
                  title: 'Ссылка',
                  key: 'link',
                  render: (_, record) => (
                    record.signature_link && !record.is_signed ? (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const link = `${window.location.origin}/sign/${record.signature_link}`;
                          navigator.clipboard.writeText(link);
                          message.success('Ссылка скопирована');
                        }}
                      >
                        Копировать
                      </Button>
                    ) : null
                  )
                }
              ]}
            />
          </Card>
        </Tabs.TabPane>

        {/* Документ */}
        <Tabs.TabPane tab="Документ" key="document">
          <Card>
            <div ref={printRef}>
              <div dangerouslySetInnerHTML={{ __html: agreement.content }} />
            </div>
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AgreementDetail;