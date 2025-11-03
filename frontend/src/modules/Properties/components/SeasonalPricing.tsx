// frontend/src/modules/Properties/components/SeasonalPricing.tsx
import { useState } from 'react';
import { Card, Button, Space, Form, InputNumber, DatePicker, Select, Table, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface PricingPeriod {
  id?: number;
  season_type: string | null;
  start_date_recurring: string;
  end_date_recurring: string;
  price_per_night: number;
  source_price_per_night?: number | null;
  minimum_nights: number | null;
}

interface SeasonalPricingProps {
  value?: PricingPeriod[];
  onChange?: (value: PricingPeriod[]) => void;
}

const SeasonalPricing = ({ value = [], onChange }: SeasonalPricingProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const seasonTypes = [
    { value: 'high', label: t('properties.pricing.seasonTypes.high') },
    { value: 'low', label: t('properties.pricing.seasonTypes.low') },
    { value: 'peak', label: t('properties.pricing.seasonTypes.peak') },
    { value: null, label: t('properties.pricing.seasonTypes.custom') }
  ];

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    form.resetFields();
  };

  const handleEdit = (period: PricingPeriod) => {
    setIsAdding(true);
    setEditingId(period.id || null);
    form.setFieldsValue({
      season_type: period.season_type,
      dates: [
        dayjs(period.start_date_recurring, 'MM-DD'),
        dayjs(period.end_date_recurring, 'MM-DD')
      ],
      price_per_night: period.price_per_night,
      source_price_per_night: period.source_price_per_night,
      minimum_nights: period.minimum_nights
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const newPeriod: PricingPeriod = {
        id: editingId || Date.now(),
        season_type: values.season_type,
        start_date_recurring: values.dates[0].format('MM-DD'),
        end_date_recurring: values.dates[1].format('MM-DD'),
        price_per_night: values.price_per_night,
        source_price_per_night: values.source_price_per_night || null,
        minimum_nights: values.minimum_nights || null
      };

      let updated: PricingPeriod[];
      
      if (editingId) {
        // Обновление существующего
        updated = value.map(p => p.id === editingId ? newPeriod : p);
        message.success(t('properties.pricing.periodUpdated'));
      } else {
        // Добавление нового
        updated = [...value, newPeriod];
        message.success(t('properties.pricing.periodAdded'));
      }

      onChange?.(updated);
      setIsAdding(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handleDelete = (id: number) => {
    const updated = value.filter(p => p.id !== id);
    onChange?.(updated);
    message.success(t('properties.pricing.periodDeleted'));
  };

  const columns = [
    {
      title: t('properties.pricing.seasonType'),
      dataIndex: 'season_type',
      key: 'season_type',
      render: (type: string | null) => {
        const season = seasonTypes.find(s => s.value === type);
        return season?.label || t('properties.pricing.seasonTypes.custom');
      }
    },
    {
      title: t('properties.pricing.period'),
      key: 'period',
      render: (_: any, record: PricingPeriod) => (
        <span>
          {record.start_date_recurring} — {record.end_date_recurring}
        </span>
      )
    },
    {
      title: t('properties.pricing.pricePerNight'),
      dataIndex: 'price_per_night',
      key: 'price_per_night',
      render: (price: number) => `${price.toLocaleString()} ฿`
    },
    {
      title: t('properties.pricing.minimumNights'),
      dataIndex: 'minimum_nights',
      key: 'minimum_nights',
      render: (nights: number | null) => nights || '—'
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, record: PricingPeriod) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record.id!)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card title={t('properties.pricing.title')}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Кнопка добавления */}
        {!isAdding && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            block
          >
            {t('properties.pricing.addPeriod')}
          </Button>
        )}

        {/* Форма добавления/редактирования */}
        {isAdding && (
          <Card type="inner" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Form.Item
                label={t('properties.pricing.seasonType')}
                name="season_type"
              >
                <Select options={seasonTypes} />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.period')}
                name="dates"
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <DatePicker.RangePicker
                  format="MM-DD"
                  picker="date"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.pricePerNight')}
                name="price_per_night"
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <InputNumber<number>
                  min={0}
                  style={{ width: '100%' }}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/,/g, ''))}
                  addonAfter="฿"
                />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.sourcePricePerNight')}
                name="source_price_per_night"
              >
                <InputNumber<number>
                  min={0}
                  style={{ width: '100%' }}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/,/g, ''))}
                  addonAfter="฿"
                />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.minimumNights')}
                name="minimum_nights"
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {editingId ? t('common.save') : t('common.add')}
                  </Button>
                  <Button onClick={() => {
                    setIsAdding(false);
                    form.resetFields();
                  }}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* Таблица периодов */}
        {value.length > 0 && (
          <Table
            columns={columns}
            dataSource={value}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Space>
    </Card>
  );
};

export default SeasonalPricing;