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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      message.error(error.response?.data?.message || t('folderPermissionsModal.errors.loadPermissions'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await usersApi.getAll();
      setUsers(data.data);
    } catch (error: any) {
      message.error(t('folderPermissionsModal.errors.loadUsers'));
    }
  };

  const handleAddUser = () => {
    if (!selectedUserId) {
      message.warning(t('folderPermissionsModal.warnings.selectUser'));
      return;
    }

    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;

    const alreadyExists = permissions.some(p => p.user_id === selectedUserId);
    if (alreadyExists) {
      message.warning(t('folderPermissionsModal.warnings.userAlreadyAdded'));
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
      message.success(t('folderPermissionsModal.messages.saved'));
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('folderPermissionsModal.errors.savePermissions'));
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<FolderPermission> = [
    {
      title: t('folderPermissionsModal.table.user'),
      key: 'user',
      render: (_: any, record: FolderPermission) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.full_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.username}</div>
        </div>
      ),
    },
    {
      title: t('folderPermissionsModal.table.view'),
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
      title: t('folderPermissionsModal.table.upload'),
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
      title: t('folderPermissionsModal.table.download'),
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
      title: t('folderPermissionsModal.table.edit'),
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
      title: t('folderPermissionsModal.table.delete'),
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
          title={t('folderPermissionsModal.confirm.removeUser')}
          onConfirm={() => handleRemoveUser(record.user_id)}
          okText={t('common.yes')}
          cancelText={t('common.no')}
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
      title={t('folderPermissionsModal.title')}
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      width={900}
      confirmLoading={saving}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
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
              {t('folderPermissionsModal.buttons.addUser')}
            </Button>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                placeholder={t('folderPermissionsModal.placeholders.selectUser')}
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
                {t('folderPermissionsModal.buttons.add')}
              </Button>
              <Button onClick={() => {
                setAddUserVisible(false);
                setSelectedUserId(null);
              }}>
                {t('common.cancel')}
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