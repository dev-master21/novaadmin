// frontend/src/modules/Properties/PropertyForm.tsx
import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Space,
  message,
  Tabs,
  Checkbox,
  Typography,
  DatePicker,
  Radio,
  Modal,
  Alert,
  Tooltip
} from 'antd';
import {
  SaveOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { extractCoordinatesFromGoogleMapsLink } from '@/utils/googleMapsUtils';
import PhotosUploader from './components/PhotosUploader';
import FloorPlanUploader from './components/FloorPlanUploader';
import VRPanoramaUploader from './components/VRPanoramaUploader';
import CommissionForm from './components/CommissionForm';
import { PROPERTY_FEATURES } from './constants/features';
import dayjs from 'dayjs';

const { Paragraph } = Typography;
const { TextArea } = Input;

const PropertyForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [detectingCoords, setDetectingCoords] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [dealType, setDealType] = useState<'sale' | 'rent' | 'both'>('sale');
  const [pricingType, setPricingType] = useState<'seasonal' | 'constant'>('seasonal');
  const [showRenovationDate, setShowRenovationDate] = useState(false);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [googleMapsLink, setGoogleMapsLink] = useState('');

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      loadProperty();
    }
  }, [id]);

  const loadProperty = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getById(Number(id));
      const property = data.data;
      
      setPropertyData(property);
      setDealType(property.deal_type);
      setGoogleMapsLink(property.google_maps_link || '');
      
      // Парсим features из JSON если нужно
      let parsedFeatures = {};
      if (property.features) {
        try {
          if (Array.isArray(property.features)) {
            const featuresMap: any = {
              property: [],
              outdoor: [],
              rental: [],
              location: [],
              views: []
            };
            
            property.features.forEach((f: any) => {
              if (f.feature_type && f.feature_value) {
                if (!featuresMap[f.feature_type]) {
                  featuresMap[f.feature_type] = [];
                }
                featuresMap[f.feature_type].push(f.feature_value);
              }
            });
            
            parsedFeatures = featuresMap;
          } else if (typeof property.features === 'object') {
            parsedFeatures = property.features;
          }
        } catch (e) {
          console.error('Error parsing features:', e);
        }
      }

      // Парсим переводы
      let translations: any = { ru: {}, en: {}, th: {} };
      if (property.translations && Array.isArray(property.translations)) {
        property.translations.forEach((t: any) => {
          translations[t.language_code] = {
            property_name: t.property_name,
            description: t.description
          };
        });
      }

      form.setFieldsValue({
        ...property,
        renovation_date: property.renovation_date ? dayjs(property.renovation_date) : null,
        features: parsedFeatures,
        translations: translations
      });

      if (property.year_price) {
        setPricingType('constant');
      }

      if (property.renovation_type) {
        setShowRenovationDate(true);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDetectCoordinates = async () => {
    const link = form.getFieldValue('google_maps_link');
    
    if (!link) {
      message.warning('Введите ссылку на Google Maps');
      return;
    }

    setDetectingCoords(true);
    try {
      const coords = await extractCoordinatesFromGoogleMapsLink(link);
      
      form.setFieldsValue({
        latitude: coords.lat,
        longitude: coords.lng
      });
      
      message.success(t('properties.coordinatesDetected'));
    } catch (error: any) {
      message.error(t('properties.coordinatesError'));
      console.error(error);
    } finally {
      setDetectingCoords(false);
    }
  };

  const showComplexInfo = () => {
    Modal.info({
      title: t('properties.complexInfo'),
      content: (
        <div style={{ marginTop: 16 }}>
          <Paragraph>{t('properties.complexInfoText')}</Paragraph>
        </div>
      ),
      width: 600
    });
  };

  const handleSubmit = async (values: any) => {
    // Проверяем что хотя бы одно название заполнено
    const hasAnyName = values.translations.ru?.property_name || 
                       values.translations.en?.property_name || 
                       values.translations.th?.property_name;
    
    if (!hasAnyName) {
      message.error('Необходимо заполнить название хотя бы на одном языке');
      return;
    }

    // Проверяем что хотя бы одно описание заполнено
    const hasAnyDescription = values.translations.ru?.description || 
                              values.translations.en?.description || 
                              values.translations.th?.description;
    
    if (!hasAnyDescription) {
      message.error('Необходимо заполнить описание хотя бы на одном языке');
      return;
    }

    setLoading(true);
    try {
      const formData = {
        ...values,
        renovation_date: values.renovation_date 
          ? dayjs(values.renovation_date).format('YYYY-MM-01')
          : null,
        features: JSON.stringify(values.features || {}),
        translations: values.translations
      };

      if (isEdit) {
        await propertiesApi.update(Number(id), formData);
        message.success(t('properties.updateSuccess'));
        loadProperty();
      } else {
        const { data } = await propertiesApi.create(formData);
        message.success(t('properties.createSuccess'));
        navigate(`/properties/edit/${data.data.id}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleDealTypeChange = (value: string) => {
    setDealType(value as 'sale' | 'rent' | 'both');
  };

  const handleRenovationChange = (e: any) => {
    const value = e.target.value;
    if (value) {
      setShowRenovationDate(true);
    } else {
      setShowRenovationDate(false);
      form.setFieldValue('renovation_date', null);
    }
  };

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          status: 'draft',
          deal_type: 'sale',
          pets_allowed: true,
          features: {
            property: [],
            outdoor: [],
            rental: [],
            location: [],
            views: []
          },
          translations: {
            ru: { property_name: '', description: '' },
            en: { property_name: '', description: '' },
            th: { property_name: '', description: '' }
          }
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* ТАБ 1: ОСНОВНАЯ ИНФОРМАЦИЯ */}
          <Tabs.TabPane tab={t('properties.tabs.basic')} key="basic">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="property_number"
                  label={t('properties.propertyNumber')}
                  rules={[{ required: true, message: t('validation.required') }]}
                >
                  <Input placeholder="L6, V123, etc." />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="deal_type"
                  label={t('properties.dealType')}
                  rules={[{ required: true }]}
                >
                  <Select onChange={handleDealTypeChange}>
                    <Select.Option value="sale">{t('properties.dealTypes.sale')}</Select.Option>
                    <Select.Option value="rent">{t('properties.dealTypes.rent')}</Select.Option>
                    <Select.Option value="both">{t('properties.dealTypes.both')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="property_type"
                  label={t('properties.propertyType')}
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Select.Option value="villa">{t('properties.propertyTypes.villa')}</Select.Option>
                    <Select.Option value="apartment">{t('properties.propertyTypes.apartment')}</Select.Option>
                    <Select.Option value="condo">{t('properties.propertyTypes.condo')}</Select.Option>
                    <Select.Option value="penthouse">{t('properties.propertyTypes.penthouse')}</Select.Option>
                    <Select.Option value="house">{t('properties.propertyTypes.house')}</Select.Option>
                    <Select.Option value="land">{t('properties.propertyTypes.land')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="region"
                  label={t('properties.region')}
                  rules={[{ required: true }]}
                >
                  <Select>
                    {['bangtao', 'kamala', 'surin', 'layan', 'rawai', 'patong', 'kata', 'karon'].map(region => (
                      <Select.Option key={region} value={region}>
                        {t(`properties.regions.${region}`)}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              {(dealType === 'sale' || dealType === 'both') && (
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="ownership_type"
                    label={t('properties.ownership')}
                  >
                    <Select placeholder={t('common.select')}>
                      <Select.Option value="freehold">{t('properties.ownershipTypes.freehold')}</Select.Option>
                      <Select.Option value="leasehold">{t('properties.ownershipTypes.leasehold')}</Select.Option>
                      <Select.Option value="company">{t('properties.ownershipTypes.company')}</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}

              <Col xs={24}>
                <Form.Item
                  name="complex_name"
                  label={
                    <Space>
                      {t('properties.complexName')}
                      <Tooltip title={t('properties.complexInfo')}>
                        <Button
                          type="link"
                          size="small"
                          icon={<InfoCircleOutlined />}
                          onClick={showComplexInfo}
                          style={{ padding: 0 }}
                        >
                          ВАЖНО
                        </Button>
                      </Tooltip>
                    </Space>
                  }
                >
                  <Input placeholder={t('properties.complexNamePlaceholder')} />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="address"
                  label={t('properties.address')}
                  rules={[{ required: true, message: 'Адрес обязателен для заполнения' }]}
                >
                  <TextArea rows={2} placeholder="Введите полный адрес объекта" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="google_maps_link"
                  label={t('properties.googleMapsLink')}
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Input 
                      placeholder="https://maps.app.goo.gl/..."
                      onChange={(e) => setGoogleMapsLink(e.target.value)}
                    />
                    <Button
                      icon={<EnvironmentOutlined />}
                      onClick={handleAutoDetectCoordinates}
                      loading={detectingCoords}
                      disabled={!googleMapsLink}
                    >
                      Авто
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="latitude" label={t('properties.latitude')}>
                  <InputNumber style={{ width: '100%' }} step={0.000001} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="longitude" label={t('properties.longitude')}>
                  <InputNumber style={{ width: '100%' }} step={0.000001} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="bedrooms" label={t('properties.bedrooms')}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="bathrooms" label={t('properties.bathrooms')}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="parking_spaces" label={t('properties.parkingSpaces')}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="indoor_area" label={t('properties.indoorArea')}>
                  <InputNumber style={{ width: '100%' }} min={0} addonAfter="m²" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="outdoor_area" label={t('properties.outdoorArea')}>
                  <InputNumber style={{ width: '100%' }} min={0} addonAfter="m²" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="plot_size" label={t('properties.plotSize')}>
                  <InputNumber style={{ width: '100%' }} min={0} addonAfter="m²" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="floors" label="Количество этажей">
                  <InputNumber style={{ width: '100%' }} min={1} max={100} placeholder="Всего этажей" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="construction_year" label={t('properties.constructionYear')}>
                  <InputNumber style={{ width: '100%' }} min={1900} max={2100} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item name="furniture_status" label={t('properties.furnitureStatus')}>
                  <Select>
                    <Select.Option value="furnished">{t('properties.furnitureStatuses.furnished')}</Select.Option>
                    <Select.Option value="unfurnished">{t('properties.furnitureStatuses.unfurnished')}</Select.Option>
                    <Select.Option value="partially">{t('properties.furnitureStatuses.partially')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="status" label={t('properties.status')}>
                  <Select>
                    <Select.Option value="draft">{t('properties.statuses.draft')}</Select.Option>
                    <Select.Option value="published">{t('properties.statuses.published')}</Select.Option>
                    <Select.Option value="hidden">{t('properties.statuses.hidden')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Tabs.TabPane>

          {/* ТАБ 2: ВЛАДЕЛЕЦ */}
          <Tabs.TabPane tab={t('properties.tabs.owner')} key="owner">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="owner_name" label={t('properties.ownerName')}>
                  <Input />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="owner_phone" label={t('properties.ownerPhone')}>
                  <Input />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="owner_email" label={t('properties.ownerEmail')}>
                  <Input type="email" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="owner_telegram" label={t('properties.ownerTelegram')}>
                  <Input placeholder="@username" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="owner_instagram" label={t('properties.ownerInstagram')}>
                  <Input placeholder="@username" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item name="owner_notes" label={t('properties.ownerNotes')}>
                  <TextArea rows={4} />
                </Form.Item>
              </Col>
            </Row>
          </Tabs.TabPane>

          {/* ТАБ 3: ОПИСАНИЕ */}
          <Tabs.TabPane tab={t('properties.description')} key="translations">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Alert
                message="Необходимо заполнить хотя бы одно название и одно описание на любом языке"
                type="info"
                showIcon
              />

              {['ru', 'en', 'th'].map(lang => (
                <Card key={lang} title={lang.toUpperCase()} size="small">
                  <Form.Item
                    name={['translations', lang, 'property_name']}
                    label={t('properties.propertyName')}
                  >
                    <Input placeholder={t('properties.translations.namePlaceholder')} />
                  </Form.Item>

                  <Form.Item
                    name={['translations', lang, 'description']}
                    label={t('properties.translations.title')}
                  >
                    <TextArea
                      rows={6}
                      placeholder={t('properties.translations.descriptionPlaceholder')}
                      showCount
                    />
                  </Form.Item>
                </Card>
              ))}
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 4: ОСОБЕННОСТИ */}
          <Tabs.TabPane tab={t('properties.tabs.features')} key="features">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Реновация */}
              <Card title={t('properties.renovation.title')} size="small">
                <Form.Item name="renovation_type" label={t('properties.renovation.type')}>
                  <Radio.Group onChange={handleRenovationChange}>
                    <Radio value={null}>Нет реновации</Radio>
                    <Radio value="full">{t('properties.renovation.types.full')}</Radio>
                    <Radio value="partial">{t('properties.renovation.types.partial')}</Radio>
                  </Radio.Group>
                </Form.Item>

                {showRenovationDate && (
                  <Form.Item name="renovation_date" label={t('properties.renovation.date')}>
                    <DatePicker
                      picker="month"
                      style={{ width: '100%' }}
                      format="MMMM YYYY"
                    />
                  </Form.Item>
                )}
              </Card>

              {/* Особенности объекта */}
              <Card title={t('properties.features.propertyFeatures')} size="small">
                <Form.Item name={['features', 'property']}>
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {PROPERTY_FEATURES.property.map(feature => (
                        <Col xs={24} sm={12} md={8} key={feature}>
                          <Checkbox value={feature}>
                            {t(`properties.features.${feature}`)}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
              </Card>

              {/* Внешние особенности */}
              <Card title={t('properties.features.outdoorFeatures')} size="small">
                <Form.Item name={['features', 'outdoor']}>
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {PROPERTY_FEATURES.outdoor.map(feature => (
                        <Col xs={24} sm={12} md={8} key={feature}>
                          <Checkbox value={feature}>
                            {t(`properties.features.${feature}`)}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
              </Card>

              {(dealType === 'rent' || dealType === 'both') && (
                <Card title={t('properties.features.rentalFeatures')} size="small">
                  <Form.Item name={['features', 'rental']}>
                    <Checkbox.Group style={{ width: '100%' }}>
                      <Row gutter={[16, 16]}>
                        {PROPERTY_FEATURES.rental.map(feature => (
                          <Col xs={24} sm={12} md={8} key={feature}>
                            <Checkbox value={feature}>
                              {t(`properties.features.${feature}`)}
                            </Checkbox>
                          </Col>
                        ))}
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                </Card>
              )}

              {/* Расположение */}
              <Card title={t('properties.features.locationFeatures')} size="small">
                <Form.Item name={['features', 'location']}>
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {PROPERTY_FEATURES.location.map(feature => (
                        <Col xs={24} sm={12} md={8} key={feature}>
                          <Checkbox value={feature}>
                            {t(`properties.features.${feature}`)}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
              </Card>

              {/* Виды */}
              <Card title={t('properties.features.views')} size="small">
                <Form.Item name={['features', 'views']}>
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {PROPERTY_FEATURES.views.map(feature => (
                        <Col xs={24} sm={12} md={8} key={feature}>
                          <Checkbox value={feature}>
                            {t(`properties.features.${feature}`)}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
              </Card>
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 5: ЦЕНООБРАЗОВАНИЕ */}
          <Tabs.TabPane tab={t('properties.tabs.pricing')} key="pricing">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {(dealType === 'sale' || dealType === 'both') && (
                <Card title={t('properties.dealTypes.sale')} size="small">
                  <Form.Item
                    name="sale_price"
                    label={t('properties.price')}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      addonAfter="฿"
                      placeholder="0"
                    />
                  </Form.Item>
                </Card>
              )}

              {(dealType === 'rent' || dealType === 'both') && (
                <Card title={t('properties.dealTypes.rent')} size="small">
                  <Radio.Group
                    value={pricingType}
                    onChange={(e) => setPricingType(e.target.value)}
                    style={{ marginBottom: 16 }}
                  >
                    <Radio value="seasonal">{t('properties.pricingOptions.seasonal')}</Radio>
                    <Radio value="constant">{t('properties.pricingOptions.constant')}</Radio>
                  </Radio.Group>

                  {pricingType === 'constant' ? (
                    <Form.Item
                      name="year_price"
                      label={t('properties.pricingOptions.constantPrice')}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        addonAfter="฿"
                        placeholder="0"
                      />
                    </Form.Item>
                  ) : (
                    <Alert
                      message="Сезонные цены настраиваются после создания объекта"
                      type="info"
                    />
                  )}
                </Card>
              )}

              <CommissionForm dealType={dealType} />
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 6: МЕДИА */}
          {isEdit && (
            <Tabs.TabPane tab={t('properties.tabs.media')} key="media">
              <Tabs>
                <Tabs.TabPane tab={t('properties.media.photos')} key="photos">
                  <PhotosUploader 
                    propertyId={Number(id)} 
                    photos={propertyData?.photos || []}
                    bedrooms={propertyData?.bedrooms || 0}
                    onUpdate={loadProperty}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane tab={t('properties.media.floorPlan')} key="floorPlan">
                  <FloorPlanUploader 
                    propertyId={Number(id)} 
                    floorPlanUrl={propertyData?.floor_plan_url}
                    onUpdate={loadProperty}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane tab={t('properties.media.vrTour')} key="vr">
                  <VRPanoramaUploader 
                    propertyId={Number(id)}
                    onUpdate={loadProperty}
                  />
                </Tabs.TabPane>
              </Tabs>
            </Tabs.TabPane>
          )}
        </Tabs>

        {/* Кнопки сохранения */}
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate('/properties')}>
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
            >
              {t('common.save')}
            </Button>
          </Space>
        </div>
      </Form>
    </Card>
  );
};

export default PropertyForm;