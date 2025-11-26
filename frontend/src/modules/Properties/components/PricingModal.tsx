// frontend/src/modules/Properties/components/PricingModal.tsx
import { Modal, Descriptions, Table, Spin, Empty } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import type { ColumnsType } from 'antd/es/table';

interface PricingModalProps {
  propertyId: number;
  visible: boolean;
  onClose: () => void;
}

interface SeasonalPrice {
  season_type: string | null;
  start_date_recurring: string;
  end_date_recurring: string;
  price_per_night: number;
  source_price_per_night: number | null;
  minimum_nights: number | null;
}

const PricingModal = ({ propertyId, visible, onClose }: PricingModalProps) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadPricing();
    }
  }, [visible, propertyId]);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const { data: response } = await propertiesApi.getPricingDetails(propertyId);
      setData(response.data);
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты из "DD-MM" в "DD месяц"
  const formatDate = (dateStr: string) => {
    const [day, month] = dateStr.split('-');  // В БД формат DD-MM (день-месяц)
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
  
    const months = i18n.language === 'ru' 
      ? ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
    return `${dayNum} ${months[monthNum - 1]}`;
  };

  // Сортировка по месяцам (январь -> декабрь), затем по дням
  const sortByDate = (a: SeasonalPrice, b: SeasonalPrice) => {
    const [aDay, aMonth] = a.start_date_recurring.split('-').map(Number);  // DD-MM
    const [bDay, bMonth] = b.start_date_recurring.split('-').map(Number);  // DD-MM
  
    // Сначала сравниваем месяцы
    if (aMonth !== bMonth) {
      return aMonth - bMonth;
    }
    // Если месяцы одинаковые, сравниваем дни
    return aDay - bDay;
  };

  const columns: ColumnsType<SeasonalPrice> = [
    {
      title: t('properties.pricing.period'),
      key: 'period',
      render: (_, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatDate(record.start_date_recurring)} — {formatDate(record.end_date_recurring)}
        </span>
      )
    },
    {
      title: t('properties.pricing.pricePerNight'),
      dataIndex: 'price_per_night',
      key: 'price_per_night',
      render: (price: number) => (
        <strong style={{ fontSize: 16, color: '#1890ff' }}>
          {Math.floor(price).toLocaleString()} ฿
        </strong>
      )
    },
    {
      title: t('properties.pricing.minimumNights'),
      dataIndex: 'minimum_nights',
      key: 'minimum_nights',
      align: 'center',
      render: (nights: number | null) => nights || '—'
    }
  ];

  const sortedPricing = data?.seasonal_pricing 
    ? [...data.seasonal_pricing].sort(sortByDate)
    : [];

  return (
    <Modal
      title={t('properties.pricing.title')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : data ? (
        <>
          {/* Цены продажи */}
          {(data.deal_type === 'sale' || data.deal_type === 'both') && data.sale_price && (
            <Descriptions column={1} bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t('properties.dealTypes.sale')}>
                <strong style={{ fontSize: 20, color: '#52c41a' }}>
                  {Math.floor(data.sale_price).toLocaleString()} ฿
                </strong>
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Цены аренды */}
          {(data.deal_type === 'rent' || data.deal_type === 'both') && (
            <>
              {/* Постоянная годовая цена */}
              {data.year_price && data.year_price > 0 && (
                <Descriptions column={1} bordered style={{ marginBottom: 24 }}>
                  <Descriptions.Item label={t('properties.pricingOptions.constantPrice')}>
                    <strong style={{ fontSize: 20, color: '#1890ff' }}>
                      {Math.floor(data.year_price).toLocaleString()} ฿
                    </strong>
                  </Descriptions.Item>
                </Descriptions>
              )}

              {/* Сезонные цены аренды */}
              {sortedPricing.length > 0 && (
                <>
                  <h3 style={{ marginBottom: 16 }}>
                    {t('properties.pricing.seasonalPricing')}
                  </h3>
                  <Table
                    columns={columns}
                    dataSource={sortedPricing}
                    pagination={false}
                    size="small"
                    rowKey={(record, index) => `${record.start_date_recurring}-${index}`}
                  />
                </>
              )}

              {/* Если нет ни постоянной цены, ни сезонных цен */}
              {(!data.year_price || data.year_price === 0) && sortedPricing.length === 0 && (
                <Empty description={t('properties.pricing.noPricing')} />
              )}
            </>
          )}
        </>
      ) : (
        <Empty description={t('common.noData')} />
      )}
    </Modal>
  );
};

export default PricingModal;