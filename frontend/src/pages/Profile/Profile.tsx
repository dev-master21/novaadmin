// frontend/src/pages/Profile/Profile.tsx
import React, { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconUser, IconApi, IconUsers } from '@tabler/icons-react'; // ДОБАВИТЬ IconUsers
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import IntegrationsTab from './components/IntegrationsTab';
import ProfileInfoTab from './components/ProfileInfoTab';
import PartnersTab from './components/PartnersTab'; // ДОБАВИТЬ
import { useAuthStore } from '@/store/authStore'; // ДОБАВИТЬ

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const { user } = useAuthStore(); // ДОБАВИТЬ

  return (
    <Container size="xl" py="xl">
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="default"
      >
        <Tabs.List grow={isMobile}>
          <Tabs.Tab
            value="profile"
            leftSection={<IconUser size={20} />}
          >
            {t('profile.tabs.profile')}
          </Tabs.Tab>
          <Tabs.Tab
            value="integrations"
            leftSection={<IconApi size={20} />}
          >
            {t('profile.tabs.integrations')}
          </Tabs.Tab>
          
          {/* ДОБАВИТЬ: Вкладка Partners только для SuperAdmin */}
          {user?.is_super_admin && (
            <Tabs.Tab
              value="partners"
              leftSection={<IconUsers size={20} />}
            >
              Partners
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="profile" pt="xl">
          <ProfileInfoTab />
        </Tabs.Panel>

        <Tabs.Panel value="integrations" pt="xl">
          <IntegrationsTab />
        </Tabs.Panel>

        {/* ДОБАВИТЬ: Панель Partners */}
        {user?.is_super_admin && (
          <Tabs.Panel value="partners" pt="xl">
            <PartnersTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </Container>
  );
};

export default Profile;