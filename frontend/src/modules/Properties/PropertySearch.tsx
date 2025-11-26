// frontend/src/modules/Properties/PropertySearch.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Input,
  Spin,
  Empty,
  Tag,
  Divider,
  Tabs,
  Badge,
  List,
  Avatar,
  Tooltip,
  Modal,
  Select
} from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  FilterOutlined,
  HistoryOutlined,
  ReloadOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  EyeOutlined,
  SendOutlined,
  WarningOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertySearchApi, SearchFilters, PropertySearchResult, AIConversation } from '@/api/propertySearch.api';
import { useAuthStore } from '@/store/authStore';
import PropertySearchResults from './components/PropertySearchResults';
import PropertySearchHistory from './components/PropertySearchHistory';
import MapSearchModal from './components/MapSearchModal';
import AIInterpretationModal from './components/AIInterpretationModal';
import AdvancedSearch from './components/AdvancedSearch';
import dayjs from 'dayjs';
import './PropertySearch.css';

const { TextArea } = Input;
const { TabPane } = Tabs;

const PropertySearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasPermission('properties.read')) {
      message.error(t('propertySearch.noAccess'));
      navigate('/');
    }
  }, [hasPermission, navigate, t]);

  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'conversations'>('search');
  const [searchMode, setSearchMode] = useState<'ai' | 'manual'>('ai');
  const [aiMode, setAiMode] = useState<'property_search' | 'client_agent'>('property_search');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [aiQuery, setAiQuery] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [aiInterpretation, setAiInterpretation] = useState<any>(null);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [requestedFeatures, setRequestedFeatures] = useState<string[]>([]);
  const [mustHaveFeatures, setMustHaveFeatures] = useState<string[]>([]);

  const [filters, setFilters] = useState<SearchFilters>({
    budget: {
      search_below_max: true
    }
  });

  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [executionTime, setExecutionTime] = useState<number>(0);

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (activeTab === 'conversations') {
      loadConversations();
    }
  }, [activeTab, aiMode]);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    setConversationsLoading(true);
    try {
      const { data } = await propertySearchApi.getConversations({ 
        limit: 50,
        mode: aiMode 
      });
      setConversations(data.data.conversations);
    } catch (error: any) {
      message.error(t('propertySearch.errorLoadingConversations'));
    } finally {
      setConversationsLoading(false);
    }
  };

  const loadConversation = async (conversationId: number) => {
    setLoading(true);
    try {
      const { data } = await propertySearchApi.getConversationById(conversationId);
      
      setCurrentConversationId(conversationId);
      setConversationMessages(data.data.messages);
      setActiveTab('search');
      
      message.success(t('propertySearch.conversationLoaded'));
    } catch (error: any) {
      message.error(t('propertySearch.errorLoadingConversation'));
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: number) => {
    try {
      await propertySearchApi.deleteConversation(conversationId);
      message.success(t('propertySearch.conversationDeleted'));
      loadConversations();
      
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
    } catch (error: any) {
      message.error(t('propertySearch.errorDeletingConversation'));
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setConversationMessages([]);
    setSearchResults([]);
    setAiQuery('');
    setAiInterpretation(null);
    setRequestedFeatures([]);
    setMustHaveFeatures([]);
  };

  const handleAISearch = async () => {
    if (!aiQuery.trim()) {
      message.warning(t('propertySearch.enterQueryText'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await propertySearchApi.searchWithAI(aiQuery, currentConversationId || undefined);
      setRequestedFeatures(data.data.requested_features || []);
      setMustHaveFeatures(data.data.must_have_features || []);
      setCurrentConversationId(data.data.conversationId);
      setConversationMessages(prev => [
        ...prev,
        { role: 'user', content: aiQuery, created_at: new Date().toISOString() },
        { role: 'assistant', content: data.data.aiResponse, created_at: new Date().toISOString() }
      ]);
      
      setAiInterpretation(data.data.interpretation);
      setSearchResults(data.data.properties);
      setExecutionTime(data.data.execution_time_ms);
      setHistoryRefresh(prev => prev + 1);
      setAiQuery('');

      message.success(t('propertySearch.foundProperties', { 
        count: data.data.total, 
        time: (data.data.execution_time_ms / 1000).toFixed(2) 
      }));

      if (data.data.interpretation.confidence < 0.7) {
        Modal.warning({
          title: (
            <Space style={{ color: '#ffffff' }}>
              <WarningOutlined style={{ color: '#faad14' }} />
              <span style={{ color: '#ffffff' }}>{t('propertySearch.lowConfidence')}</span>
            </Space>
          ),
          content: (
            <div style={{ color: '#ffffff', lineHeight: 1.8 }}>
              <p style={{ color: '#ffffff', marginBottom: 12 }}>
                {t('propertySearch.lowConfidenceDescription')}
              </p>
              <p style={{ color: '#ffffff', marginBottom: 12 }}>
                <strong style={{ color: '#faad14' }}>{t('propertySearch.reason')}:</strong>{' '}
                <span style={{ color: '#ffffff' }}>{data.data.interpretation.reasoning}</span>
              </p>
              <p style={{ color: '#ffffff', marginBottom: 0 }}>
                {t('propertySearch.lowConfidenceRecommendation')}
              </p>
            </div>
          ),
          okText: t('propertySearch.understood'),
          width: 500,
          okButtonProps: {
            style: { background: '#1890ff', borderColor: '#1890ff', color: '#ffffff' }
          },
          style: { top: 100 },
          className: 'low-confidence-modal',
          modalRender: (modal) => (
            <div style={{ 
              background: '#1f1f1f',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              {modal}
            </div>
          )
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('propertySearch.errorAISearch'));
    } finally {
      setLoading(false);
    }
  };

  const handleClientAgentChat = async () => {
    if (!aiQuery.trim()) {
      message.warning(t('propertySearch.enterMessageText'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await propertySearchApi.chatWithClient(aiQuery, currentConversationId || undefined);

      setCurrentConversationId(data.data.conversationId);
      setConversationMessages(prev => [
        ...prev,
        { role: 'user', content: aiQuery, created_at: new Date().toISOString() },
        { role: 'assistant', content: data.data.response, created_at: new Date().toISOString() }
      ]);
      
      if (data.data.shouldShowProperties && data.data.properties.length > 0) {
        setSearchResults(data.data.properties);
        setExecutionTime(data.data.execution_time_ms);
        setRequestedFeatures(data.data.requested_features || []);
        setMustHaveFeatures(data.data.must_have_features || []);
      }
      
      setAiQuery('');
      message.success(t('propertySearch.responseReceived'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('propertySearch.errorAIChat'));
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async (searchFilters: any) => {
    setLoading(true);
    try {
      const { data } = await propertySearchApi.searchManual(searchFilters);

      setSearchResults(data.data.properties);
      setExecutionTime(data.data.execution_time_ms);
      setAiInterpretation(null);
      setHistoryRefresh(prev => prev + 1);
      setRequestedFeatures(data.data.requested_features || []);
      setMustHaveFeatures(data.data.must_have_features || []);

      message.success(t('propertySearch.foundProperties', { 
        count: data.data.total, 
        time: (data.data.execution_time_ms / 1000).toFixed(2) 
      }));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('propertySearch.errorSearch'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      budget: {
        search_below_max: true
      }
    });
    setSearchResults([]);
    setAiInterpretation(null);
    setAiQuery('');
    setRequestedFeatures([]);
    setMustHaveFeatures([]);
  };

  const handleMapSearchApply = (mapData: { lat: number; lng: number; radius_km: number }) => {
    setFilters(prev => ({
      ...prev,
      map_search: mapData
    }));
    setMapModalVisible(false);
    message.success(t('propertySearch.mapZoneSet'));
  };

  const renderChatHistory = () => (
    <div className="chat-history">
      {conversationMessages.length === 0 ? (
        <Empty 
          description={
            aiMode === 'property_search' 
              ? t('propertySearch.startDialogWithAI')
              : t('propertySearch.startCommunicationWithClient')
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className="chat-messages">
          {conversationMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
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
                <div className="message-time">
                  {dayjs(msg.created_at).format('HH:mm')}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );

  const renderAISearch = () => (
    <Card className="ai-search-card">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div className="ai-header">
          <div className="ai-mode-switch">
            <Button.Group>
              <Button
                type={aiMode === 'property_search' ? 'primary' : 'default'}
                icon={<SearchOutlined />}
                onClick={() => {
                  setAiMode('property_search');
                  handleNewConversation();
                }}
              >
                {t('propertySearch.propertySearch')}
              </Button>
              <Button
                type={aiMode === 'client_agent' ? 'primary' : 'default'}
                icon={<CustomerServiceOutlined />}
                onClick={() => {
                  setAiMode('client_agent');
                  handleNewConversation();
                }}
              >
                {t('propertySearch.clientAgent')}
              </Button>
            </Button.Group>
          </div>

          <div className="ai-info">
            <RobotOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            <h3>
              {aiMode === 'property_search' 
                ? t('propertySearch.aiPropertySearch')
                : t('propertySearch.clientAgentMode')}
            </h3>
            <p>
              {aiMode === 'property_search'
                ? t('propertySearch.aiSearchDescription')
                : t('propertySearch.clientAgentDescription')}
            </p>
          </div>

          {currentConversationId && (
            <div className="conversation-controls">
              <Space>
                <Tag color="blue">
                  {t('propertySearch.conversationNumber', { id: currentConversationId })}
                </Tag>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleNewConversation}
                >
                  {t('propertySearch.newConversation')}
                </Button>
              </Space>
            </div>
          )}
        </div>

        {renderChatHistory()}

        <div className="chat-input-container">
          <TextArea
            rows={isMobile ? 3 : 2}
            placeholder={
              aiMode === 'property_search'
                ? t('propertySearch.searchPlaceholder')
                : t('propertySearch.clientMessagePlaceholder')
            }
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                aiMode === 'property_search' ? handleAISearch() : handleClientAgentChat();
              }
            }}
            disabled={loading}
            className="chat-input"
          />
          
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={aiMode === 'property_search' ? handleAISearch : handleClientAgentChat}
            loading={loading}
            size="large"
            className="send-button"
          >
            {t('propertySearch.send')}
          </Button>
        </div>

        {aiInterpretation && aiMode === 'property_search' && (
          <Card
            size="small"
            title={
              <Space>
                <RobotOutlined />
                {t('propertySearch.aiInterpretation')}
                <Badge
                  count={`${Math.round(aiInterpretation.confidence * 100)}%`}
                  style={{
                    backgroundColor: aiInterpretation.confidence > 0.8 ? '#52c41a' : '#faad14'
                  }}
                />
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => setShowInterpretation(true)}
              >
                {t('propertySearch.details')}
              </Button>
            }
            className="interpretation-card"
          >
            <p><strong>{t('propertySearch.queryUnderstanding')}:</strong> {aiInterpretation.reasoning}</p>
          </Card>
        )}
      </Space>
    </Card>
  );

  const renderConversations = () => (
    <Card 
      className="conversations-list-card"
      title={
        <Space>
          <HistoryOutlined />
          {aiMode === 'property_search' ? t('propertySearch.searchDialogs') : t('propertySearch.clientDialogs')}
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={loadConversations}
          loading={conversationsLoading}
        >
          {t('propertySearch.refresh')}
        </Button>
      }
    >
      <Spin spinning={conversationsLoading}>
        {conversations.length === 0 ? (
          <Empty description={t('propertySearch.noConversations')} />
        ) : (
          <List
            dataSource={conversations}
            renderItem={(conv) => (
              <List.Item
                key={conv.id}
                actions={[
                  <Tooltip title={t('propertySearch.continueDialog')}>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => loadConversation(conv.id)}
                    >
                      {t('propertySearch.open')}
                    </Button>
                  </Tooltip>,
                  <Tooltip title={t('propertySearch.deleteDialog')}>
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: t('propertySearch.deleteDialogConfirm'),
                          content: t('propertySearch.cannotUndo'),
                          okText: t('propertySearch.delete'),
                          cancelText: t('propertySearch.cancel'),
                          okButtonProps: { danger: true },
                          onOk: () => deleteConversation(conv.id)
                        });
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      icon={conv.mode === 'property_search' ? <SearchOutlined /> : <CustomerServiceOutlined />}
                      style={{ 
                        backgroundColor: conv.mode === 'property_search' ? '#1890ff' : '#52c41a' 
                      }}
                    />
                  }
                  title={
                    <Space>
                      <span>{conv.title || t('propertySearch.conversationId', { id: conv.id })}</span>
                      <Tag color="blue">{conv.messages_count} {t('propertySearch.messages')}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>{t('propertySearch.firstMessage')}:</strong> {conv.first_message?.substring(0, 100)}
                        {conv.first_message?.length > 100 && '...'}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {t('propertySearch.updated')}: {dayjs(conv.updated_at).format('DD.MM.YYYY HH:mm')}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </Card>
  );

  return (
    <div className="property-search-container">
      <Card
        title={
          <Space>
            <SearchOutlined />
            {t('propertySearch.title')}
          </Space>
        }
        extra={
          <Button onClick={() => navigate('/properties')}>
            {t('propertySearch.backToList')}
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'search' | 'history' | 'conversations')}
          size={isMobile ? 'small' : 'large'}
        >
          <TabPane
            tab={
              <span>
                <SearchOutlined />
                {t('propertySearch.search')}
              </span>
            }
            key="search"
          >
            <div className="search-mode-toggle">
              <Button.Group style={{ width: isMobile ? '100%' : 'auto' }}>
                <Button
                  type={searchMode === 'ai' ? 'primary' : 'default'}
                  icon={<RobotOutlined />}
                  onClick={() => setSearchMode('ai')}
                  style={{ width: isMobile ? '50%' : 'auto' }}
                >
                  {t('propertySearch.aiSearch')}
                </Button>
                <Button
                  type={searchMode === 'manual' ? 'primary' : 'default'}
                  icon={<FilterOutlined />}
                  onClick={() => setSearchMode('manual')}
                  style={{ width: isMobile ? '50%' : 'auto' }}
                >
                  {t('propertySearch.advanced')}
                </Button>
              </Button.Group>
            </div>

            <Divider />

            <Spin spinning={loading}>
              {searchMode === 'ai' ? (
                renderAISearch()
              ) : (
                <AdvancedSearch
                  onSearch={handleManualSearch}
                  onReset={handleResetFilters}
                  onMapSearch={() => setMapModalVisible(true)}
                  loading={loading}
                  initialFilters={filters}
                  mapSearchActive={!!filters.map_search}
                />
              )}
            </Spin>

            {searchResults.length > 0 && (
              <>
                <Divider />
                <PropertySearchResults
                  properties={searchResults}
                  executionTime={executionTime}
                  onViewProperty={(id) => navigate(`/properties/view/${id}`)}
                  requestedFeatures={requestedFeatures}
                  mustHaveFeatures={mustHaveFeatures}
                />
              </>
            )}

            {searchResults.length === 0 && !loading && searchMode === 'manual' && (
              <Empty
                description={t('propertySearch.startSearchToSeeResults')}
                style={{ marginTop: 40 }}
              />
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <HistoryOutlined />
                {t('propertySearch.dialogs')}
              </span>
            }
            key="conversations"
          >
            <div className="ai-mode-selector" style={{ marginBottom: 16 }}>
              <Select
                value={aiMode}
                onChange={(value) => {
                  setAiMode(value);
                  loadConversations();
                }}
                style={{ width: 250 }}
              >
                <Select.Option value="property_search">
                  <SearchOutlined /> {t('propertySearch.propertySearch')}
                </Select.Option>
                <Select.Option value="client_agent">
                  <CustomerServiceOutlined /> {t('propertySearch.clientAgent')}
                </Select.Option>
              </Select>
            </div>
            {renderConversations()}
          </TabPane>

          <TabPane
            tab={
              <span>
                <HistoryOutlined />
                {t('propertySearch.searchHistory')}
              </span>
            }
            key="history"
          >
            <PropertySearchHistory
              refreshTrigger={historyRefresh}
              onLoadSearch={(log: any, properties: any[]) => {
                setSearchResults(properties);
                setExecutionTime(log.execution_time_ms);
              
                if (log.search_type === 'ai') {
                  setSearchMode('ai');
                  if (log.ai_query) {
                    setConversationMessages([
                      { 
                        role: 'user', 
                        content: log.ai_query, 
                        created_at: log.created_at 
                      },
                      {
                        role: 'assistant',
                        content: t('propertySearch.foundPropertiesCount', { count: properties.length }),
                        created_at: log.created_at
                      }
                    ]);
                  }
                  if (log.conversation_id) {
                    setCurrentConversationId(log.conversation_id);
                  }
                } else {
                  setSearchMode('manual');
                  if (log.search_params) {
                    setFilters(log.search_params);
                  }
                }
                
                setActiveTab('search');
                
                message.success(t('propertySearch.loadedFromHistory', { count: properties.length }));
              }}
              onNavigateToChat={(conversationId: number) => {
                loadConversation(conversationId);
                setActiveTab('search');
                message.success(t('propertySearch.conversationLoaded'));
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <MapSearchModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onApply={handleMapSearchApply}
        initialData={filters.map_search}
      />

      <AIInterpretationModal
        visible={showInterpretation}
        onClose={() => setShowInterpretation(false)}
        interpretation={aiInterpretation}
      />
    </div>
  );
};

export default PropertySearch;