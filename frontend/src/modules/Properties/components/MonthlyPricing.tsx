// frontend/src/modules/Properties/components/MonthlyPricing.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  Space,
  message,
  Row,
  Col,
  Alert,
  Divider
} from 'antd';
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { propertiesApi, MonthlyPrice } from '@/api/properties.api';

interface MonthlyPricingProps {
  propertyId: number;
  initialPricing?: MonthlyPrice[];
}

const MonthlyPricing = ({ propertyId, initialPricing = [] }: MonthlyPricingProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const months = [
    { number: 1, name: 'Январь' },
    { number: 2, name: 'Февраль' },
    { number: 3, name: 'Март' },
    { number: 4, name: 'Апрель' },
    { number: 5, name: 'Май' },
    { number: 6, name: 'Июнь' },
    { number: 7, name: 'Июль' },
    { number: 8, name: 'Август' },
    { number: 9, name: 'Сентябрь' },
    { number: 10, name: 'Октябрь' },
    { number: 11, name: 'Ноябрь' },
    { number: 12, name: 'Декабрь' }
  ];

  useEffect(() => {
    if (initialPricing && initialPricing.length > 0) {
      const formData: any = {};
      initialPricing.forEach(price => {
        formData[`price_${price.month_number}`] = price.price_per_month;
        formData[`days_${price.month_number}`] = price.minimum_days;
      });
      form.setFieldsValue(formData);
    }
  }, [initialPricing, form]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      
      // Собираем только те месяцы, где указана цена
      const monthlyPricing: MonthlyPrice[] = [];
      
      for (let i = 1; i <= 12; i++) {
        const price = values[`price_${i}`];
        if (price && price > 0) {
          monthlyPricing.push({
            month_number: i,
            price_per_month: price,
            minimum_days: values[`days_${i}`] || null
          });
        }
      }

      await propertiesApi.updateMonthlyPricing(propertyId, monthlyPricing);
      message.success('Месячные цены успешно обновлены');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка обновления цен');
    } finally {
      setLoading(false);
    }
  };

  const handleClearMonth = (monthNumber: number) => {
    form.setFieldsValue({
      [`price_${monthNumber}`]: undefined,
      [`days_${monthNumber}`]: undefined
    });
  };

  const handleClearAll = () => {
    form.resetFields();
    message.info('Все месячные цены очищены');
  };

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            💰 Месячные цены аренды
          </span>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={handleClearAll} danger>
            Очистить все
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
          >
            Сохранить
          </Button>
        </Space>
      }
    >
      <Alert
        message="Информация о месячных ценах"
        description="Укажите стоимость аренды для каждого месяца. Эти цены будут использоваться для долгосрочной аренды. Оставьте поле пустым, если цена для месяца не нужна."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        <Row gutter={[16, 16]}>
          {months.map(month => (
            <Col xs={24} sm={12} md={8} lg={6} key={month.number}>
              <Card
                size="small"
                title={
                  <Space>
                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>
                      {month.name}
                    </span>
                  </Space>
                }
                extra={
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleClearMonth(month.number)}
                    danger
                  />
                }
                style={{ 
                  height: '100%',
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Form.Item
                  name={`price_${month.number}`}
                  label="Цена за месяц"
                  style={{ marginBottom: 12 }}
                  rules={[
                    {
                      type: 'number',
                      min: 0,
                      message: 'Цена должна быть положительной'
                    }
                  ]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="฿"
                  />
                </Form.Item>

                <Form.Item
                  name={`days_${month.number}`}
                  label="Минимум дней"
                  style={{ marginBottom: 0 }}
                  rules={[
                    {
                      type: 'number',
                      min: 1,
                      message: 'Минимум 1 день'
                    }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    placeholder="Не указано"
                  />
                </Form.Item>
              </Card>
            </Col>
          ))}
        </Row>
      </Form>

      <Divider />

      <Alert
        message="Важная информация"
        description="Месячные цены имеют приоритет над сезонными ценами при расчете долгосрочной аренды. Если цена для месяца не указана, будет использоваться сезонная цена (если она есть)."
        type="warning"
        showIcon
      />
    </Card>
  );
};

export default MonthlyPricing;