// frontend/src/modules/Properties/components/AIResponseViewer.tsx
import React, { useState, useEffect } from 'react';
import { 
  Modal, Button, Tabs, Typography, Space, Tag, message, Spin, 
  Card, Row, Col, Statistic, Divider, Empty, Tooltip, Progress
} from 'antd';
import { 
  RobotOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  CopyOutlined, DownloadOutlined, CalendarOutlined, DollarOutlined,
  HomeOutlined, EnvironmentOutlined, StarOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertySearchApi } from '@/api/propertySearch.api';
import './AIResponseViewer.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface AIResponseViewerProps {
  visible: boolean;
  onClose: () => void;
}

const AIResponseViewer: React.FC<AIResponseViewerProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadAIResponse();
    }
  }, [visible]);

  const loadAIResponse = async () => {
    setLoading(true);
    try {
      const { data: response } = await propertySearchApi.getLastAIInterpretation();
      setData(response.data);
    } catch (error: any) {
      message.error(t('aiResponseViewer.errorLoading'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('aiResponseViewer.copiedToClipboard'));
  };

  const downloadJSON = () => {
    if (!data) return;
    const blob = new Blob([formatJSON(data.interpretation)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-interpretation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('aiResponseViewer.jsonDownloaded'));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#52c41a';
    if (confidence >= 0.6) return '#faad14';
    return '#ff4d4f';
  };

  const getConfidenceStatus = (confidence: number): 'success' | 'normal' | 'exception' => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'normal';
    return 'exception';
  };

  const renderQueryTypeCard = () => {
    if (!data?.interpretation) return null;
    const interp = data.interpretation;

    let queryType = t('aiResponseViewer.unknownQueryType');
    let queryIcon = <CloseCircleOutlined />;
    let queryDescription = '';

    if (interp.duration && interp.search_window) {
      queryType = t('aiResponseViewer.flexibleSearch');
      queryIcon = <CalendarOutlined />;
      queryDescription = t('aiResponseViewer.flexibleSearchDesc', {
        duration: interp.duration,
        start: interp.search_window.start,
        end: interp.search_window.end
      });
    } else if (interp.dates && interp.dates.check_in && interp.dates.check_out) {
      queryType = t('aiResponseViewer.fixedDates');
      queryIcon = <CheckCircleOutlined />;
      queryDescription = t('aiResponseViewer.fixedDatesDesc', {
        checkIn: interp.dates.check_in,
        checkOut: interp.dates.check_out
      });
    } else if (interp.deal_type || interp.property_type || interp.bedrooms) {
      queryType = t('aiResponseViewer.parameterSearch');
      queryIcon = <HomeOutlined />;
      queryDescription = t('aiResponseViewer.searchWithoutDates');
    }

    return (
      <Card 
        className="query-type-card"
        style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 12,
          marginBottom: 20
        }}
      >
        <Row align="middle" gutter={16}>
          <Col>
            <div style={{ 
              fontSize: 48, 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center'
            }}>
              {queryIcon}
            </div>
          </Col>
          <Col flex={1}>
            <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
              {queryType}
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
              {queryDescription}
            </Text>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderMainParameters = () => {
    if (!data?.interpretation) return null;
    const interp = data.interpretation;

    const params = [];

    if (interp.deal_type) {
      params.push({
        icon: <HomeOutlined />,
        label: t('aiInterpretationModal.dealType'),
        value: interp.deal_type === 'rent' ? t('properties.dealTypes.rent') : 
               interp.deal_type === 'sale' ? t('properties.dealTypes.sale') : 
               t('propertySearch.advancedSearch.any'),
        color: '#1890ff'
      });
    }

    if (interp.property_type) {
      params.push({
        icon: <HomeOutlined />,
        label: t('properties.propertyType'),
        value: interp.property_type === 'villa' ? t('properties.propertyTypes.villa') : 
               interp.property_type === 'condo' ? t('properties.propertyTypes.condo') :
               interp.property_type === 'apartment' ? t('properties.propertyTypes.apartment') :
               interp.property_type,
        color: '#52c41a'
      });
    }

    if (interp.bedrooms !== undefined && interp.bedrooms !== null) {
      params.push({
        icon: <HomeOutlined />,
        label: t('propertySearch.advancedSearch.bedrooms'),
        value: t('aiResponseViewer.bedroomsCount', { count: interp.bedrooms }),
        color: '#722ed1'
      });
    }

    if (interp.regions && interp.regions.length > 0) {
      params.push({
        icon: <EnvironmentOutlined />,
        label: t('aiInterpretationModal.regions'),
        value: interp.regions.join(', '),
        color: '#fa8c16'
      });
    }

    if (interp.budget) {
      const budgetType = interp.budget.budget_type === 'per_night' ? t('aiResponseViewer.perNight') :
                         interp.budget.budget_type === 'per_month' ? t('aiResponseViewer.perMonth') :
                         interp.budget.budget_type === 'per_year' ? t('aiResponseViewer.perYear') : '';
      params.push({
        icon: <DollarOutlined />,
        label: t('propertySearch.advancedSearch.budget'),
        value: `${interp.budget.amount?.toLocaleString('ru-RU')} ${interp.budget.currency}${budgetType}`,
        color: '#13c2c2'
      });
    }

    if (params.length === 0) {
      return (
        <Empty 
          description={t('aiResponseViewer.parametersNotSpecified')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <Row gutter={[16, 16]}>
        {params.map((param, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
            <Card 
              className="parameter-card"
              style={{
                background: '#262626',
                border: `1px solid ${param.color}`,
                borderRadius: 8,
                height: '100%'
              }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: param.color, fontSize: 20 }}>{param.icon}</span>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 12 }}>
                    {param.label}
                  </Text>
                </div>
                <Text strong style={{ color: '#ffffff', fontSize: 16 }}>
                  {param.value}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  const renderFeatures = () => {
    if (!data?.interpretation) return null;
    const interp = data.interpretation;

    const features = [];

    if (interp.features && interp.features.length > 0) {
      features.push(...interp.features);
    }

    if (interp.furniture) {
      features.push(t('aiResponseViewer.furnitureLabel', { type: interp.furniture }));
    }

    if (interp.parking) {
      features.push(t('aiInterpretationModal.parking'));
    }

    if (interp.pets) {
      features.push(t('aiResponseViewer.withPets'));
    }

    if (features.length === 0) return null;

    return (
      <Card
        title={
          <Space>
            <StarOutlined style={{ color: '#faad14' }} />
            <span style={{ color: '#ffffff' }}>{t('aiResponseViewer.requiredFeatures')}</span>
          </Space>
        }
        className="features-card"
        style={{
          background: '#262626',
          border: '1px solid #434343',
          borderRadius: 8,
          marginTop: 20
        }}
        headStyle={{ background: '#1f1f1f', borderBottom: '1px solid #434343' }}
        bodyStyle={{ padding: 16 }}
      >
        <Space wrap>
          {features.map((feature, index) => (
            <Tag 
              key={index} 
              color="blue"
              style={{ 
                padding: '4px 12px',
                fontSize: 13,
                borderRadius: 6
              }}
            >
              {feature}
            </Tag>
          ))}
        </Space>
      </Card>
    );
  };

  const renderInterpretationTab = () => {
    if (!data) return null;

    const interp = data.interpretation;
    const confidence = interp.confidence || 0;

    return (
      <div style={{ padding: '20px 0' }}>
        <Card 
          className="query-card"
          style={{
            background: '#262626',
            border: '1px solid #434343',
            borderRadius: 12,
            marginBottom: 20
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} style={{ color: '#ffffff', margin: 0 }}>
                {t('aiResponseViewer.yourQuery')}
              </Title>
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(data.query)}
                style={{ color: '#ffffff' }}
              >
                {t('aiResponseViewer.copy')}
              </Button>
            </div>
            <Paragraph 
              style={{ 
                color: '#ffffff',
                fontSize: 15,
                margin: 0,
                padding: 16,
                background: '#1f1f1f',
                borderRadius: 8,
                border: '1px solid #434343'
              }}
            >
              "{data.query}"
            </Paragraph>
          </Space>
        </Card>

        <Card 
          className="confidence-card"
          style={{
            background: '#262626',
            border: `2px solid ${getConfidenceColor(confidence)}`,
            borderRadius: 12,
            marginBottom: 20
          }}
        >
          <Row align="middle" gutter={24}>
            <Col>
              <RobotOutlined style={{ fontSize: 48, color: getConfidenceColor(confidence) }} />
            </Col>
            <Col flex={1}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 14 }}>
                    {t('aiInterpretationModal.aiConfidence')}
                  </Text>
                  <Tag 
                    color={confidence >= 0.8 ? 'green' : confidence >= 0.6 ? 'orange' : 'red'}
                    style={{ fontSize: 16, padding: '4px 16px', borderRadius: 8 }}
                  >
                    {(confidence * 100).toFixed(0)}%
                  </Tag>
                </div>
                <Progress 
                  percent={confidence * 100} 
                  showInfo={false}
                  status={getConfidenceStatus(confidence)}
                  strokeColor={getConfidenceColor(confidence)}
                  trailColor="#434343"
                />
                {interp.reasoning && (
                  <Paragraph 
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.85)', 
                      margin: '8px 0 0 0',
                      fontSize: 13
                    }}
                  >
                    <strong style={{ color: getConfidenceColor(confidence) }}>
                      {t('aiResponseViewer.explanation')}:
                    </strong> {interp.reasoning}
                  </Paragraph>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {renderQueryTypeCard()}

        <Card
          style={{
            background: data.results_count > 0 ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
            border: data.results_count > 0 ? '1px solid #52c41a' : '1px solid #ff4d4f',
            borderRadius: 12,
            marginBottom: 20
          }}
        >
          <Statistic
            title={<span style={{ color: '#ffffff', fontSize: 14 }}>{t('aiResponseViewer.propertiesFound')}</span>}
            value={data.results_count}
            valueStyle={{ 
              color: data.results_count > 0 ? '#52c41a' : '#ff4d4f',
              fontSize: 36,
              fontWeight: 700
            }}
            prefix={data.results_count > 0 ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          />
        </Card>

        <Divider style={{ borderColor: '#434343', margin: '24px 0' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
            {t('aiInterpretationModal.extractedParameters')}
          </span>
        </Divider>

        {renderMainParameters()}
        {renderFeatures()}

        {confidence < 0.6 && (
          <Card
            style={{
              background: 'rgba(250, 173, 20, 0.1)',
              border: '1px solid #faad14',
              borderRadius: 12,
              marginTop: 20
            }}
          >
            <Space>
              <WarningOutlined style={{ color: '#faad14', fontSize: 24 }} />
              <div>
                <Title level={5} style={{ color: '#faad14', margin: 0 }}>
                  {t('aiResponseViewer.lowConfidenceWarning')}
                </Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {t('aiResponseViewer.lowConfidenceDescription')}
                </Text>
              </div>
            </Space>
          </Card>
        )}
      </div>
    );
  };

  const renderJSONTab = () => {
    if (!data) return null;

    return (
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <Space>
            <Tooltip title={t('aiResponseViewer.copyJSON')}>
              <Button
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(data.raw_response || formatJSON(data.interpretation))}
                style={{ background: '#434343', color: '#ffffff', border: 'none' }}
              />
            </Tooltip>
            <Tooltip title={t('aiResponseViewer.downloadJSON')}>
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadJSON}
                style={{ background: '#434343', color: '#ffffff', border: 'none' }}
              />
            </Tooltip>
          </Space>
        </div>
        <pre style={{ 
          background: '#1e1e1e', 
          color: '#d4d4d4', 
          padding: '24px 16px 16px 16px', 
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.6,
          border: '1px solid #434343',
          maxHeight: '60vh',
          overflow: 'auto',
          fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace"
        }}>
          {data.raw_response || formatJSON(data.interpretation)}
        </pre>
      </div>
    );
  };

  const renderFiltersTab = () => {
    if (!data) return null;

    return (
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <Tooltip title={t('aiResponseViewer.copyFilters')}>
            <Button
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(formatJSON(data.converted_filters))}
              style={{ background: '#434343', color: '#ffffff', border: 'none' }}
            />
          </Tooltip>
        </div>
        <pre style={{ 
          background: '#1e1e1e', 
          color: '#d4d4d4', 
          padding: '24px 16px 16px 16px', 
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.6,
          border: '1px solid #434343',
          maxHeight: '60vh',
          overflow: 'auto',
          fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace"
        }}>
          {formatJSON(data.converted_filters)}
        </pre>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space size="large">
          <Space>
            <RobotOutlined style={{ color: '#1890ff', fontSize: 22 }} />
            <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 600 }}>
              {t('aiResponseViewer.title')}
            </span>
          </Space>
          {data && (
            <Tag icon={<ClockCircleOutlined />} color="blue">
              ID: {data.id}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button 
          key="close" 
          onClick={onClose} 
          size="large"
          style={{ 
            background: '#434343', 
            color: '#ffffff', 
            border: 'none',
            borderRadius: 8,
            height: 40
          }}
        >
          {t('aiResponseViewer.close')}
        </Button>
      ]}
      className="ai-response-viewer-modal"
      styles={{
        body: { background: '#1f1f1f', padding: 0 },
        header: { 
          background: '#1f1f1f', 
          borderBottom: '1px solid #434343',
          padding: '20px 24px'
        },
        content: { 
          background: '#1f1f1f',
          borderRadius: 12
        },
        footer: {
          background: '#1f1f1f',
          borderTop: '1px solid #434343',
          padding: '16px 24px'
        }
      }}
    >
      {loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '80px 0',
          background: '#1f1f1f'
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 24, color: '#ffffff', fontSize: 16 }}>
            {t('aiResponseViewer.loadingData')}
          </div>
        </div>
      ) : data ? (
        <Tabs 
          defaultActiveKey="interpretation"
          className="ai-tabs"
          tabBarStyle={{
            background: '#1f1f1f',
            padding: '0 24px',
            margin: 0,
            borderBottom: '1px solid #434343'
          }}
        >
          <TabPane 
            tab={
              <span style={{ color: '#ffffff', fontSize: 14 }}>
                🎯 {t('aiResponseViewer.interpretationTab')}
              </span>
            } 
            key="interpretation"
          >
            <div style={{ 
              maxHeight: '60vh', 
              overflowY: 'auto',
              padding: '0 24px'
            }}>
              {renderInterpretationTab()}
            </div>
          </TabPane>

          <TabPane 
            tab={
              <span style={{ color: '#ffffff', fontSize: 14 }}>
                📝 {t('aiResponseViewer.rawJSONTab')}
              </span>
            } 
            key="raw"
          >
            <div style={{ padding: '20px 24px' }}>
              {renderJSONTab()}
            </div>
          </TabPane>

          <TabPane 
            tab={
              <span style={{ color: '#ffffff', fontSize: 14 }}>
                🔧 {t('aiResponseViewer.filtersTab')}
              </span>
            } 
            key="filters"
          >
            <div style={{ padding: '20px 24px' }}>
              {renderFiltersTab()}
            </div>
          </TabPane>
        </Tabs>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '80px 24px',
          background: '#1f1f1f'
        }}>
          <Empty
            description={
              <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 15 }}>
                {t('aiResponseViewer.noData')}
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      )}
    </Modal>
  );
};

export default AIResponseViewer;