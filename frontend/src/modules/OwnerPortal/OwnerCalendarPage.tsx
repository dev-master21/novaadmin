// frontend/src/modules/OwnerPortal/OwnerCalendarPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  Button,
  Stack,
  Loader,
  Title,
  Breadcrumbs,
  Anchor,
  Group,
  ThemeIcon,
  Paper,
  Box,
  Center,
  Text,
  Alert,
  Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconHome,
  IconCalendar,
  IconX,
  IconLock,
  IconLockOpen,
  IconInfoCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { propertyOwnersApi } from '@/api/propertyOwners.api';
import CalendarManager from '@/modules/Properties/components/CalendarManager';
import { useOwnerStore } from '@/store/ownerStore';

const OwnerCalendarPage = () => {
  const { t } = useTranslation();
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<any>(null);

  const canEditCalendar = useOwnerStore(state => state.canEditCalendar());

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    setLoading(true);
    try {
      const { data } = await propertyOwnersApi.getProperty(Number(propertyId));
      if (data.success) {
        setProperty(data.data);
      }
    } catch (error: any) {
      notifications.show({
        title: t('ownerPortal.errorLoadingProperty'),
        message: '',
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/owner/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh' }}>
        <Paper
          shadow="md"
          p="md"
          radius={0}
          style={{
            background: 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}
        >
          <Container size="xl">
            <Group gap="sm">
              <ThemeIcon
                size={isMobile ? 'lg' : 'xl'}
                radius="md"
                variant="white"
                color="violet"
              >
                <IconHome size={isMobile ? 20 : 24} stroke={1.5} />
              </ThemeIcon>
              {!isMobile && (
                <Stack gap={0}>
                  <Text size="lg" fw={700} c="white">
                    NOVA ESTATE
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)">
                    {t('ownerPortal.portal')}
                  </Text>
                </Stack>
              )}
            </Group>
          </Container>
        </Paper>

        <Container size="xl" py="xl">
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="xl" variant="dots" />
                <Text c="dimmed">{t('common.loading')}</Text>
              </Stack>
            </Center>
          </Card>
        </Container>
      </Box>
    );
  }

  const breadcrumbItems = [
    { title: t('ownerPortal.dashboard'), href: '/owner/dashboard' },
    { title: property?.property_name || property?.property_number, href: '#' },
    { title: t('ownerPortal.calendar'), href: '#' }
  ].map((item, index) => (
    <Anchor
      key={index}
      href={item.href}
      onClick={(e) => {
        if (item.href === '/owner/dashboard') {
          e.preventDefault();
          navigate('/owner/dashboard');
        }
      }}
      c={index === 2 ? 'dimmed' : 'blue'}
      style={{ cursor: index === 2 ? 'default' : 'pointer' }}
    >
      {index === 0 && (
        <Group gap={4}>
          <IconHome size={14} />
          <span>{item.title}</span>
        </Group>
      )}
      {index !== 0 && item.title}
    </Anchor>
  ));

  return (
    <Box style={{ minHeight: '100vh' }}>
      <Paper
        shadow="md"
        p="md"
        radius={0}
        style={{
          background: 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <Container size="xl">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon
                size={isMobile ? 'lg' : 'xl'}
                radius="md"
                variant="white"
                color="violet"
              >
                <IconHome size={isMobile ? 20 : 24} stroke={1.5} />
              </ThemeIcon>
              {!isMobile && (
                <Stack gap={0}>
                  <Text size="lg" fw={700} c="white">
                    NOVA ESTATE
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)">
                    {t('ownerPortal.portal')}
                  </Text>
                </Stack>
              )}
            </Group>

            <Button
              variant="white"
              color="violet"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => navigate('/owner/dashboard')}
              size={isMobile ? 'sm' : 'md'}
            >
              {!isMobile && t('common.back')}
            </Button>
          </Group>
        </Container>
      </Paper>

      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Breadcrumbs separator="›">
            {breadcrumbItems}
          </Breadcrumbs>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="md" wrap="nowrap" justify="space-between">
              <Group gap="md" wrap="nowrap">
                <ThemeIcon
                  size="xl"
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  <IconCalendar size={28} stroke={1.5} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Title order={isMobile ? 4 : 3}>
                    {t('ownerPortal.manageCalendar')}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {property?.property_name || property?.property_number}
                  </Text>
                </Stack>
              </Group>

              <Badge
                size="lg"
                variant="light"
                color={canEditCalendar ? 'green' : 'gray'}
                leftSection={canEditCalendar ? <IconLockOpen size={14} /> : <IconLock size={14} />}
              >
                {canEditCalendar ? t('ownerPortal.canEdit') : t('ownerPortal.viewOnly')}
              </Badge>
            </Group>
          </Card>

          {!canEditCalendar && (
            <Alert
              icon={<IconInfoCircle size={18} />}
              title={t('ownerPortal.readOnlyMode')}
              color="blue"
              variant="light"
            >
              <Text size="sm">
                {t('ownerPortal.calendarReadOnlyDescription')}
              </Text>
            </Alert>
          )}

          <CalendarManager 
            propertyId={Number(propertyId)} 
            viewMode={!canEditCalendar} 
            isOwnerMode={true}
          />
        </Stack>
      </Container>
    </Box>
  );
};

export default OwnerCalendarPage;