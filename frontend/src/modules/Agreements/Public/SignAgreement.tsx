// frontend/src/modules/Agreements/Public/SignAgreement.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Button,
  message,
  Spin,
  Alert
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { agreementsApi } from '@/api/agreements.api';
import './SignAgreement.css';

const SignAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const [signatureInfo, setSignatureInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

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
      message.error('Ссылка для подписания не найдена или недействительна');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      // Здесь будет логика подписания с canvas для подписи
      // Пока просто заглушка
      await agreementsApi.signAgreement(link!, {
        signature_data: 'data:image/png;base64,...'
      });
      message.success('Договор успешно подписан');
      fetchSignatureInfo();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка подписания');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="sign-agreement-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!signatureInfo) {
    return (
      <div className="sign-agreement-not-found">
        <h2>Ссылка недействительна</h2>
        <p>Проверьте правильность ссылки для подписания</p>
      </div>
    );
  }

  return (
    <div className="sign-agreement-container">
      <Card title={`Подписание договора ${signatureInfo.contract_number}`}>
        <Alert
          message="Информация о подписанте"
          description={
            <div>
              <p><strong>Имя:</strong> {signatureInfo.signer_name}</p>
              <p><strong>Роль:</strong> {signatureInfo.signer_role}</p>
            </div>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleSign}
          loading={signing}
          size="large"
          block
        >
          Подписать договор
        </Button>
      </Card>
    </div>
  );
};

export default SignAgreement;