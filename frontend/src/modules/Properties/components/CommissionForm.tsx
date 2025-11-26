// frontend/src/modules/Properties/components/CommissionForm.tsx
import { Form, Select, InputNumber, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

interface CommissionFormProps {
  dealType: 'sale' | 'rent' | 'both';
  viewMode?: boolean;  // ✅ НОВОЕ
}

const CommissionForm = ({ dealType }: CommissionFormProps) => {
  const { t } = useTranslation();

  const showSaleCommission = dealType === 'sale' || dealType === 'both';
  const showRentCommission = dealType === 'rent' || dealType === 'both';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4}>{t('properties.commission.title')}</Title>

      {showSaleCommission && (
        <div style={{ padding: 16, background: '#1f1f1f', borderRadius: 8 }}>
          <Title level={5}>{t('properties.commission.saleCommission')}</Title>
          
          <Form.Item
            name="sale_commission_type"
            label={t('properties.commission.types.title')}
          >
            <Select
              placeholder={t('common.select')}
              options={[
                { value: 'percentage', label: t('properties.commission.types.percentage') },
                { value: 'fixed', label: t('properties.commission.types.fixed') }
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.sale_commission_type !== currentValues.sale_commission_type
            }
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('sale_commission_type');
              if (!type) return null;

              return (
                <Form.Item
                  name="sale_commission_value"
                  label={t('properties.commission.value')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={
                      type === 'percentage'
                        ? t('properties.commission.percentagePlaceholder')
                        : t('properties.commission.fixedPlaceholder')
                    }
                    addonAfter={type === 'percentage' ? '%' : '฿'}
                    min={0}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>
      )}

      {showRentCommission && (
        <div style={{ padding: 16, background: '#1f1f1f', borderRadius: 8 }}>
          <Title level={5}>{t('properties.commission.rentCommission')}</Title>
          
          <Form.Item
            name="rent_commission_type"
            label={t('properties.commission.types.title')}
          >
            <Select
              placeholder={t('common.select')}
              options={[
                { value: 'percentage', label: t('properties.commission.types.percentage') },
                { value: 'monthly_rent', label: t('properties.commission.types.monthlyRent') },
                { value: 'fixed', label: t('properties.commission.types.fixed') }
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.rent_commission_type !== currentValues.rent_commission_type
            }
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('rent_commission_type');
              if (!type || type === 'monthly_rent') return null;

              return (
                <Form.Item
                  name="rent_commission_value"
                  label={t('properties.commission.value')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={
                      type === 'percentage'
                        ? t('properties.commission.percentagePlaceholder')
                        : t('properties.commission.fixedPlaceholder')
                    }
                    addonAfter={type === 'percentage' ? '%' : '฿'}
                    min={0}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>
      )}
    </Space>
  );
};

export default CommissionForm;