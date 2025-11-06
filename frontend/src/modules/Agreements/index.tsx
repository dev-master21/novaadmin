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
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import CreateAgreementModal from './components/CreateAgreementModal';
import type { ColumnsType } from 'antd/es/table';

const { Search } = Input;
const { Option } = Select;

const Agreements = () => {
  const navigate = useNavigate();
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

  // Статистика
  const stats = {
    total: agreements.length,
    draft: agreements.filter(a => a.status === 'draft').length,
    pending: agreements.filter(a => a.status === 'pending_signatures').length,
    signed: agreements.filter(a => a.status === 'signed').length,
    active: agreements.filter(a => a.status === 'active').length
  };

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
      message.error(error.response?.data?.message || 'Ошибка загрузки договоров');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: 'Удалить договор?',
      content: 'Это действие нельзя отменить',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await agreementsApi.delete(id);
          message.success('Договор успешно удалён');
          fetchAgreements();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Ошибка удаления договора');
        }
      }
    });
  };

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

  const getTypeTag = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      rent: { color: 'blue', text: 'Аренда' },
      sale: { color: 'green', text: 'Купля-продажа' },
      bilateral: { color: 'purple', text: 'Двухсторонний' },
      trilateral: { color: 'orange', text: 'Трёхсторонний' },
      agency: { color: 'pink', text: 'Агентский' },
      transfer_act: { color: 'cyan', text: 'Акт передачи' }
    };

    const config = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<Agreement> = [
    {
      title: 'Номер договора',
      dataIndex: 'agreement_number',
      key: 'agreement_number',
      fixed: 'left',
      width: 200,
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/agreements/${record.id}`)}>
          {text}
        </Button>
      )
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type) => getTypeTag(type)
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Объект',
      key: 'property',
      width: 200,
      render: (_, record) => (
        record.property_name ? (
          <div>
            <div>{record.property_name}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>{record.property_number}</div>
          </div>
        ) : (
          <span style={{ color: '#999' }}>Не указан</span>
        )
      )
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: 'Подписи',
      key: 'signatures',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <span>
          {record.signed_count || 0} / {record.signature_count || 0}
        </span>
      )
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => new Date(date).toLocaleDateString('ru-RU')
    },
    {
      title: 'Создал',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 120
    },
    {
      title: 'Действия',
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
                label: 'Просмотр',
                onClick: () => navigate(`/agreements/${record.id}`)
              },
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: 'Редактировать',
                onClick: () => navigate(`/agreements/${record.id}?edit=true`)
              },
              {
                key: 'link',
                icon: <LinkOutlined />,
                label: 'Публичная ссылка',
                onClick: () => {
                  navigator.clipboard.writeText(record.public_link);
                  message.success('Ссылка скопирована');
                }
              },
              {
                type: 'divider'
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Удалить',
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
    <div style={{ padding: '24px' }}>
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card>
            <Statistic
              title="Всего"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card>
            <Statistic
              title="Черновиков"
              value={stats.draft}
              valueStyle={{ color: '#999' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card>
            <Statistic
              title="На подписи"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card>
            <Statistic
              title="Подписано"
              value={stats.signed}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card>
            <Statistic
              title="Активных"
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
            <span>Договоры</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="link"
              onClick={() => navigate('/agreements/templates')}
            >
              Шаблоны
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Создать договор
            </Button>
          </Space>
        }
      >
        {/* Фильтры и поиск */}
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Поиск по номеру или описанию"
                allowClear
                enterButton={<SearchOutlined />}
                onSearch={setSearchText}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Тип"
                allowClear
                onChange={setFilterType}
              >
                <Option value="rent">Аренда</Option>
                <Option value="sale">Купля-продажа</Option>
                <Option value="bilateral">Двухсторонний</Option>
                <Option value="trilateral">Трёхсторонний</Option>
                <Option value="agency">Агентский</Option>
                <Option value="transfer_act">Акт передачи</Option>
              </Select>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Статус"
                allowClear
                onChange={setFilterStatus}
              >
                <Option value="draft">Черновик</Option>
                <Option value="pending_signatures">На подписи</Option>
                <Option value="signed">Подписан</Option>
                <Option value="active">Активен</Option>
                <Option value="expired">Истёк</Option>
                <Option value="cancelled">Отменён</Option>
              </Select>
            </Col>
          </Row>
        </Space>

        {/* Таблица */}
        <Table
          columns={columns}
          dataSource={agreements}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Модальное окно создания */}
      <CreateAgreementModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          fetchAgreements();
        }}
      />
    </div>
  );
};

export default Agreements;