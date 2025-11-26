// frontend/src/modules/Properties/components/SeasonalPricing.tsx
import { useState, useEffect } from 'react';
import { Card, Button, Space, InputNumber, DatePicker, Select, Table, Popconfirm, message, Modal, Descriptions, Alert, Radio, Typography } from 'antd';
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
  pricing_type?: 'per_night' | 'per_period';
}

interface SeasonalPricingProps {
  value?: PricingPeriod[];
  onChange?: (value: PricingPeriod[]) => void;
  viewMode?: boolean;
}

// Интерфейс для формы редактирования
interface EditFormState {
  season_type: string | null;
  dates: [dayjs.Dayjs | null, dayjs.Dayjs | null];
  price_per_night: number | null;
  source_price_per_night: number | null;
  minimum_nights: number | null;
  pricing_type: 'per_night' | 'per_period';
}

const initialFormState: EditFormState = {
  season_type: null,
  dates: [null, null],
  price_per_night: null,
  source_price_per_night: null,
  minimum_nights: 1,
  pricing_type: 'per_night'
};

const SeasonalPricing = ({ value = [], onChange, viewMode = false }: SeasonalPricingProps) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Локальный state для полей формы редактирования (без использования Form)
  const [formState, setFormState] = useState<EditFormState>(initialFormState);
  const [errors, setErrors] = useState<{ dates?: string; price?: string }>({});

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
    { value: 'prime', label: t('seasonalPricing.seasonTypes.prime') },
    { value: 'holiday', label: t('seasonalPricing.seasonTypes.holiday') },
    { value: null, label: t('properties.pricing.seasonTypes.custom') }
  ];

  const getSeasonLabel = (type: string | null) => {
    const season = seasonTypes.find(s => s.value === type);
    return season?.label || t('properties.pricing.seasonTypes.custom');
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setErrors({});
    
    if (value.length > 0) {
      const lastPeriod = value[value.length - 1];
      const lastEndDate = dayjs(lastPeriod.end_date_recurring, 'DD-MM');
      const nextStartDate = lastEndDate.add(1, 'day');
      
      setFormState({
        season_type: null,
        dates: [nextStartDate, null],
        price_per_night: null,
        source_price_per_night: null,
        minimum_nights: 1,
        pricing_type: 'per_night'
      });
    } else {
      setFormState(initialFormState);
    }
  };

  const handleEdit = (period: PricingPeriod) => {
    setIsAdding(true);
    setEditingId(period.id || null);
    setErrors({});
    
    setFormState({
      season_type: period.season_type,
      dates: [
        dayjs(period.start_date_recurring, 'DD-MM'),
        dayjs(period.end_date_recurring, 'DD-MM')
      ],
      price_per_night: period.price_per_night,
      source_price_per_night: period.source_price_per_night || null,
      minimum_nights: period.minimum_nights,
      pricing_type: period.pricing_type || 'per_night'
    });
  };

  const validateForm = (): boolean => {
    const newErrors: { dates?: string; price?: string } = {};
    
    if (!formState.dates[0] || !formState.dates[1]) {
      newErrors.dates = t('validation.required');
    }
    
    if (!formState.price_per_night || formState.price_per_night <= 0) {
      newErrors.price = t('validation.required');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const newPeriod: PricingPeriod = {
      id: editingId || Date.now(),
      season_type: formState.season_type || null,
      start_date_recurring: formState.dates[0]!.format('DD-MM'),
      end_date_recurring: formState.dates[1]!.format('DD-MM'),
      price_per_night: formState.price_per_night!,
      source_price_per_night: formState.source_price_per_night || null,
      minimum_nights: formState.minimum_nights || null,
      pricing_type: formState.pricing_type || 'per_night'
    };

    let updated: PricingPeriod[];
    
    if (editingId) {
      updated = value.map(p => p.id === editingId ? newPeriod : p);
      message.success(t('properties.pricing.periodUpdated'));
    } else {
      updated = [...value, newPeriod];
      message.success(t('properties.pricing.periodAdded'));
    }

    if (onChange) {
      onChange(updated);
    }
    
    setIsAdding(false);
    setEditingId(null);
    setFormState(initialFormState);
    setErrors({});
  };

  const handleDelete = (id: number) => {
    const updated = value.filter(p => p.id !== id);
    if (onChange) {
      onChange(updated);
    }
    message.success(t('properties.pricing.periodDeleted'));
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormState(initialFormState);
    setErrors({});
  };

  const showDetails = (period: PricingPeriod) => {
    setSelectedPeriod(period);
    setDetailsModalVisible(true);
  };

  // Обновление полей формы
  const updateFormField = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    // Сбрасываем ошибку при изменении поля
    if (field === 'dates' && errors.dates) {
      setErrors(prev => ({ ...prev, dates: undefined }));
    }
    if (field === 'price_per_night' && errors.price) {
      setErrors(prev => ({ ...prev, price: undefined }));
    }
  };

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
    ...(viewMode ? [] : [{
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
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
    }])
  ];

  const mobileColumns: ColumnsType<PricingPeriod> = [
    {
      title: t('seasonalPricing.periodColumn'),
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
    ...(viewMode ? [] : [{
      title: t('seasonalPricing.actionsColumn'),
      key: 'actions',
      width: 90,
      align: 'right' as const,
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
    }])
  ];

  return (
    <Card title={t('properties.pricing.title')}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message={t('properties.pricing.seasonalDisclaimer')}
          description={t('properties.pricing.seasonalDisclaimerDescription')}
          type="info"
          showIcon
          closable
        />

        {!viewMode && !isAdding && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            block
          >
            {value.length === 0 
              ? t('properties.pricing.addPeriod') 
              : t('seasonalPricing.addAnotherSeason')
            }
          </Button>
        )}

        {isAdding && (
          <Card type="inner" size="small">
            {/* Форма без использования Ant Design Form - просто контролируемые поля */}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.seasonType')}</Text>
                </div>
                <Select
                  style={{ width: '100%' }}
                  options={seasonTypes}
                  value={formState.season_type}
                  onChange={(val) => updateFormField('season_type', val)}
                  placeholder={t('seasonalPricing.selectSeasonType')}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.period')}</Text>
                  <Text type="danger"> *</Text>
                </div>
                <DatePicker.RangePicker
                  format="DD-MM"
                  picker="date"
                  style={{ width: '100%' }}
                  value={formState.dates}
                  onChange={(dates) => updateFormField('dates', dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                  placeholder={[t('seasonalPricing.start'), t('seasonalPricing.end')]}
                  status={errors.dates ? 'error' : undefined}
                  popupClassName="seasonal-pricing-calendar"
                  getPopupContainer={(trigger) => {
                    if (window.innerWidth < 768) {
                      return document.body;
                    }
                    return trigger.parentElement || document.body;
                  }}
                />
                {errors.dates && (
                  <Text type="danger" style={{ fontSize: 12 }}>{errors.dates}</Text>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.pricingType')}</Text>
                  <Text type="danger"> *</Text>
                </div>
                <Radio.Group
                  value={formState.pricing_type}
                  onChange={(e) => updateFormField('pricing_type', e.target.value)}
                >
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
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.pricePerNight')}</Text>
                  <Text type="danger"> *</Text>
                </div>
                <InputNumber<number>
                  min={0}
                  style={{ width: '100%' }}
                  value={formState.price_per_night}
                  onChange={(val) => updateFormField('price_per_night', val)}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/,/g, ''))}
                  addonAfter="฿"
                  placeholder="0"
                  status={errors.price ? 'error' : undefined}
                />
                {errors.price && (
                  <Text type="danger" style={{ fontSize: 12 }}>{errors.price}</Text>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.sourcePricePerNight')}</Text>
                </div>
                <InputNumber<number>
                  min={0}
                  style={{ width: '100%' }}
                  value={formState.source_price_per_night}
                  onChange={(val) => updateFormField('source_price_per_night', val)}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => Number(value!.replace(/,/g, ''))}
                  addonAfter="฿"
                  placeholder="0"
                />
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('properties.pricing.minimumNights')}</Text>
                </div>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  value={formState.minimum_nights}
                  onChange={(val) => updateFormField('minimum_nights', val)}
                  placeholder="1"
                />
              </div>

              <div>
                <Space>
                  <Button 
                    type="primary" 
                    onClick={handleSubmit}
                  >
                    {editingId ? t('common.save') : t('common.add')}
                  </Button>
                  <Button onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </div>
            </Space>
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
          title={t('seasonalPricing.seasonDetails')}
          open={detailsModalVisible}
          onCancel={() => setDetailsModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setDetailsModalVisible(false)}>
              {t('common.close')}
            </Button>
          ]}
        >
          {selectedPeriod && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('seasonalPricing.seasonType')}>
                {getSeasonLabel(selectedPeriod.season_type)}
              </Descriptions.Item>
              <Descriptions.Item label={t('seasonalPricing.period')}>
                {selectedPeriod.start_date_recurring} — {selectedPeriod.end_date_recurring}
              </Descriptions.Item>
              <Descriptions.Item label={t('seasonalPricing.pricingType')}>
                {selectedPeriod.pricing_type === 'per_period' 
                  ? t('properties.pricing.forWholePeriod')
                  : t('properties.pricing.perNight')
                }
              </Descriptions.Item>
              <Descriptions.Item label={t('seasonalPricing.price')}>
                <strong style={{ color: '#1890ff', fontSize: 16 }}>
                  {selectedPeriod.price_per_night.toLocaleString()} ฿
                </strong>
              </Descriptions.Item>
              {selectedPeriod.source_price_per_night && (
                <Descriptions.Item label={t('seasonalPricing.sourcePrice')}>
                  {selectedPeriod.source_price_per_night.toLocaleString()} ฿
                </Descriptions.Item>
              )}
              <Descriptions.Item label={t('seasonalPricing.minimumNights')}>
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