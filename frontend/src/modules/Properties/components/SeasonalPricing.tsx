// frontend/src/modules/Properties/components/SeasonalPricing.tsx
import { useState, useEffect } from 'react';
import { Card, Button, Space, Form, InputNumber, DatePicker, Select, Table, Popconfirm, message, Modal, Descriptions, Alert, Radio, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface PricingPeriod {
  id?: number;
  season_type: string | null;
  start_date_recurring: string;
  end_date_recurring: string;
  price_per_night: number;
  source_price_per_night?: number | null;
  minimum_nights: number | null;
  pricing_type?: 'per_night' | 'per_period';  // ✅ НОВОЕ ПОЛЕ
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
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const seasonTypes = [
    { value: 'low', label: t('properties.pricing.seasonTypes.low') },
    { value: 'mid', label: t('properties.pricing.seasonTypes.mid') },
    { value: 'high', label: t('properties.pricing.seasonTypes.high') },
    { value: 'peak', label: t('properties.pricing.seasonTypes.peak') },
    { value: 'prime', label: 'Прайм сезон' },
    { value: 'holiday', label: 'Праздничный сезон' },
    { value: null, label: t('properties.pricing.seasonTypes.custom') }
  ];

  const getSeasonLabel = (type: string | null) => {
    const season = seasonTypes.find(s => s.value === type);
    return season?.label || t('properties.pricing.seasonTypes.custom');
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    
    if (value.length > 0) {
      const lastPeriod = value[value.length - 1];
      const lastEndDate = dayjs(lastPeriod.end_date_recurring, 'DD-MM');
      const nextStartDate = lastEndDate.add(1, 'day');
      
      form.setFieldsValue({
        dates: [nextStartDate, null],
        season_type: null,
        price_per_night: null,
        source_price_per_night: null,
        minimum_nights: 1,
        pricing_type: 'per_night'  // ✅ Значение по умолчанию
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        minimum_nights: 1,
        pricing_type: 'per_night'  // ✅ Значение по умолчанию
      });
    }
  };

  const handleEdit = (period: PricingPeriod) => {
    setIsAdding(true);
    setEditingId(period.id || null);
    form.setFieldsValue({
      season_type: period.season_type,
      dates: [
        dayjs(period.start_date_recurring, 'DD-MM'),
        dayjs(period.end_date_recurring, 'DD-MM')
      ],
      price_per_night: period.price_per_night,
      source_price_per_night: period.source_price_per_night,
      minimum_nights: period.minimum_nights,
      pricing_type: period.pricing_type || 'per_night'  // ✅ НОВОЕ ПОЛЕ
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const values = await form.validateFields();
      
      const newPeriod: PricingPeriod = {
        id: editingId || Date.now(),
        season_type: values.season_type || null,
        start_date_recurring: values.dates[0].format('DD-MM'),
        end_date_recurring: values.dates[1].format('DD-MM'),
        price_per_night: values.price_per_night,
        source_price_per_night: values.source_price_per_night || null,
        minimum_nights: values.minimum_nights || null,
        pricing_type: values.pricing_type || 'per_night'  // ✅ НОВОЕ ПОЛЕ
      };

      let updated: PricingPeriod[];
      
      if (editingId) {
        updated = value.map(p => p.id === editingId ? newPeriod : p);
        message.success(t('properties.pricing.periodUpdated'));
      } else {
        updated = [...value, newPeriod];
        message.success(t('properties.pricing.periodAdded'));
      }

      // ВАЖНО: вызываем onChange чтобы обновить значение в родительской форме
      if (onChange) {
        onChange(updated);
      }
      
      setIsAdding(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handleDelete = (id: number) => {
    const updated = value.filter(p => p.id !== id);
    // ВАЖНО: вызываем onChange
    if (onChange) {
      onChange(updated);
    }
    message.success(t('properties.pricing.periodDeleted'));
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    form.resetFields();
  };

  const showDetails = (period: PricingPeriod) => {
    setSelectedPeriod(period);
    setDetailsModalVisible(true);
  };

  // Колонки для десктопа
  const desktopColumns: ColumnsType<PricingPeriod> = [
    {
      title: t('properties.pricing.seasonType'),
      dataIndex: 'season_type',
      key: 'season_type',
      width: 150,
      render: (type: string | null) => getSeasonLabel(type)
    },
    {
      title: t('properties.pricing.period'),
      key: 'period',
      width: 180,
      render: (_: any, record: PricingPeriod) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {record.start_date_recurring} — {record.end_date_recurring}
        </span>
      )
    },
    {
      title: t('properties.pricing.price'),
      key: 'price',
      width: 150,
      render: (_: any, record: PricingPeriod) => (
        <Space direction="vertical" size={0}>
          <strong style={{ color: '#1890ff', fontSize: 16 }}>
            {record.price_per_night.toLocaleString()} ฿
          </strong>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.pricing_type === 'per_period' 
              ? t('properties.pricing.forWholePeriod')
              : t('properties.pricing.perNight')
            }
          </Text>
        </Space>
      )
    },
    {
      title: t('properties.pricing.minimumNights'),
      dataIndex: 'minimum_nights',
      key: 'minimum_nights',
      width: 100,
      align: 'center',
      render: (nights: number | null) => nights || '—'
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
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

  // Колонки для мобильной версии - компактные иконки в ряд
  const mobileColumns: ColumnsType<PricingPeriod> = [
    {
      title: 'Период',
      key: 'period',
      render: (_: any, record: PricingPeriod) => (
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {record.start_date_recurring} — {record.end_date_recurring}
          </div>
          <div style={{ color: '#1890ff', fontSize: 15, fontWeight: 'bold' }}>
            {record.price_per_night.toLocaleString()} ฿
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.pricing_type === 'per_period' 
              ? t('properties.pricing.forWholePeriod')
              : t('properties.pricing.perNight')
            }
          </Text>
        </div>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_: any, record: PricingPeriod) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined style={{ fontSize: 18 }} />}
            onClick={() => showDetails(record)}
            style={{ padding: '4px 8px' }}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 18 }} />}
            onClick={() => handleEdit(record)}
            style={{ padding: '4px 8px' }}
          />
          <Popconfirm
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record.id!)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined style={{ fontSize: 18 }} />}
              style={{ padding: '4px 8px' }}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card title={t('properties.pricing.title')}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* ✅ НОВЫЙ ДИСКЛЕЙМЕР */}
        <Alert
          message={t('properties.pricing.seasonalDisclaimer')}
          description={t('properties.pricing.seasonalDisclaimerDescription')}
          type="info"
          showIcon
          closable
        />

        {!isAdding && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            block
          >
            {value.length === 0 
              ? t('properties.pricing.addPeriod') 
              : 'Добавить ещё сезон'
            }
          </Button>
        )}

        {isAdding && (
          <Card type="inner" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onSubmitCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Form.Item
                label={t('properties.pricing.seasonType')}
                name="season_type"
              >
                <Select 
                  options={seasonTypes}
                  placeholder="Выберите тип сезона"
                />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.period')}
                name="dates"
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <DatePicker.RangePicker
                  format="DD-MM"
                  picker="date"
                  style={{ width: '100%' }}
                  placeholder={['Начало', 'Конец']}
                  dropdownClassName="seasonal-pricing-calendar"
                  getPopupContainer={(trigger) => {
                    if (window.innerWidth < 768) {
                      return document.body;
                    }
                    return trigger.parentElement || document.body;
                  }}
                />
              </Form.Item>

              {/* ✅ НОВОЕ: Тип ценообразования */}
              <Form.Item
                name="pricing_type"
                label={t('properties.pricing.pricingType')}
                rules={[{ required: true }]}
                initialValue="per_night"
              >
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value="per_night">
                      <Space direction="vertical" size={0}>
                        <Text>{t('properties.pricing.perNightOption')}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('properties.pricing.perNightHint')}
                        </Text>
                      </Space>
                    </Radio>
                    <Radio value="per_period">
                      <Space direction="vertical" size={0}>
                        <Text>{t('properties.pricing.perPeriodOption')}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('properties.pricing.perPeriodHint')}
                        </Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
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
                  placeholder="0"
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
                  placeholder="0"
                />
              </Form.Item>

              <Form.Item
                label={t('properties.pricing.minimumNights')}
                name="minimum_nights"
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="1"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit();
                    }}
                  >
                    {editingId ? t('common.save') : t('common.add')}
                  </Button>
                  <Button onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {value.length > 0 && (
          <Table
            columns={isMobile ? mobileColumns : desktopColumns}
            dataSource={value}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={isMobile ? undefined : { x: 'max-content' }}
          />
        )}

        <Modal
          title="Детали сезона"
          open={detailsModalVisible}
          onCancel={() => setDetailsModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setDetailsModalVisible(false)}>
              Закрыть
            </Button>
          ]}
        >
          {selectedPeriod && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Тип сезона">
                {getSeasonLabel(selectedPeriod.season_type)}
              </Descriptions.Item>
              <Descriptions.Item label="Период">
                {selectedPeriod.start_date_recurring} — {selectedPeriod.end_date_recurring}
              </Descriptions.Item>
              {/* ✅ НОВОЕ: Отображение типа цены */}
              <Descriptions.Item label="Тип ценообразования">
                {selectedPeriod.pricing_type === 'per_period' 
                  ? t('properties.pricing.forWholePeriod')
                  : t('properties.pricing.perNight')
                }
              </Descriptions.Item>
              <Descriptions.Item label="Цена">
                <strong style={{ color: '#1890ff', fontSize: 16 }}>
                  {selectedPeriod.price_per_night.toLocaleString()} ฿
                </strong>
              </Descriptions.Item>
              {selectedPeriod.source_price_per_night && (
                <Descriptions.Item label="Исходная цена">
                  {selectedPeriod.source_price_per_night.toLocaleString()} ฿
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Минимум ночей">
                {selectedPeriod.minimum_nights || '—'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </Space>
    </Card>
  );
};

export default SeasonalPricing;