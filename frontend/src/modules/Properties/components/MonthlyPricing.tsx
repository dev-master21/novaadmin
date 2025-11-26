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
import { useTranslation } from 'react-i18next';
import { propertiesApi, MonthlyPrice } from '@/api/properties.api';

interface MonthlyPricingProps {
  propertyId: number;
  initialPricing?: MonthlyPrice[];
  viewMode?: boolean;
}

const MonthlyPricing = ({ propertyId, initialPricing = [], viewMode = false }: MonthlyPricingProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const months = [
    { number: 1, name: t('monthlyPricing.months.january') },
    { number: 2, name: t('monthlyPricing.months.february') },
    { number: 3, name: t('monthlyPricing.months.march') },
    { number: 4, name: t('monthlyPricing.months.april') },
    { number: 5, name: t('monthlyPricing.months.may') },
    { number: 6, name: t('monthlyPricing.months.june') },
    { number: 7, name: t('monthlyPricing.months.july') },
    { number: 8, name: t('monthlyPricing.months.august') },
    { number: 9, name: t('monthlyPricing.months.september') },
    { number: 10, name: t('monthlyPricing.months.october') },
    { number: 11, name: t('monthlyPricing.months.november') },
    { number: 12, name: t('monthlyPricing.months.december') }
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
    if (!propertyId || propertyId === 0) {
      message.warning(t('monthlyPricing.saveAfterCreate'));
      return;
    }

    setLoading(true);
    try {
      const values = form.getFieldsValue();
      
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
      message.success(t('monthlyPricing.pricesUpdated'));
    } catch (error: any) {
      message.error(error.response?.data?.message || t('monthlyPricing.errorUpdating'));
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
    message.info(t('monthlyPricing.allPricesCleared'));
  };

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            💰 {t('monthlyPricing.title')}
          </span>
        </Space>
      }
      extra={
        !viewMode && (
          <Space>
            <Button onClick={handleClearAll} danger>
              {t('monthlyPricing.clearAll')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              {t('common.save')}
            </Button>
          </Space>
        )
      }
    >
      <Alert
        message={t('monthlyPricing.infoTitle')}
        description={t('monthlyPricing.infoDescription')}
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
                  !viewMode && (
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleClearMonth(month.number)}
                      danger
                    />
                  )
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
                  label={t('monthlyPricing.pricePerMonth')}
                  style={{ marginBottom: 12 }}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="฿"
                    disabled={viewMode}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>

                <Form.Item
                  name={`days_${month.number}`}
                  label={t('monthlyPricing.minimumDays')}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    placeholder={t('monthlyPricing.notSpecified')}
                    disabled={viewMode}
                  />
                </Form.Item>
              </Card>
            </Col>
          ))}
        </Row>
      </Form>

      <Divider />

      <Alert
        message={t('monthlyPricing.importantInfoTitle')}
        description={t('monthlyPricing.importantInfoDescription')}
        type="warning"
        showIcon
      />
    </Card>
  );
};

export default MonthlyPricing;