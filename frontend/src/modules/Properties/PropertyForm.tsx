// frontend/src/modules/Properties/PropertyForm.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Stack,
  Group,
  Grid,
  Text,
  Badge,
  Progress,
  Paper,
  ActionIcon,
  Divider,
  Accordion,
  Affix,
  Transition,
  Box,
  Title,
  ThemeIcon,
  Button,
  Alert,
  Tabs,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Checkbox,
  Radio,
  Modal,
  Tooltip,
  useMantineTheme,
  Loader,
  Center,
  useMantineColorScheme
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMediaQuery, useDisclosure, useScrollIntoView } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconMapPin,
  IconEye,
  IconRobot,
  IconUser,
  IconHome,
  IconLanguage,
  IconTags,
  IconCurrencyDollar,
  IconPhoto,
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconArrowLeft,
  IconBuildingEstate,
  IconPencil,
  IconClipboardText,
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconClipboard,
  IconMapPinFilled,
  IconAlertTriangle,
  IconUpload,
  IconExternalLink,
  IconList
} from '@tabler/icons-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertiesApi, MonthlyPrice } from '@/api/properties.api';
import { extractCoordinatesFromGoogleMapsLink, isGoogleMapsLink } from '@/utils/googleMapsUtils';
import PhotosUploader from './components/PhotosUploader';
import FloorPlanUploader from './components/FloorPlanUploader';
import VRPanoramaUploader from './components/VRPanoramaUploader';
import SeasonalPricing from './components/SeasonalPricing';
import SalePriceForm from './components/SalePriceForm';
import YearPriceForm from './components/YearPriceForm';
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
import OwnerAccessModal from './components/OwnerAccessModal';

interface TempPhoto {
  file: File;
  category: string;
  preview: string;
}

interface TempVideo {
  file: File;
  title?: string;
  description?: string;
  preview: string;
}

interface TempVRPanorama {
  location_type: string;
  location_number: number;
  files: {
    front: File;
    back: File;
    left: File;
    right: File;
    top: File;
    bottom: File;
  };
  previews: {
    front: string;
    back: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
}

interface TempBlockedDate {
  start_date: string;
  end_date: string;
  reason?: string;
}

interface PropertyFormProps {
  viewMode?: boolean;
}

const PropertyForm = ({ viewMode = false }: PropertyFormProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const theme = useMantineTheme();
  const [depositType, setDepositType] = useState<'one_month' | 'two_months' | 'custom'>('one_month');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const { canEditProperty, canViewPropertyOwner, canChangePropertyStatus } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [detectingCoords, setDetectingCoords] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const [dealType, setDealType] = useState<'sale' | 'rent' | 'both'>('sale');
  const [showRenovationDate, setShowRenovationDate] = useState(false);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [hasCoordinatesForCurrentLink, setHasCoordinatesForCurrentLink] = useState(true);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [fillingFromAI, setFillingFromAI] = useState(false);
  const [ownerAccessModalVisible, setOwnerAccessModalVisible] = useState(false);
  const [aiTempData, setAiTempData] = useState<{
    blockedDates?: any[];
    photosFromGoogleDrive?: string | null;
  }>({});

  const [tempPhotos, setTempPhotos] = useState<TempPhoto[]>([]);
  const [tempVideos, setTempVideos] = useState<TempVideo[]>([]);
  const [tempFloorPlan, setTempFloorPlan] = useState<File | null>(null);
  const [tempVRPanoramas, setTempVRPanoramas] = useState<TempVRPanorama[]>([]);
  const [tempBlockedDates, setTempBlockedDates] = useState<TempBlockedDate[]>([]);

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    currentType: '',
    currentItem: '',
    percentage: 0
  });

  const [showAllPropertyFeatures, setShowAllPropertyFeatures] = useState(false);
  const [showAllOutdoorFeatures, setShowAllOutdoorFeatures] = useState(false);
  const [showAllRentalFeatures, setShowAllRentalFeatures] = useState(false);
  const [showAllLocationFeatures, setShowAllLocationFeatures] = useState(false);
  const [showAllViews, setShowAllViews] = useState(false);

  const isEdit = !!id;
  const isViewMode = viewMode;
  
  const [canEdit, setCanEdit] = useState(false);
  const [showOwnerTab, setShowOwnerTab] = useState(false);
  const [canEditStatus, setCanEditStatus] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  const { scrollIntoView, targetRef } = useScrollIntoView<HTMLDivElement>({
    offset: 60,
  });

  const [complexInfoOpened, { open: openComplexInfo, close: closeComplexInfo }] = useDisclosure(false);
  const [afterSaveModalOpened, { open: openAfterSaveModal, close: closeAfterSaveModal }] = useDisclosure(false);

  const form = useForm({
    initialValues: {
      property_number: '',
      property_name: '',
      complex_name: '',
      deal_type: 'sale',
      property_type: '',
      region: '',
      address: '',
      google_maps_link: '',
      latitude: null as number | null,
      longitude: null as number | null,
      bedrooms: null as number | null,
      bathrooms: null as number | null,
      indoor_area: null as number | null,
      outdoor_area: null as number | null,
      plot_size: null as number | null,
      floors: null as number | null,
      floor: '',
      penthouse_floors: null as number | null,
      construction_year: null as number | null,
      construction_month: '',
      furniture_status: '',
      parking_spaces: null as number | null,
      pets_allowed: 'yes',
      pets_custom: '',
      building_ownership: '',
      land_ownership: '',
      ownership_type: '',
      
      sale_price: null as number | null,
      sale_pricing_mode: 'net' as 'net' | 'gross',
      sale_commission_type_new: null as 'percentage' | 'fixed' | null,
      sale_commission_value_new: null as number | null,
      sale_source_price: null as number | null,
      sale_margin_amount: null as number | null,
      sale_margin_percentage: null as number | null,
      
      year_price: null as number | null,
      year_pricing_mode: 'net' as 'net' | 'gross',
      year_commission_type: null as 'percentage' | 'fixed' | null,
      year_commission_value: null as number | null,
      year_source_price: null as number | null,
      year_margin_amount: null as number | null,
      year_margin_percentage: null as number | null,
      
      monthlyPricing: [] as MonthlyPrice[],
      
      minimum_nights: null as number | null,
      ics_calendar_url: '',
      video_url: '',
      status: 'draft',
      owner_name: '',
      owner_phone: '',
      owner_email: '',
      owner_telegram: '',
      owner_instagram: '',
      owner_notes: '',
      sale_commission_type: '',
      sale_commission_value: null as number | null,
      rent_commission_type: '',
      rent_commission_value: null as number | null,
      renovation_type: '',
      renovation_date: null as Date | null,
      rental_includes: '',
      deposit_type: '',
      deposit_amount: null as number | null,
      electricity_rate: null as number | null,
      water_rate: null as number | null,
      distance_to_beach: null as number | null,
      features: {
        property: [] as string[],
        outdoor: [] as string[],
        rental: [] as string[],
        location: [] as string[],
        views: [] as string[]
      },
      translations: {
        ru: { description: '' },
        en: { description: '' },
        th: { description: '' },
        zh: { description: '' },
        he: { description: '' }
      },
      seasonalPricing: [] as any[]
    },
    validate: {
      property_number: (value) => (!value ? t('validation.required') : null),
      deal_type: (value) => (!value ? t('validation.required') : null),
      property_type: (value) => (!value ? t('validation.required') : null),
      region: (value) => (!value ? t('validation.required') : null),
      address: (value) => (!value ? t('validation.required') : null),
      property_name: (value) => (!value ? t('validation.required') : null),
    },
  });

  const canNavigateToOtherTabs = isEdit || isCreatingProperty;

  const steps = useMemo(() => {
    const baseSteps = [
      { 
        value: 0, 
        key: 'basic',
        label: t('properties.tabs.basic'), 
        icon: IconHome,
        disabled: false,
      },
      {
        value: 1,
        key: 'media',
        label: t('properties.tabs.media'),
        icon: IconPhoto,
        disabled: !canNavigateToOtherTabs,
      },
      {
        value: 2,
        key: 'features',
        label: t('properties.tabs.features'),
        icon: IconTags,
        disabled: !canNavigateToOtherTabs,
      },
      {
        value: 3,
        key: 'pricing',
        label: t('properties.tabs.pricing'),
        icon: IconCurrencyDollar,
        disabled: !canNavigateToOtherTabs,
      },
      {
        value: 4,
        key: 'calendar',
        label: t('properties.tabs.calendar'),
        icon: IconCalendar,
        disabled: !canNavigateToOtherTabs,
      }
    ];

    if (showOwnerTab) {
      baseSteps.push({
        value: 5,
        key: 'owner',
        label: t('properties.tabs.owner'),
        icon: IconUser,
        disabled: !canNavigateToOtherTabs,
      });
    }

    baseSteps.push({
      value: showOwnerTab ? 6 : 5,
      key: 'translations',
      label: t('properties.tabs.translations'),
      icon: IconLanguage,
      disabled: !canNavigateToOtherTabs,
    });

    return baseSteps;
  }, [showOwnerTab, t, canNavigateToOtherTabs]);

  const calculateProgress = () => {
    const values = form.values;
    let filled = 0;
    let total = 0;

    const requiredFields = ['property_number', 'deal_type', 'property_type', 'region', 'address', 'property_name'];
    requiredFields.forEach(field => {
      total++;
      if (values[field as keyof typeof values]) filled++;
    });

    total += 2;
    if (values.latitude) filled++;
    if (values.longitude) filled++;

    total += 2;
    if (values.bedrooms) filled++;
    if (values.bathrooms) filled++;

    total += 3;
    if (values.indoor_area) filled++;
    if (values.outdoor_area) filled++;
    if (values.plot_size) filled++;

    total++;
    if (values.translations.ru?.description || 
        values.translations.en?.description ||
        values.translations.th?.description ||
        values.translations.zh?.description ||
        values.translations.he?.description) {
      filled++;
    }

    total++;
    if (values.features.property.length > 0 ||
        values.features.outdoor.length > 0 ||
        values.features.rental.length > 0 ||
        values.features.location.length > 0 ||
        values.features.views.length > 0) {
      filled++;
    }

    if (dealType === 'sale' || dealType === 'both') {
      total++;
      if (values.sale_price) filled++;
    }
    if (dealType === 'rent' || dealType === 'both') {
      total++;
      if (values.year_price || values.seasonalPricing.length > 0 || values.monthlyPricing.length > 0) filled++;
    }

    return Math.round((filled / total) * 100);
  };

  const progress = calculateProgress();

  const uploadAllMedia = async (propertyId: number) => {
    setIsUploadingMedia(true);
    
    const totalItems = 
      tempPhotos.length + 
      tempVideos.length + 
      (tempFloorPlan ? 1 : 0) + 
      tempVRPanoramas.length +
      tempBlockedDates.length;

    if (totalItems === 0) {
      setIsUploadingMedia(false);
      return;
    }

    setUploadProgress({
      current: 0,
      total: totalItems,
      currentType: '',
      currentItem: '',
      percentage: 0
    });

    let currentItem = 0;

    try {
      if (tempPhotos.length > 0) {
        setUploadProgress(prev => ({
          ...prev,
          currentType: t('properties.media.photos') || 'Фотографии'
        }));

        for (let i = 0; i < tempPhotos.length; i++) {
          const photo = tempPhotos[i];
          currentItem++;
          
          setUploadProgress(prev => ({
            ...prev,
            current: currentItem,
            currentItem: `${i + 1}/${tempPhotos.length}`,
            percentage: Math.round((currentItem / totalItems) * 100)
          }));

          const formData = new FormData();
          formData.append('photos', photo.file);
          formData.append('category', photo.category);

          await propertiesApi.uploadPhotos(propertyId, formData);
        }

        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.photosUploaded', { count: tempPhotos.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      if (tempVideos.length > 0) {
        setUploadProgress(prev => ({
          ...prev,
          currentType: t('properties.media.videos') || 'Видео'
        }));

        for (let i = 0; i < tempVideos.length; i++) {
          const video = tempVideos[i];
          currentItem++;
          
          setUploadProgress(prev => ({
            ...prev,
            current: currentItem,
            currentItem: `${i + 1}/${tempVideos.length}`,
            percentage: Math.round((currentItem / totalItems) * 100)
          }));

          await propertiesApi.uploadVideo(propertyId, video.file);
        }
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.videosUploaded', { count: tempVideos.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      if (tempFloorPlan) {
        currentItem++;
        setUploadProgress(prev => ({
          ...prev,
          current: currentItem,
          currentType: t('properties.media.floorPlan') || 'Планировка',
          currentItem: '1/1',
          percentage: Math.round((currentItem / totalItems) * 100)
        }));

        const formData = new FormData();
        formData.append('floorPlan', tempFloorPlan);

        await propertiesApi.uploadFloorPlan(propertyId, formData);

        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.floorPlanUploaded'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      if (tempVRPanoramas.length > 0) {
        setUploadProgress(prev => ({
          ...prev,
          currentType: t('properties.media.vrPanoramas') || 'VR Панорамы'
        }));

        for (let i = 0; i < tempVRPanoramas.length; i++) {
          const panorama = tempVRPanoramas[i];
          currentItem++;
          
          setUploadProgress(prev => ({
            ...prev,
            current: currentItem,
            currentItem: `${i + 1}/${tempVRPanoramas.length}`,
            percentage: Math.round((currentItem / totalItems) * 100)
          }));

          const formData = new FormData();
          formData.append('location_type', panorama.location_type);
          formData.append('location_number', String(panorama.location_number));
          
          Object.entries(panorama.files).forEach(([direction, file]) => {
            formData.append(direction, file);
          });

          await propertiesApi.createVRPanorama(propertyId, formData);
        }

        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.vrPanoramasUploaded', { count: tempVRPanoramas.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      if (tempBlockedDates.length > 0) {
        setUploadProgress(prev => ({
          ...prev,
          currentType: t('properties.calendar.blockedDates') || 'Заблокированные даты'
        }));

        for (let i = 0; i < tempBlockedDates.length; i++) {
          const blockedDate = tempBlockedDates[i];
          currentItem++;
          
          setUploadProgress(prev => ({
            ...prev,
            current: currentItem,
            currentItem: `${i + 1}/${tempBlockedDates.length}`,
            percentage: Math.round((currentItem / totalItems) * 100)
          }));

          await propertiesApi.addBlockedPeriod(propertyId, {
            start_date: blockedDate.start_date,
            end_date: blockedDate.end_date,
            reason: blockedDate.reason || ''
          });
        }

        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.blockedDatesAdded', { count: tempBlockedDates.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      }

      setTempPhotos([]);
      setTempVideos([]);
      setTempFloorPlan(null);
      setTempVRPanoramas([]);
      setTempBlockedDates([]);

      notifications.show({
        title: t('common.success'),
        message: t('properties.messages.allMediaUploaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });

    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('properties.messages.mediaUploadError'),
        color: 'red',
        icon: <IconX size={18} />
      });
      throw error;
    } finally {
      setIsUploadingMedia(false);
      setUploadProgress({
        current: 0,
        total: 0,
        currentType: '',
        currentItem: '',
        percentage: 0
      });
    }
  };

useEffect(() => {
  if (isEdit) {
    loadProperty();
  }
  
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');
  if (tab) {
    const tabNumber = Number(tab);
    if (!isNaN(tabNumber) && tabNumber >= 0 && tabNumber < steps.length) {
      setActiveStep(tabNumber);
    }
  }
}, [id, location.search]);

  useEffect(() => {
    if (form.values.google_maps_link && (!form.values.latitude || !form.values.longitude)) {
      setHasCoordinatesForCurrentLink(false);
    } else {
      setHasCoordinatesForCurrentLink(true);
    }
  }, [form.values.google_maps_link, form.values.latitude, form.values.longitude]);

  useEffect(() => {
    if (propertyData) {
      const userCanEdit = canEditProperty(propertyData.created_by);
      const showOwner = canViewPropertyOwner(propertyData.created_by);
      const canEditStatusFlag = canChangePropertyStatus();
      
      setCanEdit(userCanEdit);
      setShowOwnerTab(showOwner);
      setCanEditStatus(canEditStatusFlag);
      
      if (isEdit && !isViewMode && !userCanEdit) {
        notifications.show({
          title: t('properties.messages.noEditPermission'),
          message: t('properties.messages.noEditPermissionDescription') || 'У вас нет прав на редактирование',
          color: 'orange',
          icon: <IconAlertCircle size={18} />
        });
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
      
      console.log('Loading monthly pricing from DB:', property.monthly_pricing);
      
      let parsedFeatures = {
        property: [] as string[],
        outdoor: [] as string[],
        rental: [] as string[],
        location: [] as string[],
        views: [] as string[]
      };
      
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

      form.setValues({
        property_number: property.property_number || '',
        property_name: property.property_name || '',
        complex_name: property.complex_name || '',
        deal_type: property.deal_type,
        property_type: property.property_type || '',
        region: property.region || '',
        address: property.address || '',
        google_maps_link: property.google_maps_link || '',
        latitude: property.latitude,
        longitude: property.longitude,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        indoor_area: property.indoor_area,
        outdoor_area: property.outdoor_area,
        plot_size: property.plot_size,
        floors: property.floors,
        floor: property.floor || '',
        penthouse_floors: property.penthouse_floors,
        construction_year: property.construction_year,
        construction_month: property.construction_month || '',
        furniture_status: property.furniture_status || '',
        parking_spaces: property.parking_spaces,
        pets_allowed: property.pets_allowed || 'yes',
        pets_custom: property.pets_custom || '',
        building_ownership: property.building_ownership || '',
        land_ownership: property.land_ownership || '',
        ownership_type: property.ownership_type || '',
        
        sale_price: property.sale_price,
        sale_pricing_mode: property.sale_pricing_mode || 'net',
        sale_commission_type_new: property.sale_commission_type_new || null,
        sale_commission_value_new: property.sale_commission_value_new || null,
        sale_source_price: property.sale_source_price || null,
        sale_margin_amount: property.sale_margin_amount || null,
        sale_margin_percentage: property.sale_margin_percentage || null,
        
        year_price: property.year_price,
        year_pricing_mode: property.year_pricing_mode || 'net',
        year_commission_type: property.year_commission_type || null,
        year_commission_value: property.year_commission_value || null,
        year_source_price: property.year_source_price || null,
        year_margin_amount: property.year_margin_amount || null,
        year_margin_percentage: property.year_margin_percentage || null,
        
        monthlyPricing: property.monthly_pricing || [],
        
        minimum_nights: property.minimum_nights,
        ics_calendar_url: property.ics_calendar_url || '',
        video_url: property.video_url || '',
        status: property.status,
        owner_name: property.owner_name || '',
        owner_phone: property.owner_phone || '',
        owner_email: property.owner_email || '',
        owner_telegram: property.owner_telegram || '',
        owner_instagram: property.owner_instagram || '',
        owner_notes: property.owner_notes || '',
        renovation_type: property.renovation_type || '',
        renovation_date: property.renovation_date ? new Date(property.renovation_date) : null,
        rental_includes: property.rental_includes || '',
        deposit_type: property.deposit_type || '',
        deposit_amount: property.deposit_amount,
        electricity_rate: property.electricity_rate,
        water_rate: property.water_rate,
        distance_to_beach: property.distance_to_beach,
        features: parsedFeatures,
        translations: translations,
        seasonalPricing: property.pricing || [],
        sale_commission_type: '',
        sale_commission_value: null,
        rent_commission_type: '',
        rent_commission_value: null
      });

      if (property.renovation_type) {
        setShowRenovationDate(true);
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('errors.generic'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerated = (descriptions: any, featuresFound: string[]) => {
    form.setFieldValue('translations', {
      ru: {
        description: descriptions.ru?.description || form.values.translations.ru?.description || ''
      },
      en: {
        description: descriptions.en?.description || form.values.translations.en?.description || ''
      },
      th: {
        description: descriptions.th?.description || form.values.translations.th?.description || ''
      },
      zh: {
        description: descriptions.zh?.description || form.values.translations.zh?.description || ''
      },
      he: {
        description: descriptions.he?.description || form.values.translations.he?.description || ''
      }
    });
  
    if (featuresFound && featuresFound.length > 0) {
      const currentFeatures = form.values.features;
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
    
      form.setFieldValue('features', updatedFeatures);
      
      notifications.show({
        title: t('common.success'),
        message: t('properties.messages.aiFeaturesFound', { count: featuresFound.length }),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    }
  
    notifications.show({
      title: t('common.success'),
      message: t('properties.messages.aiDescriptionsGenerated'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      
      if (text && text.trim()) {
        handleGoogleMapsLinkChange(text.trim());
        
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.linkPasted') || 'Ссылка вставлена из буфера обмена',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        notifications.show({
          title: t('properties.messages.warning'),
          message: t('properties.messages.clipboardEmpty') || 'Буфер обмена пуст',
          color: 'orange',
          icon: <IconAlertTriangle size={16} />
        });
      }
    } catch (error) {
      notifications.show({
        title: t('errors.generic'),
        message: t('properties.messages.clipboardError') || 'Не удалось прочитать буфер обмена',
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const handleAutoDetectCoordinates = async (linkOverride?: string) => {
    const link = linkOverride || form.values.google_maps_link;

    if (!link) {
      notifications.show({
        title: t('properties.messages.coordinatesWarning'),
        message: t('properties.messages.coordinatesWarningDescription') || 'Введите ссылку на Google Maps',
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    setDetectingCoords(true);
    
    const notificationId = 'auto-detect-coords';
    notifications.show({
      id: notificationId,
      title: t('properties.messages.detecting') || 'Определение...',
      message: t('properties.messages.detectingCoordinates') || 'Определяем координаты и адрес...',
      loading: true,
      autoClose: false,
      withCloseButton: false
    });

    try {
      const result = await extractCoordinatesFromGoogleMapsLink(link);
      const coords = result.coordinates;
      const address = result.address;

      form.setFieldValue('latitude', coords.lat);
      form.setFieldValue('longitude', coords.lng);

      if (address && !form.values.address) {
        form.setFieldValue('address', address);
      }

      setHasCoordinatesForCurrentLink(true);
      
      notifications.update({
        id: notificationId,
        title: t('common.success'),
        message: address 
          ? (t('properties.messages.coordinatesAndAddressDetected') || 'Координаты и адрес определены успешно')
          : t('properties.messages.coordinatesDetected'),
        color: 'green',
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });

      try {
        const { data } = await propertiesApi.calculateBeachDistance(coords.lat, coords.lng);

        form.setFieldValue('distance_to_beach', data.data.distance);

        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.beachDistanceCalculated', { 
            distance: data.data.distanceFormatted,
            beach: data.data.nearestBeach
          }),
          color: 'blue',
          icon: <IconCheck size={18} />
        });
      } catch (error) {
        console.error('Failed to calculate beach distance:', error);
      }
    } catch (error: any) {
      notifications.update({
        id: notificationId,
        title: t('errors.generic'),
        message: error.message || t('properties.messages.coordinatesError'),
        color: 'red',
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 5000
      });
      console.error(error);
    } finally {
      setDetectingCoords(false);
    }
  };

  const handleGoogleMapsLinkChange = async (value: string) => {
    form.setFieldValue('google_maps_link', value);
    setGoogleMapsLink(value);
    
    if (value !== propertyData?.google_maps_link) {
      setHasCoordinatesForCurrentLink(false);
    }

    if (value && isGoogleMapsLink(value)) {
      setTimeout(() => {
        handleAutoDetectCoordinates(value);
      }, 500);
    }
  };

  const showComplexInfo = () => {
    openComplexInfo();
  };

  const handleDealTypeChange = (value: string) => {
    setDealType(value as 'sale' | 'rent' | 'both');
    form.setFieldValue('deal_type', value);
  };

  const handleRenovationChange = (value: string | null) => {
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
      notifications.show({
        id: 'ai-fill',
        title: t('properties.messages.aiFillingForm'),
        message: t('properties.messages.pleaseWait') || 'Подождите...',
        loading: true,
        autoClose: false,
        withCloseButton: false
      });

      const tempData: any = {
        blockedDates: propertyData.blockedDates || [],
        photosFromGoogleDrive: propertyData.photosFromGoogleDrive || null
      };
      
      setAiTempData(tempData);

      const features = {
        property: propertyData.propertyFeatures || [],
        outdoor: propertyData.outdoorFeatures || [],
        rental: propertyData.rentalFeatures || [],
        location: propertyData.locationFeatures || [],
        views: propertyData.views || []
      };

      form.setValues({
        property_number: propertyData.property_number || '',
        property_name: propertyData.property_name || '',
        complex_name: propertyData.complex_name || '',
        deal_type: propertyData.deal_type || 'sale',
        property_type: propertyData.property_type || '',
        region: propertyData.region || '',
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
        floor: propertyData.floor || '',
        construction_year: propertyData.construction_year || null,
        construction_month: propertyData.construction_month || '',
        furniture_status: propertyData.furniture_status || '',
        parking_spaces: propertyData.parking_spaces || null,
        pets_allowed: propertyData.pets_allowed || 'yes',
        building_ownership: propertyData.building_ownership || '',
        land_ownership: propertyData.land_ownership || '',
        ownership_type: propertyData.ownership_type || '',
        sale_price: propertyData.sale_price || null,
        sale_pricing_mode: 'net',
        sale_commission_type_new: null,
        sale_commission_value_new: null,
        sale_source_price: null,
        sale_margin_amount: null,
        sale_margin_percentage: null,
        year_price: propertyData.year_price || null,
        year_pricing_mode: 'net',
        year_commission_type: null,
        year_commission_value: null,
        year_source_price: null,
        year_margin_amount: null,
        year_margin_percentage: null,
        monthlyPricing: propertyData.monthlyPricing || [],
        status: 'draft',
        video_url: propertyData.video_url || '',
        renovation_type: propertyData.renovation_type || '',
        renovation_date: propertyData.renovation_date ? new Date(propertyData.renovation_date) : null,
        sale_commission_type: propertyData.sale_commission_type || '',
        sale_commission_value: propertyData.sale_commission_value || null,
        rent_commission_type: propertyData.rent_commission_type || '',
        rent_commission_value: propertyData.rent_commission_value || null,
        owner_name: propertyData.owner_name || '',
        owner_phone: propertyData.owner_phone || '',
        owner_email: propertyData.owner_email || '',
        owner_telegram: propertyData.owner_telegram || '',
        owner_instagram: propertyData.owner_instagram || '',
        owner_notes: propertyData.owner_notes || '',
        deposit_type: propertyData.deposit_type || '',
        deposit_amount: propertyData.deposit_amount || null,
        electricity_rate: propertyData.electricity_rate || null,
        water_rate: propertyData.water_rate || null,
        rental_includes: propertyData.rental_includes || '',
        features: features,
        seasonalPricing: propertyData.seasonalPricing || [],
        translations: form.values.translations,
        minimum_nights: null,
        ics_calendar_url: '',
        pets_custom: '',
        penthouse_floors: null,
        distance_to_beach: null
      });

      if (propertyData.monthlyPricing && propertyData.monthlyPricing.length > 0) {
        notifications.show({
          title: t('common.info'),
          message: t('properties.messages.aiMonthlyPrices', { count: propertyData.monthlyPricing.length }),
          color: 'blue'
        });
      }
      
      if (tempData.blockedDates.length > 0) {
        notifications.show({
          title: t('common.info'),
          message: t('properties.messages.aiBlockedDates', { count: tempData.blockedDates.length }),
          color: 'blue'
        });
      }
      
      if (tempData.photosFromGoogleDrive) {
        notifications.show({
          title: t('common.info'),
          message: t('properties.messages.aiGoogleDrivePhotos'),
          color: 'blue'
        });
      }

      if (propertyData.deal_type) {
        setDealType(propertyData.deal_type);
      }

      if (propertyData.google_maps_link) {
        setGoogleMapsLink(propertyData.google_maps_link);
      }

      notifications.update({
        id: 'ai-fill',
        title: t('common.success'),
        message: t('properties.messages.aiFormFilled'),
        color: 'green',
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000
      });

      if (propertyData.google_maps_link && !propertyData.latitude && !propertyData.longitude) {
        notifications.show({
          title: t('common.info'),
          message: t('properties.messages.aiCoordinatesDetecting'),
          color: 'blue'
        });
        setHasCoordinatesForCurrentLink(false);
        
        setTimeout(() => {
          handleAutoDetectCoordinates();
        }, 500);
      }

      modals.openConfirmModal({
        title: t('properties.ai.modalTitle'),
        children: (
          <Stack gap="sm">
            <Text>{t('properties.ai.modalDescription')}</Text>
            <Text fw={600}>{t('properties.ai.modalWarning')}</Text>
            <Text>{t('properties.ai.modalCheckTitle')}</Text>
            <Stack gap="xs" pl="md">
              <Text size="sm">• {t('properties.ai.modalCheckPrices', { 
                info: propertyData.monthlyPricing && propertyData.monthlyPricing.length > 0 
                  ? t('properties.ai.modalPricesSet', { count: propertyData.monthlyPricing.length })
                  : t('properties.ai.modalPricesNotSet')
              })}</Text>
              <Text size="sm">• {t('properties.ai.modalCheckCoordinates')}</Text>
              <Text size="sm">• {t('properties.ai.modalCheckFeatures')}</Text>
              <Text size="sm">• {t('properties.ai.modalCheckOwner')}</Text>
              {tempData.blockedDates.length > 0 && (
                <Text size="sm">• {t('properties.ai.modalCheckCalendar', { count: tempData.blockedDates.length })}</Text>
              )}
              {tempData.photosFromGoogleDrive && (
                <Text size="sm">• {t('properties.ai.modalCheckPhotos')}</Text>
              )}
            </Stack>
          </Stack>
        ),
        labels: { confirm: t('properties.ai.modalOkButton') || 'OK', cancel: '' },
        confirmProps: { color: 'blue' },
        withCloseButton: false,
        onConfirm: () => {}
      });

      setActiveStep(0);

    } catch (error) {
      console.error('AI fill error:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('properties.messages.aiFillError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setFillingFromAI(false);
    }
  };

const handleSaveClick = async () => {
  const validationErrors = form.validate();
  
  if (validationErrors.hasErrors) {
    setActiveStep(0);
    scrollIntoView();
    
    notifications.show({
      title: t('errors.validation'),
      message: t('properties.form.fillRequired') || 'Заполните обязательные поля',
      color: 'red',
      icon: <IconX size={18} />
    });
    return;
  }

  if (!form.values.property_name) {
    setActiveStep(0);
    scrollIntoView();

    notifications.show({
      title: t('errors.generic'),
      message: t('properties.messages.propertyNameRequired') || 'Укажите название объекта',
      color: 'red',
      icon: <IconX size={18} />
    });
    return;
  }

  if (form.values.status !== 'draft') {
    const hasAnyDescription = form.values.translations?.ru?.description || 
                              form.values.translations?.en?.description || 
                              form.values.translations?.th?.description ||
                              form.values.translations?.zh?.description ||
                              form.values.translations?.he?.description;

    if (!hasAnyDescription) {
      notifications.show({
        title: t('errors.generic'),
        message: t('properties.messages.descriptionRequired') || 'Для публикации необходимо добавить описание',
        color: 'red',
        icon: <IconX size={18} />
      });
      setActiveStep(steps.length - 1);
      return;
    }
  }

  try {
    setLoading(true);

    const propertyData = {
      ...form.values,
      sale_price: dealType === 'rent' ? null : form.values.sale_price,
      year_price: dealType === 'sale' ? null : form.values.year_price,
      year_pricing_mode: dealType === 'sale' ? null : form.values.year_pricing_mode,
      year_commission_type: dealType === 'sale' ? null : form.values.year_commission_type,
      year_commission_value: dealType === 'sale' ? null : form.values.year_commission_value,
      features: {
        property: form.values.features.property,
        outdoor: form.values.features.outdoor,
        rental: form.values.features.rental,
        location: form.values.features.location,
        views: form.values.features.views
      },
      monthlyPricing: dealType === 'sale' ? [] : form.values.monthlyPricing,
      seasonalPricing: dealType === 'sale' ? [] : form.values.seasonalPricing,
      translations: form.values.translations,
      distance_to_beach: form.values.distance_to_beach,
      renovation_date: form.values.renovation_date 
        ? dayjs(form.values.renovation_date).format('YYYY-MM-01')
        : null,
      propertyFeatures: form.values.features?.property || [],
      outdoorFeatures: form.values.features?.outdoor || [],
      rentalFeatures: form.values.features?.rental || [],
      locationFeatures: form.values.features?.location || [],
      views: form.values.features?.views || [],
      blockedDates: aiTempData.blockedDates || [],
      photosFromGoogleDrive: aiTempData.photosFromGoogleDrive || null
    };

    if (isEdit) {
      await propertiesApi.update(Number(id), propertyData);
      notifications.show({
        title: t('common.success'),
        message: t('properties.updated'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      await loadProperty();
      
      // ✅ НОВОЕ: Открываем модальное окно после успешного редактирования
      openAfterSaveModal();
    } else {
      setIsCreatingProperty(true);
      const { data } = await propertiesApi.create(propertyData);
      const newPropertyId = data.data.propertyId;

      notifications.show({
        title: t('common.success'),
        message: t('properties.created'),
        color: 'green',
        icon: <IconCheck size={18} />
      });

      if (form.values.monthlyPricing && form.values.monthlyPricing.length > 0) {
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.savedMonthlyPrices', { count: form.values.monthlyPricing.length }) || `Сохранено ${form.values.monthlyPricing.length} месячных цен`,
          color: 'green'
        });
      }
      
      if (aiTempData.blockedDates && aiTempData.blockedDates.length > 0) {
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.savedBlockedDates', { count: aiTempData.blockedDates.length }) || `Сохранено ${aiTempData.blockedDates.length} заблокированных дат`,
          color: 'green'
        });
      }
      
      if (aiTempData.photosFromGoogleDrive) {
        notifications.show({
          title: t('common.info'),
          message: t('properties.messages.googleDrivePhotosLoading') || 'Фотографии из Google Drive загружаются...',
          color: 'blue'
        });
      }

      const hasMediaToUpload = 
        tempPhotos.length > 0 || 
        tempVideos.length > 0 || 
        tempFloorPlan !== null || 
        tempVRPanoramas.length > 0 ||
        tempBlockedDates.length > 0;

      if (hasMediaToUpload) {
        try {
          await uploadAllMedia(newPropertyId);
        } catch (error) {
          console.error('Media upload error:', error);
        }
      }

      setAiTempData({});

      navigate(`/properties/edit/${newPropertyId}?tab=1`);
    }
  } catch (error: any) {
    console.error('Save error:', error);
    notifications.show({
      title: t('errors.generic'),
      message: error.response?.data?.message || t('properties.saveFailed'),
      color: 'red',
      icon: <IconX size={18} />
    });
  } finally {
    setLoading(false);
    setIsCreatingProperty(false);
  }
};

  const nextStep = () => {
    if (activeStep < steps.length - 1) {
      const nextStepIndex = activeStep + 1;
      if (!steps[nextStepIndex].disabled) {
        setActiveStep(nextStepIndex);
        scrollIntoView();
      }
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      scrollIntoView();
    }
  };

  const ProgressIndicator = () => (
    <Paper shadow="sm" p="md" radius="md" withBorder mb="lg">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>{t('properties.form.completionProgress') || 'Прогресс заполнения'}</Text>
        <Text size="sm" c="dimmed">{progress}%</Text>
      </Group>
      <Progress value={progress} size="lg" radius="md" />
    </Paper>
  );

  const MediaUploadProgress = () => {
    if (!isUploadingMedia) return null;

    return (
      <Modal
        opened={isUploadingMedia}
        onClose={() => {}}
        title={t('properties.media.uploadingTitle') || 'Загрузка медиа'}
        size="lg"
        centered
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="md">
          <Alert icon={<IconUpload size={18} />} color="blue">
            <Text size="sm">
              {t('properties.media.uploadingDescription') || 'Пожалуйста, подождите. Идёт загрузка медиа-файлов на сервер...'}
            </Text>
          </Alert>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>{uploadProgress.currentType}</Text>
              <Text size="sm" c="dimmed">
                {uploadProgress.current}/{uploadProgress.total} ({uploadProgress.percentage}%)
              </Text>
            </Group>
            
            {uploadProgress.currentItem && (
              <Text size="sm" c="dimmed">
                {t('properties.media.currentItem') || 'Текущий элемент'}: {uploadProgress.currentItem}
              </Text>
            )}

            <Progress 
              value={uploadProgress.percentage} 
              size="xl" 
              radius="md" 
              animated 
              color="blue"
            />
          </Stack>

          <Alert icon={<IconInfoCircle size={18} />} color="orange">
            <Text size="sm">
              {t('properties.media.uploadingWarning') || 'Не закрывайте эту страницу до завершения загрузки'}
            </Text>
          </Alert>
        </Stack>
      </Modal>
    );
  };

  const renderFeaturesGroup = (
    features: string[],
    selectedFeatures: string[],
    onChange: (value: string[]) => void,
    showAll: boolean,
    setShowAll: (value: boolean) => void,
    title: string,
    color: string
  ) => {
    const displayFeatures = showAll ? features : features.slice(0, 10);
    const hasMore = features.length > 10;

    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="light" color={color}>
              <IconTags size={20} />
            </ThemeIcon>
            <Text fw={500}>{title}</Text>
          </Group>
          <Checkbox.Group
            value={selectedFeatures}
            onChange={onChange}
          >
            <Grid gutter="xs">
              {displayFeatures.map(feature => (
                <Grid.Col key={feature} span={{ base: 12, xs: 6, sm: 4 }}>
                  <Checkbox
                    value={feature}
                    label={t(`properties.features.${feature}`)}
                    disabled={isViewMode}
                    styles={{
                      root: { fontSize: '16px' }
                    }}
                  />
                </Grid.Col>
              ))}
            </Grid>
          </Checkbox.Group>
          {hasMore && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              rightSection={showAll ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              fullWidth
            >
              {showAll ? t('common.showLess') : t('common.showMore')}
            </Button>
          )}
        </Stack>
      </Card>
    );
  };

  const renderStepContent = () => {
    if (steps[activeStep].key === 'basic') {
      const propertyType = form.values.property_type;
      const isLand = propertyType === 'land';
      const isBuilding = ['condo', 'apartment', 'penthouse'].includes(propertyType);
      const isHouse = ['villa', 'house'].includes(propertyType);

      return (
        <Stack gap="md">
          <Accordion defaultValue={['main', 'location', 'details']} multiple variant="separated">
            <Accordion.Item value="main">
              <Accordion.Control icon={<IconBuildingEstate size={20} />}>
                <Text fw={500}>{t('properties.form.mainInfo') || 'Основная информация'}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Grid gutter="md">
                  <Grid.Col span={12}>
                    <TextInput
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.form.propertyNameLabel')}</Text>
                        </Group>
                      }
                      placeholder={t('properties.form.propertyNamePlaceholder')}
                      maxLength={100}
                      required
                      disabled={isViewMode}
                      leftSection={<IconBuildingEstate size={16} />}
                      {...form.getInputProps('property_name')}
                      styles={{
                        input: { fontSize: '16px', fontWeight: 500 }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <TextInput
                      label={
                        <Group gap="xs">
                          <Text size="sm" fw={500}>{t('properties.complexName')}</Text>
                          <Tooltip label={t('properties.complexInfo')} withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={showComplexInfo}
                            >
                              <IconInfoCircle size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      }
                      placeholder={t('properties.complexNamePlaceholder')}
                      disabled={isViewMode}
                      leftSection={<IconHome size={16} />}
                      {...form.getInputProps('complex_name')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <Divider my="xs" label={t('properties.form.mainDetails') || 'Основные детали'} labelPosition="center" />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.propertyNumber')}</Text>
                        </Group>
                      }
                      placeholder="L6, V123, etc."
                      required
                      disabled={isViewMode}
                      leftSection={<Text size="sm" c="dimmed">#</Text>}
                      {...form.getInputProps('property_number')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.dealType')}</Text>
                        </Group>
                      }
                      placeholder={t('common.select')}
                      required
                      disabled={isViewMode}
                      data={[
                        { value: 'sale', label: t('properties.dealTypes.sale') },
                        { value: 'rent', label: t('properties.dealTypes.rent') },
                        { value: 'both', label: t('properties.dealTypes.both') }
                      ]}
                      value={form.values.deal_type}
                      onChange={(value) => handleDealTypeChange(value!)}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.propertyType')}</Text>
                        </Group>
                      }
                      placeholder={t('common.select')}
                      required
                      disabled={isViewMode}
                      data={[
                        { value: 'villa', label: t('properties.propertyTypes.villa') },
                        { value: 'apartment', label: t('properties.propertyTypes.apartment') },
                        { value: 'condo', label: t('properties.propertyTypes.condo') },
                        { value: 'penthouse', label: t('properties.propertyTypes.penthouse') },
                        { value: 'house', label: t('properties.propertyTypes.house') },
                        { value: 'land', label: t('properties.propertyTypes.land') }
                      ]}
                      {...form.getInputProps('property_type')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.region')}</Text>
                        </Group>
                      }
                      placeholder={t('common.select')}
                      required
                      searchable
                      disabled={isViewMode}
                      data={[
                        { value: 'bangtao', label: t('properties.regions.bangtao') },
                        { value: 'kamala', label: t('properties.regions.kamala') },
                        { value: 'surin', label: t('properties.regions.surin') },
                        { value: 'layan', label: t('properties.regions.layan') },
                        { value: 'rawai', label: t('properties.regions.rawai') },
                        { value: 'patong', label: t('properties.regions.patong') },
                        { value: 'kata', label: t('properties.regions.kata') },
                        { value: 'chalong', label: t('properties.regions.chalong') },
                        { value: 'naiharn', label: t('properties.regions.naiharn') },
                        { value: 'phukettown', label: t('properties.regions.phukettown') },
                        { value: 'maikhao', label: t('properties.regions.maikhao') },
                        { value: 'yamu', label: t('properties.regions.yamu') },
                        { value: 'paklok', label: t('properties.regions.paklok') }
                      ]}
                      {...form.getInputProps('region')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  {(dealType === 'sale' || dealType === 'both') && !isLand && (
                    <>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Select
                          label={<Text size="sm" fw={500}>{t('properties.buildingOwnership')}</Text>}
                          placeholder={t('common.select')}
                          disabled={isViewMode}
                          data={[
                            { value: 'freehold', label: t('properties.ownershipTypes.freehold') },
                            { value: 'leasehold', label: t('properties.ownershipTypes.leasehold') },
                            { value: 'company', label: t('properties.ownershipTypes.company') }
                          ]}
                          {...form.getInputProps('building_ownership')}
                          styles={{
                            input: { fontSize: '16px' }
                          }}
                        />
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Select
                          label={<Text size="sm" fw={500}>{t('properties.ownership')}</Text>}
                          placeholder={t('common.select')}
                          disabled={isViewMode}
                          data={[
                            { value: 'freehold', label: t('properties.ownershipTypes.freehold') },
                            { value: 'leasehold', label: t('properties.ownershipTypes.leasehold') },
                            { value: 'company', label: t('properties.ownershipTypes.company') }
                          ]}
                          {...form.getInputProps('ownership_type')}
                          styles={{
                            input: { fontSize: '16px' }
                          }}
                        />
                      </Grid.Col>
                    </>
                  )}

                  {(dealType === 'sale' || dealType === 'both') && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={<Text size="sm" fw={500}>{t('properties.landOwnership')}</Text>}
                        placeholder={t('common.select')}
                        disabled={isViewMode}
                        data={[
                          { value: 'freehold', label: t('properties.ownershipTypes.freehold') },
                          { value: 'leasehold', label: t('properties.ownershipTypes.leasehold') },
                          { value: 'company', label: t('properties.ownershipTypes.company') }
                        ]}
                        {...form.getInputProps('land_ownership')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}
                </Grid>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="location">
              <Accordion.Control icon={<IconMapPin size={20} />}>
                <Text fw={500}>{t('properties.form.locationInfo') || 'Местоположение'}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  <Stack gap="xs">
                    <Group gap="xs" justify="space-between" style={{ width: '100%' }}>
                      <Group gap={4}>
                        <Text size="sm" fw={500}>{t('properties.googleMapsLink')}</Text>
                        {!isViewMode && googleMapsLink && !hasCoordinatesForCurrentLink && (
                          <Badge color="orange" size="sm" variant="dot">
                            {t('properties.form.googleMapsWarning') || 'Требуется определение'}
                          </Badge>
                        )}
                      </Group>
                      {!isViewMode && (
                        <Group gap="xs">
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconClipboard size={14} />}
                            onClick={handlePasteFromClipboard}
                            color="gray"
                          >
                            {t('properties.form.pasteButton') || 'Вставить'}
                          </Button>
                          <Button
                            variant={!hasCoordinatesForCurrentLink && googleMapsLink ? "filled" : "light"}
                            size="xs"
                            leftSection={<IconMapPinFilled size={14} />}
                            onClick={() => handleAutoDetectCoordinates()}
                            loading={detectingCoords}
                            color={!hasCoordinatesForCurrentLink && googleMapsLink ? "orange" : "blue"}
                          >
                            {t('properties.autoDetectCoordinates') || 'Определить'}
                          </Button>
                        </Group>
                      )}
                    </Group>
                    
                    <TextInput
                      placeholder={t('properties.form.googleMapsPlaceholder')}
                      value={form.values.google_maps_link}
                      onChange={(e) => handleGoogleMapsLinkChange(e.currentTarget.value)}
                      disabled={isViewMode}
                      leftSection={<IconMapPin size={16} />}
                      rightSection={
                        !isViewMode && googleMapsLink && hasCoordinatesForCurrentLink ? (
                          <ThemeIcon color="green" variant="light" size="sm">
                            <IconCheck size={14} />
                          </ThemeIcon>
                        ) : null
                      }
                      styles={{
                        input: { 
                          fontSize: '16px',
                          paddingRight: '40px'
                        }
                      }}
                    />
                    
                    {!isViewMode && (
                      <Text size="xs" c="dimmed">
                        {t('properties.form.googleMapsHint') || 'Вставьте ссылку Google Maps для автоматического определения координат и адреса'}
                      </Text>
                    )}
                  </Stack>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={
                          <Group gap={4}>
                            <Text size="sm" fw={500}>{t('properties.latitude')}</Text>
                            {form.values.latitude && (
                              <ThemeIcon color="green" variant="light" size="xs">
                                <IconCheck size={10} />
                              </ThemeIcon>
                            )}
                          </Group>
                        }
                        placeholder="7.123456"
                        decimalScale={6}
                        disabled={isViewMode}
                        leftSection={<Text size="xs" c="dimmed">LAT</Text>}
                        {...form.getInputProps('latitude')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={
                          <Group gap={4}>
                            <Text size="sm" fw={500}>{t('properties.longitude')}</Text>
                            {form.values.longitude && (
                              <ThemeIcon color="green" variant="light" size="xs">
                                <IconCheck size={10} />
                              </ThemeIcon>
                            )}
                          </Group>
                        }
                        placeholder="98.123456"
                        decimalScale={6}
                        disabled={isViewMode}
                        leftSection={<Text size="xs" c="dimmed">LNG</Text>}
                        {...form.getInputProps('longitude')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  </Grid>

                  <Stack gap="xs">
                    <Group gap={4}>
                      <Text size="sm" fw={500}>{t('properties.address')}</Text>
                      {form.values.address && form.values.google_maps_link && (
                        <Badge size="xs" variant="light" color="blue">
                          {t('properties.form.autoFilled') || 'Автозаполнено'}
                        </Badge>
                      )}
                    </Group>
                    <Textarea
                      placeholder={t('properties.form.addressPlaceholder')}
                      required
                      minRows={2}
                      disabled={isViewMode}
                      {...form.getInputProps('address')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Stack>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="details">
              <Accordion.Control icon={<IconClipboardText size={20} />}>
                <Text fw={500}>{t('properties.form.propertyDetails') || 'Детали объекта'}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Grid gutter="md">
                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.bedrooms')}</Text>}
                        placeholder="0"
                        min={0}
                        step={0.5}
                        disabled={isViewMode}
                        {...form.getInputProps('bedrooms')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.bathrooms')}</Text>}
                        placeholder="0"
                        min={0}
                        step={0.5}
                        disabled={isViewMode}
                        {...form.getInputProps('bathrooms')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.indoorArea')}</Text>}
                        placeholder="0"
                        min={0}
                        suffix=" м²"
                        disabled={isViewMode}
                        {...form.getInputProps('indoor_area')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.outdoorArea')}</Text>}
                        placeholder="0"
                        min={0}
                        suffix=" м²"
                        disabled={isViewMode}
                        {...form.getInputProps('outdoor_area')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={<Text size="sm" fw={500}>{t('properties.plotSize')}</Text>}
                      placeholder="0"
                      min={0}
                      suffix=" м²"
                      disabled={isViewMode}
                      {...form.getInputProps('plot_size')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  {(isHouse || isBuilding) && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.floors')}</Text>}
                        placeholder="1"
                        min={1}
                        disabled={isViewMode}
                        {...form.getInputProps('floors')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {isBuilding && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label={<Text size="sm" fw={500}>{t('properties.floor')}</Text>}
                        placeholder={t('properties.form.floorPlaceholder')}
                        disabled={isViewMode}
                        {...form.getInputProps('floor')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.constructionYear')}</Text>}
                        placeholder="2020"
                        min={1900}
                        max={2100}
                        disabled={isViewMode}
                        {...form.getInputProps('construction_year')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={<Text size="sm" fw={500}>{t('properties.constructionMonth')}</Text>}
                        placeholder={t('properties.form.constructionMonthPlaceholder')}
                        disabled={isViewMode}
                        data={[
                          { value: '01', label: t('properties.form.months.january') },
                          { value: '02', label: t('properties.form.months.february') },
                          { value: '03', label: t('properties.form.months.march') },
                          { value: '04', label: t('properties.form.months.april') },
                          { value: '05', label: t('properties.form.months.may') },
                          { value: '06', label: t('properties.form.months.june') },
                          { value: '07', label: t('properties.form.months.july') },
                          { value: '08', label: t('properties.form.months.august') },
                          { value: '09', label: t('properties.form.months.september') },
                          { value: '10', label: t('properties.form.months.october') },
                          { value: '11', label: t('properties.form.months.november') },
                          { value: '12', label: t('properties.form.months.december') }
                        ]}
                        {...form.getInputProps('construction_month')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={<Text size="sm" fw={500}>{t('properties.furnitureStatus')}</Text>}
                        placeholder={t('common.select')}
                        disabled={isViewMode}
                        data={[
                          { value: 'fullyFurnished', label: t('properties.form.furnitureStatuses.fullyFurnished') },
                          { value: 'partiallyFurnished', label: t('properties.form.furnitureStatuses.partiallyFurnished') },
                          { value: 'unfurnished', label: t('properties.form.furnitureStatuses.unfurnished') },
                          { value: 'builtIn', label: t('properties.form.furnitureStatuses.builtIn') },
                          { value: 'empty', label: t('properties.form.furnitureStatuses.empty') }
                        ]}
                        {...form.getInputProps('furniture_status')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<Text size="sm" fw={500}>{t('properties.parkingSpaces')}</Text>}
                        placeholder="0"
                        min={0}
                        disabled={isViewMode}
                        {...form.getInputProps('parking_spaces')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  {!isLand && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={<Text size="sm" fw={500}>{t('properties.petsAllowed')}</Text>}
                        placeholder={t('common.select')}
                        disabled={isViewMode}
                        data={[
                          { value: 'yes', label: t('properties.form.petsOptions.yes') },
                          { value: 'no', label: t('properties.form.petsOptions.no') },
                          { value: 'negotiable', label: t('properties.form.petsOptions.negotiable') },
                          { value: 'custom', label: t('properties.form.petsOptions.custom') }
                        ]}
                        {...form.getInputProps('pets_allowed')}
                        styles={{
                          input: { fontSize: '16px' }
                        }}
                      />
                    </Grid.Col>
                  )}

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={
                        <Group gap={4}>
                          <Text size="sm" fw={500}>{t('properties.status')}</Text>
                        </Group>
                      }
                      placeholder={t('common.select')}
                      disabled={!canEditStatus || isViewMode}
                      data={[
                        { value: 'draft', label: t('properties.statuses.draft') },
                        { value: 'published', label: t('properties.statuses.published') },
                        { value: 'hidden', label: t('properties.statuses.hidden') },
                        { value: 'archived', label: t('properties.statuses.archived') }
                      ]}
                      {...form.getInputProps('status')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <TextInput
                      label={<Text size="sm" fw={500}>{t('properties.form.videoUrlLabel')}</Text>}
                      placeholder={t('properties.form.videoUrlPlaceholder')}
                      disabled={isViewMode}
                      {...form.getInputProps('video_url')}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />
                  </Grid.Col>
                </Grid>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          {!isViewMode && !isEdit && isMobile && (
            <Button
              fullWidth
              size="lg"
              onClick={handleSaveClick}
              loading={loading || isCreatingProperty}
              leftSection={<IconDeviceFloppy size={18} />}
              rightSection={<IconChevronRight size={18} />}
            >
              {t('common.continue')}
            </Button>
          )}
        </Stack>
      );
    }

    if (steps[activeStep].key === 'media') {
      return (
        <Stack gap="md">
          <PhotosUploader
            propertyId={Number(id) || 0}
            photos={propertyData?.photos || []}
            bedrooms={form.values.bedrooms || 1}
            onUpdate={isEdit ? loadProperty : () => {}}
            viewMode={isViewMode}
            onChange={(photos) => setTempPhotos(photos)}
          />
    
          <VideoUploader
            propertyId={Number(id) || 0}
            videos={propertyData?.videos || []}
            onUpdate={isEdit ? loadProperty : () => {}}
            viewMode={isViewMode}
            onChange={(videos) => setTempVideos(videos)}
          />
    
          <FloorPlanUploader
            propertyId={Number(id) || 0}
            floorPlanUrl={propertyData?.floor_plan_url}
            onUpdate={isEdit ? loadProperty : () => {}}
            viewMode={isViewMode}
            onChange={(file) => setTempFloorPlan(file)}
          />
    
          <VRPanoramaUploader
            propertyId={Number(id) || 0}
            onUpdate={isEdit ? loadProperty : () => {}}
            viewMode={isViewMode}
            onChange={(panoramas) => setTempVRPanoramas(panoramas)}
          />
        </Stack>
      );
    }

    if (steps[activeStep].key === 'features') {
      return (
        <Stack gap="md">
          <Accordion defaultValue={['renovation', 'beach', 'rental']} multiple variant="separated">
            <Accordion.Item value="renovation">
              <Accordion.Control icon={<IconSettings size={20} />}>
                <Text fw={500}>{t('properties.renovation.title')}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  <Radio.Group
                    label={<Text size="sm" fw={500}>{t('properties.renovation.type')}</Text>}
                    value={form.values.renovation_type}
                    onChange={(value) => {
                      form.setFieldValue('renovation_type', value);
                      handleRenovationChange(value);
                    }}
                  >
                    <Stack gap="xs" mt="xs">
                      <Radio value="" label={t('properties.renovation.noRenovation')} disabled={isViewMode} />
                      <Radio value="partial" label={t('properties.renovation.types.partial')} disabled={isViewMode} />
                      <Radio value="full" label={t('properties.renovation.types.full')} disabled={isViewMode} />
                    </Stack>
                  </Radio.Group>

                  {showRenovationDate && (
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Select
                          label={<Text size="sm" fw={500}>{t('properties.renovation.month') || 'Месяц реновации'}</Text>}
                          placeholder={t('properties.form.constructionMonthPlaceholder')}
                          disabled={isViewMode}
                          data={[
                            { value: '01', label: t('properties.form.months.january') },
                            { value: '02', label: t('properties.form.months.february') },
                            { value: '03', label: t('properties.form.months.march') },
                            { value: '04', label: t('properties.form.months.april') },
                            { value: '05', label: t('properties.form.months.may') },
                            { value: '06', label: t('properties.form.months.june') },
                            { value: '07', label: t('properties.form.months.july') },
                            { value: '08', label: t('properties.form.months.august') },
                            { value: '09', label: t('properties.form.months.september') },
                            { value: '10', label: t('properties.form.months.october') },
                            { value: '11', label: t('properties.form.months.november') },
                            { value: '12', label: t('properties.form.months.december') }
                          ]}
                          value={form.values.renovation_date ? dayjs(form.values.renovation_date).format('MM') : ''}
                          onChange={(value) => {
                            if (value) {
                              const currentYear = form.values.renovation_date 
                                ? dayjs(form.values.renovation_date).year() 
                                : new Date().getFullYear();
                              form.setFieldValue('renovation_date', new Date(currentYear, parseInt(value) - 1, 1));
                            }
                          }}
                          styles={{
                            input: { fontSize: '16px' }
                          }}
                        />
                      </Grid.Col>
                        
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label={<Text size="sm" fw={500}>{t('properties.renovation.year') || 'Год реновации'}</Text>}
                          placeholder="2020"
                          min={1900}
                          max={2100}
                          disabled={isViewMode}
                          value={form.values.renovation_date ? dayjs(form.values.renovation_date).year() : undefined}
                          onChange={(value) => {
                            if (value) {
                              const currentMonth = form.values.renovation_date 
                                ? dayjs(form.values.renovation_date).month() 
                                : 0;
                              form.setFieldValue('renovation_date', new Date(Number(value), currentMonth, 1));
                            } else {
                              form.setFieldValue('renovation_date', null);
                            }
                          }}
                          styles={{
                            input: { fontSize: '16px' }
                          }}
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="beach">
              <Accordion.Control icon={<IconMapPin size={20} />}>
                <Text fw={500}>{t('properties.distance.title')}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  <NumberInput
                    label={<Text size="sm" fw={500}>{t('properties.distance.label')}</Text>}
                    placeholder={t('properties.distance.placeholder')}
                    description={t('properties.distance.tooltip')}
                    min={0}
                    suffix=" м"
                    disabled={isViewMode}
                    {...form.getInputProps('distance_to_beach')}
                    styles={{
                      input: { fontSize: '16px' }
                    }}
                  />

                  {form.values.distance_to_beach && (
                    <Badge size="lg" variant="light" color="blue">
                      {form.values.distance_to_beach < 200 && t('properties.distance.categories.onBeach')}
                      {form.values.distance_to_beach >= 200 && form.values.distance_to_beach <= 500 && t('properties.distance.categories.nearBeach')}
                      {form.values.distance_to_beach > 500 && form.values.distance_to_beach <= 1000 && t('properties.distance.categories.closeToBeach')}
                      {form.values.distance_to_beach > 1000 && form.values.distance_to_beach <= 2000 && t('properties.distance.categories.within2km')}
                      {form.values.distance_to_beach > 2000 && form.values.distance_to_beach <= 5000 && t('properties.distance.categories.within5km')}
                      {form.values.distance_to_beach > 5000 && t('properties.distance.categories.farFromBeach')}
                    </Badge>
                  )}

                  {!isViewMode && form.values.latitude && form.values.longitude && (
                    <Alert icon={<IconInfoCircle size={18} />} color="blue">
                      {t('properties.distance.autoCalculateDescription')}
                    </Alert>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {(dealType === 'rent' || dealType === 'both') && (
              <Accordion.Item value="rental">
                <Accordion.Control icon={<IconClipboardText size={20} />}>
                  <Text fw={500}>{t('properties.rental.includedTitle')}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Textarea
                    label={<Text size="sm" fw={500}>{t('properties.rental.includedLabel')}</Text>}
                    placeholder={t('properties.rental.includedPlaceholder')}
                    description={t('properties.rental.includedTooltip')}
                    minRows={3}
                    disabled={isViewMode}
                    {...form.getInputProps('rental_includes')}
                    styles={{
                      input: { fontSize: '16px' }
                    }}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>

          {renderFeaturesGroup(
            PROPERTY_FEATURES.property,
            form.values.features.property,
            (value) => form.setFieldValue('features.property', value),
            showAllPropertyFeatures,
            setShowAllPropertyFeatures,
            t('properties.features.propertyFeatures'),
            'blue'
          )}

          {renderFeaturesGroup(
            PROPERTY_FEATURES.outdoor,
            form.values.features.outdoor,
            (value) => form.setFieldValue('features.outdoor', value),
            showAllOutdoorFeatures,
            setShowAllOutdoorFeatures,
            t('properties.features.outdoorFeatures'),
            'green'
          )}

          {(dealType === 'rent' || dealType === 'both') && renderFeaturesGroup(
            PROPERTY_FEATURES.rental,
            form.values.features.rental,
            (value) => form.setFieldValue('features.rental', value),
            showAllRentalFeatures,
            setShowAllRentalFeatures,
            t('properties.features.rentalFeatures'),
            'cyan'
          )}

          {renderFeaturesGroup(
            PROPERTY_FEATURES.location,
            form.values.features.location,
            (value) => form.setFieldValue('features.location', value),
            showAllLocationFeatures,
            setShowAllLocationFeatures,
            t('properties.features.locationFeatures'),
            'orange'
          )}

          {renderFeaturesGroup(
            PROPERTY_FEATURES.views,
            form.values.features.views,
            (value) => form.setFieldValue('features.views', value),
            showAllViews,
            setShowAllViews,
            t('properties.features.views'),
            'violet'
          )}
        </Stack>
      );
    }

    if (steps[activeStep].key === 'pricing') {
      return (
        <Stack gap="md">
          {(dealType === 'sale' || dealType === 'both') && (
            <SalePriceForm
              propertyId={Number(id) || 0}
              initialData={propertyData ? {
                price: propertyData.sale_price,
                pricing_mode: propertyData.sale_pricing_mode || 'net',
                commission_type: propertyData.sale_commission_type_new || null,
                commission_value: propertyData.sale_commission_value_new || null,
                source_price: propertyData.sale_source_price || null
              } : {
                price: form.values.sale_price,
                pricing_mode: form.values.sale_pricing_mode,
                commission_type: form.values.sale_commission_type_new,
                commission_value: form.values.sale_commission_value_new,
                source_price: form.values.sale_source_price
              }}
              viewMode={isViewMode}
              onChange={(data) => {
                form.setFieldValue('sale_price', data.sale_price);
                form.setFieldValue('sale_pricing_mode', data.sale_pricing_mode);
                form.setFieldValue('sale_commission_type_new', data.sale_commission_type_new);
                form.setFieldValue('sale_commission_value_new', data.sale_commission_value_new);
                form.setFieldValue('sale_source_price', data.sale_source_price);
                form.setFieldValue('sale_margin_amount', data.sale_margin_amount);
                form.setFieldValue('sale_margin_percentage', data.sale_margin_percentage);
                
                if (isEdit) loadProperty();
              }}
            />
          )}

          {(dealType === 'rent' || dealType === 'both') && (
            <>
              <YearPriceForm
                propertyId={Number(id) || 0}
                initialData={propertyData ? {
                  price: propertyData.year_price,
                  pricing_mode: propertyData.year_pricing_mode || 'net',
                  commission_type: propertyData.year_commission_type || null,
                  commission_value: propertyData.year_commission_value || null,
                  source_price: propertyData.year_source_price || null
                } : {
                  price: form.values.year_price,
                  pricing_mode: form.values.year_pricing_mode,
                  commission_type: form.values.year_commission_type,
                  commission_value: form.values.year_commission_value,
                  source_price: form.values.year_source_price
                }}
                viewMode={isViewMode}
                onChange={(data) => {
                  form.setFieldValue('year_price', data.year_price);
                  form.setFieldValue('year_pricing_mode', data.year_pricing_mode);
                  form.setFieldValue('year_commission_type', data.year_commission_type);
                  form.setFieldValue('year_commission_value', data.year_commission_value);
                  form.setFieldValue('year_source_price', data.year_source_price);
                  form.setFieldValue('year_margin_amount', data.year_margin_amount);
                  form.setFieldValue('year_margin_percentage', data.year_margin_percentage);
                  
                  if (isEdit) loadProperty();
                }}
              />

              <MonthlyPricing
                propertyId={Number(id) || 0}
                initialPricing={
                  isEdit 
                    ? (propertyData?.monthly_pricing || []) 
                    : (form.values.monthlyPricing || [])
                }
                viewMode={isViewMode}
                onChange={(monthlyPricing) => {
                  console.log('PropertyForm: Received monthly pricing update:', monthlyPricing);
                  form.setFieldValue('monthlyPricing', monthlyPricing);
                }}
              />

              <SeasonalPricing viewMode={isViewMode} form={form} />

              <DepositForm
                dealType="rent"
                viewMode={false}
                depositType={depositType}
                depositAmount={depositAmount}
                onDepositTypeChange={setDepositType}
                onDepositAmountChange={setDepositAmount}
              />
              
              <UtilitiesForm viewMode={isViewMode} />
            </>
          )}
        </Stack>
      );
    }

    if (steps[activeStep].key === 'calendar') {
      return (
        <CalendarManager 
          propertyId={Number(id) || 0} 
          viewMode={isViewMode}
          initialBlockedDates={
            isEdit 
              ? undefined
              : (aiTempData.blockedDates || [])
          }
          onChange={(dates: any) => setTempBlockedDates(dates as TempBlockedDate[])}
        />
      );
    }

    if (steps[activeStep].key === 'owner') {
      if (!showOwnerTab) return null;
      return (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group>
              <ThemeIcon size="lg" radius="md" variant="light">
                <IconUser size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>{t('properties.ownerInfo')}</Text>
                <Text size="sm" c="dimmed">{t('properties.form.ownerInfoDescription') || 'Контактные данные владельца'}</Text>
              </div>
            </Group>

            <Divider />

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={<Text size="sm" fw={500}>{t('properties.ownerName')}</Text>}
                  placeholder={t('properties.form.ownerNamePlaceholder') || 'Имя владельца'}
                  disabled={isViewMode}
                  {...form.getInputProps('owner_name')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={<Text size="sm" fw={500}>{t('properties.ownerPhone')}</Text>}
                  placeholder="+66 XXX XXX XXX"
                  disabled={isViewMode}
                  {...form.getInputProps('owner_phone')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={<Text size="sm" fw={500}>{t('properties.ownerEmail')}</Text>}
                  placeholder="owner@example.com"
                  type="email"
                  disabled={isViewMode}
                  {...form.getInputProps('owner_email')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={<Text size="sm" fw={500}>{t('properties.ownerTelegram')}</Text>}
                  placeholder="@username"
                  disabled={isViewMode}
                  {...form.getInputProps('owner_telegram')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label={<Text size="sm" fw={500}>{t('properties.ownerInstagram')}</Text>}
                  placeholder="@username"
                  disabled={isViewMode}
                  {...form.getInputProps('owner_instagram')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Textarea
                  label={<Text size="sm" fw={500}>{t('properties.ownerNotes')}</Text>}
                  placeholder={t('properties.form.ownerNotesPlaceholder')}
                  minRows={4}
                  disabled={isViewMode}
                  {...form.getInputProps('owner_notes')}
                  styles={{
                    input: { fontSize: '16px' }
                  }}
                />
              </Grid.Col>

              {isEdit && form.values.owner_name && !isViewMode && (
                <Grid.Col span={12}>
                  <Button
                    variant="light"
                    leftSection={<IconUser size={18} />}
                    onClick={() => setOwnerAccessModalVisible(true)}
                    fullWidth
                    size="md"
                  >
                    {t('properties.ownerAccess.createButton')}
                  </Button>
                </Grid.Col>
              )}
            </Grid>
          </Stack>
        </Card>
      );
    }

    if (steps[activeStep].key === 'translations') {
      return (
        <Stack gap="md">
          {isEdit && !isViewMode && (
            <AIDescriptionGenerator
              propertyId={Number(id)}
              onGenerated={handleAIGenerated}
              disabled={false}
            />
          )}

          {!isEdit && (
            <Alert
              icon={<IconInfoCircle size={18} />}
              title={t('properties.ai.generatorAlert')}
              color="blue"
            >
              {t('properties.ai.generatorAlertDescription')}
            </Alert>
          )}

          <TranslationsEditor viewMode={isViewMode} form={form} />
        </Stack>
      );
    }

    return null;
  };

  if (loading && !propertyData) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="xl" />
          <Text c="dimmed">{t('common.loading') || 'Загрузка...'}</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box ref={targetRef}>
      <MediaUploadProgress />

      <Card shadow="sm" padding={0} radius="md" withBorder>
        <Paper p="lg" withBorder style={{ borderBottom: `1px solid ${theme.colors.dark[4]}` }}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Group>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => navigate('/properties')}
                >
                  <IconArrowLeft size={20} />
                </ActionIcon>
                <div>
                  <Group gap="xs">
                    {isViewMode && <IconEye size={20} />}
                    <Title order={3}>
                      {isViewMode 
                        ? t('properties.form.viewMode') 
                        : (isEdit ? t('properties.form.editMode') : t('properties.form.createMode'))
                      }
                    </Title>
                  </Group>
                  {isEdit && propertyData && (
                    <Text size="sm" c="dimmed">
                      {propertyData.property_name || propertyData.property_number}
                    </Text>
                  )}
                </div>
              </Group>

              <Group>
                {!isEdit && !isViewMode && (
                  <Button
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'grape', deg: 135 }}
                    leftSection={<IconRobot size={18} />}
                    onClick={() => setAiModalVisible(true)}
                    size={isMobile ? 'sm' : 'md'}
                  >
                    {!isMobile && t('properties.form.createWithAI')}
                  </Button>
                )}

                {isViewMode && canEdit && (
                  <Button
                    leftSection={<IconPencil size={18} />}
                    onClick={() => navigate(`/properties/edit/${id}`)}
                    size={isMobile ? 'sm' : 'md'}
                  >
                    {!isMobile && t('properties.form.editButton')}
                  </Button>
                )}
              </Group>
            </Group>

            {!isViewMode && <ProgressIndicator />}
          </Stack>
        </Paper>

        <Box p={isMobile ? 'md' : 'lg'}>
          {isMobile ? (
            <Stack gap="md">
              <Grid gutter="md">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = activeStep === index;
                  const isCompleted = activeStep > index;
                  const isDisabled = step.disabled;
                  
                  const span = index === steps.length - 1 ? 12 : 6;
                  
                  return (
                    <Grid.Col key={step.value} span={span}>
                      <Tooltip
                        label={isDisabled ? (t('properties.form.fillRequiredFirst') || 'Сначала заполните обязательные поля') : null}
                        disabled={!isDisabled}
                        withArrow
                      >
                        <Paper
                          p="sm"
                          radius="md"
                          withBorder
                          style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            backgroundColor: isActive 
                              ? (isDark ? theme.colors.dark[5] : theme.colors.blue[0])
                              : isCompleted
                              ? (isDark ? theme.colors.dark[6] : theme.colors.green[0])
                              : (isDark ? theme.colors.dark[6] : theme.colors.gray[0]),
                            borderColor: isActive
                              ? theme.colors.blue[5]
                              : isCompleted
                              ? theme.colors.green[5]
                              : (isDark ? theme.colors.dark[4] : theme.colors.gray[3]),
                            borderWidth: isActive || isCompleted ? '2px' : '1px',
                            transform: 'scale(1)',
                            minHeight: '56px',
                            height: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onClick={() => !isDisabled && setActiveStep(index)}
                          onTouchStart={(e) => {
                            if (!isDisabled) e.currentTarget.style.transform = 'scale(0.98)';
                          }}
                          onTouchEnd={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onMouseDown={(e) => {
                            if (!isDisabled) e.currentTarget.style.transform = 'scale(0.98)';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap" align="center" style={{ width: '100%' }}>
                            <Group gap="sm" wrap="nowrap" align="center">
                              <ThemeIcon
                                size={36}
                                radius="md"
                                variant="light"
                                color={isActive ? "blue" : isCompleted ? "green" : "gray"}
                                style={{
                                  backgroundColor: isActive
                                    ? (isDark ? theme.colors.blue[9] : theme.colors.blue[1])
                                    : isCompleted
                                    ? (isDark ? theme.colors.green[9] : theme.colors.green[1])
                                    : (isDark ? theme.colors.dark[5] : theme.colors.gray[1]),
                                  flexShrink: 0
                                }}
                              >
                                <StepIcon size={18} />
                              </ThemeIcon>
                              <Text 
                                fw={isActive ? 600 : 500} 
                                size="sm"
                                c={isActive 
                                  ? (isDark ? theme.colors.blue[3] : theme.colors.blue[7])
                                  : isCompleted
                                  ? (isDark ? theme.colors.green[3] : theme.colors.green[7])
                                  : (isDark ? theme.colors.gray[4] : theme.colors.gray[7])
                                }
                                lineClamp={1}
                                style={{ 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {step.label}
                              </Text>
                            </Group>
                            <ActionIcon
                              variant={isActive ? "filled" : isCompleted ? "light" : "subtle"}
                              color={isActive ? "blue" : isCompleted ? "green" : "gray"}
                              size="md"
                              radius="md"
                              style={{ flexShrink: 0 }}
                            >
                              {isCompleted ? (
                                <IconCheck size={16} />
                              ) : (
                                <IconChevronRight size={16} />
                              )}
                            </ActionIcon>
                          </Group>
                        </Paper>
                      </Tooltip>
                    </Grid.Col>
                  );
                })}
              </Grid>
              
              <Box>
                {renderStepContent()}
              </Box>
              
              {!isViewMode && (
                <Paper 
                  p="md" 
                  radius="md" 
                  withBorder 
                  style={{ 
                    position: 'sticky', 
                    bottom: 0, 
                    backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
                    zIndex: 10,
                    boxShadow: isDark 
                      ? '0 -2px 10px rgba(0, 0, 0, 0.3)'
                      : '0 -2px 10px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <Group justify="space-between">
                    <Button
                      variant="light"
                      leftSection={<IconChevronLeft size={18} />}
                      onClick={prevStep}
                      disabled={activeStep === 0}
                      size="md"
                    >
                      {t('common.previous')}
                    </Button>
                    {activeStep < steps.length - 1 ? (
                      <Button
                        rightSection={<IconChevronRight size={18} />}
                        onClick={nextStep}
                        disabled={steps[activeStep + 1]?.disabled}
                        size="md"
                      >
                        {t('common.next')}
                      </Button>
                    ) : (
                      <Button
                        leftSection={<IconDeviceFloppy size={18} />}
                        onClick={handleSaveClick}
                        loading={loading || fillingFromAI || isUploadingMedia || isCreatingProperty}
                        size="md"
                      >
                        {isEdit ? t('common.save') : t('common.create')}
                      </Button>
                    )}
                  </Group>
                </Paper>
              )}
            </Stack>
          ) : (
            <Tabs value={activeStep.toString()} onChange={(value) => {
              const targetStep = Number(value);
              if (!steps[targetStep].disabled) {
                setActiveStep(targetStep);
              }
            }}>
              <Tabs.List grow={isTablet}>
                {steps.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <Tooltip
                      key={step.value}
                      label={step.disabled ? (t('properties.form.fillRequiredFirst') || 'Сначала заполните обязательные поля') : null}
                      disabled={!step.disabled}
                      withArrow
                    >
                      <Tabs.Tab
                        value={step.value.toString()}
                        leftSection={<StepIcon size={16} />}
                        disabled={step.disabled}
                        style={step.disabled ? { 
                          cursor: 'not-allowed',
                          opacity: 0.5 
                        } : undefined}
                      >
                        {step.label}
                      </Tabs.Tab>
                    </Tooltip>
                  );
                })}
              </Tabs.List>
              
              {steps.map((step) => (
                <Tabs.Panel key={step.value} value={step.value.toString()} pt="lg">
                  {renderStepContent()}
                </Tabs.Panel>
              ))}
            </Tabs>
          )}
        </Box>

        {!isViewMode && !isMobile && (
          <Affix position={{ bottom: 20, right: 20 }}>
            <Transition transition="slide-up" mounted>
              {(transitionStyles) => (
                <Button
                  style={transitionStyles}
                  leftSection={<IconDeviceFloppy size={18} />}
                  size="lg"
                  onClick={handleSaveClick}
                  loading={loading || fillingFromAI || isUploadingMedia || isCreatingProperty}
                  radius="xl"
                >
                  {isEdit ? t('common.save') : t('common.create')}
                </Button>
              )}
            </Transition>
          </Affix>
        )}
      </Card>

      <AIPropertyCreationModal
        visible={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        onSuccess={handleAISuccess}
      />

      <OwnerAccessModal
        visible={ownerAccessModalVisible}
        onClose={() => setOwnerAccessModalVisible(false)}
        ownerName={form.values.owner_name || ''}
      />

      <Modal
        opened={complexInfoOpened}
        onClose={closeComplexInfo}
        title={t('properties.complexInfo')}
        size="lg"
        centered
      >
        <Text>{t('properties.complexInfoText')}</Text>
      </Modal>

{/* ✅ ИСПРАВЛЕНО: Модальное окно после успешного редактирования */}
      <Modal
        opened={afterSaveModalOpened}
        onClose={closeAfterSaveModal}
        title={t('properties.afterSave.title') || 'Выберите дальнейшие действия'}
        size="md"
        centered
      >
        <Stack gap="md">
          <Button
            fullWidth
            size="lg"
            leftSection={<IconExternalLink size={20} />}
            variant="light"
            color="blue"
            onClick={async () => {
              try {
                setIsGeneratingPreview(true);
                
                // Запрашиваем preview URL с токеном
                const response = await propertiesApi.getPreviewUrl(Number(id));
                
     if (response.data?.success) {
        // ИСПРАВЛЕНИЕ: response.data.data.previewUrl вместо response.data.previewUrl
        window.open(response.data.data.previewUrl, '_blank');
        closeAfterSaveModal();
      } else {
        notifications.show({
          title: t('errors.generic'),
          message: t('properties.messages.previewUrlError'),
          color: 'red',
          icon: <IconX size={18} />
        });
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      notifications.show({
        title: t('errors.generic'),
        message: t('properties.messages.previewUrlError'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }}
  loading={isGeneratingPreview}
  disabled={isGeneratingPreview}
>
  {t('properties.afterSave.viewOnSite')}
</Button>

          <Button
            fullWidth
            size="lg"
            leftSection={<IconList size={20} />}
            variant="light"
            color="green"
            onClick={() => {
              window.location.href = 'https://admin.novaestate.company/properties';
            }}
          >
            {t('properties.afterSave.goToList') || 'К списку всех объектов'}
          </Button>

          <Button
            fullWidth
            size="lg"
            leftSection={<IconPencil size={20} />}
            variant="light"
            color="gray"
            onClick={closeAfterSaveModal}
          >
            {t('properties.afterSave.continueEditing') || 'Продолжить редактирование'}
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
};

export default PropertyForm;