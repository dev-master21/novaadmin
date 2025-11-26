import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Checkbox, Spin } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { 
  FiCheck, 
  FiClock, 
  FiFileText, 
  FiUsers, 
  FiEdit3,
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiLoader
} from 'react-icons/fi';
import styled from 'styled-components';
import { agreementsApi } from '@/api/agreements.api';

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  background: #ffffff;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const Header = styled.header`
  background: white;
  border-bottom: 1px solid #e8e8e8;
  padding: 24px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const HeaderContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Logo = styled.img`
  height: 72px;
  filter: brightness(0);
  
  @media (max-width: 768px) {
    height: 56px;
  }
`;

const MainContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 48px 24px;
  
  @media (max-width: 768px) {
    padding: 24px 16px;
  }
`;

const Card = styled(motion.div)`
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  
  @media (max-width: 768px) {
    padding: 20px;
    margin-bottom: 16px;
  }
`;

const CardTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    color: #666;
  }
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const InfoLabel = styled.span`
  font-size: 13px;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InfoValue = styled.span`
  font-size: 16px;
  color: #1a1a1a;
  font-weight: 500;
`;

const SignersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
`;

const SignerItem = styled.div<{ isCurrent?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: ${props => props.isCurrent ? '#f0f7ff' : '#fafafa'};
  border: 1px solid ${props => props.isCurrent ? '#4096ff' : '#e8e8e8'};
  border-radius: 8px;
  transition: all 0.2s;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const SignerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SignerName = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #1a1a1a;
`;

const SignerRole = styled.div`
  font-size: 13px;
  color: #666;
  text-transform: capitalize;
`;

const StatusBadge = styled.div<{ status: 'signed' | 'pending' | 'current' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  
  ${props => {
    if (props.status === 'signed') {
      return `
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      `;
    } else if (props.status === 'current') {
      return `
        background: #f0f7ff;
        color: #4096ff;
        border: 1px solid #bae0ff;
      `;
    } else {
      return `
        background: #fafafa;
        color: #666;
        border: 1px solid #e8e8e8;
      `;
    }
  }}
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Button = styled(motion.button)<{ variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  
  ${props => props.variant === 'primary' ? `
    background: #4096ff;
    color: white;
    
    &:hover {
      background: #1677ff;
    }
    
    &:disabled {
      background: #d9d9d9;
      cursor: not-allowed;
    }
  ` : `
    background: white;
    color: #1a1a1a;
    border: 1px solid #e8e8e8;
    
    &:hover {
      border-color: #4096ff;
      color: #4096ff;
    }
  `}
  
  @media (max-width: 768px) {
    padding: 12px 20px;
  }
`;

const SignButton = styled(Button)`
  background: #52c41a;
  
  &:hover {
    background: #389e0d;
  }
  
  &:disabled {
    background: #d9d9d9;
  }
`;

const SignatureSection = styled.div`
  margin-top: 24px;
`;

const CanvasContainer = styled.div`
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: #fafafa;
  
  canvas {
    display: block;
    width: 100%;
    height: 200px;
  }
`;

const CanvasControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
`;

const ClearButton = styled.button`
  padding: 8px 16px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #ff4d4f;
    color: #ff4d4f;
  }
`;

const SignatureHint = styled.div`
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const AgreementCheckbox = styled.div`
  margin: 24px 0;
  padding: 20px;
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  border-radius: 8px;
  
  .ant-checkbox-wrapper {
    font-size: 14px;
    color: #1a1a1a;
    
    .ant-checkbox-inner {
      width: 20px;
      height: 20px;
    }
  }
`;

const AlertBox = styled.div<{ type: 'info' | 'error' | 'success' }>`
  padding: 16px;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
  
  ${props => {
    if (props.type === 'success') {
      return `
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #16a34a;
      `;
    } else if (props.type === 'error') {
      return `
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
      `;
    } else {
      return `
        background: #f0f7ff;
        border: 1px solid #bae0ff;
        color: #1677ff;
      `;
    }
  }}
  
  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
`;

// Модальное окно процесса подписания
const SigningModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
`;

const SigningCard = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

const SigningTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 24px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 20px;
  }
`;

const SigningSteps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StepItem = styled(motion.div)<{ isActive: boolean; isCompleted: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: ${props => props.isActive ? '#f0f7ff' : props.isCompleted ? '#f0fdf4' : '#fafafa'};
  border: 1px solid ${props => props.isActive ? '#4096ff' : props.isCompleted ? '#52c41a' : '#e8e8e8'};
  border-radius: 8px;
  transition: all 0.3s;
`;

const StepIcon = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props => props.isActive ? '#4096ff' : props.isCompleted ? '#52c41a' : '#d9d9d9'};
  color: white;
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const StepText = styled.div<{ isActive: boolean }>`
  font-size: 15px;
  font-weight: ${props => props.isActive ? '600' : '400'};
  color: ${props => props.isActive ? '#1a1a1a' : '#666'};
  flex: 1;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  margin-top: 24px;
  overflow: hidden;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, #4096ff 0%, #52c41a 100%);
  border-radius: 3px;
`;

// Component
const SignAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const navigate = useNavigate();
  const sigPadRef = useRef<SignatureCanvas>(null);
  
  const [agreement, setAgreement] = useState<any>(null);
  const [currentSigner, setCurrentSigner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Процесс подписания
  const [showSigningProcess, setShowSigningProcess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [signingCompleted, setSigningCompleted] = useState(false);

  // Этапы подписания
  const signingSteps = [
    { text: 'Проверяем подпись...', duration: 2500 },
    { text: 'Сохраняем данные договора...', duration: 2500 },
    { text: 'Генерируем подписанный PDF...', duration: 12000 }, // Основное время
    { text: 'Обновляем статус договора...', duration: 2000 },
    { text: 'Завершаем оформление...', duration: 2000 },
  ];

  // Трекинг
  const [pageLoadTime] = useState(Date.now());
  const [signatureClearCount, setSignatureClearCount] = useState(0);

  useEffect(() => {
    if (link) {
      fetchSignatureData();
    }
  }, [link]);

  const fetchSignatureData = async () => {
    try {
      const response = await agreementsApi.getSignatureByLink(link!);
      const signerData = response.data.data;
      
      // Получаем полные данные договора
      const agreementResponse = await agreementsApi.getPublicAgreementByLink(link!);
      const agreementData = agreementResponse.data.data;
      
      setAgreement(agreementData);
      setCurrentSigner(signerData);
      
      if (signerData.is_signed) {
        message.info('Вы уже подписали этот договор');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      message.error(error.response?.data?.message || 'Ошибка загрузки данных');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setSignatureClearCount(prev => prev + 1);
    }
  };

  // ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ - напрямую скачивает файл без blob URL
  const handleViewPDF = () => {
    if (!link) return;

    try {
      // Формируем прямую ссылку на скачивание PDF
      const downloadUrl = `/api/agreements/download-pdf/${link}`;
      
      // Создаем невидимую ссылку и кликаем по ней для скачивания
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${agreement?.agreement_number || 'agreement'}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      message.success('Скачивание договора начато');
    } catch (error) {
      message.error('Ошибка скачивания PDF');
    }
  };

const handleSign = async () => {
    if (!agreed) {
      message.warning('Пожалуйста, подтвердите согласие с условиями договора');
      return;
    }

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      message.warning('Пожалуйста, поставьте вашу подпись');
      return;
    }

    setSigning(true);
    setShowSigningProcess(true);
    setCurrentStep(0);
    setSigningCompleted(false);

    try {
      const signatureData = sigPadRef.current.toDataURL('image/png');
      
      // Вычисляем общее время на странице
      const totalSessionDuration = Math.floor((Date.now() - pageLoadTime) / 1000);

      // ✅ ПРАВИЛЬНАЯ логика показа этапов - каждый этап со своей длительностью
      let currentStepIndex = 0;
      let serverResponseReceived = false;

      const showNextStep = () => {
        if (serverResponseReceived) return; // Если сервер уже ответил - прекращаем

        if (currentStepIndex < signingSteps.length - 1) {
          currentStepIndex++;
          setCurrentStep(currentStepIndex);
          
          // Планируем следующий этап с соответствующей задержкой
          setTimeout(showNextStep, signingSteps[currentStepIndex].duration);
        } else {
          // Если этапы закончились, а сервер еще не ответил - крутим последний
          setTimeout(showNextStep, 2000);
        }
      };

      // Запускаем первый этап
      setTimeout(showNextStep, signingSteps[0].duration);

      // Отправляем запрос на подписание (параллельно с показом этапов)
      await agreementsApi.signAgreement(currentSigner.id, {
        signature_data: signatureData,
        signature_clear_count: signatureClearCount,
        total_session_duration: totalSessionDuration
      });

      // Отмечаем что получили ответ
      serverResponseReceived = true;
      setSigningCompleted(true);
      setCurrentStep(signingSteps.length); // Переходим к финальному этапу

      // Показываем успех
      setTimeout(() => {
        message.success('Договор успешно подписан!');
        setShowSigningProcess(false);
        
        setTimeout(() => {
          fetchSignatureData();
        }, 1000);
      }, 1500);

    } catch (error: any) {
      setShowSigningProcess(false);
      message.error(error.response?.data?.message || 'Ошибка подписания договора');
    } finally {
      setSigning(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    return `${amount.toLocaleString('ru-RU')} ฿`;
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spin size="large" />
      </LoadingContainer>
    );
  }

  if (!agreement || !currentSigner) {
    return null;
  }

  const otherSigners = agreement.signatures?.filter((s: any) => s.id !== currentSigner.id) || [];

  // Вычисляем прогресс
  const progress = signingCompleted 
    ? 100 
    : (currentStep / signingSteps.length) * 100;

  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <Logo src="https://admin.novaestate.company/nova-logo.svg" alt="NOVA Estate" />
        </HeaderContent>
      </Header>

      <MainContent>
        <AnimatePresence mode="wait">
          {currentSigner.is_signed ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertBox type="success">
                <FiCheckCircle size={20} />
                <div>
                  <strong>Договор успешно подписан!</strong>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Вы подписали договор {new Date(currentSigner.signed_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </AlertBox>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertBox type="info">
                <FiAlertCircle size={20} />
                <div>
                  <strong>Требуется ваша подпись</strong>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Пожалуйста, внимательно ознакомьтесь с договором и поставьте вашу подпись
                  </div>
                </div>
              </AlertBox>
            </motion.div>
          )}

          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CardTitle>
              <FiFileText size={20} />
              Информация о договоре
            </CardTitle>

            <InfoGrid>
              {agreement.agreement_number && (
                <InfoItem>
                  <InfoLabel>Номер договора</InfoLabel>
                  <InfoValue>{agreement.agreement_number}</InfoValue>
                </InfoItem>
              )}

              {agreement.property_name && (
                <InfoItem>
                  <InfoLabel>Объект</InfoLabel>
                  <InfoValue>
                    {agreement.property_name}
                    {agreement.property_number && ` (${agreement.property_number})`}
                  </InfoValue>
                </InfoItem>
              )}

              {agreement.date_from && (
                <InfoItem>
                  <InfoLabel>Дата начала</InfoLabel>
                  <InfoValue>
                    {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
                  </InfoValue>
                </InfoItem>
              )}

              {agreement.date_to && (
                <InfoItem>
                  <InfoLabel>Дата окончания</InfoLabel>
                  <InfoValue>
                    {new Date(agreement.date_to).toLocaleDateString('ru-RU')}
                  </InfoValue>
                </InfoItem>
              )}

              {agreement.created_at && (
                <InfoItem>
                  <InfoLabel>Дата создания</InfoLabel>
                  <InfoValue>
                    {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
                  </InfoValue>
                </InfoItem>
              )}

              {(agreement.rent_amount_monthly || agreement.rent_amount_total) && (
                <InfoItem>
                  <InfoLabel>Сумма</InfoLabel>
                  <InfoValue>
                    {formatCurrency(agreement.rent_amount_total || agreement.rent_amount_monthly)}
                  </InfoValue>
                </InfoItem>
              )}

              {agreement.deposit_amount && (
                <InfoItem>
                  <InfoLabel>Депозит</InfoLabel>
                  <InfoValue>
                    {formatCurrency(agreement.deposit_amount)}
                  </InfoValue>
                </InfoItem>
              )}
            </InfoGrid>

            <ButtonGroup>
              <Button variant="primary" onClick={handleViewPDF}>
                <FiDownload size={18} />
                Скачать договор (PDF)
              </Button>
            </ButtonGroup>
          </Card>

          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CardTitle>
              <FiUsers size={20} />
              Подписанты
            </CardTitle>

            <SignersList>
              <SignerItem isCurrent>
                <SignerInfo>
                  <div>
                    <SignerName>{currentSigner.signer_name} (Вы)</SignerName>
                    <SignerRole>{currentSigner.signer_role}</SignerRole>
                  </div>
                </SignerInfo>
                <StatusBadge status={currentSigner.is_signed ? 'signed' : 'current'}>
                  {currentSigner.is_signed ? (
                    <>
                      <FiCheck size={14} />
                      Подписано
                    </>
                  ) : (
                    <>
                      <FiEdit3 size={14} />
                      Ожидает подписи
                    </>
                  )}
                </StatusBadge>
              </SignerItem>

              {otherSigners.map((signer: any) => (
                <SignerItem key={signer.id}>
                  <SignerInfo>
                    <div>
                      <SignerName>{signer.signer_name}</SignerName>
                      <SignerRole>{signer.signer_role}</SignerRole>
                    </div>
                  </SignerInfo>
                  <StatusBadge status={signer.is_signed ? 'signed' : 'pending'}>
                    {signer.is_signed ? (
                      <>
                        <FiCheck size={14} />
                        Подписано
                      </>
                    ) : (
                      <>
                        <FiClock size={14} />
                        Ожидает
                      </>
                    )}
                  </StatusBadge>
                </SignerItem>
              ))}
            </SignersList>
          </Card>

          {!currentSigner.is_signed && (
            <Card
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <CardTitle>
                <FiEdit3 size={20} />
                Ваша подпись
              </CardTitle>

              <SignatureSection>
                <CanvasContainer>
                  <SignatureCanvas
                    ref={sigPadRef}
                    canvasProps={{
                      style: { 
                        width: '100%', 
                        height: '200px',
                        border: 'none'
                      }
                    }}
                    backgroundColor="#fafafa"
                    penColor="#000000"
                  />
                </CanvasContainer>

                <CanvasControls>
                  <SignatureHint>
                    <FiEdit3 size={14} />
                    Поставьте вашу подпись в поле выше
                  </SignatureHint>
                  <ClearButton onClick={clearSignature}>
                    Очистить
                  </ClearButton>
                </CanvasControls>
              </SignatureSection>

              <AgreementCheckbox>
                <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
                  Я ознакомился(лась) с договором и согласен(на) с его условиями
                </Checkbox>
              </AgreementCheckbox>

              <SignButton
                variant="primary"
                onClick={handleSign}
                disabled={!agreed || signing}
                whileTap={{ scale: 0.98 }}
                style={{ width: '100%' }}
              >
                {signing ? (
                  <>
                    <Spin size="small" />
                    Подписание...
                  </>
                ) : (
                  <>
                    <FiCheck size={18} />
                    Подписать договор
                  </>
                )}
              </SignButton>
            </Card>
          )}
        </AnimatePresence>
      </MainContent>

      {/* Модальное окно процесса подписания */}
      <AnimatePresence>
        {showSigningProcess && (
          <SigningModal>
            <SigningCard
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <SigningTitle>
                {signingCompleted ? 'Договор подписан!' : 'Подписание договора'}
              </SigningTitle>

              <SigningSteps>
                {signingSteps.map((step, index) => (
                  <StepItem
                    key={index}
                    isActive={currentStep === index && !signingCompleted}
                    isCompleted={currentStep > index || signingCompleted}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <StepIcon
                      isActive={currentStep === index && !signingCompleted}
                      isCompleted={currentStep > index || signingCompleted}
                    >
                      {currentStep > index || signingCompleted ? (
                        <FiCheck />
                      ) : currentStep === index ? (
                        <FiLoader className="spinning-icon" />
                      ) : (
                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{index + 1}</div>
                      )}
                    </StepIcon>
                    <StepText isActive={currentStep === index && !signingCompleted}>
                      {step.text}
                    </StepText>
                  </StepItem>
                ))}

                {signingCompleted && (
                  <StepItem
                    isActive={false}
                    isCompleted={true}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <StepIcon isActive={false} isCompleted={true}>
                      <FiCheckCircle />
                    </StepIcon>
                    <StepText isActive={true}>
                      Готово! Договор успешно подписан
                    </StepText>
                  </StepItem>
                )}
              </SigningSteps>

              <ProgressBar>
                <ProgressFill
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </ProgressBar>
            </SigningCard>
          </SigningModal>
        )}
      </AnimatePresence>

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          
          .spinning-icon {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </PageContainer>
  );
};

export default SignAgreement;