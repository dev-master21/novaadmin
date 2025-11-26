// frontend/src/modules/Properties/components/CalendarManager.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  DatePicker,
  Input,
  message,
  Space,
  Alert,
  Typography,
  List,
  Popconfirm,
  Tag,
  Spin,
  Switch,
  Divider,
  Table
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
  SyncOutlined,
  LinkOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import dayjs, { Dayjs } from 'dayjs';
import './CalendarManager.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Text, Link } = Typography;

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
  initialBlockedDates?: Array<{
    blocked_date: string;
    reason: string;
  }>;
}

const CalendarManager = ({ 
  propertyId, 
  viewMode = false,
  initialBlockedDates = []
}: CalendarManagerProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [externalCalendarForm] = Form.useForm();

  const [tempBlockedDates, setTempBlockedDates] = useState<BlockedDate[]>(
    initialBlockedDates || []
  );
  const isCreatingMode = propertyId === 0;

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedDatesMap, setBlockedDatesMap] = useState<Map<string, BlockedDate>>(new Map());
  const [icsInfo, setIcsInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
  const [isMobile] = useState(window.innerWidth < 768);

  const [externalCalendars, setExternalCalendars] = useState<ExternalCalendar[]>([]);
  const [externalCalendarModalVisible, setExternalCalendarModalVisible] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzingConflicts, setAnalyzingConflicts] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [hasConflict, setHasConflict] = useState(false);
  const [conflictDates, setConflictDates] = useState<string[]>([]);

  useEffect(() => {
    if (isCreatingMode && initialBlockedDates && initialBlockedDates.length > 0) {
      setTempBlockedDates(initialBlockedDates);
      loadCalendarData();
    }
  }, [initialBlockedDates]);

  useEffect(() => {
    loadCalendarData();
    loadICSInfo();
    loadExternalCalendars();
  }, [propertyId]);

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

    setLoading(true);
    try {
      const { data } = await propertiesApi.getCalendar(propertyId);
      const blocked = data.data.blocked_dates || [];
      
      setBlockedDates(blocked);

      const blockedMap = new Map<string, BlockedDate>();
      blocked.forEach((item: BlockedDate) => {
        blockedMap.set(item.blocked_date, item);
      });
      
      setBlockedDatesMap(blockedMap);
    } catch (error: any) {
      message.error(t('calendarManager.errorLoadingCalendar'));
    } finally {
      setLoading(false);
    }
  };

  const loadICSInfo = async () => {
    try {
      const { data } = await propertiesApi.getICSInfo(propertyId);
      setIcsInfo(data.data);
    } catch (error) {
      console.error('Failed to load ICS info:', error);
    }
  };

  const loadExternalCalendars = async () => {
    try {
      const { data } = await propertiesApi.getExternalCalendars(propertyId);
      setExternalCalendars(data.data || []);
    } catch (error) {
      console.error('Failed to load external calendars:', error);
    }
  };

  const handleAddBlock = () => {
    form.resetFields();
    setHasConflict(false);
    setConflictDates([]);
    setModalVisible(true);
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      const [start, end] = dates;
      const conflicts: string[] = [];
      
      let current = dayjs(start);
      const endDate = dayjs(end);
      
      while (current.isBefore(endDate, 'day') || current.isSame(endDate, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        if (blockedDatesMap.has(dateStr)) {
          conflicts.push(dateStr);
        }
        current = current.add(1, 'day');
      }

      if (conflicts.length > 0) {
        setHasConflict(true);
        setConflictDates(conflicts);
      } else {
        setHasConflict(false);
        setConflictDates([]);
      }
    } else {
      setHasConflict(false);
      setConflictDates([]);
    }
  };

  const handleSubmitBlock = async (forceAdd: boolean = false) => {
    try {
      const values = await form.validateFields();
      const [start, end] = values.dateRange;

      if (isCreatingMode) {
        const dates: BlockedDate[] = [];
        let currentDate = dayjs(start);
        const endDate = dayjs(end);
        
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate)) {
          dates.push({
            blocked_date: currentDate.format('YYYY-MM-DD'),
            reason: values.reason || null
          });
          currentDate = currentDate.add(1, 'day');
        }
        
        setTempBlockedDates([...tempBlockedDates, ...dates]);
        message.success(t('calendarManager.datesAddedTemporarily', { count: dates.length }));
        setModalVisible(false);
        setHasConflict(false);
        setConflictDates([]);
        
        loadCalendarData();
        return;
      }

      if (hasConflict && !forceAdd) {
        Modal.confirm({
          title: t('calendarManager.occupiedDatesDetected'),
          icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
          content: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                {t('calendarManager.periodHasOccupied', { count: conflictDates.length })}
              </Text>
              <div style={{ maxHeight: 150, overflow: 'auto', padding: '8px', background: '#1f1f1f', borderRadius: 4, border: '1px solid #303030' }}>
                {conflictDates.map(date => (
                  <div key={date} style={{ color: '#fff', padding: '2px 0' }}>
                    {dayjs(date).format('DD.MM.YYYY')}
                  </div>
                ))}
              </div>
              <Alert
                message={t('calendarManager.forceAdd')}
                description={t('calendarManager.forceAddDescription')}
                type="error"
                showIcon
              />
            </Space>
          ),
          okText: t('calendarManager.forceAddButton'),
          okButtonProps: { danger: true },
          cancelText: t('calendarManager.cancel'),
          onOk: () => handleSubmitBlock(true)
        });
        return;
      }

      if (forceAdd) {
        Modal.confirm({
          title: t('calendarManager.finalConfirmation'),
          icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
          content: (
            <Space direction="vertical">
              <Text strong>{t('calendarManager.areYouSure')}</Text>
              <Text type="danger">
                {t('calendarManager.actionWarning')}
              </Text>
            </Space>
          ),
          okText: t('calendarManager.yesImSure'),
          okButtonProps: { danger: true },
          cancelText: t('calendarManager.cancel'),
          onOk: async () => {
            if (conflictDates.length > 0) {
              await propertiesApi.removeBlockedDates(propertyId, conflictDates);
            }

            await propertiesApi.addBlockedPeriod(propertyId, {
              start_date: start.format('YYYY-MM-DD'),
              end_date: end.format('YYYY-MM-DD'),
              reason: values.reason || null
            });

            message.success(t('calendarManager.periodAddedForced'));
            setModalVisible(false);
            setHasConflict(false);
            setConflictDates([]);
            loadCalendarData();
            loadICSInfo();
          }
        });
        return;
      }

      await propertiesApi.addBlockedPeriod(propertyId, {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        reason: values.reason || null
      });

      message.success(t('calendarManager.periodBlocked'));
      setModalVisible(false);
      setHasConflict(false);
      setConflictDates([]);
      loadCalendarData();
      loadICSInfo();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('calendarManager.errorBlocking'));
    }
  };

  const handleRemoveDates = async (dates: string[]) => {
    if (isCreatingMode) {
      setTempBlockedDates(tempBlockedDates.filter(d => !dates.includes(d.blocked_date)));
      message.success(t('calendarManager.datesRemovedTemporarily'));
      loadCalendarData();
      return;
    }

    try {
      await propertiesApi.removeBlockedDates(propertyId, dates);
      message.success(t('calendarManager.datesUnblocked'));
      loadCalendarData();
      loadICSInfo();
    } catch (error: any) {
      message.error(t('calendarManager.errorRemovingDates'));
    }
  };

  const handleAddExternalCalendar = () => {
    externalCalendarForm.resetFields();
    setExternalCalendarModalVisible(true);
  };

  const handleSubmitExternalCalendar = async () => {
    try {
      const values = await externalCalendarForm.validateFields();
      
      await propertiesApi.addExternalCalendar(propertyId, {
        calendar_name: values.calendar_name,
        ics_url: values.ics_url
      });

      message.success(t('calendarManager.calendarAdded'));
      setExternalCalendarModalVisible(false);
      loadExternalCalendars();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('calendarManager.errorAddingCalendar'));
    }
  };

  const handleRemoveExternalCalendar = async (calendarId: number, removeDates: boolean) => {
    try {
      await propertiesApi.removeExternalCalendar(propertyId, calendarId, removeDates);
      message.success(t('calendarManager.calendarRemoved'));
      loadExternalCalendars();
      loadCalendarData();
      loadICSInfo();
    } catch (error: any) {
      message.error(t('calendarManager.errorRemovingCalendar'));
    }
  };

  const handleToggleExternalCalendar = async (calendarId: number, isEnabled: boolean) => {
    try {
      await propertiesApi.toggleExternalCalendar(propertyId, calendarId, isEnabled);
      message.success(t('calendarManager.syncToggled', { 
        state: isEnabled ? t('calendarManager.enabled') : t('calendarManager.disabled')
      }));
      loadExternalCalendars();
    } catch (error: any) {
      message.error(t('calendarManager.errorTogglingSync'));
    }
  };

  const handleAnalyzeCalendars = async () => {
    if (externalCalendars.length < 2) {
      message.warning(t('calendarManager.minTwoCalendars'));
      return;
    }

    setAnalyzingConflicts(true);
    try {
      const calendarIds = externalCalendars.map(c => c.id);
      const { data } = await propertiesApi.analyzeExternalCalendars(propertyId, calendarIds);
      
      setAnalysisResult(data.data);
      setAnalysisModalVisible(true);

      if (data.data.totalConflicts === 0) {
        message.success(t('calendarManager.noConflicts'));
      } else {
        message.warning(t('calendarManager.conflictsDetected', { count: data.data.totalConflicts }));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t('calendarManager.errorAnalyzing'));
    } finally {
      setAnalyzingConflicts(false);
    }
  };

  const handleSyncCalendars = async () => {
    setSyncing(true);
    try {
      const { data } = await propertiesApi.syncExternalCalendars(propertyId);
      
      if (data.success) {
        message.success(t('calendarManager.syncSuccess', {
          calendars: data.data.syncedCalendars,
          events: data.data.totalEvents
        }));
      } else {
        message.warning(t('calendarManager.syncWithErrors'));
      }

      loadExternalCalendars();
      loadCalendarData();
      loadICSInfo();
      setAnalysisModalVisible(false);
    } catch (error: any) {
      message.error(error.response?.data?.message || t('calendarManager.errorSyncing'));
    } finally {
      setSyncing(false);
    }
  };

  const dateRender = (current: Dayjs) => {
    const dateStr = current.format('YYYY-MM-DD');
    const blockedInfo = blockedDatesMap.get(dateStr);
    
    if (blockedInfo) {
      return (
        <div className="ant-picker-cell-inner" style={{ 
          background: '#2a1515', 
          color: '#ff4d4f',
          border: '1px solid #ff4d4f',
          borderRadius: '2px'
        }}>
          {current.date()}
        </div>
      );
    }
    
    return (
      <div className="ant-picker-cell-inner">
        {current.date()}
      </div>
    );
  };

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

  const getCurrentMonthName = () => {
    const months = t('calendarManager.months', { returnObjects: true }) as string[];
    return `${months[selectedMonth]} ${selectedYear}`;
  };

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

  const weekDays = t('calendarManager.weekDays', { returnObjects: true }) as string[];
  const calendar = generateCalendar();
  const periods = getGroupedPeriods();

  const conflictColumns = [
    {
      title: t('calendarManager.date'),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => (
        <span style={{ color: '#fff' }}>{dayjs(date).format('DD.MM.YYYY')}</span>
      )
    },
    {
      title: t('calendarManager.calendars'),
      dataIndex: 'calendars',
      key: 'calendars',
      render: (calendars: any[]) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {calendars.map((cal, idx) => (
            <div key={idx} className="analysis-calendar-item">
              <div className="analysis-calendar-name">{cal.calendar_name}</div>
              <div className="analysis-event-summary">{cal.event_summary}</div>
              <div className="analysis-event-period">
                {t('calendarManager.period')}: {dayjs(cal.period_start).format('DD.MM.YYYY')} - {dayjs(cal.period_end).format('DD.MM.YYYY')}
              </div>
              {cal.event_description && (
                <div className="analysis-event-description">
                  {cal.event_description}
                </div>
              )}
            </div>
          ))}
        </Space>
      )
    }
  ];

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>{t('calendarManager.title')}</span>
        </Space>
      }
      extra={
        !viewMode && (
          <Space wrap>
            {icsInfo && (
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadICS}
                type="default"
                size="small"
              >
                {t('calendarManager.downloadIcs')}
              </Button>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddBlock}
              size="small"
            >
              {t('calendarManager.addPeriod')}
            </Button>
          </Space>
        )
      }
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {!viewMode && !isCreatingMode && (
            <Card 
              title={
                <Space>
                  <SyncOutlined />
                  <span>{t('calendarManager.syncCalendars')}</span>
                </Space>
              }
              size="small"
              extra={
                <Space wrap>
                  {externalCalendars.length > 1 && (
                    <Button
                      size="small"
                      icon={<InfoCircleOutlined />}
                      onClick={handleAnalyzeCalendars}
                      loading={analyzingConflicts}
                    >
                      {t('calendarManager.analysis')}
                    </Button>
                  )}
                  {externalCalendars.length > 0 && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<SyncOutlined />}
                      onClick={handleSyncCalendars}
                      loading={syncing}
                    >
                      {t('calendarManager.synchronize')}
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddExternalCalendar}
                  >
                    {t('calendarManager.addCalendar')}
                  </Button>
                </Space>
              }
            >
              {externalCalendars.length === 0 ? (
                <Alert
                  message={t('calendarManager.noExternalCalendars')}
                  description={t('calendarManager.noExternalCalendarsDesc')}
                  type="info"
                  showIcon
                />
              ) : (
                <List
                  dataSource={externalCalendars}
                  renderItem={(calendar) => (
                    <List.Item
                      actions={[
                        <Switch
                          key="toggle"
                          checked={calendar.is_enabled}
                          onChange={(checked) => handleToggleExternalCalendar(calendar.id, checked)}
                          checkedChildren={t('calendarManager.on')}
                          unCheckedChildren={t('calendarManager.off')}
                        />,
                        <Popconfirm
                          key="delete"
                          title={t('calendarManager.deleteCalendar')}
                          description={
                            <Space direction="vertical">
                              <Text>{t('calendarManager.deleteCalendarDesc')}</Text>
                              <Space>
                                <Button
                                  size="small"
                                  danger
                                  onClick={() => {
                                    handleRemoveExternalCalendar(calendar.id, true);
                                  }}
                                >
                                  {t('calendarManager.yesDeleteDates')}
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    handleRemoveExternalCalendar(calendar.id, false);
                                  }}
                                >
                                  {t('calendarManager.noKeepDates')}
                                </Button>
                              </Space>
                            </Space>
                          }
                          showCancel={false}
                          icon={<WarningOutlined style={{ color: 'red' }} />}
                        >
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          calendar.is_enabled ? (
                            <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                          ) : (
                            <InfoCircleOutlined style={{ fontSize: 20, color: '#999' }} />
                          )
                        }
                        title={
                          <Space wrap>
                            <Text strong>{calendar.calendar_name}</Text>
                            {calendar.total_events > 0 && (
                              <Tag color="blue">{calendar.total_events} {t('calendarManager.events')}</Tag>
                            )}
                            {calendar.sync_error && (
                              <Tag color="red">{t('calendarManager.syncError')}</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={2}>
                            <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                              <LinkOutlined /> {calendar.ics_url}
                            </Text>
                            {calendar.last_sync_at && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {t('calendarManager.lastSync')}: {dayjs(calendar.last_sync_at).format('DD.MM.YYYY HH:mm')}
                              </Text>
                            )}
                            {calendar.sync_error && (
                              <Text type="danger" style={{ fontSize: 11 }}>
                                {t('calendarManager.error')}: {calendar.sync_error}
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          )}

          <Divider style={{ margin: '16px 0' }} />

          {isCreatingMode ? (
            <Alert
              message={t('calendarManager.occupancyCalendar')}
              description={
                <Space direction="vertical" size={4}>
                  <Text>
                    {t('calendarManager.icsCreatedAfter')}
                  </Text>
                  {tempBlockedDates.length > 0 && (
                    <Text>
                      {t('calendarManager.addedTemporarily')}: <strong>{tempBlockedDates.length}</strong> {t('calendarManager.dates')}
                    </Text>
                  )}
                </Space>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          ) : icsInfo && (
            <Alert
              message={t('calendarManager.combinedIcsFile')}
              description={
                <Space direction="vertical" size={4}>
                  <Text>
                    {t('calendarManager.blockedDays')}: <strong>{icsInfo.total_blocked_days}</strong>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('calendarManager.updated')}: {dayjs(icsInfo.updated_at).format('DD.MM.YYYY HH:mm')}
                  </Text>
                  <Link
                    href={`https://admin.novaestate.company${icsInfo.ics_url}`}
                    target="_blank"
                    style={{ fontSize: 12 }}
                  >
                    {icsInfo.ics_filename}
                  </Link>
                </Space>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
            />
          )}

          <div style={{ 
            marginBottom: 12, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '8px 0'
          }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={goToPreviousMonth}
              size="small"
              disabled={false}
            />
            <div style={{ 
              fontSize: 16, 
              fontWeight: 600,
              textAlign: 'center',
              flex: 1
            }}>
              {getCurrentMonthName()}
            </div>
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={goToNextMonth}
              size="small"
              disabled={false}
            />
          </div>

          <div className="modern-calendar-container">
            <div className="modern-calendar">
              <div className="modern-calendar-header">
                {weekDays.map(day => (
                  <div key={day} className="modern-calendar-weekday">
                    {day}
                  </div>
                ))}
              </div>

              <div className="modern-calendar-body">
                {calendar.map((week, weekIndex) => (
                  <div key={weekIndex} className="modern-calendar-week">
                    {week.map((day) => {
                      const status = getDateStatus(day);
                      const current = isCurrentMonth(day);
                      const today = day.isSame(dayjs(), 'day');

                      return (
                        <div
                          key={day.format('YYYY-MM-DD')}
                          className={`
                            modern-calendar-day
                            ${!current ? 'other-month' : ''}
                            ${today ? 'today' : ''}
                            ${status.blocked ? 'blocked' : ''}
                            ${status.checkIn && status.checkOut ? 'both-checks' : ''}
                            ${status.checkIn && !status.checkOut ? 'check-in' : ''}
                            ${!status.checkIn && status.checkOut ? 'check-out' : ''}
                          `}
                        >
                          <span className="modern-day-number">{day.date()}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-square today-square" />
              <span>{t('calendarManager.today')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-square blocked-square" />
              <span>{t('calendarManager.occupied')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-square checkin-square" />
              <span>{t('calendarManager.checkIn')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-square checkout-square" />
              <span>{t('calendarManager.checkOut')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-square both-square" />
              <span>{t('calendarManager.checkInOut')}</span>
            </div>
          </div>

          {periods.length > 0 && (
            <Card title={t('calendarManager.blockedPeriods')} size="small" style={{ marginTop: 16 }}>
              <List
                dataSource={periods}
                renderItem={(period) => (
                  <List.Item
                    actions={
                      !viewMode ? [
                        <Popconfirm
                          key="delete"
                          title={t('calendarManager.deletePeriod')}
                          description={t('calendarManager.daysWillBeDeleted', { count: period.dates.length })}
                          onConfirm={() => handleRemoveDates(period.dates)}
                          okText={t('calendarManager.yes')}
                          cancelText={t('calendarManager.no')}
                        >
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                          >
                            {t('calendarManager.delete')}
                          </Button>
                        </Popconfirm>
                      ] : []
                    }
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Tag color="red">
                            {dayjs(period.start).format('DD.MM.YYYY')} -{' '}
                            {dayjs(period.end).format('DD.MM.YYYY')}
                          </Tag>
                          <Text type="secondary">
                            ({period.dates.length}{' '}
                            {t('calendarManager.daysCount', { count: period.dates.length })})
                          </Text>
                        </Space>
                      }
                      description={period.reason || t('calendarManager.noDescription')}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Space>
      </Spin>

      <Modal
        title={t('calendarManager.addOccupancyPeriod')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setHasConflict(false);
          setConflictDates([]);
        }}
        footer={null}
        width={isMobile ? '95%' : 600}
        style={isMobile ? { top: 20 } : undefined}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="dateRange"
            label={t('calendarManager.selectPeriod')}
            rules={[{ required: true, message: t('calendarManager.selectPeriodRequired') }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder={[t('calendarManager.start'), t('calendarManager.end')]}
              onChange={handleDateRangeChange}
              dateRender={dateRender}
              inputReadOnly={isMobile}
            />
          </Form.Item>

          {hasConflict && (
            <Alert
              message={t('calendarManager.occupiedDatesDetected')}
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>
                    {t('calendarManager.periodHasOccupied', { count: conflictDates.length })}:
                  </Text>
                  <div style={{ 
                    maxHeight: 120, 
                    overflow: 'auto', 
                    padding: '8px', 
                    background: '#1f1f1f', 
                    borderRadius: 4, 
                    border: '1px solid #303030',
                    marginTop: 8
                  }}>
                    {conflictDates.slice(0, 10).map(date => (
                      <div key={date} style={{ color: '#ff4d4f', fontSize: 12, padding: '2px 0' }}>
                        • {dayjs(date).format('DD.MM.YYYY')}
                      </div>
                    ))}
                    {conflictDates.length > 10 && (
                      <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                        {t('calendarManager.andMoreDates', { count: conflictDates.length - 10 })}
                      </div>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                    {t('calendarManager.selectOtherPeriod')}
                  </Text>
                </Space>
              }
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item name="reason" label={t('calendarManager.descriptionOptional')}>
            <TextArea
              rows={3}
              placeholder={t('calendarManager.reasonPlaceholder')}
              maxLength={500}
            />
          </Form.Item>

          {!hasConflict && (
            <Alert
              message={t('calendarManager.info')}
              description={t('calendarManager.infoDescription')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => {
              setModalVisible(false);
              setHasConflict(false);
              setConflictDates([]);
            }}>
              {t('calendarManager.cancel')}
            </Button>
            
            {hasConflict ? (
              <Button
                type="primary"
                danger
                onClick={() => handleSubmitBlock(true)}
              >
                {t('calendarManager.forceAddButton')}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={() => handleSubmitBlock(false)}
              >
                {t('calendarManager.add')}
              </Button>
            )}
          </div>
        </Form>
      </Modal>

      <Modal
        title={t('calendarManager.addExternalCalendar')}
        open={externalCalendarModalVisible}
        onOk={handleSubmitExternalCalendar}
        onCancel={() => setExternalCalendarModalVisible(false)}
        okText={t('calendarManager.add')}
        cancelText={t('calendarManager.cancel')}
        width={isMobile ? '95%' : 600}
      >
        <Form form={externalCalendarForm} layout="vertical">
          <Form.Item
            name="calendar_name"
            label={t('calendarManager.serviceName')}
            rules={[{ required: true, message: t('calendarManager.specifyName') }]}
          >
            <Input 
              placeholder={t('calendarManager.serviceNamePlaceholder')}
              maxLength={255}
            />
          </Form.Item>

          <Form.Item
            name="ics_url"
            label={t('calendarManager.icsLink')}
            rules={[
              { required: true, message: t('calendarManager.specifyLink') },
              { type: 'url', message: t('calendarManager.invalidURL') }
            ]}
          >
            <Input 
              placeholder="https://example.com/calendar.ics"
              prefix={<LinkOutlined />}
            />
          </Form.Item>

          <Alert
            message={t('calendarManager.info')}
            description={t('calendarManager.externalCalendarInfo')}
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>{t('calendarManager.conflictAnalysis')}</span>
          </Space>
        }
        open={analysisModalVisible}
        onCancel={() => setAnalysisModalVisible(false)}
        width={isMobile ? '95%' : 900}
        footer={[
          <Button key="cancel" onClick={() => setAnalysisModalVisible(false)}>
            {t('calendarManager.cancel')}
          </Button>,
          <Button
            key="sync"
            type="primary"
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={handleSyncCalendars}
          >
            {t('calendarManager.continueSync')}
          </Button>
        ]}
      >
        {analysisResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message={
                analysisResult.totalConflicts === 0
                  ? t('calendarManager.noConflicts')
                  : t('calendarManager.conflictsDetected', { count: analysisResult.totalConflicts })
              }
              description={
                analysisResult.totalConflicts === 0
                  ? t('calendarManager.noConflictsDesc')
                  : t('calendarManager.conflictsDetectedDesc')
              }
              type={analysisResult.totalConflicts === 0 ? 'success' : 'warning'}
              showIcon
            />

            {analysisResult.totalConflicts > 0 && (
              <Table
                dataSource={analysisResult.conflicts}
                columns={conflictColumns}
                pagination={{ pageSize: 10 }}
                rowKey="date"
                size="small"
              />
            )}

            <Alert
              message={t('calendarManager.whatHappensOnSync')}
              description={
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>{t('calendarManager.syncStep1')}</li>
                  <li>{t('calendarManager.syncStep2')}</li>
                  <li>{t('calendarManager.syncStep3')}</li>
                  <li>{t('calendarManager.syncStep4')}</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default CalendarManager;