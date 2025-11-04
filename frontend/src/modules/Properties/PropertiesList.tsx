// frontend/src/modules/Properties/PropertiesList.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Input,
  Select,
  Table,
  Tag,
  Popconfirm,
  Row,
  Col,
  Tooltip,
  Image
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  HomeOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  DollarOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { useAuthStore } from '@/store/authStore';
import PricingModal from './components/PricingModal';
import CalendarModal from './components/CalendarModal';
import type { Property } from './types';
import type { ColumnsType } from 'antd/es/table';
import './PropertiesList.css';

const PropertiesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    deal_type: undefined,
    property_type: undefined
  });
  const [isMobile, setIsMobile] = useState(false);

  // Модальные окна
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadProperties();
  }, [pagination.current, pagination.pageSize]);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setProperties(data.data.properties);
      setPagination(prev => ({
        ...prev,
        total: data.data.pagination.total
      }));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await propertiesApi.delete(id);
      message.success(t('properties.deleteSuccess'));
      loadProperties();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    }
  };

  const handleTableChange = (newPagination: any) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      total: pagination.total
    });
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadProperties();
  };

  const handleReset = () => {
    setFilters({
      search: '',
      status: undefined,
      deal_type: undefined,
      property_type: undefined
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(loadProperties, 100);
  };

  const openPricingModal = (id: number) => {
    setSelectedPropertyId(id);
    setPricingModalVisible(true);
  };

  const openCalendarModal = (id: number) => {
    setSelectedPropertyId(id);
    setCalendarModalVisible(true);
  };

  // Мобильный вид - карточки
  const MobileView = () => (
    <>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {properties.map((property: any) => (
          <Card
            key={property.id}
            size="small"
            style={{ borderRadius: 8 }}
            bodyStyle={{ padding: 12 }}
          >
            <Row gutter={[12, 12]}>
              {/* Изображение */}
              <Col span={8}>
                {property.cover_photo ? (
                  <Image
                    src={property.cover_photo}
                    alt={property.property_name || property.property_number}
                    style={{
                      width: '100%',
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 6
                    }}
                    preview={{
                      mask: <EyeOutlined />
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 80,
                      background: '#1f1f1f',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <HomeOutlined style={{ fontSize: 32, color: '#666' }} />
                  </div>
                )}
              </Col>

              {/* Информация */}
              <Col span={16}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {/* Название объекта */}
                  <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                    {property.property_name || property.property_number}
                  </div>

                  {/* Номер объекта */}
                  <div style={{ color: '#666', fontSize: 12 }}>
                    #{property.property_number}
                  </div>

                  {/* Источник */}
                  {property.source_name && (
                    <div style={{ color: '#666', fontSize: 12 }}>
                      {t('properties.source')}: {property.source_name}
                    </div>
                  )}

                  {/* Кто добавил */}
                  <div style={{ color: '#666', fontSize: 11 }}>
                    {t('properties.addedBy')}: {property.creator_name}
                  </div>

                  {/* Теги */}
                  <Space wrap size={4}>
                    <Tag 
                      color={property.deal_type === 'sale' ? 'green' : property.deal_type === 'rent' ? 'blue' : 'purple'} 
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {property.deal_type === 'sale' 
                        ? t('properties.dealTypes.sale') 
                        : property.deal_type === 'rent'
                        ? t('properties.dealTypes.rent')
                        : t('properties.dealTypes.both')}
                    </Tag>
                    {property.status === 'published' ? (
                      <Tag color="success" icon={<EyeOutlined />} style={{ fontSize: 11, margin: 0 }}>
                        {t('properties.published')}
                      </Tag>
                    ) : (
                      <Tag color="default" icon={<EyeInvisibleOutlined />} style={{ fontSize: 11, margin: 0 }}>
                        {t('properties.draft')}
                      </Tag>
                    )}
                  </Space>
                </Space>
              </Col>

              {/* Кнопки действий */}
              <Col span={24}>
                <Space size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<DollarOutlined />}
                      onClick={() => openPricingModal(property.id)}
                    >
                      {t('properties.prices')}
                    </Button>
                    <Button
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => openCalendarModal(property.id)}
                    >
                      {t('properties.calendar.button')}
                    </Button>
                  </Space>
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/properties/edit/${property.id}`)}
                    />
                    {hasPermission('properties.delete') && (
                      <Popconfirm
                        title={t('properties.confirmDelete')}
                        onConfirm={() => handleDelete(property.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    )}
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>
        ))}
      </Space>

      {/* Пагинация для мобильной версии */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ color: '#888', fontSize: 13 }}>
            {t('common.total', { total: pagination.total })}
          </div>
          <Space>
            <Button
              disabled={pagination.current === 1}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
            >
              {t('common.previous')}
            </Button>
            <span style={{ padding: '0 12px' }}>
              {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <Button
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
            >
              {t('common.next')}
            </Button>
          </Space>
        </Space>
      </div>
    </>
  );

  // Десктопный вид - таблица
  const columns: ColumnsType<any> = [
    {
      title: t('properties.photo'),
      key: 'cover_photo',
      width: 80,
      render: (_: any, record: any) => (
        record.cover_photo ? (
          <Image
            src={record.cover_photo}
            alt={record.property_number}
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div
            style={{
              width: 60,
              height: 60,
              background: '#1f1f1f',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <HomeOutlined style={{ fontSize: 24, color: '#666' }} />
          </div>
        )
      )
    },
    {
      title: t('properties.name'),
      dataIndex: 'property_name',
      key: 'property_name',
      width: 200,
      ellipsis: true,
      render: (text: string) => <strong>{text || '—'}</strong>
    },
    {
      title: '#',
      dataIndex: 'property_number',
      key: 'property_number',
      width: 80,
      render: (text: string) => <span style={{ color: '#888' }}>{text}</span>
    },
    {
      title: t('properties.source'),
      dataIndex: 'source_name',
      key: 'source_name',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '—'
    },
    {
      title: t('properties.addedBy'),
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 150,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      )
    },
    {
      title: t('properties.dealType'),
      dataIndex: 'deal_type',
      key: 'deal_type',
      width: 120,
      render: (type: string) => {
        if (type === 'sale') {
          return <Tag color="green">{t('properties.dealTypes.sale')}</Tag>;
        } else if (type === 'rent') {
          return <Tag color="blue">{t('properties.dealTypes.rent')}</Tag>;
        } else if (type === 'both') {
          return <Tag color="purple">{t('properties.dealTypes.both')}</Tag>;
        }
        return <Tag>{type}</Tag>;
      }
    },
    {
      title: t('properties.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: string) => (
        status === 'published' ? (
          <Tag color="success" icon={<EyeOutlined />}>
            {t('properties.published')}
          </Tag>
        ) : (
          <Tag color="default" icon={<EyeInvisibleOutlined />}>
            {t('properties.draft')}
          </Tag>
        )
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title={t('properties.prices')}>
            <Button
              type="link"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openPricingModal(record.id)}
            />
          </Tooltip>
          <Tooltip title={t('properties.calendar.button')}>
            <Button
              type="link"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => openCalendarModal(record.id)}
            />
          </Tooltip>
          <Tooltip title={t('common.edit')}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/properties/edit/${record.id}`)}
            />
          </Tooltip>
          {hasPermission('properties.delete') && (
            <Popconfirm
              title={t('properties.confirmDelete')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <HomeOutlined />
            {t('properties.title')}
          </Space>
        }
        extra={
          hasPermission('properties.create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/properties/new')}
              size={isMobile ? 'middle' : 'large'}
            >
              {!isMobile && t('properties.add')}
            </Button>
          )
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Фильтры */}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={24} md={8}>
              <Input
                placeholder={t('properties.search')}
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onPressEnter={handleSearch}
                allowClear
              />
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Select
                placeholder={t('properties.status')}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'draft', label: t('properties.draft') },
                  { value: 'published', label: t('properties.published') }
                ]}
              />
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Select
                placeholder={t('properties.dealType')}
                value={filters.deal_type}
                onChange={(value) => setFilters({ ...filters, deal_type: value })}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'sale', label: t('properties.sale') },
                  { value: 'rent', label: t('properties.rent') }
                ]}
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Space size="small" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  block={isMobile}
                >
                  {t('common.search')}
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  {t('common.reset')}
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Список объектов */}
          {isMobile ? (
            <MobileView />
          ) : (
            <Table
              columns={columns}
              dataSource={properties}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => t('common.total', { total }),
                pageSizeOptions: ['10', '20', '50', '100']
              }}
              onChange={handleTableChange}
              scroll={{ x: 1400 }}
            />
          )}
        </Space>
      </Card>

      {/* Модальные окна */}
      {selectedPropertyId && (
        <>
          <PricingModal
            propertyId={selectedPropertyId}
            visible={pricingModalVisible}
            onClose={() => setPricingModalVisible(false)}
          />
          <CalendarModal
            propertyId={selectedPropertyId}
            visible={calendarModalVisible}
            onClose={() => setCalendarModalVisible(false)}
          />
        </>
      )}
    </>
  );
};

export default PropertiesList;