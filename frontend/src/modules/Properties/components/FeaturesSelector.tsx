// frontend/src/modules/Properties/components/FeaturesSelector.tsx
import { Card, Checkbox, Space, Collapse, Badge } from 'antd';
import { useTranslation } from 'react-i18next';

interface Feature {
  feature_type: string;
  feature_value: string;
  renovation_date?: string | null;
}

interface FeaturesSelectorProps {
  value?: Feature[];
  onChange?: (value: Feature[]) => void;
}

const FeaturesSelector = ({ value = [], onChange }: FeaturesSelectorProps) => {
  const { t } = useTranslation();

  // Все доступные features по категориям
  const featureCategories = {
    property: [
      'mediaRoom', 'privateGym', 'privateLift', 'privateSauna', 'jacuzzi',
      'cornerUnit', 'maidsQuarters', 'duplex', 'balcony', 'westernKitchen',
      'bathtub', 'smartHome', 'privatePool', 'sharedPool', 'securitySystem',
      'airConditioning', 'heating', 'fireplace', 'solarPanels', 'waterHeater'
    ],
    outdoor: [
      'garden', 'terrace', 'rooftop', 'bbqArea', 'outdoorShower',
      'garage', 'coveredParking', 'carport', 'poolBar', 'summerKitchen',
      'outdoorDining', 'playground', 'petArea', 'storageRoom', 'laundryRoom'
    ],
    rental: [
      'maidService', 'chefService', 'airportTransfer', 'carRental',
      'breakfastIncluded', 'cleaning', 'linenChange', 'utilitiesIncluded',
      'wifiIncluded', 'cableTv', 'conciergeService', 'securityGuard', 'management'
    ],
    location: [
      'beachAccess', 'beachFront', 'nearSchool', 'nearHospital',
      'nearSupermarket', 'nearRestaurant', 'nearGolfCourse', 'nearMarina',
      'nearAirport', 'nearBusStop', 'quietArea', 'gatedCommunity', 'cityCentre'
    ],
    view: [
      'seaView', 'mountainView', 'poolView', 'gardenView',
      'cityView', 'panoramicView', 'partialSeaView', 'lakeView', 'forestView'
    ]
  };

  const isChecked = (type: string, featureValue: string) => {
    return value.some(f => f.feature_type === type && f.feature_value === featureValue);
  };

  const handleToggle = (type: string, featureValue: string, checked: boolean) => {
    let updated: Feature[];
    
    if (checked) {
      // Добавляем feature
      updated = [...value, { feature_type: type, feature_value: featureValue }];
    } else {
      // Удаляем feature
      updated = value.filter(f => !(f.feature_type === type && f.feature_value === featureValue));
    }
    
    onChange?.(updated);
  };

  const getSelectedCount = (type: string) => {
    return value.filter(f => f.feature_type === type).length;
  };

  const collapseItems = [
    {
      key: 'property',
      label: (
        <Space>
          <span>{t('properties.features.propertyFeatures')}</span>
          <Badge count={getSelectedCount('property')} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {featureCategories.property.map(feature => (
            <Checkbox
              key={feature}
              checked={isChecked('property', feature)}
              onChange={(e) => handleToggle('property', feature, e.target.checked)}
            >
              {t(`properties.features.${feature}`)}
            </Checkbox>
          ))}
        </Space>
      )
    },
    {
      key: 'outdoor',
      label: (
        <Space>
          <span>{t('properties.features.outdoorFeatures')}</span>
          <Badge count={getSelectedCount('outdoor')} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {featureCategories.outdoor.map(feature => (
            <Checkbox
              key={feature}
              checked={isChecked('outdoor', feature)}
              onChange={(e) => handleToggle('outdoor', feature, e.target.checked)}
            >
              {t(`properties.features.${feature}`)}
            </Checkbox>
          ))}
        </Space>
      )
    },
    {
      key: 'rental',
      label: (
        <Space>
          <span>{t('properties.features.rentalFeatures')}</span>
          <Badge count={getSelectedCount('rental')} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {featureCategories.rental.map(feature => (
            <Checkbox
              key={feature}
              checked={isChecked('rental', feature)}
              onChange={(e) => handleToggle('rental', feature, e.target.checked)}
            >
              {t(`properties.features.${feature}`)}
            </Checkbox>
          ))}
        </Space>
      )
    },
    {
      key: 'location',
      label: (
        <Space>
          <span>{t('properties.features.locationFeatures')}</span>
          <Badge count={getSelectedCount('location')} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {featureCategories.location.map(feature => (
            <Checkbox
              key={feature}
              checked={isChecked('location', feature)}
              onChange={(e) => handleToggle('location', feature, e.target.checked)}
            >
              {t(`properties.features.${feature}`)}
            </Checkbox>
          ))}
        </Space>
      )
    },
    {
      key: 'view',
      label: (
        <Space>
          <span>{t('properties.features.views')}</span>
          <Badge count={getSelectedCount('view')} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {featureCategories.view.map(feature => (
            <Checkbox
              key={feature}
              checked={isChecked('view', feature)}
              onChange={(e) => handleToggle('view', feature, e.target.checked)}
            >
              {t(`properties.features.${feature}`)}
            </Checkbox>
          ))}
        </Space>
      )
    }
  ];

  return (
    <Card 
      title={t('properties.features.title')}
      extra={<Badge count={value.length} showZero />}
    >
      <Collapse items={collapseItems} defaultActiveKey={['property']} />
    </Card>
  );
};

export default FeaturesSelector;