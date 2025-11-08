// frontend/src/modules/Agreements/Public/SignAgreement.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  message,
  Spin,
  Checkbox,
  Tag,
  Modal,
  Switch,
  Divider,
  Drawer
} from 'antd';
import {
  CheckOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
  HomeOutlined,
  CalendarOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { agreementsApi } from '@/api/agreements.api';
import SignatureCanvas from 'react-signature-canvas';
import './SignAgreement.css';

const SignAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const sigCanvas = useRef<any>(null);
  
  const [signatureInfo, setSignatureInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [viewAgreementModal, setViewAgreementModal] = useState(false);
  const [detailsDrawer, setDetailsDrawer] = useState(false);
  const [signaturesDrawer, setSignaturesDrawer] = useState(false);
  const [allSignatures, setAllSignatures] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Аналитика
  const [sessionStartTime] = useState(Date.now());
  const [agreementViewStartTime, setAgreementViewStartTime] = useState<number | null>(null);
  const [agreementViewDuration, setAgreementViewDuration] = useState(0);
  const [signatureClearCount, setSignatureClearCount] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (link) {
      fetchSignatureInfo();
    }
  }, [link]);

  // Трекинг времени просмотра договора
  useEffect(() => {
    if (viewAgreementModal && !agreementViewStartTime) {
      setAgreementViewStartTime(Date.now());
    } else if (!viewAgreementModal && agreementViewStartTime) {
      const duration = Date.now() - agreementViewStartTime;
      setAgreementViewDuration(prev => prev + duration);
      setAgreementViewStartTime(null);
    }
  }, [viewAgreementModal]);

  const fetchSignatureInfo = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getSignatureByLink(link!);
      const data = response.data.data;
      setSignatureInfo(data);
      
      // Получаем все подписи для этого договора
      if (data.agreement_id) {
        fetchAllSignatures(data.agreement_id);
      }
    } catch (error: any) {
      message.error('Ссылка для подписания не найдена или больше не действительна');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSignatures = async (agreementId: number) => {
    try {
      const response = await agreementsApi.getById(agreementId);
      setAllSignatures(response.data.data.signatures || []);
    } catch (error) {
      console.error('Error fetching signatures:', error);
    }
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      setSignatureClearCount(prev => prev + 1);
    }
  };

  const handleSign = async () => {
    if (!agreed) {
      message.warning('Необходимо подтвердить ознакомление с договором');
      return;
    }

    if (sigCanvas.current && sigCanvas.current.isEmpty()) {
      message.warning('Пожалуйста, поставьте подпись');
      return;
    }

    setSigning(true);
    try {
      const signatureData = sigCanvas.current.toDataURL();
      const totalSessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000); // в секундах
      
      await agreementsApi.signAgreement(link!, {
        signature_data: signatureData,
        agreement_view_duration: Math.floor(agreementViewDuration / 1000), // в секундах
        signature_clear_count: signatureClearCount,
        total_session_duration: totalSessionDuration
      });
      
      message.success('Договор успешно подписан!');
      
      // Перезагружаем информацию
      setTimeout(() => {
        fetchSignatureInfo();
      }, 1000);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка подписания');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadAgreement = () => {
    message.info('Функция скачивания в разработке');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={`sign-page ${darkMode ? 'dark' : 'light'}`}>
        <div className="sign-loading">
          <Spin size="large" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!signatureInfo) {
    return (
      <div className={`sign-page ${darkMode ? 'dark' : 'light'}`}>
        <div className="sign-not-found">
          <div className="not-found-icon">⚠️</div>
          <h2>Ссылка больше не действительна</h2>
          <p>Проверьте правильность ссылки или обратитесь к отправителю</p>
        </div>
      </div>
    );
  }

  const isSigned = signatureInfo.is_signed;

  return (
    <div className={`sign-page ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <div className="sign-header">
        <div className="sign-header-content">
          <div className="logo">
            <img 
              src="/nova-logo.svg" 
              alt="NOVA Estate" 
              className="logo-image"
              onError={(e) => {
                const target = e.currentTarget;
                const nextSibling = target.nextElementSibling as HTMLElement;
                target.style.display = 'none';
                if (nextSibling) {
                  nextSibling.style.display = 'inline';
                }
              }}
            />
            <span className="logo-text" style={{ display: 'none' }}>NOVA Estate</span>
          </div>
          <div className="theme-toggle">
            <Switch
              checked={darkMode}
              onChange={setDarkMode}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
          </div>
        </div>
      </div>

      <div className="sign-container">
        {/* Main Content */}
        <div className="sign-content">
          {/* Status Card */}
          <div className="glass-card status-card">
            <div className="status-badge">
              {isSigned ? (
                <div className="badge-success">
                  <CheckOutlined /> Подписано
                </div>
              ) : (
                <div className="badge-pending">
                  <ClockIcon /> Ожидает подписи
                </div>
              )}
            </div>
            <h1 className="agreement-title">
              Договор {signatureInfo.agreement_number}
            </h1>
            <div className="signer-info">
              <UserOutlined className="info-icon" />
              <div>
                <div className="info-label">Подписант</div>
                <div className="info-value">{signatureInfo.signer_name}</div>
                <div className="info-role">{signatureInfo.signer_role}</div>
              </div>
            </div>
          </div>

          {/* Quick Info - Desktop only */}
          {!isMobile && (
            <div className="glass-card details-card">
              <h3 className="card-title">
                <FileTextOutlined /> Детали договора
              </h3>
              <div className="details-grid">
                {signatureInfo.property_name && (
                  <div className="detail-item">
                    <HomeOutlined className="detail-icon" />
                    <div>
                      <div className="detail-label">Объект</div>
                      <div className="detail-value">
                        {signatureInfo.property_name}
                        {signatureInfo.property_number && (
                          <span className="detail-sub"> • {signatureInfo.property_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(signatureInfo.date_from || signatureInfo.date_to) && (
                  <div className="detail-item">
                    <CalendarOutlined className="detail-icon" />
                    <div>
                      <div className="detail-label">Период</div>
                      <div className="detail-value">
                        {formatDate(signatureInfo.date_from)} - {formatDate(signatureInfo.date_to)}
                      </div>
                    </div>
                  </div>
                )}

                {signatureInfo.rent_amount_total && (
                  <div className="detail-item">
                    <DollarOutlined className="detail-icon" />
                    <div>
                      <div className="detail-label">Сумма</div>
                      <div className="detail-value">
                        {formatCurrency(signatureInfo.rent_amount_total)}
                      </div>
                    </div>
                  </div>
                )}

                {signatureInfo.deposit_amount && (
                  <div className="detail-item">
                    <DollarOutlined className="detail-icon" />
                    <div>
                      <div className="detail-label">Депозит</div>
                      <div className="detail-value">
                        {formatCurrency(signatureInfo.deposit_amount)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {signatureInfo.utilities_included && (
                <>
                  <Divider style={{ margin: '16px 0' }} />
                  <div className="utilities-section">
                    <div className="detail-label">Включенные услуги</div>
                    <div className="detail-value">{signatureInfo.utilities_included}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile Info Buttons */}
          {isMobile && (
            <div className="glass-card mobile-actions-card">
              <Button
                icon={<InfoCircleOutlined />}
                onClick={() => setDetailsDrawer(true)}
                block
                size="large"
                className="mobile-action-button"
              >
                Детали договора
              </Button>
              <Button
                icon={<TeamOutlined />}
                onClick={() => setSignaturesDrawer(true)}
                block
                size="large"
                className="mobile-action-button"
                style={{ marginTop: 12 }}
              >
                Статус подписей ({allSignatures.filter(s => s.is_signed).length}/{allSignatures.length})
              </Button>
            </div>
          )}

          {/* Signatures Status - Desktop only */}
          {!isMobile && (
            <div className="glass-card signatures-card">
              <h3 className="card-title">
                <CheckOutlined /> Статус подписей
              </h3>
              <div className="signatures-list">
                {allSignatures.map((sig, index) => (
                  <div key={index} className="signature-item">
                    <div className="signature-avatar">
                      {sig.signer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="signature-details">
                      <div className="signature-name">{sig.signer_name}</div>
                      <div className="signature-role">{sig.signer_role}</div>
                    </div>
                    <div className="signature-status">
                      {sig.is_signed ? (
                        <Tag color="success" icon={<CheckOutlined />}>
                          Подписано
                        </Tag>
                      ) : (
                        <Tag color="default">Ожидает</Tag>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Actions */}
          <div className="glass-card actions-card">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => setViewAgreementModal(true)}
              size="large"
              block
              className="action-button view-button"
            >
              Посмотреть договор
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadAgreement}
              size="large"
              block
              className="action-button download-button"
            >
              Скачать договор
            </Button>
          </div>

          {/* Signature Section */}
          {!isSigned ? (
            <div className="glass-card signature-card">
              <h3 className="card-title">
                ✍️ Ваша подпись
              </h3>
              
              <div className="signature-canvas-wrapper">
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{
                    className: 'signature-canvas',
                  }}
                  backgroundColor={darkMode ? '#2a2a2a' : '#ffffff'}
                  penColor={darkMode ? '#ffffff' : '#000000'}
                />
                <div className="canvas-hint">
                  {isMobile ? 'Нарисуйте подпись пальцем' : 'Нарисуйте подпись в этой области'}
                </div>
              </div>

              <Button
                icon={<DeleteOutlined />}
                onClick={clearSignature}
                className="clear-button"
                size="small"
              >
                Очистить
              </Button>

              <Divider style={{ margin: '20px 0' }} />

              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="agreement-checkbox"
              >
                <span className="checkbox-text">
                  Я ознакомился(лась) с договором и согласен(на) с его условиями. 
                  Подтверждаю достоверность предоставленной информации.
                </span>
              </Checkbox>

              <Button
                type="primary"
                size="large"
                icon={<CheckOutlined />}
                onClick={handleSign}
                loading={signing}
                disabled={!agreed}
                block
                className="sign-button"
              >
                Подписать договор
              </Button>
            </div>
          ) : (
            <div className="glass-card signed-card">
              <div className="signed-content">
                <div className="signed-icon">✅</div>
                <h3>Договор успешно подписан</h3>
                <p>Дата подписания: {formatDate(signatureInfo.signed_at)}</p>
                {signatureInfo.signature_data && (
                  <div className="signed-signature">
                    <img src={signatureInfo.signature_data} alt="Signature" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sign-footer">
          <p>© 2024 NOVA Estate. Все права защищены.</p>
        </div>
      </div>

      {/* View Agreement Modal */}
      <Modal
        title={`Договор ${signatureInfo.agreement_number}`}
        open={viewAgreementModal}
        onCancel={() => setViewAgreementModal(false)}
        width={isMobile ? '100%' : 900}
        style={isMobile ? { top: 0, paddingBottom: 0, maxWidth: '100%' } : {}}
        bodyStyle={isMobile ? { height: 'calc(100vh - 110px)', overflow: 'auto' } : {}}
        footer={[
          <Button key="close" onClick={() => setViewAgreementModal(false)}>
            Закрыть
          </Button>,
          <Button 
            key="download" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleDownloadAgreement}
          >
            Скачать
          </Button>
        ]}
        className="agreement-modal"
      >
        <div 
          className="agreement-content"
          dangerouslySetInnerHTML={{ __html: signatureInfo.agreement_content || 'Договор загружается...' }}
        />
      </Modal>

      {/* Mobile Details Drawer */}
      {isMobile && (
        <Drawer
          title="Детали договора"
          placement="bottom"
          height="85vh"
          onClose={() => setDetailsDrawer(false)}
          open={detailsDrawer}
          className={`mobile-drawer ${darkMode ? 'dark' : 'light'}`}
        >
          <div className="drawer-content">
            {signatureInfo.property_name && (
              <div className="drawer-item">
                <HomeOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Объект</div>
                  <div className="drawer-value">
                    {signatureInfo.property_name}
                    {signatureInfo.property_number && (
                      <div className="drawer-sub">{signatureInfo.property_number}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(signatureInfo.date_from || signatureInfo.date_to) && (
              <div className="drawer-item">
                <CalendarOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Период аренды</div>
                  <div className="drawer-value">
                    {formatDate(signatureInfo.date_from)}
                  </div>
                  <div className="drawer-value">
                    {formatDate(signatureInfo.date_to)}
                  </div>
                </div>
              </div>
            )}

            {signatureInfo.rent_amount_total && (
              <div className="drawer-item">
                <DollarOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Общая сумма</div>
                  <div className="drawer-value highlight">
                    {formatCurrency(signatureInfo.rent_amount_total)}
                  </div>
                </div>
              </div>
            )}

            {signatureInfo.rent_amount_monthly && (
              <div className="drawer-item">
                <DollarOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Ежемесячная оплата</div>
                  <div className="drawer-value">
                    {formatCurrency(signatureInfo.rent_amount_monthly)}
                  </div>
                </div>
              </div>
            )}

            {signatureInfo.deposit_amount && (
              <div className="drawer-item">
                <DollarOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Депозит</div>
                  <div className="drawer-value">
                    {formatCurrency(signatureInfo.deposit_amount)}
                  </div>
                </div>
              </div>
            )}

            {signatureInfo.utilities_included && (
              <div className="drawer-item full-width">
                <InfoCircleOutlined className="drawer-icon" />
                <div className="drawer-item-content">
                  <div className="drawer-label">Включенные услуги</div>
                  <div className="drawer-value">{signatureInfo.utilities_included}</div>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Mobile Signatures Drawer */}
      {isMobile && (
        <Drawer
          title="Статус подписей"
          placement="bottom"
          height="70vh"
          onClose={() => setSignaturesDrawer(false)}
          open={signaturesDrawer}
          className={`mobile-drawer ${darkMode ? 'dark' : 'light'}`}
        >
          <div className="drawer-signatures-list">
            {allSignatures.map((sig, index) => (
              <div key={index} className="drawer-signature-item">
                <div className="drawer-signature-avatar">
                  {sig.signer_name.charAt(0).toUpperCase()}
                </div>
                <div className="drawer-signature-info">
                  <div className="drawer-signature-name">{sig.signer_name}</div>
                  <div className="drawer-signature-role">{sig.signer_role}</div>
                  {sig.signed_at && (
                    <div className="drawer-signature-date">
                      {formatDate(sig.signed_at)}
                    </div>
                  )}
                </div>
                <div className="drawer-signature-status">
                  {sig.is_signed ? (
                    <div className="status-badge-success">
                      <CheckOutlined /> Подписано
                    </div>
                  ) : (
                    <div className="status-badge-pending">
                      Ожидает
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </div>
  );
};

// Clock Icon Component
const ClockIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
  </svg>
);

export default SignAgreement;