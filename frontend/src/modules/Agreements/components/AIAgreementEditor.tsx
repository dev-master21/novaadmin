// frontend/src/modules/Agreements/components/AIAgreementEditor.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Input,
  Spin,
  Empty,
  Avatar,
  Modal,
  Descriptions,
  Tag,
  List,
  Typography,
  Alert,
  Divider
} from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  WarningOutlined,
  FileTextOutlined,
  TranslationOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { agreementsApi } from '@/api/agreements.api';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import './AIAgreementEditor.css';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface AIAgreementEditorProps {
  agreementId: number;
  onChangesApplied: () => void;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  changes?: any;
}

interface ChangedSection {
  section: string;
  action: 'added' | 'modified' | 'removed';
  clause_number: string;
  text_en: string;
  text_ru: string;
  reason_en: string;
  reason_ru: string;
}

interface ConflictDetected {
  section: string;
  clause_number: string;
  conflict_description: string;
  conflict_description_ru: string;
  text_en: string;
  text_ru: string;
  resolution: string;
  resolution_ru: string;
}

interface PendingChanges {
  conversationId: string;
  description: string;
  descriptionRu: string;
  changedFields: string[];
  changedSections?: ChangedSection[];
  conflictsDetected?: ConflictDetected[];
  htmlAfter: string;
  structureAfter: string;
  databaseUpdates: Record<string, any>;
  aiResponse: string;
}

const AIAgreementEditor = ({ agreementId, onChangesApplied, onClose }: AIAgreementEditorProps) => {
  const { t } = useTranslation();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      message.warning(t('aiAgreementEditor.enterPrompt'));
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data } = await agreementsApi.aiEdit(agreementId, {
        prompt,
        conversationId: conversationId || undefined,
        conversationHistory
      });

      setConversationId(data.data.conversationId);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.data.aiResponse,
        timestamp: new Date().toISOString(),
        changes: data.data.changes
      };

      setMessages(prev => [...prev, assistantMessage]);

      setPendingChanges({
        conversationId: data.data.conversationId,
        description: data.data.changes.description,
        descriptionRu: data.data.changes.descriptionRu,
        changedFields: data.data.changes.changedFields,
        changedSections: data.data.changes.changedSections || [],
        conflictsDetected: data.data.changes.conflictsDetected || [],
        htmlAfter: data.data.changes.htmlAfter,
        structureAfter: data.data.changes.structureAfter,
        databaseUpdates: data.data.changes.databaseUpdates,
        aiResponse: data.data.aiResponse
      });

      setConfirmModalVisible(true);
      message.success(t('aiAgreementEditor.changesPrepared'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('aiAgreementEditor.errorProcessing'));
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!pendingChanges) return;

    setApplying(true);
    try {
      await agreementsApi.applyAiEdit(agreementId, {
        conversationId: pendingChanges.conversationId,
        htmlAfter: pendingChanges.htmlAfter,
        structureAfter: pendingChanges.structureAfter,
        databaseUpdates: pendingChanges.databaseUpdates
      });

      message.success(t('aiAgreementEditor.success.applied'));
      setConfirmModalVisible(false);
      setPendingChanges(null);
      onChangesApplied();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('aiAgreementEditor.errors.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  const handleCancelChanges = () => {
    setConfirmModalVisible(false);
    message.info(t('aiAgreementEditor.confirmChanges.changesCanceled'));
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await agreementsApi.getAiEditHistory(agreementId);
      setEditHistory(data.data);
      setHistoryModalVisible(true);
    } catch (error: any) {
      message.error(t('aiAgreementEditor.errors.loadHistoryFailed'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'added':
        return <PlusOutlined style={{ color: '#52c41a' }} />;
      case 'modified':
        return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'removed':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <EditOutlined />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'added':
        return 'success';
      case 'modified':
        return 'processing';
      case 'removed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'added':
        return 'Добавлено';
      case 'modified':
        return 'Изменено';
      case 'removed':
        return 'Удалено';
      default:
        return action;
    }
  };

  const renderMessage = (msg: ChatMessage, index: number) => (
    <div 
      key={index}
      className={`ai-editor-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
    >
      <div className="message-avatar">
        {msg.role === 'user' ? (
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
        ) : (
          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
        )}
      </div>
      <div className="message-content">
        <div className="message-text">{msg.content}</div>
        {msg.changes && (
          <div className="message-changes-summary">
            <Tag color="blue" icon={<CheckOutlined />}>
              {msg.changes.changedFields.length} {t('aiAgreementEditor.changes')}
            </Tag>
          </div>
        )}
        <div className="message-time">
          {dayjs(msg.timestamp).format('HH:mm')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="ai-agreement-editor">
      <Card
        className="ai-editor-card"
        title={
          <Space>
            <RobotOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <span>{t('aiAgreementEditor.title')}</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<HistoryOutlined />}
              onClick={loadHistory}
              loading={historyLoading}
            >
              {t('aiAgreementEditor.history')}
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              {t('aiAgreementEditor.close')}
            </Button>
          </Space>
        }
      >
        <Alert
          message={t('aiAgreementEditor.instruction')}
          description={t('aiAgreementEditor.instruction')}
          type="info"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        <div className="ai-editor-chat">
          {messages.length === 0 ? (
            <Empty
              description={t('aiAgreementEditor.startDialog')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="chat-messages">
              {messages.map((msg, index) => renderMessage(msg, index))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="ai-editor-input">
          <TextArea
            rows={3}
            placeholder={t('aiAgreementEditor.placeholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            disabled={loading}
            className="chat-textarea"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendPrompt}
            loading={loading}
            size="large"
            className="send-button"
          >
            {t('aiAgreementEditor.send')}
          </Button>
        </div>

        {conversationId && (
          <div className="conversation-info">
            <Tag color="blue">{t('aiAgreementEditor.conversationId')}: {conversationId}</Tag>
          </div>
        )}
      </Card>

      {/* Модальное окно подтверждения изменений */}
      <Modal
        title={
          <Space>
            <CheckOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {t('aiAgreementEditor.confirmChanges.title')}
            </span>
          </Space>
        }
        open={confirmModalVisible}
        onCancel={handleCancelChanges}
        width="90%"
        style={{ maxWidth: 1000, top: 20 }}
        footer={[
          <Button key="cancel" size="large" onClick={handleCancelChanges} disabled={applying}>
            {t('aiAgreementEditor.confirmChanges.cancel')}
          </Button>,
          <Button
            key="apply"
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={handleApplyChanges}
            loading={applying}
          >
            {t('aiAgreementEditor.confirmChanges.apply')}
          </Button>
        ]}
        className="ai-changes-confirm-modal"
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        {pendingChanges && (
          <div className="changes-preview-container">
            {/* AI Response */}
            <Alert
              message={<Text strong style={{ fontSize: 16 }}>Ответ AI</Text>}
              description={pendingChanges.aiResponse}
              type="success"
              showIcon
              icon={<RobotOutlined style={{ fontSize: 20 }} />}
              style={{ marginBottom: 20 }}
            />

            {/* Changed Sections - Основные изменения */}
            {pendingChanges.changedSections && pendingChanges.changedSections.length > 0 && (
              <Card 
                className="changes-card"
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <Text strong style={{ fontSize: 16 }}>Внесенные изменения</Text>
                  </Space>
                }
                style={{ marginBottom: 20 }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {pendingChanges.changedSections.map((section, index) => (
                    <Card
                      key={index}
                      size="small"
                      className="section-change-card"
                      style={{ 
                        backgroundColor: '#fafafa',
                        border: '1px solid #d9d9d9'
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {getActionIcon(section.action)}
                          <Tag color={getActionColor(section.action)} style={{ margin: 0, fontSize: 13 }}>
                            {getActionText(section.action)}
                          </Tag>
                          <Tag color="blue" style={{ margin: 0, fontSize: 13 }}>
                            Пункт {section.clause_number}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {section.section}
                          </Text>
                        </div>

                        <Divider style={{ margin: '8px 0' }} />

                        {/* English Text */}
                        <div className="clause-text-block">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <FileTextOutlined style={{ color: '#1890ff' }} />
                            <Text strong style={{ color: '#1890ff' }}>На английском:</Text>
                          </div>
                          <Paragraph 
                            style={{ 
                              backgroundColor: '#e6f7ff', 
                              padding: '12px',
                              borderRadius: 4,
                              marginBottom: 0,
                              border: '1px solid #91d5ff'
                            }}
                          >
                            {section.text_en}
                          </Paragraph>
                        </div>

                        {/* Russian Translation */}
                        <div className="clause-text-block">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <TranslationOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ color: '#52c41a' }}>На русском:</Text>
                          </div>
                          <Paragraph 
                            style={{ 
                              backgroundColor: '#f6ffed', 
                              padding: '12px',
                              borderRadius: 4,
                              marginBottom: 0,
                              border: '1px solid #b7eb8f'
                            }}
                          >
                            {section.text_ru}
                          </Paragraph>
                        </div>

                        {/* Reason */}
                        <div className="clause-reason-block">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                            <Text type="secondary" strong>Причина изменения:</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {section.reason_ru}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}

            {/* Conflicts Detected - Конфликты */}
            {pendingChanges.conflictsDetected && pendingChanges.conflictsDetected.length > 0 && (
              <Card
                className="conflicts-card"
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                    <Text strong style={{ fontSize: 16, color: '#fa8c16' }}>
                      Обнаружены конфликты ({pendingChanges.conflictsDetected.length})
                    </Text>
                  </Space>
                }
                style={{ 
                  marginBottom: 20,
                  border: '2px solid #ffa940'
                }}
                headStyle={{ 
                  backgroundColor: '#fff7e6',
                  borderBottom: '2px solid #ffa940'
                }}
              >
                <Alert
                  message="AI автоматически исправил конфликтующие пункты"
                  description="Указанные ниже пункты были изменены для поддержания согласованности договора"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {pendingChanges.conflictsDetected.map((conflict, index) => (
                    <Card
                      key={index}
                      size="small"
                      className="conflict-card"
                      style={{ 
                        backgroundColor: '#fffbe6',
                        border: '1px solid #ffe58f'
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* Conflict Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <WarningOutlined style={{ color: '#fa8c16' }} />
                          <Tag color="warning" style={{ margin: 0, fontSize: 13 }}>
                            Конфликт
                          </Tag>
                          <Tag color="orange" style={{ margin: 0, fontSize: 13 }}>
                            Пункт {conflict.clause_number}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {conflict.section}
                          </Text>
                        </div>

                        <Divider style={{ margin: '8px 0' }} />

                        {/* Conflict Description */}
                        <Alert
                          message="Описание конфликта"
                          description={conflict.conflict_description_ru}
                          type="warning"
                          showIcon
                          style={{ marginBottom: 12 }}
                        />

                        {/* New Text After Resolution */}
                        <div className="clause-text-block">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <CheckOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ color: '#52c41a' }}>Исправленный текст (English):</Text>
                          </div>
                          <Paragraph 
                            style={{ 
                              backgroundColor: '#e6f7ff', 
                              padding: '12px',
                              borderRadius: 4,
                              marginBottom: 0,
                              border: '1px solid #91d5ff'
                            }}
                          >
                            {conflict.text_en}
                          </Paragraph>
                        </div>

                        <div className="clause-text-block">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <TranslationOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ color: '#52c41a' }}>Исправленный текст (Russian):</Text>
                          </div>
                          <Paragraph 
                            style={{ 
                              backgroundColor: '#f6ffed', 
                              padding: '12px',
                              borderRadius: 4,
                              marginBottom: 0,
                              border: '1px solid #b7eb8f'
                            }}
                          >
                            {conflict.text_ru}
                          </Paragraph>
                        </div>

                        {/* Resolution */}
                        <div style={{ 
                          backgroundColor: '#f0f5ff',
                          padding: 12,
                          borderRadius: 4,
                          border: '1px solid #adc6ff'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                            <Text strong style={{ color: '#1890ff' }}>Решение:</Text>
                          </div>
                          <Text style={{ fontSize: 13 }}>
                            {conflict.resolution_ru}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}

            {/* Database Updates */}
            {Object.keys(pendingChanges.databaseUpdates).length > 0 && (
              <Card 
                size="small" 
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    <Text strong>Изменения в базе данных</Text>
                  </Space>
                }
                style={{ marginBottom: 20 }}
              >
                <Descriptions column={1} size="small" bordered>
                  {Object.entries(pendingChanges.databaseUpdates).map(([key, value]) => (
                    <Descriptions.Item key={key} label={<Text code>{key}</Text>}>
                      <Tag color="blue">{String(value)}</Tag>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            )}

            {/* Warning */}
            <Alert
              message="Внимание"
              description="Пожалуйста, внимательно проверьте все изменения перед применением. После применения договор будет обновлен и PDF будет перегенерирован."
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            <span>{t('aiAgreementEditor.history.title')}</span>
          </Space>
        }
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        width="90%"
        style={{ maxWidth: 900, top: 20 }}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            {t('aiAgreementEditor.history.close')}
          </Button>
        ]}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        <Spin spinning={historyLoading}>
          {editHistory.length === 0 ? (
            <Empty description={t('aiAgreementEditor.history.empty')} />
          ) : (
            <List
              dataSource={editHistory}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <Card
                    size="small"
                    style={{ width: '100%' }}
                    title={
                      <Space wrap>
                        <Tag color={item.was_applied ? 'success' : 'default'}>
                          {item.was_applied ? t('aiAgreementEditor.history.applied') : t('aiAgreementEditor.history.notApplied')}
                        </Tag>
                        <Text type="secondary">
                          {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}
                        </Text>
                      </Space>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Text strong>{t('aiAgreementEditor.history.userPrompt')} ({item.user_name}):</Text>
                        <Paragraph style={{ marginBottom: 8, marginTop: 4 }}>
                          {item.prompt}
                        </Paragraph>
                      </div>
                      <div>
                        <Text strong>{t('aiAgreementEditor.history.changesDescription')}:</Text>
                        <Paragraph style={{ marginBottom: 8, marginTop: 4 }}>
                          {item.changes_description}
                        </Paragraph>
                      </div>
                      {item.was_applied && item.applied_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('aiAgreementEditor.history.appliedAt')}: {dayjs(item.applied_at).format('DD.MM.YYYY HH:mm')}
                        </Text>
                      )}
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default AIAgreementEditor;