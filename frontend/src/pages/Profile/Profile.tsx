// frontend/src/pages/Profile/Profile.tsx
import React, { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { IconUser, IconApi } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import IntegrationsTab from './components/IntegrationsTab';
import ProfileInfoTab from './components/ProfileInfoTab';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState<string | null>('profile');

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
        </Tabs.List>

        <Tabs.Panel value="profile" pt="xl">
          <ProfileInfoTab />
        </Tabs.Panel>

        <Tabs.Panel value="integrations" pt="xl">
          <IntegrationsTab />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default Profile;