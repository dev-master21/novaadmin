// frontend/src/pages/Profile/components/Beds24Integration.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack,
  PasswordInput,
  Button,
  Alert,
  Divider,
  Title,
  Text,
  Center,
  Loader,
  Stepper,
  Progress,
  Group
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconCheck,
  IconTrash,
  IconRefresh,
  IconInfoCircle,
  IconAlertCircle,
  IconX
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { integrationsApi, Beds24Property, MyProperty } from '../../../api/integrations.api';
import Beds24PropertySelector from './Beds24PropertySelector';

interface Props {
  onClose: () => void;
}

const Beds24Integration: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [apiKeyV1, setApiKeyV1] = useState('');
  const [apiKeyV2, setApiKeyV2] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [integration, setIntegration] = useState<any>(null);
  const [beds24Properties, setBeds24Properties] = useState<Beds24Property[]>([]);
  const [myProperties, setMyProperties] = useState<MyProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
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
        setApiKeyV1(response.data.data.api_key_v1 || '');
        setApiKeyV2(response.data.data.api_key_v2 || '');
        
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

      setLoadingProgress(20);
      const myPropsResponse = await integrationsApi.getMyProperties();
      
      if (myPropsResponse.data.success) {
        setMyProperties(myPropsResponse.data.data);
      }

      setLoadingProgress(40);
      setLoadingMessage(t('integrations.beds24.loadingBeds24Properties'));

      const beds24Response = await integrationsApi.getBeds24Properties();

      if (beds24Response.data.success) {
        setBeds24Properties(beds24Response.data.data);
      }

      setLoadingProgress(100);
      setLoadingMessage(t('integrations.beds24.loadingComplete'));

      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingMessage('');
      }, 1000);

    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('integrations.beds24.errorLoadingProperties'),
        color: 'red',
        icon: <IconX size={18} />
      });
      setLoadingProgress(0);
      setLoadingMessage('');
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleSaveKeys = async () => {
    try {
      setLoading(true);
      
      const response = await integrationsApi.saveIntegration('beds24', {
        api_key_v1: apiKeyV1,
        api_key_v2: apiKeyV2,
      });

      if (response.data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('integrations.beds24.keysSaved'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        setIntegration({ ...integration, api_key_v1: apiKeyV1, api_key_v2: apiKeyV2 });
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('common.error'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!apiKeyV1) {
      notifications.show({
        title: t('common.warning'),
        message: t('integrations.beds24.enterApiKey'),
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    try {
      setVerifying(true);
      setLoadingProgress(0);
      setLoadingMessage(t('integrations.beds24.verifying'));

      setLoadingProgress(30);
      await handleSaveKeys();

      setLoadingProgress(60);
      const response = await integrationsApi.verifyBeds24(apiKeyV1);

      setLoadingProgress(100);

      if (response.data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('integrations.beds24.keyVerified'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        setCurrentStep(1);
        setIntegration({ ...integration, is_verified: true });
        
        setTimeout(() => {
          setLoadingProgress(0);
          setLoadingMessage('');
          loadProperties();
        }, 500);
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('integrations.beds24.keyInvalid'),
        color: 'red',
        icon: <IconX size={18} />
      });
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
        notifications.show({
          title: t('common.success'),
          message: t('integrations.beds24.linked'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        loadProperties();
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('common.error'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleUnlink = async (propertyId: number) => {
    try {
      const response = await integrationsApi.unlinkProperty(propertyId);

      if (response.data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('integrations.beds24.unlinked'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        loadProperties();
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('common.error'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('integrations.beds24.deleteConfirmTitle'),
      children: (
        <Text size="sm">
          {t('integrations.beds24.deleteConfirmContent')}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await integrationsApi.deleteIntegration('beds24');
          notifications.show({
            title: t('common.success'),
            message: t('integrations.beds24.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          onClose();
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: error.response?.data?.message || t('common.error'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  if (loading && !integration) {
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
      <Stepper
        active={currentStep}
        onStepClick={setCurrentStep}
        allowNextStepsSelect={false}
      >
        <Stepper.Step
          label={t('integrations.beds24.step1')}
          description={t('integrations.beds24.step1Description') || undefined}
          icon={currentStep > 0 ? <IconCheck size={18} /> : undefined}
        />
        <Stepper.Step
          label={t('integrations.beds24.step2')}
          description={t('integrations.beds24.step2Description') || undefined}
        />
      </Stepper>

      {(verifying || loadingProperties) && loadingProgress > 0 && (
        <Stack gap="xs">
          <Progress 
            value={loadingProgress} 
            animated
            color="blue"
          />
          {loadingMessage && (
            <Text size="sm" c="dimmed" ta="center">
              {loadingMessage}
            </Text>
          )}
        </Stack>
      )}

      {currentStep === 0 && (
        <Stack gap="lg">
          <Alert
            icon={<IconInfoCircle size={18} />}
            title={t('integrations.beds24.apiKeyInfo')}
            color="blue"
          >
            <Stack gap="xs">
              <Text size="sm">
                {t('integrations.beds24.apiKeyDescription')}
              </Text>
              <div>
                <Text size="sm" fw={600}>
                  {t('integrations.beds24.whereToFind')}:
                </Text>
                <Text size="sm">
                  1. {t('integrations.beds24.loginToBeds24')}
                </Text>
                <Text size="sm">
                  2. {t('integrations.beds24.goToSettings')}
                </Text>
                <Text size="sm">
                  3. {t('integrations.beds24.findApiSection')}
                </Text>
                <Text size="sm">
                  4. {t('integrations.beds24.copyKey')}
                </Text>
              </div>
            </Stack>
          </Alert>

          <PasswordInput
            label={t('integrations.beds24.apiKeyV1')}
            placeholder={t('integrations.beds24.enterApiKeyV1')}
            value={apiKeyV1}
            onChange={(e) => setApiKeyV1(e.target.value)}
            required
            size={isMobile ? 'sm' : 'md'}
            disabled={verifying}
            styles={{
              input: { fontSize: '16px' }
            }}
          />

          <PasswordInput
            label={t('integrations.beds24.apiKeyV2')}
            description={t('integrations.beds24.apiKeyV2Optional')}
            placeholder={t('integrations.beds24.enterApiKeyV2')}
            value={apiKeyV2}
            onChange={(e) => setApiKeyV2(e.target.value)}
            size={isMobile ? 'sm' : 'md'}
            disabled={verifying}
            styles={{
              input: { fontSize: '16px' }
            }}
          />

          <Group gap="xs" wrap="wrap">
            <Button
              leftSection={<IconCheck size={18} />}
              onClick={handleVerify}
              loading={verifying}
              disabled={verifying || !apiKeyV1}
              size={isMobile ? 'sm' : 'md'}
            >
              {t('integrations.beds24.verify')}
            </Button>

            <Button
              variant="light"
              onClick={onClose}
              disabled={verifying}
              size={isMobile ? 'sm' : 'md'}
            >
              {t('common.cancel')}
            </Button>

            {integration && (
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={18} />}
                onClick={handleDelete}
                disabled={verifying}
                size={isMobile ? 'sm' : 'md'}
              >
                {t('common.delete')}
              </Button>
            )}
          </Group>
        </Stack>
      )}

      {currentStep === 1 && (
        <Stack gap="lg">
          <Alert
            icon={<IconCheck size={18} />}
            title={t('integrations.beds24.verifiedSuccess')}
            color="green"
          />

          <div>
            <Title order={5}>{t('integrations.beds24.linkProperties')}</Title>
            <Text size="sm" c="dimmed" mt={4}>
              {t('integrations.beds24.linkPropertiesDescription')}
            </Text>
          </div>

          {loadingProperties && loadingProgress === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="md">
                <Loader size="lg" />
                <Text size="sm" c="dimmed">
                  {t('common.loading')}
                </Text>
              </Stack>
            </Center>
          ) : (
            <Beds24PropertySelector
              beds24Properties={beds24Properties}
              myProperties={myProperties}
              onLink={handleLink}
              onUnlink={handleUnlink}
            />
          )}

          <Divider />

          <Group gap="xs" wrap="wrap">
            <Button
              variant="light"
              leftSection={<IconRefresh size={18} />}
              onClick={loadProperties}
              loading={loadingProperties}
              disabled={loadingProperties}
              size={isMobile ? 'sm' : 'md'}
            >
              {t('common.refresh')}
            </Button>

            <Button
              variant="light"
              onClick={() => setCurrentStep(0)}
              disabled={loadingProperties}
              size={isMobile ? 'sm' : 'md'}
            >
              {t('integrations.beds24.backToKeys')}
            </Button>

            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={18} />}
              onClick={handleDelete}
              disabled={loadingProperties}
              size={isMobile ? 'sm' : 'md'}
            >
              {t('integrations.beds24.deleteIntegration')}
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
};

export default Beds24Integration;