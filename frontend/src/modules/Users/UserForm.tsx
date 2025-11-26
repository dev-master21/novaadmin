// frontend/src/modules/Users/UserForm.tsx
import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Spin,
  Switch,
  Select,
  Row,
  Col,
  Divider
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  LockOutlined,
  MailOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users.api';
import { rolesApi } from '@/api/roles.api';
import { useAuthStore } from '@/store/authStore';
import type { UserFormData } from './types';

const UserForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { isSuperAdmin } = useAuthStore();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);

  const isEditMode = !!id;

  useEffect(() => {
    loadRoles();
    if (isEditMode) {
      loadUser();
    }
  }, [id]);

  const loadRoles = async () => {
    try {
      const { data } = await rolesApi.getAll();
      setRoles(data.data);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.getById(Number(id));
      const userData = data.data;

      form.setFieldsValue({
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email,
        is_active: userData.is_active,
        role_ids: userData.roles?.map((r: any) => r.id)
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: UserFormData) => {
    if (!isSuperAdmin() && !isEditMode) {
      message.error(t('users.onlyAdminCanCreate'));
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        await usersApi.update(Number(id), values);
        message.success(t('users.updateSuccess'));
      } else {
        // Для создания нового пользователя пароль обязателен
        if (!values.password) {
          message.error(t('validation.required'));
          setSubmitting(false);
          return;
        }
        await usersApi.create({
          ...values,
          password: values.password as string
        });
        message.success(t('users.createSuccess'));
      }
      navigate('/users');
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <UserOutlined />
            {isEditMode ? t('users.edit') : t('users.add')}
          </Space>
        }
        extra={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/users')}
          >
            {t('common.back')}
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          initialValues={{ is_active: true }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('users.username')}
                name="username"
                rules={[
                  { required: true, message: t('validation.required') },
                  { min: 3, message: t('validation.minLength', { min: 3 }) }
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  disabled={isEditMode}
                  placeholder={t('users.username')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={t('users.fullName')}
                name="full_name"
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <Input placeholder={t('users.fullName')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('users.email')}
                name="email"
                rules={[
                  {
                    type: 'email',
                    message: t('validation.email')
                  }
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder={t('users.email')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={isEditMode ? t('users.newPassword') : t('users.password')}
                name="password"
                rules={
                  !isEditMode
                    ? [
                        { required: true, message: t('validation.required') },
                        { min: 6, message: t('validation.minLength', { min: 6 }) }
                      ]
                    : [{ min: 6, message: t('validation.minLength', { min: 6 }) }]
                }
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={
                    isEditMode ? t('users.newPassword') : t('users.password')
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('users.roles')}
                name="role_ids"
                tooltip={t('users.selectRoles')}
              >
                <Select
                  mode="multiple"
                  placeholder={t('users.selectRoles')}
                  disabled={!isSuperAdmin()}
                  options={roles.map((role) => ({
                    label: role.role_name,
                    value: role.id
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={t('users.isActive')}
                name="is_active"
                valuePropName="checked"
              >
                <Switch
                  disabled={!isSuperAdmin()}
                  checkedChildren={t('users.active')}
                  unCheckedChildren={t('users.inactive')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting}
              >
                {t('common.save')}
              </Button>
              <Button onClick={() => navigate('/users')}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UserForm;