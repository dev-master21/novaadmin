// frontend/src/modules/Agreements/Templates/index.tsx
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
  Switch
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoreOutlined,
  SearchOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import type { ColumnsType } from 'antd/es/table';
import './Templates.css';

const { Search } = Input;

const AgreementTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getTemplates();
      setTemplates(response.data.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: 'Удалить шаблон?',
      content: 'Это действие нельзя отменить',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await agreementsApi.deleteTemplate(id);
          message.success('Шаблон успешно удалён');
          fetchTemplates();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Ошибка удаления шаблона');
        }
      }
    });
  };

  const toggleActive = async (id: number, is_active: boolean) => {
    try {
      await agreementsApi.updateTemplate(id, { is_active: !is_active });
      message.success(is_active ? 'Шаблон деактивирован' : 'Шаблон активирован');
      fetchTemplates();
    } catch (error: any) {
      message.error('Ошибка обновления шаблона');
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchText.toLowerCase()) ||
    template.type.toLowerCase().includes(searchText.toLowerCase())
  );

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

  const columns: ColumnsType<AgreementTemplate> = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/agreements/templates/${record.id}/view`)}>
          {text}
        </Button>
      )
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      render: (type) => getTypeTag(type),
      responsive: ['md']
    },
    {
      title: 'Версия',
      dataIndex: 'version',
      key: 'version',
      align: 'center',
      width: 100,
      responsive: ['lg']
    },
    {
      title: 'Использован',
      dataIndex: 'usage_count',
      key: 'usage_count',
      align: 'center',
      width: 120,
      render: (count) => `${count || 0} раз`,
      responsive: ['xl']
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (is_active, record) => (
        <Switch
          checked={is_active}
          onChange={() => toggleActive(record.id, is_active)}
          checkedChildren="Вкл"
          unCheckedChildren="Выкл"
          size="small"
        />
      ),
      responsive: ['lg']
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('ru-RU'),
      responsive: ['xl']
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: 'Просмотр',
                onClick: () => navigate(`/agreements/templates/${record.id}`)
              },
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: 'Редактировать',
                onClick: () => navigate(`/agreements/templates/${record.id}/edit`)
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
    <div className="templates-container">
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/agreements')}
            >
              К договорам
            </Button>
            <span>Шаблоны договоров</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/agreements/templates/create')}
          >
            <span className="create-template-text">Создать шаблон</span>
          </Button>
        }
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Search
            placeholder="Поиск по названию или типу"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={setSearchText}
            style={{ maxWidth: 400 }}
          />
        </Space>

        {/* Таблица для десктопа */}
        <div className="desktop-table">
          <Table
            columns={columns}
            dataSource={filteredTemplates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Всего: ${total}`
            }}
          />
        </div>

        {/* Карточки для мобильных */}
        <div className="mobile-cards">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Загрузка...</div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Шаблоны не найдены
            </div>
          ) : (
            filteredTemplates.map(template => (
              <Card 
                key={template.id} 
                size="small" 
                className="mobile-template-card"
                onClick={() => navigate(`/agreements/templates/${template.id}`)}
              >
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{template.name}</div>
                  <div className="mobile-card-badges">
                    {getTypeTag(template.type)}
                    <Tag color={template.is_active ? 'success' : 'default'}>
                      {template.is_active ? 'Активен' : 'Неактивен'}
                    </Tag>
                  </div>
                </div>
                
                <div className="mobile-card-info">
                  <span>Версия: {template.version}</span>
                  <span>•</span>
                  <span>Использован: {template.usage_count || 0} раз</span>
                </div>
                
                <div className="mobile-card-footer">
                  <div className="mobile-card-date">
                    {new Date(template.created_at).toLocaleDateString('ru-RU')}
                  </div>
                  <Space>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agreements/templates/${template.id}/edit`);
                      }}
                    >
                      Редактировать
                    </Button>
                  </Space>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default AgreementTemplates;