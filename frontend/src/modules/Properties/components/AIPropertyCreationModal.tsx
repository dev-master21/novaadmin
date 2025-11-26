// frontend/src/modules/Properties/components/AIPropertyCreationModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  Input,
  Button,
  Alert,
  Space,
  Typography,
  Progress,
  message,
  Card
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  CalendarOutlined,
  PictureOutlined,
  UserOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import './AIPropertyCreationModal.css';

const { TextArea } = Input;
const { Text, Paragraph, Title } = Typography;

interface AIPropertyCreationModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (propertyData: any) => void;
}

const AIPropertyCreationModal: React.FC<AIPropertyCreationModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const { t } = useTranslation();
  
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const handleCreate = async () => {
    if (!text.trim()) {
      message.warning(t('aiPropertyCreation.enterDescription'));
      return;
    }

    setLoading(true);
    setProgress(0);
    setCurrentStep(t('aiPropertyCreation.sendingRequest'));

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 1000);

      setCurrentStep(t('aiPropertyCreation.analyzingText'));
      
      setTimeout(() => {
        setCurrentStep(t('aiPropertyCreation.extractingData'));
      }, 2000);

      setTimeout(() => {
        setCurrentStep(t('aiPropertyCreation.structuringInfo'));
      }, 4000);

      const { data } = await propertiesApi.createWithAI(text);

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentStep(t('aiPropertyCreation.done'));

      if (data.success) {
        message.success(t('aiPropertyCreation.dataExtracted'));
        
        if (data.data.warnings && data.data.warnings.length > 0) {
          Modal.warning({
            title: t('aiPropertyCreation.warnings'),
            content: (
              <div>
                {data.data.warnings.map((warning: string, idx: number) => (
                  <p key={idx}>{warning}</p>
                ))}
              </div>
            )
          });
        }
        
        if (data.data.downloadedPhotosCount > 0) {
          Modal.success({
            title: t('aiPropertyCreation.photosDownloaded'),
            width: 600,
            content: (
              <div>
                <Paragraph>
                  {t('aiPropertyCreation.downloadedCount', { count: data.data.downloadedPhotosCount })}
                </Paragraph>
                {data.data.photosInfo && (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {data.data.photosInfo.map((photo: any, index: number) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <Text>
                          {index + 1}. {photo.filename} - {t('aiPropertyCreation.category')}: <strong>{photo.category}</strong>
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          });
        }

        onSuccess(data.data.propertyData || data.data);
        setText('');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || t('aiPropertyCreation.errorCreating');
      
      if (errorMessage.includes('Google Drive') || errorMessage.includes('доступ') || errorMessage.includes('permission')) {
        Modal.error({
          title: t('aiPropertyCreation.driveAccessError'),
          content: (
            <div>
              <p>{errorMessage}</p>
              <p style={{ marginTop: 16 }}>
                <strong>{t('aiPropertyCreation.howToFix')}</strong>
              </p>
              <ol style={{ paddingLeft: 20 }}>
                <li>{t('aiPropertyCreation.fixStep1')}</li>
                <li>{t('aiPropertyCreation.fixStep2')}</li>
                <li>{t('aiPropertyCreation.fixStep3')}</li>
                <li>{t('aiPropertyCreation.fixStep4')}</li>
              </ol>
              <p style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
                {t('aiPropertyCreation.alternativeOption')}
              </p>
            </div>
          ),
          width: 600
        });
      } else {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  return (
    <Modal
      title={
        <Space style={{ fontSize: '18px', fontWeight: 600 }}>
          <RobotOutlined style={{ fontSize: 28, color: '#667eea' }} />
          <span>{t('aiPropertyCreation.title')}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      style={{ top: 20 }}
      styles={{
        body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }
      }}
      footer={[
        <Button 
          key="cancel" 
          onClick={onCancel} 
          disabled={loading}
          size="large"
        >
          {t('aiPropertyCreation.cancel')}
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleCreate}
          loading={loading}
          disabled={!text.trim()}
          size="large"
          style={{
            background: loading ? undefined : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderColor: loading ? undefined : '#667eea'
          }}
        >
          {loading ? t('aiPropertyCreation.processing') : t('aiPropertyCreation.createButton')}
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '12px'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <InfoCircleOutlined style={{ fontSize: 24, color: '#667eea' }} />
              <Title level={5} style={{ margin: 0, color: '#fff' }}>
                {t('aiPropertyCreation.howItWorks')}
              </Title>
            </div>
            
            <Paragraph style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
              {t('aiPropertyCreation.howItWorksDescription')}
            </Paragraph>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 8
            }}>
              {[
                { icon: <HomeOutlined />, text: t('aiPropertyCreation.basicInfo') },
                { icon: <DollarOutlined />, text: t('aiPropertyCreation.pricesCommissions') },
                { icon: <CalendarOutlined />, text: t('aiPropertyCreation.calendarOccupancy') },
                { icon: <UserOutlined />, text: t('aiPropertyCreation.ownerData') },
                { icon: <CheckCircleOutlined />, text: t('aiPropertyCreation.propertyFeatures') },
                { icon: <PictureOutlined />, text: t('aiPropertyCreation.photosFromDrive') }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <span style={{ color: '#667eea', fontSize: 18 }}>{item.icon}</span>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                    {item.text}
                  </Text>
                </div>
              ))}
            </div>
          </Space>
        </Card>

        <div>
          <div style={{ 
            marginBottom: 12, 
            display: 'flex', 
            alignItems: 'center',
            gap: 8
          }}>
            <FileTextOutlined style={{ fontSize: 18, color: '#667eea' }} />
            <Text strong style={{ fontSize: 16 }}>
              {t('aiPropertyCreation.pasteDescription')}
            </Text>
          </div>
          
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('aiPropertyCreation.placeholder')}
            rows={14}
            maxLength={10000}
            showCount
            disabled={loading}
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)'
            }}
          />
        </div>

        {loading && (
          <Card
            style={{
              background: 'rgba(102, 126, 234, 0.05)',
              border: '1px solid rgba(102, 126, 234, 0.2)',
              borderRadius: 8
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Progress 
                percent={progress} 
                status="active"
                strokeColor={{
                  '0%': '#667eea',
                  '100%': '#764ba2',
                }}
                style={{ margin: 0 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RobotOutlined style={{ fontSize: 20, color: '#667eea' }} />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
                  {currentStep}
                </Text>
              </div>
            </Space>
          </Card>
        )}

        <Alert
          message={
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {t('aiPropertyCreation.importantWarning')}
            </span>
          }
          description={
            <Paragraph style={{ margin: '8px 0 0 0', fontSize: 14 }}>
              {t('aiPropertyCreation.importantDescription')}
            </Paragraph>
          }
          type="warning"
          showIcon
          style={{
            border: '1px solid rgba(250, 173, 20, 0.3)',
            background: 'rgba(250, 173, 20, 0.05)'
          }}
        />
      </Space>
    </Modal>
  );
};

export default AIPropertyCreationModal;