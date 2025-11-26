import { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Select,
  message,
  Popconfirm,
  Tag,
  Space,
  Alert,
  Steps
} from 'antd';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiPhone,
  FiUsers,
  FiUser,
  FiMessageCircle
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { botSettingsApi, TelegramAccount, AgentGroup, BotUser, AdminChat } from '@/api/botSettings.api';
import dayjs from 'dayjs';
import './BotSettings.css';

const { TabPane } = Tabs;
const { Option } = Select;
const { Step } = Steps;

const BotSettings = () => {
  const { t } = useTranslation();
  
  // State для Telegram аккаунтов
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<TelegramAccount | null>(null);
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [authStep, setAuthStep] = useState(0);
  const [needPassword, setNeedPassword] = useState(false);

  // State для групп агентов
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AgentGroup | null>(null);

  // State для пользователей бота
  const [botUsers, setBotUsers] = useState<BotUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<BotUser | null>(null);

  // State для админ чата
  const [adminChat, setAdminChat] = useState<AdminChat | null>(null);
  const [_loadingAdminChat, setLoadingAdminChat] = useState(false);
  const [adminChatModalVisible, setAdminChatModalVisible] = useState(false);

  // Forms
  const [accountForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const [adminChatForm] = Form.useForm();

  useEffect(() => {
    fetchAccounts();
    fetchGroups();
    fetchBotUsers();
    fetchAdminChat();
  }, []);

  // ========== Telegram Accounts ==========
  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await botSettingsApi.getTelegramAccounts();
      setAccounts(response.data.data);
    } catch (error) {
      message.error(t('botSettings.messages.accountsLoadError'));
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleCreateAccount = async (values: any) => {
    try {
      const response = await botSettingsApi.createTelegramAccount({
        account_name: values.account_name,
        phone_number: values.phone_number,
        api_id: parseInt(values.api_id),
        api_hash: values.api_hash
      });
      
      message.success(response.data.message);
      setAccountModalVisible(false);
      accountForm.resetFields();
      fetchAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.accountCreateError'));
    }
  };

  const handleStartAuth = async (account: TelegramAccount) => {
    setCurrentAccount(account);
    setAuthStep(0);
    setNeedPassword(false);
    authForm.resetFields();
    
    try {
      const response = await botSettingsApi.startAccountAuth(account.id);
      setPhoneCodeHash(response.data.data.phone_code_hash);
      setAuthModalVisible(true);
      setAuthStep(1);
      message.success(t('botSettings.messages.codeSent'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.authStartError'));
    }
  };

  const handleCompleteAuth = async (values: any) => {
    if (!currentAccount) return;

    try {
      const response = await botSettingsApi.completeAccountAuth(currentAccount.id, {
        code: values.code,
        phone_code_hash: phoneCodeHash,
        password: values.password
      });

      if (response.data.needPassword) {
        setNeedPassword(true);
        setAuthStep(2);
        message.warning(t('botSettings.messages.passwordRequired'));
        return;
      }

      message.success(t('botSettings.messages.accountAuthorized'));
      setAuthModalVisible(false);
      authForm.resetFields();
      setCurrentAccount(null);
      fetchAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.authError'));
    }
  };

  const handleDeleteAccount = async (id: number) => {
    try {
      await botSettingsApi.deleteTelegramAccount(id);
      message.success(t('botSettings.messages.accountDeleted'));
      fetchAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.deleteError'));
    }
  };

  // ========== Agent Groups ==========
  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await botSettingsApi.getAgentGroups();
      setGroups(response.data.data);
    } catch (error) {
      message.error(t('botSettings.messages.groupsLoadError'));
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSaveGroup = async (values: any) => {
    try {
      if (editingGroup) {
        await botSettingsApi.updateAgentGroup(editingGroup.id, values);
        message.success(t('botSettings.messages.groupUpdated'));
      } else {
        await botSettingsApi.createAgentGroup(values);
        message.success(t('botSettings.messages.groupCreated'));
      }
      
      setGroupModalVisible(false);
      groupForm.resetFields();
      setEditingGroup(null);
      fetchGroups();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.groupSaveError'));
    }
  };

  const handleDeleteGroup = async (id: number) => {
    try {
      await botSettingsApi.deleteAgentGroup(id);
      message.success(t('botSettings.messages.groupDeleted'));
      fetchGroups();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.deleteError'));
    }
  };

  // ========== Bot Users ==========
  const fetchBotUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await botSettingsApi.getBotUsers();
      setBotUsers(response.data.data);
    } catch (error) {
      message.error(t('botSettings.messages.usersLoadError'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSaveUser = async (values: any) => {
    try {
      if (editingUser) {
        await botSettingsApi.updateBotUser(editingUser.id, values);
        message.success(t('botSettings.messages.userUpdated'));
      } else {
        await botSettingsApi.createBotUser(values);
        message.success(t('botSettings.messages.userCreated'));
      }
      
      setUserModalVisible(false);
      userForm.resetFields();
      setEditingUser(null);
      fetchBotUsers();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.userSaveError'));
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await botSettingsApi.deleteBotUser(id);
      message.success(t('botSettings.messages.userDeleted'));
      fetchBotUsers();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.deleteError'));
    }
  };

  // ========== Admin Chat ==========
  const fetchAdminChat = async () => {
    setLoadingAdminChat(true);
    try {
      const response = await botSettingsApi.getAdminChat();
      setAdminChat(response.data.data);
    } catch (error) {
      message.error(t('botSettings.messages.adminChatLoadError'));
    } finally {
      setLoadingAdminChat(false);
    }
  };

  const handleSaveAdminChat = async (values: any) => {
    try {
      await botSettingsApi.setAdminChat(values);
      message.success(t('botSettings.messages.adminChatSet'));
      setAdminChatModalVisible(false);
      adminChatForm.resetFields();
      fetchAdminChat();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('botSettings.messages.adminChatSetError'));
    }
  };

  // ========== Columns ==========
  const accountsColumns = [
    {
      title: t('botSettings.tables.accounts.name'),
      dataIndex: 'account_name',
      key: 'account_name',
    },
    {
      title: t('botSettings.tables.accounts.phone'),
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: t('botSettings.tables.accounts.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'} icon={isActive ? <FiCheck /> : <FiX />}>
          {isActive ? t('botSettings.status.active') : t('botSettings.status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('botSettings.tables.accounts.lastSync'),
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      render: (date: string) => date ? dayjs(date).format('DD.MM.YYYY HH:mm') : '-',
    },
    {
      title: t('botSettings.tables.actions'),
      key: 'actions',
      render: (_: any, record: TelegramAccount) => (
        <Space>
          {!record.is_active && (
            <Button
              type="primary"
              size="small"
              icon={<FiRefreshCw />}
              onClick={() => handleStartAuth(record)}
            >
              {t('botSettings.actions.sync')}
            </Button>
          )}
          
          <Popconfirm
            title={t('botSettings.confirm.deleteAccount')}
            description={t('botSettings.confirm.cannotUndo')}
            onConfirm={() => handleDeleteAccount(record.id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button danger size="small" icon={<FiTrash2 />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const groupsColumns = [
    {
      title: t('botSettings.tables.groups.name'),
      dataIndex: 'group_name',
      key: 'group_name',
    },
    {
      title: t('botSettings.tables.groups.chatId'),
      dataIndex: 'chat_id',
      key: 'chat_id',
    },
    {
      title: t('botSettings.tables.groups.description'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('botSettings.tables.groups.members'),
      dataIndex: 'members_count',
      key: 'members_count',
    },
    {
      title: t('botSettings.tables.groups.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? t('botSettings.status.activeGroup') : t('botSettings.status.inactiveGroup')}
        </Tag>
      ),
    },
    {
      title: t('botSettings.tables.actions'),
      key: 'actions',
      render: (_: any, record: AgentGroup) => (
        <Space>
          <Button
            size="small"
            icon={<FiEdit />}
            onClick={() => {
              setEditingGroup(record);
              groupForm.setFieldsValue(record);
              setGroupModalVisible(true);
            }}
          >
            {t('botSettings.actions.edit')}
          </Button>
          
          <Popconfirm
            title={t('botSettings.confirm.deleteGroup')}
            onConfirm={() => handleDeleteGroup(record.id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button danger size="small" icon={<FiTrash2 />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const usersColumns = [
    {
      title: t('botSettings.tables.users.telegramId'),
      dataIndex: 'telegram_id',
      key: 'telegram_id',
    },
    {
      title: t('botSettings.tables.users.username'),
      dataIndex: 'telegram_username',
      key: 'telegram_username',
      render: (username: string) => username ? `@${username}` : '-',
    },
    {
      title: t('botSettings.tables.users.name'),
      key: 'name',
      render: (_: any, record: BotUser) => {
        const name = [record.first_name, record.last_name].filter(Boolean).join(' ');
        return name || '-';
      },
    },
    {
      title: t('botSettings.tables.users.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'manager' ? 'blue' : 'green'}>
          {role === 'manager' ? t('botSettings.roles.manager') : t('botSettings.roles.agent')}
        </Tag>
      ),
    },
    {
      title: t('botSettings.tables.users.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? t('botSettings.status.active') : t('botSettings.status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('botSettings.tables.actions'),
      key: 'actions',
      render: (_: any, record: BotUser) => (
        <Space>
          <Button
            size="small"
            icon={<FiEdit />}
            onClick={() => {
              setEditingUser(record);
              userForm.setFieldsValue(record);
              setUserModalVisible(true);
            }}
          >
            {t('botSettings.actions.edit')}
          </Button>
          
          <Popconfirm
            title={t('botSettings.confirm.deleteUser')}
            onConfirm={() => handleDeleteUser(record.id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button danger size="small" icon={<FiTrash2 />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="bot-settings-container">
      <div className="bot-settings-header">
        <h1>{t('botSettings.title')}</h1>
      </div>

      <Tabs defaultActiveKey="accounts">
        {/* Telegram Аккаунты */}
        <TabPane
          tab={
            <span>
              <FiPhone style={{ marginRight: 8 }} />
              {t('botSettings.tabs.accounts')}
            </span>
          }
          key="accounts"
        >
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<FiPlus />}
                onClick={() => {
                  accountForm.resetFields();
                  setAccountModalVisible(true);
                }}
              >
                {t('botSettings.actions.addAccount')}
              </Button>
            </div>

            <Alert
              message={t('botSettings.alerts.accounts.title')}
              description={t('botSettings.alerts.accounts.description')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              columns={accountsColumns}
              dataSource={accounts}
              loading={loadingAccounts}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        {/* Группы Агентов */}
        <TabPane
          tab={
            <span>
              <FiUsers style={{ marginRight: 8 }} />
              {t('botSettings.tabs.groups')}
            </span>
          }
          key="groups"
        >
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<FiPlus />}
                onClick={() => {
                  setEditingGroup(null);
                  groupForm.resetFields();
                  groupForm.setFieldsValue({ is_active: true });
                  setGroupModalVisible(true);
                }}
              >
                {t('botSettings.actions.createGroup')}
              </Button>
            </div>

            <Alert
              message={t('botSettings.alerts.groups.title')}
              description={
                <div dangerouslySetInnerHTML={{ __html: t('botSettings.alerts.groups.description') }} />
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              columns={groupsColumns}
              dataSource={groups}
              loading={loadingGroups}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        {/* Пользователи Бота */}
        <TabPane
          tab={
            <span>
              <FiUser style={{ marginRight: 8 }} />
              {t('botSettings.tabs.users')}
            </span>
          }
          key="users"
        >
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<FiPlus />}
                onClick={() => {
                  setEditingUser(null);
                  userForm.resetFields();
                  userForm.setFieldsValue({ role: 'agent', is_active: true });
                  setUserModalVisible(true);
                }}
              >
                {t('botSettings.actions.addUser')}
              </Button>
            </div>

            <Alert
              message={t('botSettings.alerts.users.title')}
              description={t('botSettings.alerts.users.description')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              columns={usersColumns}
              dataSource={botUsers}
              loading={loadingUsers}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
        
        {/* Админ Чат */}
        <TabPane
          tab={
            <span>
              <FiMessageCircle style={{ marginRight: 8 }} />
              {t('botSettings.tabs.adminChat')}
            </span>
          }
          key="admin"
        >
          <Card>
            {adminChat ? (
              <div>
                <Alert
                  message={t('botSettings.alerts.adminChat.configured')}
                  description={
                    <div>
                      <strong>{t('botSettings.fields.chatId')}:</strong> {adminChat.chat_id}<br />
                      {adminChat.chat_name && (
                        <>
                          <strong>{t('botSettings.fields.name')}:</strong> {adminChat.chat_name}
                        </>
                      )}
                    </div>
                  }
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Button
                  onClick={() => {
                    adminChatForm.setFieldsValue({
                      chat_id: adminChat.chat_id,
                      chat_name: adminChat.chat_name
                    });
                    setAdminChatModalVisible(true);
                  }}
                >
                  {t('botSettings.actions.edit')}
                </Button>
              </div>
            ) : (
              <div>
                <Alert
                  message={t('botSettings.alerts.adminChat.notConfigured')}
                  description={t('botSettings.alerts.adminChat.notConfiguredDescription')}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Button
                  type="primary"
                  onClick={() => {
                    adminChatForm.resetFields();
                    setAdminChatModalVisible(true);
                  }}
                >
                  {t('botSettings.actions.configure')}
                </Button>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Модальное окно добавления аккаунта */}
      <Modal
        title={t('botSettings.modals.addAccount.title')}
        open={accountModalVisible}
        onCancel={() => {
          setAccountModalVisible(false);
          accountForm.resetFields();
        }}
        onOk={() => accountForm.submit()}
        okText={t('botSettings.actions.create')}
        cancelText={t('common.cancel')}
      >
        <Form
          form={accountForm}
          layout="vertical"
          onFinish={handleCreateAccount}
        >
          <Form.Item
            name="account_name"
            label={t('botSettings.fields.accountName')}
            rules={[{ required: true, message: t('botSettings.validation.enterName') }]}
          >
            <Input placeholder={t('botSettings.placeholders.accountName')} />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label={t('botSettings.fields.phoneNumber')}
            rules={[{ required: true, message: t('botSettings.validation.enterPhone') }]}
          >
            <Input placeholder="+66123456789" />
          </Form.Item>

          <Form.Item
            name="api_id"
            label={t('botSettings.fields.apiId')}
            rules={[{ required: true, message: t('botSettings.validation.enterApiId') }]}
            extra={t('botSettings.hints.getApiCredentials')}
          >
            <Input placeholder="12345678" type="number" />
          </Form.Item>

          <Form.Item
            name="api_hash"
            label={t('botSettings.fields.apiHash')}
            rules={[{ required: true, message: t('botSettings.validation.enterApiHash') }]}
            extra={t('botSettings.hints.getApiCredentials')}
          >
            <Input placeholder="abcdef1234567890abcdef1234567890" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно авторизации */}
      <Modal
        title={t('botSettings.modals.auth.title')}
        open={authModalVisible}
        onCancel={() => {
          setAuthModalVisible(false);
          authForm.resetFields();
          setCurrentAccount(null);
        }}
        footer={null}
        width={600}
      >
        <Steps current={authStep} style={{ marginBottom: 24 }}>
          <Step title={t('botSettings.modals.auth.steps.sendCode')} />
          <Step title={t('botSettings.modals.auth.steps.enterCode')} />
          {needPassword && <Step title={t('botSettings.modals.auth.steps.password2FA')} />}
        </Steps>

        <Form
          form={authForm}
          layout="vertical"
          onFinish={handleCompleteAuth}
        >
          {authStep === 1 && (
            <>
              <Alert
                message={t('botSettings.modals.auth.codeSentTitle')}
                description={t('botSettings.modals.auth.codeSentDescription', { 
                  phone: currentAccount?.phone_number 
                })}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="code"
                label={t('botSettings.fields.telegramCode')}
                rules={[{ required: true, message: t('botSettings.validation.enterCode') }]}
              >
                <Input placeholder="12345" maxLength={5} />
              </Form.Item>

              {needPassword && (
                <Form.Item
                  name="password"
                  label={t('botSettings.fields.password2FA')}
                  rules={[{ required: true, message: t('botSettings.validation.enterPassword') }]}
                >
                  <Input.Password placeholder={t('botSettings.placeholders.password2FA')} />
                </Form.Item>
              )}

              <Button type="primary" htmlType="submit" block>
                {t('botSettings.actions.confirm')}
              </Button>
            </>
          )}
        </Form>
      </Modal>

      {/* Модальное окно группы */}
      <Modal
        title={editingGroup ? t('botSettings.modals.group.editTitle') : t('botSettings.modals.group.createTitle')}
        open={groupModalVisible}
        onCancel={() => {
          setGroupModalVisible(false);
          groupForm.resetFields();
          setEditingGroup(null);
        }}
        onOk={() => groupForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={handleSaveGroup}
        >
          <Form.Item
            name="group_name"
            label={t('botSettings.fields.groupName')}
            rules={[{ required: true, message: t('botSettings.validation.enterName') }]}
          >
            <Input placeholder={t('botSettings.placeholders.groupName')} />
          </Form.Item>

          <Form.Item
            name="chat_id"
            label={t('botSettings.fields.chatId')}
            rules={[{ required: true, message: t('botSettings.validation.enterChatId') }]}
          >
            <Input placeholder="-1001234567890" />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('botSettings.fields.description')}
          >
            <Input.TextArea rows={3} placeholder={t('botSettings.placeholders.groupDescription')} />
          </Form.Item>

          {editingGroup && (
            <Form.Item
              name="is_active"
              label={t('botSettings.fields.active')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Модальное окно пользователя */}
      <Modal
        title={editingUser ? t('botSettings.modals.user.editTitle') : t('botSettings.modals.user.addTitle')}
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false);
          userForm.resetFields();
          setEditingUser(null);
        }}
        onOk={() => userForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={handleSaveUser}
        >
          <Form.Item
            name="telegram_id"
            label={t('botSettings.fields.telegramId')}
            rules={[{ required: true, message: t('botSettings.validation.enterTelegramId') }]}
          >
            <Input placeholder="123456789" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="telegram_username"
            label={t('botSettings.fields.username')}
          >
            <Input placeholder="username" />
          </Form.Item>

          <Form.Item
            name="first_name"
            label={t('botSettings.fields.firstName')}
          >
            <Input placeholder={t('botSettings.placeholders.firstName')} />
          </Form.Item>

          <Form.Item
            name="last_name"
            label={t('botSettings.fields.lastName')}
          >
            <Input placeholder={t('botSettings.placeholders.lastName')} />
          </Form.Item>

          <Form.Item
            name="role"
            label={t('botSettings.fields.role')}
            rules={[{ required: true, message: t('botSettings.validation.selectRole') }]}
          >
            <Select>
              <Option value="manager">{t('botSettings.roles.manager')}</Option>
              <Option value="agent">{t('botSettings.roles.agent')}</Option>
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item
              name="is_active"
              label={t('botSettings.fields.active')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Модальное окно админ чата */}
      <Modal
        title={t('botSettings.modals.adminChat.title')}
        open={adminChatModalVisible}
        onCancel={() => {
          setAdminChatModalVisible(false);
          adminChatForm.resetFields();
        }}
        onOk={() => adminChatForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form
          form={adminChatForm}
          layout="vertical"
          onFinish={handleSaveAdminChat}
        >
          <Form.Item
            name="chat_id"
            label={t('botSettings.fields.chatId')}
            rules={[{ required: true, message: t('botSettings.validation.enterChatId') }]}
          >
            <Input placeholder="-1001234567890" />
          </Form.Item>

          <Form.Item
            name="chat_name"
            label={t('botSettings.fields.nameOptional')}
          >
            <Input placeholder={t('botSettings.placeholders.adminChatName')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BotSettings;