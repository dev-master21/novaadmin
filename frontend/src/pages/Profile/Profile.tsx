// frontend/src/pages/Profile/Profile.tsx
import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import { UserOutlined, ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import IntegrationsTab from './components/IntegrationsTab';
import ProfileInfoTab from './components/ProfileInfoTab';
import './Profile.css';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          <span style={{ marginLeft: 8 }}>{t('profile.tabs.profile')}</span>
        </span>
      ),
      children: <ProfileInfoTab />,
    },
    {
      key: 'integrations',
      label: (
        <span>
          <ApiOutlined />
          <span style={{ marginLeft: 8 }}>{t('profile.tabs.integrations')}</span>
        </span>
      ),
      children: <IntegrationsTab />,
    },
  ];

  return (
    <div className="profile-page">
      <Card className="profile-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

export default Profile;