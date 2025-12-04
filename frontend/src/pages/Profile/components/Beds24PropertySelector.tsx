// frontend/src/pages/Profile/components/Beds24PropertySelector.tsx
import React, { useState } from 'react';
import {
  Card,
  Select,
  Button,
  Grid,
  Image,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Divider,
  Center,
  ActionIcon,
  Tooltip,
  useMantineTheme
} from '@mantine/core';
import {
  IconLink,
  IconLinkOff,
  IconCheck,
  IconAlertCircle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { Beds24Property, MyProperty } from '../../../api/integrations.api';

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
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
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
      notifications.show({
        title: t('common.warning'),
        message: t('integrations.beds24.selectAllFields'),
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    try {
      setLinking(true);
      await onLink(selectedMyProperty, selectedBeds24Prop, selectedBeds24Room);
      
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

  const syncedProperties = myProperties.filter(p => p.is_synced);
  const unsyncedProperties = myProperties.filter(p => !p.is_synced);

  return (
    <Stack gap="xl">
      {syncedProperties.length > 0 && (
        <>
          <div>
            <Title order={5}>{t('integrations.beds24.linkedProperties')}</Title>
          </div>
          
          <Stack gap="md">
            {syncedProperties.map((property) => {
              const beds24Prop = beds24Properties.find(p => p.propId === property.beds24_prop_id);
              const beds24Room = beds24Prop?.rooms.find(r => r.roomId === property.beds24_room_id);

              return (
                <Card
                  key={property.id}
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = theme.shadows.md;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = theme.shadows.sm;
                  }}
                >
                  <Grid gutter="md" align="center">
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      {property.cover_photo ? (
                        <Image
                          src={property.cover_photo}
                          alt={property.property_name || property.property_number}
                          height={80}
                          radius="md"
                          fit="cover"
                        />
                      ) : (
                        <Center
                          h={80}
                          style={{
                            background: theme.colors.dark[6],
                            borderRadius: theme.radius.md
                          }}
                        >
                          <Text size="xs" c="dimmed">
                            {t('common.noPhoto')}
                          </Text>
                        </Center>
                      )}
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                      <Stack gap={4}>
                        <Text fw={600} lineClamp={1}>
                          {property.property_name || property.property_number}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {property.property_number} • {property.region}
                        </Text>
                        <Group gap={4}>
                          <Badge size="sm" variant="light" color="blue">
                            {property.property_type}
                          </Badge>
                          <Badge size="sm" variant="outline">
                            {Math.round(property.bedrooms || 0)} BD
                          </Badge>
                          <Badge size="sm" variant="outline">
                            {Math.round(property.bathrooms || 0)} BA
                          </Badge>
                        </Group>
                      </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 12, md: 1 }}>
                      <Center>
                        <IconLink size={24} color={theme.colors.green[6]} />
                      </Center>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 10, md: 3 }}>
                      <Stack gap={4}>
                        <Text fw={600} lineClamp={1}>
                          {beds24Prop?.propName || `PropID: ${property.beds24_prop_id}`}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {beds24Room?.roomName || `RoomID: ${property.beds24_room_id}`}
                        </Text>
                        <Badge 
                          color="green" 
                          variant="light"
                          leftSection={<IconCheck size={12} />}
                        >
                          {t('integrations.beds24.synced')}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          PropID: {property.beds24_prop_id || 'N/A'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          RoomID: {property.beds24_room_id || 'N/A'}
                        </Text>
                      </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 2, md: 1 }}>
                      <Tooltip label={t('common.unlink')}>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="lg"
                          loading={unlinking === property.id}
                          onClick={() => handleUnlink(property.id)}
                        >
                          <IconLinkOff size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Grid.Col>
                  </Grid>
                </Card>
              );
            })}
          </Stack>
        </>
      )}

      {unsyncedProperties.length > 0 && (
        <>
          {syncedProperties.length > 0 && <Divider my="xl" />}
          
          <div>
            <Title order={5}>{t('integrations.beds24.linkNewProperty')}</Title>
          </div>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="lg">
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Stack gap="sm">
                    <Text fw={600} size="sm">
                      {t('integrations.beds24.selectYourProperty')}
                    </Text>
                    <Select
                      placeholder={t('integrations.beds24.selectProperty')}
                      value={selectedMyProperty?.toString()}
                      onChange={(value) => {
                        setSelectedMyProperty(value ? parseInt(value) : null);
                        setSelectedBeds24Prop(null);
                        setSelectedBeds24Room(null);
                      }}
                      searchable
                      clearable
                      data={unsyncedProperties.map((property) => ({
                        value: property.id.toString(),
                        label: property.property_name || property.property_number
                      }))}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />

                    {selectedMyPropertyData && (
                      <Card shadow="xs" padding="sm" radius="md" withBorder>
                        {selectedMyPropertyData.cover_photo && (
                          <Image
                            src={selectedMyPropertyData.cover_photo}
                            alt={selectedMyPropertyData.property_name || selectedMyPropertyData.property_number}
                            radius="md"
                            mb="xs"
                            height={120}
                            fit="cover"
                          />
                        )}
                        <Stack gap={4}>
                          <Text size="xs" fw={600} lineClamp={1}>
                            {selectedMyPropertyData.property_name || selectedMyPropertyData.property_number}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {selectedMyPropertyData.property_number}
                          </Text>
                          <Group gap={4} mt={4}>
                            <Badge size="xs" variant="light">
                              {selectedMyPropertyData.property_type}
                            </Badge>
                            <Badge size="xs" variant="outline">
                              {Math.round(selectedMyPropertyData.bedrooms || 0)} BD
                            </Badge>
                            <Badge size="xs" variant="outline">
                              {Math.round(selectedMyPropertyData.bathrooms || 0)} BA
                            </Badge>
                          </Group>
                        </Stack>
                      </Card>
                    )}
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Stack gap="sm">
                    <Text fw={600} size="sm">
                      {t('integrations.beds24.selectBeds24Property')}
                    </Text>
                    <Select
                      placeholder={t('integrations.beds24.selectProperty')}
                      value={selectedBeds24Prop?.toString()}
                      onChange={(value) => {
                        setSelectedBeds24Prop(value ? parseInt(value) : null);
                        setSelectedBeds24Room(null);
                      }}
                      searchable
                      clearable
                      disabled={!selectedMyProperty}
                      data={beds24Properties.map((property) => ({
                        value: property.propId.toString(),
                        label: property.propName
                      }))}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />

                    {selectedBeds24PropData && (
                      <Card shadow="xs" padding="sm" radius="md" withBorder>
                        <Stack gap={4}>
                          <Text size="xs" fw={600} lineClamp={1}>
                            {selectedBeds24PropData.propName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            PropID: {selectedBeds24PropData.propId}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {selectedBeds24PropData.rooms?.length || 0} {t('integrations.beds24.rooms')}
                          </Text>
                        </Stack>
                      </Card>
                    )}
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Stack gap="sm">
                    <Text fw={600} size="sm">
                      {t('integrations.beds24.selectBeds24Room')}
                    </Text>
                    <Select
                      placeholder={t('integrations.beds24.selectRoom')}
                      value={selectedBeds24Room?.toString()}
                      onChange={(value) => setSelectedBeds24Room(value ? parseInt(value) : null)}
                      searchable
                      clearable
                      disabled={!selectedBeds24Prop}
                      data={selectedBeds24PropData?.rooms.map((room) => ({
                        value: room.roomId.toString(),
                        label: room.roomName
                      })) || []}
                      styles={{
                        input: { fontSize: '16px' }
                      }}
                    />

                    {selectedBeds24RoomData && (
                      <Card shadow="xs" padding="sm" radius="md" withBorder>
                        <Stack gap={4}>
                          <Text size="xs" fw={600} lineClamp={1}>
                            {selectedBeds24RoomData.roomName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            RoomID: {selectedBeds24RoomData.roomId}
                          </Text>
                        </Stack>
                      </Card>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>

              <Button
                leftSection={<IconLink size={18} />}
                onClick={handleLink}
                loading={linking}
                disabled={!selectedMyProperty || !selectedBeds24Prop || !selectedBeds24Room}
                size={isMobile ? 'md' : 'lg'}
                fullWidth
              >
                {t('integrations.beds24.linkButton')}
              </Button>
            </Stack>
          </Card>
        </>
      )}

      {unsyncedProperties.length === 0 && syncedProperties.length === 0 && (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Center>
            <Stack align="center" gap="md">
              <IconAlertCircle size={48} color={theme.colors.gray[5]} />
              <Text size="lg" c="dimmed">
                {t('integrations.beds24.noProperties')}
              </Text>
            </Stack>
          </Center>
        </Card>
      )}
    </Stack>
  );
};

export default Beds24PropertySelector;