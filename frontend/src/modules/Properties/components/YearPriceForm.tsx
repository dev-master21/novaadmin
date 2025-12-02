// frontend/src/modules/Properties/components/YearPriceForm.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Button,
  NumberInput,
  SegmentedControl,
  Paper,
  Alert,
  MantineTheme
} from '@mantine/core';
import {
  IconCalendar,
  IconCurrencyBaht,
  IconDeviceFloppy,
  IconArrowRight,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconInfoCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { propertiesApi } from '@/api/properties.api';
import { propertyOwnersApi } from '@/api/propertyOwners.api';

interface YearPriceFormProps {
  propertyId: number;
  initialData?: {
    price: number | null;
    pricing_mode?: 'net' | 'gross' | 'month';
    commission_type?: 'percentage' | 'fixed' | 'month' | null;
    commission_value?: number | null;
    source_price?: number | null;
    margin_percentage?: number | null;
  };
  viewMode?: boolean;
  isOwnerMode?: boolean;
  onChange?: (data: any) => void;
}

const YearPriceForm = ({ 
  propertyId, 
  initialData,
  viewMode = false,
  isOwnerMode = false,
  onChange
}: YearPriceFormProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [price, setPrice] = useState<number | null>(null);
  const [pricingMode, setPricingMode] = useState<'month' | 'net' | 'gross'>('month');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed' | null>(null);
  const [commissionValue, setCommissionValue] = useState<number | null>(null);
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [editedGrossPrice, setEditedGrossPrice] = useState<number | undefined>(undefined);
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ ИСПРАВЛЕНО: Добавлен ключ для принудительного обновления
  useEffect(() => {
    console.log('🔄 YearPriceForm: Loading initialData', initialData);
    
    if (initialData) {
      // ✅ Определяем режим из pricing_mode
      let mode: 'month' | 'net' | 'gross' = 'month';
      
      if (initialData.pricing_mode === 'month') {
        mode = 'month';
        // ✅ Загружаем количество месяцев из year_margin_percentage
        const loadedMonths = initialData.margin_percentage || 1;
        console.log('📊 Loading MONTH mode, months:', loadedMonths);
        setMonthsCount(loadedMonths);
      } else {
        mode = (initialData.pricing_mode || 'net') as 'net' | 'gross';
      }
      
      const commType = initialData.commission_type;
      const sourcePrice = initialData.source_price;
      const finalPrice = initialData.price;
      const commValue = initialData.commission_value;
      
      const loadedPrice = mode === 'net' 
        ? (sourcePrice || finalPrice)
        : finalPrice;
      
      const loadedEditedGrossPrice = mode === 'net' && finalPrice 
        ? Number(finalPrice)
        : undefined;
      
      console.log('📊 Setting state:', { 
        price: loadedPrice, 
        mode, 
        monthsCount: mode === 'month' ? (initialData.margin_percentage || 1) : monthsCount 
      });
      
      setPrice(loadedPrice);
      setPricingMode(mode);
      setCommissionType(commType === 'month' ? null : (commType ?? null));
      setCommissionValue(commValue || null);
      setEditedGrossPrice(loadedEditedGrossPrice);
      setHasChanges(false);
    }
  }, [initialData?.price, initialData?.pricing_mode, initialData?.margin_percentage]); // ✅ Зависимости

  const calculateMarginData = (
    mode: 'month' | 'net' | 'gross',
    priceValue: number,
    commType: 'percentage' | 'fixed' | null,
    commValue: number | null,
    months?: number
  ) => {
    const numericPrice = Number(priceValue);
    
    if (mode === 'month') {
      const monthlyPrice = numericPrice;
      const monthsCommission = months !== undefined && months !== null ? months : 1; // ✅ ИСПРАВЛЕНО
      const yearlyTotal = monthlyPrice * 12;
      const marginAmount = monthlyPrice * monthsCommission;
      const ownerReceives = yearlyTotal - marginAmount;
      
      console.log('💰 Calculate MONTH:', { monthlyPrice, monthsCommission, yearlyTotal, marginAmount, ownerReceives });
      
      return {
        finalPrice: monthlyPrice,
        sourcePrice: monthlyPrice,
        marginAmount: Math.round(marginAmount),
        marginPercentage: monthsCommission,
        yearlyTotal: Math.round(yearlyTotal),
        ownerReceives: Math.round(ownerReceives)
      };
    }
    
    if (!commType || !commValue || commValue <= 0) {
      return {
        finalPrice: Math.round(numericPrice),
        sourcePrice: Math.round(numericPrice),
        marginAmount: 0,
        marginPercentage: 0
      };
    }

    if (mode === 'net') {
      const sourcePrice = numericPrice;
      let marginAmount = 0;

      if (commType === 'percentage') {
        marginAmount = sourcePrice * (commValue / 100);
      } else {
        marginAmount = commValue;
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
      const finalPrice = numericPrice;
      let marginAmount = 0;

      if (commType === 'percentage') {
        marginAmount = finalPrice * (commValue / 100);
      } else {
        marginAmount = commValue;
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

  const getDisplayData = () => {
    if (!price) return null;

    if (pricingMode === 'month') {
      return calculateMarginData(pricingMode, Number(price), null, null, monthsCount);
    }

    if (!commissionType) return null;

    if (pricingMode === 'net' && editedGrossPrice !== undefined && editedGrossPrice !== null) {
      const sourcePrice = Number(price);
      const finalPrice = editedGrossPrice;
      const marginAmount = finalPrice - sourcePrice;
      const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
      
      return {
        finalPrice: Math.round(finalPrice),
        sourcePrice: Math.round(sourcePrice),
        marginAmount: Math.round(marginAmount),
        marginPercentage: Math.round(marginPercentage * 100) / 100
      };
    }
    
    return calculateMarginData(pricingMode, Number(price), commissionType, commissionValue);
  };

  const handlePriceChange = (value: number | string) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value as string) || null;
    setPrice(numValue);
    setEditedGrossPrice(undefined);
    setHasChanges(true);
  };

  const handleModeChange = (value: string) => {
    setPricingMode(value as 'month' | 'net' | 'gross');
    setEditedGrossPrice(undefined);
    setHasChanges(true);
  };

  const handleCommissionTypeChange = (value: string | null) => {
    setCommissionType(value as 'percentage' | 'fixed' | null);
    setEditedGrossPrice(undefined);
    setHasChanges(true);
  };

  const handleCommissionValueChange = (value: number | string) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value as string) || null;
    setCommissionValue(numValue);
    setEditedGrossPrice(undefined);
    setHasChanges(true);
  };

  // ✅ ИСПРАВЛЕНО: Убрано автоматическое значение 1, добавлена поддержка десятичных
  const handleMonthsCountChange = (value: number | string) => {
    let numValue: number;
    
    if (typeof value === 'number') {
      numValue = value;
    } else {
      // Заменяем запятую на точку для поддержки русской локали
      const normalizedValue = String(value).replace(',', '.');
      numValue = parseFloat(normalizedValue);
      
      // Если не удалось распарсить - ставим 1
      if (isNaN(numValue)) {
        numValue = 1;
      }
    }
    
    console.log('📝 MonthsCount changed:', value, '→', numValue);
    setMonthsCount(numValue);
    setHasChanges(true);
  };

  const handleGrossPriceChange = (newGrossPrice: number | string) => {
    if (!price) return;

    const grossValue = typeof newGrossPrice === 'number' ? newGrossPrice : parseFloat(newGrossPrice as string) || 0;
    const sourcePrice = Number(price);
    
    const marginAmount = grossValue - sourcePrice;
    
    let newCommissionValue: number | null = null;
    
    if (commissionType === 'percentage') {
      newCommissionValue = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
    } else if (commissionType === 'fixed') {
      newCommissionValue = marginAmount;
    }

    setCommissionValue(newCommissionValue);
    setEditedGrossPrice(grossValue);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (pricingMode === 'month') {
      if (!price) {
        notifications.show({
          title: t('properties.messages.warning'),
          message: t('properties.yearPrice.validation.enterMonthlyPrice'),
          color: 'orange',
          icon: <IconAlertTriangle size={16} />
        });
        return;
      }
      if (!monthsCount || monthsCount <= 0) {
        notifications.show({
          title: t('properties.messages.warning'),
          message: t('properties.yearPrice.validation.enterMonthsCount'),
          color: 'orange',
          icon: <IconAlertTriangle size={16} />
        });
        return;
      }
    } else {
      if (!price || !commissionType) {
        notifications.show({
          title: t('properties.messages.warning'),
          message: t('properties.messages.selectCommissionType'),
          color: 'orange',
          icon: <IconAlertTriangle size={16} />
        });
        return;
      }

      if (pricingMode === 'net' && editedGrossPrice) {
        if (editedGrossPrice <= Number(price)) {
          notifications.show({
            title: t('properties.messages.warning'),
            message: t('properties.messages.grossMustBeHigher'),
            color: 'orange',
            icon: <IconAlertTriangle size={16} />
          });
          return;
        }
      }
    }

    console.log('💾 Saving with monthsCount:', monthsCount);

    if (!propertyId || propertyId === 0) {
      setSaving(true);

      try {
        let calculated;
        
        if (pricingMode === 'month') {
          calculated = calculateMarginData('month', Number(price), null, null, monthsCount);
          console.log('💾 Calculated MONTH data:', calculated);
        } else if (pricingMode === 'net' && editedGrossPrice !== undefined && editedGrossPrice !== null) {
          const sourcePrice = Number(price);
          const finalPrice = Number(editedGrossPrice);
          const marginAmount = finalPrice - sourcePrice;
          const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
          
          calculated = {
            finalPrice: Math.round(finalPrice),
            sourcePrice: Math.round(sourcePrice),
            marginAmount: Math.round(marginAmount),
            marginPercentage: Math.round(marginPercentage * 100) / 100
          };
        } else {
          calculated = calculateMarginData(pricingMode, Number(price), commissionType, commissionValue);
        }

        const localData = {
          year_price: calculated.finalPrice,
          year_pricing_mode: pricingMode,
          year_commission_type: pricingMode === 'month' ? 'month' : commissionType,
          year_commission_value: pricingMode === 'month' ? null : commissionValue,
          year_source_price: calculated.sourcePrice,
          year_margin_amount: calculated.marginAmount,
          year_margin_percentage: calculated.marginPercentage
        };

        console.log('💾 Local save data:', localData);

        if (onChange) {
          onChange(localData);
        }

        setHasChanges(false);
        
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.yearPriceSavedLocally'),
          color: 'blue',
          icon: <IconCheck size={16} />
        });

      } catch (error: any) {
        console.error('Local save year price error:', error);
        notifications.show({
          title: t('errors.generic'),
          message: t('errors.generic'),
          color: 'red',
          icon: <IconX size={16} />
        });
      } finally {
        setSaving(false);
      }
      
      return;
    }

    setSaving(true);

    try {
      let calculated;
      
      if (pricingMode === 'month') {
        calculated = calculateMarginData('month', Number(price), null, null, monthsCount);
        console.log('💾 Calculated MONTH data for server:', calculated);
      } else if (pricingMode === 'net' && editedGrossPrice !== undefined && editedGrossPrice !== null) {
        const sourcePrice = Number(price);
        const finalPrice = Number(editedGrossPrice);
        const marginAmount = finalPrice - sourcePrice;
        const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
        
        calculated = {
          finalPrice: Math.round(finalPrice),
          sourcePrice: Math.round(sourcePrice),
          marginAmount: Math.round(marginAmount),
          marginPercentage: Math.round(marginPercentage * 100) / 100
        };
      } else {
        calculated = calculateMarginData(pricingMode, Number(price), commissionType, commissionValue);
      }

      const updateData = {
        year_price: calculated.finalPrice,
        year_pricing_mode: pricingMode,
        year_commission_type: pricingMode === 'month' ? 'month' : commissionType,
        year_commission_value: pricingMode === 'month' ? null : commissionValue,
        year_source_price: calculated.sourcePrice,
        year_margin_amount: calculated.marginAmount,
        year_margin_percentage: calculated.marginPercentage
      };

      console.log('💾 Sending to server:', updateData);

      if (isOwnerMode) {
        await propertyOwnersApi.updatePropertyPricing(propertyId, updateData);
      } else {
        await propertiesApi.update(propertyId, updateData);
      }
      
      setHasChanges(false);
      
      notifications.show({
        title: t('common.success'),
        message: t('properties.messages.yearPriceSaved'),
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // ✅ ИСПРАВЛЕНО: Правильная структура данных для родителя
      if (onChange) {
        const updatedData = {
          price: updateData.year_price,
          pricing_mode: updateData.year_pricing_mode,
          commission_type: updateData.year_commission_type,
          commission_value: updateData.year_commission_value,
          source_price: updateData.year_source_price,
          margin_percentage: updateData.year_margin_percentage
        };
        
        console.log('✅ Calling onChange with:', updatedData);
        onChange(updatedData);
      }
    } catch (error: any) {
      console.error('Save year price error:', error);
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('errors.generic'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setSaving(false);
    }
  };

  const displayData = getDisplayData();
  const hasPrice = price && price > 0;
  const hasCommission = pricingMode === 'month' || (commissionType && commissionType !== null);
  const canSave = hasChanges && hasPrice && hasCommission && !saving;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group>
          <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconCalendar size={24} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">{t('properties.yearPrice.title')}</Text>
            <Text size="xs" c="dimmed">{t('properties.yearPrice.description')}</Text>
          </div>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{t('properties.yearPrice.info')}</Text>
        </Alert>

        {/* ✅ ИСПРАВЛЕНО: Улучшенные стили для MONTH */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('properties.pricing.selectMode')} <Text component="span" c="red">*</Text>
          </Text>
          <SegmentedControl
            value={pricingMode}
            onChange={handleModeChange}
            disabled={viewMode}
            fullWidth
            size="lg"
            data={[
              { 
                value: 'month', 
                label: 'MONTH'
              },
              { 
                value: 'net', 
                label: 'NET' 
              },
              { 
                value: 'gross', 
                label: 'GROSS' 
              }
            ]}
            styles={{
              root: {
                background: 'rgba(37, 38, 43, 1)',
                padding: '6px',
                borderRadius: '10px',
                border: '1px solid rgba(55, 58, 64, 1)'
              },
              indicator: (theme: MantineTheme) => ({
                background: pricingMode === 'month' 
                  ? 'linear-gradient(135deg, #fd7e14 0%, #e8590c 100%)'
                  : theme.colors.blue[6],
                boxShadow: pricingMode === 'month'
                  ? '0 0 25px rgba(253, 126, 20, 0.5), 0 4px 10px rgba(0,0,0,0.3)'
                  : '0 2px 8px rgba(0,0,0,0.15)',
                borderRadius: '8px'
              }),
              label: {
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: 600,
                padding: isMobile ? '12px 18px' : '14px 24px',
                transition: 'all 0.25s ease',
                '&[data-active]': {
                  color: 'white !important',
                  fontWeight: 700,
                  textShadow: pricingMode === 'month' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'
                },
                '&:not([data-active])': {
                  color: 'rgba(144, 146, 150, 1)'
                }
              }
            }}
          />
        </Stack>

        <Stack gap="xs">
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light" color="blue">
              <IconCurrencyBaht size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              {pricingMode === 'month' 
                ? t('properties.yearPrice.monthlyPriceLabel')
                : pricingMode === 'gross' 
                  ? t('properties.pricing.clientPrice')
                  : t('properties.pricing.sourcePrice')
              }
            </Text>
          </Group>
          <NumberInput
            value={price ?? undefined}
            onChange={handlePriceChange}
            min={0}
            step={1000}
            thousandSeparator=" "
            disabled={viewMode}
            leftSection={<IconCurrencyBaht size={16} />}
            rightSection={
              <Text size="xs" c="dimmed" style={{ marginRight: 8 }}>
                THB
              </Text>
            }
            placeholder="0"
            size="md"
            styles={{
              input: {
                fontSize: '18px',
                fontWeight: 600
              }
            }}
          />
        </Stack>

        {pricingMode === 'month' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('properties.yearPrice.monthsCountLabel')} <Text component="span" c="red">*</Text>
            </Text>
            <NumberInput
              value={monthsCount}
              onChange={handleMonthsCountChange}
              min={0.1}
              max={12}
              step={0.5}
              decimalScale={2} // ✅ ИСПРАВЛЕНО: Увеличено до 2 для поддержки 0.5
              fixedDecimalScale={false}
              disabled={viewMode}
              placeholder="1"
              size="md"
              description={t('properties.yearPrice.monthsCountDescription')}
              allowDecimal={true} // ✅ Явно разрешаем десятичные
              styles={{
                input: {
                  fontSize: '16px'
                }
              }}
            />
          </Stack>
        )}

        {pricingMode !== 'month' && (
          <>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {t('properties.pricing.commissionType')} <Text component="span" c="red">*</Text>
              </Text>
              <SegmentedControl
                value={commissionType || ''}
                onChange={handleCommissionTypeChange}
                disabled={viewMode}
                fullWidth
                size="lg"
                data={[
                  { value: 'percentage', label: t('properties.pricing.percentageCommission') },
                  { value: 'fixed', label: t('properties.pricing.fixedCommission') }
                ]}
                styles={{
                  root: {
                    background: 'rgba(37, 38, 43, 1)',
                    padding: '6px',
                    borderRadius: '10px',
                    border: '1px solid rgba(55, 58, 64, 1)'
                  },
                  indicator: {
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  },
                  label: {
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: 600,
                    padding: isMobile ? '12px 18px' : '14px 24px',
                    transition: 'all 0.25s ease',
                    '&[data-active]': {
                      color: 'white',
                      fontWeight: 700
                    },
                    '&:not([data-active])': {
                      color: 'rgba(144, 146, 150, 1)'
                    }
                  }
                }}
              />
            </Stack>

            {commissionType && (
              <NumberInput
                label={commissionType === 'percentage' ? t('properties.pricing.commissionPercent') : t('properties.pricing.commissionAmount')}
                value={commissionValue ?? undefined}
                onChange={handleCommissionValueChange}
                min={0}
                suffix={commissionType === 'percentage' ? '%' : ' ฿'}
                disabled={viewMode}
                placeholder="0"
                size="md"
              />
            )}
          </>
        )}

        {hasPrice && displayData && hasCommission && pricingMode === 'month' && (
          <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
            <Stack gap="sm">
              <Text size="sm" fw={600} c="dimmed">{t('properties.pricing.calculation')}</Text>
              
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('properties.yearPrice.calculation.monthlyPrice')}</Text>
                  <Text size="md" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                </Group>

                <Group justify="space-between">
                  <Group gap="xs">
                    <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                    <Text size="sm" c="orange">{t('properties.yearPrice.calculation.yearlyTotal')}</Text>
                  </Group>
                  <Text size="lg" fw={700} c="orange">
                    {displayData.yearlyTotal?.toLocaleString()} ฿
                  </Text>
                </Group>

                <div style={{ 
                  borderTop: '2px dashed var(--mantine-color-dark-4)', 
                  marginTop: 4, 
                  marginBottom: 4 
                }} />

                <Group justify="space-between">
                  <Group gap="xs">
                    <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                    <Text size="sm" c="green">{t('properties.yearPrice.calculation.ourCommission', { count: monthsCount })}</Text>
                  </Group>
                  <Text size="md" fw={600} c="green">
                    {displayData.marginAmount.toLocaleString()} ฿
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('properties.yearPrice.calculation.ownerReceives')}</Text>
                  <Text size="lg" fw={700}>{displayData.ownerReceives?.toLocaleString()} ฿</Text>
                </Group>
              </Stack>
            </Stack>
          </Paper>
        )}

        {hasPrice && displayData && hasCommission && pricingMode === 'net' && (
          <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
            <Stack gap="sm">
              <Text size="sm" fw={600} c="dimmed">{t('properties.pricing.calculation')}</Text>
              
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('properties.pricing.sourcePriceNet')}</Text>
                  <Text size="md" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                </Group>
                
                {displayData.marginAmount > 0 && (
                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                      <Text size="sm" c="green">{t('properties.pricing.commissionAdd')}</Text>
                    </Group>
                    <Text size="md" fw={600} c="green">
                      +{displayData.marginAmount.toLocaleString()} ฿ ({displayData.marginPercentage.toFixed(2)}%)
                    </Text>
                  </Group>
                )}

                <div style={{ 
                  borderTop: '2px dashed var(--mantine-color-dark-4)', 
                  marginTop: 4, 
                  marginBottom: 4 
                }} />

                <Stack gap="xs">
                  <Text size="xs" c="dimmed">{t('properties.pricing.finalPriceClient')}</Text>
                  <NumberInput
                    value={editedGrossPrice !== undefined && editedGrossPrice !== null ? editedGrossPrice : displayData.finalPrice}
                    onChange={handleGrossPriceChange}
                    min={0}
                    step={1000}
                    thousandSeparator=" "
                    disabled={viewMode}
                    leftSection={<IconCurrencyBaht size={16} />}
                    placeholder="0"
                    size="lg"
                    styles={{
                      input: {
                        fontSize: '20px',
                        fontWeight: 700,
                        color: 'var(--mantine-color-green-4)',
                        background: 'var(--mantine-color-dark-7)'
                      }
                    }}
                  />
                  {!isMobile && (
                    <Text size="xs" c="dimmed" ta="center">
                      {t('properties.pricing.editGrossHint')}
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        )}

        {hasPrice && displayData && hasCommission && pricingMode === 'gross' && (
          <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
            <Stack gap="sm">
              <Text size="sm" fw={600} c="dimmed">{t('properties.pricing.calculation')}</Text>
              
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={700}>{t('properties.pricing.clientPriceGross')}</Text>
                  <Text size="lg" fw={700}>{displayData.finalPrice.toLocaleString()} ฿</Text>
                </Group>

                {displayData.marginAmount > 0 && (
                  <>
                    <div style={{ 
                      borderTop: '2px dashed var(--mantine-color-dark-4)', 
                      marginTop: 4, 
                      marginBottom: 4 
                    }} />

                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                        <Text size="sm" c="green">{t('properties.pricing.ourMargin')}</Text>
                      </Group>
                      <Text size="md" fw={600} c="green">
                        {displayData.marginAmount.toLocaleString()} ฿ ({displayData.marginPercentage.toFixed(2)}%)
                      </Text>
                    </Group>
                    
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">{t('properties.pricing.ownerPrice')}</Text>
                      <Text size="md" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                    </Group>
                  </>
                )}
              </Stack>
            </Stack>
          </Paper>
        )}

        {!viewMode && (
          <Button
            variant="gradient"
            gradient={{ from: 'cyan', to: 'blue' }}
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            disabled={!canSave}
            loading={saving}
            fullWidth={isMobile}
            size="md"
          >
            {t('common.save')}
          </Button>
        )}
      </Stack>
    </Card>
  );
};

export default YearPriceForm;