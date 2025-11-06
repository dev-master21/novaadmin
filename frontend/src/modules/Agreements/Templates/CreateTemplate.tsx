// frontend/src/modules/Agreements/Templates/CreateTemplate.tsx
import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agreementsApi } from '@/api/agreements.api';
import DocumentEditor from '../components/DocumentEditor';

const { Option } = Select;

const CreateTemplate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!content || content.trim() === '') {
        message.error('Содержимое шаблона не может быть пустым');
        return;
      }

      setLoading(true);

      await agreementsApi.createTemplate({
        name: values.name,
        type: values.type,
        content: content,
        structure: undefined // Можно добавить поддержку структуры позже
      });

      message.success('Шаблон успешно создан');
      navigate('/agreements/templates');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка создания шаблона');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/agreements/templates')}
            >
              Назад
            </Button>
            <FileTextOutlined />
            <span>Создание шаблона</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={handleSubmit}
          >
            Сохранить шаблон
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Название шаблона"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например: Договор аренды виллы" size="large" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Тип договора"
            rules={[{ required: true, message: 'Выберите тип' }]}
          >
            <Select placeholder="Выберите тип договора" size="large">
              <Option value="rent">Договор аренды</Option>
              <Option value="sale">Договор купли-продажи</Option>
              <Option value="bilateral">Двухсторонний договор</Option>
              <Option value="trilateral">Трёхсторонний договор</Option>
              <Option value="agency">Агентский договор</Option>
              <Option value="transfer_act">Акт приёма-передачи</Option>
            </Select>
          </Form.Item>
        </Form>

        <Divider>Содержимое шаблона</Divider>

        <DocumentEditor
          initialContent={content}
          onChange={setContent}
        />

        <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <strong>Доступные переменные:</strong>
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            {'{{agreement_number}}'}, {'{{date}}'}, {'{{city}}'}, {'{{landlord_name}}'}, 
            {'{{tenant_name}}'}, {'{{property_name}}'}, {'{{property_address}}'}, 
            {'{{date_from}}'}, {'{{date_to}}'}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CreateTemplate;