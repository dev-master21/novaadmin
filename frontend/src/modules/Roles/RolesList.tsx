// frontend/src/modules/Roles/RolesList.tsx
import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import { useAuthStore } from '@/store/authStore';
import type { Role } from './types';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const RolesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const { data } = await rolesApi.getAll();
      setRoles(data.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await rolesApi.delete(id);
      message.success(t('roles.deleteSuccess'));
      loadRoles();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    }
  };

  const columns: TableProps<Role>['columns'] = [
    {
      title: t('roles.roleName'),
      dataIndex: 'role_name',
      key: 'role_name',
      width: 250,
      render: (text) => (
        <Space>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: t('roles.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => desc || <span style={{ color: '#ccc' }}>—</span>
    },
    {
      title: t('roles.permissions'),
      dataIndex: 'permissions',
      key: 'permissions',
      width: 400,
      render: (permissions: any[]) => (
        <Space size={[0, 4]} wrap>
          {permissions && permissions.length > 0 ? (
            <>
              {permissions.slice(0, 3).map((perm) => (
                <Tag key={perm.id} color="blue">
                  {t(`roles.permissionsList.${perm.permission_name}`)}
                </Tag>
              ))}
              {permissions.length > 3 && (
                <Tag>+{permissions.length - 3}</Tag>
              )}
            </>
          ) : (
            <span style={{ color: '#ccc' }}>—</span>
          )}
        </Space>
      )
    },
    {
      title: t('roles.usersCount'),
      dataIndex: 'users_count',
      key: 'users_count',
      width: 120,
      align: 'center',
      render: (count) => (
        <Space>
          <TeamOutlined />
          <span>{count}</span>
        </Space>
      )
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => dayjs(date).format('DD.MM.YYYY')
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {hasPermission('roles.update') && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/roles/edit/${record.id}`)}
              />
            </Tooltip>
          )}

          {hasPermission('roles.delete') && (
            <Popconfirm
              title={t('roles.confirmDelete')}
              description={
                record.users_count > 0
                  ? t('roles.cannotDeleteWithUsers')
                  : undefined
              }
              disabled={record.users_count > 0}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip
                title={
                  record.users_count > 0
                    ? t('roles.cannotDeleteWithUsers')
                    : t('common.delete')
                }
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={record.users_count > 0}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            {t('roles.list')}
          </Space>
        }
        extra={
          hasPermission('roles.create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/roles/create')}
            >
              {t('roles.add')}
            </Button>
          )
        }
      >
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `${t('common.total')}: ${total}`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default RolesList;