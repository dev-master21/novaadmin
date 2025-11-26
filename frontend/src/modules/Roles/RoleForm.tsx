// frontend/src/modules/Roles/RoleForm.tsx
import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Spin,
  Checkbox,
  Typography,
  Divider,
  Row,
  Col
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import type { RoleFormData, Permission } from './types';

const { TextArea } = Input;
const { Title } = Typography;

const RoleForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});

  const isEditMode = !!id;

  useEffect(() => {
    loadPermissions();
    if (isEditMode) {
      loadRole();
    }
  }, [id]);

  const loadPermissions = async () => {
    try {
      const { data } = await rolesApi.getAllPermissions();
      setPermissions(data.data);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const loadRole = async () => {
    setLoading(true);
    try {
      const { data } = await rolesApi.getById(Number(id));
      const roleData = data.data;

      form.setFieldsValue({
        role_name: roleData.role_name,
        description: roleData.description,
        permission_ids: roleData.permissions?.map((p: Permission) => p.id) || []
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
      navigate('/roles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: RoleFormData) => {
    setSubmitting(true);
    try {
      if (isEditMode) {
        await rolesApi.update(Number(id), values);
        message.success(t('roles.updateSuccess'));
      } else {
        await rolesApi.create(values);
        message.success(t('roles.createSuccess'));
      }
      navigate('/roles');
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAllModule = (modulePermissions: Permission[], checked: boolean) => {
    const currentPermissions = form.getFieldValue('permission_ids') || [];
    const modulePermissionIds = modulePermissions.map((p) => p.id);

    if (checked) {
      // Добавляем все права модуля
      const newPermissions = [
        ...new Set([...currentPermissions, ...modulePermissionIds])
      ];
      form.setFieldsValue({ permission_ids: newPermissions });
    } else {
      // Убираем все права модуля
      const newPermissions = currentPermissions.filter(
        (id: number) => !modulePermissionIds.includes(id)
      );
      form.setFieldsValue({ permission_ids: newPermissions });
    }
  };

  const isModuleFullySelected = (modulePermissions: Permission[]) => {
    const selectedPermissions = form.getFieldValue('permission_ids') || [];
    return modulePermissions.every((p) => selectedPermissions.includes(p.id));
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
            <SafetyOutlined />
            {isEditMode ? t('roles.edit') : t('roles.add')}
          </Space>
        }
        extra={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/roles')}
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
          initialValues={{ permission_ids: [] }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('roles.roleName')}
                name="role_name"
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <Input placeholder={t('roles.roleName')} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={t('roles.description')}
                name="description"
              >
                <TextArea
                  rows={1}
                  placeholder={t('roles.description')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">{t('roles.permissions')}</Divider>

          <Form.Item
            name="permission_ids"
            rules={[
              {
                required: true,
                message: t('validation.required'),
                type: 'array',
                min: 1
              }
            ]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                {Object.entries(permissions).map(([module, modulePermissions]) => (
                  <Col xs={24} key={module}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <Checkbox
                            checked={isModuleFullySelected(modulePermissions)}
                            onChange={(e) =>
                              handleSelectAllModule(modulePermissions, e.target.checked)
                            }
                          >
                            <Title level={5} style={{ margin: 0 }}>
                              {t(`roles.modules.${module}`)}
                            </Title>
                          </Checkbox>
                        </Space>
                      }
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {modulePermissions.map((permission) => (
                          <Checkbox key={permission.id} value={permission.id}>
                            <Space direction="vertical" size={0}>
                              <span>
                                {t(`roles.permissionsList.${permission.permission_name}`)}
                              </span>
                              {permission.description && (
                                <span style={{ fontSize: 12, color: '#999' }}>
                                  {permission.description}
                                </span>
                              )}
                            </Space>
                          </Checkbox>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

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
              <Button onClick={() => navigate('/roles')}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RoleForm;