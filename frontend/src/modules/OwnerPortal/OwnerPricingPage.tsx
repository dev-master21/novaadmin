// frontend/src/modules/OwnerPortal/OwnerPricingPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  Button,
  Stack,
  Group,
  Loader,
  Title,
  Breadcrumbs,
  Anchor,
  ThemeIcon,
  Paper,
  Box,
  Center,
  Text,
  Alert,
  Badge
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconHome,
  IconCurrencyDollar,
  IconCheck,
  IconX,
  IconDeviceFloppy,
  IconInfoCircle,
  IconLock,
  IconLockOpen
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { propertyOwnersApi } from '@/api/propertyOwners.api';
import { MonthlyPrice } from '@/api/properties.api';
import SalePriceForm from '@/modules/Properties/components/SalePriceForm';
import YearPriceForm from '@/modules/Properties/components/YearPriceForm';
import SeasonalPricing from '@/modules/Properties/components/SeasonalPricing';
import MonthlyPricing from '@/modules/Properties/components/MonthlyPricing';
import DepositForm from '@/modules/Properties/components/DepositForm';
import UtilitiesForm from '@/modules/Properties/components/UtilitiesForm';
import { useOwnerStore } from '@/store/ownerStore';

const OwnerPricingPage = () => {
  const { t } = useTranslation();
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState<any>(null);
  const [depositType, setDepositType] = useState<'one_month' | 'two_months' | 'custom'>('one_month');
  const [depositAmount, setDepositAmount] = useState<number>(0);

  // Получаем разрешение на редактирование цен из store
  const canEditPricing = useOwnerStore(state => state.canEditPricing());

  const form = useForm({
    initialValues: {
      deal_type: 'sale',
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
      seasonalPricing: [] as any[],
      
      deposit_type: '',
      deposit_amount: null as number | null,
      electricity_rate: null as number | null,
      water_rate: null as number | null
    }
  });

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    setLoading(true);
    try {
      const { data } = await propertyOwnersApi.getProperty(Number(propertyId));
      
      if (data.success) {
        const prop = data.data;
        setProperty(prop);

        form.setValues({
          deal_type: prop.deal_type,
          sale_price: prop.sale_price,
          sale_pricing_mode: prop.sale_pricing_mode || 'net',
          sale_commission_type_new: prop.sale_commission_type_new || null,
          sale_commission_value_new: prop.sale_commission_value_new || null,
          sale_source_price: prop.sale_source_price || null,
          sale_margin_amount: prop.sale_margin_amount || null,
          sale_margin_percentage: prop.sale_margin_percentage || null,
          
          year_price: prop.year_price,
          year_pricing_mode: prop.year_pricing_mode || 'net',
          year_commission_type: prop.year_commission_type || null,
          year_commission_value: prop.year_commission_value || null,
          year_source_price: prop.year_source_price || null,
          year_margin_amount: prop.year_margin_amount || null,
          year_margin_percentage: prop.year_margin_percentage || null,
          
          monthlyPricing: prop.monthly_pricing || [],
          seasonalPricing: prop.seasonal_pricing || [],
          
          deposit_type: prop.deposit_type || '',
          deposit_amount: prop.deposit_amount,
          electricity_rate: prop.electricity_rate,
          water_rate: prop.water_rate
        });

        if (prop.deposit_type) {
          setDepositType(prop.deposit_type as 'one_month' | 'two_months' | 'custom');
        }
        if (prop.deposit_amount) {
          setDepositAmount(prop.deposit_amount);
        }
      }
    } catch (error: any) {
      notifications.show({
        title: t('ownerPortal.errorLoadingProperty'),
        message: '',
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/owner/dashboard');
    } finally {
      setLoading(false);
    }
  };

const handleSave = async () => {
  // Блокируем сохранение если нет прав
  if (!canEditPricing) {
    notifications.show({
      title: t('ownerPortal.accessDenied'),
      message: t('ownerPortal.noEditPricingPermission'),
      color: 'red',
      icon: <IconLock size={18} />
    });
    return;
  }

  setSaving(true);
  try {
    const values = form.values;

    // Сохраняем основные цены через owner API
    await propertyOwnersApi.updatePropertyPricing(Number(propertyId), {
      sale_price: values.sale_price,
      sale_pricing_mode: values.sale_pricing_mode,
      sale_commission_type_new: values.sale_commission_type_new,
      sale_commission_value_new: values.sale_commission_value_new,
      sale_source_price: values.sale_source_price,
      sale_margin_amount: values.sale_margin_amount,
      sale_margin_percentage: values.sale_margin_percentage,

      year_price: values.year_price,
      year_pricing_mode: values.year_pricing_mode,
      year_commission_type: values.year_commission_type,
      year_commission_value: values.year_commission_value,
      year_source_price: values.year_source_price,
      year_margin_amount: values.year_margin_amount,
      year_margin_percentage: values.year_margin_percentage,
      
      deposit_type: depositType,
      deposit_amount: depositType === 'custom' ? depositAmount : null,
      electricity_rate: values.electricity_rate,
      water_rate: values.water_rate,
      
      seasonalPricing: values.seasonalPricing || []
    });

    // ✅ ИСПРАВЛЕНО: Проверяем формат API и отправляем правильно
    if (values.monthlyPricing && values.monthlyPricing.length > 0) {
      await propertyOwnersApi.updatePropertyMonthlyPricing(
        Number(propertyId), 
        values.monthlyPricing
      );
    }

    notifications.show({
      title: t('common.success'),
      message: t('ownerPortal.pricesSaved'),
      color: 'green',
      icon: <IconCheck size={18} />
    });

    // Перезагружаем данные
    await loadProperty();
  } catch (error: any) {
    console.error('Save pricing error:', error);
    notifications.show({
      title: t('errors.generic'),
      message: error.response?.data?.message || t('ownerPortal.errorSavingPrices'),
      color: 'red',
      icon: <IconX size={18} />
    });
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh' }}>
        <Paper
          shadow="md"
          p="md"
          radius={0}
          style={{
            background: 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}
        >
          <Container size="xl">
            <Group gap="sm">
              <ThemeIcon
                size={isMobile ? 'lg' : 'xl'}
                radius="md"
                variant="white"
                color="violet"
              >
                <IconHome size={isMobile ? 20 : 24} stroke={1.5} />
              </ThemeIcon>
              {!isMobile && (
                <Stack gap={0}>
                  <Text size="lg" fw={700} c="white">
                    NOVA ESTATE
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)">
                    {t('ownerPortal.portal')}
                  </Text>
                </Stack>
              )}
            </Group>
          </Container>
        </Paper>

        <Container size="xl" py="xl">
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="xl" variant="dots" />
                <Text c="dimmed">{t('common.loading')}</Text>
              </Stack>
            </Center>
          </Card>
        </Container>
      </Box>
    );
  }

  const dealType = form.values.deal_type || 'sale';

  const breadcrumbItems = [
    { title: t('ownerPortal.dashboard'), href: '/owner/dashboard' },
    { title: property?.property_name || property?.property_number, href: '#' },
    { title: t('ownerPortal.pricing'), href: '#' }
  ].map((item, index) => (
    <Anchor
      key={index}
      href={item.href}
      onClick={(e) => {
        if (item.href === '/owner/dashboard') {
          e.preventDefault();
          navigate('/owner/dashboard');
        }
      }}
      c={index === 2 ? 'dimmed' : 'blue'}
      style={{ cursor: index === 2 ? 'default' : 'pointer' }}
    >
      {index === 0 && (
        <Group gap={4}>
          <IconHome size={14} />
          <span>{item.title}</span>
        </Group>
      )}
      {index !== 0 && item.title}
    </Anchor>
  ));

  return (
    <Box style={{ minHeight: '100vh' }}>
      {/* Header */}
      <Paper
        shadow="md"
        p="md"
        radius={0}
        style={{
          background: 'linear-gradient(135deg, #7950F2 0%, #9775FA 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <Container size="xl">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon
                size={isMobile ? 'lg' : 'xl'}
                radius="md"
                variant="white"
                color="violet"
              >
                <IconHome size={isMobile ? 20 : 24} stroke={1.5} />
              </ThemeIcon>
              {!isMobile && (
                <Stack gap={0}>
                  <Text size="lg" fw={700} c="white">
                    NOVA ESTATE
                  </Text>
                  <Text size="xs" c="rgba(255, 255, 255, 0.8)">
                    {t('ownerPortal.portal')}
                  </Text>
                </Stack>
              )}
            </Group>

            <Button
              variant="white"
              color="violet"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => navigate('/owner/dashboard')}
              size={isMobile ? 'sm' : 'md'}
            >
              {!isMobile && t('common.back')}
            </Button>
          </Group>
        </Container>
      </Paper>

      {/* Content */}
      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs separator="›">
            {breadcrumbItems}
          </Breadcrumbs>

          {/* Title Card */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" wrap="wrap">
              <Group gap="md" wrap="nowrap">
                <ThemeIcon
                  size="xl"
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                >
                  <IconCurrencyDollar size={28} stroke={1.5} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Group gap="sm">
                    <Title order={isMobile ? 4 : 3}>
                      {t('ownerPortal.managePricing')}
                    </Title>
                    <Badge
                      size="lg"
                      variant="light"
                      color={canEditPricing ? 'green' : 'gray'}
                      leftSection={canEditPricing ? <IconLockOpen size={14} /> : <IconLock size={14} />}
                    >
                      {canEditPricing ? t('ownerPortal.canEdit') : t('ownerPortal.viewOnly')}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {property?.property_name || property?.property_number}
                  </Text>
                </Stack>
              </Group>

              {!isMobile && canEditPricing && (
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                  size="lg"
                  leftSection={<IconDeviceFloppy size={20} />}
                  onClick={handleSave}
                  loading={saving}
                >
                  {t('common.save')}
                </Button>
              )}
            </Group>
          </Card>

          {/* Alert если нет прав на редактирование */}
          {!canEditPricing && (
            <Alert
              icon={<IconInfoCircle size={18} />}
              title={t('ownerPortal.readOnlyMode')}
              color="blue"
              variant="light"
            >
              <Text size="sm">
                {t('ownerPortal.pricingReadOnlyDescription')}
              </Text>
            </Alert>
          )}

          {/* Alert Info */}
          {canEditPricing && (
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Text size="sm">
                {t('ownerPortal.pricingPageDescription') || 'Здесь вы можете управлять ценами на ваш объект недвижимости'}
              </Text>
            </Alert>
          )}

          {/* Sale Price - viewMode на основе разрешений */}
          {(dealType === 'sale' || dealType === 'both') && (
            <SalePriceForm
              propertyId={Number(propertyId) || 0}
              initialData={{
                price: property.sale_price,
                pricing_mode: property.sale_pricing_mode || 'net',
                commission_type: property.sale_commission_type_new || null,
                commission_value: property.sale_commission_value_new || null,
                source_price: property.sale_source_price || null
              }}
              viewMode={!canEditPricing}
              isOwnerMode={true}
              onChange={(data) => {
                form.setFieldValue('sale_price', data.sale_price);
                form.setFieldValue('sale_pricing_mode', data.sale_pricing_mode);
                form.setFieldValue('sale_commission_type_new', data.sale_commission_type_new);
                form.setFieldValue('sale_commission_value_new', data.sale_commission_value_new);
                form.setFieldValue('sale_source_price', data.sale_source_price);
                form.setFieldValue('sale_margin_amount', data.sale_margin_amount);
                form.setFieldValue('sale_margin_percentage', data.sale_margin_percentage);
              }}
            />
          )}

          {/* Rent Prices - viewMode на основе разрешений */}
          {(dealType === 'rent' || dealType === 'both') && (
            <>
              <YearPriceForm
                propertyId={Number(propertyId) || 0}
                initialData={{
                  price: property.year_price,
                  pricing_mode: property.year_pricing_mode || 'net',
                  commission_type: property.year_commission_type || null,
                  commission_value: property.year_commission_value || null,
                  source_price: property.year_source_price || null
                }}
                viewMode={!canEditPricing}
                isOwnerMode={true}
                onChange={(data) => {
                  form.setFieldValue('year_price', data.year_price);
                  form.setFieldValue('year_pricing_mode', data.year_pricing_mode);
                  form.setFieldValue('year_commission_type', data.year_commission_type);
                  form.setFieldValue('year_commission_value', data.year_commission_value);
                  form.setFieldValue('year_source_price', data.year_source_price);
                  form.setFieldValue('year_margin_amount', data.year_margin_amount);
                  form.setFieldValue('year_margin_percentage', data.year_margin_percentage);
                }}
              />

              <MonthlyPricing
                propertyId={Number(propertyId) || 0}
                initialPricing={property?.monthly_pricing || []}
                viewMode={!canEditPricing}
                isOwnerMode={true}
                onChange={(monthlyPricing) => {
                  form.setFieldValue('monthlyPricing', monthlyPricing);
                }}
              />

              <SeasonalPricing 
                viewMode={!canEditPricing} 
                form={form}
                propertyId={Number(propertyId)}
                isOwnerMode={true}
                autoSave={true}
              />

              <DepositForm
                dealType="rent"
                viewMode={!canEditPricing}
                depositType={depositType}
                depositAmount={depositAmount}
                onDepositTypeChange={setDepositType}
                onDepositAmountChange={setDepositAmount}
              />

              {/* ✅ ИСПРАВЛЕНО: Добавлены props для UtilitiesForm */}
              <UtilitiesForm 
                viewMode={!canEditPricing}
                electricityRate={form.values.electricity_rate}
                waterRate={form.values.water_rate}
                onElectricityRateChange={(value) => form.setFieldValue('electricity_rate', value)}
                onWaterRateChange={(value) => form.setFieldValue('water_rate', value)}
              />
            </>
          )}

          {/* Save Button (Mobile) - показывается только если есть права */}
          {isMobile && canEditPricing && (
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                position: 'sticky',
                bottom: 0,
                zIndex: 10
              }}
            >
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  onClick={() => navigate('/owner/dashboard')}
                  size="md"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                  leftSection={<IconDeviceFloppy size={18} />}
                  onClick={handleSave}
                  loading={saving}
                  size="md"
                >
                  {t('common.save')}
                </Button>
              </Group>
            </Paper>
          )}

          {/* Desktop Bottom Buttons - показывается только если есть права */}
          {!isMobile && canEditPricing && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="flex-end" gap="md">
                <Button
                  variant="subtle"
                  size="lg"
                  onClick={() => navigate('/owner/dashboard')}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                  size="lg"
                  leftSection={<IconDeviceFloppy size={20} />}
                  onClick={handleSave}
                  loading={saving}
                >
                  {t('common.save')}
                </Button>
              </Group>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default OwnerPricingPage;