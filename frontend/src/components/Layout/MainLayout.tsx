// frontend/src/components/Layout/MainLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppShell,
  Burger,
  Group,
  Avatar,
  Menu,
  Text,
  UnstyledButton,
  NavLink,
  Stack,
  Box,
  ActionIcon,
  Tooltip,
  Paper,
  Divider,
  useMantineColorScheme,
  Badge,
  ScrollArea
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconDashboard,
  IconHome,
  IconUsers,
  IconShieldCheck,
  IconLogout,
  IconUser,
  IconWorld,
  IconFolder,
  IconFileText,
  IconClipboard,
  IconChevronDown,
  IconChevronRight,
  IconMoon,
  IconSun
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { authApi } from '@/api/auth.api';
import { partnersApi } from '@/api/partners.api';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  badge?: string | number;
}

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, clearAuth, hasPermission } = useAuthStore();
  const { language, setLanguage } = useAppStore();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [logoFilename, setLogoFilename] = useState<string>('logo.svg');

  // Загрузка логотипа по домену
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const currentDomain = window.location.hostname;
        console.log('Current domain:', currentDomain);
        
        const result = await partnersApi.getByDomain(currentDomain);
        console.log('Logo result:', result);
        
        if (result.logo_filename) {
          setLogoFilename(result.logo_filename);
        }
      } catch (error) {
        console.error('Error loading logo:', error);
        // В случае ошибки используем дефолтный логотип
        setLogoFilename('logo.svg');
      }
    };

    loadLogo();
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

  const handleProfile = () => {
    navigate('/profile');
    if (isMobile) {
      closeMobile();
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      closeMobile();
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const navItems: NavItem[] = [
    {
      path: '/',
      label: t('nav.dashboard'),
      icon: <IconDashboard size={20} stroke={1.5} />
    },
    ...(hasPermission('properties.read') ? [{
      path: '/properties',
      label: t('nav.properties'),
      icon: <IconHome size={20} stroke={1.5} />
    }] : []),
    ...(hasPermission('agreements.view') ? [{
      path: '/agreements',
      label: t('nav.agreements') || 'Договоры',
      icon: <IconFileText size={20} stroke={1.5} />
    }] : []),
    ...(hasPermission('requests.view') ? [{
      path: '/requests',
      label: 'Заявки',
      icon: <IconClipboard size={20} stroke={1.5} />
    }] : []),
    ...(hasPermission('file_manager.view') ? [{
      path: '/file-manager',
      label: t('menu.fileManager') || 'Файлообменник',
      icon: <IconFolder size={20} stroke={1.5} />
    }] : []),
    ...(hasPermission('users.read') ? [{
      path: '/users',
      label: t('nav.users'),
      icon: <IconUsers size={20} stroke={1.5} />
    }] : []),
    ...(hasPermission('roles.read') ? [{
      path: '/roles',
      label: t('nav.roles'),
      icon: <IconShieldCheck size={20} stroke={1.5} />
    }] : [])
  ];

  const languages = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文', flag: '🇨🇳' }
  ];

  // Получаем название первой роли пользователя
  const userRoleName = user?.roles && user.roles.length > 0 ? user.roles[0].role_name : '';

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened }
      }}
      padding="md"
      styles={{
        main: {
          background: colorScheme === 'dark' ? '#1A1B1E' : '#F8F9FA',
          minHeight: '100vh'
        }
      }}
    >
      {/* Header */}
      <AppShell.Header
        style={{
          borderBottom: `1px solid ${colorScheme === 'dark' ? '#2C2E33' : '#DEE2E6'}`,
          background: colorScheme === 'dark' 
            ? 'linear-gradient(135deg, #1A1B1E 0%, #25262B 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%)'
        }}
      >
        <Group h="100%" px="md" justify="space-between">
          {/* Left section */}
          <Group gap="sm">
            <Burger
              opened={isMobile ? mobileOpened : desktopOpened}
              onClick={isMobile ? toggleMobile : toggleDesktop}
              size="sm"
              color={colorScheme === 'dark' ? 'white' : 'dark'}
            />
            
            {!isMobile && (
              <Group gap="xs">
                <img
                  src={`/${logoFilename}`}
                  alt="Logo"
                  style={{
                    height: 36,
                    width: 'auto',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/')}
                  onError={(e) => {
                    // Fallback на дефолтный логотип если файл не найден
                    e.currentTarget.src = '/logo.svg';
                  }}
                />
              </Group>
            )}
          </Group>

          {/* Right section */}
          <Group gap="sm">
            {/* Theme toggle */}
            <Tooltip label={colorScheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => toggleColorScheme()}
                style={{ transition: 'transform 0.2s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'rotate(180deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'rotate(0deg)';
                }}
              >
                {colorScheme === 'dark' ? (
                  <IconSun size={20} stroke={1.5} />
                ) : (
                  <IconMoon size={20} stroke={1.5} />
                )}
              </ActionIcon>
            </Tooltip>

            {/* Language selector */}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Tooltip label={t('common.language')}>
                  <UnstyledButton
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colorScheme === 'dark' ? '#25262B' : '#F1F3F5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Group gap={8}>
                      <IconWorld size={20} stroke={1.5} />
                      {!isMobile && (
                        <Text size="sm" fw={500}>
                          {languages.find(l => l.code === language)?.flag} {language.toUpperCase()}
                        </Text>
                      )}
                    </Group>
                  </UnstyledButton>
                </Tooltip>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{t('common.selectLanguage')}</Menu.Label>
                {languages.map((lang) => (
                  <Menu.Item
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    leftSection={<Text size="lg">{lang.flag}</Text>}
                    rightSection={
                      language === lang.code && (
                        <IconChevronRight size={14} stroke={1.5} />
                      )
                    }
                    style={{
                      backgroundColor: language === lang.code 
                        ? (colorScheme === 'dark' ? '#25262B' : '#F1F3F5')
                        : 'transparent'
                    }}
                  >
                    {lang.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            {/* User menu */}
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colorScheme === 'dark' ? '#25262B' : '#F1F3F5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Group gap={8}>
                    <Avatar
                      size={isMobile ? 32 : 36}
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape', deg: 135 }}
                    >
                      <IconUser size={20} stroke={1.5} />
                    </Avatar>
                    {!isMobile && (
                      <>
                        <Stack gap={0}>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {user?.full_name}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {user?.email}
                          </Text>
                        </Stack>
                        <IconChevronDown size={16} stroke={1.5} />
                      </>
                    )}
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Group gap="xs">
                    <Avatar
                      size={32}
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape', deg: 135 }}
                    >
                      <IconUser size={16} stroke={1.5} />
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {user?.full_name}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {user?.email}
                      </Text>
                    </Stack>
                  </Group>
                </Menu.Label>

                <Menu.Divider />

                <Menu.Item
                  leftSection={<IconUser size={16} stroke={1.5} />}
                  onClick={handleProfile}
                >
                  {t('menu.profile') || 'Профиль'}
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} stroke={1.5} />}
                  onClick={handleLogout}
                >
                  {t('common.logout')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Navbar */}
      <AppShell.Navbar
        p="md"
        style={{
          borderRight: `1px solid ${colorScheme === 'dark' ? '#2C2E33' : '#DEE2E6'}`,
          background: colorScheme === 'dark' ? '#1A1B1E' : '#FFFFFF'
        }}
      >
        <AppShell.Section>
          {/* Logo для мобильных */}
          {isMobile && (
            <Box
              mb="md"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingBottom: 16,
                borderBottom: `1px solid ${colorScheme === 'dark' ? '#2C2E33' : '#DEE2E6'}`
              }}
            >
              <img
                src={`/${logoFilename}`}
                alt="Logo"
                style={{
                  height: 40,
                  width: 'auto',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  navigate('/');
                  if (isMobile) closeMobile();
                }}
                onError={(e) => {
                  // Fallback на дефолтный логотип если файл не найден
                  e.currentTarget.src = '/logo.svg';
                }}
              />
            </Box>
          )}
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4} mt={isMobile ? 0 : 'md'}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const isHovered = hoveredItem === item.path;

              return (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={item.icon}
                  rightSection={
                    item.badge && (
                      <Badge size="sm" variant="filled" color="red">
                        {item.badge}
                      </Badge>
                    )
                  }
                  active={isActive}
                  onClick={() => handleNavigation(item.path)}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    borderRadius: '8px',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    transform: isHovered && !isActive ? 'translateX(4px)' : 'translateX(0)',
                    background: isActive
                      ? (colorScheme === 'dark'
                        ? 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)'
                        : 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)')
                      : (isHovered
                        ? (colorScheme === 'dark' ? '#25262B' : '#F1F3F5')
                        : 'transparent'),
                    color: isActive ? '#FFFFFF' : undefined,
                    boxShadow: isActive ? '0 4px 12px rgba(121, 80, 242, 0.3)' : 'none'
                  }}
                  styles={{
                    label: {
                      color: isActive ? '#FFFFFF' : undefined
                    },
                    section: {
                      color: isActive ? '#FFFFFF' : undefined
                    }
                  }}
                />
              );
            })}
          </Stack>
        </AppShell.Section>

        {/* Footer section */}
        <AppShell.Section>
          <Divider mb="md" />
          <Paper
            p="sm"
            radius="md"
            style={{
              background: colorScheme === 'dark'
                ? 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)'
                : 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onClick={handleProfile}
          >
            <Group gap="sm">
              <Avatar
                size={40}
                radius="xl"
                variant="white"
                color="violet"
              >
                <IconUser size={20} stroke={1.5} />
              </Avatar>
              {(!isMobile || mobileOpened) && (
                <Stack gap={0} style={{ flex: 1 }}>
                  <Text size="sm" fw={600} c="white" lineClamp={1}>
                    {user?.full_name}
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)" lineClamp={1}>
                    {userRoleName}
                  </Text>
                </Stack>
              )}
            </Group>
          </Paper>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main>
        <Box
          style={{
            minHeight: 'calc(100vh - 96px)'
          }}
        >
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
};

export default MainLayout;