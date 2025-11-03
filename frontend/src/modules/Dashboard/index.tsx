// frontend/src/modules/Dashboard/index.tsx
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Tag, Space, Button } from 'antd';
import {
  HomeOutlined,
  EyeOutlined,
  FileTextOutlined,
  EyeInvisibleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertiesApi, Property } from '@/api/properties.api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuthStore();
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    hidden: 0
  });
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Загружаем недавние объекты
      const { data } = await propertiesApi.getAll({ page: 1, limit: 5 });
      setRecentProperties(data.data.properties);

      // Подсчитываем статистику
      const total = data.data.pagination.total;
      
      // Загружаем статистику по статусам
      const [publishedRes, draftRes, hiddenRes] = await Promise.all([
        propertiesApi.getAll({ status: 'published', limit: 1 }),
        propertiesApi.getAll({ status: 'draft', limit: 1 }),
        propertiesApi.getAll({ status: 'hidden', limit: 1 })
      ]);

      setStats({
        total,
        published: publishedRes.data.data.pagination.total,
        draft: draftRes.data.data.pagination.total,
        hidden: hiddenRes.data.data.pagination.total
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      published: 'success',
      draft: 'default',
      hidden: 'warning',
      archived: 'error'
    };
    return colors[status] || 'default';
  };

  return (
    <div>
      {/* Welcome Section */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="small">
          <Title level={3} style={{ margin: 0 }}>
            {t('dashboard.welcome')}, {user?.full_name}!
          </Title>
          <Text type="secondary">
            {dayjs().format('dddd, D MMMM YYYY')}
          </Text>
        </Space>
      </Card>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.stats.totalProperties')}
              value={stats.total}
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.stats.publishedProperties')}
              value={stats.published}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.stats.draftProperties')}
              value={stats.draft}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.stats.hiddenProperties')}
              value={stats.hidden}
              prefix={<EyeInvisibleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Recent Properties */}
        <Col xs={24} lg={16}>
          <Card
            title={t('dashboard.recentProperties')}
            loading={loading}
            extra={
              hasPermission('properties.read') && (
                <Button
                  type="link"
                  onClick={() => navigate('/properties')}
                >
                  {t('common.view')} →
                </Button>
              )
            }
          >
            <List
              dataSource={recentProperties}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => navigate(`/properties/edit/${item.id}`)}
                    >
                      {t('common.edit')}
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.property_number}</span>
                        <Tag color={getStatusColor(item.status)}>
                          {t(`properties.statuses.${item.status}`)}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">
                          {item.property_name || t('common.noData')}
                        </Text>
                        <Space size="small">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('properties.creator')}: {item.creator_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            • {dayjs(item.created_at).format('DD.MM.YYYY')}
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                  <div>
                    <Text strong>{item.sale_price?.toLocaleString()} ฿</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Card title={t('dashboard.quickActions')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {hasPermission('properties.create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  block
                  size="large"
                  onClick={() => navigate('/properties/create')}
                >
                  {t('nav.addProperty')}
                </Button>
              )}
              {hasPermission('properties.read') && (
                <Button
                  icon={<HomeOutlined />}
                  block
                  size="large"
                  onClick={() => navigate('/properties')}
                >
                  {t('nav.propertiesList')}
                </Button>
              )}
              {hasPermission('users.create') && (
                <Button
                  icon={<PlusOutlined />}
                  block
                  size="large"
                  onClick={() => navigate('/users/create')}
                >
                  {t('nav.addUser')}
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;