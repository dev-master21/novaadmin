// frontend/src/modules/Properties/components/MapSearchModal.tsx
import { useState, useEffect } from 'react';
import { Modal, Button, Slider, InputNumber, Row, Col, message } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (data: { lat: number; lng: number; radius_km: number }) => void;
  initialData?: {
    lat: number;
    lng: number;
    radius_km: number;
  };
}

const MapSearchModal = ({ visible, onClose, onApply, initialData }: Props) => {
  const { t } = useTranslation();
  
  const [center, setCenter] = useState({
    lat: initialData?.lat || 7.8804,
    lng: initialData?.lng || 98.3923
  });
  const [radiusKm, setRadiusKm] = useState(initialData?.radius_km || 5);
  const [markerPosition, setMarkerPosition] = useState(center);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  useEffect(() => {
    if (initialData) {
      setCenter({ lat: initialData.lat, lng: initialData.lng });
      setMarkerPosition({ lat: initialData.lat, lng: initialData.lng });
      setRadiusKm(initialData.radius_km);
    }
  }, [initialData]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
    }
  };

  const handleApply = () => {
    if (!markerPosition) {
      message.warning(t('mapSearchModal.selectPointOnMap'));
      return;
    }

    onApply({
      lat: markerPosition.lat,
      lng: markerPosition.lng,
      radius_km: radiusKm
    });
  };

  return (
    <Modal
      title={
        <span>
          <EnvironmentOutlined /> {t('mapSearchModal.title')}
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel')}
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply}>
          {t('mapSearchModal.apply')}
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <p>{t('mapSearchModal.description')}</p>
        <Row gutter={16} align="middle">
          <Col span={16}>
            <Slider
              min={1}
              max={50}
              value={radiusKm}
              onChange={setRadiusKm}
              marks={{
                1: t('mapSearchModal.kmMark', { value: 1 }),
                10: t('mapSearchModal.kmMark', { value: 10 }),
                25: t('mapSearchModal.kmMark', { value: 25 }),
                50: t('mapSearchModal.kmMark', { value: 50 })
              }}
            />
          </Col>
          <Col span={8}>
            <InputNumber
              min={1}
              max={50}
              value={radiusKm}
              onChange={(value) => setRadiusKm(value || 1)}
              suffix={t('mapSearchModal.km')}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </div>

      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{
            width: '100%',
            height: '400px',
            borderRadius: '8px'
          }}
          center={center}
          zoom={11}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false
          }}
        >
          {markerPosition && (
            <>
              <Marker position={markerPosition} />
              <Circle
                center={markerPosition}
                radius={radiusKm * 1000}
                options={{
                  strokeColor: '#1890ff',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  fillColor: '#1890ff',
                  fillOpacity: 0.15
                }}
              />
            </>
          )}
        </GoogleMap>
      ) : (
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('mapSearchModal.loadingMap')}
        </div>
      )}
    </Modal>
  );
};

export default MapSearchModal;