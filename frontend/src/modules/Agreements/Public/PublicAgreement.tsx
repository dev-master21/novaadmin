// frontend/src/modules/Agreements/Public/PublicAgreement.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Button,
  Descriptions,
  Tag,
  Spin,
  message,
  QRCode
} from 'antd';
import {
  DownloadOutlined
} from '@ant-design/icons';
import { agreementsApi, Agreement } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import './PublicAgreement.css';

const PublicAgreement = () => {
  const { link } = useParams<{ link: string }>();
  const printRef = useRef<HTMLDivElement>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);

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
    contentRef: printRef,
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  if (loading) {
    return (
      <div className="public-agreement-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="public-agreement-not-found">
        <h2>Договор не найден</h2>
        <p>Проверьте правильность ссылки</p>
      </div>
    );
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

  return (
    <div className="public-agreement-container">
      <Card className="public-header-card">
        <div className="public-header-content">
          <div className="public-header-info">
            <h1 className="public-agreement-title">Договор {agreement.agreement_number}</h1>
            {getStatusTag(agreement.status)}
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

      {/* Информация о договоре */}
      <Card title="Информация о договоре" className="public-info-card">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Номер договора" span={2}>
            <strong>{agreement.agreement_number}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Город">
            {agreement.city}
          </Descriptions.Item>
          <Descriptions.Item label="Статус">
            {getStatusTag(agreement.status)}
          </Descriptions.Item>
          {agreement.property_name && (
            <Descriptions.Item label="Объект недвижимости" span={2}>
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
          <Descriptions.Item label="Дата создания" span={2}>
            {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>

        {agreement.qr_code_path && (
          <div className="qr-code-section">
            <QRCode value={agreement.public_link} size={150} />
            <p className="qr-code-hint">Сканируйте для быстрого доступа</p>
          </div>
        )}
      </Card>

      {/* Стороны */}
      {agreement.parties && agreement.parties.length > 0 && (
        <Card title="Стороны договора" className="public-parties-card">
          {agreement.parties.map((party, index) => (
            <Card 
              key={index} 
              size="small" 
              className="party-info-card"
            >
              <div className="party-role">
                <Tag color="blue">{party.role}</Tag>
              </div>
              <div className="party-details">
                <div className="party-name"><strong>{party.name}</strong></div>
                <div className="party-passport">
                  Паспорт: {party.passport_country}, {party.passport_number}
                </div>
              </div>
            </Card>
          ))}
        </Card>
      )}

      {/* Статус подписей */}
      {agreement.signatures && agreement.signatures.length > 0 && (
        <Card title="Статус подписей" className="public-signatures-card">
          {agreement.signatures.map((signature, index) => (
            <div key={index} className="signature-item">
              <div className="signature-info">
                <strong>{signature.signer_name}</strong>
                <span className="signature-role">({signature.signer_role})</span>
              </div>
              <Tag color={signature.is_signed ? 'success' : 'default'}>
                {signature.is_signed ? 'Подписано' : 'Ожидает подписи'}
              </Tag>
            </div>
          ))}
        </Card>
      )}

      {/* Документ */}
      <Card title="Документ" className="public-document-card">
        <div className="document-wrapper">
          <DocumentEditor
            ref={printRef}
            agreement={agreement}
            isEditing={false}
            logoUrl="/nova-logo.svg"
          />
        </div>
      </Card>
    </div>
  );
};

export default PublicAgreement;