// frontend/src/modules/Properties/components/MonthlyPricing.tsx
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
  Accordion,
  Badge,
  Grid,
  ActionIcon,
  Tooltip,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Select,
  Paper
} from '@mantine/core';
import {
  IconTrash,
  IconCoin,
  IconInfoCircle,
  IconAlertTriangle,
  IconCalendar,
  IconCopy,
  IconSun,
  IconX,
  IconCheck,
  IconCurrencyBaht,
  IconCloudRain,
  IconSunFilled,
  IconArrowRight,
  IconDeviceFloppy
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { propertiesApi, MonthlyPrice } from '@/api/properties.api';
import { propertyOwnersApi } from '@/api/propertyOwners.api';

interface MonthlyPricingProps {
  propertyId: number;
  initialPricing?: MonthlyPrice[];
  viewMode?: boolean;
  isOwnerMode?: boolean;
  onChange?: (pricing: MonthlyPrice[]) => void;
}

interface MonthPriceData {
  price: number | null | undefined;
  days: number | null | undefined;
  pricing_mode?: 'net' | 'gross' | null;
  commission_type?: 'percentage' | 'fixed' | null;
  commission_value?: number | null;
  source_price?: number | null;
  edited_gross_price?: number | null;
}

const MonthlyPricing = ({ 
  propertyId, 
  initialPricing = [], 
  viewMode = false,
  isOwnerMode = false,
  onChange
}: MonthlyPricingProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [prices, setPrices] = useState<{ [key: number]: MonthPriceData }>({});
  const [changedMonths, setChangedMonths] = useState<Set<number>>(new Set());
  const [savingMonths, setSavingMonths] = useState<Set<number>>(new Set());
  const [quickFillModalOpened, setQuickFillModalOpened] = useState(false);
  const [quickFillPrice, setQuickFillPrice] = useState<number>(0);
  const [quickFillDays, setQuickFillDays] = useState<number | null>(null);
  const [viewMode_internal, setViewMode_internal] = useState<'list' | 'grid'>('list');
  
  const [quickFillPricingMode, setQuickFillPricingMode] = useState<'net' | 'gross'>('net');
  const [quickFillCommissionType, setQuickFillCommissionType] = useState<'percentage' | 'fixed' | null>(null);
  const [quickFillCommissionValue, setQuickFillCommissionValue] = useState<number | null>(null);

  const [clearMonthModalOpened, { open: openClearMonthModal, close: closeClearMonthModal }] = useDisclosure(false);
  const [clearAllModalOpened, { open: openClearAllModal, close: closeClearAllModal }] = useDisclosure(false);
  const [monthToConfirmClear, setMonthToConfirmClear] = useState<number | null>(null);
  
  const [clearingMonth, setClearingMonth] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const months = [
    { number: 1, name: t('monthlyPricing.months.january'), season: 'high', icon: IconSunFilled },
    { number: 2, name: t('monthlyPricing.months.february'), season: 'high', icon: IconSunFilled },
    { number: 3, name: t('monthlyPricing.months.march'), season: 'high', icon: IconSunFilled },
    { number: 4, name: t('monthlyPricing.months.april'), season: 'low', icon: IconSun },
    { number: 5, name: t('monthlyPricing.months.may'), season: 'low', icon: IconCloudRain },
    { number: 6, name: t('monthlyPricing.months.june'), season: 'low', icon: IconCloudRain },
    { number: 7, name: t('monthlyPricing.months.july'), season: 'low', icon: IconCloudRain },
    { number: 8, name: t('monthlyPricing.months.august'), season: 'low', icon: IconCloudRain },
    { number: 9, name: t('monthlyPricing.months.september'), season: 'low', icon: IconSun },
    { number: 10, name: t('monthlyPricing.months.october'), season: 'low', icon: IconSun },
    { number: 11, name: t('monthlyPricing.months.november'), season: 'high', icon: IconSunFilled },
    { number: 12, name: t('monthlyPricing.months.december'), season: 'high', icon: IconSunFilled }
  ];

  useEffect(() => {
    if (initialPricing && initialPricing.length > 0) {
      const newPrices: { [key: number]: MonthPriceData } = {};
      initialPricing.forEach(price => {
        const pricingMode = (price as any).pricing_mode || 'net';
        const sourcePrice = (price as any).source_price;
        const commissionType = (price as any).commission_type;
        const commissionValue = (price as any).commission_value;
        const pricePerMonth = price.price_per_month;
        
        const loadedPrice = pricingMode === 'net' 
          ? (sourcePrice || pricePerMonth)
          : pricePerMonth;
      
        const editedGrossPrice = pricingMode === 'net' && pricePerMonth 
          ? Number(pricePerMonth)
          : undefined;
      
        newPrices[price.month_number] = {
          price: loadedPrice,
          days: price.minimum_days,
          pricing_mode: pricingMode,
          commission_type: commissionType === '' ? null : commissionType,
          commission_value: commissionValue || null,
          source_price: sourcePrice || null,
          edited_gross_price: editedGrossPrice
        };
      });
      setPrices(newPrices);
    }
  }, [initialPricing]);

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

  const getDisplayData = (monthData: MonthPriceData | undefined) => {
    if (!monthData || !monthData.price || !monthData.pricing_mode) return null;
    
    const hasCommission = monthData?.commission_type && monthData?.commission_type !== null;
    if (!hasCommission) return null;

    if (monthData.pricing_mode === 'net' && monthData.edited_gross_price !== undefined && monthData.edited_gross_price !== null) {
      const sourcePrice = monthData.price;
      const finalPrice = monthData.edited_gross_price;
      const marginAmount = finalPrice - sourcePrice;
      const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
      
      return {
        finalPrice: Math.round(finalPrice),
        sourcePrice: Math.round(sourcePrice),
        marginAmount: Math.round(marginAmount),
        marginPercentage: Math.round(marginPercentage * 100) / 100
      };
    }
    
    return calculateMarginData(
      monthData.pricing_mode,
      monthData.price,
      monthData.commission_type || null,
      monthData.commission_value || null
    );
  };

  const markMonthAsChanged = (monthNumber: number) => {
    setChangedMonths(prev => new Set(prev).add(monthNumber));
  };

  // ✅ ОБНОВЛЕНО: handleSaveMonth - с локальным сохранением при создании объекта
  const handleSaveMonth = async (monthNumber: number) => {
    const monthData = prices[monthNumber];
    if (!monthData || !monthData.price || !monthData.pricing_mode) return;

    // Валидация
    if (!monthData.commission_type) {
      notifications.show({
        title: t('monthlyPricing.warning'),
        message: t('monthlyPricing.selectCommissionType'),
        color: 'orange',
        icon: <IconAlertTriangle size={16} />
      });
      return;
    }

    if (monthData.pricing_mode === 'net' && monthData.edited_gross_price) {
      if (monthData.edited_gross_price <= monthData.price) {
        notifications.show({
          title: t('monthlyPricing.warning'),
          message: t('monthlyPricing.grossMustBeHigher'),
          color: 'orange',
          icon: <IconAlertTriangle size={16} />
        });
        return;
      }
    }

    // ✅ НОВОЕ: Проверка - если объект не создан, сохраняем локально
    if (!propertyId || propertyId === 0) {
      setSavingMonths(prev => new Set(prev).add(monthNumber));

      try {
        // Расчёт данных
        let calculated;
        
        if (monthData.pricing_mode === 'net' && monthData.edited_gross_price !== undefined && monthData.edited_gross_price !== null) {
          const sourcePrice = Number(monthData.price);
          const finalPrice = Number(monthData.edited_gross_price);
          const marginAmount = finalPrice - sourcePrice;
          const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
          
          calculated = {
            finalPrice: Math.round(finalPrice),
            sourcePrice: Math.round(sourcePrice),
            marginAmount: Math.round(marginAmount),
            marginPercentage: Math.round(marginPercentage * 100) / 100
          };
        } else {
          calculated = calculateMarginData(
            monthData.pricing_mode,
            Number(monthData.price),
            monthData.commission_type || null,
            monthData.commission_value || null
          );
        }

        // Формируем данные месяца
        const monthlyPriceData = {
          month_number: monthNumber,
          price_per_month: calculated.finalPrice,
          source_price: calculated.sourcePrice,
          minimum_days: monthData.days || null,
          pricing_mode: monthData.pricing_mode,
          commission_type: monthData.commission_type,
          commission_value: monthData.commission_value || null,
          margin_amount: calculated.marginAmount,
          margin_percentage: calculated.marginPercentage
        };

        // ✅ НОВОЕ: Получаем текущий массив monthlyPricing из initialPricing
        const currentMonthlyPricing = initialPricing || [];
        
        // Обновляем или добавляем месяц
        const existingIndex = currentMonthlyPricing.findIndex(mp => mp.month_number === monthNumber);
        
        let updatedMonthlyPricing;
        if (existingIndex >= 0) {
          // Обновляем существующий месяц
          updatedMonthlyPricing = [...currentMonthlyPricing];
          updatedMonthlyPricing[existingIndex] = monthlyPriceData as any;
        } else {
          // Добавляем новый месяц
          updatedMonthlyPricing = [...currentMonthlyPricing, monthlyPriceData as any];
        }

        // ✅ НОВОЕ: Отправляем обновлённый массив через onChange
        if (onChange) {
          console.log('MonthlyPricing: Sending updated pricing to parent:', updatedMonthlyPricing);
          onChange(updatedMonthlyPricing);
        }

        // Убираем флаг изменений
        setChangedMonths(prev => {
          const newSet = new Set(prev);
          newSet.delete(monthNumber);
          return newSet;
        });

        // ✅ НОВОЕ: Уведомление о локальном сохранении
        notifications.show({
          title: t('monthlyPricing.success'),
          message: t('monthlyPricing.monthSavedLocally', { 
            month: months[monthNumber - 1].name,
            defaultValue: `${months[monthNumber - 1].name} сохранён локально. Будет применён при создании объекта.`
          }),
          color: 'blue',
          icon: <IconCheck size={16} />
        });

      } catch (error: any) {
        console.error('=== LOCAL SAVE ERROR ===', error);
        notifications.show({
          title: t('monthlyPricing.error'),
          message: t('monthlyPricing.errorSaving'),
          color: 'red',
          icon: <IconX size={16} />
        });
      } finally {
        setSavingMonths(prev => {
          const newSet = new Set(prev);
          newSet.delete(monthNumber);
          return newSet;
        });
      }
      
      return;
    }

    // ✅ СУЩЕСТВУЮЩИЙ КОД: Если объект создан - сохраняем в БД
setSavingMonths(prev => new Set(prev).add(monthNumber));

try {
  let calculated;
  
  if (monthData.pricing_mode === 'net' && monthData.edited_gross_price !== undefined && monthData.edited_gross_price !== null) {
    const sourcePrice = Number(monthData.price);
    const finalPrice = Number(monthData.edited_gross_price);
    const marginAmount = finalPrice - sourcePrice;
    const marginPercentage = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
    
    calculated = {
      finalPrice: Math.round(finalPrice),
      sourcePrice: Math.round(sourcePrice),
      marginAmount: Math.round(marginAmount),
      marginPercentage: Math.round(marginPercentage * 100) / 100
    };
  } else {
    calculated = calculateMarginData(
      monthData.pricing_mode,
      Number(monthData.price),
      monthData.commission_type || null,
      monthData.commission_value || null
    );
  }

  const monthlyPricing = [{
    month_number: monthNumber,
    price_per_month: calculated.finalPrice,
    source_price: calculated.sourcePrice,
    minimum_days: monthData.days || null,
    pricing_mode: monthData.pricing_mode,
    commission_type: monthData.commission_type,
    commission_value: monthData.commission_value || null,
    margin_amount: calculated.marginAmount,
    margin_percentage: calculated.marginPercentage
  }];

  if (isOwnerMode) {
    await propertyOwnersApi.updatePropertyMonthlyPricing(propertyId, monthlyPricing);
  } else {
    await propertiesApi.updateMonthlyPricing(propertyId, monthlyPricing);
  }
      
      setChangedMonths(prev => {
        const newSet = new Set(prev);
        newSet.delete(monthNumber);
        return newSet;
      });

      notifications.show({
        title: t('monthlyPricing.success'),
        message: t('monthlyPricing.monthSaved', { month: months[monthNumber - 1].name }),
        color: 'green',
        icon: <IconCheck size={16} />
      });

      if (onChange) {
        onChange(monthlyPricing);
      }
    } catch (error: any) {
      console.error('=== SAVE ERROR ===', error);
      notifications.show({
        title: t('monthlyPricing.error'),
        message: error.response?.data?.message || t('monthlyPricing.errorUpdating'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setSavingMonths(prev => {
        const newSet = new Set(prev);
        newSet.delete(monthNumber);
        return newSet;
      });
    }
  };

  const handlePriceChange = (monthNumber: number, field: keyof MonthPriceData, value: number | string | null) => {
    const newPrices = {
      ...prices,
      [monthNumber]: {
        ...prices[monthNumber],
        [field]: value,
        ...(field === 'price' || field === 'commission_value' || field === 'commission_type' 
          ? { edited_gross_price: undefined } 
          : {})
      }
    };
    setPrices(newPrices);
    markMonthAsChanged(monthNumber);
  };

  const handleGrossPriceChange = (monthNumber: number, newGrossPrice: number | string) => {
    const monthData = prices[monthNumber];
    if (!monthData || !monthData.price) return;

    const grossValue = typeof newGrossPrice === 'number' ? newGrossPrice : parseFloat(newGrossPrice as string) || 0;
    const sourcePrice = monthData.price;
    
    const marginAmount = grossValue - sourcePrice;
    
    let newCommissionValue: number | null = null;
    
    if (monthData.commission_type === 'percentage') {
      newCommissionValue = sourcePrice > 0 ? (marginAmount / sourcePrice) * 100 : 0;
    } else if (monthData.commission_type === 'fixed') {
      newCommissionValue = marginAmount;
    }

    const newPrices = {
      ...prices,
      [monthNumber]: {
        ...monthData,
        commission_value: newCommissionValue,
        edited_gross_price: grossValue
      }
    };
    
    setPrices(newPrices);
    markMonthAsChanged(monthNumber);
  };

  const handleClearMonth = (monthNumber: number) => {
    setMonthToConfirmClear(monthNumber);
    openClearMonthModal();
  };

  const confirmClearMonth = async () => {
    if (monthToConfirmClear === null) return;

    if (!propertyId || propertyId === 0) {
      const newPrices = { ...prices };
      delete newPrices[monthToConfirmClear];
      setPrices(newPrices);
      
      setChangedMonths(prev => {
        const newSet = new Set(prev);
        newSet.delete(monthToConfirmClear);
        return newSet;
      });

      // ✅ НОВОЕ: Обновляем массив monthlyPricing при локальном удалении
      if (onChange) {
        const updatedMonthlyPricing = (initialPricing || []).filter(
          mp => mp.month_number !== monthToConfirmClear
        );
        onChange(updatedMonthlyPricing);
      }

      notifications.show({
        title: t('monthlyPricing.success'),
        message: t('monthlyPricing.monthCleared', { month: months[monthToConfirmClear - 1].name }),
        color: 'blue',
        icon: <IconCheck size={16} />
      });

      closeClearMonthModal();
      setMonthToConfirmClear(null);
      return;
    }

    setClearingMonth(true);

    try {
      const monthlyPricing = [{
        month_number: monthToConfirmClear,
        price_per_month: null,
        source_price: null,
        minimum_days: null,
        pricing_mode: null,
        commission_type: null,
        commission_value: null,
        margin_amount: null,
        margin_percentage: null
      }];

        if (isOwnerMode) {
        await propertyOwnersApi.updatePropertyMonthlyPricing(propertyId, monthlyPricing as any);
      } else {
        await propertiesApi.updateMonthlyPricing(propertyId, monthlyPricing as any);
      }
    
      const newPrices = { ...prices };
      delete newPrices[monthToConfirmClear];
      setPrices(newPrices);
      
      setChangedMonths(prev => {
        const newSet = new Set(prev);
        newSet.delete(monthToConfirmClear);
        return newSet;
      });

      notifications.show({
        title: t('monthlyPricing.success'),
        message: t('monthlyPricing.monthCleared', { month: months[monthToConfirmClear - 1].name }),
        color: 'blue',
        icon: <IconCheck size={16} />
      });

      if (onChange) {
        onChange(monthlyPricing as any);
      }

      closeClearMonthModal();
      setMonthToConfirmClear(null);
    } catch (error: any) {
      console.error('=== CLEAR MONTH ERROR ===', error);
      notifications.show({
        title: t('monthlyPricing.error'),
        message: error.response?.data?.message || t('monthlyPricing.errorClearing'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setClearingMonth(false);
    }
  };

  const handleClearAll = () => {
    openClearAllModal();
  };

  const confirmClearAll = async () => {
    if (!propertyId || propertyId === 0) {
      setPrices({});
      setChangedMonths(new Set());
      
      // ✅ НОВОЕ: Очищаем массив monthlyPricing локально
      if (onChange) {
        onChange([]);
      }
      
      notifications.show({
        title: t('monthlyPricing.success'),
        message: t('monthlyPricing.allPricesCleared'),
        color: 'blue',
        icon: <IconCheck size={16} />
      });

      closeClearAllModal();
      return;
    }

    setClearingAll(true);

    try {
      const monthlyPricing = Array.from({ length: 12 }, (_, i) => ({
        month_number: i + 1,
        price_per_month: null,
        source_price: null,
        minimum_days: null,
        pricing_mode: null,
        commission_type: null,
        commission_value: null,
        margin_amount: null,
        margin_percentage: null
      }));

        if (isOwnerMode) {
        await propertyOwnersApi.updatePropertyMonthlyPricing(propertyId, monthlyPricing as any);
      } else {
        await propertiesApi.updateMonthlyPricing(propertyId, monthlyPricing as any);
      }

      setPrices({});
      setChangedMonths(new Set());
      
      notifications.show({
        title: t('monthlyPricing.success'),
        message: t('monthlyPricing.allPricesCleared'),
        color: 'blue',
        icon: <IconCheck size={16} />
      });

      if (onChange) {
        onChange(monthlyPricing as any);
      }

      closeClearAllModal();
    } catch (error: any) {
      console.error('=== CLEAR ALL ERROR ===', error);
      notifications.show({
        title: t('monthlyPricing.error'),
        message: error.response?.data?.message || t('monthlyPricing.errorClearingAll'),
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setClearingAll(false);
    }
  };

  const handleQuickFill = () => {
    if (!quickFillPrice || quickFillPrice <= 0) {
      notifications.show({
        title: t('monthlyPricing.warning'),
        message: t('monthlyPricing.enterValidPrice'),
        color: 'orange',
        icon: <IconAlertTriangle size={16} />
      });
      return;
    }

    const newPrices: typeof prices = {};
    for (let i = 1; i <= 12; i++) {
      newPrices[i] = {
        price: quickFillPrice,
        days: quickFillDays,
        pricing_mode: quickFillPricingMode,
        commission_type: quickFillCommissionType,
        commission_value: quickFillCommissionValue
      };
    }
    
    setPrices(newPrices);
    setChangedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    setQuickFillModalOpened(false);
    
    notifications.show({
      title: t('monthlyPricing.success'),
      message: t('monthlyPricing.pricesApplied'),
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  const getFilledMonthsCount = () => {
    return Object.keys(prices).filter(key => {
      const monthData = prices[parseInt(key)];
      return monthData?.price && monthData.price > 0 && monthData.pricing_mode;
    }).length;
  };

  const renderMonthAccordionItem = (month: typeof months[0]) => {
    const monthData = prices[month.number];
    const hasPrice = monthData?.price && monthData.price > 0 && monthData.pricing_mode;
    const SeasonIcon = month.icon;
    const isChanged = changedMonths.has(month.number);
    const isSaving = savingMonths.has(month.number);
    
    const hasCommission = monthData?.commission_type && monthData?.commission_type !== null;
    const canSave = hasPrice && hasCommission && isChanged;

    const displayData = getDisplayData(monthData);

    return (
      <Accordion.Item key={month.number} value={`month-${month.number}`}>
        <Accordion.Control
          icon={
            <ThemeIcon
              size="lg"
              radius="md"
              variant="light"
              color={month.season === 'high' ? 'blue' : 'orange'}
            >
              <SeasonIcon size={20} />
            </ThemeIcon>
          }
        >
          <Group justify="space-between" wrap="nowrap" style={{ flex: 1, marginRight: 16 }}>
            <div>
              <Text fw={500} size="sm">
                {month.name}
              </Text>
              {hasPrice && displayData && (
                <Text size="xs" c="dimmed">
                  {displayData.finalPrice.toLocaleString('ru-RU')} THB
                  {monthData.days && ` • ${monthData.days} ${t('monthlyPricing.daysMin')}`}
                  {displayData.marginAmount > 0 && ` • ${t('monthlyPricing.margin')}: ${displayData.marginAmount.toLocaleString()} ฿`}
                </Text>
              )}
            </div>
            
            <Group gap="xs">
              {hasPrice && displayData ? (
                <Badge size="lg" variant="filled" color="green">
                  {displayData.finalPrice.toLocaleString('ru-RU')} ฿
                </Badge>
              ) : (
                <Badge size="sm" variant="light" color="gray">
                  {t('monthlyPricing.notSet')}
                </Badge>
              )}
            </Group>
          </Group>
        </Accordion.Control>

        <Accordion.Panel>
          <Stack gap="md">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {t('monthlyPricing.selectPricingMode')} <Text component="span" c="red">*</Text>
              </Text>
              <SegmentedControl
                value={monthData?.pricing_mode || ''}
                onChange={(value) => handlePriceChange(month.number, 'pricing_mode', value as 'net' | 'gross')}
                disabled={viewMode}
                data={[
                  { value: 'net', label: 'NET' },
                  { value: 'gross', label: 'GROSS' }
                ]}
                fullWidth={isMobile}
              />
            </Stack>

            {monthData?.pricing_mode && (
              <>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, xs: 6 }}>
                    <Stack gap="xs">
                      <Group gap="xs">
                        <ThemeIcon size="sm" radius="md" variant="light" color="green">
                          <IconCurrencyBaht size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>
                          {monthData.pricing_mode === 'gross' 
                            ? t('monthlyPricing.clientPrice')
                            : t('monthlyPricing.pricePerMonth')
                          }
                        </Text>
                      </Group>
                      <NumberInput
                        value={monthData?.price ?? undefined}
                        onChange={(value) => handlePriceChange(month.number, 'price', value)}
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
                        styles={{
                          input: {
                            fontSize: '16px',
                            background: viewMode ? 'var(--mantine-color-dark-7)' : undefined
                          }
                        }}
                      />
                    </Stack>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, xs: 6 }}>
                    <Stack gap="xs">
                      <Group gap="xs">
                        <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                          <IconCalendar size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>
                          {t('monthlyPricing.minimumDays')}
                        </Text>
                      </Group>
                      <NumberInput
                        value={monthData?.days ?? undefined}
                        onChange={(value) => handlePriceChange(month.number, 'days', value)}
                        min={1}
                        disabled={viewMode}
                        placeholder={t('monthlyPricing.notSpecified')}
                        leftSection={<IconCalendar size={16} />}
                        styles={{
                          input: {
                            fontSize: '16px',
                            background: viewMode ? 'var(--mantine-color-dark-7)' : undefined
                          }
                        }}
                      />
                    </Stack>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, xs: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        {t('monthlyPricing.commissionType')} <Text component="span" c="red">*</Text>
                      </Text>
                      <Select
                        placeholder={t('common.select')}
                        value={monthData?.commission_type || null}
                        onChange={(value) => handlePriceChange(month.number, 'commission_type', value as 'percentage' | 'fixed' | null)}
                        disabled={viewMode}
                        data={[
                          { value: 'percentage', label: t('monthlyPricing.percentageCommission') },
                          { value: 'fixed', label: t('monthlyPricing.fixedCommission') }
                        ]}
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Stack>
                  </Grid.Col>

                  {monthData?.commission_type && (
                    <Grid.Col span={{ base: 12, xs: 6 }}>
                      <NumberInput
                        label={monthData.commission_type === 'percentage' ? t('monthlyPricing.commissionPercent') : t('monthlyPricing.commissionAmount')}
                        value={monthData.commission_value ?? undefined}
                        onChange={(value) => handlePriceChange(month.number, 'commission_value', value)}
                        min={0}
                        suffix={monthData.commission_type === 'percentage' ? '%' : ' ฿'}
                        disabled={viewMode}
                        placeholder="0"
                        styles={{ input: { fontSize: '16px' } }}
                      />
                    </Grid.Col>
                  )}
                </Grid>

                {hasPrice && displayData && hasCommission && (
                  <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
                    <Stack gap="sm">
                      <Text size="sm" fw={600} c="dimmed">{t('monthlyPricing.calculation')}</Text>
                      
                      {monthData.pricing_mode === 'net' ? (
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">{t('monthlyPricing.sourcePriceNet')}</Text>
                            <Text size="md" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                          </Group>
                          
                          {displayData.marginAmount > 0 && (
                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconArrowRight size={16} style={{ opacity: 0.5 }} />
                                <Text size="sm" c="green">{t('monthlyPricing.commissionAdd')}</Text>
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
                            <Text size="xs" c="dimmed">{t('monthlyPricing.finalPriceClient')}</Text>
                            <NumberInput
                              value={monthData.edited_gross_price !== undefined && monthData.edited_gross_price !== null ? monthData.edited_gross_price : displayData.finalPrice}
                              onChange={(value) => handleGrossPriceChange(month.number, value)}
                              min={0}
                              step={1000}
                              thousandSeparator=" "
                              disabled={viewMode}
                              leftSection={<IconCurrencyBaht size={16} />}
                              placeholder="0"
                              styles={{
                                input: {
                                  fontSize: '18px',
                                  fontWeight: 700,
                                  color: 'var(--mantine-color-green-4)',
                                  background: 'var(--mantine-color-dark-7)'
                                }
                              }}
                            />
                            {!isMobile && (
                              <Text size="xs" c="dimmed" ta="center">
                                {t('monthlyPricing.editGrossHint')}
                              </Text>
                            )}
                          </Stack>
                        </Stack>
                      ) : (
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" fw={700}>{t('monthlyPricing.clientPriceGross')}</Text>
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
                                  <Text size="sm" c="green">{t('monthlyPricing.ourMargin')}</Text>
                                </Group>
                                <Text size="md" fw={600} c="green">
                                  {displayData.marginAmount.toLocaleString()} ฿ ({displayData.marginPercentage.toFixed(2)}%)
                                </Text>
                              </Group>
                              
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">{t('monthlyPricing.ownerPrice')}</Text>
                                <Text size="md" fw={600}>{displayData.sourcePrice.toLocaleString()} ฿</Text>
                              </Group>
                            </>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                )}

                {!viewMode && hasPrice && (
                  <Group gap="xs">
                    <Button
                      variant="gradient"
                      gradient={{ from: 'teal', to: 'green' }}
                      leftSection={<IconDeviceFloppy size={16} />}
                      onClick={() => handleSaveMonth(month.number)}
                      disabled={!canSave || isSaving}
                      loading={isSaving}
                      fullWidth={isMobile}
                      style={{ flex: isMobile ? undefined : 1 }}
                    >
                      {t('common.save')}
                    </Button>
                    
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => handleClearMonth(month.number)}
                      disabled={isSaving}
                      style={{ flex: isMobile ? 1 : undefined }}
                    >
                      {isMobile ? '' : t('monthlyPricing.clearMonth')}
                    </Button>
                  </Group>
                )}
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    );
  };

  const renderGridView = () => {
    return (
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="md">
        {months.map(month => {
          const monthData = prices[month.number];
          const hasPrice = monthData?.price && monthData.price > 0 && monthData.pricing_mode;
          const SeasonIcon = month.icon;

          const displayData = getDisplayData(monthData);

          return (
            <Card
              key={month.number}
              shadow="sm"
              padding="md"
              radius="md"
              withBorder
              style={{
                background: hasPrice 
                  ? 'var(--mantine-color-dark-6)' 
                  : 'var(--mantine-color-dark-7)',
                borderColor: hasPrice 
                  ? month.season === 'high' ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-orange-5)'
                  : undefined
              }}
            >
              <Stack gap="md">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs">
                    <ThemeIcon
                      size="md"
                      radius="md"
                      variant="light"
                      color={month.season === 'high' ? 'blue' : 'orange'}
                    >
                      <SeasonIcon size={16} />
                    </ThemeIcon>
                    <Text size="sm" fw={500}>
                      {month.name}
                    </Text>
                  </Group>

                  {!viewMode && hasPrice && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      onClick={() => handleClearMonth(month.number)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>

                {monthData?.pricing_mode && (
                  <>
                    <NumberInput
                      value={monthData?.price ?? undefined}
                      onChange={(value) => handlePriceChange(month.number, 'price', value)}
                      min={0}
                      step={1000}
                      thousandSeparator=" "
                      disabled={viewMode}
                      leftSection={<IconCurrencyBaht size={14} />}
                      placeholder={t('monthlyPricing.pricePerMonth')}
                      size="xs"
                      styles={{
                        input: {
                          fontSize: '14px',
                          background: viewMode ? 'var(--mantine-color-dark-8)' : undefined
                        }
                      }}
                    />

                    <NumberInput
                      value={monthData?.days ?? undefined}
                      onChange={(value) => handlePriceChange(month.number, 'days', value)}
                      min={1}
                      disabled={viewMode}
                      placeholder={t('monthlyPricing.minimumDays')}
                      leftSection={<IconCalendar size={14} />}
                      size="xs"
                      styles={{
                        input: {
                          fontSize: '14px',
                          background: viewMode ? 'var(--mantine-color-dark-8)' : undefined
                        }
                      }}
                    />

                    {displayData && displayData.marginAmount > 0 && (
                      <Badge size="sm" color="green" variant="light">
                        {t('monthlyPricing.margin')}: +{displayData.marginAmount.toLocaleString()} ฿
                      </Badge>
                    )}
                  </>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    );
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md">
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'yellow', to: 'orange' }}>
              <IconCoin size={24} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl">{t('monthlyPricing.title')}</Text>
              <Text size="xs" c="dimmed">
                {t('monthlyPricing.filledMonths', { count: getFilledMonthsCount() })}
              </Text>
            </div>
          </Group>

          {!viewMode && (
            <Group gap="xs">
              {isMobile ? (
                <>
                  <Tooltip label={t('monthlyPricing.quickFill')}>
                    <ActionIcon
                      variant="light"
                      color="violet"
                      size="lg"
                      onClick={() => setQuickFillModalOpened(true)}
                    >
                      <IconCopy size={18} />
                    </ActionIcon>
                  </Tooltip>
                  {getFilledMonthsCount() > 0 && (
                    <Tooltip label={t('monthlyPricing.clearAll')}>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
                        onClick={handleClearAll}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="light"
                    color="violet"
                    leftSection={<IconCopy size={18} />}
                    onClick={() => setQuickFillModalOpened(true)}
                  >
                    {t('monthlyPricing.quickFill')}
                  </Button>
                  {getFilledMonthsCount() > 0 && (
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={18} />}
                      onClick={handleClearAll}
                    >
                      {t('monthlyPricing.clearAll')}
                    </Button>
                  )}
                </>
              )}
            </Group>
          )}
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{t('monthlyPricing.saveManuallyInfo')}</Text>
        </Alert>

        {!isMobile && (
          <Group justify="center">
            <SegmentedControl
              value={viewMode_internal}
              onChange={(value) => setViewMode_internal(value as 'list' | 'grid')}
              data={[
                { label: t('monthlyPricing.listView'), value: 'list' },
                { label: t('monthlyPricing.gridView'), value: 'grid' }
              ]}
            />
          </Group>
        )}

        {viewMode_internal === 'list' || isMobile ? (
          <Accordion variant="separated" radius="md">
            {months.map(renderMonthAccordionItem)}
          </Accordion>
        ) : (
          renderGridView()
        )}
      </Stack>

      <Modal
        opened={quickFillModalOpened}
        onClose={() => setQuickFillModalOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
              <IconCopy size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">{t('monthlyPricing.quickFill')}</Text>
          </Group>
        }
        centered
        size={isMobile ? 'full' : 'md'}
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="sm">{t('monthlyPricing.quickFillDescription')}</Text>
          </Alert>

          <SegmentedControl
            value={quickFillPricingMode}
            onChange={(value) => setQuickFillPricingMode(value as 'net' | 'gross')}
            data={[
              { value: 'net', label: 'NET' },
              { value: 'gross', label: 'GROSS' }
            ]}
            fullWidth
          />

          <NumberInput
            label={t('monthlyPricing.pricePerMonth')}
            value={quickFillPrice}
            onChange={(value) => setQuickFillPrice(typeof value === 'number' ? value : 0)}
            min={0}
            step={1000}
            thousandSeparator=" "
            leftSection={<IconCurrencyBaht size={16} />}
            rightSection={
              <Text size="xs" c="dimmed" style={{ marginRight: 8 }}>
                THB
              </Text>
            }
            styles={{ input: { fontSize: '16px' } }}
          />

          <NumberInput
            label={t('monthlyPricing.minimumDays')}
            value={quickFillDays ?? undefined}
            onChange={(value) => setQuickFillDays(typeof value === 'number' ? value : null)}
            min={1}
            placeholder={t('monthlyPricing.notSpecified')}
            leftSection={<IconCalendar size={16} />}
            styles={{ input: { fontSize: '16px' } }}
          />

          <Select
            label={<Text size="sm"><Text component="span" c="red">* </Text>{t('monthlyPricing.commissionType')}</Text>}
            placeholder={t('common.select')}
            value={quickFillCommissionType || null}
            onChange={(value) => setQuickFillCommissionType(value as 'percentage' | 'fixed' | null)}
            data={[
              { value: 'percentage', label: t('monthlyPricing.percentageCommission') },
              { value: 'fixed', label: t('monthlyPricing.fixedCommission') }
            ]}
            styles={{ input: { fontSize: '16px' } }}
          />

          {quickFillCommissionType && (
            <NumberInput
              label={quickFillCommissionType === 'percentage' ? t('monthlyPricing.commissionPercent') : t('monthlyPricing.commissionAmount')}
              value={quickFillCommissionValue ?? undefined}
              onChange={(value) => setQuickFillCommissionValue(typeof value === 'number' ? value : null)}
              min={0}
              suffix={quickFillCommissionType === 'percentage' ? '%' : ' ฿'}
              placeholder="0"
              styles={{ input: { fontSize: '16px' } }}
            />
          )}

          <Group gap="xs" grow>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconX size={18} />}
              onClick={() => setQuickFillModalOpened(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'violet', to: 'grape' }}
              leftSection={<IconCheck size={18} />}
              onClick={handleQuickFill}
            >
              {t('monthlyPricing.apply')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={clearMonthModalOpened}
        onClose={closeClearMonthModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" color="red" variant="light">
              <IconTrash size={20} />
            </ThemeIcon>
            <Text fw={600}>
              {monthToConfirmClear !== null && t('monthlyPricing.clearMonthConfirm', { month: months[monthToConfirmClear - 1]?.name })}
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('monthlyPricing.clearMonthDescription')}</Text>
          
          <Group gap="xs" grow>
            <Button
              variant="light"
              color="gray"
              onClick={closeClearMonthModal}
              disabled={clearingMonth}
            >
              {t('common.no')}
            </Button>
            <Button
              color="red"
              onClick={confirmClearMonth}
              loading={clearingMonth}
            >
              {t('common.yes')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={clearAllModalOpened}
        onClose={closeClearAllModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" color="red" variant="light">
              <IconTrash size={20} />
            </ThemeIcon>
            <Text fw={600}>{t('monthlyPricing.clearAllConfirm')}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('monthlyPricing.clearAllDescription')}</Text>
          
          <Group gap="xs" grow>
            <Button
              variant="light"
              color="gray"
              onClick={closeClearAllModal}
              disabled={clearingAll}
            >
              {t('common.cancel')}
            </Button>
            <Button
              color="red"
              onClick={confirmClearAll}
              loading={clearingAll}
            >
              {t('common.clear')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
};

export default MonthlyPricing;