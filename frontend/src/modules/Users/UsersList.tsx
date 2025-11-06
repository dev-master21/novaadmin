// frontend/src/modules/Users/UsersList.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Input,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/authStore';
import type { User } from './types';
import type { ColumnsType } from 'antd/es/table';

const UsersList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.getAll();
      setUsers(data.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await usersApi.delete(id);
      message.success(t('users.deleteSuccess'));
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchText.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<User> = [
    {
      title: t('users.username'),
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <strong>{text}</strong>
        </Space>
      )
    },
    {
      title: t('users.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200
    },
    {
      title: t('users.email'),
      dataIndex: 'email',
      key: 'email',
      width: 200,
      responsive: ['md']
    },
    {
      title: t('users.roles'),
      dataIndex: 'roles',
      key: 'roles',
      width: 250,
      responsive: ['lg'],
      render: (roles: any[]) => (
        <Space wrap>
          {roles && roles.length > 0 ? (
            roles.map((role) => (
              <Tag key={role.id} color="blue">
                {role.role_name}
              </Tag>
            ))
          ) : (
            <Tag color="default">{t('users.noRoles')}</Tag>
          )}
        </Space>
      )
    },
    {
      title: t('users.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? t('users.active') : t('users.inactive')}
        </Tag>
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: any, record: User) => (
        <Space size="small">
          <Tooltip title={t('common.edit')}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/users/edit/${record.id}`)}
            />
          </Tooltip>
          {isSuperAdmin() && (
            <Popconfirm
              title={t('users.confirmDelete')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card
      title={
        <Space>
          <UserOutlined />
          {t('users.title')}
        </Space>
      }
      extra={
        isSuperAdmin() && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/users/create')}
          >
            {t('users.add')}
          </Button>
        )
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Input
          placeholder={t('users.search')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => t('common.total', { total })
          }}
          scroll={{ x: 800 }}
        />
      </Space>
    </Card>
  );
};

export default UsersList;