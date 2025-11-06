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
import { agreementsApi, AgreementTemplate } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import './TemplateDetail.css';

const TemplateDetail = () => {
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
      message.error('Ошибка загрузки шаблона');
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
      rent: { color: 'blue', text: 'Аренда' },
      sale: { color: 'green', text: 'Купля-продажа' },
      bilateral: { color: 'purple', text: 'Двухсторонний' },
      trilateral: { color: 'orange', text: 'Трёхсторонний' },
      agency: { color: 'pink', text: 'Агентский' },
      transfer_act: { color: 'cyan', text: 'Акт передачи' }
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
              Назад
            </Button>
            <div className="template-title-section">
              <h2 className="template-title">{template.name}</h2>
              {getTypeTag(template.type)}
              <Tag color={template.is_active ? 'success' : 'default'}>
                {template.is_active ? 'Активен' : 'Неактивен'}
              </Tag>
            </div>
          </div>
          
          <Space>
            <Button 
              icon={<EditOutlined />}
              onClick={() => navigate(`/agreements/templates/${id}/edit`)}
            >
              Редактировать
            </Button>
            <Button 
              icon={<DownloadOutlined />}
              onClick={handlePrint}
            >
              PDF
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="Информация о шаблоне" className="template-info-card">
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Название" span={2}>
            <strong>{template.name}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Тип">
            {getTypeTag(template.type)}
          </Descriptions.Item>
          <Descriptions.Item label="Версия">
            {template.version}
          </Descriptions.Item>
          <Descriptions.Item label="Использован">
            {template.usage_count || 0} раз
          </Descriptions.Item>
          <Descriptions.Item label="Создан">
            {new Date(template.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
          {template.created_by_name && (
            <Descriptions.Item label="Создал" span={2}>
              {template.created_by_name}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Предварительный просмотр" className="template-document-card">
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