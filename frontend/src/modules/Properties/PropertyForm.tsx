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
  Tag,
  Badge
} from 'antd';
import {
  SaveOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  RobotOutlined
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
import { useAuthStore } from '@/store/authStore'; 
import DepositForm from './components/DepositForm';
import UtilitiesForm from './components/UtilitiesForm';
import AIDescriptionGenerator from './components/AIDescriptionGenerator';
import TranslationsEditor from './components/TranslationsEditor';
import AIPropertyCreationModal from './components/AIPropertyCreationModal';

const { Paragraph } = Typography;
const { TextArea } = Input;

interface PropertyFormProps {
  viewMode?: boolean;
}

const PropertyForm = ({ viewMode = false }: PropertyFormProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  
  const { canEditProperty, canViewPropertyOwner, canChangePropertyStatus } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [detectingCoords, setDetectingCoords] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [dealType, setDealType] = useState<'sale' | 'rent' | 'both'>('sale');
  const [showRenovationDate, setShowRenovationDate] = useState(false);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [hasCoordinatesForCurrentLink, setHasCoordinatesForCurrentLink] = useState(true);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [fillingFromAI, setFillingFromAI] = useState(false);
  const [aiTempData, setAiTempData] = useState<{
    monthlyPricing?: any[];
    blockedDates?: any[];
    photosFromGoogleDrive?: string | null;
  }>({});

  const isEdit = !!id;
  const isViewMode = viewMode;
  
  const [canEdit, setCanEdit] = useState(false);
  const [showOwnerTab, setShowOwnerTab] = useState(false);
  const [canEditStatus, setCanEditStatus] = useState(false);

  useEffect(() => {
    if (isEdit) {
      loadProperty();
    }
  }, [id]);

  useEffect(() => {
    const latitude = form.getFieldValue('latitude');
    const longitude = form.getFieldValue('longitude');
    
    if (googleMapsLink && (!latitude || !longitude)) {
      setHasCoordinatesForCurrentLink(false);
    } else {
      setHasCoordinatesForCurrentLink(true);
    }
  }, [googleMapsLink, form]);

  useEffect(() => {
    if (propertyData) {
      const userCanEdit = canEditProperty(propertyData.created_by);
      const showOwner = canViewPropertyOwner(propertyData.created_by);
      const canEditStatusFlag = canChangePropertyStatus();
      
      setCanEdit(userCanEdit);
      setShowOwnerTab(showOwner);
      setCanEditStatus(canEditStatusFlag);
      
      if (isEdit && !isViewMode && !userCanEdit) {
        message.warning(t('properties.messages.noEditPermission'));
        navigate(`/properties/view/${id}`);
      }
    } else if (!isEdit) {
      setCanEdit(true);
      setShowOwnerTab(true);
      setCanEditStatus(canChangePropertyStatus());
    }
  }, [propertyData, isEdit, isViewMode, canEditProperty, canViewPropertyOwner, canChangePropertyStatus, id, navigate, t]);

  const loadProperty = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getById(Number(id));
      const property = data.data;
      
      setPropertyData(property);
      setDealType(property.deal_type);
      setGoogleMapsLink(property.google_maps_link || '');
      
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
                let mappedType = f.feature_type;
                if (f.feature_type === 'view') {
                  mappedType = 'views';
                }
                
                if (!featuresMap[mappedType]) {
                  featuresMap[mappedType] = [];
                }
                featuresMap[mappedType].push(f.feature_value);
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

      const translations: any = {
        ru: { description: '' },
        en: { description: '' },
        th: { description: '' },
        zh: { description: '' },
        he: { description: '' }
      };

      if (property.translations) {
        if (Array.isArray(property.translations)) {
          property.translations.forEach((t: any) => {
            if (translations[t.language_code]) {
              translations[t.language_code] = {
                description: t.description || ''
              };
            }
          });
        } else if (typeof property.translations === 'object') {
          Object.keys(property.translations).forEach((lang) => {
            if (translations[lang]) {
              translations[lang] = {
                description: property.translations[lang].description || ''
              };
            }
          });
        }
      }

      console.log('Loaded translations:', translations);

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

  const handleAIGenerated = (descriptions: any, featuresFound: string[]) => {
    const currentTranslations = form.getFieldValue('translations') || {};
    
    form.setFieldsValue({
      translations: {
        ru: {
          description: descriptions.ru?.description || currentTranslations.ru?.description || ''
        },
        en: {
          description: descriptions.en?.description || currentTranslations.en?.description || ''
        },
        th: {
          description: descriptions.th?.description || currentTranslations.th?.description || ''
        },
        zh: {
          description: descriptions.zh?.description || currentTranslations.zh?.description || ''
        },
        he: {
          description: descriptions.he?.description || currentTranslations.he?.description || ''
        }
      }
    });
  
    if (featuresFound && featuresFound.length > 0) {
      const currentFeatures = form.getFieldValue('features') || {
        property: [],
        outdoor: [],
        rental: [],
        location: [],
        views: []
      };
    
      const updatedFeatures = { ...currentFeatures };
      
      featuresFound.forEach((feature: string) => {
        if (PROPERTY_FEATURES.property.includes(feature)) {
          if (!updatedFeatures.property.includes(feature)) {
            updatedFeatures.property.push(feature);
          }
        } else if (PROPERTY_FEATURES.outdoor.includes(feature)) {
          if (!updatedFeatures.outdoor.includes(feature)) {
            updatedFeatures.outdoor.push(feature);
          }
        } else if (PROPERTY_FEATURES.rental.includes(feature)) {
          if (!updatedFeatures.rental.includes(feature)) {
            updatedFeatures.rental.push(feature);
          }
        } else if (PROPERTY_FEATURES.location.includes(feature)) {
          if (!updatedFeatures.location.includes(feature)) {
            updatedFeatures.location.push(feature);
          }
        } else if (PROPERTY_FEATURES.views.includes(feature)) {
          if (!updatedFeatures.views.includes(feature)) {
            updatedFeatures.views.push(feature);
          }
        }
      });
    
      form.setFieldsValue({ features: updatedFeatures });
      
      message.success(t('properties.messages.aiFeaturesFound', { count: featuresFound.length }));
    }
  
    message.success(t('properties.messages.aiDescriptionsGenerated'));
  };

  const handleAutoDetectCoordinates = async () => {
    const link = form.getFieldValue('google_maps_link');

    if (!link) {
      message.warning(t('properties.messages.coordinatesWarning'));
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
      message.success(t('properties.messages.coordinatesDetected'));

      try {
        const { data } = await propertiesApi.calculateBeachDistance(coords.lat, coords.lng);

        form.setFieldsValue({
          distance_to_beach: data.data.distance
        });

        message.success(t('properties.messages.beachDistanceCalculated', { 
          distance: data.data.distanceFormatted,
          beach: data.data.nearestBeach
        }));
      } catch (error) {
        console.error('Failed to calculate beach distance:', error);
      }
    } catch (error: any) {
      message.error(t('properties.messages.coordinatesError'));
      console.error(error);
    } finally {
      setDetectingCoords(false);
    }
  };

  const handleGoogleMapsLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLink = e.target.value;
    setGoogleMapsLink(newLink);
    
    if (newLink !== propertyData?.google_maps_link) {
      setHasCoordinatesForCurrentLink(false);
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
    if (!values.property_name) {
      message.error(t('properties.messages.propertyNameRequired'));
      setActiveTab('basic');
      return;
    }

    if (values.status !== 'draft') {
      const hasAnyDescription = values.translations?.ru?.description || 
                                values.translations?.en?.description || 
                                values.translations?.th?.description ||
                                values.translations?.zh?.description ||
                                values.translations?.he?.description;

      if (!hasAnyDescription) {
        message.error(t('properties.messages.descriptionRequired'));
        setActiveTab('translations');
        return;
      }
    }

    setLoading(true);
    try {
      console.log('AI Temp Data before submit:', aiTempData);
      console.log('Form values before submit:', values);

      const formData = {
        ...values,
        renovation_date: values.renovation_date 
          ? dayjs(values.renovation_date).format('YYYY-MM-01')
          : null,
        propertyFeatures: values.features?.property || [],
        outdoorFeatures: values.features?.outdoor || [],
        rentalFeatures: values.features?.rental || [],
        locationFeatures: values.features?.location || [],
        views: values.features?.views || [],
        translations: values.translations,
        seasonalPricing: values.seasonalPricing || [],
        year_price: values.year_price || null,
        monthlyPricing: aiTempData.monthlyPricing || [],
        blockedDates: aiTempData.blockedDates || [],
        photosFromGoogleDrive: aiTempData.photosFromGoogleDrive || null
      };
    
      delete formData.features;

      console.log('Final form data to submit:', {
        monthlyPricing: formData.monthlyPricing,
        blockedDates: formData.blockedDates,
        photosFromGoogleDrive: formData.photosFromGoogleDrive
      });
    
      if (isEdit) {
        await propertiesApi.update(Number(id), formData);
        message.success(t('properties.updateSuccess'));
        loadProperty();
      } else {
        const { data } = await propertiesApi.create(formData);
        message.success(t('properties.createSuccess'));
        
        if (aiTempData.monthlyPricing && aiTempData.monthlyPricing.length > 0) {
          message.success(t('properties.messages.savedMonthlyPrices', { count: aiTempData.monthlyPricing.length }));
        }
        
        if (aiTempData.blockedDates && aiTempData.blockedDates.length > 0) {
          message.success(t('properties.messages.savedBlockedDates', { count: aiTempData.blockedDates.length }));
        }
        
        if (aiTempData.photosFromGoogleDrive) {
          message.info(t('properties.messages.googleDrivePhotosLoading'));
        }
        
        setAiTempData({});
        
        navigate(`/properties/edit/${data.data.propertyId}`);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
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

  const handleAISuccess = async (propertyData: any) => {
    setFillingFromAI(true);
    setAiModalVisible(false);

    try {
      message.loading({ content: t('properties.messages.aiFillingForm'), key: 'ai-fill', duration: 0 });

      console.log('AI Data received:', {
        monthlyPricing: propertyData.monthlyPricing,
        blockedDates: propertyData.blockedDates,
        photosFromGoogleDrive: propertyData.photosFromGoogleDrive
      });

      const formValues: any = {
        property_number: propertyData.property_number || '',
        property_name: propertyData.property_name || '',
        complex_name: propertyData.complex_name || '',
        deal_type: propertyData.deal_type || 'sale',
        property_type: propertyData.property_type || null,
        region: propertyData.region || null,
        address: propertyData.address || '',
        google_maps_link: propertyData.google_maps_link || '',
        latitude: propertyData.latitude || null,
        longitude: propertyData.longitude || null,
        bedrooms: propertyData.bedrooms || null,
        bathrooms: propertyData.bathrooms || null,
        indoor_area: propertyData.indoor_area || null,
        outdoor_area: propertyData.outdoor_area || null,
        plot_size: propertyData.plot_size || null,
        floors: propertyData.floors || null,
        floor: propertyData.floor || null,
        construction_year: propertyData.construction_year || null,
        construction_month: propertyData.construction_month || null,
        furniture_status: propertyData.furniture_status || null,
        parking_spaces: propertyData.parking_spaces || null,
        pets_allowed: propertyData.pets_allowed || 'yes',
        building_ownership: propertyData.building_ownership || null,
        land_ownership: propertyData.land_ownership || null,
        ownership_type: propertyData.ownership_type || null,
        sale_price: propertyData.sale_price || null,
        year_price: propertyData.year_price || null,
        status: 'draft',
        video_url: propertyData.video_url || '',
        renovation_type: propertyData.renovation_type || null,
        renovation_date: propertyData.renovation_date ? dayjs(propertyData.renovation_date) : null,
        sale_commission_type: propertyData.sale_commission_type || null,
        sale_commission_value: propertyData.sale_commission_value || null,
        rent_commission_type: propertyData.rent_commission_type || null,
        rent_commission_value: propertyData.rent_commission_value || null,
        owner_name: propertyData.owner_name || '',
        owner_phone: propertyData.owner_phone || '',
        owner_email: propertyData.owner_email || '',
        owner_telegram: propertyData.owner_telegram || '',
        owner_instagram: propertyData.owner_instagram || '',
        owner_notes: propertyData.owner_notes || '',
        deposit_type: propertyData.deposit_type || null,
        deposit_amount: propertyData.deposit_amount || null,
        electricity_rate: propertyData.electricity_rate || null,
        water_rate: propertyData.water_rate || null,
        rental_includes: propertyData.rental_includes || ''
      };

      const features: any = {
        property: propertyData.propertyFeatures || [],
        outdoor: propertyData.outdoorFeatures || [],
        rental: propertyData.rentalFeatures || [],
        location: propertyData.locationFeatures || [],
        views: propertyData.views || []
      };
      formValues.features = features;

      if (propertyData.seasonalPricing && propertyData.seasonalPricing.length > 0) {
        formValues.seasonalPricing = propertyData.seasonalPricing;
      }

      const tempData: any = {
        monthlyPricing: propertyData.monthlyPricing || [],
        blockedDates: propertyData.blockedDates || [],
        photosFromGoogleDrive: propertyData.photosFromGoogleDrive || null
      };
      
      setAiTempData(tempData);
      
      console.log('Saved to aiTempData:', tempData);

      if (tempData.monthlyPricing.length > 0) {
        message.info(t('properties.messages.aiMonthlyPrices', { count: tempData.monthlyPricing.length }));
      }
      
      if (tempData.blockedDates.length > 0) {
        message.info(t('properties.messages.aiBlockedDates', { count: tempData.blockedDates.length }));
      }
      
      if (tempData.photosFromGoogleDrive) {
        message.info(t('properties.messages.aiGoogleDrivePhotos'));
      }

      if (propertyData.deal_type) {
        setDealType(propertyData.deal_type);
      }

      if (propertyData.google_maps_link) {
        setGoogleMapsLink(propertyData.google_maps_link);
      }

      form.setFieldsValue(formValues);

      message.success({ content: t('properties.messages.aiFormFilled'), key: 'ai-fill', duration: 3 });

      if (propertyData.google_maps_link && !propertyData.latitude && !propertyData.longitude) {
        message.info(t('properties.messages.aiCoordinatesDetecting'));
        setHasCoordinatesForCurrentLink(false);
        
        setTimeout(() => {
          handleAutoDetectCoordinates();
        }, 500);
      }

      Modal.info({
        title: t('properties.ai.modalTitle'),
        content: (
          <div>
            <p>{t('properties.ai.modalDescription')}</p>
            <p><strong>{t('properties.ai.modalWarning')}</strong></p>
            <p>{t('properties.ai.modalCheckTitle')}</p>
            <ul>
              <li>{t('properties.ai.modalCheckPrices', { 
                info: tempData.monthlyPricing.length > 0 
                  ? t('properties.ai.modalPricesSet', { count: tempData.monthlyPricing.length })
                  : t('properties.ai.modalPricesNotSet')
              })}</li>
              <li>{t('properties.ai.modalCheckCoordinates')}</li>
              <li>{t('properties.ai.modalCheckFeatures')}</li>
              <li>{t('properties.ai.modalCheckOwner')}</li>
              {tempData.blockedDates.length > 0 && (
                <li>{t('properties.ai.modalCheckCalendar', { count: tempData.blockedDates.length })}</li>
              )}
              {tempData.photosFromGoogleDrive && (
                <li>{t('properties.ai.modalCheckPhotos')}</li>
              )}
            </ul>
          </div>
        ),
        width: 600,
        okText: t('properties.ai.modalOkButton')
      });

      setActiveTab('basic');

    } catch (error) {
      console.error('AI fill error:', error);
      message.error(t('properties.messages.aiFillError'));
    } finally {
      setFillingFromAI(false);
    }
  };

  const handleSaveClick = async () => {
    try {
      const values = form.getFieldsValue(true);

      if (!values.property_name) {
        message.error(t('properties.messages.propertyNameRequired'));
        setActiveTab('basic');
        return;
      }
    
      if (values.status !== 'draft') {
        const hasAnyDescription = values.translations?.ru?.description || 
                                  values.translations?.en?.description || 
                                  values.translations?.th?.description ||
                                  values.translations?.zh?.description ||
                                  values.translations?.he?.description;

        if (!hasAnyDescription) {
          message.error(t('properties.messages.descriptionRequired'));
          setActiveTab('translations');
          return;
        }
      }

      try {
        await form.validateFields([
          'property_number', 
          'deal_type', 
          'property_type', 
          'region', 
          'address', 
          'status', 
          'property_name'
        ]);
      } catch (errorInfo: any) {
        const errorFields = errorInfo.errorFields || [];
        if (errorFields.length > 0) {
          setActiveTab('basic');
          message.error(t('properties.messages.fillRequiredFields'));
        }
        return;
      }

      await handleSubmit(values);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <Card 
      title={
        <Space>
          {isViewMode && <EyeOutlined />}
          {isViewMode ? t('properties.form.viewMode') : (isEdit ? t('properties.form.editMode') : t('properties.form.createMode'))}
        </Space>
      }
      extra={
        <>
          {!isEdit && !isViewMode && (
            <Button
              type="default"
              size="large"
              icon={<RobotOutlined />}
              onClick={() => setAiModalVisible(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderColor: '#667eea',
                color: 'white',
                fontWeight: 500
              }}
            >
              {t('properties.form.createWithAI')}
            </Button>
          )}

          {isViewMode && canEdit && (
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(`/properties/edit/${id}`)}
            >
              {t('properties.form.editButton')}
            </Button>
          )}
        </>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isViewMode}
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
            th: { property_name: '', description: '' },
            zh: { property_name: '', description: '' }, 
            he: { property_name: '', description: '' } 
          },
          seasonalPricing: []
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
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
                    <Select.Option value="naiharn">{t('properties.regions.naiharn')}</Select.Option>
                    <Select.Option value="phukettown">{t('properties.regions.phukettown')}</Select.Option>
                    <Select.Option value="maikhao">{t('properties.regions.maikhao')}</Select.Option>
                    <Select.Option value="yamu">{t('properties.regions.yamu')}</Select.Option>
                    <Select.Option value="paklok">{t('properties.regions.paklok')}</Select.Option>
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
                  <TextArea rows={2} placeholder={t('properties.form.addressPlaceholder')} />
                </Form.Item>
              </Col>
            
              <Col xs={24}>
                <Form.Item
                  name="google_maps_link"
                  label={
                    <Space>
                      <span>{t('properties.googleMapsLink')}</span>
                      {!isViewMode && googleMapsLink && !hasCoordinatesForCurrentLink && (
                        <Badge 
                          status="warning" 
                          text={t('properties.form.googleMapsWarning')}
                          style={{ fontSize: 12 }}
                        />
                      )}
                      {!isViewMode && (
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
                      )}
                    </Space>
                  }
                >
                  <Input 
                    placeholder={t('properties.form.googleMapsPlaceholder')}
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
                  name="property_name"
                  label={t('properties.form.propertyNameLabel')}
                  tooltip={t('properties.form.propertyNameTooltip')}
                  extra={t('properties.form.propertyNameExtra')}
                >
                  <Input
                    placeholder={t('properties.form.propertyNamePlaceholder')}
                    maxLength={100}
                  />
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
                  <Input placeholder={t('properties.form.floorPlaceholder')} />
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
                  <Select placeholder={t('properties.form.constructionMonthPlaceholder')}>
                    <Select.Option value="01">{t('properties.form.months.january')}</Select.Option>
                    <Select.Option value="02">{t('properties.form.months.february')}</Select.Option>
                    <Select.Option value="03">{t('properties.form.months.march')}</Select.Option>
                    <Select.Option value="04">{t('properties.form.months.april')}</Select.Option>
                    <Select.Option value="05">{t('properties.form.months.may')}</Select.Option>
                    <Select.Option value="06">{t('properties.form.months.june')}</Select.Option>
                    <Select.Option value="07">{t('properties.form.months.july')}</Select.Option>
                    <Select.Option value="08">{t('properties.form.months.august')}</Select.Option>
                    <Select.Option value="09">{t('properties.form.months.september')}</Select.Option>
                    <Select.Option value="10">{t('properties.form.months.october')}</Select.Option>
                    <Select.Option value="11">{t('properties.form.months.november')}</Select.Option>
                    <Select.Option value="12">{t('properties.form.months.december')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
                
              <Col xs={24} sm={12}>
                <Form.Item
                  name="furniture_status"
                  label={t('properties.furnitureStatus')}
                >
                  <Select>
                    <Select.Option value="fullyFurnished">{t('properties.form.furnitureStatuses.fullyFurnished')}</Select.Option>
                    <Select.Option value="partiallyFurnished">{t('properties.form.furnitureStatuses.partiallyFurnished')}</Select.Option>
                    <Select.Option value="unfurnished">{t('properties.form.furnitureStatuses.unfurnished')}</Select.Option>
                    <Select.Option value="builtIn">{t('properties.form.furnitureStatuses.builtIn')}</Select.Option>
                    <Select.Option value="empty">{t('properties.form.furnitureStatuses.empty')}</Select.Option>
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
                    <Select.Option value="yes">{t('properties.form.petsOptions.yes')}</Select.Option>
                    <Select.Option value="no">{t('properties.form.petsOptions.no')}</Select.Option>
                    <Select.Option value="negotiable">{t('properties.form.petsOptions.negotiable')}</Select.Option>
                    <Select.Option value="custom">{t('properties.form.petsOptions.custom')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
                
              <Col xs={24} sm={12}>
                <Form.Item
                  name="status"
                  label={t('properties.status')}
                  rules={[{ required: true }]}
                  tooltip={!canEditStatus ? t('properties.form.statusTooltip') : undefined}
                >
                  <Select disabled={!canEditStatus}>
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
                  label={t('properties.form.videoUrlLabel')}
                >
                  <Input placeholder={t('properties.form.videoUrlPlaceholder')} />
                </Form.Item>
              </Col>
            </Row>
          </Tabs.TabPane>

          {showOwnerTab && (
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
                        <TextArea rows={4} placeholder={t('properties.form.ownerNotesPlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Space>
            </Tabs.TabPane>
          )}

          <Tabs.TabPane tab={t('properties.tabs.translations')} key="translations">
            {isEdit && !isViewMode && (
              <AIDescriptionGenerator
                propertyId={Number(id)}
                onGenerated={handleAIGenerated}
                disabled={false}
              />
            )}

            {!isEdit && (
              <Alert
                message={t('properties.ai.generatorAlert')}
                description={t('properties.ai.generatorAlertDescription')}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            <TranslationsEditor viewMode={isViewMode} />
          </Tabs.TabPane>

          <Tabs.TabPane tab={t('properties.tabs.features')} key="features">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card title={t('properties.renovation.title')} size="small">
                <Form.Item
                  name="renovation_type"
                  label={t('properties.renovation.type')}
                >
                  <Radio.Group onChange={handleRenovationChange}>
                    <Radio value={null}>{t('properties.renovation.noRenovation')}</Radio>
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

              <Card title={t('properties.distance.title')} size="small">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="distance_to_beach"
                      label={t('properties.distance.label')}
                      tooltip={t('properties.distance.tooltip')}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        placeholder={t('properties.distance.placeholder')}
                        addonAfter="м"
                      />
                    </Form.Item>
                  </Col>
                            
                  <Col xs={24} sm={12}>
                    {form.getFieldValue('distance_to_beach') && (
                      <div style={{ marginTop: 30 }}>
                        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                          {form.getFieldValue('distance_to_beach') < 200 && t('properties.distance.categories.onBeach')}
                          {form.getFieldValue('distance_to_beach') >= 200 && form.getFieldValue('distance_to_beach') <= 500 && t('properties.distance.categories.nearBeach')}
                          {form.getFieldValue('distance_to_beach') > 500 && form.getFieldValue('distance_to_beach') <= 1000 && t('properties.distance.categories.closeToBeach')}
                          {form.getFieldValue('distance_to_beach') > 1000 && form.getFieldValue('distance_to_beach') <= 2000 && t('properties.distance.categories.within2km')}
                          {form.getFieldValue('distance_to_beach') > 2000 && form.getFieldValue('distance_to_beach') <= 5000 && t('properties.distance.categories.within5km')}
                          {form.getFieldValue('distance_to_beach') > 5000 && t('properties.distance.categories.farFromBeach')}
                        </Tag>
                      </div>
                    )}
                  </Col>
                </Row>
                  
                {!isViewMode && form.getFieldValue('latitude') && form.getFieldValue('longitude') && (
                  <Alert
                    message={t('properties.distance.autoCalculateAlert')}
                    description={t('properties.distance.autoCalculateDescription')}
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>

              {(dealType === 'rent' || dealType === 'both') && (
                <Card title={t('properties.rental.includedTitle')} size="small">
                  <Form.Item
                    name="rental_includes"
                    label={t('properties.rental.includedLabel')}
                    tooltip={t('properties.rental.includedTooltip')}
                  >
                    <TextArea
                      rows={3}
                      placeholder={t('properties.rental.includedPlaceholder')}
                    />
                  </Form.Item>
                </Card>
              )}

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

          <Tabs.TabPane tab={t('properties.tabs.pricing')} key="pricing">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {(dealType === 'sale' || dealType === 'both') && (
                <Card title={t('properties.salePrice.title')}>
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

              {(dealType === 'rent' || dealType === 'both') && (
                <>
                  <Card title={t('properties.constantRentPrice.title')}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="year_price"
                          label={t('properties.constantRentPrice.yearPriceLabel')}
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

                  <Form.Item
                    name="seasonalPricing"
                    noStyle
                  >
                    <SeasonalPricing viewMode={isViewMode} />
                  </Form.Item>

                  <MonthlyPricing
                    propertyId={Number(id) || 0}
                    initialPricing={
                      isEdit 
                        ? (propertyData?.monthly_pricing || []) 
                        : (aiTempData.monthlyPricing || [])
                    }
                    viewMode={isViewMode}
                  />
                </>
              )}

              <CommissionForm dealType={dealType} viewMode={isViewMode} />

              <DepositForm dealType={dealType} viewMode={isViewMode} />

              <UtilitiesForm viewMode={isViewMode} />

            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab={t('properties.tabs.media')} key="media">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <PhotosUploader
                propertyId={Number(id) || 0}
                photos={propertyData?.photos || []}
                bedrooms={form.getFieldValue('bedrooms') || 1}
                onUpdate={isEdit ? loadProperty : () => {}}
                viewMode={isViewMode}
              />

              {isEdit && (
                <>
                  <VideoUploader
                    propertyId={Number(id)}
                    videos={propertyData?.videos || []}
                    onUpdate={loadProperty}
                    viewMode={isViewMode}
                  />

                  <FloorPlanUploader
                    propertyId={Number(id)}
                    floorPlanUrl={propertyData?.floor_plan_url}
                    onUpdate={loadProperty}
                    viewMode={isViewMode}
                  />

                  <VRPanoramaUploader
                    propertyId={Number(id)}
                    onUpdate={loadProperty}
                    viewMode={isViewMode}
                  />
                </>
              )}
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab={t('properties.calendar.title')} key="calendar">
            <CalendarManager 
              propertyId={Number(id) || 0} 
              viewMode={isViewMode}
              initialBlockedDates={
                isEdit 
                  ? undefined
                  : (aiTempData.blockedDates || [])
              }
            />
          </Tabs.TabPane>
        
        </Tabs>

        {!isViewMode && (
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
            <Row justify="end" align="middle">
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
                  loading={loading || fillingFromAI}
                  onClick={handleSaveClick}
                >
                  {isEdit ? t('common.save') : t('common.create')}
                </Button>
              </Space>
            </Row>
          </div>
        )}
      </Form>

      <AIPropertyCreationModal
        visible={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        onSuccess={handleAISuccess}
      />
    </Card>
  );
};

export default PropertyForm;