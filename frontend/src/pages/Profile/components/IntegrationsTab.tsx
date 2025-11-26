// frontend/src/pages/Profile/components/IntegrationsTab.tsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Empty, Spin, Modal } from 'antd';
import { ApiOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { integrationsApi } from '../../../api/integrations.api';
import Beds24Integration from './Beds24Integration';

const { Title, Text } = Typography;

const IntegrationsTab: React.FC = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await integrationsApi.getIntegrations();
      
      if (response.data.success) {
        setIntegrations(response.data.data);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenIntegration = (type: string) => {
    setSelectedIntegration(type);
  };

  const handleCloseIntegration = () => {
    setSelectedIntegration(null);
    loadIntegrations();
  };

  // ✅ ИСПРАВЛЕНО: Проверяем статус интеграции правильно
  const beds24Integration = integrations.find(i => i.integration_type === 'beds24');
  const isBeds24Configured = beds24Integration && beds24Integration.is_verified;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>{t('integrations.title')}</Title>
      <Text type="secondary">{t('integrations.description')}</Text>

      <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
        {/* Beds24 Integration Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="large">
              <ApiOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Title level={5} style={{ margin: 0 }}>Beds24</Title>
                <Text type="secondary">
                  {isBeds24Configured ? (
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      {t('integrations.beds24.configured')}
                    </Space>
                  ) : (
                    t('integrations.beds24.notConfigured')
                  )}
                </Text>
              </div>
            </Space>

            <Button
              type="primary"
              icon={<SettingOutlined />}
              onClick={() => handleOpenIntegration('beds24')}
            >
              {isBeds24Configured ? t('integrations.manage') : t('integrations.setup')}
            </Button>
          </div>
        </Card>

        {/* Можно добавить другие интеграции здесь */}
        {integrations.length === 0 && (
          <Empty description={t('integrations.noIntegrations')} />
        )}
      </Space>

      {/* Modal для настройки интеграции */}
      <Modal
        title="Beds24"
        open={selectedIntegration === 'beds24'}
        onCancel={handleCloseIntegration}
        footer={null}
        width={1200}
        destroyOnClose
      >
        <Beds24Integration onClose={handleCloseIntegration} />
      </Modal>
    </div>
  );
};

export default IntegrationsTab;