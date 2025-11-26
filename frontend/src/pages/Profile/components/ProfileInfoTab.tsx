// frontend/src/pages/Profile/components/ProfileInfoTab.tsx
import React from 'react';
import { Descriptions, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;

const ProfileInfoTab: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div>
      <Title level={4}>{t('profile.personalInfo')}</Title>
      
      <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }}>
        <Descriptions.Item label={t('profile.username')}>
          {user.username}
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.fullName')}>
          {user.full_name}
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.email')}>
          {user.email || t('common.notSpecified')}
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.status')}>
          {user.is_active ? (
            <Tag color="success">{t('common.active')}</Tag>
          ) : (
            <Tag color="error">{t('common.inactive')}</Tag>
          )}
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.role')}>
          {user.is_super_admin ? (
            <Tag color="purple">{t('profile.superAdmin')}</Tag>
          ) : (
            <Tag color="blue">{t('profile.user')}</Tag>
          )}
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.lastLogin')}>
          {user.last_login_at 
            ? dayjs(user.last_login_at).format('DD.MM.YYYY HH:mm')
            : t('common.never')
          }
        </Descriptions.Item>
        
        <Descriptions.Item label={t('profile.createdAt')}>
          {dayjs(user.created_at).format('DD.MM.YYYY HH:mm')}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
};

export default ProfileInfoTab;