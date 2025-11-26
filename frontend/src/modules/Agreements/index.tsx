// frontend/src/modules/Agreements/index.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Dropdown,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  Select
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  LinkOutlined,
  DollarOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import CreateAgreementModal from './components/CreateAgreementModal';
import type { ColumnsType } from 'antd/es/table';
import './Agreements.css';

const { Search } = Input;
const { Option } = Select;

const Agreements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  const stats = {
    total: agreements.length,
    draft: agreements.filter(a => a.status === 'draft').length,
    pending: agreements.filter(a => a.status === 'pending_signatures').length,
    signed: agreements.filter(a => a.status === 'signed').length,
    active: agreements.filter(a => a.status === 'active').length
  };

  useEffect(() => {
    const requestUuid = searchParams.get('request_uuid');
    if (requestUuid) {
      setCreateModalVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAgreements();
  }, [pagination.current, pagination.pageSize, searchText, filterType, filterStatus]);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined
      });

      setAgreements(response.data.data);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('agreements.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: t('agreements.confirm.deleteTitle'),
      content: t('agreements.confirm.deleteDescription'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await agreementsApi.delete(id);
          message.success(t('agreements.messages.deleted'));
          fetchAgreements();
        } catch (error: any) {
          message.error(error.response?.data?.message || t('agreements.messages.deleteError'));
        }
      }
    });
  };

  const copyPublicLink = (link: string) => {
    navigator.clipboard.writeText(link);
    message.success(t('agreements.messages.linkCopied'));
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: t('agreements.statuses.draft') },
      pending_signatures: { color: 'processing', text: t('agreements.statuses.pendingSignatures') },
      signed: { color: 'success', text: t('agreements.statuses.signed') },
      active: { color: 'success', text: t('agreements.statuses.active') },
      expired: { color: 'warning', text: t('agreements.statuses.expired') },
      cancelled: { color: 'error', text: t('agreements.statuses.cancelled') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeTag = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      rent: { color: 'blue', text: t('agreements.types.rent') },
      sale: { color: 'green', text: t('agreements.types.sale') },
      bilateral: { color: 'purple', text: t('agreements.types.bilateral') },
      trilateral: { color: 'orange', text: t('agreements.types.trilateral') },
      agency: { color: 'pink', text: t('agreements.types.agency') },
      transfer_act: { color: 'cyan', text: t('agreements.types.transferAct') }
    };
    
    const config = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<Agreement> = [
    {
      title: t('agreements.table.number'),
      dataIndex: 'agreement_number',
      key: 'agreement_number',
      width: 200,
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/agreements/${record.id}`)}>
          {text}
        </Button>
      ),
      responsive: ['md']
    },
    {
      title: t('agreements.table.type'),
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type) => getTypeTag(type),
      responsive: ['lg']
    },
    {
      title: t('agreements.table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => getStatusTag(status),
      responsive: ['md']
    },
    {
      title: t('agreements.table.property'),
      key: 'property',
      width: 200,
      render: (_, record) => (
        record.property_name ? (
          <div>
            <div>{record.property_name}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>{record.property_number}</div>
          </div>
        ) : (
          <span style={{ color: '#999' }}>{t('agreements.notSpecified')}</span>
        )
      ),
      responsive: ['xl']
    },
    {
      title: t('agreements.table.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
      responsive: ['xxl']
    },
    {
      title: t('agreements.table.signatures'),
      key: 'signatures',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <span>
          {record.signed_count || 0} / {record.signature_count || 0}
        </span>
      ),
      responsive: ['lg']
    },
    {
      title: t('agreements.table.created'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
      responsive: ['xl']
    },
    {
      title: t('agreements.table.actions'),
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
                label: t('agreements.actions.view'),
                onClick: () => navigate(`/agreements/${record.id}`)
              },
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: t('agreements.actions.edit'),
                onClick: () => navigate(`/agreements/${record.id}?edit=true`)
              },
              {
                key: 'link',
                icon: <LinkOutlined />,
                label: t('agreements.actions.publicLink'),
                onClick: () => copyPublicLink(record.public_link)
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
    <div className="agreements-container">
      {/* Статистика */}
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col xs={12} sm={6} md={4}>
          <Card>
            <Statistic
              title={t('agreements.stats.total')}
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card>
            <Statistic
              title={t('agreements.stats.drafts')}
              value={stats.draft}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card>
            <Statistic
              title={t('agreements.stats.pending')}
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card>
            <Statistic
              title={t('agreements.stats.signed')}
              value={stats.signed}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card>
            <Statistic
              title={t('agreements.stats.active')}
              value={stats.active}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная карточка */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>{t('agreements.title')}</span>
          </Space>
        }
        extra={
          <Space wrap className="card-extra-actions">
            <Button
              type="link"
              onClick={() => navigate('/agreements/templates')}
              className="templates-link"
            >
              {t('agreements.buttons.templates')}
            </Button>
            <Button
              type="default"
              icon={<DollarOutlined />}
              onClick={() => navigate('/financial-documents')}
            >
              <span className="create-button-text">{t('agreements.buttons.invoicesAndReceipts')}</span>
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              <span className="create-button-text">{t('agreements.buttons.createAgreement')}</span>
            </Button>
          </Space>
        }
      >
        {/* Фильтры и поиск */}
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder={t('agreements.placeholders.search')}
                allowClear
                enterButton={<SearchOutlined />}
                onSearch={setSearchText}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder={t('agreements.filters.type')}
                allowClear
                onChange={setFilterType}
              >
                <Option value="rent">{t('agreements.types.rent')}</Option>
                <Option value="sale">{t('agreements.types.sale')}</Option>
                <Option value="bilateral">{t('agreements.types.bilateral')}</Option>
                <Option value="trilateral">{t('agreements.types.trilateral')}</Option>
                <Option value="agency">{t('agreements.types.agency')}</Option>
                <Option value="transfer_act">{t('agreements.types.transferAct')}</Option>
              </Select>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder={t('agreements.filters.status')}
                allowClear
                onChange={setFilterStatus}
              >
                <Option value="draft">{t('agreements.statuses.draft')}</Option>
                <Option value="pending_signatures">{t('agreements.statuses.pendingSignatures')}</Option>
                <Option value="signed">{t('agreements.statuses.signed')}</Option>
                <Option value="active">{t('agreements.statuses.active')}</Option>
                <Option value="expired">{t('agreements.statuses.expired')}</Option>
                <Option value="cancelled">{t('agreements.statuses.cancelled')}</Option>
              </Select>
            </Col>
          </Row>
        </Space>

        {/* Таблица для десктопа */}
        <div className="desktop-table">
          <Table
            columns={columns}
            dataSource={agreements}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => t('agreements.pagination.total', { total }),
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              }
            }}
            scroll={{ x: 1200 }}
          />
        </div>

        {/* Карточки для мобильных */}
        <div className="mobile-cards">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>{t('agreements.loading')}</div>
          ) : agreements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {t('agreements.noAgreements')}
            </div>
          ) : (
            <>
              {agreements.map(agreement => (
                <Card 
                  key={agreement.id} 
                  size="small" 
                  className="mobile-agreement-card"
                  onClick={() => navigate(`/agreements/${agreement.id}`)}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-number">{agreement.agreement_number}</div>
                    <div className="mobile-card-badges">
                      {getTypeTag(agreement.type)}
                      {getStatusTag(agreement.status)}
                    </div>
                  </div>
                  
                  {agreement.property_name && (
                    <div className="mobile-card-property">
                      <strong>{t('agreements.mobile.property')}:</strong> {agreement.property_name}
                    </div>
                  )}
                  
                  <div className="mobile-card-footer">
                    <div className="mobile-card-date">
                      {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
                    </div>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agreements/${agreement.id}`);
                      }}
                    >
                      {t('agreements.mobile.view')}
                    </Button>
                  </div>
                </Card>
              ))}
              
              {/* Пагинация для мобильных */}
              {pagination.total > pagination.pageSize && (
                <div className="mobile-pagination">
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                  >
                    {t('agreements.pagination.back')}
                  </Button>
                  <span className="mobile-pagination-info">
                    {t('agreements.pagination.pageInfo', {
                      current: pagination.current,
                      total: Math.ceil(pagination.total / pagination.pageSize)
                    })}
                  </span>
                  <Button
                    disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                  >
                    {t('agreements.pagination.forward')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Модальное окно создания */}
      <CreateAgreementModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSearchParams({});
        }}
        onSuccess={() => {
          setCreateModalVisible(false);
          setSearchParams({}); 
          fetchAgreements();
        }}
      />
    </div>
  );
};

export default Agreements;