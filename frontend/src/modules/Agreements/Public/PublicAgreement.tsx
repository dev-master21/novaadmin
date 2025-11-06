// frontend/src/modules/Agreements/Public/PublicAgreement.tsx
import { useState, useEffect, useRef } from 'react';
import { Card, Button, Spin, message, Tag, Descriptions, QRCode } from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import './PublicAgreement.css';

const PublicAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (link) {
      fetchAgreement();
    }
  }, [link]);

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getByPublicLink(link!);
      setAgreement(response.data.data);
    } catch (error: any) {
      message.error('Договор не найден');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef, // ИСПРАВЛЕНО: используем contentRef вместо content
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  if (loading) {
    return (
      <div className="public-agreement-container">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#999' }}>Загрузка договора...</p>
        </div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="public-agreement-container">
        <Card style={{ textAlign: 'center', padding: '50px 0' }}>
          <FileTextOutlined style={{ fontSize: 64, color: '#999' }} />
          <h2>Договор не найден</h2>
          <p style={{ color: '#999' }}>Проверьте правильность ссылки</p>
        </Card>
      </div>
    );
  }

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: 'Черновик' },
      pending_signatures: { color: 'processing', text: 'Ожидает подписей' },
      signed: { color: 'success', text: 'Подписан' },
      active: { color: 'cyan', text: 'Активен' },
      expired: { color: 'warning', text: 'Истёк' },
      cancelled: { color: 'error', text: 'Отменён' }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div className="public-agreement-container">
      {/* Заголовок */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{agreement.agreement_number}</h1>
            <div style={{ marginTop: 8 }}>
              {getStatusTag(agreement.status)}
            </div>
          </div>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handlePrint}
            size="large"
          >
            Скачать PDF
          </Button>
        </div>
      </Card>

      {/* Информация */}
      <Card title="Информация о договоре" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="Номер">
            {agreement.agreement_number}
          </Descriptions.Item>
          <Descriptions.Item label="Город">
            {agreement.city}
          </Descriptions.Item>
          {agreement.property_name && (
            <>
              <Descriptions.Item label="Объект недвижимости" span={2}>
                <div>
                  {agreement.property_name}
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {agreement.property_number}
                  </div>
                </div>
              </Descriptions.Item>
            </>
          )}
          {agreement.date_from && (
            <Descriptions.Item label="Период">
              {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
              {' - '}
              {agreement.date_to ? new Date(agreement.date_to).toLocaleDateString('ru-RU') : '...'}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Создан">
            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>

        {agreement.qr_code_path && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <QRCode value={agreement.public_link} size={150} />
            <p style={{ marginTop: 8, color: '#999', fontSize: '12px' }}>
              Сканируйте для быстрого доступа
            </p>
          </div>
        )}
      </Card>

      {/* Стороны */}
      {agreement.parties && agreement.parties.length > 0 && (
        <Card title="Стороны договора" style={{ marginBottom: 16 }}>
          {agreement.parties.map((party, index) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <strong>{party.role}:</strong> {party.name}
              <br />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Паспорт: {party.passport_country}, {party.passport_number}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Подписи */}
      {agreement.signatures && agreement.signatures.length > 0 && (
        <Card title="Статус подписей" style={{ marginBottom: 16 }}>
          {agreement.signatures.map((signature, index) => (
            <div key={index} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{signature.signer_name}</strong> ({signature.signer_role})
              </div>
              <Tag color={signature.is_signed ? 'success' : 'default'}>
                {signature.is_signed ? 'Подписано' : 'Ожидает подписи'}
              </Tag>
            </div>
          ))}
        </Card>
      )}

      {/* Документ */}
      <Card title="Документ">
        <div ref={printRef} className="agreement-document">
          <div dangerouslySetInnerHTML={{ __html: agreement.content }} />
        </div>
      </Card>
    </div>
  );
};

export default PublicAgreement;