// frontend/src/modules/Properties/components/DepositForm.tsx
import { Card, Stack, Group, Text, ThemeIcon, Radio, NumberInput, Alert, Badge } from '@mantine/core';
import { IconCoin, IconInfoCircle, IconCurrencyBaht } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface DepositFormProps {
  dealType: 'sale' | 'rent' | 'both';
  viewMode?: boolean;
  depositType?: 'one_month' | 'two_months' | 'custom';
  depositAmount?: number;
  onDepositTypeChange?: (value: 'one_month' | 'two_months' | 'custom') => void;
  onDepositAmountChange?: (value: number) => void; // ✅ Исправлено: только number
}

const DepositForm = ({ 
  dealType, 
  viewMode,
  depositType,
  depositAmount,
  onDepositTypeChange,
  onDepositAmountChange
}: DepositFormProps) => {
  const { t } = useTranslation();
  const showDeposit = dealType === 'rent' || dealType === 'both';

  if (!showDeposit) return null;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        {/* Header */}
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
            <IconCoin size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="lg">{t('depositForm.title')}</Text>
            <Text size="xs" c="dimmed">{t('depositForm.subtitle')}</Text>
          </div>
        </Group>

        {/* Info Alert */}
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">{t('depositForm.description')}</Text>
        </Alert>

        {/* Deposit Type Selection */}
        <Card shadow="sm" padding="md" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" variant="light" color="cyan">
                <IconCoin size={18} />
              </ThemeIcon>
              <Text fw={500} size="sm">{t('depositForm.depositType')}</Text>
            </Group>

            <Radio.Group
              value={depositType}
              onChange={(value) => onDepositTypeChange?.(value as 'one_month' | 'two_months' | 'custom')}
            >
              <Stack gap="xs">
                <Radio
                  value="one_month"
                  label={<Text size="sm">{t('depositForm.oneMonth')}</Text>}
                  disabled={viewMode}
                  styles={{
                    radio: { cursor: viewMode ? 'not-allowed' : 'pointer' }
                  }}
                />
                <Radio
                  value="two_months"
                  label={<Text size="sm">{t('depositForm.twoMonths')}</Text>}
                  disabled={viewMode}
                  styles={{
                    radio: { cursor: viewMode ? 'not-allowed' : 'pointer' }
                  }}
                />
                <Radio
                  value="custom"
                  label={<Group gap="xs"> <Text size="sm">{t('depositForm.custom')}</Text>                      <Badge size="sm" variant="light" color="cyan">
                        {t('depositForm.recommended')}
                      </Badge> </Group> }
                  disabled={viewMode}
                  styles={{
                    radio: { cursor: viewMode ? 'not-allowed' : 'pointer' }
                  }}
                />
              </Stack>
            </Radio.Group>
          </Stack>
        </Card>

        {/* Custom Deposit Amount */}
        {depositType === 'custom' && (
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            withBorder
            style={{
              background: 'var(--mantine-color-dark-6)',
              animation: 'fadeIn 0.3s ease-in'
            }}
          >
            <Stack gap="md">
              <Group gap="xs">
                <ThemeIcon size="md" radius="md" variant="light" color="green">
                  <IconCurrencyBaht size={18} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text fw={500} size="sm">{t('depositForm.depositAmount')}</Text>
                  <Text size="xs" c="dimmed">{t('depositForm.customAmountDescription')}</Text>
                </div>
              </Group>

              <NumberInput
                value={depositAmount}
                onChange={(value) => onDepositAmountChange?.(Number(value) || 0)} // ✅ Исправлено: приведение к number
                placeholder={t('depositForm.depositAmountPlaceholder')}
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
                styles={{
                  input: {
                    fontSize: '16px',
                    background: viewMode ? 'var(--mantine-color-dark-7)' : undefined
                  }
                }}
              />
            </Stack>
          </Card>
        )}
      </Stack>

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </Card>
  );
};

export default DepositForm;