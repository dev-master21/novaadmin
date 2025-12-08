// frontend/src/modules/FinancialDocuments/components/SelectInvoiceItemsModal.tsx
import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Paper,
  Button,
  Alert,
  Checkbox,
  Badge,
  Box,
  useMantineTheme,
  useMantineColorScheme
} from '@mantine/core';
import {
  IconDownload,
  IconInfoCircle
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { InvoiceItem } from '@/api/financialDocuments.api'; // ✅ ИМПОРТИРУЕМ ТИП ИЗ API

interface SelectInvoiceItemsModalProps {
  opened: boolean;
  onClose: () => void;
  items: InvoiceItem[];
  onDownload: (selectedItems: number[]) => void;
  defaultSelectedItems?: number[];
}

const SelectInvoiceItemsModal = ({
  opened,
  onClose,
  items,
  onDownload,
  defaultSelectedItems = []
}: SelectInvoiceItemsModalProps) => {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set(defaultSelectedItems));

  // Обновляем выбранные позиции при открытии модального окна
  useEffect(() => {
    if (opened && defaultSelectedItems.length > 0) {
      setSelectedItems(new Set(defaultSelectedItems));
    }
  }, [opened, defaultSelectedItems]);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      // ✅ ФИЛЬТРУЕМ ТОЛЬКО ITEMS С ID
      const allIds = items.filter(item => item.id).map(item => item.id!);
      setSelectedItems(new Set(allIds));
    }
  };

  const handleDownload = () => {
    onDownload(Array.from(selectedItems));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  // ✅ ИСПРАВЛЕНО: добавлена проверка на undefined/null/NaN
const selectedTotal = items.reduce((sum: number, item: InvoiceItem) => {
  if (item.id && selectedItems.has(item.id)) {
    const price = Number(item.total_price) || 0; // ✅ ЯВНОЕ ПРЕОБРАЗОВАНИЕ В ЧИСЛО
    return sum + (isNaN(price) ? 0 : price);
  }
  return sum;
}, 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="blue">
            <IconDownload size={20} />
          </ThemeIcon>
          <Text size="lg" fw={600}>
            {t('invoiceDetail.pdfSelection.title', 'Select Items for PDF')}
          </Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Alert 
          icon={<IconInfoCircle size={18} />} 
          color="blue" 
          variant="light"
          styles={{
            root: {
              backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.blue[0]
            }
          }}
        >
          {t('invoiceDetail.pdfSelection.description', 'Select which invoice items you want to include in the PDF document')}
        </Alert>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {t('invoiceDetail.pdfSelection.selected', {
              count: selectedItems.size,
              total: items.length,
              defaultValue: `Selected ${selectedItems.size} of ${items.length} items`
            })}
          </Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={toggleSelectAll}
          >
            {selectedItems.size === items.length 
              ? t('invoiceDetail.pdfSelection.deselectAll', 'Deselect All')
              : t('invoiceDetail.pdfSelection.selectAll', 'Select All')}
          </Button>
        </Group>

        <Stack gap="xs" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {items.map((item, index) => {
            // ✅ ПРОВЕРКА НА СУЩЕСТВОВАНИЕ ID
            if (!item.id) return null;

            const isSelected = selectedItems.has(item.id);
            const isPaid = Boolean(item.is_fully_paid);

            return (
              <Paper
                key={item.id}
                p="md"
                radius="md"
                withBorder
                style={{
                  borderLeft: `4px solid ${
                    isPaid ? theme.colors.gray[isDark ? 6 : 4] : 
                    isSelected ? theme.colors.green[6] : theme.colors.gray[isDark ? 6 : 3]
                  }`,
                  backgroundColor: isPaid 
                    ? (isDark ? theme.colors.dark[6] : theme.colors.gray[0])
                    : isSelected 
                      ? (isDark ? theme.colors.dark[5] : theme.colors.green[0])
                      : (isDark ? theme.colors.dark[7] : 'white'),
                  opacity: isPaid ? 0.6 : 1,
                  cursor: isPaid ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => !isPaid && toggleItemSelection(item.id!)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" style={{ flex: 1 }}>
                    {/* ✅ ИСПРАВЛЕНО: убран отдельный onClick на Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      readOnly
                      disabled={isPaid}
                      size="md"
                      color="green"
                      styles={{
                        input: {
                          cursor: isPaid ? 'not-allowed' : 'pointer'
                        }
                      }}
                    />
                    <Box style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge size="xs" variant="light" color={isDark ? 'gray' : 'blue'}>
                          {index + 1}
                        </Badge>
                        {isPaid && (
                          <Badge size="xs" color="gray" variant="filled">
                            PAID
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" fw={500} c={isDark ? 'gray.3' : 'dark'}>
                        {item.description}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.quantity} x {formatCurrency(item.unit_price || 0)} {t('common.currencyTHB', 'THB')}
                      </Text>
                    </Box>
                  </Group>
                  <Text 
                    size="md" 
                    fw={600} 
                    c={isSelected ? 'green' : (isDark ? 'gray.5' : 'gray.7')}
                  >
                    {formatCurrency(item.total_price || 0)} {t('common.currencyTHB', 'THB')}
                  </Text>
                </Group>
              </Paper>
            );
          })}
        </Stack>

        {/* ✅ АДАПТИРОВАНО ПОД ТЕМЫ */}
        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{
            background: isDark 
              ? `linear-gradient(135deg, ${theme.colors.blue[9]} 0%, ${theme.colors.cyan[9]} 100%)`
              : `linear-gradient(135deg, ${theme.colors.blue[6]} 0%, ${theme.colors.cyan[6]} 100%)`
          }}
        >
          <Group justify="space-between">
            <Text size="md" fw={600} c="white">
              {t('invoiceDetail.pdfSelection.totalToPay', 'Total to Pay')}:
            </Text>
            <Text size="xl" fw={700} c="white">
              {formatCurrency(selectedTotal)} {t('common.currencyTHB', 'THB')}
            </Text>
          </Group>
        </Paper>

        <Group justify="space-between" grow>
          <Button
            variant="light"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={handleDownload}
            disabled={selectedItems.size === 0}
            color="blue"
          >
            {t('invoiceDetail.pdfSelection.download', 'Download PDF')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default SelectInvoiceItemsModal;