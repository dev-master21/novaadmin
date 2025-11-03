// frontend/src/modules/Properties/components/CalendarModal.tsx
import { Modal, Spin, Alert, Button } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { propertiesApi } from '@/api/properties.api';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './CalendarModal.css';

interface CalendarModalProps {
  propertyId: number;
  visible: boolean;
  onClose: () => void;
}

const CalendarModal = ({ propertyId, visible, onClose }: CalendarModalProps) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [blockedDatesSet, setBlockedDatesSet] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());

  useEffect(() => {
    if (visible) {
      loadCalendar();
    }
  }, [visible, propertyId]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const { data: response } = await propertiesApi.getCalendar(propertyId);
      setData(response.data);

      // Создаем Set всех заблокированных дат
      const blocked = new Set<string>();
      
      // Добавляем blocked_dates
      response.data.blocked_dates.forEach((item: any) => {
        blocked.add(dayjs(item.blocked_date).format('YYYY-MM-DD'));
      });

      // Добавляем даты из бронирований
      response.data.bookings.forEach((booking: any) => {
        const start = dayjs(booking.check_in_date);
        const end = dayjs(booking.check_out_date);
        
        let current = start;
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          blocked.add(current.format('YYYY-MM-DD'));
          current = current.add(1, 'day');
        }
      });

      setBlockedDatesSet(blocked);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasCalendarData = data && (data.blocked_dates.length > 0 || data.bookings.length > 0);

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
    const months = i18n.language === 'ru'
      ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
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
    return blockedDatesSet.has(date.format('YYYY-MM-DD'));
  };

  const isCurrentMonth = (date: dayjs.Dayjs) => {
    return date.month() === selectedMonth;
  };

  const weekDays = i18n.language === 'ru'
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const calendar = generateCalendar();

  return (
    <Modal
      title={t('properties.calendar.title')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      className="calendar-modal"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {!hasCalendarData && (
            <Alert
              message={t('properties.calendar.noSync')}
              description={t('properties.calendar.noSyncDescription')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
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
              <span style={{ fontSize: 13 }}>{t('properties.calendar.today')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                background: '#881f1f', 
                borderRadius: 4
              }} />
              <span style={{ fontSize: 13 }}>{t('properties.calendar.blockedDay')}</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CalendarModal;