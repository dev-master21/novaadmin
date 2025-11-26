// frontend/src/pages/Profile/components/Beds24Integration.tsx
import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Alert,
  Divider,
  Typography,
  Spin,
  message,
  Steps,
  Modal,
  Progress,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { integrationsApi, Beds24Property, MyProperty } from '../../../api/integrations.api';
import Beds24PropertySelector from './Beds24PropertySelector';
import './Beds24Integration.css';

const { Title, Text, Paragraph } = Typography;

interface Props {
  onClose: () => void;
}

const Beds24Integration: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [integration, setIntegration] = useState<any>(null);
  const [beds24Properties, setBeds24Properties] = useState<Beds24Property[]>([]);
  const [myProperties, setMyProperties] = useState<MyProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // ✅ НОВОЕ: Состояние для прогресса
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const response = await integrationsApi.getIntegration('beds24');
      
      if (response.data.success && response.data.data) {
        setIntegration(response.data.data);
        form.setFieldsValue({
          api_key_v1: response.data.data.api_key_v1,
          api_key_v2: response.data.data.api_key_v2,
        });
        
        if (response.data.data.is_verified) {
          setCurrentStep(1);
          loadProperties();
        }
      }
    } catch (error: any) {
      console.log('Integration not found, creating new one');
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      setLoadingProperties(true);
      setLoadingProgress(0);
      setLoadingMessage(t('integrations.beds24.loadingData'));

      // Загружаем наши объекты
      setLoadingProgress(20);
      const myPropsResponse = await integrationsApi.getMyProperties();
      
      if (myPropsResponse.data.success) {
        setMyProperties(myPropsResponse.data.data);
      }

      // Загружаем объекты из Beds24
      setLoadingProgress(40);
      setLoadingMessage(t('integrations.beds24.loadingBeds24Properties'));

      const beds24Response = await integrationsApi.getBeds24Properties();

      if (beds24Response.data.success) {
        setBeds24Properties(beds24Response.data.data);
      }

      setLoadingProgress(100);
      setLoadingMessage(t('integrations.beds24.loadingComplete'));

      // Скрываем прогресс через 1 секунду
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingMessage('');
      }, 1000);

    } catch (error: any) {
      message.error(error.response?.data?.message || t('integrations.beds24.errorLoadingProperties'));
      setLoadingProgress(0);
      setLoadingMessage('');
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleSaveKeys = async (values: any) => {
    try {
      setLoading(true);
      
      const response = await integrationsApi.saveIntegration('beds24', {
        api_key_v1: values.api_key_v1,
        api_key_v2: values.api_key_v2,
      });

      if (response.data.success) {
        message.success(t('integrations.beds24.keysSaved'));
        setIntegration({ ...integration, ...values });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const apiKey = form.getFieldValue('api_key_v1');
      
      if (!apiKey) {
        message.warning(t('integrations.beds24.enterApiKey'));
        return;
      }

      setVerifying(true);
      setLoadingProgress(0);
      setLoadingMessage(t('integrations.beds24.verifying'));

      // Сначала сохраняем ключи
      setLoadingProgress(30);
      await handleSaveKeys(form.getFieldsValue());

      // Затем проверяем
      setLoadingProgress(60);
      const response = await integrationsApi.verifyBeds24(apiKey);

      setLoadingProgress(100);

      if (response.data.success) {
        message.success(t('integrations.beds24.keyVerified'));
        setCurrentStep(1);
        setIntegration({ ...integration, is_verified: true });
        
        // Небольшая задержка перед загрузкой свойств
        setTimeout(() => {
          setLoadingProgress(0);
          setLoadingMessage('');
          loadProperties();
        }, 500);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('integrations.beds24.keyInvalid'));
      setLoadingProgress(0);
      setLoadingMessage('');
    } finally {
      setVerifying(false);
    }
  };

  const handleLink = async (propertyId: number, beds24PropId: number, beds24RoomId: number) => {
    try {
      const response = await integrationsApi.linkProperty({
        property_id: propertyId,
        beds24_prop_id: beds24PropId,
        beds24_room_id: beds24RoomId,
      });

      if (response.data.success) {
        message.success(t('integrations.beds24.linked'));
        loadProperties();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('common.error'));
    }
  };

  const handleUnlink = async (propertyId: number) => {
    try {
      const response = await integrationsApi.unlinkProperty(propertyId);

      if (response.data.success) {
        message.success(t('integrations.beds24.unlinked'));
        loadProperties();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('common.error'));
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('integrations.beds24.deleteConfirmTitle'),
      content: t('integrations.beds24.deleteConfirmContent'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await integrationsApi.deleteIntegration('beds24');
          message.success(t('integrations.beds24.deleted'));
          onClose();
        } catch (error: any) {
          message.error(error.response?.data?.message || t('common.error'));
        }
      },
    });
  };

  if (loading && !integration) {
    return <Spin />;
  }

  return (
    <div className="beds24-integration">
      <Steps
        current={currentStep}
        items={[
          {
            title: t('integrations.beds24.step1'),
            icon: currentStep > 0 ? <CheckCircleOutlined /> : undefined,
          },
          {
            title: t('integrations.beds24.step2'),
          },
        ]}
        style={{ marginBottom: 32 }}
      />

      {/* ✅ НОВОЕ: Глобальный прогресс-бар */}
      {(verifying || loadingProperties) && loadingProgress > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Progress 
            percent={loadingProgress} 
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          {loadingMessage && (
            <div style={{ textAlign: 'center', marginTop: 8, color: '#666', fontSize: 14 }}>
              {loadingMessage}
            </div>
          )}
        </div>
      )}

      {currentStep === 0 && (
        <div>
          <Alert
            message={t('integrations.beds24.apiKeyInfo')}
            description={
              <div>
                <Paragraph>
                  {t('integrations.beds24.apiKeyDescription')}
                </Paragraph>
                <Paragraph>
                  <Text strong>{t('integrations.beds24.whereToFind')}:</Text>
                  <br />
                  1. {t('integrations.beds24.loginToBeds24')}
                  <br />
                  2. {t('integrations.beds24.goToSettings')}
                  <br />
                  3. {t('integrations.beds24.findApiSection')}
                  <br />
                  4. {t('integrations.beds24.copyKey')}
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveKeys}
          >
            <Form.Item
              label={t('integrations.beds24.apiKeyV1')}
              name="api_key_v1"
              rules={[
                { required: true, message: t('integrations.beds24.apiKeyRequired') },
              ]}
            >
              <Input.Password
                placeholder={t('integrations.beds24.enterApiKeyV1')}
                size="large"
                disabled={verifying}
              />
            </Form.Item>

            <Form.Item
              label={t('integrations.beds24.apiKeyV2')}
              name="api_key_v2"
              extra={t('integrations.beds24.apiKeyV2Optional')}
            >
              <Input.Password
                placeholder={t('integrations.beds24.enterApiKeyV2')}
                size="large"
                disabled={verifying}
              />
            </Form.Item>

            <Space>
              <Button
                type="primary"
                size="large"
                onClick={handleVerify}
                loading={verifying}
                icon={<CheckCircleOutlined />}
                disabled={verifying}
              >
                {t('integrations.beds24.verify')}
              </Button>

              <Button
                size="large"
                onClick={onClose}
                disabled={verifying}
              >
                {t('common.cancel')}
              </Button>

              {integration && (
                <Button
                  danger
                  size="large"
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  disabled={verifying}
                >
                  {t('common.delete')}
                </Button>
              )}
            </Space>
          </Form>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <Alert
            message={t('integrations.beds24.verifiedSuccess')}
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 24 }}
          />

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={5}>{t('integrations.beds24.linkProperties')}</Title>
              <Text type="secondary">{t('integrations.beds24.linkPropertiesDescription')}</Text>
            </div>

            {loadingProperties && loadingProgress === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ) : (
              <Beds24PropertySelector
                beds24Properties={beds24Properties}
                myProperties={myProperties}
                onLink={handleLink}
                onUnlink={handleUnlink}
              />
            )}

            <Divider />

            <Space>
              <Button
                icon={<SyncOutlined />}
                onClick={loadProperties}
                loading={loadingProperties}
                disabled={loadingProperties}
              >
                {t('common.refresh')}
              </Button>

              <Button
                onClick={() => setCurrentStep(0)}
                disabled={loadingProperties}
              >
                {t('integrations.beds24.backToKeys')}
              </Button>

              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                disabled={loadingProperties}
              >
                {t('integrations.beds24.deleteIntegration')}
              </Button>
            </Space>
          </Space>
        </div>
      )}
    </div>
  );
};

export default Beds24Integration;