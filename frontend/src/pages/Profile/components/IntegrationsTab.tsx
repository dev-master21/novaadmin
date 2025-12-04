// frontend/src/pages/Profile/components/IntegrationsTab.tsx
import React, { useState, useEffect } from 'react';
import { 
  Stack, 
  Title, 
  Text, 
  Card, 
  Group, 
  Button, 
  ThemeIcon, 
  Center,
  Loader,
  Modal,
  useMantineTheme
} from '@mantine/core';
import { 
  IconApi, 
  IconCheck, 
  IconSettings,
  IconAlertCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { integrationsApi } from '../../../api/integrations.api';
import Beds24Integration from './Beds24Integration';

const IntegrationsTab: React.FC = () => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
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

  const beds24Integration = integrations.find(i => i.integration_type === 'beds24');
  const isBeds24Configured = beds24Integration && beds24Integration.is_verified;

  if (loading) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            {t('common.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={4}>{t('integrations.title')}</Title>
        <Text size="sm" c="dimmed" mt="xs">
          {t('integrations.description')}
        </Text>
      </div>

      <Stack gap="md">
        <Card
          shadow="sm"
          p={isMobile ? 'md' : 'xl'}
          radius="md"
          withBorder
          style={{
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = theme.shadows.md;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'} gap="lg">
            <Group gap="lg" wrap="nowrap" style={{ flex: 1 }}>
              <ThemeIcon
                size={isMobile ? 48 : 56}
                radius="md"
                variant="light"
                color="blue"
              >
                <IconApi size={isMobile ? 24 : 28} />
              </ThemeIcon>
              
              <Stack gap={4} style={{ flex: 1 }}>
                <Title order={5}>Beds24</Title>
                <Group gap="xs">
                  {isBeds24Configured ? (
                    <>
                      <ThemeIcon size="xs" color="green" variant="light" radius="xl">
                        <IconCheck size={12} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed">
                        {t('integrations.beds24.configured')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <ThemeIcon size="xs" color="orange" variant="light" radius="xl">
                        <IconAlertCircle size={12} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed">
                        {t('integrations.beds24.notConfigured')}
                      </Text>
                    </>
                  )}
                </Group>
              </Stack>
            </Group>

            <Button
              variant={isBeds24Configured ? 'light' : 'gradient'}
              gradient={isBeds24Configured ? undefined : { from: 'blue', to: 'cyan' }}
              leftSection={<IconSettings size={18} />}
              onClick={() => handleOpenIntegration('beds24')}
              size={isMobile ? 'sm' : 'md'}
              fullWidth={isMobile}
            >
              {isBeds24Configured ? t('integrations.manage') : t('integrations.setup')}
            </Button>
          </Group>
        </Card>

        {integrations.length === 0 && (
          <Card shadow="sm" p="xl" radius="md" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                  <IconApi size={40} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="dimmed">
                  {t('integrations.noIntegrations')}
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {t('integrations.noIntegrationsDescription')}
                </Text>
              </Stack>
            </Center>
          </Card>
        )}
      </Stack>

      <Modal
        opened={selectedIntegration === 'beds24'}
        onClose={handleCloseIntegration}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconApi size={20} />
            </ThemeIcon>
            <Text fw={600}>Beds24</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'xl'}
        centered
        padding={isMobile ? 'md' : 'xl'}
      >
        <Beds24Integration onClose={handleCloseIntegration} />
      </Modal>
    </Stack>
  );
};

export default IntegrationsTab;