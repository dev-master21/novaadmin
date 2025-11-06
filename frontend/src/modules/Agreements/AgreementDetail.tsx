// frontend/src/modules/Agreements/AgreementDetail.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Modal,
  message,
  Spin,
  Tabs,
  Table,
  Drawer,
  Switch,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  SaveOutlined,
  CloseOutlined,
  FileTextOutlined,
  CodeOutlined,
  MobileOutlined,
  DesktopOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AgreementDetail.css';

const AgreementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('document');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedStructure, setEditedStructure] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);

  // Режимы просмотра
  const [viewMode, setViewMode] = useState<'formatted' | 'simple'>('formatted');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Определяем мобильное устройство
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // По умолчанию для мобильных - упрощенный режим (только если не редактируем)
      if (mobile && !isEditing) {
        setViewMode('simple');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isEditing]);

  useEffect(() => {
    if (id) {
      fetchAgreement();
    }
  }, [id]);

  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      setIsEditing(true);
      setActiveTab('document');
    }
  }, [searchParams]);

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getById(Number(id));
      setAgreement(response.data.data);
      setEditedContent(response.data.data.content || '');
      setEditedStructure(response.data.data.structure || '');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка загрузки договора');
      navigate('/agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Удалить договор?',
      content: 'Это действие нельзя отменить',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await agreementsApi.delete(Number(id));
          message.success('Договор успешно удалён');
          navigate('/agreements');
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Ошибка удаления договора');
        }
      }
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  const copyPublicLink = () => {
    if (agreement) {
      navigator.clipboard.writeText(agreement.public_link);
      message.success('Ссылка скопирована в буфер обмена');
    }
  };

  const handleContentChange = (content: string, structure?: string) => {
    setEditedContent(content);
    if (structure) {
      setEditedStructure(structure);
    }
  };

  const handleSimpleContentChange = (content: string) => {
    setEditedContent(content);
  };

  const handleSaveEdit = async () => {
    if (!agreement) return;
    
    setSaving(true);
    try {
      await agreementsApi.update(agreement.id, {
        content: editedContent,
        structure: editedStructure
      });
      message.success('Договор успешно сохранён');
      setIsEditing(false);
      await fetchAgreement();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка сохранения договора');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    Modal.confirm({
      title: 'Отменить редактирование?',
      content: 'Несохранённые изменения будут потеряны',
      okText: 'Да, отменить',
      cancelText: 'Продолжить редактирование',
      onOk: () => {
        setIsEditing(false);
        setEditedContent(agreement?.content || '');
        setEditedStructure(agreement?.structure || '');
      }
    });
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'formatted' ? 'simple' : 'formatted');
    message.info(viewMode === 'formatted' ? 'Упрощенный режим' : 'Режим с оформлением');
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ]
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!agreement) {
    return null;
  }

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: 'Черновик' },
      pending_signatures: { color: 'processing', text: 'Ожидает подписей' },
      signed: { color: 'success', text: 'Подписан' },
      active: { color: 'success', text: 'Активен' },
      expired: { color: 'warning', text: 'Истёк' },
      cancelled: { color: 'error', text: 'Отменён' }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      rent: 'Аренда',
      sale: 'Продажа',
      bilateral: 'Двухсторонний',
      trilateral: 'Трёхсторонний',
      agency: 'Агентский',
      transfer_act: 'Акт передачи'
    };
    return types[type] || type;
  };

  const tabItems = [
    {
      key: 'document',
      label: 'Документ',
      children: (
        <div className="agreement-document-container">
          {/* Индикатор устройства и переключатель режимов */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px',
            background: '#1f1f1f',
            borderRadius: '4px',
            border: '1px solid #303030',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isMobile ? <MobileOutlined /> : <DesktopOutlined />}
              <span style={{ fontSize: '12px', color: '#888' }}>
                {isMobile ? 'Мобильная версия' : 'Десктопная версия'}
              </span>
            </div>

            <Space>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                {viewMode === 'formatted' ? 'С оформлением' : 'Упрощенный'}
              </span>
              <Tooltip title={`Переключить на ${viewMode === 'formatted' ? 'упрощенный' : 'с оформлением'} режим`}>
                <Switch
                  checked={viewMode === 'formatted'}
                  onChange={toggleViewMode}
                  checkedChildren={<FileTextOutlined />}
                  unCheckedChildren={<CodeOutlined />}
                />
              </Tooltip>
            </Space>
          </div>

          {isEditing && (
            <div style={{ marginBottom: '16px', padding: '12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px' }}>
              <div style={{ fontSize: '14px', color: '#595959' }}>
                {viewMode === 'formatted' 
                  ? 'Кликните на любой текст для редактирования. Используйте зелёные кнопки для добавления секций, параграфов и списков.'
                  : 'Редактируйте текст договора. HTML-разметка поддерживается.'}
              </div>
            </div>
          )}
          
          {/* РЕЖИМ С ОФОРМЛЕНИЕМ (DocumentEditor) */}
          {viewMode === 'formatted' && (
            <div className={`document-editor-wrapper ${isMobile ? 'mobile-zoom' : ''}`}>
              <DocumentEditor
                ref={printRef}
                agreement={agreement}
                isEditing={isEditing}
                onContentChange={handleContentChange}
                logoUrl="/nova-logo.svg"
              />
            </div>
          )}

          {/* Скрытый DocumentEditor для печати (когда показан упрощенный режим) */}
          {viewMode === 'simple' && (
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '793px' }}>
              <DocumentEditor
                ref={printRef}
                agreement={{ ...agreement, content: editedContent }}
                isEditing={false}
                onContentChange={() => {}}
                logoUrl="/nova-logo.svg"
              />
            </div>
          )}

        {/* УПРОЩЕННЫЙ РЕЖИМ */}
          {viewMode === 'simple' && (
            <div className={`agreement-simple-view ${isMobile ? 'mobile-view' : ''}`}>
              <ReactQuill
                key={`quill-${isEditing ? 'edit' : 'view'}`}
                value={editedContent}
                onChange={isEditing ? handleSimpleContentChange : undefined}
                readOnly={!isEditing}
                theme="snow"
                modules={isEditing ? modules : { toolbar: false }}
                style={{ 
                  border: '1px solid #303030',
                  borderRadius: '4px',
                  background: '#1f1f1f',
                  minHeight: isEditing ? '500px' : 'auto'
                }}
              />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'details',
      label: 'Детали',
      children: (
        <Card className="agreement-details-card">
          <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }} size="small">
            <Descriptions.Item label="Номер договора" span={2}>
              <strong>{agreement.agreement_number}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Тип">
              {getTypeLabel(agreement.type)}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">
              {getStatusTag(agreement.status)}
            </Descriptions.Item>
            {agreement.property_name && (
              <Descriptions.Item label="Объект" span={2}>
                {agreement.property_name} ({agreement.property_number})
              </Descriptions.Item>
            )}
            {agreement.description && (
              <Descriptions.Item label="Описание" span={2}>
                {agreement.description}
              </Descriptions.Item>
            )}
            {agreement.date_from && (
              <Descriptions.Item label="Дата начала">
                {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            {agreement.date_to && (
              <Descriptions.Item label="Дата окончания">
                {new Date(agreement.date_to).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Город">
              {agreement.city}
            </Descriptions.Item>
            <Descriptions.Item label="Создан">
              {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
            </Descriptions.Item>
            {agreement.created_by_name && (
              <Descriptions.Item label="Создал" span={2}>
                {agreement.created_by_name}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )
    },
    {
      key: 'parties',
      label: 'Стороны',
      children: (
        <Card className="agreement-parties-card">
          {agreement.parties && agreement.parties.length > 0 ? (
            <div className="parties-list">
              {agreement.parties.map((party, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  style={{ marginBottom: '12px' }}
                  className="party-card"
                >
                  <div className="party-info">
                    <div className="party-role">
                      <Tag color="blue">{party.role}</Tag>
                    </div>
                    <div className="party-details">
                      <div><strong>{party.name}</strong></div>
                      <div className="party-passport">
                        Страна: {party.passport_country}
                      </div>
                      <div className="party-passport">
                        Паспорт: {party.passport_number}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Стороны не указаны
            </div>
          )}
        </Card>
      )
    },
    {
      key: 'signatures',
      label: 'Подписи',
      children: (
        <Card>
          {agreement.signatures && agreement.signatures.length > 0 ? (
            <Table
              dataSource={agreement.signatures}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Подписант',
                  dataIndex: 'signer_name',
                  key: 'signer_name'
                },
                {
                  title: 'Роль',
                  dataIndex: 'signer_role',
                  key: 'signer_role'
                },
                {
                  title: 'Статус',
                  dataIndex: 'is_signed',
                  key: 'is_signed',
                  render: (is_signed) => (
                    <Tag color={is_signed ? 'success' : 'default'}>
                      {is_signed ? 'Подписано' : 'Ожидает'}
                    </Tag>
                  )
                },
                {
                  title: 'Дата подписания',
                  dataIndex: 'signed_at',
                  key: 'signed_at',
                  render: (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-'
                }
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Подписи не настроены
            </div>
          )}
        </Card>
      )
    }
  ];

  return (
    <div className="agreement-detail-container">
      <Card className="agreement-header-card">
        <div className="agreement-header-content">
          <div className="agreement-header-left">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/agreements')}
              className="back-button"
            >
              <span className="back-button-text">Назад</span>
            </Button>
            <div className="agreement-title-section">
              <h2 className="agreement-title">Договор {agreement.agreement_number}</h2>
              {getStatusTag(agreement.status)}
            </div>
          </div>
          
          <Space className="agreement-actions" wrap>
            {!isEditing ? (
              <>
                <Button 
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                  className="action-button"
                >
                  <span className="action-button-text">Редактировать</span>
                </Button>
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={handlePrint}
                  className="action-button"
                >
                  <span className="action-button-text">PDF</span>
                </Button>
                <Button 
                  icon={<LinkOutlined />}
                  onClick={copyPublicLink}
                  className="action-button"
                >
                  <span className="action-button-text">Ссылка</span>
                </Button>
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  className="action-button delete-button"
                >
                  <span className="action-button-text">Удалить</span>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveEdit}
                  loading={saving}
                >
                  Сохранить
                </Button>
                <Button 
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                >
                  Отмена
                </Button>
              </>
            )}
          </Space>
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="agreement-tabs"
      />

      <Drawer
        title="Детальная информация"
        placement="bottom"
        onClose={() => setDetailsDrawerVisible(false)}
        open={detailsDrawerVisible}
        height="80%"
        className="details-drawer"
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Номер">{agreement.agreement_number}</Descriptions.Item>
          <Descriptions.Item label="Тип">{getTypeLabel(agreement.type)}</Descriptions.Item>
          <Descriptions.Item label="Статус">{getStatusTag(agreement.status)}</Descriptions.Item>
          {agreement.property_name && (
            <Descriptions.Item label="Объект">
              {agreement.property_name} ({agreement.property_number})
            </Descriptions.Item>
          )}
          {agreement.description && (
            <Descriptions.Item label="Описание">{agreement.description}</Descriptions.Item>
          )}
          <Descriptions.Item label="Город">{agreement.city}</Descriptions.Item>
          <Descriptions.Item label="Создан">
            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>
      </Drawer>
    </div>
  );
};

export default AgreementDetail;