// frontend/src/modules/Agreements/Templates/TemplateDetail.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  message,
  Spin
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import './TemplateDetail.css';

const TemplateDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<AgreementTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTemplate();
    }
  }, [id]);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getTemplateById(Number(id));
      setTemplate(response.data.data);
    } catch (error: any) {
      message.error(t('templateDetail.errors.loadFailed'));
      navigate('/agreements/templates');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: template?.name || 'template'
  });

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  const getTypeTag = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      rent: { color: 'blue', text: t('templateDetail.types.rent') },
      sale: { color: 'green', text: t('templateDetail.types.sale') },
      bilateral: { color: 'purple', text: t('templateDetail.types.bilateral') },
      trilateral: { color: 'orange', text: t('templateDetail.types.trilateral') },
      agency: { color: 'pink', text: t('templateDetail.types.agency') },
      transfer_act: { color: 'cyan', text: t('templateDetail.types.transferAct') }
    };
    
    const config = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div className="template-detail-container">
      <Card className="template-header-card">
        <div className="template-header-content">
          <div className="template-header-left">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/agreements/templates')}
            >
              {t('templateDetail.actions.back')}
            </Button>
            <div className="template-title-section">
              <h2 className="template-title">{template.name}</h2>
              {getTypeTag(template.type)}
              <Tag color={template.is_active ? 'success' : 'default'}>
                {template.is_active ? t('templateDetail.status.active') : t('templateDetail.status.inactive')}
              </Tag>
            </div>
          </div>
          
          <Space>
            <Button 
              icon={<EditOutlined />}
              onClick={() => navigate(`/agreements/templates/${id}/edit`)}
            >
              {t('templateDetail.actions.edit')}
            </Button>
            <Button 
              icon={<DownloadOutlined />}
              onClick={handlePrint}
            >
              {t('templateDetail.actions.pdf')}
            </Button>
          </Space>
        </div>
      </Card>

      <Card title={t('templateDetail.infoCard.title')} className="template-info-card">
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label={t('templateDetail.fields.name')} span={2}>
            <strong>{template.name}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('templateDetail.fields.type')}>
            {getTypeTag(template.type)}
          </Descriptions.Item>
          <Descriptions.Item label={t('templateDetail.fields.version')}>
            {template.version}
          </Descriptions.Item>
          <Descriptions.Item label={t('templateDetail.fields.used')}>
            {t('templateDetail.fields.usedCount', { count: template.usage_count || 0 })}
          </Descriptions.Item>
          <Descriptions.Item label={t('templateDetail.fields.created')}>
            {new Date(template.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
          {template.created_by_name && (
            <Descriptions.Item label={t('templateDetail.fields.createdBy')} span={2}>
              {template.created_by_name}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title={t('templateDetail.preview.title')} className="template-document-card">
        <DocumentEditor
          ref={printRef}
          template={template}
          isEditing={false}
          logoUrl="/nova-logo.svg"
        />
      </Card>
    </div>
  );
};

export default TemplateDetail;