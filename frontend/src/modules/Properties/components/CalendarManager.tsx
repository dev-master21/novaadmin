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
  Spin
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { propertiesApi } from '@/api/properties.api';
import dayjs from 'dayjs';
import './CalendarManager.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Text, Link } = Typography;

interface BlockedDate {
  blocked_date: string;
  reason: string | null;
}

interface CalendarManagerProps {
  propertyId: number;
}

const CalendarManager = ({ propertyId }: CalendarManagerProps) => {
  const [form] = Form.useForm();

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedDatesSet, setBlockedDatesSet] = useState<Set<string>>(new Set());
  const [icsInfo, setIcsInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
  const [isMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    loadCalendarData();
    loadICSInfo();
  }, [propertyId]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const { data } = await propertiesApi.getCalendar(propertyId);
      const blocked = data.data.blocked_dates || [];
      
      console.log('Raw blocked dates from API:', blocked);
      
      setBlockedDates(blocked);

      // ✅ Создаем Set для быстрой проверки
      const blockedSet = new Set<string>();
      blocked.forEach((item: BlockedDate) => {
        // Дата уже в формате YYYY-MM-DD благодаря DATE_FORMAT на backend
        blockedSet.add(item.blocked_date);
      });
      
      console.log('Blocked dates set:', Array.from(blockedSet));
      
      setBlockedDatesSet(blockedSet);
    } catch (error: any) {
      message.error('Ошибка загрузки календаря');
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

  const handleAddBlock = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmitBlock = async () => {
    try {
      const values = await form.validateFields();
      const [start, end] = values.dateRange;

      console.log('Adding period:', {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD')
      });

      await propertiesApi.addBlockedPeriod(propertyId, {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        reason: values.reason || null
      });

      message.success('Период успешно заблокирован');
      setModalVisible(false);
      loadCalendarData();
      loadICSInfo();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка блокировки периода');
    }
  };

  const handleRemoveDates = async (dates: string[]) => {
    try {
      console.log('Deleting dates (raw):', dates);
      
      // ✅ Даты уже в формате YYYY-MM-DD, просто отправляем их
      await propertiesApi.removeBlockedDates(propertyId, dates);
      message.success('Даты успешно разблокированы');
      loadCalendarData();
      loadICSInfo();
    } catch (error: any) {
      console.error('Delete error:', error);
      message.error('Ошибка удаления дат');
    }
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
    const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${months[selectedMonth]} ${selectedYear}`;
  };

  // Генерация календаря для выбранного месяца
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

  const isBlocked = (date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    return blockedDatesSet.has(dateStr);
  };

  const isCurrentMonth = (date: dayjs.Dayjs) => {
    return date.month() === selectedMonth;
  };

  // ✅ ИСПРАВЛЕНО: Группируем даты по непрерывным периодам
  const getGroupedPeriods = () => {
    if (blockedDates.length === 0) return [];

    // Сортируем даты
    const sorted = [...blockedDates].sort((a, b) =>
      a.blocked_date.localeCompare(b.blocked_date)
    );

    console.log('Sorted blocked dates:', sorted);

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

      // Если следующий день и тот же reason - объединяем в период
      if (dayDiff === 1 && sorted[i].reason === current.reason) {
        current.end = sorted[i].blocked_date;
        current.dates.push(sorted[i].blocked_date);
      } else {
        // Иначе сохраняем текущий период и начинаем новый
        periods.push({ ...current });
        current = {
          start: sorted[i].blocked_date,
          end: sorted[i].blocked_date,
          reason: sorted[i].reason,
          dates: [sorted[i].blocked_date]
        };
      }
    }

    // Добавляем последний период
    periods.push(current);
    
    console.log('Grouped periods:', periods);
    
    return periods;
  };

  const downloadICS = () => {
    if (icsInfo?.ics_url) {
      window.open(`https://admin.novaestate.company${icsInfo.ics_url}`, '_blank');
    }
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const calendar = generateCalendar();
  const periods = getGroupedPeriods();

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>Управление занятостью</span>
        </Space>
      }
      extra={
        <Space wrap>
          {icsInfo && (
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadICS}
              type="default"
              size="small"
            >
              Скачать .ics
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddBlock}
            size="small"
          >
            Добавить
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {icsInfo && (
            <Alert
              message="Файл календаря (.ics)"
              description={
                <Space direction="vertical" size={4}>
                  <Text>
                    Заблокировано дней: <strong>{icsInfo.total_blocked_days}</strong>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Обновлено: {dayjs(icsInfo.updated_at).format('DD.MM.YYYY HH:mm')}
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

          {/* Навигация по месяцам */}
          <div style={{ 
            marginBottom: 16, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '12px 0'
          }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={goToPreviousMonth}
              style={{ fontSize: 18 }}
            />
            <div style={{ 
              fontSize: 18, 
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
              style={{ fontSize: 18 }}
            />
          </div>

          {/* Календарь */}
          <div className="compact-calendar">
            {/* Заголовки дней недели */}
            <div className="calendar-header">
              {weekDays.map(day => (
                <div key={day} className="calendar-weekday">
                  {day}
                </div>
              ))}
            </div>

            {/* Дни */}
            <div className="calendar-body">
              {calendar.map((week, weekIndex) => (
                <div key={weekIndex} className="calendar-week">
                  {week.map((day) => {
                    const blocked = isBlocked(day);
                    const current = isCurrentMonth(day);
                    const today = day.isSame(dayjs(), 'day');

                    return (
                      <div
                        key={day.format('YYYY-MM-DD')}
                        className={`
                          calendar-day
                          ${!current ? 'other-month' : ''}
                          ${today ? 'today' : ''}
                          ${blocked ? 'blocked' : ''}
                        `}
                      >
                        <span className="day-number">{day.date()}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Легенда */}
          <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                background: '#1890ff', 
                borderRadius: 4 
              }} />
              <span style={{ fontSize: 13 }}>Сегодня</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                background: '#881f1f', 
                borderRadius: 4
              }} />
              <span style={{ fontSize: 13 }}>Заблокировано</span>
            </div>
          </div>

          {periods.length > 0 && (
            <Card title="Заблокированные периоды" size="small">
              <List
                dataSource={periods}
                renderItem={(period) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="delete"
                        title="Удалить этот период?"
                        description={`Будет удалено ${period.dates.length} дней`}
                        onConfirm={() => handleRemoveDates(period.dates)}
                        okText="Да"
                        cancelText="Нет"
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                        >
                          Удалить
                        </Button>
                      </Popconfirm>
                    ]}
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
                            {period.dates.length === 1 ? 'день' : period.dates.length < 5 ? 'дня' : 'дней'})
                          </Text>
                        </Space>
                      }
                      description={period.reason || 'Без описания'}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Space>
      </Spin>

      <Modal
        title="Добавить период занятости"
        open={modalVisible}
        onOk={handleSubmitBlock}
        onCancel={() => setModalVisible(false)}
        okText="Добавить"
        cancelText="Отмена"
        width={isMobile ? '95%' : 500}
        style={isMobile ? { top: 20 } : undefined}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="dateRange"
            label="Выберите период"
            rules={[{ required: true, message: 'Выберите период' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder={['Начало', 'Конец']}
              getPopupContainer={() => document.body}
              popupStyle={{
                maxWidth: isMobile ? 'calc(100vw - 32px)' : undefined
              }}
            />
          </Form.Item>

          <Form.Item name="reason" label="Описание (опционально)">
            <TextArea
              rows={3}
              placeholder="Причина блокировки (например: Забронировано, Ремонт, Личное использование)"
              maxLength={500}
            />
          </Form.Item>

          <Alert
            message="Внимание"
            description="Каждая дата в выбранном периоде будет заблокирована отдельно. После добавления будет автоматически обновлён .ics файл."
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </Card>
  );
};

export default CalendarManager;