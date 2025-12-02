// frontend/src/modules/Properties/components/SalePriceForm.tsx
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
  Select,
  Paper,
  Alert
} from '@mantine/core';
import {
  IconCoin,
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


interface SalePriceFormProps {
  propertyId: number;
  initialData?: {
    price: number | null;
    pricing_mode?: 'net' | 'gross';
    commission_type?: 'percentage' | 'fixed' | null;
    commission_value?: number | null;
    source_price?: number | null;
  };
  viewMode?: boolean;
  isOwnerMode?: boolean;
  onChange?: (data: any) => void;
}

const SalePriceForm = ({ 
  propertyId, 
  initialData,
  viewMode = false,
  isOwnerMode = false,
  onChange
}: SalePriceFormProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [price, setPrice] = useState<number | null>(null);
  const [pricingMode, setPricingMode] = useState<'net' | 'gross'>('net');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed' | null>(null);
  const [commissionValue, setCommissionValue] = useState<number | null>(null);
  const [editedGrossPrice, setEditedGrossPrice] = useState<number | undefined>(undefined);
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      const mode = initialData.pricing_mode || 'net';
      const sourcePrice = initialData.source_price;
      const finalPrice = initialData.price;
      const commType = initialData.commission_type;
      const commValue = initialData.commission_value;
      
      const loadedPrice = mode === 'net' 
        ? (sourcePrice || finalPrice)
        : finalPrice;
      
      const loadedEditedGrossPrice = mode === 'net' && finalPrice 
        ? Number(finalPrice)
        : undefined;
      
      setPrice(loadedPrice);
      setPricingMode(mode);
      setCommissionType(commType ?? null);
      setCommissionValue(commValue || null);
      setEditedGrossPrice(loadedEditedGrossPrice);
    }
  }, [initialData]);

  const calculateMarginData = (
    mode: 'net' | 'gross',
    priceValue: number,
    commType: 'percentage' | 'fixed' | null,
    commValue: number | null
  ) => {
    const numericPrice = Number(priceValue);
    
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
    if (!price || !commissionType) return null;

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
    setPricingMode(value as 'net' | 'gross');
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

  // ✅ ОБНОВЛЕНО: handleSave - с локальным сохранением при создании объекта
  const handleSave = async () => {
    // Валидация
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

    // ✅ НОВОЕ: Проверка - если объект не создан, сохраняем локально
    if (!propertyId || propertyId === 0) {
      setSaving(true);

      try {
        // Расчёт данных
        let calculated;
        
        if (pricingMode === 'net' && editedGrossPrice !== undefined && editedGrossPrice !== null) {
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

        // ✅ НОВОЕ: Формируем данные для локального сохранения
        const localData = {
          sale_price: calculated.finalPrice,
          sale_pricing_mode: pricingMode,
          sale_commission_type_new: commissionType,
          sale_commission_value_new: commissionValue,
          sale_source_price: calculated.sourcePrice,
          sale_margin_amount: calculated.marginAmount,
          sale_margin_percentage: calculated.marginPercentage
        };

        // ✅ НОВОЕ: Сохраняем локально через onChange
        if (onChange) {
          onChange(localData);
        }

        setHasChanges(false);
        
        // ✅ НОВОЕ: Уведомление о локальном сохранении (синий цвет)
        notifications.show({
          title: t('common.success'),
          message: t('properties.messages.salePriceSavedLocally', {
            defaultValue: 'Цена продажи сохранена локально. Будет применена при создании объекта.'
          }),
          color: 'blue',
          icon: <IconCheck size={16} />
        });

      } catch (error: any) {
        console.error('Local save sale price error:', error);
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

    // ✅ СУЩЕСТВУЮЩИЙ КОД: Если объект создан - сохраняем в БД
    setSaving(true);

    try {
      let calculated;
      
      if (pricingMode === 'net' && editedGrossPrice !== undefined && editedGrossPrice !== null) {
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
        sale_price: calculated.finalPrice,
        sale_pricing_mode: pricingMode,
        sale_commission_type_new: commissionType,
        sale_commission_value_new: commissionValue,
        sale_source_price: calculated.sourcePrice,
        sale_margin_amount: calculated.marginAmount,
        sale_margin_percentage: calculated.marginPercentage
      };

      if (isOwnerMode) {
        await propertyOwnersApi.updatePropertyPricing(propertyId, updateData);
      } else {
        await propertiesApi.update(propertyId, updateData);
      }
      
      setHasChanges(false);
      
      notifications.show({
        title: t('common.success'),
        message: t('properties.messages.salePriceSaved'),
        color: 'green',
        icon: <IconCheck size={16} />
      });

      if (onChange) {
        onChange(updateData);
      }
    } catch (error: any) {
      console.error('Save sale price error:', error);
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
  const hasPrice = price && price > 0 && pricingMode;
  const hasCommission = commissionType && commissionType !== null;
  const canSave = hasChanges && hasPrice && hasCommission && !saving;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group>
          <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'green', to: 'teal' }}>
            <IconCoin size={24} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">{t('properties.salePrice.title')}</Text>
            <Text size="xs" c="dimmed">{t('properties.salePrice.description')}</Text>
          </div>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{t('properties.salePrice.info')}</Text>
        </Alert>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('properties.pricing.selectMode')} <Text component="span" c="red">*</Text>
          </Text>
          <SegmentedControl
            value={pricingMode}
            onChange={handleModeChange}
            disabled={viewMode}
            data={[
              { value: 'net', label: 'NET' },
              { value: 'gross', label: 'GROSS' }
            ]}
            fullWidth={isMobile}
          />
        </Stack>

        <Stack gap="xs">
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light" color="green">
              <IconCurrencyBaht size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              {pricingMode === 'gross' 
                ? t('properties.pricing.clientPrice')
                : t('properties.pricing.sourcePrice')
              }
            </Text>
          </Group>
          <NumberInput
            value={price ?? undefined}
            onChange={handlePriceChange}
            min={0}
            step={10000}
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

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('properties.pricing.commissionType')} <Text component="span" c="red">*</Text>
          </Text>
          <Select
            placeholder={t('common.select')}
            value={commissionType}
            onChange={handleCommissionTypeChange}
            disabled={viewMode}
            data={[
              { value: 'percentage', label: t('properties.pricing.percentageCommission') },
              { value: 'fixed', label: t('properties.pricing.fixedCommission') }
            ]}
            size="md"
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

        {hasPrice && displayData && hasCommission && (
          <Paper p="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
            <Stack gap="sm">
              <Text size="sm" fw={600} c="dimmed">{t('properties.pricing.calculation')}</Text>
              
              {pricingMode === 'net' ? (
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
                      step={10000}
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
              ) : (
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
              )}
            </Stack>
          </Paper>
        )}

        {!viewMode && (
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'green' }}
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

export default SalePriceForm;