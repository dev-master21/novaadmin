// frontend/src/modules/Properties/components/AIDescriptionGenerator.tsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Progress,
  Alert,
  Space,
  Typography,
  Tooltip,
  Modal,
  Input,
  Tag,
  Spin
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { message } from 'antd';
import './AIDescriptionGenerator.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface AIDescriptionGeneratorProps {
  propertyId: number;
  onGenerated: (descriptions: any, features: string[]) => void;
  disabled?: boolean;
}

interface ReadinessCheck {
  ready: boolean;
  checks: {
    features: { ready: boolean; count: number };
    photos: { ready: boolean; count: number };
    location: { ready: boolean };
    bedrooms: { ready: boolean };
  };
  rateLimit: {
    allowed: boolean;
    remainingSeconds: number;
  };
}

const AIDescriptionGenerator: React.FC<AIDescriptionGeneratorProps> = ({
  propertyId,
  onGenerated,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  const [readiness, setReadiness] = useState<ReadinessCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  useEffect(() => {
    if (propertyId) {
      checkReadiness();
    }
  }, [propertyId]);

  const checkReadiness = async () => {
    setChecking(true);
    try {
      const { data } = await propertiesApi.checkAIGenerationReadiness(propertyId);
      setReadiness(data.data);
    } catch (error: any) {
      message.error(t('aiDescriptionGenerator.errorCheckingReadiness'));
    } finally {
      setChecking(false);
    }
  };

  const handleGenerate = async () => {
    if (!readiness?.ready) {
      message.warning(t('aiDescriptionGenerator.conditionsNotMet'));
      return;
    }

    if (!readiness?.rateLimit.allowed) {
      const minutes = Math.ceil(readiness.rateLimit.remainingSeconds / 60);
      message.warning(t('aiDescriptionGenerator.pleaseWait', { minutes }));
      return;
    }

    setLoading(true);
    setGenerationProgress(0);
    setCurrentStep(t('aiDescriptionGenerator.preparing'));

    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 2000);

      setCurrentStep(t('aiDescriptionGenerator.analyzingPhotos'));
      
      setTimeout(() => {
        setCurrentStep(t('aiDescriptionGenerator.detectingFeatures'));
      }, 3000);

      setTimeout(() => {
        setCurrentStep(t('aiDescriptionGenerator.generatingDescriptions'));
      }, 6000);

      const { data } = await propertiesApi.generateAIDescription(
        propertyId,
        additionalPrompt || undefined
      );

      clearInterval(progressInterval);
      setGenerationProgress(100);
      setCurrentStep(t('aiDescriptionGenerator.done'));

      if (data.success) {
        message.success(t('aiDescriptionGenerator.descriptionsGenerated'));
        
        if (data.data.featuresFound && data.data.featuresFound.length > 0) {
          Modal.success({
            title: t('aiDescriptionGenerator.featuresFoundTitle'),
            width: 600,
            content: (
              <div>
                <Paragraph>
                  {t('aiDescriptionGenerator.aiDetected', { count: data.data.featuresFound.length })}
                </Paragraph>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {data.data.featuresFound.map((feature: string) => (
                    <Tag key={feature} color="blue" style={{ margin: 4 }}>
                      {feature}
                    </Tag>
                  ))}
                </div>
                <Paragraph style={{ marginTop: 16 }}>
                  {t('aiDescriptionGenerator.featuresAdded')}
                </Paragraph>
              </div>
            )
          });
        }

        onGenerated(data.data.descriptions, data.data.featuresFound);
        checkReadiness();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('aiDescriptionGenerator.errorGenerating'));
    } finally {
      setLoading(false);
      setGenerationProgress(0);
      setCurrentStep('');
    }
  };

  if (checking) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <Paragraph style={{ marginTop: 16 }}>{t('aiDescriptionGenerator.checkingReadiness')}</Paragraph>
        </div>
      </Card>
    );
  }

  if (!readiness) {
    return null;
  }

  const allReady = readiness.ready && readiness.rateLimit.allowed;
  const rateLimitMessage = !readiness.rateLimit.allowed 
    ? t('aiDescriptionGenerator.waitMinutes', { minutes: Math.ceil(readiness.rateLimit.remainingSeconds / 60) })
    : null;

  return (
    <>
      <Card
        title={
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <span>{t('aiDescriptionGenerator.title')}</span>
            <Tooltip title={t('aiDescriptionGenerator.generationSettings')}>
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setSettingsVisible(true)}
                size="small"
              />
            </Tooltip>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={5}>{t('aiDescriptionGenerator.readinessCheck')}</Title>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  {readiness.checks.features.ready ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  )}
                  <Text>{t('aiDescriptionGenerator.specifyFeatures')}</Text>
                </Space>
                <Progress
                  type="circle"
                  percent={Math.round((readiness.checks.features.count / 15) * 100)}
                  width={40}
                  format={() => `${readiness.checks.features.count}/15`}
                  status={readiness.checks.features.ready ? 'success' : 'exception'}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  {readiness.checks.photos.ready ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  )}
                  <Text>{t('aiDescriptionGenerator.uploadPhotos')}</Text>
                </Space>
                <Progress
                  type="circle"
                  percent={Math.round((readiness.checks.photos.count / 12) * 100)}
                  width={40}
                  format={() => `${readiness.checks.photos.count}/12`}
                  status={readiness.checks.photos.ready ? 'success' : 'exception'}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Space>
                  {readiness.checks.location.ready ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  )}
                  <Text>{t('aiDescriptionGenerator.specifyAddress')}</Text>
                </Space>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Space>
                  {readiness.checks.bedrooms.ready ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  )}
                  <Text>{t('aiDescriptionGenerator.specifyBedrooms')}</Text>
                </Space>
              </div>
            </Space>
          </div>

          <Alert
            message={t('aiDescriptionGenerator.tipTitle')}
            description={t('aiDescriptionGenerator.tipDescription')}
            type="info"
            showIcon
          />

          {rateLimitMessage && (
            <Alert
              message={t('aiDescriptionGenerator.rateLimitTitle')}
              description={rateLimitMessage}
              type="warning"
              showIcon
            />
          )}

          {loading && (
            <div>
              <Progress 
                percent={generationProgress} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                {currentStep}
              </Text>
            </div>
          )}

          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
            disabled={!allReady || disabled}
            loading={loading}
            block
            style={{ height: 50, fontSize: 16 }}
          >
            {loading ? t('aiDescriptionGenerator.generating') : t('aiDescriptionGenerator.generateButton')}
          </Button>
        </Space>
      </Card>

      <Modal
        title={t('aiDescriptionGenerator.generationSettings')}
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsVisible(false)}>
            {t('aiDescriptionGenerator.cancel')}
          </Button>,
          <Button
            key="ok"
            type="primary"
            onClick={() => setSettingsVisible(false)}
          >
            {t('aiDescriptionGenerator.apply')}
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message={t('aiDescriptionGenerator.additionalRequirementsTitle')}
            description={t('aiDescriptionGenerator.additionalRequirementsDescription')}
            type="info"
            showIcon
          />

          <div>
            <Text strong>{t('aiDescriptionGenerator.additionalPrompt')}</Text>
            <TextArea
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder={t('aiDescriptionGenerator.additionalPromptPlaceholder')}
              rows={6}
              maxLength={500}
              showCount
              style={{ marginTop: 8 }}
            />
          </div>

          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('aiDescriptionGenerator.requirementsNote')}
          </Paragraph>
        </Space>
      </Modal>
    </>
  );
};

export default AIDescriptionGenerator;