// frontend/src/modules/Properties/components/AIInterpretationModal.tsx
import React from 'react';
import { Modal, Progress, Descriptions, Tag, Space, Alert, Typography, Row, Col } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import './AIInterpretationModal.css';

const { Text, Paragraph } = Typography;

interface AIInterpretationModalProps {
  visible: boolean;
  onClose: () => void;
  interpretation: any;
}

const AIInterpretationModal: React.FC<AIInterpretationModalProps> = ({
  visible,
  onClose,
  interpretation
}) => {
  const { t } = useTranslation();

  if (!interpretation) return null;

  const confidence = interpretation.confidence || 0;
  const confidencePercent = Math.round(confidence * 100);

  const getConfidenceLevel = () => {
    if (confidence >= 0.8) {
      return {
        status: 'success' as const,
        label: t('aiInterpretationModal.highConfidence'),
        color: '#52c41a',
        icon: <CheckCircleOutlined />
      };
    } else if (confidence >= 0.6) {
      return {
        status: 'normal' as const,
        label: t('aiInterpretationModal.mediumConfidence'),
        color: '#faad14',
        icon: <WarningOutlined />
      };
    } else {
      return {
        status: 'exception' as const,
        label: t('aiInterpretationModal.lowConfidence'),
        color: '#ff4d4f',
        icon: <CloseCircleOutlined />
      };
    }
  };

  const confidenceLevel = getConfidenceLevel();

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span>{t('aiInterpretationModal.title')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      className="ai-interpretation-modal"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="confidence-section">
          <Row gutter={16} align="middle">
            <Col span={4}>
              <Text strong style={{ color: '#ffffff' }}>{t('aiInterpretationModal.aiConfidence')}</Text>
            </Col>
            <Col span={20}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Progress
                  percent={confidencePercent}
                  status={confidenceLevel.status}
                  strokeColor={confidenceLevel.color}
                  trailColor="#2a2a2a"
                  style={{ marginBottom: 0 }}
                />
                <Space>
                  {confidenceLevel.icon}
                  <Text style={{ color: confidenceLevel.color }}>
                    {t('aiInterpretationModal.accuracyPercent', { 
                      level: confidenceLevel.label, 
                      percent: confidencePercent 
                    })}
                  </Text>
                </Space>
              </Space>
            </Col>
          </Row>

          {confidence < 0.7 && (
            <Alert
              message={t('aiInterpretationModal.mediumAccuracyWarning')}
              description={t('aiInterpretationModal.mediumAccuracyDescription')}
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </div>

        <div className="reasoning-section">
          <Text strong style={{ color: '#ffffff', display: 'block', marginBottom: 8 }}>
            {t('aiInterpretationModal.queryUnderstanding')}
          </Text>
          <Paragraph 
            className="reasoning-text"
            style={{ 
              color: '#ffffff',
              background: '#1890ff22',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #1890ff44',
              marginBottom: 0
            }}
          >
            {interpretation.reasoning || t('aiInterpretationModal.noDescription')}
          </Paragraph>
        </div>

        <div className="parameters-section">
          <Text strong style={{ color: '#ffffff', display: 'block', marginBottom: 12 }}>
            {t('aiInterpretationModal.extractedParameters')}
          </Text>
          
          <Descriptions 
            bordered 
            column={2} 
            size="small"
            className="ai-parameters-descriptions"
          >
            {interpretation.deal_type && (
              <Descriptions.Item label={t('aiInterpretationModal.dealType')} span={2}>
                <Tag color="blue">
                  {interpretation.deal_type === 'rent' ? t('properties.dealTypes.rent') : 
                   interpretation.deal_type === 'sale' ? t('properties.dealTypes.sale') : 
                   t('propertySearch.advancedSearch.any')}
                </Tag>
              </Descriptions.Item>
            )}

            {interpretation.property_type && (
              <Descriptions.Item label={t('properties.propertyType')} span={2}>
                <Tag color="cyan">{interpretation.property_type}</Tag>
              </Descriptions.Item>
            )}

            {interpretation.bedrooms && (
              <Descriptions.Item label={t('propertySearch.advancedSearch.bedrooms')}>
                <Text style={{ color: '#ffffff' }}>{interpretation.bedrooms}</Text>
              </Descriptions.Item>
            )}

            {interpretation.bathrooms && (
              <Descriptions.Item label={t('propertySearch.advancedSearch.bathrooms')}>
                <Text style={{ color: '#ffffff' }}>{interpretation.bathrooms}</Text>
              </Descriptions.Item>
            )}

            {interpretation.budget && (
              <Descriptions.Item label={t('propertySearch.advancedSearch.budget')} span={2}>
                <Space>
                  {interpretation.budget.min && (
                    <Text style={{ color: '#ffffff' }}>
                      {t('propertySearch.advancedSearch.from')} {interpretation.budget.min.toLocaleString()}
                    </Text>
                  )}
                  {interpretation.budget.amount && (
                    <Text style={{ color: '#ffffff' }}>
                      {t('propertySearch.advancedSearch.to')} {interpretation.budget.amount.toLocaleString()}
                    </Text>
                  )}
                  <Tag>{interpretation.budget.currency || 'THB'}</Tag>
                  {interpretation.budget.tolerance > 0 && (
                    <Tag color="orange">±{interpretation.budget.tolerance}%</Tag>
                  )}
                </Space>
              </Descriptions.Item>
            )}

            {interpretation.dates && (
              <Descriptions.Item label={t('aiInterpretationModal.dates')} span={2}>
                <Space>
                  {interpretation.dates.check_in && (
                    <Text style={{ color: '#ffffff' }}>
                      {t('aiInterpretationModal.dateFrom')} {dayjs(interpretation.dates.check_in).format('DD.MM.YYYY')}
                    </Text>
                  )}
                  {interpretation.dates.check_out && (
                    <Text style={{ color: '#ffffff' }}>
                      {t('aiInterpretationModal.dateTo')} {dayjs(interpretation.dates.check_out).format('DD.MM.YYYY')}
                    </Text>
                  )}
                  {interpretation.dates.tolerance_days > 0 && (
                    <Tag color="orange">±{interpretation.dates.tolerance_days} {t('aiInterpretationModal.days')}</Tag>
                  )}
                </Space>
              </Descriptions.Item>
            )}

            {interpretation.regions && interpretation.regions.length > 0 && (
              <Descriptions.Item label={t('aiInterpretationModal.regions')} span={2}>
                <Space wrap>
                  {interpretation.regions.map((region: string) => (
                    <Tag key={region} color="green">{region}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}

            {interpretation.features && interpretation.features.length > 0 && (
              <Descriptions.Item label={t('aiInterpretationModal.features')} span={2}>
                <Space wrap>
                  {interpretation.features.map((feature: string) => (
                    <Tag key={feature} color="purple">{feature}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}

            {interpretation.furniture && (
              <Descriptions.Item label={t('propertySearch.advancedSearch.furniture')} span={2}>
                <Tag color="gold">
                  {interpretation.furniture === 'fullyFurnished' ? t('propertySearch.advancedSearch.fullyFurnished') :
                   interpretation.furniture === 'partiallyFurnished' ? t('propertySearch.advancedSearch.partiallyFurnished') : 
                   t('propertySearch.advancedSearch.unfurnished')}
                </Tag>
              </Descriptions.Item>
            )}

            {interpretation.parking !== undefined && (
              <Descriptions.Item label={t('aiInterpretationModal.parking')}>
                <Tag color={interpretation.parking ? 'success' : 'default'}>
                  {interpretation.parking ? t('aiInterpretationModal.required') : t('aiInterpretationModal.notRequired')}
                </Tag>
              </Descriptions.Item>
            )}

            {interpretation.pets !== undefined && (
              <Descriptions.Item label={t('aiInterpretationModal.pets')}>
                <Tag color={interpretation.pets ? 'success' : 'default'}>
                  {interpretation.pets ? t('aiInterpretationModal.allowed') : t('aiInterpretationModal.notAllowed')}
                </Tag>
              </Descriptions.Item>
            )}

            {interpretation.distance_to_beach && (
              <Descriptions.Item label={t('propertySearch.advancedSearch.distanceToBeach')} span={2}>
                <Tag color="blue">
                  {t('aiInterpretationModal.upTo')} {interpretation.distance_to_beach.max}{t('aiInterpretationModal.meters')}
                </Tag>
              </Descriptions.Item>
            )}

            {interpretation.complex_name && (
              <Descriptions.Item label={t('aiInterpretationModal.complex')} span={2}>
                <Text style={{ color: '#ffffff' }}>{interpretation.complex_name}</Text>
              </Descriptions.Item>
            )}

            {interpretation.floor && (
              <Descriptions.Item label={t('aiInterpretationModal.floor')} span={2}>
                <Text style={{ color: '#ffffff' }}>
                  {interpretation.floor.min && `${t('propertySearch.advancedSearch.from')} ${interpretation.floor.min}`}
                  {interpretation.floor.max && ` ${t('propertySearch.advancedSearch.to')} ${interpretation.floor.max}`}
                </Text>
              </Descriptions.Item>
            )}

            {interpretation.owner_name && (
              <Descriptions.Item label={t('aiInterpretationModal.owner')} span={2}>
                <Text style={{ color: '#ffffff' }}>{interpretation.owner_name}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {!interpretation.deal_type && 
           !interpretation.property_type && 
           !interpretation.bedrooms && 
           !interpretation.budget && (
            <Alert
              message={t('aiInterpretationModal.noParametersExtracted')}
              description={t('aiInterpretationModal.noParametersDescription')}
              type="info"
              showIcon
            />
          )}
        </div>
      </Space>
    </Modal>
  );
};

export default AIInterpretationModal;