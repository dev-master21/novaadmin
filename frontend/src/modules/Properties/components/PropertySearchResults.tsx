// frontend/src/modules/Properties/components/PropertySearchResults.tsx
import React, { useState } from 'react';
import { Card, Row, Col, Tag, Button, Space, Typography, Divider, Badge, Modal, List, Spin, message, Tooltip, Alert, Progress } from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  DollarOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertySearchApi } from '@/api/propertySearch.api';
import dayjs from 'dayjs';
import './PropertySearchResults.css';
import AIResponseViewer from './AIResponseViewer';

const { Text, Title } = Typography;

interface PropertySearchResultsProps {
  properties: any[];
  executionTime?: number;
  onViewProperty: (id: number) => void;
  requestedFeatures?: string[];
  mustHaveFeatures?: string[];
}

const PropertySearchResults: React.FC<PropertySearchResultsProps> = ({
  properties,
  executionTime = 0,
  onViewProperty,
  requestedFeatures = [],
}) => {
  const { t } = useTranslation();
  
  const [periodsModalVisible, setPeriodsModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [aiResponseVisible, setAiResponseVisible] = useState(false);

  // Маппинг особенностей - используем ключи переводов
  const translateFeature = (feature: string): string => {
    const key = `features.${feature}`;
    const translated = t(key);
    // Если перевод не найден, возвращаем исходное значение
    return translated === key ? feature : translated;
  };

  const handleShowAvailablePeriods = async (property: any, nights: number) => {
    setSelectedProperty(property);
    setPeriodsModalVisible(true);
    setLoadingPeriods(true);

    try {
      const { data } = await propertySearchApi.findAvailablePeriods(
        property.id,
        nights
      );

      setAvailablePeriods(data.data.periods);
    } catch (error) {
      message.error(t('searchResults.errorLoadingPeriods'));
    } finally {
      setLoadingPeriods(false);
    }
  };

  const formatPrice = (price: number): string => {
    return Math.round(price).toLocaleString('ru-RU');
  };

  const renderPriceInfo = (property: any) => {
    // Для продажи
    if (property.deal_type === 'sale' && property.sale_price) {
      return (
        <div className="price-info">
          <div className="price-main">
            <DollarOutlined /> {formatPrice(property.sale_price)} THB
          </div>
          <div className="price-label">{t('searchResults.salePrice')}</div>
        </div>
      );
    }

    // Для аренды с рассчитанной ценой
    if (property.calculated_price) {
      const price = property.calculated_price;

      // Цена по запросу
      if (price.total_price === 0 && price.breakdown?.[0]?.period === 'price_on_request') {
        return (
          <div className="price-info" style={{ background: 'rgba(250, 173, 20, 0.1)', borderColor: 'rgba(250, 173, 20, 0.3)' }}>
            <div className="price-main" style={{ color: '#faad14' }}>
              💬 {t('searchResults.priceOnRequest')}
            </div>
            <div className="price-label">
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('searchResults.priceOnRequestDescription')}
              </Text>
            </div>
            {price.nights && (
              <div className="price-label" style={{ marginTop: 8 }}>
                {t('searchResults.period')}: {price.nights} {t('searchResults.nightsCount', { count: price.nights })}
              </div>
            )}
          </div>
        );
      }

      if (price.total_price > 0) {
        return (
          <div className="price-info">
            <div className="price-main">
              <DollarOutlined /> {formatPrice(price.total_price)} THB
            </div>
            <div className="price-details">
              <Space split={<Divider type="vertical" />}>
                <Text type="secondary">
                  {formatPrice(price.daily_average)} {t('searchResults.thbPerNight')}
                </Text>
                <Text type="secondary">
                  {formatPrice(price.monthly_equivalent)} {t('searchResults.thbPerMonth')}
                </Text>
              </Space>
            </div>
            {price.nights && (
              <div className="price-label">
                {t('searchResults.for')} {price.nights} {t('searchResults.nightsCount', { count: price.nights })}
              </div>
            )}
            <div className="pricing-method">
              <Tag color="blue">
                {price.pricing_method === 'seasonal' ? t('searchResults.pricingMethods.seasonal') :
                 price.pricing_method === 'monthly' ? t('searchResults.pricingMethods.monthly') :
                 price.pricing_method === 'yearly' ? t('searchResults.pricingMethods.yearly') : 
                 t('searchResults.pricingMethods.combined')}
              </Tag>
            </div>
          </div>
        );
      }
    }

    // Для аренды без рассчитанной цены
    if (property.year_price && property.year_price > 0) {
      const monthlyPrice = Math.round(property.year_price / 12);
      return (
        <div className="price-info">
          <div className="price-main">
            <DollarOutlined /> {formatPrice(monthlyPrice)} {t('searchResults.thbPerMonth')}
          </div>
          <div className="price-label">{t('searchResults.estimatedPriceYearly')}</div>
        </div>
      );
    }

    // Если нет цен
    return (
      <div className="price-info" style={{ background: 'rgba(255, 77, 79, 0.1)', borderColor: 'rgba(255, 77, 79, 0.3)' }}>
        <div className="price-main" style={{ color: '#ff4d4f' }}>
          <Text type="danger">{t('searchResults.noPrices')}</Text>
        </div>
        <div className="price-label">
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('searchResults.noPricesDescription')}
          </Text>
        </div>
      </div>
    );
  };

  const renderPropertyCard = (property: any) => {
    const hasCalculatedPrice = property.calculated_price && property.calculated_price.nights;
    
    const hasMissingFeatures = property.missing_features && 
                               property.missing_features.length > 0 &&
                               requestedFeatures.length > 0;
    
    const matchScore = property.features_match_score || 0;
    const totalFeatures = property.features_match_total || 0;
    const showMatchScore = totalFeatures > 0;
    
    return (
      <Card
        key={property.id}
        hoverable
        className="property-result-card"
        cover={
          property.cover_photo ? (
            <div className="property-image-wrapper">
              <img 
                alt={property.property_name || property.property_number}
                src={property.cover_photo}
                className="property-image"
              />

              {property.calendar_warning && (
                <Tooltip 
                  title={
                    <div style={{ textAlign: 'center', padding: '4px 0' }}>
                      <strong style={{ fontSize: 13 }}>{t('searchResults.noCalendar')}</strong>
                      <br />
                      <span style={{ fontSize: 12 }}>
                        {t('searchResults.noCalendarDescription')}
                      </span>
                    </div>
                  }
                  placement="topLeft"
                  color="#ff4d4f"
                  overlayStyle={{ maxWidth: 280 }}
                >
                  <div className="calendar-warning-badge">
                    <ExclamationCircleOutlined />
                    <span>{t('searchResults.checkAvailability')}</span>
                  </div>
                </Tooltip>
              )}

              {property.photos_count > 1 && (
                <Badge 
                  count={t('searchResults.photosCount', { count: property.photos_count })}
                  className="photos-badge"
                />
              )}
            </div>
          ) : (
            <div className="property-image-placeholder">
              <HomeOutlined style={{ fontSize: 48, color: '#666' }} />
            </div>
          )
        }
      >
        <div className="property-card-content">
          <div className="property-header">
            <Title level={5} className="property-title">
              {property.property_name || property.property_number}
            </Title>
            <Space>
              <Tag color={property.deal_type === 'sale' ? 'green' : 'blue'}>
                {property.deal_type === 'sale' ? t('properties.dealTypes.sale') : t('properties.dealTypes.rent')}
              </Tag>
              <Tag>{property.property_type}</Tag>
            </Space>
          </div>

          <div className="property-location">
            <EnvironmentOutlined /> {property.region}
            {property.distance_to_beach && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                • {Math.round(property.distance_to_beach)}{t('searchResults.metersToBeach')}
              </Text>
            )}
          </div>

          <div className="property-features">
            <Space split={<Divider type="vertical" />}>
              <span>🛏️ {Math.round(property.bedrooms)} {t('searchResults.bedrooms')}</span>
              <span>🚿 {Math.round(property.bathrooms)} {t('searchResults.bathrooms')}</span>
              {property.indoor_area && (
                <span>📐 {Math.round(property.indoor_area)} {t('searchResults.sqm')}</span>
              )}
            </Space>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {renderPriceInfo(property)}

          {showMatchScore && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('searchResults.featuresMatch', { matched: matchScore, total: totalFeatures })}
                </Text>
              </div>
              <Progress 
                percent={Math.round((matchScore / totalFeatures) * 100)}
                size="small"
                strokeColor={matchScore === totalFeatures ? '#52c41a' : '#1890ff'}
                showInfo={false}
              />
            </div>
          )}

          {hasMissingFeatures && (
            <Alert
              message={
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  <WarningOutlined /> {t('searchResults.missingFeatures')}
                </span>
              }
              description={
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {property.missing_features.slice(0, 3).map((feature: string) => (
                    <div key={feature} style={{ marginBottom: 2 }}>
                      • {translateFeature(feature)}
                    </div>
                  ))}
                  {property.missing_features.length > 3 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('searchResults.andMore', { count: property.missing_features.length - 3 })}
                    </Text>
                  )}
                </div>
              }
              type="warning"
              showIcon={false}
              style={{ marginTop: 12 }}
            />
          )}

          {hasCalculatedPrice && property.deal_type === 'rent' && (
            <Button
              block
              icon={<CalendarOutlined />}
              onClick={() => handleShowAvailablePeriods(property, property.calculated_price.nights)}
              style={{ marginTop: 12 }}
            >
              {t('searchResults.availablePeriods', { nights: property.calculated_price.nights })}
            </Button>
          )}

          <Button
            type="primary"
            block
            icon={<EyeOutlined />}
            onClick={() => onViewProperty(property.id)}
            style={{ marginTop: 8 }}
          >
            {t('searchResults.viewDetails')}
          </Button>
        </div>
      </Card>
    );
  };
  return (
    <div className="property-search-results">
      {/* Заголовок результатов */}
      <div className="results-header">
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          <Title level={4} style={{ margin: 0, color: '#ffffff' }}>
            {t('searchResults.foundProperties', { count: properties.length })}
          </Title>
        </Space>
        <Space>
          <Button 
            icon={<RobotOutlined />}
            onClick={() => setAiResponseVisible(true)}
          >
            {t('searchResults.viewAIResponse')}
          </Button>
          {executionTime > 0 && (
            <Text type="secondary">
              <ClockCircleOutlined /> {t('searchResults.executedIn', { time: (executionTime / 1000).toFixed(2) })}
            </Text>
          )}
        </Space>
      </div>

      {/* Модальное окно AI ответа */}
      <AIResponseViewer 
        visible={aiResponseVisible}
        onClose={() => setAiResponseVisible(false)}
      />

      {/* Сетка результатов */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {properties.map(property => (
          <Col xs={24} sm={12} lg={8} xl={6} key={property.id}>
            {renderPropertyCard(property)}
          </Col>
        ))}
      </Row>

      {/* Модальное окно с доступными периодами */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            {t('searchResults.availablePeriodsTitle')}
            {selectedProperty && ` - ${selectedProperty.property_name || selectedProperty.property_number}`}
          </Space>
        }
        open={periodsModalVisible}
        onCancel={() => {
          setPeriodsModalVisible(false);
          setSelectedProperty(null);
          setAvailablePeriods([]);
        }}
        footer={null}
        width={700}
        className="available-periods-modal"
      >
        {loadingPeriods ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#ffffff' }}>
              {t('searchResults.searchingPeriods')}
            </div>
          </div>
        ) : availablePeriods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary" style={{ fontSize: 16 }}>
              {t('searchResults.noPeriodsAvailable')}
            </Text>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, color: '#ffffff' }}>
              <Text>
                {t('searchResults.foundPeriods', { count: availablePeriods.length })}
              </Text>
            </div>
            <List
              dataSource={availablePeriods.slice(0, 20)}
              renderItem={(period, index) => (
                <List.Item
                  key={index}
                  className="period-list-item"
                  extra={
                    <Button
                      type="primary"
                      onClick={() => {
                        message.success(t('searchResults.periodSelected', {
                          checkIn: dayjs(period.check_in).format('DD.MM.YYYY'),
                          checkOut: dayjs(period.check_out).format('DD.MM.YYYY')
                        }));
                        setPeriodsModalVisible(false);
                      }}
                    >
                      {t('searchResults.select')}
                    </Button>
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <CalendarOutlined />
                        <Text style={{ color: '#ffffff' }}>
                          {dayjs(period.check_in).format('DD.MM.YYYY')} - {dayjs(period.check_out).format('DD.MM.YYYY')}
                        </Text>
                        <Tag color="blue">{t('searchResults.nightsTag', { nights: period.nights })}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                          <strong>{t('searchResults.total')}:</strong> {formatPrice(period.total_price)} THB
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {formatPrice(period.daily_average)} {t('searchResults.thbPerNight')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
            {availablePeriods.length > 20 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Text type="secondary">
                  {t('searchResults.showingFirst20', { total: availablePeriods.length })}
                </Text>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default PropertySearchResults;