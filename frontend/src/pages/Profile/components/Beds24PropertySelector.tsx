// frontend/src/pages/Profile/components/Beds24PropertySelector.tsx
import React, { useState } from 'react';
import {
  Card,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Image,
  Divider,
  Empty,
  message,
} from 'antd';
import {
  LinkOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Beds24Property, MyProperty } from '../../../api/integrations.api';

const { Text, Title } = Typography;
const { Option } = Select;

interface Props {
  beds24Properties: Beds24Property[];
  myProperties: MyProperty[];
  onLink: (propertyId: number, beds24PropId: number, beds24RoomId: number) => Promise<void>;
  onUnlink: (propertyId: number) => Promise<void>;
}

const Beds24PropertySelector: React.FC<Props> = ({
  beds24Properties,
  myProperties,
  onLink,
  onUnlink,
}) => {
  const { t } = useTranslation();
  
  const [selectedMyProperty, setSelectedMyProperty] = useState<number | null>(null);
  const [selectedBeds24Prop, setSelectedBeds24Prop] = useState<number | null>(null);
  const [selectedBeds24Room, setSelectedBeds24Room] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<number | null>(null);

  const selectedMyPropertyData = myProperties.find(p => p.id === selectedMyProperty);
  const selectedBeds24PropData = beds24Properties.find(p => p.propId === selectedBeds24Prop);
  const selectedBeds24RoomData = selectedBeds24PropData?.rooms.find(r => r.roomId === selectedBeds24Room);

  const handleLink = async () => {
    if (!selectedMyProperty || !selectedBeds24Prop || !selectedBeds24Room) {
      message.warning(t('integrations.beds24.selectAllFields'));
      return;
    }

    try {
      setLinking(true);
      await onLink(selectedMyProperty, selectedBeds24Prop, selectedBeds24Room);
      
      // Сбрасываем выбор
      setSelectedMyProperty(null);
      setSelectedBeds24Prop(null);
      setSelectedBeds24Room(null);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (propertyId: number) => {
    try {
      setUnlinking(propertyId);
      await onUnlink(propertyId);
    } finally {
      setUnlinking(null);
    }
  };

  // Разделяем объекты на привязанные и не привязанные
  const syncedProperties = myProperties.filter(p => p.is_synced);
  const unsyncedProperties = myProperties.filter(p => !p.is_synced);

  return (
    <div className="beds24-property-selector">
      {/* Список уже привязанных объектов */}
      {syncedProperties.length > 0 && (
        <>
          <Title level={5}>{t('integrations.beds24.linkedProperties')}</Title>
          
          <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
            {syncedProperties.map((property) => {
              const beds24Prop = beds24Properties.find(p => p.propId === property.beds24_prop_id);
              const beds24Room = beds24Prop?.rooms.find(r => r.roomId === property.beds24_room_id);

              return (
                <Card
                  key={property.id}
                  size="small"
                  className="linked-property-card"
                >
                  <Row gutter={[16, 16]} align="middle">
                    {/* Фото объекта */}
                    <Col xs={24} sm={6} md={4}>
                      {property.cover_photo ? (
                        <Image
                          src={property.cover_photo}
                          alt={property.property_name || property.property_number}
                          style={{
                            width: '100%',
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 8,
                          }}
                          preview={false}
                          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E"
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 80,
                            background: '#f0f0f0',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text type="secondary">{t('common.noPhoto')}</Text>
                        </div>
                      )}
                    </Col>

                    {/* Информация о нашем объекте */}
                    <Col xs={24} sm={9} md={10}>
                      <Space direction="vertical" size={0}>
                        <Text strong>{property.property_name || property.property_number}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {property.property_number} • {property.region}
                        </Text>
                        <Space size={4}>
                          <Tag color="blue">{property.property_type}</Tag>
                          {/* ✅ ИСПРАВЛЕНО: Форматируем без десятичных знаков */}
                          <Tag>{Math.round(property.bedrooms || 0)} BD</Tag>
                          <Tag>{Math.round(property.bathrooms || 0)} BA</Tag>
                        </Space>
                      </Space>
                    </Col>

                    {/* Связь */}
                    <Col xs={24} sm={1} md={1} style={{ textAlign: 'center' }}>
                      <LinkOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    </Col>

                    {/* Информация о Beds24 */}
                    <Col xs={24} sm={7} md={8}>
                      <Space direction="vertical" size={0}>
                        {/* ✅ ИСПРАВЛЕНО: Показываем названия вместо N/A */}
                        <Text strong>{beds24Prop?.propName || `PropID: ${property.beds24_prop_id}`}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {beds24Room?.roomName || `RoomID: ${property.beds24_room_id}`}
                        </Text>
                        <Space size={4}>
                          <Tag color="green" icon={<CheckCircleOutlined />}>
                            {t('integrations.beds24.synced')}
                          </Tag>
                        </Space>
                        {/* ✅ ДОБАВЛЕНО: Показываем PropId и RoomId */}
                        <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>
                          <div>PropID: {property.beds24_prop_id || 'N/A'}</div>
                          <div>RoomID: {property.beds24_room_id || 'N/A'}</div>
                        </div>
                      </Space>
                    </Col>

                    {/* Кнопка отвязки */}
                    <Col xs={24} sm={1} md={1}>
                      <Button
                        danger
                        size="small"
                        icon={<DisconnectOutlined />}
                        loading={unlinking === property.id}
                        onClick={() => handleUnlink(property.id)}
                      >
                        {t('common.unlink')}
                      </Button>
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </Space>
        </>
      )}

      {/* Форма для новой привязки */}
      {unsyncedProperties.length > 0 && (
        <>
          <Divider />
          
          <Title level={5}>{t('integrations.beds24.linkNewProperty')}</Title>

          <Card className="link-form-card">
            <Row gutter={[16, 16]}>
              {/* Выбор своего объекта */}
              <Col xs={24} md={8}>
                <div className="select-column">
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{t('integrations.beds24.selectYourProperty')}</Text>
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('integrations.beds24.selectProperty')}
                    value={selectedMyProperty}
                    onChange={(value) => {
                      setSelectedMyProperty(value);
                      setSelectedBeds24Prop(null);
                      setSelectedBeds24Room(null);
                    }}
                    showSearch
                    optionFilterProp="children"
                    size="large"
                  >
                    {unsyncedProperties.map((property) => (
                      <Option key={property.id} value={property.id}>
                        <Space direction="vertical" size={0}>
                          <Text>{property.property_name || property.property_number}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {property.property_number} • {Math.round(property.bedrooms || 0)} BD • {Math.round(property.bathrooms || 0)} BA
                          </Text>
                        </Space>
                      </Option>
                    ))}
                  </Select>

                  {/* Превью выбранного объекта */}
                  {selectedMyPropertyData && (
                    <Card size="small" className="preview-card" style={{ marginTop: 16 }}>
                      {selectedMyPropertyData.cover_photo && (
                        <Image
                          src={selectedMyPropertyData.cover_photo}
                          alt={selectedMyPropertyData.property_name || selectedMyPropertyData.property_number}
                          style={{ width: '100%', borderRadius: 8, marginBottom: 8 }}
                          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E"
                        />
                      )}
                      <Text strong style={{ fontSize: 12 }}>
                        {selectedMyPropertyData.property_name || selectedMyPropertyData.property_number}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {selectedMyPropertyData.property_number}
                      </Text>
                      <br />
                      <Space size={4} style={{ marginTop: 8 }}>
                        <Tag style={{ fontSize: 11 }}>{selectedMyPropertyData.property_type}</Tag>
                        <Tag style={{ fontSize: 11 }}>{Math.round(selectedMyPropertyData.bedrooms || 0)} BD</Tag>
                        <Tag style={{ fontSize: 11 }}>{Math.round(selectedMyPropertyData.bathrooms || 0)} BA</Tag>
                      </Space>
                    </Card>
                  )}
                </div>
              </Col>

              {/* Выбор объекта Beds24 */}
              <Col xs={24} md={8}>
                <div className="select-column">
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{t('integrations.beds24.selectBeds24Property')}</Text>
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('integrations.beds24.selectProperty')}
                    value={selectedBeds24Prop}
                    onChange={(value) => {
                      setSelectedBeds24Prop(value);
                      setSelectedBeds24Room(null);
                    }}
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    disabled={!selectedMyProperty}
                  >
                    {beds24Properties.map((property) => (
                      <Option key={property.propId} value={property.propId}>
                        {/* ✅ ИСПРАВЛЕНО: Показываем название */}
                        <Space direction="vertical" size={0}>
                          <Text>{property.propName}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ID: {property.propId}
                          </Text>
                        </Space>
                      </Option>
                    ))}
                  </Select>

                  {selectedBeds24PropData && (
                    <Card size="small" className="preview-card" style={{ marginTop: 16 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        {selectedBeds24PropData.propName}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        PropID: {selectedBeds24PropData.propId}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {selectedBeds24PropData.rooms?.length || 0} {t('integrations.beds24.rooms')}
                      </Text>
                    </Card>
                  )}
                </div>
              </Col>

              {/* Выбор комнаты Beds24 */}
              <Col xs={24} md={8}>
                <div className="select-column">
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{t('integrations.beds24.selectBeds24Room')}</Text>
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('integrations.beds24.selectRoom')}
                    value={selectedBeds24Room}
                    onChange={setSelectedBeds24Room}
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    disabled={!selectedBeds24Prop}
                  >
                    {selectedBeds24PropData?.rooms.map((room) => (
                      <Option key={room.roomId} value={room.roomId}>
                        {/* ✅ ИСПРАВЛЕНО: Показываем название комнаты */}
                        <Space direction="vertical" size={0}>
                          <Text>{room.roomName}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ID: {room.roomId}
                          </Text>
                        </Space>
                      </Option>
                    ))}
                  </Select>

                  {selectedBeds24RoomData && (
                    <Card size="small" className="preview-card" style={{ marginTop: 16 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        {selectedBeds24RoomData.roomName}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        RoomID: {selectedBeds24RoomData.roomId}
                      </Text>
                    </Card>
                  )}
                </div>
              </Col>

              {/* Кнопка привязки */}
              <Col xs={24}>
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={handleLink}
                  loading={linking}
                  disabled={!selectedMyProperty || !selectedBeds24Prop || !selectedBeds24Room}
                  block
                >
                  {t('integrations.beds24.linkButton')}
                </Button>
              </Col>
            </Row>
          </Card>
        </>
      )}

      {unsyncedProperties.length === 0 && syncedProperties.length === 0 && (
        <Empty description={t('integrations.beds24.noProperties')} />
      )}
    </div>
  );
};

export default Beds24PropertySelector;