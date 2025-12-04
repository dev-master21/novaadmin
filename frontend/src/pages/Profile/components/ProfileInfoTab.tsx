// frontend/src/pages/Profile/components/ProfileInfoTab.tsx
import React from 'react';
import { Title, Text, Grid, Card, Badge, Group, Stack, ThemeIcon, useMantineTheme } from '@mantine/core';
import { 
  IconUser, 
  IconMail, 
  IconShield, 
  IconClock, 
  IconCalendar,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { useAuthStore } from '../../../store/authStore';
import dayjs from 'dayjs';

const ProfileInfoTab: React.FC = () => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { user } = useAuthStore();

  if (!user) return null;

  const profileItems = [
    {
      icon: IconUser,
      color: 'blue',
      label: t('profile.username'),
      value: user.username
    },
    {
      icon: IconUser,
      color: 'cyan',
      label: t('profile.fullName'),
      value: user.full_name
    },
    {
      icon: IconMail,
      color: 'violet',
      label: t('profile.email'),
      value: user.email || t('common.notSpecified')
    },
    {
      icon: IconShield,
      color: 'grape',
      label: t('profile.status'),
      value: user.is_active ? (
        <Badge 
          color="green" 
          variant="light"
          leftSection={<IconCheck size={12} />}
        >
          {t('common.active')}
        </Badge>
      ) : (
        <Badge 
          color="red" 
          variant="light"
          leftSection={<IconX size={12} />}
        >
          {t('common.inactive')}
        </Badge>
      )
    },
    {
      icon: IconShield,
      color: 'indigo',
      label: t('profile.role'),
      value: user.is_super_admin ? (
        <Badge color="violet" variant="light">
          {t('profile.superAdmin')}
        </Badge>
      ) : (
        <Badge color="blue" variant="light">
          {t('profile.user')}
        </Badge>
      )
    },
    {
      icon: IconClock,
      color: 'orange',
      label: t('profile.lastLogin'),
      value: user.last_login_at 
        ? dayjs(user.last_login_at).format('DD.MM.YYYY HH:mm')
        : t('common.never')
    },
    {
      icon: IconCalendar,
      color: 'teal',
      label: t('profile.createdAt'),
      value: user.created_at 
        ? dayjs(user.created_at).format('DD.MM.YYYY HH:mm')
        : t('common.notSpecified')
    }
  ];

  return (
    <Stack gap="xl">
      <div>
        <Title order={4}>{t('profile.personalInfo')}</Title>
      </div>

      <Grid gutter="md">
        {profileItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <Grid.Col key={index} span={{ base: 12, sm: 6 }}>
              <Card
                shadow="sm"
                p="md"
                radius="md"
                withBorder
                style={{
                  height: '100%',
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
                <Group gap="md" wrap="nowrap">
                  <ThemeIcon
                    size={isMobile ? 'lg' : 'xl'}
                    radius="md"
                    variant="light"
                    color={item.color}
                  >
                    <IconComponent size={isMobile ? 20 : 24} />
                  </ThemeIcon>
                  
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {item.label}
                    </Text>
                    <Text size="sm" fw={600}>
                      {item.value}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            </Grid.Col>
          );
        })}
      </Grid>
    </Stack>
  );
};

export default ProfileInfoTab;