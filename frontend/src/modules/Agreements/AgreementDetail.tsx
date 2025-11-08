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
  Dropdown,
  Row,
  Col,
  Typography,
  Input
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
  DesktopOutlined,
  CheckOutlined,
  ReloadOutlined,
  CopyOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { agreementsApi, Agreement, AgreementSignature } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AgreementDetail.css';
import SignaturesModal from './components/SignaturesModal';

const { Text } = Typography;

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
  const [signaturesModalVisible, setSignaturesModalVisible] = useState(false);

  // Новый state для модального окна с детальной информацией подписи на мобильных
  const [signatureDetailsModal, setSignatureDetailsModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<AgreementSignature | null>(null);

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

  // Функция для открытия модального окна с детальной информацией на мобильных
  const handleSignatureDetailsClick = (record: AgreementSignature) => {
    if (isMobile) {
      setSelectedSignature(record);
      setSignatureDetailsModal(true);
    }
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

  // Компонент детальной информации о подписи (переиспользуемый)
  const SignatureDetailsContent = ({ record }: { record: AgreementSignature }) => (
    <div style={{ 
      padding: '16px', 
      background: '#141414',  // ✅ Изменил на темный фон
      borderRadius: '8px',
      color: 'rgba(255, 255, 255, 0.85)' // ✅ Добавил цвет текста для темной темы
    }}>
      <h4 style={{ marginBottom: 16, color: 'rgba(255, 255, 255, 0.95)' }}>Детальная аналитика подписи</h4>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card 
            size="small" 
            title="Информация о сессии"
            style={{ background: '#1f1f1f', borderColor: '#303030' }}
            headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text type="secondary">IP адрес:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.ip_address || 'Не определён'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Устройство:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.device_type || 'Не определено'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Браузер:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.browser || 'Не определён'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Операционная система:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.os || 'Не определена'}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            size="small" 
            title="Временные метрики"
            style={{ background: '#1f1f1f', borderColor: '#303030' }}
            headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text type="secondary">Первый визит:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.first_visit_at 
                    ? new Date(record.first_visit_at).toLocaleString('ru-RU')
                    : 'Не посещал'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Время просмотра договора:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.agreement_view_duration 
                    ? `${Math.floor(record.agreement_view_duration / 60)} мин ${record.agreement_view_duration % 60} сек`
                    : '0 сек'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Общее время на странице:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.total_session_duration 
                    ? `${Math.floor(record.total_session_duration / 60)} мин ${record.total_session_duration % 60} сек`
                    : '0 сек'}
                </Text>
              </div>
              <div>
                <Text type="secondary">Количество очисток подписи:</Text>
                <br />
                <Text strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {record.signature_clear_count || 0}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        {record.is_signed && record.signature_data && (
          <Col xs={24}>
            <Card 
              size="small" 
              title="Подпись"
              style={{ background: '#1f1f1f', borderColor: '#303030' }}
              headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
            >
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={record.signature_data} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: '300px', 
                    border: '1px solid #303030',
                    borderRadius: '4px',
                    padding: '8px',
                    background: 'white'
                  }} 
                />
              </div>
            </Card>
          </Col>
        )}
        {record.signature_link && (
          <Col xs={24}>
            <Card 
              size="small" 
              title="Ссылка для подписания"
              style={{ background: '#1f1f1f', borderColor: '#303030' }}
              headStyle={{ background: '#1f1f1f', color: 'rgba(255, 255, 255, 0.85)' }}
            >
              <Input.Group compact>
                <Input
                  style={{ width: 'calc(100% - 100px)' }}
                  value={`https://agreement.novaestate.company/sign/${record.signature_link}`}
                  readOnly
                />
                <Button 
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://agreement.novaestate.company/sign/${record.signature_link}`
                    );
                    message.success('Ссылка скопирована');
                  }}
                >
                  Копировать
                </Button>
              </Input.Group>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );

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
                {viewMode === 'formatted' ? 'Режим с оформлением' : 'Упрощенный режим'}
              </span>
              <Switch
                checked={viewMode === 'formatted'}
                onChange={toggleViewMode}
                checkedChildren={<FileTextOutlined />}
                unCheckedChildren={<CodeOutlined />}
              />
            </Space>
          </div>

          {/* Документ для печати (скрыт) */}
          <div style={{ display: 'none' }}>
            <div ref={printRef}>
              <DocumentEditor
                agreement={agreement}
                isEditing={false}
                logoUrl="/nova-logo.svg"
              />
            </div>
          </div>

          {/* Основной контент */}
          {isEditing ? (
            viewMode === 'formatted' ? (
              <DocumentEditor
                agreement={agreement}
                isEditing={true}
                onContentChange={handleContentChange}
                logoUrl="/nova-logo.svg"
              />
            ) : (
              <div className="agreement-simple-view">
                <ReactQuill
                  value={editedContent}
                  onChange={handleSimpleContentChange}
                  modules={modules}
                  theme="snow"
                  style={{ height: '600px', marginBottom: '50px' }}
                />
              </div>
            )
          ) : (
            viewMode === 'formatted' ? (
              <div className={isMobile ? 'document-editor-wrapper mobile-zoom' : 'document-editor-wrapper'}>
                <DocumentEditor
                  agreement={agreement}
                  isEditing={false}
                  logoUrl="/nova-logo.svg"
                />
              </div>
            ) : (
              <div className="agreement-simple-view">
                <ReactQuill
                  value={agreement.content}
                  readOnly={true}
                  theme="snow"
                  modules={{ toolbar: false }}
                  style={{ height: 'auto' }}
                />
              </div>
            )
          )}
        </div>
      )
    },
    {
      key: 'details',
      label: 'Детали',
      children: (
        <Card>
          <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
            <Descriptions.Item label="Номер договора">{agreement.agreement_number}</Descriptions.Item>
            <Descriptions.Item label="Тип">{getTypeLabel(agreement.type)}</Descriptions.Item>
            <Descriptions.Item label="Статус">{getStatusTag(agreement.status)}</Descriptions.Item>
            {agreement.property_name && (
              <Descriptions.Item label="Объект">
                {agreement.property_name} ({agreement.property_number})
              </Descriptions.Item>
            )}
            {agreement.description && (
              <Descriptions.Item label="Описание" span={2}>{agreement.description}</Descriptions.Item>
            )}
            <Descriptions.Item label="Город">{agreement.city}</Descriptions.Item>
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
            {agreement.rent_amount_monthly && (
              <Descriptions.Item label="Аренда в месяц">
                {agreement.rent_amount_monthly.toLocaleString('ru-RU')} ₿
              </Descriptions.Item>
            )}
            {agreement.deposit_amount && (
              <Descriptions.Item label="Депозит">
                {agreement.deposit_amount.toLocaleString('ru-RU')} ₿
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Создан">
              {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
            </Descriptions.Item>
            {agreement.created_by_name && (
              <Descriptions.Item label="Автор">{agreement.created_by_name}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )
    },
    {
      key: 'parties',
      label: 'Стороны',
      children: (
        <Card>
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
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setSignaturesModalVisible(true)}
              disabled={!agreement.parties || agreement.parties.length === 0}
            >
              {agreement.signatures && agreement.signatures.length > 0 
                ? 'Управление подписями' 
                : 'Отправить на подпись'}
            </Button>
            {agreement.signatures && agreement.signatures.length > 0 && (
              <Tag color={agreement.signatures.every(s => s.is_signed) ? 'success' : 'processing'}>
                Подписано: {agreement.signatures.filter(s => s.is_signed).length} / {agreement.signatures.length}
              </Tag>
            )}
          </Space>

          {agreement.signatures && agreement.signatures.length > 0 ? (
            <Table
              dataSource={agreement.signatures}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 1200 }}
              expandable={
                // ✅ На мобильных отключаем expandable, используем onClick для модального окна
                isMobile ? undefined : {
                  expandedRowRender: (record) => (
                    <SignatureDetailsContent record={record} />
                  ),
                  rowExpandable: () => true,
                }
              }
              onRow={(record) => {
                // ✅ На мобильных добавляем обработчик клика на плюсик
                return isMobile ? {
                  onClick: () => handleSignatureDetailsClick(record),
                } : {};
              }}
              columns={[
                {
                  title: 'Подписант',
                  dataIndex: 'signer_name',
                  key: 'signer_name',
                  width: 200,
                  render: (text, record) => (
                    <Space direction="vertical" size="small">
                      <Text strong>{text}</Text>
                      <Tag color="blue">{record.signer_role}</Tag>
                    </Space>
                  )
                },
                {
                  title: 'Статус',
                  dataIndex: 'is_signed',
                  key: 'is_signed',
                  width: 120,
                  render: (is_signed, record) => (
                    <Space direction="vertical" size="small">
                      <Tag color={is_signed ? 'success' : 'default'} icon={is_signed ? <CheckOutlined /> : null}>
                        {is_signed ? 'Подписано' : 'Ожидает'}
                      </Tag>
                      {is_signed && record.signed_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(record.signed_at).toLocaleDateString('ru-RU')}
                        </Text>
                      )}
                    </Space>
                  )
                },
                {
                  title: 'Устройство',
                  dataIndex: 'device_type',
                  key: 'device_type',
                  width: 120,
                  responsive: ['lg'],
                  render: (device) => device || '-'
                },
                {
                  title: 'IP адрес',
                  dataIndex: 'ip_address',
                  key: 'ip_address',
                  width: 140,
                  responsive: ['lg'],
                  render: (ip) => ip || '-'
                },
                {
                  title: 'Время просмотра',
                  dataIndex: 'agreement_view_duration',
                  key: 'agreement_view_duration',
                  width: 140,
                  responsive: ['xl'],
                  render: (duration) => duration 
                    ? `${Math.floor(duration / 60)} мин ${duration % 60} сек`
                    : '-'
                },
                {
                  title: 'Действия',
                  key: 'actions',
                  width: 80,
                  fixed: 'right',
                  render: (_, record) => (
                    <Dropdown
                      menu={{
                        items: [
                          ...(record.signature_link && !record.is_signed ? [{
                            key: 'copy',
                            icon: <CopyOutlined />,
                            label: 'Копировать ссылку',
                            onClick: () => {
                              navigator.clipboard.writeText(
                                `https://agreement.novaestate.company/sign/${record.signature_link}`
                              );
                              message.success('Ссылка скопирована');
                            }
                          },
                          {
                            key: 'regenerate',
                            icon: <ReloadOutlined />,
                            label: 'Перегенерировать ссылку',
                            onClick: async () => {
                              try {
                                const response = await agreementsApi.regenerateSignatureLink(record.id);
                                message.success('Ссылка перегенерирована');
                                navigator.clipboard.writeText(response.data.data.public_url);
                                fetchAgreement();
                              } catch (error: any) {
                                message.error('Ошибка перегенерации');
                              }
                            }
                          }] : []),
                          {
                            type: 'divider'
                          },
                          {
                            key: 'delete',
                            icon: <DeleteOutlined />,
                            label: 'Удалить',
                            danger: true,
                            onClick: () => {
                              Modal.confirm({
                                title: 'Удалить подпись?',
                                content: 'Это действие нельзя отменить',
                                okText: 'Удалить',
                                okType: 'danger',
                                cancelText: 'Отмена',
                                onOk: async () => {
                                  try {
                                    await agreementsApi.deleteSignature(record.id);
                                    message.success('Подпись удалена');
                                    fetchAgreement();
                                  } catch (error: any) {
                                    message.error('Ошибка удаления');
                                  }
                                }
                              });
                            }
                          }
                        ]
                      }}
                    >
                      <Button size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  )
                }
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
              <div>Подписи не настроены</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Нажмите "Отправить на подпись" для создания подписей
              </div>
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

      {/* ✅ Модальное окно с детальной информацией для мобильных устройств */}
      <Modal
        title="Детальная аналитика подписи"
        open={signatureDetailsModal}
        onCancel={() => {
          setSignatureDetailsModal(false);
          setSelectedSignature(null);
        }}
        footer={null}
        width="95%"
        style={{ top: 20 }}
        bodyStyle={{ 
          maxHeight: 'calc(100vh - 200px)', 
          overflowY: 'auto',
          padding: '16px'
        }}
      >
        {selectedSignature && (
          <SignatureDetailsContent record={selectedSignature} />
        )}
      </Modal>

      <SignaturesModal
        visible={signaturesModalVisible}
        onCancel={() => setSignaturesModalVisible(false)}
        onSuccess={() => {
          fetchAgreement();
          setSignaturesModalVisible(false);
        }}
        agreementId={agreement.id}
        parties={agreement.parties || []}
        existingSignatures={agreement.signatures}
      />
    </div>
  );
};

export default AgreementDetail;