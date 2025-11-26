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
  CalendarOutlined,
  UserOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { useAuthStore } from '@/store/authStore';
import PricingModal from './components/PricingModal';
import CalendarModal from './components/CalendarModal';
import OwnerInfoModal from './components/OwnerInfoModal';
import PropertyHTMLGeneratorModal from './components/PropertyHTMLGeneratorModal';
import type { Property } from './types';
import type { ColumnsType } from 'antd/es/table';
import './PropertiesList.css';

const PropertiesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const { 
    hasPermission, 
    canEditProperty, 
    canViewPropertyOwner, 
    canDeleteProperty 
  } = useAuthStore();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [uniqueOwners, setUniqueOwners] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    deal_type: undefined,
    property_type: undefined,
    owner_name: undefined
  });
  const [isMobile, setIsMobile] = useState(false);

  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [ownerInfoModalVisible, setOwnerInfoModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedOwnerData, setSelectedOwnerData] = useState<any>(null);

  const [htmlGeneratorVisible, setHtmlGeneratorVisible] = useState(false);
  const [selectedPropertyForHTML, setSelectedPropertyForHTML] = useState<{id: number, number: string} | null>(null);

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
    if (canViewPropertyOwner(undefined)) {
      loadUniqueOwners();
    }
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

  const loadUniqueOwners = async () => {
    try {
      const { data } = await propertiesApi.getUniqueOwners();
      setUniqueOwners(data.data);
    } catch (error: any) {
      console.error('Failed to load unique owners:', error);
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
      property_type: undefined,
      owner_name: undefined
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

  const openOwnerInfoModal = (property: any) => {
    setSelectedOwnerData({
      owner_name: property.owner_name,
      owner_phone: property.owner_phone,
      owner_email: property.owner_email,
      owner_telegram: property.owner_telegram,
      owner_instagram: property.owner_instagram,
      owner_notes: property.owner_notes
    });
    setOwnerInfoModalVisible(true);
  };

  const openHTMLGenerator = (id: number, propertyNumber: string) => {
    setSelectedPropertyForHTML({ id, number: propertyNumber });
    setHtmlGeneratorVisible(true);
  };

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

              <Col span={16}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                    {property.property_name || property.property_number}
                  </div>

                  <div style={{ color: '#666', fontSize: 12 }}>
                    #{property.property_number}
                  </div>

                  {property.owner_name && canViewPropertyOwner(property.created_by) && (
                    <Button
                      type="link"
                      size="small"
                      icon={<UserOutlined />}
                      onClick={() => openOwnerInfoModal(property)}
                      style={{ padding: 0, height: 'auto', fontSize: 12 }}
                    >
                      {property.owner_name}
                    </Button>
                  )}

                  <div style={{ color: '#666', fontSize: 11 }}>
                    {t('properties.addedBy')}: {property.creator_name}
                  </div>

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

              <Col span={24}>
                <Space size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size="small" wrap>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/properties/view/${property.id}`)}
                    >
                      {t('common.view')}
                    </Button>
                    <Button
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => openHTMLGenerator(property.id, property.property_number)}
                    >
                      HTML
                    </Button>
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
                    {canEditProperty(property.created_by) && (
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/properties/edit/${property.id}`)}
                      />
                    )}
                    {canDeleteProperty() && (
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
    ...(canViewPropertyOwner(undefined) ? [{
      title: t('properties.source'),
      key: 'owner_name',
      width: 150,
      ellipsis: true,
      render: (_: any, record: any) => 
        record.owner_name && canViewPropertyOwner(record.created_by) ? (
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => openOwnerInfoModal(record)}
            style={{ padding: 0, height: 'auto' }}
          >
            {record.owner_name}
          </Button>
        ) : (
          <span>—</span>
        )
    }] : []),
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
      width: 280,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title={t('common.view')}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/properties/view/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('htmlGenerator.downloadButton')}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openHTMLGenerator(record.id, record.property_number)}
            />
          </Tooltip>
          <Tooltip title={t('properties.prices')}>
            <Button
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openPricingModal(record.id)}
            />
          </Tooltip>
          <Tooltip title={t('properties.calendar.button')}>
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => openCalendarModal(record.id)}
            />
          </Tooltip>
          {canEditProperty(record.created_by) && (
            <Tooltip title={t('common.edit')}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/properties/edit/${record.id}`)}
              />
            </Tooltip>
          )}
          {canDeleteProperty() && (
            <Popconfirm
              title={t('properties.confirmDelete')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  size="small"
                  danger
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
    <Card
      title={t('properties.list')}
      extra={
        <Space>
          {hasPermission('properties.read') && (
            <Button
              type="default"
              icon={<SearchOutlined />}
              onClick={() => navigate('/properties/search')}
              size={isMobile ? 'middle' : 'large'}
            >
              {!isMobile && t('properties.searchButton')}
            </Button>
          )}
          {hasPermission('properties.create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/properties/create')}
              size={isMobile ? 'middle' : 'large'}
            >
              {!isMobile && t('properties.add')}
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder={t('properties.search')}
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
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
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder={t('properties.dealType')}
              value={filters.deal_type}
              onChange={(value) => setFilters({ ...filters, deal_type: value })}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 'sale', label: t('properties.dealTypes.sale') },
                { value: 'rent', label: t('properties.dealTypes.rent') },
                { value: 'both', label: t('properties.dealTypes.both') }
              ]}
            />
          </Col>
          {canViewPropertyOwner(undefined) && (
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder={t('properties.source')}
                value={filters.owner_name}
                onChange={(value) => setFilters({ ...filters, owner_name: value })}
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={uniqueOwners.map(owner => ({
                  value: owner,
                  label: owner
                }))}
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={canViewPropertyOwner(undefined) ? 6 : 10}>
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
            scroll={{ x: 1200 }}
          />
        )}
      </Space>

      {selectedPropertyId && (
        <>
          <PricingModal
            propertyId={selectedPropertyId}
            visible={pricingModalVisible}
            onClose={() => {
              setPricingModalVisible(false);
              setSelectedPropertyId(null);
            }}
          />
          <CalendarModal
            propertyId={selectedPropertyId}
            visible={calendarModalVisible}
            onClose={() => {
              setCalendarModalVisible(false);
              setSelectedPropertyId(null);
            }}
          />
        </>
      )}

      <OwnerInfoModal
        visible={ownerInfoModalVisible}
        onClose={() => {
          setOwnerInfoModalVisible(false);
          setSelectedOwnerData(null);
        }}
        ownerData={selectedOwnerData}
      />

      {selectedPropertyForHTML && (
        <PropertyHTMLGeneratorModal
          visible={htmlGeneratorVisible}
          onClose={() => {
            setHtmlGeneratorVisible(false);
            setSelectedPropertyForHTML(null);
          }}
          propertyId={selectedPropertyForHTML.id}
          propertyNumber={selectedPropertyForHTML.number}
        />
      )}
    </Card>
  );
};

export default PropertiesList;