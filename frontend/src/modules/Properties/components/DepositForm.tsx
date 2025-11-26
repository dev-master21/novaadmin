// frontend/src/modules/Properties/components/DepositForm.tsx
import { Form, Radio, InputNumber, Space, Card } from 'antd';
import { useTranslation } from 'react-i18next';

interface DepositFormProps {
  dealType: 'sale' | 'rent' | 'both';
  viewMode?: boolean;
}

const DepositForm = ({ dealType, viewMode }: DepositFormProps) => {
  const { t } = useTranslation();
  const showDeposit = dealType === 'rent' || dealType === 'both';

  if (!showDeposit) return null;

  return (
    <Card title={t('depositForm.title')} size="small">
      <Form.Item
        name="deposit_type"
        label={t('depositForm.depositType')}
      >
        <Radio.Group disabled={viewMode}>
          <Space direction="vertical">
            <Radio value="one_month">{t('depositForm.oneMonth')}</Radio>
            <Radio value="two_months">{t('depositForm.twoMonths')}</Radio>
            <Radio value="custom">{t('depositForm.custom')}</Radio>
          </Space>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues.deposit_type !== currentValues.deposit_type
        }
      >
        {({ getFieldValue }) => {
          const depositType = getFieldValue('deposit_type');
          
          if (depositType !== 'custom') return null;

          return (
            <Form.Item
              name="deposit_amount"
              label={t('depositForm.depositAmount')}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                placeholder={t('depositForm.depositAmountPlaceholder')}
                addonAfter="฿"
                disabled={viewMode}
              />
            </Form.Item>
          );
        }}
      </Form.Item>
    </Card>
  );
};

export default DepositForm;