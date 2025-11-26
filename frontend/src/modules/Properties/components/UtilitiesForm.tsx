// frontend/src/modules/Properties/components/UtilitiesForm.tsx
import { Form, InputNumber, Row, Col, Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface UtilitiesFormProps {
  viewMode?: boolean;
}

const UtilitiesForm = ({ viewMode }: UtilitiesFormProps) => {
  const { t } = useTranslation();

  return (
    <Card title={t('utilitiesForm.title')} size="small">
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="electricity_rate"
            label={
              <span>
                {t('utilitiesForm.electricity')} <Text type="secondary">{t('utilitiesForm.thbPerUnit')}</Text>
              </span>
            }
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder={t('utilitiesForm.electricityPlaceholder')}
              addonAfter={t('utilitiesForm.perUnit')}
              disabled={viewMode}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={12}>
          <Form.Item
            name="water_rate"
            label={
              <span>
                {t('utilitiesForm.water')} <Text type="secondary">{t('utilitiesForm.thbPerUnit')}</Text>
              </span>
            }
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder={t('utilitiesForm.waterPlaceholder')}
              addonAfter={t('utilitiesForm.perUnit')}
              disabled={viewMode}
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default UtilitiesForm;