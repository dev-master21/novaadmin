// frontend/src/modules/Agreements/Public/SignAgreement.tsx
import { useState, useEffect, useRef } from 'react';
import { Card, Button, Spin, message, Modal } from 'antd';
import { CheckOutlined, EditOutlined, ClearOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { agreementsApi } from '@/api/agreements.api';
import SignatureCanvas from 'react-signature-canvas';
import './SignAgreement.css';

const SignAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const navigate = useNavigate();
  const [signatureInfo, setSignatureInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (link) {
      fetchSignatureInfo();
    }
  }, [link]);

  const fetchSignatureInfo = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getSignatureByLink(link!);
      setSignatureInfo(response.data.data);
    } catch (error: any) {
      message.error('Ссылка для подписи не найдена или уже использована');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      message.error('Пожалуйста, поставьте подпись');
      return;
    }

    setSigning(true);
    try {
      const signatureData = signatureRef.current.toDataURL();
      
      await agreementsApi.signAgreement(link!, { signature_data: signatureData });
      
      message.success('Договор успешно подписан!');
      setShowSignModal(false);
      
      // Перенаправляем на страницу просмотра договора
      const agreementLink = signatureInfo.public_link.split('/').pop();
      setTimeout(() => {
        navigate(`/agreement/${agreementLink}`);
      }, 1500);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка при подписании');
    } finally {
      setSigning(false);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  if (loading) {
    return (
      <div className="sign-agreement-container">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#999' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!signatureInfo) {
    return (
      <div className="sign-agreement-container">
        <Card style={{ textAlign: 'center', padding: '50px 0' }}>
          <h2>Ссылка недействительна</h2>
          <p style={{ color: '#999' }}>
            Эта ссылка для подписи не найдена или уже была использована
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="sign-agreement-container">
      <Card
        title={`Подписание договора: ${signatureInfo.agreement_number}`}
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 24 }}>
          <p><strong>Подписант:</strong> {signatureInfo.signer_name}</p>
          <p><strong>Роль:</strong> {signatureInfo.signer_role}</p>
          <p><strong>Договор:</strong> {signatureInfo.agreement_number}</p>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<EditOutlined />}
          onClick={() => setShowSignModal(true)}
          block
        >
          Поставить подпись
        </Button>
      </Card>

      <Card title="Документ">
        <div
          className="agreement-content"
          dangerouslySetInnerHTML={{ __html: signatureInfo.agreement_content }}
        />
      </Card>

      {/* Модальное окно для подписи */}
      <Modal
        title="Поставьте вашу подпись"
        open={showSignModal}
        onCancel={() => setShowSignModal(false)}
        footer={[
          <Button key="clear" onClick={clearSignature} icon={<ClearOutlined />}>
            Очистить
          </Button>,
          <Button key="cancel" onClick={() => setShowSignModal(false)}>
            Отмена
          </Button>,
          <Button
            key="sign"
            type="primary"
            loading={signing}
            onClick={handleSign}
            icon={<CheckOutlined />}
          >
            Подписать
          </Button>
        ]}
        width={700}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              border: '2px dashed #d9d9d9',
              borderRadius: 4,
              padding: 8,
              background: '#fafafa'
            }}
          >
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                width: 650,
                height: 200,
                className: 'signature-canvas'
              }}
            />
          </div>
          <p style={{ marginTop: 16, color: '#999', fontSize: '12px' }}>
            Нарисуйте вашу подпись в поле выше используя мышь или сенсорный экран
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default SignAgreement;