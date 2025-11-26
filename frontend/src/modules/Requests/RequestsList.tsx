import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, 
  Tag, 
  Input, 
  Select, 
  Button, 
  Space, 
  message,
  Tooltip,
  Popconfirm,
  Modal,
  Upload,
  Form
} from 'antd';
import { 
  FiSearch,
  FiMessageCircle, 
  FiTrash2,
  FiExternalLink,
  FiUser,
  FiSettings,
  FiFileText,
  FiPlus,
  FiUpload
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { requestsApi, Request, AgentGroup } from '@/api/requests.api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/ru';
import './RequestsList.css';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ru');

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const RequestsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    search: undefined as string | undefined
  });

  // WhatsApp modal states
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [whatsappForm] = Form.useForm();
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<string[]>([]);
  const [_uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    // Загружаем группы агентов при монтировании
    fetchAgentGroups();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await requestsApi.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        search: filters.search
      });
      
      setRequests(response.data.data);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }));
      }
    } catch (error: any) {
      message.error(t('requestsList.messages.loadError'));
      console.error('Fetch requests error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentGroups = async () => {
    try {
      const response = await requestsApi.getAgentGroups();
      setAgentGroups(response.data.data);
    } catch (error) {
      console.error('Fetch agent groups error:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await requestsApi.delete(id);
      message.success(t('requestsList.messages.deleted'));
      fetchRequests();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('requestsList.messages.deleteError'));
    }
  };

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value || undefined }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStatusFilter = (value: string) => {
    setFilters(prev => ({ ...prev, status: value || undefined }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleBotSettings = () => {
    navigate('/requests/bot-settings');
  };

  const handleCreateAgreement = (uuid: string) => {
    navigate(`/agreements?request_uuid=${uuid}`);
  };

  const handleCreateRequest = () => {
    setSourceModalVisible(true);
  };

  const handleSourceSelect = (source: 'telegram' | 'whatsapp') => {
    setSourceModalVisible(false);
    
    if (source === 'telegram') {
      message.info(t('requestsList.messages.telegramInfo'));
    } else {
      setWhatsappModalVisible(true);
    }
  };

  const handleUploadScreenshot = async (file: File) => {
    setUploadingScreenshot(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const response = await requestsApi.uploadWhatsAppScreenshot(formData);
      
      setUploadedScreenshots(prev => [...prev, response.data.data.screenshot_path]);
      message.success(t('requestsList.messages.screenshotUploaded'));
      
      return false;
    } catch (error: any) {
      message.error(error.response?.data?.message || t('requestsList.messages.screenshotUploadError'));
      return false;
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleRemoveScreenshot = (path: string) => {
    setUploadedScreenshots(prev => prev.filter(p => p !== path));
  };

  const handleCreateWhatsAppRequest = async () => {
    try {
      const values = await whatsappForm.validateFields();

      if (uploadedScreenshots.length === 0) {
        message.warning(t('requestsList.messages.uploadAtLeastOneScreenshot'));
        return;
      }

      setCreatingRequest(true);

      const response = await requestsApi.createWhatsAppRequest({
        client_name: values.client_name,
        whatsapp_phone: values.whatsapp_phone,
        initial_note: values.initial_note,
        agent_group_id: values.agent_group_id,
        screenshots: uploadedScreenshots
      });

      message.success(t('requestsList.messages.whatsappRequestCreated'));
      
      setWhatsappModalVisible(false);
      whatsappForm.resetFields();
      setUploadedScreenshots([]);

      fetchRequests();

      Modal.success({
        title: t('requestsList.successModal.title'),
        content: (
          <div>
            <p><strong>{t('requestsList.successModal.requestNumber')}:</strong> {response.data.data.request_number}</p>
            <p>
              <a href={response.data.data.chat_url} target="_blank" rel="noopener noreferrer">
                {t('requestsList.successModal.viewScreenshots')}
              </a>
            </p>
            <p>
              <a href={response.data.data.request_url} target="_blank" rel="noopener noreferrer">
                {t('requestsList.successModal.manageRequest')}
              </a>
            </p>
          </div>
        )
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || t('requestsList.messages.createError'));
    } finally {
      setCreatingRequest(false);
    }
  };

  const formatDateTime = (date: string): string => {
    return dayjs(date).tz('Asia/Bangkok').format('DD.MM.YYYY HH:mm');
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      new: { color: 'blue', text: t('requestsList.statuses.new') },
      in_progress: { color: 'orange', text: t('requestsList.statuses.inProgress') },
      rejected: { color: 'red', text: t('requestsList.statuses.rejected') },
      completed: { color: 'green', text: t('requestsList.statuses.completed') },
      deal_created: { color: 'success', text: t('requestsList.statuses.dealCreated') }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const openChatHistory = (chatUuid: string) => {
    window.open(`/request/chat/${chatUuid}`, '_blank');
  };

  const openRequestManagement = (uuid: string) => {
    window.open(`/request/client/${uuid}`, '_blank');
  };

  const columns = [
    {
      title: t('requestsList.table.requestNumber'),
      dataIndex: 'request_number',
      key: 'request_number',
      width: 150,
      fixed: 'left' as const,
      render: (text: string, record: Request) => (
        <div>
          <strong>{text}</strong>
          {record.request_source === 'whatsapp' && (
            <div style={{ fontSize: 11, color: '#52c41a', marginTop: 2 }}>
              📱 WhatsApp
            </div>
          )}
        </div>
      )
    },
    {
      title: t('requestsList.table.client'),
      key: 'client',
      width: 200,
      render: (_: any, record: Request) => {
        const name = record.request_source === 'whatsapp'
          ? record.client_first_name || t('requestsList.client')
          : [record.client_first_name, record.client_last_name]
              .filter(Boolean)
              .join(' ') || record.client_username || t('requestsList.client');
        
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            {record.request_source === 'telegram' && record.client_username && (
              <div style={{ fontSize: 12, color: '#999' }}>@{record.client_username}</div>
            )}
            {record.request_source === 'telegram' && record.client_phone && (
              <div style={{ fontSize: 12, color: '#999' }}>{record.client_phone}</div>
            )}
            {record.request_source === 'whatsapp' && record.whatsapp_phone && (
              <div style={{ fontSize: 12, color: '#52c41a' }}>📱 {record.whatsapp_phone}</div>
            )}
          </div>
        );
      }
    },
    {
      title: t('requestsList.table.agent'),
      key: 'agent',
      width: 150,
      render: (_: any, record: Request) => {
        if (!record.agent_id) {
          return <Tag>{t('requestsList.notAssigned')}</Tag>;
        }
        
        const agentName = record.agent_username 
          ? `@${record.agent_username}`
          : [record.agent_first_name, record.agent_last_name].filter(Boolean).join(' ') || t('requestsList.agent');
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiUser size={14} />
            <span>{agentName}</span>
          </div>
        );
      }
    },
    {
      title: t('requestsList.table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: t('requestsList.table.firstMessage'),
      dataIndex: 'first_message_at',
      key: 'first_message_at',
      width: 150,
      render: (date: string) => date ? formatDateTime(date) : '-'
    },
    {
      title: t('requestsList.table.lastMessage'),
      dataIndex: 'last_message_at',
      key: 'last_message_at',
      width: 150,
      render: (date: string) => date ? formatDateTime(date) : '-'
    },
    {
      title: t('requestsList.table.views'),
      key: 'views',
      width: 120,
      render: (_: any, record: Request) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.request_source === 'whatsapp' ? t('requestsList.screenshots') : t('requestsList.chat')}: {record.chat_views_count || 0}</div>
          <div>{t('requestsList.request')}: {record.request_views_count || 0}</div>
        </div>
      )
    },
    {
      title: t('requestsList.table.created'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => formatDateTime(date)
    },
    {
      title: t('requestsList.table.actions'),
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Request) => (
        <Space size="small">
          {record.status !== 'deal_created' && (
            <Tooltip title={t('requestsList.tooltips.createAgreement')}>
              <Button
                type="primary"
                size="small"
                icon={<FiFileText />}
                onClick={() => handleCreateAgreement(record.uuid)}
                style={{ 
                  background: '#52c41a', 
                  borderColor: '#52c41a' 
                }}
              />
            </Tooltip>
          )}
          
          <Tooltip title={record.request_source === 'whatsapp' ? t('requestsList.screenshots') : t('requestsList.tooltips.chatHistory')}>
            <Button
              type="text"
              icon={<FiMessageCircle />}
              onClick={() => openChatHistory(record.chat_uuid)}
            />
          </Tooltip>
          
          <Tooltip title={t('requestsList.tooltips.manageRequest')}>
            <Button
              type="text"
              icon={<FiExternalLink />}
              onClick={() => openRequestManagement(record.uuid)}
            />
          </Tooltip>
          
          <Popconfirm
            title={t('requestsList.confirm.deleteTitle')}
            description={t('requestsList.confirm.deleteDescription')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Tooltip title={t('common.delete')}>
              <Button
                type="text"
                danger
                icon={<FiTrash2 />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="requests-list-container">
      <div className="requests-list-header">
        <h1>{t('requestsList.title')}</h1>
        
        <div className="requests-list-filters">
          <Search
            placeholder={t('requestsList.placeholders.search')}
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
            enterButton={<FiSearch />}
          />
          
          <Select
            placeholder={t('requestsList.placeholders.allStatuses')}
            allowClear
            style={{ width: 200 }}
            onChange={handleStatusFilter}
          >
            <Option value="new">{t('requestsList.statuses.new')}</Option>
            <Option value="in_progress">{t('requestsList.statuses.inProgress')}</Option>
            <Option value="rejected">{t('requestsList.statuses.rejected')}</Option>
            <Option value="completed">{t('requestsList.statuses.completed')}</Option>
            <Option value="deal_created">{t('requestsList.statuses.dealCreated')}</Option>
          </Select>

          <Button
            type="primary"
            icon={<FiPlus />}
            onClick={handleCreateRequest}
          >
            {t('requestsList.buttons.createRequest')}
          </Button>

          {user?.is_super_admin && (
            <Button
              type="default"
              icon={<FiSettings />}
              onClick={handleBotSettings}
            >
              {t('requestsList.buttons.botManagement')}
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={requests}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1500 }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => t('requestsList.pagination.total', { total }),
          onChange: (page, pageSize) => {
            setPagination(prev => ({
              ...prev,
              current: page,
              pageSize: pageSize || 20
            }));
          }
        }}
      />

      {/* Модальное окно выбора источника */}
      <Modal
        title={t('requestsList.modals.createRequest')}
        open={sourceModalVisible}
        onCancel={() => setSourceModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button
            type="primary"
            size="large"
            icon={<FiMessageCircle />}
            onClick={() => handleSourceSelect('telegram')}
            style={{ height: 60 }}
          >
            Telegram
          </Button>
          <Button
            type="default"
            size="large"
            icon={<FiMessageCircle />}
            onClick={() => handleSourceSelect('whatsapp')}
            style={{ height: 60, background: '#25D366', color: 'white', borderColor: '#25D366' }}
          >
            WhatsApp
          </Button>
        </div>
      </Modal>

      {/* Модальное окно создания заявки из WhatsApp */}
      <Modal
        title={t('requestsList.modals.createWhatsAppRequest')}
        open={whatsappModalVisible}
        onCancel={() => {
          setWhatsappModalVisible(false);
          whatsappForm.resetFields();
          setUploadedScreenshots([]);
        }}
        onOk={handleCreateWhatsAppRequest}
        confirmLoading={creatingRequest}
        okText={t('requestsList.buttons.createRequest')}
        cancelText={t('common.cancel')}
        width={600}
      >
        <Form
          form={whatsappForm}
          layout="vertical"
        >
          <Form.Item
            label={t('requestsList.form.clientName')}
            name="client_name"
            rules={[{ required: true, message: t('requestsList.validation.enterClientName') }]}
          >
            <Input placeholder={t('requestsList.placeholders.clientName')} />
          </Form.Item>

          <Form.Item
            label={t('requestsList.form.whatsappPhone')}
            name="whatsapp_phone"
            rules={[{ required: true, message: t('requestsList.validation.enterPhone') }]}
          >
            <Input placeholder={t('requestsList.placeholders.phone')} />
          </Form.Item>

          <Form.Item
            label={t('requestsList.form.agentGroup')}
            name="agent_group_id"
          >
            <Select
              placeholder={t('requestsList.placeholders.selectAgentGroup')}
              allowClear
            >
              {agentGroups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.group_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={t('requestsList.form.note')}
            name="initial_note"
          >
            <TextArea
              rows={3}
              placeholder={t('requestsList.placeholders.note')}
            />
          </Form.Item>

          <Form.Item
            label={t('requestsList.form.screenshots')}
            required
          >
            <Upload
              listType="picture-card"
              fileList={uploadedScreenshots.map((path, index) => ({
                uid: `${index}`,
                name: t('requestsList.screenshot', { number: index + 1 }),
                status: 'done',
                url: `${import.meta.env.VITE_API_URL?.replace('/api', '')}${path}`
              }))}
              beforeUpload={handleUploadScreenshot}
              onRemove={(file) => {
                const path = uploadedScreenshots[parseInt(file.uid)];
                handleRemoveScreenshot(path);
              }}
              accept="image/*"
              multiple
            >
              {uploadedScreenshots.length < 10 && (
                <div>
                  <FiUpload style={{ fontSize: 24 }} />
                  <div style={{ marginTop: 8 }}>{t('requestsList.upload')}</div>
                </div>
              )}
            </Upload>
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              {t('requestsList.uploadDescription')}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RequestsList;