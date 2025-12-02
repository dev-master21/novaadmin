// frontend/src/modules/Properties/components/CalendarManager.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Stack,
  Group,
  Button,
  Text,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Paper,
  ActionIcon,
  ThemeIcon,
  Tooltip,
  Divider,
  Alert,
  Center,
  Box,
  SimpleGrid,
  Switch,
  CopyButton,
  Timeline,
  Stepper,
  List,
  Accordion,
  Loader
} from '@mantine/core';
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconDownload,
  IconLink,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconClock,
  IconExternalLink,
  IconCopy,
  IconCircleCheck,
  IconCircleX,
  IconArrowRight,
  IconBrandAirbnb,
  IconBuilding,
  IconPlayerPlay,
  IconEye,
  IconCalendarTime,
  IconCalendarPlus
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { propertiesApi } from '@/api/properties.api';
import { propertyOwnersApi } from '@/api/propertyOwners.api'; // ✅ ДОБАВЛЕНО
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

const createApiAdapter = (isOwnerMode: boolean) => {
  if (isOwnerMode) {
    return {
      getCalendar: (propertyId: number) => propertyOwnersApi.getPropertyCalendar(propertyId),
      addBlockedPeriod: (propertyId: number, data: any) => propertyOwnersApi.addBlockedPeriod(propertyId, data),
      removeBlockedDates: (propertyId: number, dates: string[]) => propertyOwnersApi.removeBlockedDates(propertyId, dates),
      getICSInfo: (propertyId: number) => propertyOwnersApi.getICSInfo(propertyId),
      getExternalCalendars: (propertyId: number) => propertyOwnersApi.getExternalCalendars(propertyId),
      addExternalCalendar: (propertyId: number, data: any) => propertyOwnersApi.addExternalCalendar(propertyId, data),
      removeExternalCalendar: (propertyId: number, calendarId: number, removeDates: boolean) => 
        propertyOwnersApi.removeExternalCalendar(propertyId, calendarId, removeDates),
      toggleExternalCalendar: (propertyId: number, calendarId: number, isEnabled: boolean) => 
        propertyOwnersApi.toggleExternalCalendar(propertyId, calendarId, isEnabled),
      analyzeExternalCalendars: (propertyId: number, calendarIds: number[]) => 
        propertyOwnersApi.analyzeExternalCalendars(propertyId, calendarIds),
      syncExternalCalendars: (propertyId: number) => propertyOwnersApi.syncExternalCalendars(propertyId),
    };
  } else {
    return {
      getCalendar: (propertyId: number) => propertiesApi.getCalendar(propertyId),
      addBlockedPeriod: (propertyId: number, data: any) => propertiesApi.addBlockedPeriod(propertyId, data),
      removeBlockedDates: (propertyId: number, dates: string[]) => propertiesApi.removeBlockedDates(propertyId, dates),
      getICSInfo: (propertyId: number) => propertiesApi.getICSInfo(propertyId),
      getExternalCalendars: (propertyId: number) => propertiesApi.getExternalCalendars(propertyId),
      addExternalCalendar: (propertyId: number, data: any) => propertiesApi.addExternalCalendar(propertyId, data),
      removeExternalCalendar: (propertyId: number, calendarId: number, removeDates: boolean) => 
        propertiesApi.removeExternalCalendar(propertyId, calendarId, removeDates),
      toggleExternalCalendar: (propertyId: number, calendarId: number, isEnabled: boolean) => 
        propertiesApi.toggleExternalCalendar(propertyId, calendarId, isEnabled),
      analyzeExternalCalendars: (propertyId: number, calendarIds: number[]) => 
        propertiesApi.analyzeExternalCalendars(propertyId, calendarIds),
      syncExternalCalendars: (propertyId: number) => propertiesApi.syncExternalCalendars(propertyId),
    };
  }
};

interface BlockedDate {
  blocked_date: string;
  reason: string | null;
  is_check_in?: number | boolean;
  is_check_out?: number | boolean;
}

interface ExternalCalendar {
  id: number;
  property_id: number;
  calendar_name: string;
  ics_url: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  total_events: number;
  created_at: string;
  updated_at: string;
}

interface CalendarManagerProps {
  propertyId: number;
  viewMode?: boolean;
  isOwnerMode?: boolean; // ✅ ДОБАВЛЕНО
  initialBlockedDates?: Array<{
    blocked_date: string;
    reason: string;
  }>;
  onChange?: (dates: BlockedDate[]) => void;
}

const CalendarManager = ({ 
  propertyId, 
  viewMode = false,
  isOwnerMode = false, // ✅ ДОБАВЛЕНО
  initialBlockedDates = [],
  onChange
}: CalendarManagerProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // ✅ ДОБАВЛЕНО: Выбор API в зависимости от режима
  const api = createApiAdapter(isOwnerMode);


  // ✅ КРИТИЧНО: Refs для защиты от множественных запросов
  const isInitialMount = useRef(true);
  const hasLoadedData = useRef(false);
  const isLoadingRef = useRef(false);
  const initialDatesRef = useRef(initialBlockedDates);
  const abortControllerRef = useRef<AbortController | null>(null);
  const propertyIdRef = useRef(propertyId);

  // Состояния
  const [tempBlockedDates, setTempBlockedDates] = useState<BlockedDate[]>(initialBlockedDates || []);
  const isCreatingMode = propertyId === 0;

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedDatesMap, setBlockedDatesMap] = useState<Map<string, BlockedDate>>(new Map());
  const [icsInfo, setIcsInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());

  // Календари
  const [externalCalendars, setExternalCalendars] = useState<ExternalCalendar[]>([]);
  
  // Модальные окна
  const [blockModalOpened, { open: openBlockModal, close: closeBlockModal }] = useDisclosure(false);
  const [externalCalendarModalOpened, { open: openExternalCalendarModal, close: closeExternalCalendarModal }] = useDisclosure(false);
  const [analysisModalOpened, { open: openAnalysisModal, close: closeAnalysisModal }] = useDisclosure(false);
  const [icsInfoModalOpened, { open: openIcsInfoModal, close: closeIcsInfoModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deleteCalendarModalOpened, { open: openDeleteCalendarModal, close: closeDeleteCalendarModal }] = useDisclosure(false);
  const [addOccupancyModalOpened, { open: openAddOccupancyModal, close: closeAddOccupancyModal }] = useDisclosure(false);
  
  // Форма добавления блокировки
  const [selectionType, setSelectionType] = useState<'period' | 'days'>('period');
  const [reason, setReason] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictDates, setConflictDates] = useState<string[]>([]);
  
  // Форма внешнего календаря
  const [calendarName, setCalendarName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [addCalendarStep, setAddCalendarStep] = useState(0);
  
  // Анализ
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzingConflicts, setAnalyzingConflicts] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Удаление периода
  const [periodToDelete, setPeriodToDelete] = useState<any>(null);
  
  // Удаление календаря
  const [calendarToDelete, setCalendarToDelete] = useState<ExternalCalendar | null>(null);
  
  // Выбор периода/дней на календаре
  const [calendarSelectionMode, setCalendarSelectionMode] = useState(false);
  const [selectedCalendarDates, setSelectedCalendarDates] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);

  // ✅ Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up CalendarManager');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
      hasLoadedData.current = false;
    };
  }, []);

  // ✅ Эффект для передачи данных через колбэк БЕЗ onChange в зависимостях
  useEffect(() => {
    if (isCreatingMode && onChange) {
      const timeoutId = setTimeout(() => {
        onChange(tempBlockedDates);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [tempBlockedDates, isCreatingMode]);

  // ✅ КРИТИЧНО: Сброс при изменении propertyId
  useEffect(() => {
    if (propertyIdRef.current !== propertyId) {
      console.log('🔄 PropertyId changed, resetting...');
      propertyIdRef.current = propertyId;
      hasLoadedData.current = false;
      isLoadingRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [propertyId]);

  // ✅ ИСПРАВЛЕНО: Инициализация только один раз
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      console.log('📅 CalendarManager initialized', { propertyId, isCreatingMode, isOwnerMode }); // ✅ ОБНОВЛЕНО
      
      if (isCreatingMode) {
        if (initialDatesRef.current.length > 0) {
          console.log('📝 Setting initial blocked dates:', initialDatesRef.current.length);
          setTempBlockedDates(initialDatesRef.current);
          loadCalendarData();
        }
      } else {
        loadAllData();
      }
    }
  }, []);

  // ✅ ОПТИМИЗИРОВАНО: Последовательная загрузка с защитой от повторных вызовов
  const loadAllData = async () => {
    if (hasLoadedData.current || isLoadingRef.current) {
      console.log('⏭️ Data already loaded or loading, skipping');
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    hasLoadedData.current = true;
    
    abortControllerRef.current = new AbortController();
    
    try {
      console.log('🔄 Loading calendar data sequentially...');
      
      await loadCalendarData();
      
      if (abortControllerRef.current.signal.aborted) {
        console.log('🚫 Load sequence aborted after calendar data');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await loadICSInfo();
      
      if (abortControllerRef.current.signal.aborted) {
        console.log('🚫 Load sequence aborted after ICS info');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await loadExternalCalendars();
      
      console.log('✅ All calendar data loaded successfully');
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        console.log('🚫 Load sequence was canceled');
        return;
      }
      console.error('❌ Error loading calendar data:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const loadCalendarData = async () => {
    if (isCreatingMode) {
      setBlockedDates(tempBlockedDates);
      const blockedMap = new Map<string, BlockedDate>();
      tempBlockedDates.forEach((item: BlockedDate) => {
        blockedMap.set(item.blocked_date, item);
      });
      setBlockedDatesMap(blockedMap);
      return;
    }

try {
  const { data } = await api.getCalendar(propertyId);
  
  // ✅ ОТЛАДКА: Смотрим структуру ответа
  console.log('📦 API Response:', data);
  console.log('📦 Raw blocked dates:', data.data);
  
  const blocked = data.data.blocked_dates || [];
  
  // ✅ ОТЛАДКА: Смотрим массив дат
  console.log('📅 Blocked dates array:', blocked);
  console.log('📅 First blocked date:', blocked[0]);
  
  setBlockedDates(blocked);

  const blockedMap = new Map<string, BlockedDate>();
  blocked.forEach((item: BlockedDate) => {
    // ✅ НОРМАЛИЗАЦИЯ: Убираем время, оставляем только дату
    const normalizedDate = item.blocked_date.split('T')[0]; // '2025-12-03T17:00:00.000Z' → '2025-12-03'
    
    blockedMap.set(normalizedDate, {
      ...item,
      blocked_date: normalizedDate // Сохраняем нормализованную дату
    });
    
    console.log(`  📍 Added to map: ${normalizedDate}`, item);
  });
  
  setBlockedDatesMap(blockedMap);
  
  // ✅ ОТЛАДКА: Итоговая карта
  console.log('📅 Calendar data loaded:', blocked.length, 'dates');
  console.log('🗺️ Blocked dates map size:', blockedMap.size);
  console.log('🗺️ Map contents:', Array.from(blockedMap.entries()));
} catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      notifications.show({
        title: t('errors.generic'),
        message: t('calendarManager.errorLoadingCalendar'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const loadICSInfo = async () => {
    try {
      const { data } = await api.getICSInfo(propertyId); // ✅ ИЗМЕНЕНО
      setIcsInfo(data.data);
      console.log('ℹ️ ICS info loaded');
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to load ICS info:', error);
    }
  };

  const loadExternalCalendars = async () => {
    try {
      const { data } = await api.getExternalCalendars(propertyId); // ✅ ИЗМЕНЕНО
      setExternalCalendars(data.data || []);
      console.log('📆 External calendars loaded:', data.data?.length || 0);
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to load external calendars:', error);
    }
  };

  // ✅ УПРОЩЕНО: Перезагрузка только календаря
  const reloadCalendarData = async () => {
    if (isCreatingMode) {
      await loadCalendarData();
      return;
    }
  
    console.log('🔄 Reloading calendar data...');
    
    try {
      await loadCalendarData();
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadICSInfo();
      console.log('✅ Calendar data and ICS info reloaded');
    } catch (error) {
      console.error('❌ Error reloading calendar data:', error);
    }
  };

  // Обработчики для календаря
  const handleCalendarDayClick = (dateStr: string) => {
    if (viewMode || !calendarSelectionMode) return;

    if (selectionType === 'days') {
      setSelectedCalendarDates(prev => {
        if (prev.includes(dateStr)) {
          return prev.filter(d => d !== dateStr);
        } else {
          return [...prev, dateStr].sort();
        }
      });
    } else if (selectionType === 'period') {
      if (!periodStart) {
        setPeriodStart(dateStr);
        setPeriodEnd(null);
      } else if (!periodEnd) {
        const start = dayjs(periodStart);
        const end = dayjs(dateStr);
        
        if (end.isBefore(start)) {
          setPeriodStart(dateStr);
          setPeriodEnd(null);
        } else {
          setPeriodEnd(dateStr);
        }
      } else {
        setPeriodStart(dateStr);
        setPeriodEnd(null);
      }
    }
  };

  const handleStartDaysSelection = () => {
    setSelectionType('days');
    setCalendarSelectionMode(true);
    setSelectedCalendarDates([]);
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const handleStartPeriodSelection = () => {
    setSelectionType('period');
    setCalendarSelectionMode(true);
    setSelectedCalendarDates([]);
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const handleCancelSelection = () => {
    setCalendarSelectionMode(false);
    setSelectedCalendarDates([]);
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const handleConfirmSelection = () => {
    if (selectionType === 'days') {
      if (selectedCalendarDates.length === 0) {
        notifications.show({
          message: t('calendarManager.selectAtLeastOneDay'),
          color: 'orange',
          icon: <IconAlertCircle size={18} />
        });
        return;
      }
    } else if (selectionType === 'period') {
      if (!periodStart || !periodEnd) {
        notifications.show({
          message: t('calendarManager.selectPeriodDates'),
          color: 'orange',
          icon: <IconAlertCircle size={18} />
        });
        return;
      }
    }

    openBlockModal();
  };

  const handleOpenAddOccupancy = () => {
    setSelectionType('period');
    setReason('');
    setHasConflict(false);
    setConflictDates([]);
    setSelectedCalendarDates([]);
    setPeriodStart(null);
    setPeriodEnd(null);
    openAddOccupancyModal();
  };

  const handleSelectPeriod = () => {
    closeAddOccupancyModal();
    handleStartPeriodSelection();
  };

  const handleSelectDays = () => {
    closeAddOccupancyModal();
    handleStartDaysSelection();
  };

  const handleSubmitBlock = async (forceAdd: boolean = false) => {
    if (selectionType === 'days' && selectedCalendarDates.length > 0) {
      const conflicts = selectedCalendarDates.filter(date => blockedDatesMap.has(date));
      
      if (conflicts.length > 0 && !forceAdd) {
        setHasConflict(true);
        setConflictDates(conflicts);
        return;
      }

      if (isCreatingMode) {
        const dates: BlockedDate[] = selectedCalendarDates.map(date => ({
          blocked_date: date,
          reason: reason || null
        }));
        
        setTempBlockedDates([...tempBlockedDates, ...dates]);
        notifications.show({
          title: t('common.success'),
          message: t('calendarManager.datesAddedTemporarily', { count: dates.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        closeBlockModal();
        setHasConflict(false);
        setConflictDates([]);
        setSelectedCalendarDates([]);
        setCalendarSelectionMode(false);
        setReason('');
        
        await loadCalendarData();
        return;
      }

      try {
        if (forceAdd && conflicts.length > 0) {
          await api.removeBlockedDates(propertyId, conflicts); // ✅ ИЗМЕНЕНО
        }

        for (const date of selectedCalendarDates) {
          await api.addBlockedPeriod(propertyId, { // ✅ ИЗМЕНЕНО
            start_date: date,
            end_date: date,
            reason: reason || undefined
          });
        }

        notifications.show({
          title: t('common.success'),
          message: t('calendarManager.daysBlocked', { count: selectedCalendarDates.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        
        closeBlockModal();
        setHasConflict(false);
        setConflictDates([]);
        setSelectedCalendarDates([]);
        setCalendarSelectionMode(false);
        setReason('');
        
        await reloadCalendarData();
      } catch (error: any) {
        notifications.show({
          title: t('errors.generic'),
          message: error.response?.data?.message || t('calendarManager.errorBlocking'),
          color: 'red',
          icon: <IconX size={18} />
        });
      }
      return;
    }

    if (selectionType === 'period' && periodStart && periodEnd) {
      const start = dayjs(periodStart);
      const end = dayjs(periodEnd);

      const conflicts: string[] = [];
      let current = start;
      
      while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        if (blockedDatesMap.has(dateStr)) {
          conflicts.push(dateStr);
        }
        current = current.add(1, 'day');
      }

      if (conflicts.length > 0 && !forceAdd) {
        setHasConflict(true);
        setConflictDates(conflicts);
        return;
      }

      if (isCreatingMode) {
        const dates: BlockedDate[] = [];
        let currentDate = start;
        
        while (currentDate.isBefore(end) || currentDate.isSame(end)) {
          dates.push({
            blocked_date: currentDate.format('YYYY-MM-DD'),
            reason: reason || null
          });
          currentDate = currentDate.add(1, 'day');
        }
        
        setTempBlockedDates([...tempBlockedDates, ...dates]);
        notifications.show({
          title: t('common.success'),
          message: t('calendarManager.datesAddedTemporarily', { count: dates.length }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        closeBlockModal();
        setHasConflict(false);
        setConflictDates([]);
        setPeriodStart(null);
        setPeriodEnd(null);
        setCalendarSelectionMode(false);
        setReason('');
        
        await loadCalendarData();
        return;
      }

      try {
        if (forceAdd && conflicts.length > 0) {
          await api.removeBlockedDates(propertyId, conflicts); // ✅ ИЗМЕНЕНО
        }

        await api.addBlockedPeriod(propertyId, { // ✅ ИЗМЕНЕНО
          start_date: start.format('YYYY-MM-DD'),
          end_date: end.format('YYYY-MM-DD'),
          reason: reason || undefined
        });

        notifications.show({
          title: t('common.success'),
          message: forceAdd ? t('calendarManager.periodAddedForced') : t('calendarManager.periodBlocked'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
        
        closeBlockModal();
        setHasConflict(false);
        setConflictDates([]);
        setPeriodStart(null);
        setPeriodEnd(null);
        setCalendarSelectionMode(false);
        setReason('');
        
        await reloadCalendarData();
      } catch (error: any) {
        notifications.show({
          title: t('errors.generic'),
          message: error.response?.data?.message || t('calendarManager.errorBlocking'),
          color: 'red',
          icon: <IconX size={18} />
        });
      }
      return;
    }

    notifications.show({
      message: t('calendarManager.selectPeriodRequired'),
      color: 'orange',
      icon: <IconAlertCircle size={18} />
    });
  };

  const handleRemoveDates = async (dates: string[]) => {
    if (isCreatingMode) {
      setTempBlockedDates(tempBlockedDates.filter(d => !dates.includes(d.blocked_date)));
      notifications.show({
        title: t('common.success'),
        message: t('calendarManager.datesRemovedTemporarily'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      await loadCalendarData();
      return;
    }

    try {
      await api.removeBlockedDates(propertyId, dates); // ✅ ИЗМЕНЕНО
      notifications.show({
        title: t('common.success'),
        message: t('calendarManager.datesUnblocked'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      await reloadCalendarData();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('calendarManager.errorRemovingDates'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleAddExternalCalendar = () => {
    setCalendarName('');
    setIcsUrl('');
    setAddCalendarStep(0);
    openExternalCalendarModal();
  };

  const handleSubmitExternalCalendar = async () => {
    if (!calendarName.trim()) {
      notifications.show({
        message: t('calendarManager.specifyName'),
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    if (!icsUrl.trim()) {
      notifications.show({
        message: t('calendarManager.specifyLink'),
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    try {
      await api.addExternalCalendar(propertyId, { // ✅ ИЗМЕНЕНО
        calendar_name: calendarName,
        ics_url: icsUrl
      });

      notifications.show({
        title: t('common.success'),
        message: t('calendarManager.calendarAdded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      
      closeExternalCalendarModal();
      await loadExternalCalendars();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('calendarManager.errorAddingCalendar'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleRemoveExternalCalendar = async (calendarId: number, removeDates: boolean) => {
    try {
      await api.removeExternalCalendar(propertyId, calendarId, removeDates); // ✅ ИЗМЕНЕНО
      notifications.show({
        title: t('common.success'),
        message: t('calendarManager.calendarRemoved'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      closeDeleteCalendarModal();
      setCalendarToDelete(null);
      
      await loadExternalCalendars();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (removeDates) {
        await loadCalendarData();
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadICSInfo();
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('calendarManager.errorRemovingCalendar'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleToggleExternalCalendar = async (calendarId: number, isEnabled: boolean) => {
    try {
      await api.toggleExternalCalendar(propertyId, calendarId, isEnabled); // ✅ ИЗМЕНЕНО
      notifications.show({
        title: t('common.success'),
        message: t('calendarManager.syncToggled', { 
          state: isEnabled ? t('calendarManager.enabled') : t('calendarManager.disabled')
        }),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      await loadExternalCalendars();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: t('calendarManager.errorTogglingSync'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleAnalyzeCalendars = async () => {
    if (externalCalendars.length < 2) {
      notifications.show({
        message: t('calendarManager.minTwoCalendars'),
        color: 'orange',
        icon: <IconAlertCircle size={18} />
      });
      return;
    }

    setAnalyzingConflicts(true);
    try {
      const calendarIds = externalCalendars.map(c => c.id);
      const { data } = await api.analyzeExternalCalendars(propertyId, calendarIds); // ✅ ИЗМЕНЕНО
      
      setAnalysisResult(data.data);
      openAnalysisModal();

      if (data.data.totalConflicts === 0) {
        notifications.show({
          title: t('common.success'),
          message: t('calendarManager.noConflicts'),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      } else {
        notifications.show({
          message: t('calendarManager.conflictsDetected', { count: data.data.totalConflicts }),
          color: 'orange',
          icon: <IconAlertCircle size={18} />
        });
      }
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('calendarManager.errorAnalyzing'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setAnalyzingConflicts(false);
    }
  };

  const handleSyncCalendars = async () => {
    setSyncing(true);
    try {
      const { data } = await api.syncExternalCalendars(propertyId); // ✅ ИЗМЕНЕНО
      
      if (data.success) {
        notifications.show({
          title: t('common.success'),
          message: t('calendarManager.syncSuccess', {
            calendars: data.data.syncedCalendars,
            events: data.data.totalEvents
          }),
          color: 'green',
          icon: <IconCheck size={18} />
        });
      } else {
        notifications.show({
          message: t('calendarManager.syncWithErrors'),
          color: 'orange',
          icon: <IconAlertCircle size={18} />
        });
      }

      await loadExternalCalendars();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await loadCalendarData();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await loadICSInfo();
      
      closeAnalysisModal();
      
      setTimeout(() => {
        openIcsInfoModal();
      }, 500);
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('calendarManager.errorSyncing'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setSyncing(false);
    }
  };

  // Навигация по календарю
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToToday = () => {
    setSelectedYear(dayjs().year());
    setSelectedMonth(dayjs().month());
  };

  const getCurrentMonthName = () => {
    return dayjs().year(selectedYear).month(selectedMonth).format('MMMM YYYY');
  };

  // Генерация календаря
  const generateCalendar = () => {
    const firstDay = dayjs().year(selectedYear).month(selectedMonth).startOf('month');
    const lastDay = firstDay.endOf('month');
    const startDate = firstDay.startOf('week');
    const endDate = lastDay.endOf('week');

    const calendar = [];
    let currentWeek = [];
    let current = startDate;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      currentWeek.push(current);
      
      if (currentWeek.length === 7) {
        calendar.push(currentWeek);
        currentWeek = [];
      }
      
      current = current.add(1, 'day');
    }

    if (currentWeek.length > 0) {
      calendar.push(currentWeek);
    }

    return calendar;
  };

const getDateStatus = (date: dayjs.Dayjs) => {
  const dateStr = date.format('YYYY-MM-DD');
  const blockedInfo = blockedDatesMap.get(dateStr);
  
  // ✅ ОТЛАДКА: Проверяем поиск в карте (только для первых 3 дат текущего месяца)
  if (date.date() <= 3 && date.month() === selectedMonth) {
    console.log(`🔍 Checking date ${dateStr}:`, {
      found: !!blockedInfo,
      data: blockedInfo,
      mapSize: blockedDatesMap.size
    });
  }
    
    if (!blockedInfo) {
      return { blocked: false, checkIn: false, checkOut: false };
    }
    
    return {
      blocked: true,
      checkIn: Boolean(blockedInfo.is_check_in),
      checkOut: Boolean(blockedInfo.is_check_out)
    };
  };

  const isCurrentMonth = (date: dayjs.Dayjs) => {
    return date.month() === selectedMonth;
  };

  const isInPeriodRange = (dateStr: string) => {
    if (!periodStart || !periodEnd) return false;
    const date = dayjs(dateStr);
    const start = dayjs(periodStart);
    const end = dayjs(periodEnd);
    return (date.isAfter(start) || date.isSame(start)) && (date.isBefore(end) || date.isSame(end));
  };

  const getGroupedPeriods = () => {
    if (blockedDates.length === 0) return [];

    const sorted = [...blockedDates].sort((a, b) =>
      a.blocked_date.localeCompare(b.blocked_date)
    );

    const periods: Array<{
      start: string;
      end: string;
      reason: string | null;
      dates: string[];
    }> = [];

    let current = {
      start: sorted[0].blocked_date,
      end: sorted[0].blocked_date,
      reason: sorted[0].reason,
      dates: [sorted[0].blocked_date]
    };

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = dayjs(sorted[i - 1].blocked_date);
      const currDate = dayjs(sorted[i].blocked_date);
      const dayDiff = currDate.diff(prevDate, 'day');

      if (dayDiff === 1 && sorted[i].reason === current.reason) {
        current.end = sorted[i].blocked_date;
        current.dates.push(sorted[i].blocked_date);
      } else {
        periods.push({ ...current });
        current = {
          start: sorted[i].blocked_date,
          end: sorted[i].blocked_date,
          reason: sorted[i].reason,
          dates: [sorted[i].blocked_date]
        };
      }
    }

    periods.push(current);
    return periods;
  };

  const downloadICS = () => {
    if (icsInfo?.ics_url) {
      const timestamp = new Date().getTime();
      window.open(`https://admin.novaestate.company${icsInfo.ics_url}?v=${timestamp}`, '_blank');
    }
  };

  const weekDays = useMemo(() => {
    const days = t('calendarManager.weekDays', { returnObjects: true }) as string[];
    return days || ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  }, [t]);

  const calendar = generateCalendar();
  const periods = getGroupedPeriods();

  // Рендер дня календаря
  const renderCalendarDay = (day: dayjs.Dayjs) => {
    const dateStr = day.format('YYYY-MM-DD');
    const status = getDateStatus(day);
    const current = isCurrentMonth(day);
    const today = day.isSame(dayjs(), 'day');
    const isSelected = selectedCalendarDates.includes(dateStr);
    const isPeriodStartDay = periodStart === dateStr;
    const isPeriodEndDay = periodEnd === dateStr;
    const isInPeriod = isInPeriodRange(dateStr);

    let backgroundColor = 'transparent';
    let borderColor = '#2C2E33';
    let textColor = current ? '#C1C2C5' : '#5C5F66';
    let dayStyle: React.CSSProperties = {};

    if (today) {
      borderColor = '#228BE6';
      textColor = '#228BE6';
    }

    if (selectionType === 'period' && calendarSelectionMode) {
      if (isPeriodStartDay || isPeriodEndDay) {
        backgroundColor = '#7950F2';
        textColor = '#FFFFFF';
        borderColor = '#7950F2';
      } else if (isInPeriod) {
        backgroundColor = '#5F3DC4';
        textColor = '#FFFFFF';
        borderColor = '#5F3DC4';
      }
    }

    if (selectionType === 'days' && isSelected) {
      backgroundColor = '#1864AB';
      textColor = '#FFFFFF';
      borderColor = '#1864AB';
    }

    if (status.blocked && !isSelected && !isPeriodStartDay && !isPeriodEndDay && !isInPeriod) {
      if (status.checkIn && status.checkOut) {
        dayStyle = {
          background: 'linear-gradient(135deg, #C92A2A 0%, #C92A2A 50%, #862E9C 50%, #862E9C 100%)',
          position: 'relative'
        };
        textColor = '#FFFFFF';
        borderColor = '#FA5252';
      } else if (status.checkIn) {
        dayStyle = {
          background: 'linear-gradient(135deg, transparent 50%, #C92A2A 50%)',
          position: 'relative'
        };
        borderColor = '#FA5252';
      } else if (status.checkOut) {
        dayStyle = {
          background: 'linear-gradient(135deg, #C92A2A 0%, #C92A2A 50%, transparent 50%)',
          position: 'relative'
        };
        borderColor = '#FA5252';
      } else {
        backgroundColor = '#C92A2A';
        textColor = '#FFFFFF';
        borderColor = '#FA5252';
      }
    }

    const hoverStyle = calendarSelectionMode && !viewMode ? {
      transform: 'scale(1.05)',
      zIndex: 10,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    } : {};

    return (
      <Box
        key={dateStr}
        onClick={() => handleCalendarDayClick(dateStr)}
        onMouseEnter={(e) => {
          if (calendarSelectionMode && !viewMode) {
            Object.assign(e.currentTarget.style, hoverStyle);
          }
        }}
        onMouseLeave={(e) => {
          if (calendarSelectionMode && !viewMode) {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.zIndex = '';
            e.currentTarget.style.boxShadow = '';
          }
        }}
        style={{
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          cursor: calendarSelectionMode && !viewMode ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          backgroundColor,
          minHeight: isMobile ? '45px' : '60px',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 600,
          color: textColor,
          opacity: current ? 1 : 0.4,
          ...dayStyle
        }}
      >
        {day.date()}
      </Box>
    );
  };

  // Компонент легенды
  const CalendarLegend = () => (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={600}>{t('calendarManager.legend')}</Text>
        <SimpleGrid cols={{ base: 2, xs: 3, sm: 5 }} spacing="xs">
          <Group gap={8}>
            <Box
              w={24}
              h={24}
              style={{
                border: '2px solid #228BE6',
                borderRadius: '4px',
                backgroundColor: 'transparent'
              }}
            />
            <Text size="xs">{t('calendarManager.today')}</Text>
          </Group>
          
          <Group gap={8}>
            <Box
              w={24}
              h={24}
              style={{
                backgroundColor: '#C92A2A',
                borderRadius: '4px',
                border: '2px solid #FA5252'
              }}
            />
            <Text size="xs">{t('calendarManager.occupied')}</Text>
          </Group>
          
          <Group gap={8}>
            <Box
              w={24}
              h={24}
              style={{
                background: 'linear-gradient(135deg, transparent 50%, #C92A2A 50%)',
                borderRadius: '4px',
                border: '2px solid #FA5252'
              }}
            />
            <Text size="xs">{t('calendarManager.checkIn')}</Text>
          </Group>
          
          <Group gap={8}>
            <Box
              w={24}
              h={24}
              style={{
                background: 'linear-gradient(135deg, #C92A2A 0%, #C92A2A 50%, transparent 50%)',
                borderRadius: '4px',
                border: '2px solid #FA5252'
              }}
            />
            <Text size="xs">{t('calendarManager.checkOut')}</Text>
          </Group>
          
          <Group gap={8}>
            <Box
              w={24}
              h={24}
              style={{
                background: 'linear-gradient(135deg, #C92A2A 0%, #C92A2A 50%, #862E9C 50%, #862E9C 100%)',
                borderRadius: '4px',
                border: '2px solid #FA5252'
              }}
            />
            <Text size="xs">{t('calendarManager.checkInOut')}</Text>
          </Group>
        </SimpleGrid>
      </Stack>
    </Paper>
  );

  if (loading && !isCreatingMode) {
    return (
      <Center p="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">{t('common.loading')}</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      {/* Заголовок и основные действия */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">
                  {t('calendarManager.title')}
                </Text>
                <Text size="sm" c="dimmed">
                  {isCreatingMode 
                    ? t('calendarManager.icsCreatedAfter')
                    : t('calendarManager.manageOccupancy')
                  }
                </Text>
              </div>
            </Group>

            {!viewMode && (
              <Group gap="sm" wrap="wrap">
                {icsInfo && !isCreatingMode && (
                  <>
                    <Button
                      variant="light"
                      color="blue"
                      leftSection={<IconEye size={18} />}
                      onClick={openIcsInfoModal}
                      size={isMobile ? 'sm' : 'md'}
                    >
                      {isMobile ? 'ICS' : t('calendarManager.viewIcsInfo')}
                    </Button>
                    <Button
                      variant="light"
                      color="teal"
                      leftSection={<IconDownload size={18} />}
                      onClick={downloadICS}
                      size={isMobile ? 'sm' : 'md'}
                    >
                      {isMobile ? t('common.download') : t('calendarManager.downloadIcs')}
                    </Button>
                  </>
                )}
                <Button
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'grape' }}
                  leftSection={<IconPlus size={18} />}
                  onClick={handleOpenAddOccupancy}
                  size={isMobile ? 'sm' : 'md'}
                >
                  {isMobile ? t('common.add') : t('calendarManager.addOccupancy')}
                </Button>
              </Group>
            )}
          </Group>

          {/* Статистика */}
          {!isCreatingMode && icsInfo && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Paper p="sm" radius="md" withBorder>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('calendarManager.blockedDays')}</Text>
                  <Text size="xl" fw={700} c="red">{icsInfo.total_blocked_days || 0}</Text>
                </Stack>
              </Paper>
              <Paper p="sm" radius="md" withBorder>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('calendarManager.externalCalendars')}</Text>
                  <Text size="xl" fw={700} c="blue">{externalCalendars.length}</Text>
                </Stack>
              </Paper>
              <Paper p="sm" radius="md" withBorder>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('calendarManager.activeSyncs')}</Text>
                  <Text size="xl" fw={700} c="green">
                    {externalCalendars.filter(c => c.is_enabled).length}
                  </Text>
                </Stack>
              </Paper>
              <Paper p="sm" radius="md" withBorder>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">{t('calendarManager.lastUpdate')}</Text>
                  <Text size="sm" fw={600}>
                    {icsInfo.updated_at ? dayjs(icsInfo.updated_at).format('DD.MM HH:mm') : '-'}
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>
          )}

          {/* Alert о временном хранении */}
          {isCreatingMode && tempBlockedDates.length > 0 && (
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Text size="sm">
                {t('calendarManager.addedTemporarily')}: <strong>{tempBlockedDates.length}</strong> {t('calendarManager.dates')}
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Внешние календари */}
      {!viewMode && !isCreatingMode && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="md" variant="light" color="cyan">
                  <IconRefresh size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="md">{t('calendarManager.syncCalendars')}</Text>
                  <Text size="xs" c="dimmed">{t('calendarManager.syncCalendarsDesc')}</Text>
                </div>
              </Group>

              <Group gap="xs" wrap="wrap">
                {externalCalendars.length > 1 && (
                  <Button
                    variant="light"
                    color="orange"
                    size="sm"
                    leftSection={<IconAlertCircle size={16} />}
                    onClick={handleAnalyzeCalendars}
                    loading={analyzingConflicts}
                  >
                    {t('calendarManager.analysis')}
                  </Button>
                )}
                {externalCalendars.length > 0 && (
                  <Button
                    variant="light"
                    color="teal"
                    size="sm"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleSyncCalendars}
                    loading={syncing}
                  >
                    {t('calendarManager.synchronize')}
                  </Button>
                )}
                <Button
                  variant="light"
                  color="blue"
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleAddExternalCalendar}
                >
                  {t('calendarManager.addCalendar')}
                </Button>
              </Group>
            </Group>

            {externalCalendars.length === 0 ? (
              <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>{t('calendarManager.noExternalCalendars')}</Text>
                  <Text size="xs" c="dimmed">{t('calendarManager.noExternalCalendarsDesc')}</Text>
                </Stack>
              </Alert>
            ) : (
              <Stack gap="sm">
                {externalCalendars.map((calendar) => (
                  <Paper key={calendar.id} p="md" radius="md" withBorder>
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="md" style={{ flex: 1 }}>
                        <ThemeIcon
                          size="lg"
                          radius="md"
                          variant="light"
                          color={calendar.is_enabled ? 'green' : 'gray'}
                        >
                          {calendar.is_enabled ? (
                            <IconCircleCheck size={20} />
                          ) : (
                            <IconCircleX size={20} />
                          )}
                        </ThemeIcon>

                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text fw={600}>{calendar.calendar_name}</Text>
                            {calendar.total_events > 0 && (
                              <Badge size="sm" color="blue" variant="light">
                                {calendar.total_events} {t('calendarManager.events')}
                              </Badge>
                            )}
                            {calendar.sync_error && (
                              <Badge size="sm" color="red" variant="light">
                                {t('calendarManager.syncError')}
                              </Badge>
                            )}
                          </Group>

                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {calendar.ics_url}
                          </Text>

                          {calendar.last_sync_at && (
                            <Text size="xs" c="dimmed">
                              {t('calendarManager.lastSync')}: {dayjs(calendar.last_sync_at).format('DD.MM.YYYY HH:mm')}
                            </Text>
                          )}

                          {calendar.sync_error && (
                            <Text size="xs" c="red">
                              {t('calendarManager.error')}: {calendar.sync_error}
                            </Text>
                          )}
                        </Stack>
                      </Group>

                      <Group gap="xs">
                        <Switch
                          checked={calendar.is_enabled}
                          onChange={(e) => handleToggleExternalCalendar(calendar.id, e.currentTarget.checked)}
                          size={isMobile ? 'sm' : 'md'}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => {
                            setCalendarToDelete(calendar);
                            openDeleteCalendarModal();
                          }}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      <Divider />

      {/* Календарь */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          {/* Навигация по месяцам */}
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <ActionIcon
                variant="light"
                color="violet"
                onClick={goToPreviousMonth}
                size="lg"
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
              <Text fw={600} size="lg" style={{ minWidth: isMobile ? '140px' : '180px', textAlign: 'center' }}>
                {getCurrentMonthName()}
              </Text>
              <ActionIcon
                variant="light"
                color="violet"
                onClick={goToNextMonth}
                size="lg"
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>

            <Group gap="xs">
              <Button
                variant="light"
                color="gray"
                size="sm"
                onClick={goToToday}
              >
                {t('calendarManager.today')}
              </Button>
            </Group>
          </Group>

          {calendarSelectionMode && (
            <Alert icon={<IconInfoCircle size={18} />} color="violet" variant="light">
              <Stack gap="sm">
                {selectionType === 'days' ? (
                  <Text size="sm">
                    {t('calendarManager.selectDatesOnCalendar')} {selectedCalendarDates.length > 0 && `(${selectedCalendarDates.length} ${t('calendarManager.selected')})`}
                  </Text>
                ) : (
                  <Text size="sm">
                    {!periodStart && t('calendarManager.selectPeriodStart')}
                    {periodStart && !periodEnd && t('calendarManager.selectPeriodEnd')}
                    {periodStart && periodEnd && t('calendarManager.periodSelected', { 
                      start: dayjs(periodStart).format('DD.MM.YYYY'),
                      end: dayjs(periodEnd).format('DD.MM.YYYY')
                    })}
                  </Text>
                )}
                <Group gap="xs">
                  <Button
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={handleCancelSelection}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="filled"
                    color="violet"
                    size="sm"
                    onClick={handleConfirmSelection}
                    disabled={
                      (selectionType === 'days' && selectedCalendarDates.length === 0) ||
                      (selectionType === 'period' && (!periodStart || !periodEnd))
                    }
                  >
                    {t('common.confirm')} 
                    {selectionType === 'days' && selectedCalendarDates.length > 0 && ` (${selectedCalendarDates.length})`}
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}

          {/* Сетка календаря */}
          <Box>
            {/* Дни недели */}
            <SimpleGrid cols={7} spacing={2} mb="xs">
              {weekDays.map((day) => (
                <Center key={day}>
                  <Text size="sm" fw={700} c="dimmed" tt="uppercase">
                    {day}
                  </Text>
                </Center>
              ))}
            </SimpleGrid>

            {/* Дни месяца */}
            <Stack gap={2}>
              {calendar.map((week, weekIndex) => (
                <SimpleGrid key={weekIndex} cols={7} spacing={2}>
                  {week.map((day) => renderCalendarDay(day))}
                </SimpleGrid>
              ))}
            </Stack>
          </Box>

          {/* Легенда */}
          <CalendarLegend />
        </Stack>
      </Card>

      {/* Заблокированные периоды */}
      {periods.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="red">
                <IconClock size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="md">{t('calendarManager.blockedPeriods')}</Text>
                <Text size="xs" c="dimmed">
                  {t('calendarManager.totalPeriods')}: {periods.length}
                </Text>
              </div>
            </Group>

            <Stack gap="xs">
              {periods.map((period, index) => (
                <Paper key={index} p="md" radius="md" withBorder>
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Badge color="red" variant="filled">
                          {dayjs(period.start).format('DD.MM.YYYY')} - {dayjs(period.end).format('DD.MM.YYYY')}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          ({period.dates.length} {t('calendarManager.daysCount', { count: period.dates.length })})
                        </Text>
                      </Group>
                      <Text size="sm">
                        {period.reason || <Text c="dimmed" fs="italic">{t('calendarManager.noDescription')}</Text>}
                      </Text>
                    </Stack>

                    {!viewMode && (
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => {
                          setPeriodToDelete(period);
                          openDeleteModal();
                        }}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Card>
      )}

      {/* МОДАЛЬНЫЕ ОКНА - без изменений, копируем все как есть */}
      
      {/* Модальное окно выбора типа добавления */}
      <Modal
        opened={addOccupancyModalOpened}
        onClose={closeAddOccupancyModal}
        title={t('calendarManager.addOccupancy')}
        size="md"
        centered
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            {t('calendarManager.chooseAddType')}
          </Text>

          <Stack gap="md">
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={handleSelectPeriod}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--mantine-color-violet-6)';
                e.currentTarget.style.backgroundColor = 'var(--mantine-color-violet-0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <Group gap="md">
                <ThemeIcon size="xl" radius="md" variant="light" color="violet">
                  <IconCalendarTime size={24} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600} size="md">{t('calendarManager.addPeriod')}</Text>
                  <Text size="xs" c="dimmed">{t('calendarManager.addPeriodDesc')}</Text>
                </Stack>
              </Group>
            </Paper>

            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={handleSelectDays}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--mantine-color-grape-6)';
                e.currentTarget.style.backgroundColor = 'var(--mantine-color-grape-0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <Group gap="md">
                <ThemeIcon size="xl" radius="md" variant="light" color="grape">
                  <IconCalendarPlus size={24} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600} size="md">{t('calendarManager.selectDays')}</Text>
                  <Text size="xs" c="dimmed">{t('calendarManager.selectDaysDesc')}</Text>
                </Stack>
              </Group>
            </Paper>
          </Stack>
        </Stack>
      </Modal>

      {/* Модальное окно добавления блокировки */}
      <Modal
        opened={blockModalOpened}
        onClose={() => {
          closeBlockModal();
          setHasConflict(false);
          setConflictDates([]);
          setReason('');
        }}
        title={selectionType === 'period' ? t('calendarManager.addOccupancyPeriod') : t('calendarManager.addOccupancyDays')}
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Stack gap="md">
          {selectionType === 'period' && periodStart && periodEnd ? (
            <Alert icon={<IconInfoCircle size={18} />} color="violet" variant="light">
              <Text size="sm">
                {t('calendarManager.selectedPeriod')}: {dayjs(periodStart).format('DD.MM.YYYY')} - {dayjs(periodEnd).format('DD.MM.YYYY')}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {t('calendarManager.daysInPeriod')}: {dayjs(periodEnd).diff(dayjs(periodStart), 'day') + 1}
              </Text>
            </Alert>
          ) : selectionType === 'days' && selectedCalendarDates.length > 0 ? (
            <Alert icon={<IconInfoCircle size={18} />} color="violet" variant="light">
              <Text size="sm">
                {t('calendarManager.selectedDaysCount', { count: selectedCalendarDates.length })}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {selectedCalendarDates.map(date => dayjs(date).format('DD.MM.YYYY')).join(', ')}
              </Text>
            </Alert>
          ) : null}

          {hasConflict && (
            <Alert icon={<IconAlertCircle size={18} />} color="orange" variant="light">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t('calendarManager.occupiedDatesDetected')}
                </Text>
                <Text size="xs">
                  {t('calendarManager.periodHasOccupied', { count: conflictDates.length })}
                </Text>
                <Paper p="xs" radius="md" withBorder style={{ maxHeight: '120px', overflow: 'auto' }}>
                  <Stack gap={2}>
                    {conflictDates.slice(0, 10).map(date => (
                      <Text key={date} size="xs" c="red">
                        • {dayjs(date).format('DD.MM.YYYY')}
                      </Text>
                    ))}
                    {conflictDates.length > 10 && (
                      <Text size="xs" c="dimmed">
                        {t('calendarManager.andMoreDates', { count: conflictDates.length - 10 })}
                      </Text>
                    )}
                  </Stack>
                </Paper>
                <Text size="xs" c="dimmed">
                  {t('calendarManager.selectOtherPeriod')}
                </Text>
              </Stack>
            </Alert>
          )}

          <Textarea
            label={t('calendarManager.descriptionOptional')}
            placeholder={t('calendarManager.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            rows={3}
            maxLength={500}
            size={isMobile ? 'sm' : 'md'}
            styles={{
              input: {
                fontSize: '16px'
              }
            }}
          />

          {!hasConflict && (
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Text size="xs">{t('calendarManager.infoDescription')}</Text>
            </Alert>
          )}

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                closeBlockModal();
                setHasConflict(false);
                setConflictDates([]);
                setReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            
            {hasConflict ? (
              <Button
                color="red"
                onClick={() => handleSubmitBlock(true)}
              >
                {t('calendarManager.forceAddButton')}
              </Button>
            ) : (
              <Button
                variant="gradient"
                gradient={{ from: 'violet', to: 'grape' }}
                onClick={() => handleSubmitBlock(false)}
              >
                {t('common.add')}
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      {/* Модальное окно добавления внешнего календаря */}
      <Modal
        opened={externalCalendarModalOpened}
        onClose={() => {
          closeExternalCalendarModal();
          setCalendarName('');
          setIcsUrl('');
          setAddCalendarStep(0);
        }}
        title={t('calendarManager.addExternalCalendar')}
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        <Stack gap="lg">
          <Stepper active={addCalendarStep} onStepClick={setAddCalendarStep}>
            <Stepper.Step
              label={t('calendarManager.step1')}
              description={t('calendarManager.calendarInfo')}
            >
              <Stack gap="md" mt="md">
                <TextInput
                  label={t('calendarManager.serviceName')}
                  placeholder={t('calendarManager.serviceNamePlaceholder')}
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.currentTarget.value)}
                  required
                  leftSection={<IconBuilding size={16} />}
                  size={isMobile ? 'sm' : 'md'}
                  styles={{ input: { fontSize: '16px' } }}
                />

                <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                  <Text size="xs">
                    {t('calendarManager.exampleServices')}: Airbnb, Booking.com, Beds24, HomeAway
                  </Text>
                </Alert>
              </Stack>
            </Stepper.Step>

            <Stepper.Step
              label={t('calendarManager.step2')}
              description={t('calendarManager.icsLink')}
            >
              <Stack gap="md" mt="md">
                <TextInput
                  label={t('calendarManager.icsLink')}
                  placeholder="https://example.com/calendar.ics"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.currentTarget.value)}
                  required
                  leftSection={<IconLink size={16} />}
                  size={isMobile ? 'sm' : 'md'}
                  styles={{ input: { fontSize: '16px' } }}
                />

                <Accordion variant="contained">
                  <Accordion.Item value="airbnb">
                    <Accordion.Control icon={<IconBrandAirbnb size={20} />}>
                      {t('calendarManager.howToGetAirbnb')}
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Timeline bulletSize={24} lineWidth={2}>
                        <Timeline.Item bullet={<IconPlayerPlay size={12} />} title={t('calendarManager.airbnbStep1Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.airbnbStep1')}</Text>
                        </Timeline.Item>
                        <Timeline.Item bullet={<IconArrowRight size={12} />} title={t('calendarManager.airbnbStep2Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.airbnbStep2')}</Text>
                        </Timeline.Item>
                        <Timeline.Item bullet={<IconCopy size={12} />} title={t('calendarManager.airbnbStep3Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.airbnbStep3')}</Text>
                        </Timeline.Item>
                      </Timeline>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="booking">
                    <Accordion.Control icon={<IconBuilding size={20} />}>
                      {t('calendarManager.howToGetBooking')}
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Timeline bulletSize={24} lineWidth={2}>
                        <Timeline.Item bullet={<IconPlayerPlay size={12} />} title={t('calendarManager.bookingStep1Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.bookingStep1')}</Text>
                        </Timeline.Item>
                        <Timeline.Item bullet={<IconArrowRight size={12} />} title={t('calendarManager.bookingStep2Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.bookingStep2')}</Text>
                        </Timeline.Item>
                        <Timeline.Item bullet={<IconCopy size={12} />} title={t('calendarManager.bookingStep3Title')}>
                          <Text size="xs" c="dimmed">{t('calendarManager.bookingStep3')}</Text>
                        </Timeline.Item>
                      </Timeline>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Stack>
            </Stepper.Step>

            <Stepper.Completed>
              <Stack gap="md" mt="md" align="center">
                <ThemeIcon size={60} radius="xl" variant="light" color="green">
                  <IconCheck size={30} />
                </ThemeIcon>
                <Text size="lg" fw={600}>{t('calendarManager.readyToAdd')}</Text>
                <Paper p="md" radius="md" withBorder style={{ width: '100%' }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">{t('calendarManager.serviceName')}:</Text>
                      <Text size="sm" fw={600}>{calendarName}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">{t('calendarManager.icsLink')}:</Text>
                      <Text size="xs" lineClamp={1}>{icsUrl}</Text>
                    </Group>
                  </Stack>
                </Paper>
              </Stack>
            </Stepper.Completed>
          </Stepper>

          <Group justify="space-between" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                closeExternalCalendarModal();
                setCalendarName('');
                setIcsUrl('');
                setAddCalendarStep(0);
              }}
            >
              {t('common.cancel')}
            </Button>
            
            <Group gap="sm">
              {addCalendarStep > 0 && addCalendarStep < 2 && (
                <Button variant="light" onClick={() => setAddCalendarStep(addCalendarStep - 1)}>
                  {t('common.back')}
                </Button>
              )}
              
              {addCalendarStep < 2 ? (
                <Button
                  onClick={() => setAddCalendarStep(addCalendarStep + 1)}
                  disabled={
                    (addCalendarStep === 0 && !calendarName.trim()) ||
                    (addCalendarStep === 1 && !icsUrl.trim())
                  }
                >
                  {t('common.next')}
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan' }}
                  onClick={handleSubmitExternalCalendar}
                >
                  {t('common.add')}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Модальное окно анализа конфликтов */}
      <Modal
        opened={analysisModalOpened}
        onClose={closeAnalysisModal}
        title={
          <Group gap="sm">
            <IconAlertCircle size={24} style={{ color: 'var(--mantine-color-orange-6)' }} />
            <Text fw={600}>{t('calendarManager.conflictAnalysis')}</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'xl'}
        centered
      >
        {analysisResult && (
          <Stack gap="md">
            <Alert
              icon={analysisResult.totalConflicts === 0 ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
              color={analysisResult.totalConflicts === 0 ? 'green' : 'orange'}
              variant="light"
            >
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {analysisResult.totalConflicts === 0
                    ? t('calendarManager.noConflicts')
                    : t('calendarManager.conflictsDetected', { count: analysisResult.totalConflicts })
                  }
                </Text>
                <Text size="xs">
                  {analysisResult.totalConflicts === 0
                    ? t('calendarManager.noConflictsDesc')
                    : t('calendarManager.conflictsDetectedDesc')
                  }
                </Text>
              </Stack>
            </Alert>

            {analysisResult.totalConflicts > 0 && (
              <Paper p="md" radius="md" withBorder style={{ maxHeight: '400px', overflow: 'auto' }}>
                <Stack gap="sm">
                  {analysisResult.conflicts.map((conflict: any, idx: number) => (
                    <Paper key={idx} p="sm" radius="md" withBorder>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Badge color="red" variant="filled">
                            {dayjs(conflict.date).format('DD.MM.YYYY')}
                          </Badge>
                          <Badge color="orange" variant="light">
                            {conflict.calendars.length} {t('calendarManager.calendars')}
                          </Badge>
                        </Group>
                        
                        {conflict.calendars.map((cal: any, calIdx: number) => (
                          <Paper key={calIdx} p="xs" radius="sm" withBorder bg="dark.6">
                            <Stack gap={4}>
                              <Text size="xs" fw={600}>{cal.calendar_name}</Text>
                              <Text size="xs">{cal.event_summary}</Text>
                              <Text size="xs" c="dimmed">
                                {t('calendarManager.period')}: {dayjs(cal.period_start).format('DD.MM.YYYY')} - {dayjs(cal.period_end).format('DD.MM.YYYY')}
                              </Text>
                              {cal.event_description && (
                                <Text size="xs" c="dimmed" fs="italic">
                                  {cal.event_description}
                                </Text>
                              )}
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}

            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Stack gap="xs">
                <Text size="sm" fw={600}>{t('calendarManager.whatHappensOnSync')}</Text>
                <List size="xs" spacing={4}>
                  <List.Item>{t('calendarManager.syncStep1')}</List.Item>
                  <List.Item>{t('calendarManager.syncStep2')}</List.Item>
                  <List.Item>{t('calendarManager.syncStep3')}</List.Item>
                  <List.Item>{t('calendarManager.syncStep4')}</List.Item>
                </List>
              </Stack>
            </Alert>

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={closeAnalysisModal}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                leftSection={<IconRefresh size={18} />}
                onClick={handleSyncCalendars}
                loading={syncing}
              >
                {t('calendarManager.continueSync')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Модальное окно информации об ICS */}
      <Modal
        opened={icsInfoModalOpened}
        onClose={closeIcsInfoModal}
        title={
          <Group gap="sm">
            <IconInfoCircle size={24} style={{ color: 'var(--mantine-color-blue-6)' }} />
            <Text fw={600}>{t('calendarManager.icsFileInfo')}</Text>
          </Group>
        }
        size={isMobile ? 'full' : 'lg'}
        centered
      >
        {icsInfo && (
          <Stack gap="lg">
            <Alert icon={<IconCircleCheck size={18} />} color="green" variant="light">
              <Text size="sm">{t('calendarManager.icsFileCreated')}</Text>
            </Alert>

            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('calendarManager.fileName')}:</Text>
                  <Text size="sm" fw={600}>{icsInfo.ics_filename}</Text>
                </Group>
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('calendarManager.blockedDays')}:</Text>
                  <Badge color="red" size="lg">{icsInfo.total_blocked_days}</Badge>
                </Group>
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">{t('calendarManager.lastUpdate')}:</Text>
                  <Text size="sm">{dayjs(icsInfo.updated_at).format('DD.MM.YYYY HH:mm')}</Text>
                </Group>

                <Divider />

                <Stack gap="xs">
                  <Text size="sm" fw={600}>{t('calendarManager.yourIcsLink')}:</Text>
                  <Group gap="xs">
                    <TextInput
                      value={`https://admin.novaestate.company${icsInfo.ics_url}`}
                      readOnly
                      style={{ flex: 1 }}
                      size="sm"
                      leftSection={<IconLink size={16} />}
                      styles={{ input: { fontSize: '16px' } }}
                    />
                    <CopyButton value={`https://admin.novaestate.company${icsInfo.ics_url}`}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? t('common.copied') : t('common.copy')}>
                          <ActionIcon
                            color={copied ? 'teal' : 'blue'}
                            variant="light"
                            onClick={copy}
                          >
                            {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <Tooltip label={t('calendarManager.openInNewTab')}>
                      <ActionIcon
                        color="blue"
                        variant="light"
                        onClick={() => window.open(`https://admin.novaestate.company${icsInfo.ics_url}`, '_blank')}
                      >
                        <IconExternalLink size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              </Stack>
            </Paper>

            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              <Stack gap="xs">
                <Text size="sm" fw={600}>{t('calendarManager.howToUseIcs')}</Text>
                <List size="xs" spacing={4}>
                  <List.Item>{t('calendarManager.icsUsage1')}</List.Item>
                  <List.Item>{t('calendarManager.icsUsage2')}</List.Item>
                  <List.Item>{t('calendarManager.icsUsage3')}</List.Item>
                </List>
              </Stack>
            </Alert>

            <Group justify="flex-end">
              <Button
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                leftSection={<IconDownload size={18} />}
                onClick={downloadICS}
              >
                {t('calendarManager.downloadIcs')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Модальное окно удаления периода */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setPeriodToDelete(null);
        }}
        title={t('calendarManager.deletePeriod')}
        centered
      >
        <Stack gap="md">
          <Text>
            {t('calendarManager.daysWillBeDeleted', { count: periodToDelete?.dates.length || 0 })}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                closeDeleteModal();
                setPeriodToDelete(null);
              }}
            >
              {t('common.no')}
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (periodToDelete) {
                  handleRemoveDates(periodToDelete.dates);
                  closeDeleteModal();
                  setPeriodToDelete(null);
                }
              }}
            >
              {t('common.yes')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Модальное окно удаления календаря */}
      <Modal
        opened={deleteCalendarModalOpened}
        onClose={() => {
          closeDeleteCalendarModal();
          setCalendarToDelete(null);
        }}
        title={t('calendarManager.deleteCalendar')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('calendarManager.deleteCalendarDesc')}</Text>
          <Group justify="center" gap="sm">
            <Button
              color="red"
              onClick={() => {
                if (calendarToDelete) {
                  handleRemoveExternalCalendar(calendarToDelete.id, true);
                }
              }}
            >
              {t('calendarManager.yesDeleteDates')}
            </Button>
            <Button
              variant="light"
              onClick={() => {
                if (calendarToDelete) {
                  handleRemoveExternalCalendar(calendarToDelete.id, false);
                }
              }}
            >
              {t('calendarManager.noKeepDates')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default CalendarManager;