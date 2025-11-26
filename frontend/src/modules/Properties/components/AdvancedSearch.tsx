// frontend/src/modules/Properties/components/AdvancedSearch.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Checkbox,
  Collapse,
  Row,
  Col,
  Divider,
  Radio,
  Tag,
  Tooltip,
  Badge,
  Typography
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  FilterOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PROPERTY_FEATURES } from '../constants/features';
import dayjs from 'dayjs';
import './AdvancedSearch.css';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { Text } = Typography;

interface AdvancedSearchProps {
  onSearch: (filters: any) => void;
  onReset: () => void;
  onMapSearch: () => void;
  loading?: boolean;
  initialFilters?: any;
  mapSearchActive?: boolean;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onReset,
  onMapSearch,
  loading = false,
  initialFilters = {},
}) => {
  const { t } = useTranslation();

  const [filters, setFilters] = useState<any>({
    deal_type: initialFilters.deal_type,
    property_type: initialFilters.property_type,
    bedrooms: initialFilters.bedrooms,
    bedrooms_min: initialFilters.bedrooms_min,
    bedrooms_max: initialFilters.bedrooms_max,
    bathrooms: initialFilters.bathrooms,
    bathrooms_min: initialFilters.bathrooms_min,
    bathrooms_max: initialFilters.bathrooms_max,
    budget: initialFilters.budget || {
      currency: 'THB',
      search_below_max: true
    },
    dates: initialFilters.dates,
    flexible_dates: initialFilters.flexible_dates,
    regions: initialFilters.regions || [],
    features: initialFilters.features || [],
    must_have_features: initialFilters.must_have_features || [],
    building_ownership: initialFilters.building_ownership,
    land_ownership: initialFilters.land_ownership,
    ownership_type: initialFilters.ownership_type,
    indoor_area_min: initialFilters.indoor_area_min,
    indoor_area_max: initialFilters.indoor_area_max,
    outdoor_area_min: initialFilters.outdoor_area_min,
    outdoor_area_max: initialFilters.outdoor_area_max,
    plot_size_min: initialFilters.plot_size_min,
    plot_size_max: initialFilters.plot_size_max,
    complex_name: initialFilters.complex_name,
    furniture: initialFilters.furniture,
    parking: initialFilters.parking,
    pets: initialFilters.pets,
    distance_to_beach: initialFilters.distance_to_beach,
    floor: initialFilters.floor,
    floors: initialFilters.floors,
    construction_year_min: initialFilters.construction_year_min,
    construction_year_max: initialFilters.construction_year_max,
    map_search: initialFilters.map_search
  });

  const [bedroomsMode, setBedroomsMode] = useState<'exact' | 'range'>(
    initialFilters.bedrooms !== undefined ? 'exact' : 'range'
  );
  const [bathroomsMode, setBathroomsMode] = useState<'exact' | 'range'>(
    initialFilters.bathrooms !== undefined ? 'exact' : 'range'
  );
  const [dateMode, setDateMode] = useState<'fixed' | 'flexible'>('fixed');
  const [featureSearch, setFeatureSearch] = useState('');

  useEffect(() => {
    if (initialFilters.map_search) {
      setFilters((prev: any) => ({
        ...prev,
        map_search: initialFilters.map_search
      }));
    }
  }, [initialFilters.map_search]);

  const updateFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const updateNestedFilter = (parent: string, key: string, value: any) => {
    setFilters((prev: any) => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [key]: value
      }
    }));
  };

  const handleReset = () => {
    setFilters({
      budget: {
        currency: 'THB',
        search_below_max: true
      },
      regions: [],
      features: [],
      must_have_features: []
    });
    setBedroomsMode('exact');
    setBathroomsMode('exact');
    setDateMode('fixed');
    setFeatureSearch('');
    onReset();
  };

  const handleSearch = () => {
    console.log('🔍 Filters before cleaning:', filters);
    
    const cleanFilters = Object.entries(filters).reduce((acc: any, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleanNested = Object.entries(value).reduce((nestedAcc: any, [nestedKey, nestedValue]) => {
            if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
              nestedAcc[nestedKey] = nestedValue;
            }
            return nestedAcc;
          }, {});
          if (Object.keys(cleanNested).length > 0) {
            acc[key] = cleanNested;
          }
        } else if (Array.isArray(value)) {
          if (value.length > 0) {
            acc[key] = value;
          }
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    if (cleanFilters.dates && Object.keys(cleanFilters.dates).length === 0) {
      delete cleanFilters.dates;
    }
    
    if (cleanFilters.flexible_dates && Object.keys(cleanFilters.flexible_dates).length === 0) {
      delete cleanFilters.flexible_dates;
    }

    if (cleanFilters.dates) {
      if (!cleanFilters.dates.check_in || !cleanFilters.dates.check_out) {
        delete cleanFilters.dates;
      }
    }

    if (cleanFilters.flexible_dates) {
      if (!cleanFilters.flexible_dates.duration || 
          !cleanFilters.flexible_dates.search_window_start || 
          !cleanFilters.flexible_dates.search_window_end) {
        delete cleanFilters.flexible_dates;
      }
    }

    console.log('🔍 Sending search filters:', cleanFilters);
    console.log('📍 Map search data:', cleanFilters.map_search);
    
    onSearch(cleanFilters);
  };

  const filterFeaturesBySearch = (features: string[]) => {
    if (!featureSearch.trim()) return features;
    
    const searchLower = featureSearch.toLowerCase();
    return features.filter(feature => {
      const translation = t(`properties.features.${feature}`, { defaultValue: feature });
      return translation.toLowerCase().includes(searchLower) ||
             feature.toLowerCase().includes(searchLower);
    });
  };

  const toggleFeature = (feature: string, isMustHave: boolean = false) => {
    const arrayKey = isMustHave ? 'must_have_features' : 'features';
    const currentFeatures = filters[arrayKey] || [];
    
    if (currentFeatures.includes(feature)) {
      updateFilter(arrayKey, currentFeatures.filter((f: string) => f !== feature));
    } else {
      updateFilter(arrayKey, [...currentFeatures, feature]);
      
      if (isMustHave && filters.features?.includes(feature)) {
        updateFilter('features', filters.features.filter((f: string) => f !== feature));
      }
      if (!isMustHave && filters.must_have_features?.includes(feature)) {
        updateFilter('must_have_features', filters.must_have_features.filter((f: string) => f !== feature));
      }
    }
  };

  return (
    <Card className="advanced-search-card">
      <Collapse
        defaultActiveKey={['main', 'budget', 'dates']}
        expandIconPosition="right"
        className="advanced-search-collapse"
      >
        <Panel 
          header={
            <Space>
              <FilterOutlined />
              <strong>{t('propertySearch.advancedSearch.mainParameters')}</strong>
            </Space>
          } 
          key="main"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <label className="filter-label">{t('propertySearch.advancedSearch.dealType')}</label>
                <Select
                  placeholder={t('propertySearch.advancedSearch.selectType')}
                  value={filters.deal_type}
                  onChange={(value) => updateFilter('deal_type', value)}
                  allowClear
                  style={{ width: '100%' }}
                  className="dark-select"
                  options={[
                    { value: 'sale', label: `🏛️ ${t('properties.dealTypes.sale')}` },
                    { value: 'rent', label: `🏠 ${t('properties.dealTypes.rent')}` },
                    { value: 'both', label: `🔄 ${t('propertySearch.advancedSearch.any')}` }
                  ]}
                />
              </Col>

              <Col xs={24} sm={12} md={6}>
                <label className="filter-label">{t('properties.propertyType')}</label>
                <Select
                  placeholder={t('propertySearch.advancedSearch.selectType')}
                  value={filters.property_type}
                  onChange={(value) => updateFilter('property_type', value)}
                  allowClear
                  style={{ width: '100%' }}
                  className="dark-select"
                  options={[
                    { value: 'villa', label: `🏰 ${t('properties.propertyTypes.villa')}` },
                    { value: 'condo', label: `🏢 ${t('properties.propertyTypes.condo')}` },
                    { value: 'apartment', label: `🏠 ${t('properties.propertyTypes.apartment')}` },
                    { value: 'house', label: `🏡 ${t('properties.propertyTypes.house')}` },
                    { value: 'penthouse', label: `🌆 ${t('properties.propertyTypes.penthouse')}` }
                  ]}
                />
              </Col>

              <Col xs={24} sm={12} md={6}>
                <label className="filter-label">{t('properties.complexName')}</label>
                <Input
                  placeholder={t('propertySearch.advancedSearch.complexPlaceholder')}
                  value={filters.complex_name}
                  onChange={(e) => updateFilter('complex_name', e.target.value)}
                  allowClear
                  className="dark-input"
                />
              </Col>

              <Col xs={24} sm={12} md={6}>
                <label className="filter-label">{t('propertySearch.advancedSearch.furniture')}</label>
                <Select
                  placeholder={t('propertySearch.advancedSearch.any')}
                  value={filters.furniture}
                  onChange={(value) => updateFilter('furniture', value)}
                  allowClear
                  style={{ width: '100%' }}
                  className="dark-select"
                  options={[
                    { value: 'fullyFurnished', label: `✅ ${t('propertySearch.advancedSearch.fullyFurnished')}` },
                    { value: 'partiallyFurnished', label: `⚡ ${t('propertySearch.advancedSearch.partiallyFurnished')}` },
                    { value: 'unfurnished', label: `❌ ${t('propertySearch.advancedSearch.unfurnished')}` }
                  ]}
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24}>
                <label className="filter-label">{t('propertySearch.advancedSearch.regionsMultiple')}</label>
                <Select
                  mode="multiple"
                  placeholder={t('propertySearch.advancedSearch.selectRegions')}
                  value={filters.regions}
                  onChange={(value) => updateFilter('regions', value)}
                  allowClear
                  style={{ width: '100%' }}
                  maxTagCount="responsive"
                  className="dark-select"
                  options={[
                    { value: 'bangtao', label: `🏖️ ${t('properties.regions.bangtao')}` },
                    { value: 'kamala', label: `🌴 ${t('properties.regions.kamala')}` },
                    { value: 'surin', label: `🏄 ${t('properties.regions.surin')}` },
                    { value: 'layan', label: `🌊 ${t('properties.regions.layan')}` },
                    { value: 'kata', label: `⛱️ ${t('properties.regions.kata')}` },
                    { value: 'karon', label: `🏝️ ${t('properties.regions.karon')}` },
                    { value: 'patong', label: `🎉 ${t('properties.regions.patong')}` },
                    { value: 'rawai', label: `⚓ ${t('properties.regions.rawai')}` },
                    { value: 'naiharn', label: `🌅 ${t('properties.regions.naiharn')}` },
                    { value: 'maikhao', label: `🦅 ${t('properties.regions.maikhao')}` },
                    { value: 'yamu', label: `🌳 ${t('properties.regions.yamu')}` }
                  ]}
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={6}>
                <Checkbox
                  checked={filters.parking}
                  onChange={(e) => updateFilter('parking', e.target.checked ? true : undefined)}
                  className="dark-checkbox"
                >
                  {t('propertySearch.advancedSearch.withParking')}
                </Checkbox>
              </Col>

              <Col xs={12} sm={8} md={6}>
                <Checkbox
                  checked={filters.pets}
                  onChange={(e) => updateFilter('pets', e.target.checked ? true : undefined)}
                  className="dark-checkbox"
                >
                  {t('propertySearch.advancedSearch.withPets')}
                </Checkbox>
              </Col>

              <Col xs={24} sm={8} md={12}>
                <Button
                  icon={<EnvironmentOutlined />}
                  onClick={onMapSearch}
                  block
                  style={{ 
                    background: filters.map_search ? 'rgba(24, 144, 255, 0.2)' : undefined,
                    borderColor: filters.map_search ? '#1890ff' : undefined,
                    color: filters.map_search ? '#1890ff' : undefined
                  }}
                >
                  {filters.map_search
                    ? t('propertySearch.advancedSearch.radiusKm', { radius: filters.map_search.radius_km })
                    : t('propertySearch.advancedSearch.searchOnMap')}
                </Button>
                {filters.map_search && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => updateFilter('map_search', undefined)}
                    style={{ marginTop: 4, width: '100%' }}
                  >
                    {t('propertySearch.advancedSearch.clearSearchZone')}
                  </Button>
                )}
              </Col>
            </Row>
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.bedroomsAndBathrooms')}</strong>
            </Space>
          } 
          key="rooms"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Row gutter={[16, 8]} align="middle">
                <Col xs={24} sm={8}>
                  <label className="filter-label">{t('propertySearch.advancedSearch.bedrooms')}</label>
                </Col>
                <Col xs={24} sm={16}>
                  <Radio.Group
                    value={bedroomsMode}
                    onChange={(e) => {
                      setBedroomsMode(e.target.value);
                      if (e.target.value === 'exact') {
                        updateFilter('bedrooms_min', undefined);
                        updateFilter('bedrooms_max', undefined);
                      } else {
                        updateFilter('bedrooms', undefined);
                      }
                    }}
                    buttonStyle="solid"
                    className="dark-radio-group"
                  >
                    <Radio.Button value="exact">{t('propertySearch.advancedSearch.exactNumber')}</Radio.Button>
                    <Radio.Button value="range">{t('propertySearch.advancedSearch.range')}</Radio.Button>
                  </Radio.Group>
                </Col>
              </Row>

              {bedroomsMode === 'exact' ? (
                <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                  <Col xs={24}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.bedroomsCount')}
                      min={0}
                      max={20}
                      value={filters.bedrooms}
                      onChange={(value) => updateFilter('bedrooms', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              ) : (
                <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                  <Col xs={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      max={20}
                      value={filters.bedrooms_min}
                      onChange={(value) => updateFilter('bedrooms_min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                      addonBefore={t('propertySearch.advancedSearch.from')}
                    />
                  </Col>
                  <Col xs={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      max={20}
                      value={filters.bedrooms_max}
                      onChange={(value) => updateFilter('bedrooms_max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                      addonBefore={t('propertySearch.advancedSearch.to')}
                    />
                  </Col>
                </Row>
              )}
            </div>

            <Divider style={{ margin: '16px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <div>
              <Row gutter={[16, 8]} align="middle">
                <Col xs={24} sm={8}>
                  <label className="filter-label">{t('propertySearch.advancedSearch.bathrooms')}</label>
                </Col>
                <Col xs={24} sm={16}>
                  <Radio.Group
                    value={bathroomsMode}
                    onChange={(e) => {
                      setBathroomsMode(e.target.value);
                      if (e.target.value === 'exact') {
                        updateFilter('bathrooms_min', undefined);
                        updateFilter('bathrooms_max', undefined);
                      } else {
                        updateFilter('bathrooms', undefined);
                      }
                    }}
                    buttonStyle="solid"
                    className="dark-radio-group"
                  >
                    <Radio.Button value="exact">{t('propertySearch.advancedSearch.exactNumber')}</Radio.Button>
                    <Radio.Button value="range">{t('propertySearch.advancedSearch.range')}</Radio.Button>
                  </Radio.Group>
                </Col>
              </Row>

              {bathroomsMode === 'exact' ? (
                <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                  <Col xs={24}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.bathroomsCount')}
                      min={0}
                      max={20}
                      value={filters.bathrooms}
                      onChange={(value) => updateFilter('bathrooms', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              ) : (
                <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                  <Col xs={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      max={20}
                      value={filters.bathrooms_min}
                      onChange={(value) => updateFilter('bathrooms_min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                      addonBefore={t('propertySearch.advancedSearch.from')}
                    />
                  </Col>
                  <Col xs={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      max={20}
                      value={filters.bathrooms_max}
                      onChange={(value) => updateFilter('bathrooms_max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                      addonBefore={t('propertySearch.advancedSearch.to')}
                    />
                  </Col>
                </Row>
              )}
            </div>
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.budget')}</strong>
              {filters.budget?.max && (
                <Tag color="green" className="header-tag">
                  {Number(filters.budget.max).toLocaleString()} {filters.budget.currency}
                </Tag>
              )}
            </Space>
          } 
          key="budget"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <label className="filter-label">{t('propertySearch.advancedSearch.currency')}</label>
                <Select
                  value={filters.budget?.currency || 'THB'}
                  onChange={(value) => updateNestedFilter('budget', 'currency', value)}
                  style={{ width: '100%' }}
                  className="dark-select"
                  options={[
                    { value: 'THB', label: t('propertySearch.advancedSearch.currencyTHB') },
                    { value: 'USD', label: t('propertySearch.advancedSearch.currencyUSD') },
                    { value: 'RUB', label: t('propertySearch.advancedSearch.currencyRUB') },
                    { value: 'EUR', label: t('propertySearch.advancedSearch.currencyEUR') }
                  ]}
                />
              </Col>

              <Col xs={24} sm={8}>
                <label className="filter-label">{t('propertySearch.advancedSearch.minBudget')}</label>
                <InputNumber
                  placeholder={t('propertySearch.advancedSearch.minimum')}
                  min={0}
                  value={filters.budget?.min}
                  onChange={(value) => updateNestedFilter('budget', 'min', value)}
                  style={{ width: '100%' }}
                  className="dark-input-number"
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Col>

              <Col xs={24} sm={8}>
                <label className="filter-label">{t('propertySearch.advancedSearch.maxBudget')}</label>
                <InputNumber
                  placeholder={t('propertySearch.advancedSearch.maximum')}
                  min={0}
                  value={filters.budget?.max}
                  onChange={(value) => updateNestedFilter('budget', 'max', value)}
                  style={{ width: '100%' }}
                  className="dark-input-number"
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.tolerance')}</label>
                <InputNumber
                  placeholder="0"
                  min={0}
                  max={100}
                  value={filters.budget?.tolerance}
                  onChange={(value) => updateNestedFilter('budget', 'tolerance', value)}
                  style={{ width: '100%' }}
                  className="dark-input-number"
                  formatter={(value) => `${value}%`}
                  parser={(value) => value!.replace('%', '')}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label className="filter-label">&nbsp;</label>
                <div style={{ paddingTop: 4 }}>
                  <Checkbox
                    checked={filters.budget?.search_below_max !== false}
                    onChange={(e) => updateNestedFilter('budget', 'search_below_max', e.target.checked)}
                    className="dark-checkbox"
                  >
                    {t('propertySearch.advancedSearch.searchBelowMax')}
                  </Checkbox>
                </div>
              </Col>
            </Row>
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.datesAndAvailability')}</strong>
            </Space>
          } 
          key="dates"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Radio.Group
              value={dateMode}
              onChange={(e) => {
                const newMode = e.target.value;
                setDateMode(newMode);
                
                if (newMode === 'fixed') {
                  updateFilter('flexible_dates', undefined);
                } else {
                  updateFilter('dates', undefined);
                }
              }}
              buttonStyle="solid"
              className="dark-radio-group"
              style={{ width: '100%' }}
            >
              <Radio.Button value="fixed" style={{ width: '50%', textAlign: 'center' }}>
                {t('propertySearch.advancedSearch.specificDates')}
              </Radio.Button>
              <Radio.Button value="flexible" style={{ width: '50%', textAlign: 'center' }}>
                {t('propertySearch.advancedSearch.flexibleDates')}
              </Radio.Button>
            </Radio.Group>

            {dateMode === 'fixed' ? (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={16}>
                    <label className="filter-label">{t('propertySearch.advancedSearch.rentalPeriod')}</label>
                    <RangePicker
                      value={
                        filters.dates?.check_in && filters.dates?.check_out
                          ? [dayjs(filters.dates.check_in), dayjs(filters.dates.check_out)]
                          : null
                      }
                      onChange={(dates) => {
                        if (dates && dates[0] && dates[1]) {
                          updateFilter('dates', {
                            check_in: dates[0].format('YYYY-MM-DD'),
                            check_out: dates[1].format('YYYY-MM-DD'),
                            tolerance_days: filters.dates?.tolerance_days || undefined
                          });
                        } else {
                          updateFilter('dates', undefined);
                        }
                      }}
                      format="DD.MM.YYYY"
                      style={{ width: '100%' }}
                      className="dark-date-picker"
                      placeholder={[
                        t('propertySearch.advancedSearch.checkInDate'),
                        t('propertySearch.advancedSearch.checkOutDate')
                      ]}
                    />
                  </Col>

                  <Col xs={24} sm={8}>
                    <label className="filter-label">
                      <Tooltip title={t('propertySearch.advancedSearch.toleranceTooltip')}>
                        {t('propertySearch.advancedSearch.toleranceDays')}
                      </Tooltip>
                    </label>
                    <InputNumber
                      placeholder="0"
                      min={0}
                      max={30}
                      value={filters.dates?.tolerance_days}
                      onChange={(value) => {
                        if (filters.dates?.check_in && filters.dates?.check_out) {
                          updateFilter('dates', {
                            ...filters.dates,
                            tolerance_days: value || undefined
                          });
                        }
                      }}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                      disabled={!filters.dates?.check_in}
                    />
                  </Col>
                </Row>

                {filters.dates?.tolerance_days && filters.dates.tolerance_days > 0 && (
                  <div className="info-block">
                    <Tag color="blue">
                      {t('propertySearch.advancedSearch.searchWithinDays', { days: filters.dates.tolerance_days })}
                    </Tag>
                  </div>
                )}
              </>
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <label className="filter-label">
                      <Tooltip title={t('propertySearch.advancedSearch.nightsTooltip')}>
                        {t('propertySearch.advancedSearch.nightsCount')}
                      </Tooltip>
                    </label>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.nightsPlaceholder')}
                      min={1}
                      max={365}
                      value={filters.flexible_dates?.duration}
                      onChange={(value) => {
                        if (value) {
                          updateFilter('flexible_dates', {
                            ...filters.flexible_dates,
                            duration: value
                          });
                        }
                      }}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>

                  <Col xs={24} sm={16}>
                    <label className="filter-label">
                      <Tooltip title={t('propertySearch.advancedSearch.searchWindowTooltip')}>
                        {t('propertySearch.advancedSearch.searchWindow')}
                      </Tooltip>
                    </label>
                    <RangePicker
                      value={
                        filters.flexible_dates?.search_window_start && filters.flexible_dates?.search_window_end
                          ? [
                              dayjs(filters.flexible_dates.search_window_start),
                              dayjs(filters.flexible_dates.search_window_end)
                            ]
                          : null
                      }
                      onChange={(dates) => {
                        if (dates && dates[0] && dates[1]) {
                          updateFilter('flexible_dates', {
                            duration: filters.flexible_dates?.duration || undefined,
                            search_window_start: dates[0].format('YYYY-MM-DD'),
                            search_window_end: dates[1].format('YYYY-MM-DD')
                          });
                        } else {
                          if (filters.flexible_dates?.duration) {
                            updateFilter('flexible_dates', {
                              duration: filters.flexible_dates.duration
                            });
                          } else {
                            updateFilter('flexible_dates', undefined);
                          }
                        }
                      }}
                      format="DD.MM.YYYY"
                      style={{ width: '100%' }}
                      className="dark-date-picker"
                      placeholder={[
                        t('propertySearch.advancedSearch.periodStart'),
                        t('propertySearch.advancedSearch.periodEnd')
                      ]}
                    />
                  </Col>
                </Row>

                {filters.flexible_dates?.duration && 
                 filters.flexible_dates?.search_window_start && 
                 filters.flexible_dates?.search_window_end && (
                  <div className="info-block success">
                    <Tag color="green">
                      {t('propertySearch.advancedSearch.searchingNights', { duration: filters.flexible_dates.duration })}
                    </Tag>
                  </div>
                )}
              </>
            )}
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.features')}</strong>
              <Badge 
                count={
                  (filters.features?.length || 0) + 
                  (filters.must_have_features?.length || 0)
                } 
                showZero={false}
                style={{ backgroundColor: '#52c41a' }}
              />
            </Space>
          } 
          key="features"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              placeholder={t('propertySearch.advancedSearch.searchFeatures')}
              value={featureSearch}
              onChange={(e) => setFeatureSearch(e.target.value)}
              allowClear
              className="dark-input feature-search"
              prefix={<SearchOutlined />}
            />

            <div className="features-legend">
              <Space size="small" wrap>
                <Tag color="red">{t('propertySearch.advancedSearch.mustHave')}</Tag>
                <Tag color="blue">{t('propertySearch.advancedSearch.desired')}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('propertySearch.advancedSearch.clickInstruction')}
                </Text>
              </Space>
            </div>

            <div className="features-category">
              <div className="category-header">
                <strong>{t('propertySearch.advancedSearch.indoorFeatures')}</strong>
                <Badge count={
                  PROPERTY_FEATURES.property.filter(f => 
                    filters.features?.includes(f) || filters.must_have_features?.includes(f)
                  ).length
                } />
              </div>
              <div className="features-grid">
                {filterFeaturesBySearch(PROPERTY_FEATURES.property).map(feature => {
                  const isMustHave = filters.must_have_features?.includes(feature);
                  const isDesired = filters.features?.includes(feature);
                  
                  return (
                    <Tag
                      key={feature}
                      className={`feature-tag ${isMustHave ? 'must-have' : isDesired ? 'desired' : ''}`}
                      onClick={() => {
                        if (isMustHave) {
                          toggleFeature(feature, true);
                        } else if (isDesired) {
                          toggleFeature(feature, false);
                          toggleFeature(feature, true);
                        } else {
                          toggleFeature(feature, false);
                        }
                      }}
                    >
                      {isMustHave && '🚨 '}
                      {isDesired && '✨ '}
                      {t(`properties.features.${feature}`, { defaultValue: feature })}
                    </Tag>
                  );
                })}
              </div>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <div className="features-category">
              <div className="category-header">
                <strong>{t('propertySearch.advancedSearch.outdoorFeatures')}</strong>
                <Badge count={
                  PROPERTY_FEATURES.outdoor.filter(f => 
                    filters.features?.includes(f) || filters.must_have_features?.includes(f)
                  ).length
                } />
              </div>
              <div className="features-grid">
                {filterFeaturesBySearch(PROPERTY_FEATURES.outdoor).map(feature => {
                  const isMustHave = filters.must_have_features?.includes(feature);
                  const isDesired = filters.features?.includes(feature);
                  
                  return (
                    <Tag
                      key={feature}
                      className={`feature-tag ${isMustHave ? 'must-have' : isDesired ? 'desired' : ''}`}
                      onClick={() => {
                        if (isMustHave) {
                          toggleFeature(feature, true);
                        } else if (isDesired) {
                          toggleFeature(feature, false);
                          toggleFeature(feature, true);
                        } else {
                          toggleFeature(feature, false);
                        }
                      }}
                    >
                      {isMustHave && '🚨 '}
                      {isDesired && '✨ '}
                      {t(`properties.features.${feature}`, { defaultValue: feature })}
                    </Tag>
                  );
                })}
              </div>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <div className="features-category">
              <div className="category-header">
                <strong>{t('propertySearch.advancedSearch.views')}</strong>
                <Badge count={
                  PROPERTY_FEATURES.views.filter(f => 
                    filters.features?.includes(f) || filters.must_have_features?.includes(f)
                  ).length
                } />
              </div>
              <div className="features-grid">
                {filterFeaturesBySearch(PROPERTY_FEATURES.views).map(feature => {
                  const isMustHave = filters.must_have_features?.includes(feature);
                  const isDesired = filters.features?.includes(feature);
                  
                  return (
                    <Tag
                      key={feature}
                      className={`feature-tag ${isMustHave ? 'must-have' : isDesired ? 'desired' : ''}`}
                      onClick={() => {
                        if (isMustHave) {
                          toggleFeature(feature, true);
                        } else if (isDesired) {
                          toggleFeature(feature, false);
                          toggleFeature(feature, true);
                        } else {
                          toggleFeature(feature, false);
                        }
                      }}
                    >
                      {isMustHave && '🚨 '}
                      {isDesired && '✨ '}
                      {t(`properties.features.${feature}`, { defaultValue: feature })}
                    </Tag>
                  );
                })}
              </div>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <div className="features-category">
              <div className="category-header">
                <strong>{t('propertySearch.advancedSearch.locationFeatures')}</strong>
                <Badge count={
                  PROPERTY_FEATURES.location.filter(f => 
                    filters.features?.includes(f) || filters.must_have_features?.includes(f)
                  ).length
                } />
              </div>
              <div className="features-grid">
                {filterFeaturesBySearch(PROPERTY_FEATURES.location).map(feature => {
                  const isMustHave = filters.must_have_features?.includes(feature);
                  const isDesired = filters.features?.includes(feature);
                  
                  return (
                    <Tag
                      key={feature}
                      className={`feature-tag ${isMustHave ? 'must-have' : isDesired ? 'desired' : ''}`}
                      onClick={() => {
                        if (isMustHave) {
                          toggleFeature(feature, true);
                        } else if (isDesired) {
                          toggleFeature(feature, false);
                          toggleFeature(feature, true);
                        } else {
                          toggleFeature(feature, false);
                        }
                      }}
                    >
                      {isMustHave && '🚨 '}
                      {isDesired && '✨ '}
                      {t(`properties.features.${feature}`, { defaultValue: feature })}
                    </Tag>
                  );
                })}
              </div>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <div className="features-category">
              <div className="category-header">
                <strong>{t('propertySearch.advancedSearch.rentalServices')}</strong>
                <Badge count={
                  PROPERTY_FEATURES.rental.filter(f => 
                    filters.features?.includes(f) || filters.must_have_features?.includes(f)
                  ).length
                } />
              </div>
              <div className="features-grid">
                {filterFeaturesBySearch(PROPERTY_FEATURES.rental).map(feature => {
                  const isMustHave = filters.must_have_features?.includes(feature);
                  const isDesired = filters.features?.includes(feature);
                  
                  return (
                    <Tag
                      key={feature}
                      className={`feature-tag ${isMustHave ? 'must-have' : isDesired ? 'desired' : ''}`}
                      onClick={() => {
                        if (isMustHave) {
                          toggleFeature(feature, true);
                        } else if (isDesired) {
                          toggleFeature(feature, false);
                          toggleFeature(feature, true);
                        } else {
                          toggleFeature(feature, false);
                        }
                      }}
                    >
                      {isMustHave && '🚨 '}
                      {isDesired && '✨ '}
                      {t(`properties.features.${feature}`, { defaultValue: feature })}
                    </Tag>
                  );
                })}
              </div>
            </div>

            {((filters.features?.length || 0) + (filters.must_have_features?.length || 0)) > 0 && (
              <>
                <Divider style={{ margin: '12px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                <div className="selected-features">
                  <div className="selected-header">
                    <strong>{t('propertySearch.advancedSearch.selectedFeatures')}</strong>
                    <Space size="small">
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => {
                          updateFilter('features', []);
                          updateFilter('must_have_features', []);
                        }}
                        icon={<DeleteOutlined />}
                      >
                        {t('propertySearch.advancedSearch.clearAll')}
                      </Button>
                    </Space>
                  </div>
                  <Space size="small" wrap style={{ marginTop: 8 }}>
                    {filters.must_have_features?.map((feature: string) => (
                      <Tag
                        key={feature}
                        closable
                        onClose={() => toggleFeature(feature, true)}
                        color="red"
                      >
                        🚨 {t(`properties.features.${feature}`, { defaultValue: feature })}
                      </Tag>
                    ))}
                    {filters.features?.map((feature: string) => (
                      <Tag
                        key={feature}
                        closable
                        onClose={() => toggleFeature(feature, false)}
                        color="blue"
                      >
                        ✨ {t(`properties.features.${feature}`, { defaultValue: feature })}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </>
            )}
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.areas')}</strong>
            </Space>
          } 
          key="areas"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.indoorArea')}</label>
                <Row gutter={8}>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      value={filters.indoor_area_min}
                      onChange={(value) => updateFilter('indoor_area_min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      value={filters.indoor_area_max}
                      onChange={(value) => updateFilter('indoor_area_max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              </Col>

              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.outdoorArea')}</label>
                <Row gutter={8}>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      value={filters.outdoor_area_min}
                      onChange={(value) => updateFilter('outdoor_area_min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      value={filters.outdoor_area_max}
                      onChange={(value) => updateFilter('outdoor_area_max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.plotSize')}</label>
                <Row gutter={8}>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      value={filters.plot_size_min}
                      onChange={(value) => updateFilter('plot_size_min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      value={filters.plot_size_max}
                      onChange={(value) => updateFilter('plot_size_max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              </Col>

              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.distanceToBeach')}</label>
                <Select
                  placeholder={t('propertySearch.advancedSearch.anyDistance')}
                  value={filters.distance_to_beach?.max}
                  onChange={(value) => updateNestedFilter('distance_to_beach', 'max', value)}
                  allowClear
                  style={{ width: '100%' }}
                  className="dark-select"
                  options={[
                    { value: 100, label: t('propertySearch.advancedSearch.beach100') },
                    { value: 200, label: t('propertySearch.advancedSearch.beach200') },
                    { value: 500, label: t('propertySearch.advancedSearch.beach500') },
                    { value: 1000, label: t('propertySearch.advancedSearch.beach1000') },
                    { value: 2000, label: t('propertySearch.advancedSearch.beach2000') },
                    { value: 5000, label: t('propertySearch.advancedSearch.beach5000') }
                  ]}
                />
              </Col>
            </Row>
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.floors')}</strong>
            </Space>
          } 
          key="floors"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.floorNumber')}</label>
                <Row gutter={8}>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={0}
                      max={100}
                      value={filters.floor?.min}
                      onChange={(value) => updateNestedFilter('floor', 'min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={0}
                      max={100}
                      value={filters.floor?.max}
                      onChange={(value) => updateNestedFilter('floor', 'max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              </Col>

              <Col xs={24} sm={12}>
                <label className="filter-label">{t('propertySearch.advancedSearch.buildingFloors')}</label>
                <Row gutter={8}>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.from')}
                      min={1}
                      max={100}
                      value={filters.floors?.min}
                      onChange={(value) => updateNestedFilter('floors', 'min', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      placeholder={t('propertySearch.advancedSearch.to')}
                      min={1}
                      max={100}
                      value={filters.floors?.max}
                      onChange={(value) => updateNestedFilter('floors', 'max', value)}
                      style={{ width: '100%' }}
                      className="dark-input-number"
                    />
                  </Col>
                </Row>
              </Col>
            </Row>
          </Space>
        </Panel>

        <Panel 
          header={
            <Space>
              <strong>{t('propertySearch.advancedSearch.constructionYear')}</strong>
            </Space>
          } 
          key="construction"
        >
          <Row gutter={[16, 16]}>
            <Col xs={12}>
              <label className="filter-label">{t('propertySearch.advancedSearch.fromYear')}</label>
              <InputNumber
                placeholder={t('propertySearch.advancedSearch.yearPlaceholder', { year: 2015 })}
                min={1950}
                max={new Date().getFullYear() + 5}
                value={filters.construction_year_min}
                onChange={(value) => updateFilter('construction_year_min', value)}
                style={{ width: '100%' }}
                className="dark-input-number"
              />
            </Col>
            <Col xs={12}>
              <label className="filter-label">{t('propertySearch.advancedSearch.toYear')}</label>
              <InputNumber
                placeholder={t('propertySearch.advancedSearch.yearPlaceholder', { year: 2024 })}
                min={1950}
                max={new Date().getFullYear() + 5}
                value={filters.construction_year_max}
                onChange={(value) => updateFilter('construction_year_max', value)}
                style={{ width: '100%' }}
                className="dark-input-number"
              />
            </Col>
          </Row>
        </Panel>

        {filters.deal_type === 'sale' && (
          <Panel 
            header={
              <Space>
                <strong>{t('propertySearch.advancedSearch.ownershipTypes')}</strong>
              </Space>
            } 
            key="ownership"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <label className="filter-label">{t('properties.buildingOwnership')}</label>
                  <Select
                    placeholder={t('propertySearch.advancedSearch.any')}
                    value={filters.building_ownership}
                    onChange={(value) => updateFilter('building_ownership', value)}
                    allowClear
                    style={{ width: '100%' }}
                    className="dark-select"
                    options={[
                      { value: 'freehold', label: `✅ ${t('properties.ownershipTypes.freehold')}` },
                      { value: 'leasehold', label: `📝 ${t('properties.ownershipTypes.leasehold')}` },
                      { value: 'company', label: `🏢 ${t('properties.ownershipTypes.company')}` }
                    ]}
                  />
                </Col>

                <Col xs={24} sm={8}>
                  <label className="filter-label">{t('properties.landOwnership')}</label>
                  <Select
                    placeholder={t('propertySearch.advancedSearch.any')}
                    value={filters.land_ownership}
                    onChange={(value) => updateFilter('land_ownership', value)}
                    allowClear
                    style={{ width: '100%' }}
                    className="dark-select"
                    options={[
                      { value: 'freehold', label: `✅ ${t('properties.ownershipTypes.freehold')}` },
                      { value: 'leasehold', label: `📝 ${t('properties.ownershipTypes.leasehold')}` },
                      { value: 'company', label: `🏢 ${t('properties.ownershipTypes.company')}` }
                    ]}
                  />
                </Col>

                <Col xs={24} sm={8}>
                  <label className="filter-label">{t('properties.ownership')}</label>
                  <Select
                    placeholder={t('propertySearch.advancedSearch.any')}
                    value={filters.ownership_type}
                    onChange={(value) => updateFilter('ownership_type', value)}
                    allowClear
                    style={{ width: '100%' }}
                    className="dark-select"
                    options={[
                      { value: 'freehold', label: `✅ ${t('properties.ownershipTypes.freehold')}` },
                      { value: 'leasehold', label: `📝 ${t('properties.ownershipTypes.leasehold')}` },
                      { value: 'company', label: `🏢 ${t('properties.ownershipTypes.company')}` }
                    ]}
                  />
                </Col>
              </Row>

              <div className="info-block">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('propertySearch.advancedSearch.ownershipInfo')}
                </Text>
              </div>
            </Space>
          </Panel>
        )}
      </Collapse>

      <Divider style={{ margin: '24px 0', borderColor: 'rgba(255, 255, 255, 0.2)' }} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            size="large"
            block
            className="search-button"
          >
            {t('propertySearch.advancedSearch.searchButton')}
          </Button>
        </Col>
        <Col xs={24} sm={12}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={loading}
            size="large"
            block
            className="reset-button"
          >
            {t('propertySearch.advancedSearch.resetButton')}
          </Button>
        </Col>
      </Row>
    </Card>
  );
};

export default AdvancedSearch;