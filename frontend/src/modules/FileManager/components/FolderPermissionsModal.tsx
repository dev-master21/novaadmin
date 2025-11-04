// frontend/src/modules/FileManager/components/FolderPermissionsModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  message,
  Checkbox,
  Select,
  Popconfirm
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { fileManagerApi, FolderPermission } from '@/api/fileManager.api';
import { usersApi } from '@/api/users.api';
import type { TableColumnsType } from 'antd';

interface FolderPermissionsModalProps {
  visible: boolean;
  folderId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const FolderPermissionsModal = ({
  visible,
  folderId,
  onClose,
  onSuccess
}: FolderPermissionsModalProps) => {
  const [permissions, setPermissions] = useState<FolderPermission[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && folderId) {
      loadPermissions();
      loadUsers();
    }
  }, [visible, folderId]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const { data } = await fileManagerApi.getFolderPermissions(folderId);
      setPermissions(data.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки прав доступа');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await usersApi.getAll();
      setUsers(data.data);
    } catch (error: any) {
      message.error('Ошибка загрузки пользователей');
    }
  };

  const handleAddUser = () => {
    if (!selectedUserId) {
      message.warning('Выберите пользователя');
      return;
    }

    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;

    const alreadyExists = permissions.some(p => p.user_id === selectedUserId);
    if (alreadyExists) {
      message.warning('Пользователь уже добавлен');
      return;
    }

    setPermissions([
      ...permissions,
      {
        folder_id: folderId,
        user_id: user.id,
        username: user.username,
        full_name: user.full_name,
        can_view: true,
        can_upload: false,
        can_download: true,
        can_edit: false,
        can_delete: false
      }
    ]);

    setAddUserVisible(false);
    setSelectedUserId(null);
  };

  const handleRemoveUser = (userId: number) => {
    setPermissions(permissions.filter(p => p.user_id !== userId));
  };

  const handlePermissionChange = (userId: number, field: keyof FolderPermission, value: boolean) => {
    setPermissions(
      permissions.map(p =>
        p.user_id === userId ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fileManagerApi.setFolderPermissions(
        folderId,
        permissions.map(({ id, folder_id, username, full_name, ...rest }) => rest)
      );
      message.success('Права доступа обновлены');
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка сохранения прав доступа');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<FolderPermission> = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (_: any, record: FolderPermission) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.full_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.username}</div>
        </div>
      ),
    },
    {
      title: 'Просмотр',
      key: 'can_view',
      align: 'center',
      width: 100,
      render: (_: any, record: FolderPermission) => (
        <Checkbox
          checked={record.can_view}
          onChange={(e) => handlePermissionChange(record.user_id, 'can_view', e.target.checked)}
        />
      ),
    },
    {
      title: 'Загрузка',
      key: 'can_upload',
      align: 'center',
      width: 100,
      render: (_: any, record: FolderPermission) => (
        <Checkbox
          checked={record.can_upload}
          onChange={(e) => handlePermissionChange(record.user_id, 'can_upload', e.target.checked)}
        />
      ),
    },
    {
      title: 'Скачивание',
      key: 'can_download',
      align: 'center',
      width: 110,
      render: (_: any, record: FolderPermission) => (
        <Checkbox
          checked={record.can_download}
          onChange={(e) => handlePermissionChange(record.user_id, 'can_download', e.target.checked)}
        />
      ),
    },
    {
      title: 'Редактирование',
      key: 'can_edit',
      align: 'center',
      width: 130,
      render: (_: any, record: FolderPermission) => (
        <Checkbox
          checked={record.can_edit}
          onChange={(e) => handlePermissionChange(record.user_id, 'can_edit', e.target.checked)}
        />
      ),
    },
    {
      title: 'Удаление',
      key: 'can_delete',
      align: 'center',
      width: 100,
      render: (_: any, record: FolderPermission) => (
        <Checkbox
          checked={record.can_delete}
          onChange={(e) => handlePermissionChange(record.user_id, 'can_delete', e.target.checked)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: FolderPermission) => (
        <Popconfirm
          title="Удалить пользователя?"
          onConfirm={() => handleRemoveUser(record.user_id)}
          okText="Да"
          cancelText="Нет"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const availableUsers = users.filter(
    u => !permissions.some(p => p.user_id === u.id)
  );

  return (
    <Modal
      title="Управление правами доступа"
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      width={900}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          {!addUserVisible ? (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setAddUserVisible(true)}
              block
            >
              Добавить пользователя
            </Button>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                placeholder="Выберите пользователя"
                value={selectedUserId}
                onChange={setSelectedUserId}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={availableUsers.map(u => ({
                  value: u.id,
                  label: `${u.full_name} (${u.username})`
                }))}
              />
              <Button type="primary" onClick={handleAddUser}>
                Добавить
              </Button>
              <Button onClick={() => {
                setAddUserVisible(false);
                setSelectedUserId(null);
              }}>
                Отмена
              </Button>
            </Space.Compact>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="user_id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 800 }}
        />
      </Space>
    </Modal>
  );
};

export default FolderPermissionsModal;