// frontend/src/modules/Properties/components/SeasonalPricing.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Button,
  NumberInput,
  Alert,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Grid,
  Paper,
  Divider,
  Timeline,
  SegmentedControl,
  Center,
  Select,
  Box,
  Transition
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconInfoCircle,
  IconCalendar,
  IconCurrencyBaht,
  IconSnowflake,
  IconSun,
  IconFlame,
  IconSparkles,
  IconGift,
  IconCheck,
  IconX,
  IconBeach,
  IconEye,
  IconArrowRight
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { propertyOwnersApi } from '@/api/propertyOwners.api';
import { propertiesApi } from '@/api/properties.api';

interface PricingPeriod {
  id?: number;
  season_type: string | null;
  start_date_recurring: string;
  end_date_recurring: string;
  price_per_night: number;
  source_price_per_night?: number | null;
  minimum_nights: number | null;
  pricing_type?: 'per_night' | 'per_period';
  pricing_mode?: 'net' | 'gross';
  commission_type?: 'percentage' | 'fixed' | null;
  commission_value?: number | null;
  margin_amount?: number | null;
  margin_percentage?: number | null;
}

interface SeasonalPricingProps {
  viewMode?: boolean;
  form?: any;
  propertyId?: number;
  isOwnerMode?: boolean;
  autoSave?: boolean;
}

interface EditFormState {
  season_type: string | null;
  startDate: Date | null;
  endDate: Date | null;
  price_per_night: number | string;
  minimum_nights: number | string;
  pricing_type: 'per_night' | 'per_period';
  pricing_mode: 'net' | 'gross' | null;
  commission_type: 'percentage' | 'fixed' | 'none' | null;
  commission_value: number | string;
}

const initialFormState: EditFormState = {
  season_type: null,
  startDate: null,
  endDate: null,
  price_per_night: '',
  minimum_nights: 1,
  pricing_type: 'per_night',
  pricing_mode: null,
  commission_type: null,
  commission_value: ''
};

const SeasonalPricing = ({ 
  viewMode = false, 
  form: parentForm,
  propertyId,
  isOwnerMode = false,
  autoSave = false
}: SeasonalPricingProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingPeriodId, setDeletingPeriodId] = useState<number | null>(null);
  const [periods, setPeriods] = useState<PricingPeriod[]>([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod | null>(null);
  const [formState, setFormState] = useState<EditFormState>(initialFormState);
  const [viewMode_internal, setViewMode_internal] = useState<'list' | 'timeline'>('list');
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parentForm && parentForm.values.seasonalPricing) {
      setPeriods(parentForm.values.seasonalPricing);
    }
  }, [parentForm]);

  const seasonTypes = [
    { 
      value: 'low', 
      label: t('properties.pricing.seasonTypes.low'),
      color: 'teal',
      icon: IconBeach,
      description: t('seasonalPricing.seasonDescriptions.low')
    },
    { 
      value: 'mid', 
      label: t('properties.pricing.seasonTypes.mid'),
      color: 'blue',
      icon: IconSun,
      description: t('seasonalPricing.seasonDescriptions.mid')
    },
    { 
      value: 'high', 
      label: t('properties.pricing.seasonTypes.high'),
      color: 'orange',
      icon: IconFlame,
      description: t('seasonalPricing.seasonDescriptions.high')
    },
    { 
      value: 'peak', 
      label: t('properties.pricing.seasonTypes.peak'),
      color: 'red',
      icon: IconSparkles,
      description: t('seasonalPricing.seasonDescriptions.peak')
    },
    { 
      value: 'prime', 
      label: t('properties.pricing.seasonTypes.prime'),
      color: 'violet',
      icon: IconSnowflake,
      description: t('seasonalPricing.seasonDescriptions.prime')
    },
    { 
      value: 'holiday', 
      label: t('properties.pricing.seasonTypes.holiday'),
      color: 'pink',
      icon: IconGift,
      description: t('seasonalPricing.seasonDescriptions.holiday')
    },
    { 
      value: null, 
      label: t('properties.pricing.seasonTypes.custom'),
      color: 'gray',
      icon: IconCalendar,
      description: t('seasonalPricing.seasonDescriptions.custom')
    }
  ];

  const getSeasonConfig = (type: string | null) => {
    return seasonTypes.find(s => s.value === type) || seasonTypes[seasonTypes.length - 1];
  };

  const calculateMarginData = (
    mode: 'net' | 'gross',
    price: number,
    commissionType: 'percentage' | 'fixed' | null,
    commissionValue: number | null
  ) => {
    if (!commissionType || !commissionValue || commissionValue <= 0) {
      return {
        finalPrice: Math.round(price),
        sourcePrice: Math.round(price),
        marginAmount: 0,
        marginPercentage: 0
      };
    }

    if (mode === 'net') {
      const sourcePrice = price;
      let marginAmount = 0;

      if (commissionType === 'percentage') {
        marginAmount = sourcePrice * (commissionValue / 100);
      } else {
        marginAmount = commissionValue;
      }

      const finalPrice = sourcePrice + marginAmount;
      const marginPercentage = (marginAmount / sourcePrice) * 100;

      return {
        finalPrice: Math.round(finalPrice),
        sourcePrice: Math.round(sourcePrice),
        marginAmount: Math.round(marginAmount),
        marginPercentage: Math.round(marginPercentage * 100) / 100
      };
    } else {
      const finalPrice = price;
      let marginAmount = 0;

      if (commissionType === 'percentage') {
        marginAmount = finalPrice * (commissionValue / 100);
      } else {
        marginAmount = commissionValue;
      }

      const sourcePrice = finalPrice - marginAmount;
      const marginPercentage = (marginAmount / finalPrice) * 100;

      return {
        finalPrice: Math.round(finalPrice),
        sourcePrice: Math.round(sourcePrice),
        marginAmount: Math.round(marginAmount),
        marginPercentage: Math.round(marginPercentage * 100) / 100
      };
    }
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Автоматическое сохранение через API
  const saveToBackend = async (updatedPeriods: PricingPeriod[]) => {
    if (!propertyId || !autoSave) return;

    try {
      setSaving(true);

      // Подготавливаем данные для отправки (удаляем временные id)
      const seasonalPricingData = updatedPeriods.map(period => ({
        season_type: period.season_type,
        start_date_recurring: period.start_date_recurring,
        end_date_recurring: period.end_date_recurring,
        price_per_night: period.price_per_night,
        source_price_per_night: period.source_price_per_night,
        source_price: period.source_price_per_night, // ✅ Добавляем для backend
        minimum_nights: period.minimum_nights,
        pricing_type: period.pricing_type || 'per_night',
        pricing_mode: period.pricing_mode || 'net',
        commission_type: period.commission_type,
        commission_value: period.commission_value,
        margin_amount: period.margin_amount,
        margin_percentage: period.margin_percentage
      }));

      console.log('=== SAVING SEASONAL PRICING ===');
      console.log('propertyId:', propertyId);
      console.log('isOwnerMode:', isOwnerMode);
      console.log('seasonalPricing:', JSON.stringify(seasonalPricingData, null, 2));

      if (isOwnerMode) {
        // Owner Portal - используем owner API
        await propertyOwnersApi.updatePropertyPricing(propertyId, {
          seasonalPricing: seasonalPricingData
        });
      } else {
        // Admin Panel - используем admin API
        await propertiesApi.update(propertyId, {
          seasonalPricing: seasonalPricingData
        });
      }

      console.log('✅ Seasonal pricing saved successfully');
    } catch (error: any) {
      console.error('❌ Save seasonal pricing error:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('seasonalPricing.errorSaving'),
        color: 'red',
        icon: <IconX size={16} />
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleStepChange = (newStep: number) => {
    setTimeout(() => {
      setActiveStep(newStep);
    }, 400);
  };

  const handleSeasonSelect = (seasonValue: string | null) => {
    setFormState(prev => ({ ...prev, season_type: seasonValue }));
    handleStepChange(1);
  };

  const handleAdd = () => {
    setEditingId(null);
    setActiveStep(0);
    
    if (periods.length > 0) {
      const lastPeriod = periods[periods.length - 1];
      const lastEndDate = dayjs(lastPeriod.end_date_recurring, 'DD-MM').toDate();
      const nextStartDate = dayjs(lastEndDate).add(1, 'day').toDate();
      
      setFormState({
        ...initialFormState,
        startDate: nextStartDate,
        endDate: null
      });
    } else {
      setFormState(initialFormState);
    }
    
    setModalOpened(true);
  };

  const handleEdit = (period: PricingPeriod) => {
    setEditingId(period.id || null);
    setActiveStep(3);
    
    setFormState({
      season_type: period.season_type,
      startDate: dayjs(period.start_date_recurring, 'DD-MM').toDate(),
      endDate: dayjs(period.end_date_recurring, 'DD-MM').toDate(),
      price_per_night: period.source_price_per_night || period.price_per_night,
      minimum_nights: period.minimum_nights || 1,
      pricing_type: period.pricing_type || 'per_night',
      pricing_mode: period.pricing_mode || 'net',
      commission_type: period.commission_type || null,
      commission_value: period.commission_value || ''
    });
    
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!formState.startDate || !formState.endDate) {
      notifications.show({
        title: t('validation.error'),
        message: t('validation.datesRequired'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    if (!formState.price_per_night || Number(formState.price_per_night) <= 0) {
      notifications.show({
        title: t('validation.error'),
        message: t('validation.priceRequired'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    if (!formState.commission_type) {
      notifications.show({
        title: t('validation.error'),
        message: t('seasonalPricing.commissionTypeRequired'),
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    const commissionTypeForCalc = formState.commission_type === 'none' ? null : formState.commission_type as 'percentage' | 'fixed';
    const commissionValueForCalc = formState.commission_type === 'none' ? null : (formState.commission_value ? Number(formState.commission_value) : null);

    const calculated = calculateMarginData(
      formState.pricing_mode as 'net' | 'gross',
      Number(formState.price_per_night),
      commissionTypeForCalc,
      commissionValueForCalc
    );

    const newPeriod: PricingPeriod = {
      id: editingId || Date.now(),
      season_type: formState.season_type || null,
      start_date_recurring: dayjs(formState.startDate).format('DD-MM'),
      end_date_recurring: dayjs(formState.endDate).format('DD-MM'),
      price_per_night: calculated.finalPrice,
      source_price_per_night: calculated.sourcePrice,
      minimum_nights: formState.minimum_nights ? Number(formState.minimum_nights) : null,
      pricing_type: formState.pricing_type || 'per_night',
      pricing_mode: formState.pricing_mode as 'net' | 'gross',
      commission_type: commissionTypeForCalc,
      commission_value: commissionValueForCalc,
      margin_amount: calculated.marginAmount,
      margin_percentage: calculated.marginPercentage
    };

    let updated: PricingPeriod[];
    
    if (editingId) {
      updated = periods.map(p => p.id === editingId ? newPeriod : p);
    } else {
      updated = [...periods, newPeriod];
    }

    setPeriods(updated);
    
    // Обновляем форму если есть
    if (parentForm) {
      parentForm.setFieldValue('seasonalPricing', updated);
    }

    // ✅ Автоматическое сохранение через API
    if (autoSave) {
      try {
        await saveToBackend(updated);
        notifications.show({
          title: t('success'),
          message: editingId 
            ? t('properties.pricing.periodUpdated')
            : t('properties.pricing.periodAdded'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } catch (error) {
        // Ошибка уже показана в saveToBackend
        return; // Не закрываем модал при ошибке
      }
    } else {
      // Обычное поведение без автосохранения
      notifications.show({
        title: t('success'),
        message: editingId 
          ? t('properties.pricing.periodUpdated')
          : t('properties.pricing.periodAdded'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
    }
    
    setModalOpened(false);
    setFormState(initialFormState);
    setActiveStep(0);
  };

const handleDelete = (id: number) => {
  setDeletingPeriodId(id);
  setDeleteModalOpened(true);
};

const confirmDelete = async () => {
  if (!deletingPeriodId) return;
  
  const updated = periods.filter(p => p.id !== deletingPeriodId);
  setPeriods(updated);
  
  if (parentForm) {
    parentForm.setFieldValue('seasonalPricing', updated);
  }

  // ✅ Автоматическое сохранение при удалении
  if (autoSave) {
    try {
      await saveToBackend(updated);
      notifications.show({
        title: t('success'),
        message: t('properties.pricing.periodDeleted'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      // Ошибка уже показана в saveToBackend
    }
  } else {
    notifications.show({
      title: t('success'),
      message: t('properties.pricing.periodDeleted'),
      color: 'green',
      icon: <IconCheck size={16} />
    });
  }
  
  setDeleteModalOpened(false);
  setDeletingPeriodId(null);
};

  const showDetails = (period: PricingPeriod) => {
    setSelectedPeriod(period);
    setDetailsModalOpened(true);
  };

  const renderPeriodCard = (period: PricingPeriod) => {
    const seasonConfig = getSeasonConfig(period.season_type);
    const SeasonIcon = seasonConfig.icon;

    return (
      <Card
        key={period.id}
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        style={{
          borderColor: `var(--mantine-color-${seasonConfig.color}-5)`,
          transition: 'all 0.2s'
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm">
              <ThemeIcon
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: seasonConfig.color, to: `${seasonConfig.color}.9` }}
              >
                <SeasonIcon size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">
                  {seasonConfig.label}
                </Text>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    {period.start_date_recurring}
                  </Text>
                  <Text size="xs" c="dimmed">—</Text>
                  <Text size="xs" c="dimmed">
                    {period.end_date_recurring}
                  </Text>
                </Group>
              </div>
            </Group>

            {!viewMode && (
              <Group gap={4}>
                <Tooltip label={t('seasonalPricing.details')}>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size={isMobile ? 'md' : 'lg'}
                    onClick={() => showDetails(period)}
                  >
                    <IconEye size={isMobile ? 16 : 18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('common.edit')}>
                  <ActionIcon
                    variant="light"
                    color="violet"
                    size={isMobile ? 'md' : 'lg'}
                    onClick={() => handleEdit(period)}
                    disabled={saving}
                  >
                    <IconEdit size={isMobile ? 16 : 18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('common.delete')}>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size={isMobile ? 'md' : 'lg'}
                    onClick={() => handleDelete(period.id!)}
                    disabled={saving}
                  >
                    <IconTrash size={isMobile ? 16 : 18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>

          <Grid gutter="md">
            <Grid.Col span={6}>
              <Paper p="sm" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('seasonalPricing.priceForClient')}</Text>
                  <Text size="xl" fw={700} c={seasonConfig.color}>
                    {period.price_per_night.toLocaleString()} ฿
                  </Text>
                  <Badge size="xs" color={period.pricing_mode === 'net' ? 'blue' : 'green'}>
                    {period.pricing_mode === 'net' ? 'NET' : 'GROSS'}
                  </Badge>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={6}>
              <Paper p="sm" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('seasonalPricing.minimumNights')}</Text>
                  <Text size="xl" fw={700}>
                    {period.minimum_nights || '—'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {period.pricing_type === 'per_period' 
                      ? t('properties.pricing.forWholePeriod')
                      : t('properties.pricing.perNight')
                    }
                  </Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>
    );
  };

  const renderTimelineView = () => {
    return (
      <Timeline
        active={periods.length}
        bulletSize={32}
        lineWidth={2}
      >
        {periods.map((period) => {
          const seasonConfig = getSeasonConfig(period.season_type);
          const SeasonIcon = seasonConfig.icon;

          return (
            <Timeline.Item
              key={period.id}
              bullet={
                <ThemeIcon size="lg" radius="xl" variant="light" color={seasonConfig.color}>
                  <SeasonIcon size={18} />
                </ThemeIcon>
              }
              title={
                <Group gap="xs">
                  <Text fw={600} size="sm">{seasonConfig.label}</Text>
                  <Badge size="sm" variant="filled" color={seasonConfig.color}>
                    {period.price_per_night.toLocaleString()} ฿
                  </Badge>
                </Group>
              }
            >
              <Stack gap="xs">
                <Group gap="xs">
                  <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                  <Text size="sm" c="dimmed">
                    {period.start_date_recurring} — {period.end_date_recurring}
                  </Text>
                </Group>
                
                {period.minimum_nights && (
                  <Text size="xs" c="dimmed">
                    {t('seasonalPricing.minimumNights')}: {period.minimum_nights}
                  </Text>
                )}

                {!viewMode && (
                  <Group gap="xs" mt="xs">
                    <Button
                      variant="light"
                      size="xs"
                      color="blue"
                      leftSection={<IconEye size={14} />}
                      onClick={() => showDetails(period)}
                    >
                      {t('seasonalPricing.details')}
                    </Button>
                    <Button
                      variant="light"
                      size="xs"
                      color="violet"
                      leftSection={<IconEdit size={14} />}
                      onClick={() => handleEdit(period)}
                      disabled={saving}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="light"
                      size="xs"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => handleDelete(period.id!)}
                      disabled={saving}
                    >
                      {t('common.delete')}
                    </Button>
                  </Group>
                )}
              </Stack>
            </Timeline.Item>
          );
        })}
      </Timeline>
    );
  };

  const renderStepContent = () => {
    const currentCalculated = (formState.price_per_night && formState.pricing_mode) ? calculateMarginData(
      formState.pricing_mode,
      Number(formState.price_per_night),
      formState.commission_type === 'none' ? null : formState.commission_type,
      formState.commission_value ? Number(formState.commission_value) : null
    ) : null;

    switch (activeStep) {
      case 0:
        return (
          <Transition mounted={activeStep === 0} transition="fade" duration={300}>
            {(styles) => (
              <Stack gap="md" style={styles}>
                <Stack gap="xs">
                  {seasonTypes.map((season) => {
                    const SeasonIcon = season.icon;
                    const isSelected = formState.season_type === season.value;

                    return (
                      <Paper
                        key={season.value || 'custom'}
                        p="md"
                        radius="md"
                        withBorder
                        onClick={() => handleSeasonSelect(season.value)}
                        style={{
                          cursor: 'pointer',
                          borderWidth: isSelected ? '2px' : '1px',
                          borderColor: isSelected 
                            ? `var(--mantine-color-${season.color}-6)` 
                            : 'var(--mantine-color-dark-4)',
                          background: isSelected 
                            ? `linear-gradient(135deg, var(--mantine-color-${season.color}-9) 0%, var(--mantine-color-dark-7) 100%)`
                            : 'var(--mantine-color-dark-7)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Group gap="md" wrap="nowrap">
                          <ThemeIcon
                            size="xl"
                            radius="md"
                            variant={isSelected ? 'gradient' : 'light'}
                            gradient={isSelected ? { from: season.color, to: `${season.color}.9` } : undefined}
                            color={season.color}
                          >
                            <SeasonIcon size={24} />
                          </ThemeIcon>
                          <div style={{ flex: 1 }}>
                            <Text fw={600} size="sm" c={isSelected ? season.color : undefined}>
                              {season.label}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {season.description}
                            </Text>
                          </div>
                          {isSelected && (
                            <ThemeIcon size="md" radius="xl" variant="gradient" gradient={{ from: season.color, to: `${season.color}.9` }}>
                              <IconCheck size={16} />
                            </ThemeIcon>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            )}
          </Transition>
        );

      case 1:
        return (
          <Transition mounted={activeStep === 1} transition="fade" duration={300}>
            {(styles) => (
              <Stack gap="md" style={styles}>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        {t('seasonalPricing.startDate')} <Text component="span" c="red">*</Text>
                      </Text>
                      <div className="custom-datepicker-wrapper">
                        <DatePicker
                          selected={formState.startDate}
                          onChange={(date) => setFormState(prev => ({ ...prev, startDate: date }))}
                          dateFormat="dd-MM"
                          placeholderText={t('seasonalPricing.selectDate')}
                          className="custom-datepicker-input"
                          showPopperArrow={false}
                          enableTabLoop={false}
                          onChangeRaw={(e) => e?.preventDefault()}
                          autoComplete="off"
                        />
                      </div>
                    </Stack>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        {t('seasonalPricing.endDate')} <Text component="span" c="red">*</Text>
                      </Text>
                      <div className="custom-datepicker-wrapper">
                        <DatePicker
                          selected={formState.endDate}
                          onChange={(date) => setFormState(prev => ({ ...prev, endDate: date }))}
                          dateFormat="dd-MM"
                          placeholderText={t('seasonalPricing.selectDate')}
                          className="custom-datepicker-input"
                          minDate={formState.startDate || undefined}
                          showPopperArrow={false}
                          enableTabLoop={false}
                          onChangeRaw={(e) => e?.preventDefault()}
                          autoComplete="off"
                        />
                      </div>
                    </Stack>
                  </Grid.Col>
                </Grid>

                {formState.startDate && formState.endDate && (
                  <Alert color="teal" variant="light">
                    <Text size="sm">
                      {t('seasonalPricing.periodDuration')}: {dayjs(formState.startDate).format('DD-MM')} — {dayjs(formState.endDate).format('DD-MM')}
                    </Text>
                  </Alert>
                )}
              </Stack>
            )}
          </Transition>
        );

      case 2:
        return (
          <Transition mounted={activeStep === 2} transition="fade" duration={300}>
            {(styles) => (
              <Stack gap="md" style={styles}>
                <Alert color="blue" variant="light">
                  <Text size="sm">{t('seasonalPricing.selectPricingMode')}</Text>
                </Alert>

                <Stack gap="xs">
                  <Paper
                    p="lg"
                    radius="md"
                    withBorder
                    onClick={() => {
                      setFormState(prev => ({ ...prev, pricing_mode: 'net' }));
                      handleStepChange(3);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: formState.pricing_mode === 'net' ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dark-4)',
                      background: formState.pricing_mode === 'net' 
                        ? 'linear-gradient(135deg, var(--mantine-color-blue-9) 0%, var(--mantine-color-dark-7) 100%)'
                        : 'var(--mantine-color-dark-7)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text fw={700} size="lg" c="blue">NET</Text>
                        <Text size="sm" c="dimmed" mt={4}>{t('seasonalPricing.netDescription')}</Text>
                      </div>
                      {formState.pricing_mode === 'net' && (
                        <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                          <IconCheck size={20} />
                        </ThemeIcon>
                      )}
                    </Group>
                  </Paper>

                  <Paper
                    p="lg"
                    radius="md"
                    withBorder
                    onClick={() => {
                      setFormState(prev => ({ ...prev, pricing_mode: 'gross' }));
                      handleStepChange(3);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: formState.pricing_mode === 'gross' ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-dark-4)',
                      background: formState.pricing_mode === 'gross'
                        ? 'linear-gradient(135deg, var(--mantine-color-green-9) 0%, var(--mantine-color-dark-7) 100%)'
                        : 'var(--mantine-color-dark-7)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text fw={700} size="lg" c="green">GROSS</Text>
                        <Text size="sm" c="dimmed" mt={4}>{t('seasonalPricing.grossDescription')}</Text>
                      </div>
                      {formState.pricing_mode === 'gross' && (
                        <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'green', to: 'teal' }}>
                          <IconCheck size={20} />
                        </ThemeIcon>
                      )}
                    </Group>
                  </Paper>
                </Stack>
              </Stack>
            )}
          </Transition>
        );

      case 3:
        return (
          <Transition mounted={activeStep === 3} transition="fade" duration={300}>
            {(styles) => (
              <Stack gap="md" style={styles}>
                <Badge size="lg" color={formState.pricing_mode === 'net' ? 'blue' : 'green'}>
                  {formState.pricing_mode === 'net' ? 'NET' : 'GROSS'} {t('seasonalPricing.mode')}
                </Badge>

                <Select
                  label={
                    <Text size="sm" fw={500}>
                      {t('seasonalPricing.commissionType')} <Text component="span" c="red">*</Text>
                    </Text>
                  }
                  placeholder={t('common.select')}
                  value={formState.commission_type || ''}
                  onChange={(value) => setFormState(prev => ({ ...prev, commission_type: value as 'percentage' | 'fixed' | 'none' | null }))}
                  data={[
                    { value: 'none', label: t('seasonalPricing.noCommission') },
                    { value: 'percentage', label: t('seasonalPricing.percentageCommission') },
                    { value: 'fixed', label: t('seasonalPricing.fixedCommission') }
                  ]}
                  styles={{ input: { fontSize: '16px' } }}
                />

                {formState.commission_type && formState.commission_type !== 'none' && (
                  <NumberInput
                    label={
                      <Text size="sm" fw={500}>
                        {formState.commission_type === 'percentage' ? t('seasonalPricing.commissionPercent') : t('seasonalPricing.commissionAmount')} <Text component="span" c="red">*</Text>
                      </Text>
                    }
                    value={formState.commission_value}
                    onChange={(value) => setFormState(prev => ({ ...prev, commission_value: value }))}
                    min={0}
                    suffix={formState.commission_type === 'percentage' ? '%' : ' ฿'}
                    placeholder="0"
                    styles={{ input: { fontSize: '16px' } }}
                  />
                )}

                <Divider />

                <NumberInput
                  label={
                    <Text size="sm" fw={500}>
                      {formState.pricing_mode === 'gross' 
                        ? t('seasonalPricing.clientPrice')
                        : t('properties.pricing.pricePerNight')
                      } <Text component="span" c="red">*</Text>
                    </Text>
                  }
                  placeholder="0"
                  value={formState.price_per_night}
                  onChange={(value) => setFormState(prev => ({ ...prev, price_per_night: value }))}
                  min={0}
                  step={1000}
                  thousandSeparator=" "
                  leftSection={<IconCurrencyBaht size={16} />}
                  styles={{ input: { fontSize: '16px' } }}
                />

                <Select
                  label={t('seasonalPricing.pricingType')}
                  value={formState.pricing_type}
                  onChange={(value) => setFormState(prev => ({ ...prev, pricing_type: value as 'per_night' | 'per_period' }))}
                  data={[
                    { value: 'per_night', label: t('properties.pricing.perNight') },
                    { value: 'per_period', label: t('properties.pricing.forWholePeriod') }
                  ]}
                  styles={{ input: { fontSize: '16px' } }}
                />

                <NumberInput
                  label={t('properties.pricing.minimumNights')}
                  placeholder="1"
                  value={formState.minimum_nights}
                  onChange={(value) => setFormState(prev => ({ ...prev, minimum_nights: value }))}
                  min={1}
                  leftSection={<IconCalendar size={16} />}
                  styles={{ input: { fontSize: '16px' } }}
                />

                {currentCalculated && formState.commission_type && (
                  <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
                    <Stack gap="sm">
                      <Text size="sm" fw={600} c="dimmed">{t('seasonalPricing.calculation')}</Text>
                      
                      {formState.commission_type === 'none' || currentCalculated.marginAmount === 0 ? (
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>{t('seasonalPricing.finalPriceClient')}</Text>
                          <Text size="xl" fw={700} c="green">
                            {currentCalculated.finalPrice.toLocaleString()} ฿
                          </Text>
                        </Group>
                      ) : (
                        formState.pricing_mode === 'net' ? (
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">{t('seasonalPricing.sourcePriceNet')}</Text>
                              <Text size="md" fw={600}>{currentCalculated.sourcePrice.toLocaleString()} ฿</Text>
                            </Group>
                            
                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                                <Text size="xs" c="green">{t('seasonalPricing.commissionAdd')}</Text>
                              </Group>
                              <Text size="md" fw={600} c="green">
                                +{currentCalculated.marginAmount.toLocaleString()} ฿ ({currentCalculated.marginPercentage.toFixed(2)}%)
                              </Text>
                            </Group>

                            <Divider style={{ borderStyle: 'dashed' }} />

                            <Group justify="space-between">
                              <Text size="xs" fw={700}>{t('seasonalPricing.finalPriceClient')}</Text>
                              <Text size="lg" fw={700} c="green">
                                {currentCalculated.finalPrice.toLocaleString()} ฿
                              </Text>
                            </Group>
                          </Stack>
                        ) : (
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="xs" fw={700}>{t('seasonalPricing.clientPriceGross')}</Text>
                              <Text size="lg" fw={700}>{currentCalculated.finalPrice.toLocaleString()} ฿</Text>
                            </Group>

                            <Divider style={{ borderStyle: 'dashed' }} />

                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                                <Text size="xs" c="green">{t('seasonalPricing.ourMargin')}</Text>
                              </Group>
                              <Text size="md" fw={600} c="green">
                                {currentCalculated.marginAmount.toLocaleString()} ฿ ({currentCalculated.marginPercentage.toFixed(2)}%)
                              </Text>
                            </Group>
                            
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">{t('seasonalPricing.ownerPrice')}</Text>
                              <Text size="md" fw={600}>{currentCalculated.sourcePrice.toLocaleString()} ฿</Text>
                            </Group>
                          </Stack>
                        )
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}
          </Transition>
        );

      default:
        return null;
    }
  };

  const renderMobileSteps = () => {
    return (
      <Group justify="center" gap="xs">
        {[0, 1, 2, 3].map((step, index) => (
          <>
            <Box
              key={step}
              onClick={() => setActiveStep(step)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeStep === step 
                  ? 'linear-gradient(135deg, var(--mantine-color-violet-6), var(--mantine-color-grape-6))'
                  : activeStep > step 
                    ? 'var(--mantine-color-green-6)'
                    : 'var(--mantine-color-dark-5)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {activeStep > step ? <IconCheck size={16} /> : step + 1}
            </Box>
            {index < 3 && (
              <IconArrowRight 
                size={14} 
                style={{ 
                  opacity: 0.5,
                  color: activeStep > step ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-dark-4)'
                }} 
              />
            )}
          </>
        ))}
      </Group>
    );
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md">
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
              <IconCalendar size={24} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl">{t('properties.pricing.title')}</Text>
              <Text size="xs" c="dimmed">
                {t('seasonalPricing.periodsCount', { count: periods.length })}
              </Text>
            </div>
          </Group>

          {!viewMode && (
            <Button
              variant="gradient"
              gradient={{ from: 'teal', to: 'green' }}
              leftSection={<IconPlus size={18} />}
              onClick={handleAdd}
              size={isMobile ? 'sm' : 'md'}
              disabled={saving}
              loading={saving}
            >
              {!isMobile && (periods.length === 0 
                ? t('properties.pricing.addPeriod')
                : t('seasonalPricing.addAnotherSeason')
              )}
            </Button>
          )}
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{t('properties.pricing.seasonalDisclaimer')}</Text>
        </Alert>

        {periods.length > 0 && !isMobile && (
          <Group justify="center">
            <SegmentedControl
              value={viewMode_internal}
              onChange={(value) => setViewMode_internal(value as 'list' | 'timeline')}
              data={[
                { label: t('seasonalPricing.cardView'), value: 'list' },
                { label: t('seasonalPricing.timelineView'), value: 'timeline' }
              ]}
            />
          </Group>
        )}

        {periods.length > 0 ? (
          viewMode_internal === 'timeline' && !isMobile ? (
            renderTimelineView()
          ) : (
            <Stack gap="md">
              {periods.map(renderPeriodCard)}
            </Stack>
          )
        ) : (
          <Center p={40}>
            <Stack align="center" gap="md">
              <ThemeIcon size={80} radius="md" variant="light" color="gray">
                <IconCalendar size={40} />
              </ThemeIcon>
              <Stack gap={4} align="center">
                <Text size="lg" fw={500} c="dimmed">
                  {t('seasonalPricing.noPeriods')}
                </Text>
                <Text size="sm" c="dimmed">
                  {t('seasonalPricing.addFirstPeriod')}
                </Text>
              </Stack>
            </Stack>
          </Center>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setFormState(initialFormState);
          setActiveStep(0);
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
              {editingId ? <IconEdit size={20} /> : <IconPlus size={20} />}
            </ThemeIcon>
            <Text fw={600} size="lg">
              {editingId ? t('seasonalPricing.editPeriod') : t('seasonalPricing.addPeriod')}
            </Text>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Stack gap="xl">
          {isMobile ? renderMobileSteps() : (
            <Group justify="center" gap="md">
              {[
                { label: t('seasonalPricing.seasonType'), step: 0 },
                { label: t('seasonalPricing.period'), step: 1 },
                { label: t('seasonalPricing.priceMode'), step: 2 },
                { label: t('seasonalPricing.prices'), step: 3 }
              ].map(({ label, step }, index) => (
                <>
                  <Group key={step} gap="xs">
                    <Box
                      onClick={() => setActiveStep(step)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: activeStep === step 
                          ? 'linear-gradient(135deg, var(--mantine-color-violet-6), var(--mantine-color-grape-6))'
                          : activeStep > step 
                            ? 'var(--mantine-color-green-6)'
                            : 'var(--mantine-color-dark-5)',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {activeStep > step ? <IconCheck size={18} /> : step + 1}
                    </Box>
                    <Text size="sm" fw={activeStep === step ? 600 : 400}>
                      {label}
                    </Text>
                  </Group>
                  {index < 3 && <IconArrowRight size={16} style={{ opacity: 0.3 }} />}
                </>
              ))}
            </Group>
          )}

          <Box style={{ minHeight: isMobile ? '400px' : '350px' }}>
            {renderStepContent()}
          </Box>

          <Group justify="space-between">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconX size={18} />}
              onClick={() => {
                setModalOpened(false);
                setFormState(initialFormState);
                setActiveStep(0);
              }}
            >
              {t('common.cancel')}
            </Button>

            <Group gap="xs">
              {activeStep > 0 && (
                <Button
                  variant="light"
                  onClick={() => setActiveStep(prev => prev - 1)}
                >
                  {t('seasonalPricing.back')}
                </Button>
              )}
              
              {activeStep < 3 && activeStep !== 0 && activeStep !== 2 && (
                <Button
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'grape' }}
                  onClick={() => setActiveStep(prev => prev + 1)}
                  disabled={
                    (activeStep === 1 && (!formState.startDate || !formState.endDate))
                  }
                >
                  {t('seasonalPricing.next')}
                </Button>
              )}
              
              {activeStep === 3 && (
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                  leftSection={<IconCheck size={18} />}
                  onClick={handleSubmit}
                  disabled={!formState.commission_type || saving}
                  loading={saving}
                >
                  {editingId ? t('common.save') : t('common.add')}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={detailsModalOpened}
        onClose={() => setDetailsModalOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconInfoCircle size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">{t('seasonalPricing.seasonDetails')}</Text>
          </Group>
        }
        centered
        size="md"
      >
        {selectedPeriod && (() => {
          const seasonConfig = getSeasonConfig(selectedPeriod.season_type);
          const SeasonIcon = seasonConfig.icon;

          const displayData = {
            finalPrice: selectedPeriod.price_per_night,
            sourcePrice: selectedPeriod.source_price_per_night || selectedPeriod.price_per_night,
            marginAmount: selectedPeriod.margin_amount || 0,
            marginPercentage: selectedPeriod.margin_percentage || 0
          };

          return (
            <Stack gap="md">
              <Paper p="md" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: seasonConfig.color, to: `${seasonConfig.color}.9` }}>
                      <SeasonIcon size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{seasonConfig.label}</Text>
                      <Text size="xs" c="dimmed">
                        {selectedPeriod.start_date_recurring} — {selectedPeriod.end_date_recurring}
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  {displayData && displayData.marginAmount > 0 ? (
                    <Paper p="md" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
                      <Stack gap="sm">
                        <Text size="sm" fw={600} c="dimmed">{t('seasonalPricing.calculation')}</Text>
                        
                        {selectedPeriod.pricing_mode === 'net' ? (
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">{t('seasonalPricing.sourcePriceNet')}</Text>
                              <Text size="lg" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                            </Group>
                            
                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                                <Text size="xs" c="green">{t('seasonalPricing.commissionAdd')}</Text>
                              </Group>
                              <Text size="lg" fw={600} c="green">
                                +{displayData.marginAmount.toLocaleString()} ฿ ({displayData.marginPercentage.toFixed(2)}%)
                              </Text>
                            </Group>

                            <Divider style={{ borderStyle: 'dashed' }} />

                            <Group justify="space-between">
                              <Text size="sm" fw={700}>{t('seasonalPricing.finalPriceClient')}</Text>
                              <Text size="xl" fw={700} c={seasonConfig.color}>
                                {displayData.finalPrice.toLocaleString()} ฿
                              </Text>
                            </Group>
                          </Stack>
                        ) : (
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="sm" fw={700}>{t('seasonalPricing.clientPriceGross')}</Text>
                              <Text size="xl" fw={700}>{displayData.finalPrice.toLocaleString()} ฿</Text>
                            </Group>

                            <Divider style={{ borderStyle: 'dashed' }} />

                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                                <Text size="xs" c="green">{t('seasonalPricing.ourMargin')}</Text>
                              </Group>
                              <Text size="lg" fw={600} c="green">
                                {displayData.marginAmount.toLocaleString()} ฿ ({displayData.marginPercentage.toFixed(2)}%)
                              </Text>
                            </Group>
                            
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">{t('seasonalPricing.ownerPrice')}</Text>
                              <Text size="lg" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                            </Group>
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  ) : (
                    <Paper p="md" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">{t('seasonalPricing.priceForClient')}</Text>
                        <Text size="xl" fw={700} c={seasonConfig.color}>
                          {selectedPeriod.price_per_night.toLocaleString()} ฿
                        </Text>
                      </Group>
                    </Paper>
                  )}

                  <Grid gutter="md">
                    <Grid.Col span={6}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">{t('seasonalPricing.minimumNights')}</Text>
                        <Text size="lg" fw={600}>
                          {selectedPeriod.minimum_nights || '—'}
                        </Text>
                      </Stack>
                    </Grid.Col>

                    <Grid.Col span={6}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">{t('seasonalPricing.pricingType')}</Text>
                        <Text size="lg" fw={600}>
                          {selectedPeriod.pricing_type === 'per_period' 
                            ? t('properties.pricing.forWholePeriod')
                            : t('properties.pricing.perNight')
                          }
                        </Text>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

              <Button
                fullWidth
                variant="light"
                onClick={() => setDetailsModalOpened(false)}
              >
                {t('common.close')}
              </Button>
            </Stack>
          );
        })()}
      </Modal>
        {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeletingPeriodId(null);
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" color="red" variant="light">
              <IconTrash size={20} />
            </ThemeIcon>
            <Text fw={600}>{t('common.confirmDelete')}</Text>
          </Group>
        }
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">{t('seasonalPricing.deleteConfirmation')}</Text>
          
          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setDeleteModalOpened(false);
                setDeletingPeriodId(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="filled"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={confirmDelete}
              disabled={saving}
              loading={saving}
            >
              {t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <style>
        {`
          .custom-datepicker-wrapper {
            width: 100%;
          }
          
          .custom-datepicker-input {
            width: 100%;
            padding: 10px 12px;
            font-size: 16px !important;
            border: 1px solid var(--mantine-color-dark-4);
            border-radius: 4px;
            background: var(--mantine-color-dark-7);
            color: var(--mantine-color-gray-0);
            cursor: pointer;
            caret-color: transparent;
          }
          
          .custom-datepicker-input:focus {
            outline: none;
            border-color: var(--mantine-color-blue-5);
          }
          
          .custom-datepicker-input::placeholder {
            color: var(--mantine-color-dimmed);
          }

          input, select, textarea {
            font-size: 16px !important;
          }

          .react-datepicker-popper {
            z-index: 9999 !important;
          }

          .react-datepicker {
            font-family: inherit;
            background: var(--mantine-color-dark-6);
            border-color: var(--mantine-color-dark-4);
          }

          .react-datepicker__header {
            background: var(--mantine-color-dark-7);
            border-bottom-color: var(--mantine-color-dark-4);
          }

          .react-datepicker__current-month,
          .react-datepicker__day-name {
            color: var(--mantine-color-gray-0);
          }

          .react-datepicker__day {
            color: var(--mantine-color-gray-0);
          }

          .react-datepicker__day:hover {
            background: var(--mantine-color-blue-7);
          }

          .react-datepicker__day--selected {
            background: var(--mantine-color-blue-6);
          }

          @media (max-width: 768px) {
            .react-datepicker {
              font-size: 16px !important;
            }
            
            input[type="text"],
            input[type="number"],
            select,
            textarea {
              font-size: 16px !important;
              -webkit-text-size-adjust: 100%;
            }
            
            .custom-datepicker-input {
              caret-color: transparent !important;
            }
          }
        `}
      </style>
    </Card>
  );
};

export default SeasonalPricing;