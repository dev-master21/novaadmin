import { useState } from 'react';
import { Modal, Form, Input, Upload, Button, message, Alert, Space } from 'antd';
import { UploadOutlined, CheckCircleOutlined, FileTextOutlined, HomeOutlined, DollarOutlined, CalendarOutlined, IdcardOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { requestsApi } from '@/api/requests.api';
import './ContractRequestModal.css';

interface ContractRequestModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  requestUuid: string;
}

const ContractRequestModal: React.FC<ContractRequestModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  requestUuid
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [clientPassportFront, setClientPassportFront] = useState<UploadFile[]>([]);
  const [agentPassportFront, setAgentPassportFront] = useState<UploadFile[]>([]);

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      
      // Проверяем загруженные файлы
      if (clientPassportFront.length === 0) {
        message.error('Загрузите паспорт клиента');
        return;
      }

      if (agentPassportFront.length === 0) {
        message.error('Загрузите паспорт агента');
        return;
      }

      // Проверяем что файлы успешно загружены
      if (!clientPassportFront[0].response?.data?.path) {
        message.error('Паспорт клиента не загружен. Попробуйте еще раз.');
        return;
      }

      if (!agentPassportFront[0].response?.data?.path) {
        message.error('Паспорт агента не загружен. Попробуйте еще раз.');
        return;
      }

      const values = form.getFieldsValue();

      setLoading(true);

      const response = await requestsApi.requestContract(requestUuid, {
        rental_dates: values.rental_dates,
        villa_name_address: values.villa_name_address,
        rental_cost: values.rental_cost,
        cost_includes: values.cost_includes || '',
        utilities_cost: values.utilities_cost || '',
        payment_terms: values.payment_terms || '',
        deposit_amount: values.deposit_amount || '',
        additional_terms: values.additional_terms || '',
        client_passport_front: clientPassportFront[0].response.data.path,
        client_passport_back: clientPassportFront[0].response.data.path,
        agent_passport_front: agentPassportFront[0].response.data.path,
        agent_passport_back: agentPassportFront[0].response.data.path
      });

      message.success(response.data.message || 'Запрос отправлен успешно');
      form.resetFields();
      setClientPassportFront([]);
      setAgentPassportFront([]);
      onSuccess();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.errorFields) {
        message.error('Заполните все обязательные поля');
      } else {
        message.error('Ошибка при отправке запроса');
      }
    } finally {
      setLoading(false);
    }
  };

    const uploadProps: UploadProps = {
      action: `/api/requests/public/${requestUuid}/upload-passport`,
      name: 'file',
      accept: 'image/*',
      maxCount: 1,
      listType: 'picture-card',
      beforeUpload: (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          message.error('Можно загружать только изображения');
        }
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
          message.error('Размер файла не должен превышать 5MB');
        }
        return isImage && isLt5M;
      },
      onChange: (info) => {
        if (info.file.status === 'error') {
          message.error(`Ошибка загрузки файла ${info.file.name}`);
        } else if (info.file.status === 'done') {
          message.success(`Файл ${info.file.name} загружен успешно`);
        }
      }
    };

  const isFormValid = () => {
    const values = form.getFieldsValue();
    const hasAllFields = 
      values.rental_dates &&
      values.villa_name_address &&
      values.rental_cost;
    
    const hasPassports = 
      clientPassportFront.length > 0 &&
      agentPassportFront.length > 0 &&
      clientPassportFront[0].status === 'done' &&
      agentPassportFront[0].status === 'done';
    
    return hasAllFields && hasPassports;
  };

  return (
    <Modal
      title={
        <div className="contract-modal-title">
          <FileTextOutlined />
          <span>Запросить создание договора</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      className="contract-request-modal"
      footer={[
        <Button key="cancel" onClick={onCancel} className="modal-cancel-btn">
          Отмена
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          disabled={!isFormValid()}
          className="modal-submit-btn"
        >
          Отправить запрос
        </Button>
      ]}
    >
      <Alert
        message="Важно!"
        description="Для отправки запроса необходимо заполнить все обязательные поля (отмечены звездочкой) и загрузить фотографии паспортов."
        type="info"
        showIcon
        className="contract-alert"
      />

      <Form
        form={form}
        layout="vertical"
        className="contract-form"
        onValuesChange={() => {
          form.validateFields().catch(() => {});
        }}
      >
        <div className="form-section">
          <h3 className="section-title">
            <HomeOutlined />
            Данные для договора
          </h3>

          <Form.Item
            name="rental_dates"
            label={
              <span className="form-label">
                <CalendarOutlined />
                Даты аренды <span className="required">*</span>
              </span>
            }
            rules={[{ required: true, message: 'Укажите даты аренды' }]}
          >
            <Input placeholder="Например: 01.01.2025 - 31.01.2025" className="form-input" />
          </Form.Item>

          <Form.Item
            name="villa_name_address"
            label={
              <span className="form-label">
                <HomeOutlined />
                Название виллы и адрес <span className="required">*</span>
              </span>
            }
            rules={[{ required: true, message: 'Укажите название и адрес виллы' }]}
          >
            <Input.TextArea rows={2} placeholder="Название виллы, полный адрес" className="form-input" />
          </Form.Item>

          <Form.Item
            name="rental_cost"
            label={
              <span className="form-label">
                <DollarOutlined />
                Стоимость аренды <span className="required">*</span>
              </span>
            }
            rules={[{ required: true, message: 'Укажите стоимость аренды' }]}
          >
            <Input placeholder="Например: 50,000 THB/месяц" className="form-input" />
          </Form.Item>

          <Form.Item
            name="cost_includes"
            label={
              <span className="form-label">
                <FileTextOutlined />
                Что включено в стоимость
              </span>
            }
          >
            <Input.TextArea rows={2} placeholder="Электричество, вода, интернет и т.д." className="form-input" />
          </Form.Item>

          <Form.Item
            name="utilities_cost"
            label={
              <span className="form-label">
                <DollarOutlined />
                Стоимость коммунальных услуг
              </span>
            }
          >
            <Input placeholder="Если не включены в стоимость аренды" className="form-input" />
          </Form.Item>

          <Form.Item
            name="payment_terms"
            label={
              <span className="form-label">
                <FileTextOutlined />
                Условия оплаты
              </span>
            }
          >
            <Input.TextArea rows={2} placeholder="График платежей, способ оплаты" className="form-input" />
          </Form.Item>

          <Form.Item
            name="deposit_amount"
            label={
              <span className="form-label">
                <DollarOutlined />
                Размер депозита
              </span>
            }
          >
            <Input placeholder="Например: 50,000 THB" className="form-input" />
          </Form.Item>

          <Form.Item
            name="additional_terms"
            label={
              <span className="form-label">
                <FileTextOutlined />
                Дополнительные условия
              </span>
            }
          >
            <Input.TextArea rows={3} placeholder="Правила проживания, штрафы и т.д." className="form-input" />
          </Form.Item>
        </div>

        <div className="form-section">
          <h3 className="section-title">
            <IdcardOutlined />
            Паспортные данные
          </h3>

          <Form.Item
            label={
              <span className="form-label">
                <IdcardOutlined />
                Паспорт клиента <span className="required">*</span>
              </span>
            }
            required
            className="upload-item"
          >
            <Upload
              {...uploadProps}
              fileList={clientPassportFront}
              onChange={({ fileList }) => setClientPassportFront(fileList)}
            >
              {clientPassportFront.length === 0 && (
                <div className="upload-placeholder">
                  <UploadOutlined />
                  <div className="upload-text">Загрузить фото</div>
                </div>
              )}
            </Upload>
            {clientPassportFront.length === 0 && (
              <div className="upload-hint error">Обязательно для загрузки</div>
            )}
          </Form.Item>

          <Form.Item
            label={
              <span className="form-label">
                <IdcardOutlined />
                Паспорт агента <span className="required">*</span>
              </span>
            }
            required
            className="upload-item"
          >
            <Upload
              {...uploadProps}
              fileList={agentPassportFront}
              onChange={({ fileList }) => setAgentPassportFront(fileList)}
            >
              {agentPassportFront.length === 0 && (
                <div className="upload-placeholder">
                  <UploadOutlined />
                  <div className="upload-text">Загрузить фото</div>
                </div>
              )}
            </Upload>
            {agentPassportFront.length === 0 && (
              <div className="upload-hint error">Обязательно для загрузки</div>
            )}
          </Form.Item>
        </div>
      </Form>

      {isFormValid() && (
        <Alert
          message={
            <Space>
              <CheckCircleOutlined />
              Все данные заполнены. Можно отправить запрос.
            </Space>
          }
          type="success"
          className="success-alert"
        />
      )}
    </Modal>
  );
};

export default ContractRequestModal;