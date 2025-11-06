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
  Tooltip,
  Badge
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
import SeasonalPricing from './components/SeasonalPricing';
import MonthlyPricing from './components/MonthlyPricing';
import { PROPERTY_FEATURES } from './constants/features';
import dayjs from 'dayjs';
import VideoUploader from './components/VideoUploader';
import CalendarManager from './components/CalendarManager';

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
  const [showRenovationDate, setShowRenovationDate] = useState(false);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  
  // ========== НОВОЕ: Состояние для отслеживания изменения ссылки ==========
  const [hasCoordinatesForCurrentLink, setHasCoordinatesForCurrentLink] = useState(true);
  // =========================================================================


  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      loadProperty();
    }
  }, [id]);

  // ========== НОВОЕ: Отслеживаем изменения в ссылке Google Maps ==========
  useEffect(() => {
    // Проверяем, есть ли координаты для текущей ссылки
    const latitude = form.getFieldValue('latitude');
    const longitude = form.getFieldValue('longitude');
    
    if (googleMapsLink && (!latitude || !longitude)) {
      // Если ссылка есть, но координат нет - показываем подсказку
      setHasCoordinatesForCurrentLink(false);
    } else {
      setHasCoordinatesForCurrentLink(true);
    }
  }, [googleMapsLink, form]);
  // =======================================================================

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
        translations: translations,
        seasonalPricing: property.pricing || []
      });


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
      
      setHasCoordinatesForCurrentLink(true);
      message.success(t('properties.coordinatesDetected'));
    } catch (error: any) {
      message.error(t('properties.coordinatesError'));
      console.error(error);
    } finally {
      setDetectingCoords(false);
    }
  };

  // ========== НОВОЕ: Обработчик изменения ссылки Google Maps ==========
  const handleGoogleMapsLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLink = e.target.value;
    setGoogleMapsLink(newLink);
    
    // Если ссылка изменилась, отмечаем что координаты могут быть неактуальны
    if (newLink !== propertyData?.google_maps_link) {
      setHasCoordinatesForCurrentLink(false);
    }
  };
  // ====================================================================

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
        // Преобразуем features в правильный формат для бэкенда
        propertyFeatures: values.features?.property || [],
        outdoorFeatures: values.features?.outdoor || [],
        rentalFeatures: values.features?.rental || [],
        locationFeatures: values.features?.location || [],
        views: values.features?.views || [],
        translations: values.translations,
        seasonalPricing: values.seasonalPricing || [],
        year_price: values.year_price || null
      };
    
      // Удаляем features из formData
      delete formData.features;
    
      if (isEdit) {
        await propertiesApi.update(Number(id), formData);
        message.success(t('properties.updateSuccess'));
        loadProperty();
      } else {
        const { data } = await propertiesApi.create(formData);
        message.success(t('properties.createSuccess'));
        // Автоматически переходим на страницу редактирования где доступна загрузка медиа
        navigate(`/properties/edit/${data.data.propertyId}`);
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

  // Добавьте эту функцию после handlePricingTypeChange и перед return
  const handleSaveClick = async () => {
    try {
      // Получаем все значения формы без валидации
      const values = form.getFieldsValue(true);

      // Проверяем что хотя бы одно название заполнено
      const hasAnyName = values.translations?.ru?.property_name || 
                         values.translations?.en?.property_name || 
                         values.translations?.th?.property_name;

      if (!hasAnyName) {
        message.error('Необходимо заполнить название хотя бы на одном языке');
        setActiveTab('translations');
        return;
      }
    
      // Проверяем что хотя бы одно описание заполнено
      const hasAnyDescription = values.translations?.ru?.description || 
                                values.translations?.en?.description || 
                                values.translations?.th?.description;

      if (!hasAnyDescription) {
        message.error('Необходимо заполнить описание хотя бы на одном языке');
        setActiveTab('translations');
        return;
      }

      // Валидируем только обязательные поля
      try {
        await form.validateFields(['property_number', 'deal_type', 'property_type', 'region', 'address', 'status']);
      } catch (errorInfo: any) {
        // Если есть ошибки валидации, находим первую вкладку с ошибкой
        const errorFields = errorInfo.errorFields || [];
        if (errorFields.length > 0) {
          const firstErrorField = errorFields[0].name[0];

          // Определяем на какой вкладке ошибка
          if (['property_number', 'deal_type', 'property_type', 'region', 'address', 
               'building_ownership', 'land_ownership', 'ownership_type', 
               'google_maps_link', 'latitude', 'longitude', 'complex_name',
               'bedrooms', 'bathrooms', 'indoor_area', 'outdoor_area', 'plot_size',
               'floors', 'floor', 'construction_year', 'construction_month',
               'furniture_status', 'parking_spaces', 'pets_allowed', 'status', 'video_url'].includes(firstErrorField)) {
            setActiveTab('basic');
          }

          message.error('Пожалуйста, заполните все обязательные поля');
        }
        return;
      }

      // Если все проверки прошли, вызываем handleSubmit с актуальными значениями
      await handleSubmit(values);
    } catch (error) {
      console.error('Save error:', error);
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
          },
          seasonalPricing: []
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
                  rules={[{ required: true, message: t('validation.required') }]}
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
                  rules={[{ required: true, message: t('validation.required') }]}
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
                  rules={[{ required: true, message: t('validation.required') }]}
                >
                  <Select>
                    <Select.Option value="bangtao">{t('properties.regions.bangtao')}</Select.Option>
                    <Select.Option value="kamala">{t('properties.regions.kamala')}</Select.Option>
                    <Select.Option value="surin">{t('properties.regions.surin')}</Select.Option>
                    <Select.Option value="layan">{t('properties.regions.layan')}</Select.Option>
                    <Select.Option value="rawai">{t('properties.regions.rawai')}</Select.Option>
                    <Select.Option value="patong">{t('properties.regions.patong')}</Select.Option>
                    <Select.Option value="kata">{t('properties.regions.kata')}</Select.Option>
                    <Select.Option value="karon">{t('properties.regions.karon')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              {(dealType === 'sale' || dealType === 'both') && (
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="building_ownership"
                    label={t('properties.buildingOwnership')}
                  >
                    <Select placeholder={t('common.select')}>
                      <Select.Option value="freehold">{t('properties.ownershipTypes.freehold')}</Select.Option>
                      <Select.Option value="leasehold">{t('properties.ownershipTypes.leasehold')}</Select.Option>
                      <Select.Option value="company">{t('properties.ownershipTypes.company')}</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}

              {(dealType === 'sale' || dealType === 'both') && (
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="land_ownership"
                    label={t('properties.landOwnership')}
                  >
                    <Select placeholder={t('common.select')}>
                      <Select.Option value="freehold">{t('properties.ownershipTypes.freehold')}</Select.Option>
                      <Select.Option value="leasehold">{t('properties.ownershipTypes.leasehold')}</Select.Option>
                      <Select.Option value="company">{t('properties.ownershipTypes.company')}</Select.Option>
                    </Select>
                  </Form.Item>
              </Col>
              )}

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
                  name="address"
                  label={t('properties.address')}
                  rules={[{ required: true, message: t('validation.required') }]}
                >
                  <TextArea rows={2} placeholder="Точный адрес объекта" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="google_maps_link"
                  label={
                    <Space>
                      <span>{t('properties.googleMapsLink')}</span>
                      {/* ========== НОВОЕ: Показываем Badge если нужно определить координаты ========== */}
                      {googleMapsLink && !hasCoordinatesForCurrentLink && (
                        <Badge 
                          status="warning" 
                          text="Требуется определение координат"
                          style={{ fontSize: 12 }}
                        />
                      )}
                      {/* =============================================================================== */}
                      <Button
                        type={!hasCoordinatesForCurrentLink && googleMapsLink ? "primary" : "link"}
                        size="small"
                        icon={<EnvironmentOutlined />}
                        onClick={handleAutoDetectCoordinates}
                        loading={detectingCoords}
                        danger={!hasCoordinatesForCurrentLink && !!googleMapsLink}
                      >
                        {t('properties.autoDetectCoordinates')}
                      </Button>
                    </Space>
                  }
                >
                  <Input 
                    placeholder="https://maps.google.com/..." 
                    onChange={handleGoogleMapsLinkChange}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="latitude"
                  label={t('properties.latitude')}
                >
                  <InputNumber style={{ width: '100%' }} step={0.000001} placeholder="7.123456" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="longitude"
                  label={t('properties.longitude')}
                >
                  <InputNumber style={{ width: '100%' }} step={0.000001} placeholder="98.123456" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="complex_name"
                  label={
                    <Space>
                      <span>{t('properties.complexName')}</span>
                      <Tooltip title={t('properties.complexInfo')}>
                        <Button
                          type="link"
                          size="small"
                          icon={<InfoCircleOutlined />}
                          onClick={showComplexInfo}
                        />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Input placeholder={t('properties.complexNamePlaceholder')} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="bedrooms"
                  label={t('properties.bedrooms')}
                >
                  <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="bathrooms"
                  label={t('properties.bathrooms')}
                >
                  <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="indoor_area"
                  label={t('properties.indoorArea')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    addonAfter="м²"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="outdoor_area"
                  label={t('properties.outdoorArea')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    addonAfter="м²"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="plot_size"
                  label={t('properties.plotSize')}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    addonAfter="м²"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="floors"
                  label={t('properties.floors')}
                >
                  <InputNumber style={{ width: '100%' }} min={1} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="floor"
                  label={t('properties.floor')}
                >
                  <Input placeholder="1, 2, 3 или 1-2" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="construction_year"
                  label={t('properties.constructionYear')}
                >
                  <InputNumber style={{ width: '100%' }} min={1900} max={2100} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="construction_month"
                  label={t('properties.constructionMonth')}
                >
                  <Select placeholder="Месяц">
                    <Select.Option value="01">Январь</Select.Option>
                    <Select.Option value="02">Февраль</Select.Option>
                    <Select.Option value="03">Март</Select.Option>
                    <Select.Option value="04">Апрель</Select.Option>
                    <Select.Option value="05">Май</Select.Option>
                    <Select.Option value="06">Июнь</Select.Option>
                    <Select.Option value="07">Июль</Select.Option>
                    <Select.Option value="08">Август</Select.Option>
                    <Select.Option value="09">Сентябрь</Select.Option>
                    <Select.Option value="10">Октябрь</Select.Option>
                    <Select.Option value="11">Ноябрь</Select.Option>
                    <Select.Option value="12">Декабрь</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="furniture_status"
                  label={t('properties.furnitureStatus')}
                >
                  <Select>
                    <Select.Option value="fullyFurnished">Полностью меблирована</Select.Option>
                    <Select.Option value="partiallyFurnished">Частично меблирована</Select.Option>
                    <Select.Option value="unfurnished">Без мебели</Select.Option>
                    <Select.Option value="builtIn">Встроенная мебель</Select.Option>
                    <Select.Option value="empty">Пустая</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="parking_spaces"
                  label={t('properties.parkingSpaces')}
                >
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="pets_allowed"
                  label={t('properties.petsAllowed')}
                >
                  <Select>
                    <Select.Option value="yes">Разрешены</Select.Option>
                    <Select.Option value="no">Не разрешены</Select.Option>
                    <Select.Option value="negotiable">По договоренности</Select.Option>
                    <Select.Option value="custom">Особые условия</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="status"
                  label={t('properties.status')}
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Select.Option value="draft">{t('properties.statuses.draft')}</Select.Option>
                    <Select.Option value="published">{t('properties.statuses.published')}</Select.Option>
                    <Select.Option value="hidden">{t('properties.statuses.hidden')}</Select.Option>
                    <Select.Option value="archived">{t('properties.statuses.archived')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="video_url"
                  label="URL видео (YouTube, Vimeo)"
                >
                  <Input placeholder="https://www.youtube.com/watch?v=..." />
                </Form.Item>
              </Col>
            </Row>
          </Tabs.TabPane>

          {/* ТАБ 2: ВЛАДЕЛЕЦ */}
          <Tabs.TabPane tab={t('properties.tabs.owner')} key="owner">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card title={t('properties.ownerInfo')} size="small">
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
                      <TextArea rows={4} placeholder="Дополнительные заметки о владельце" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 3: ОПИСАНИЕ */}
          <Tabs.TabPane tab={t('properties.tabs.translations')} key="translations">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Русский */}
              <Card title="🇷🇺 Русский" size="small">
                <Form.Item
                  name={['translations', 'ru', 'property_name']}
                  label={t('properties.propertyName')}
                >
                  <Input placeholder={t('properties.translations.namePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name={['translations', 'ru', 'description']}
                  label={t('properties.description')}
                >
                  <TextArea
                    rows={8}
                    placeholder={t('properties.translations.descriptionPlaceholder')}
                  />
                </Form.Item>
              </Card>

              {/* Английский */}
              <Card title="🇬🇧 English" size="small">
                <Form.Item
                  name={['translations', 'en', 'property_name']}
                  label={t('properties.propertyName')}
                >
                  <Input placeholder={t('properties.translations.namePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name={['translations', 'en', 'description']}
                  label={t('properties.description')}
                >
                  <TextArea
                    rows={8}
                    placeholder={t('properties.translations.descriptionPlaceholder')}
                  />
                </Form.Item>
              </Card>

              {/* Тайский */}
              <Card title="🇹🇭 ภาษาไทย" size="small">
                <Form.Item
                  name={['translations', 'th', 'property_name']}
                  label={t('properties.propertyName')}
                >
                  <Input placeholder={t('properties.translations.namePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name={['translations', 'th', 'description']}
                  label={t('properties.description')}
                >
                  <TextArea
                    rows={8}
                    placeholder={t('properties.translations.descriptionPlaceholder')}
                  />
                </Form.Item>
              </Card>
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 4: ОСОБЕННОСТИ */}
          <Tabs.TabPane tab={t('properties.tabs.features')} key="features">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Реновация */}
              <Card title={t('properties.renovation.title')} size="small">
                <Form.Item
                  name="renovation_type"
                  label={t('properties.renovation.type')}
                >
                  <Radio.Group onChange={handleRenovationChange}>
                    <Radio value={null}>Без реновации</Radio>
                    <Radio value="partial">{t('properties.renovation.types.partial')}</Radio>
                    <Radio value="full">{t('properties.renovation.types.full')}</Radio>
                  </Radio.Group>
                </Form.Item>

                {showRenovationDate && (
                  <Form.Item
                    name="renovation_date"
                    label={t('properties.renovation.date')}
                  >
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

              {/* Условия аренды */}
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
              {/* Цены продажи */}
              {(dealType === 'sale' || dealType === 'both') && (
                <Card title="Цена продажи">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="sale_price"
                        label={t('properties.salePrice')}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          addonAfter="฿"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              )}

              {/* Цены аренды */}
              {(dealType === 'rent' || dealType === 'both') && (
                <>
                  {/* Постоянная цена за год */}
                  <Card title="Постоянная цена аренды">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="year_price"
                          label="Цена за год"
                        >
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            addonAfter="฿"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
              
                  {/* Сезонные цены */}
                  <SeasonalPricing
                    value={form.getFieldValue('seasonalPricing')}
                    onChange={(value) => form.setFieldsValue({ seasonalPricing: value })}
                  />

                  {/* ✅ НОВОЕ: Месячные цены (только для режима редактирования) */}
                  {isEdit && (
                    <MonthlyPricing
                      propertyId={Number(id)}
                      initialPricing={propertyData?.monthly_pricing || []}
                    />
                  )}

                  {/* Информация если объект еще не создан */}
                  {!isEdit && (
                    <Alert
                      message="Месячные цены"
                      description="Месячные цены можно будет настроить после создания объекта"
                      type="info"
                      showIcon
                    />
                  )}
                </>
              )}

              {/* Комиссии */}
              <CommissionForm dealType={dealType} />
            </Space>
          </Tabs.TabPane>

          {/* ТАБ 6: МЕДИА */}
          <Tabs.TabPane tab={t('properties.tabs.media')} key="media">
            {isEdit ? (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <PhotosUploader
                  propertyId={Number(id)}
                  photos={propertyData?.photos || []}
                  bedrooms={form.getFieldValue('bedrooms') || 1}
                  onUpdate={loadProperty}
                />
          
                <VideoUploader
                  propertyId={Number(id)}
                  videos={propertyData?.videos || []}
                  onUpdate={loadProperty}
                />
          
                <FloorPlanUploader
                  propertyId={Number(id)}
                  floorPlanUrl={propertyData?.floor_plan_url}
                  onUpdate={loadProperty}
                />
          
                <VRPanoramaUploader
                  propertyId={Number(id)}
                  onUpdate={loadProperty}
                />
              </Space>
            ) : (
              <Card>
                <Alert
                  message="Загрузка медиа будет доступна после создания объекта"
                  description={
                    <div>
                      <Paragraph>
                        После создания объекта вы сможете:
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 0 }}>
                        После сохранения вы автоматически перейдете на страницу редактирования, где будут доступны все функции работы с медиа:
                      </Paragraph>
                      <ul style={{ marginTop: 8, marginBottom: 0 }}>
                        <li>Загрузка и управление фотографиями (разные категории)</li>
                        <li>Загрузка планировок</li>
                        <li>Создание VR-туров (360° панорамы)</li>
                      </ul>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </Card>
            )}
          </Tabs.TabPane>
                  <Tabs.TabPane tab="📅 Занятость" key="calendar">
          {isEdit ? (
            <CalendarManager propertyId={Number(id)} />
          ) : (
            <Card>
              <Alert
                message="Управление занятостью будет доступно после создания объекта"
                type="info"
                showIcon
              />
            </Card>
          )}
        </Tabs.TabPane>
        
        </Tabs>
        {/* Кнопки сохранения видны со всех вкладок */}
        <div style={{ 
          position: 'sticky', 
          bottom: 0, 
          marginTop: 24, 
          padding: '16px 24px',
          background: 'transparent',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 100
        }}>
          <Row justify="end">
            <Space size="middle">
              <Button 
                size="large"
                onClick={() => navigate('/properties')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={handleSaveClick}
              >
                {isEdit ? t('common.save') : t('common.create')}
              </Button>
            </Space>
          </Row>
        </div>
      </Form>
    </Card>
  );
};

export default PropertyForm;