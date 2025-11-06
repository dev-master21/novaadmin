// frontend/src/components/Layout/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Space, Drawer } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  HomeOutlined,
  UserOutlined,
  SafetyOutlined,
  LogoutOutlined,
  GlobalOutlined,
  FolderOutlined,
  FileTextOutlined // ДОБАВЛЕНО для иконки договоров
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { authApi } from '@/api/auth.api';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, clearAuth, hasPermission } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, language, setLanguage } = useAppStore();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['/']);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    setSelectedKeys([location.pathname]);
  }, [location.pathname]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const languageMenu: MenuProps['items'] = [
    {
      key: 'ru',
      label: 'Русский 🇷🇺',
      onClick: () => handleLanguageChange('ru')
    },
    {
      key: 'en',
      label: 'English 🇬🇧',
      onClick: () => handleLanguageChange('en')
    }
  ];

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('common.logout'),
      onClick: handleLogout
    }
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('nav.dashboard'),
      onClick: () => {
        navigate('/');
        if (isMobile) setDrawerVisible(false);
      }
    },
    ...(hasPermission('properties.read') ? [{
      key: '/properties',
      icon: <HomeOutlined />,
      label: t('nav.properties'),
      onClick: () => {
        navigate('/properties');
        if (isMobile) setDrawerVisible(false);
      }
    }] : []),
    // ДОБАВЛЕНО: Пункт меню для договоров
    ...(hasPermission('agreements.view') ? [{
      key: '/agreements',
      icon: <FileTextOutlined />,
      label: t('nav.agreements') || 'Договоры',
      onClick: () => {
        navigate('/agreements');
        if (isMobile) setDrawerVisible(false);
      }
    }] : []),
    ...(hasPermission('file_manager.view') ? [{
      key: '/file-manager',
      icon: <FolderOutlined />,
      label: t('menu.fileManager') || 'Файлообменник',
      onClick: () => {
        navigate('/file-manager');
        if (isMobile) setDrawerVisible(false);
      }
    }] : []),
    ...(hasPermission('users.read') ? [{
      key: '/users',
      icon: <UserOutlined />,
      label: t('nav.users'),
      onClick: () => {
        navigate('/users');
        if (isMobile) setDrawerVisible(false);
      }
    }] : []),
    ...(hasPermission('roles.read') ? [{
      key: '/roles',
      icon: <SafetyOutlined />,
      label: t('nav.roles'),
      onClick: () => {
        navigate('/roles');
        if (isMobile) setDrawerVisible(false);
      }
    }] : [])
  ];

  const SidebarContent = () => (
    <>
      {/* Логотип */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'pointer'
        }}
        onClick={() => {
          navigate('/');
          if (isMobile) setDrawerVisible(false);
        }}
      >
        <img
          src="/logo.svg"
          alt="NOVA ESTATE"
          className="logo-svg"
          style={{
            height: isMobile ? 40 : (sidebarCollapsed ? 40 : 50),
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        items={menuItems}
        style={{ borderRight: 0 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#141414' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          breakpoint="lg"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 999
          }}
        >
          <SidebarContent />
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          closable={false}
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          bodyStyle={{ padding: 0, background: '#001529' }}
          width={250}
        >
          <SidebarContent />
        </Drawer>
      )}

      {/* Main content */}
      <Layout 
        style={{ 
          marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 200), 
          transition: 'margin-left 0.2s',
          background: '#141414'
        }}
      >
        {/* Header */}
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 998,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            background: '#001529'
          }}
        >
          <Button
            type="text"
            icon={isMobile ? <MenuFoldOutlined /> : (sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
            onClick={() => {
              if (isMobile) {
                setDrawerVisible(true);
              } else {
                toggleSidebar();
              }
            }}
            style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.85)' }}
          />

          <Space size={isMobile ? "small" : "middle"}>
            <Dropdown menu={{ items: languageMenu }} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />} style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                {!isMobile && language.toUpperCase()}
              </Button>
            </Dropdown>

            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} size={isMobile ? "small" : "default"} />
                {!isMobile && <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{user?.full_name}</span>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Content */}
        <Content
          style={{
            margin: isMobile ? '16px 8px' : '24px 16px',
            padding: isMobile ? 16 : 24,
            minHeight: 'calc(100vh - 112px)',
            background: '#141414'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;