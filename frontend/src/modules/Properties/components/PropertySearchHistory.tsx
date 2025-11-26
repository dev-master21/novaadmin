import React, { useState, useEffect } from 'react';
import { 
  Card, List, Tag, Button, Space, Typography, Empty, Spin, 
  message, Popconfirm, Row, Col, Statistic, Divider,
  Tooltip, Timeline
} from 'antd';
import {
  RobotOutlined,
  FormOutlined,
  DeleteOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  DollarOutlined,
  HomeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertySearchApi } from '@/api/propertySearch.api';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/en';
import 'dayjs/locale/th';
import 'dayjs/locale/zh';
import 'dayjs/locale/he';
import relativeTime from 'dayjs/plugin/relativeTime';
import './PropertySearchHistory.css';

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;

interface PropertySearchHistoryProps {
  refreshTrigger?: number;
  onLoadSearch?: (log: any, properties: any[]) => void;
  onNavigateToChat?: (conversationId: number) => void;
}

const PropertySearchHistory: React.FC<PropertySearchHistoryProps> = ({ 
  onLoadSearch
}) => {
  const { t, i18n } = useTranslation();
  
  // Устанавливаем локаль для dayjs
  useEffect(() => {
    const localeMap: { [key: string]: string } = {
      'ru': 'ru',
      'en': 'en',
      'th': 'th',
      'zh': 'zh',
      'he': 'he'
    };
    dayjs.locale(localeMap[i18n.language] || 'en');
  }, [i18n.language]);

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadHistory();
  }, [pagination.current]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await propertySearchApi.getSearchHistory(
        pagination.current,
        pagination.pageSize
      );

      setHistory(data.data.history);
      setPagination(prev => ({
        ...prev,
        total: data.data.pagination.total
      }));
    } catch (error) {
      message.error(t('searchHistory.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await propertySearchApi.deleteSearchHistory(id);
      message.success(t('searchHistory.recordDeleted'));
      loadHistory();
    } catch (error) {
      message.error(t('searchHistory.errorDeleting'));
    }
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleLoadSearchResults = async (item: any) => {
    setLoading(true);
    try {
      const { data } = await propertySearchApi.getSearchResults(item.id);
      
      if (onLoadSearch) {
        onLoadSearch(data.data.log, data.data.properties);
      }
      
      message.success(t('searchHistory.propertiesLoaded', { count: data.data.properties.length }));
    } catch (error) {
      message.error(t('searchHistory.errorLoadingResults'));
    } finally {
      setLoading(false);
    }
  };

  const renderSearchParams = (item: any) => {
    const params = typeof item.search_params === 'string' 
      ? JSON.parse(item.search_params) 
      : item.search_params;

    const paramsList = [];

    if (params.deal_type) {
      paramsList.push({
        icon: <HomeOutlined />,
        label: t('searchHistory.dealType'),
        value: params.deal_type === 'rent' ? t('properties.dealTypes.rent') : 
               params.deal_type === 'sale' ? t('properties.dealTypes.sale') : 
               t('propertySearch.advancedSearch.any')
      });
    }

    if (params.property_type) {
      paramsList.push({
        icon: <HomeOutlined />,
        label: t('properties.propertyType'),
        value: params.property_type
      });
    }

    if (params.bedrooms) {
      paramsList.push({
        icon: '🛏️',
        label: t('propertySearch.advancedSearch.bedrooms'),
        value: params.bedrooms
      });
    }

    if (params.regions && params.regions.length > 0) {
      paramsList.push({
        icon: '📍',
        label: t('aiInterpretationModal.regions'),
        value: params.regions.join(', ')
      });
    }

    if (params.budget?.max) {
      paramsList.push({
        icon: <DollarOutlined />,
        label: t('propertySearch.advancedSearch.budget'),
        value: t('searchHistory.upTo', { 
          amount: params.budget.max.toLocaleString('ru-RU'),
          currency: params.budget.currency || 'THB'
        })
      });
    }

    if (params.dates?.check_in && params.dates?.check_out) {
      paramsList.push({
        icon: <CalendarOutlined />,
        label: t('aiInterpretationModal.dates'),
        value: `${dayjs(params.dates.check_in).format('DD.MM.YYYY')} - ${dayjs(params.dates.check_out).format('DD.MM.YYYY')}`
      });
    }

    if (params.flexible_dates) {
      paramsList.push({
        icon: <CalendarOutlined />,
        label: t('searchHistory.flexibleSearch'),
        value: t('searchHistory.nightsCount', { duration: params.flexible_dates.duration })
      });
    }

    return paramsList;
  };

  const renderAISearch = (item: any) => {
    const interpretation = typeof item.ai_interpretation === 'string'
      ? JSON.parse(item.ai_interpretation)
      : item.ai_interpretation;

    const isExpanded = expandedItems.has(item.id);
    const params = renderSearchParams(item);

    return (
      <Card 
        className="search-history-card ai-search"
        hoverable
      >
        <div className="search-header">
          <Space>
            <div className="search-type-badge ai">
              <RobotOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, color: '#ffffff' }}>
                {t('searchHistory.aiSearch')}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ClockCircleOutlined /> {dayjs(item.created_at).fromNow()} • {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}
              </Text>
            </div>
          </Space>
          
          <Space>
            <Tooltip title={t('searchHistory.aiConfidence')}>
              <Tag color={
                interpretation?.confidence >= 0.8 ? 'green' : 
                interpretation?.confidence >= 0.6 ? 'orange' : 'red'
              }>
                {((interpretation?.confidence || 0) * 100).toFixed(0)}%
              </Tag>
            </Tooltip>
            <Popconfirm
              title={t('searchHistory.deleteRecord')}
              onConfirm={() => handleDelete(item.id)}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
            >
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          </Space>
        </div>

        <div className="search-query">
          <MessageOutlined style={{ color: '#1890ff', fontSize: 16 }} />
          <Paragraph 
            style={{ 
              margin: 0, 
              marginLeft: 8,
              color: '#ffffff',
              flex: 1,
              fontSize: 14
            }}
          >
            "{item.ai_query}"
          </Paragraph>
        </div>

        <div className="search-stats">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>{t('searchHistory.found')}</span>}
                value={item.results_count}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ 
                  color: item.results_count > 0 ? '#52c41a' : '#ff4d4f',
                  fontSize: 20
                }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>{t('searchHistory.parameters')}</span>}
                value={params.length}
                prefix={<FilterOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: 20 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>{t('searchHistory.time')}</span>}
                value={(item.execution_time_ms / 1000).toFixed(2)}
                suffix={t('searchHistory.seconds')}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14', fontSize: 20 }}
              />
            </Col>
          </Row>
        </div>

        {isExpanded && params.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0', borderColor: '#434343' }} />
            <div className="search-parameters">
              <Text strong style={{ color: '#ffffff', marginBottom: 12, display: 'block' }}>
                {t('searchHistory.extractedParameters')}
              </Text>
              <Timeline
                items={params.map(param => ({
                  dot: param.icon,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {param.label}
                      </Text>
                      <Text style={{ color: '#ffffff' }}>
                        {param.value}
                      </Text>
                    </Space>
                  )
                }))}
              />
            </div>
          </>
        )}

        <div className="search-actions">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => handleLoadSearchResults(item)}
            style={{ flex: 2 }}
          >
            {t('searchHistory.viewResults', { count: item.results_count })}
          </Button>
          <Button
            icon={isExpanded ? <span>▲</span> : <span>▼</span>}
            onClick={() => toggleExpand(item.id)}
          >
            {isExpanded ? t('searchHistory.hide') : t('searchHistory.details')}
          </Button>
        </div>
      </Card>
    );
  };

  const renderManualSearch = (item: any) => {
    const isExpanded = expandedItems.has(item.id);
    const params = renderSearchParams(item);

    return (
      <Card 
        className="search-history-card manual-search"
        hoverable
      >
        <div className="search-header">
          <Space>
            <div className="search-type-badge manual">
              <FormOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, color: '#ffffff' }}>
                {t('searchHistory.formSearch')}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ClockCircleOutlined /> {dayjs(item.created_at).fromNow()} • {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}
              </Text>
            </div>
          </Space>
          
          <Popconfirm
            title={t('searchHistory.deleteRecord')}
            onConfirm={() => handleDelete(item.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </div>

        <div className="search-stats">
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>{t('searchHistory.found')}</span>}
                value={item.results_count}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ 
                  color: item.results_count > 0 ? '#52c41a' : '#ff4d4f',
                  fontSize: 20
                }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>{t('searchHistory.time')}</span>}
                value={(item.execution_time_ms / 1000).toFixed(2)}
                suffix={t('searchHistory.seconds')}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14', fontSize: 20 }}
              />
            </Col>
          </Row>
        </div>

        {isExpanded && params.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0', borderColor: '#434343' }} />
            <div className="search-parameters">
              <Text strong style={{ color: '#ffffff', marginBottom: 12, display: 'block' }}>
                {t('searchHistory.searchParameters')}
              </Text>
              <Timeline
                items={params.map(param => ({
                  dot: param.icon,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {param.label}
                      </Text>
                      <Text style={{ color: '#ffffff' }}>
                        {param.value}
                      </Text>
                    </Space>
                  )
                }))}
              />
            </div>
          </>
        )}

        <div className="search-actions">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => handleLoadSearchResults(item)}
            style={{ flex: 2 }}
          >
            {t('searchHistory.viewResults', { count: item.results_count })}
          </Button>
          
          <Button
            icon={isExpanded ? <span>▲</span> : <span>▼</span>}
            onClick={() => toggleExpand(item.id)}
          >
            {isExpanded ? t('searchHistory.hide') : t('searchHistory.details')}
          </Button>
        </div>
      </Card>
    );
  };

  if (loading && history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 24, color: '#ffffff' }}>
          {t('searchHistory.loadingHistory')}
        </div>
      </div>
    );
  }

  if (!loading && history.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>
              {t('searchHistory.historyEmpty')}
            </Text>
            <br />
            <Text type="secondary">
              {t('searchHistory.performFirstSearch')}
            </Text>
          </div>
        }
        style={{ padding: '80px 0' }}
      />
    );
  }

  return (
    <div className="search-history-container">
      <div className="history-header">
        <Space>
          <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#ffffff' }}>
              {t('searchHistory.title')}
            </Title>
            <Text type="secondary">
              {t('searchHistory.totalRecords', { total: pagination.total })}
            </Text>
          </div>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadHistory}
          loading={loading}
        >
          {t('searchHistory.refresh')}
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={history}
        renderItem={(item: any) => (
          <List.Item key={item.id} style={{ border: 'none', padding: 0, marginBottom: 16 }}>
            {item.search_type === 'ai' ? renderAISearch(item) : renderManualSearch(item)}
          </List.Item>
        )}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
          showSizeChanger: false,
          showTotal: (total, range) => t('searchHistory.paginationInfo', { 
            start: range[0], 
            end: range[1], 
            total 
          }),
          style: { textAlign: 'center', marginTop: 24 }
        }}
      />
    </div>
  );
};

export default PropertySearchHistory;