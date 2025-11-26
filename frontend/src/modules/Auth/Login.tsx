// frontend/src/modules/Auth/Login.tsx
import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { useAuthStore, User } from '@/store/authStore';

interface LoginFormData {
  username: string;
  password: string;
}

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: LoginFormData) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(values);
      
      // Сохраняем токены
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      
      // Маппим данные пользователя в нужный формат
      const apiUser: any = data.data.user;
      
      const user: User = {
        id: apiUser.id,
        username: apiUser.username,
        full_name: apiUser.full_name,
        email: apiUser.email || null,
        is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
        is_super_admin: apiUser.is_super_admin || false,
        roles: Array.isArray(apiUser.roles) ? apiUser.roles.map((role: any) => ({
          id: role.id || 0,
          role_name: role.role_name || role,
          permissions: Array.isArray(role.permissions) ? role.permissions : []
        })) : []
      };
      
      // Сохраняем пользователя в store
      setAuth(user);
      
      message.success(t('auth.loginSuccess'));
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img
            src="/logo.svg"
            alt="NOVA ESTATE"
            className="logo-svg"
            style={{ height: 60, marginBottom: 10 }}
          />
          <h2 style={{ margin: 0 }}>{t('auth.login')}</h2>
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: t('validation.required') }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t('auth.username')}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t('validation.required') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.password')}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              {t('auth.login')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;