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

interface BlockedDate {
  blocked_date: string;
  reason: string | null;
  is_check_in?: number | boolean;
  is_check_out?: number | boolean;
}

const CalendarModal = ({ propertyId, visible, onClose }: CalendarModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [blockedDatesMap, setBlockedDatesMap] = useState<Map<string, BlockedDate>>(new Map());
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

      const blockedMap = new Map<string, BlockedDate>();
      
      response.data.blocked_dates.forEach((item: BlockedDate) => {
        blockedMap.set(item.blocked_date, item);
      });

      response.data.bookings?.forEach((booking: any) => {
        const start = dayjs(booking.check_in_date);
        const end = dayjs(booking.check_out_date);
        
        let current = start;
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          const dateStr = current.format('YYYY-MM-DD');
          if (!blockedMap.has(dateStr)) {
            blockedMap.set(dateStr, {
              blocked_date: dateStr,
              reason: booking.guest_name || 'Booking',
              is_check_in: current.isSame(start, 'day') ? 1 : 0,
              is_check_out: current.isSame(end, 'day') ? 1 : 0
            });
          }
        }
      });

      setBlockedDatesMap(blockedMap);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasCalendarData = data && (data.blocked_dates.length > 0 || data.bookings?.length > 0);

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

  const weekDays = t('calendarManager.weekDays', { returnObjects: true }) as string[];
  const calendar = generateCalendar();

  return (
    <Modal
      title={t('calendarManager.calendarModalTitle')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
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
              message={t('calendarManager.noCalendarData')}
              description={t('calendarManager.noCalendarDataDesc')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

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
              size="large"
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
              size="large"
            />
          </div>

          <div className="modal-calendar-container">
            <div className="modal-calendar">
              <div className="modal-calendar-header">
                {weekDays.map(day => (
                  <div key={day} className="modal-calendar-weekday">
                    {day}
                  </div>
                ))}
              </div>

              <div className="modal-calendar-body">
                {calendar.map((week, weekIndex) => (
                  <div key={weekIndex} className="modal-calendar-week">
                    {week.map((day) => {
                      const status = getDateStatus(day);
                      const current = isCurrentMonth(day);
                      const today = day.isSame(dayjs(), 'day');

                      return (
                        <div
                          key={day.format('YYYY-MM-DD')}
                          className={`
                            modal-calendar-day
                            ${!current ? 'other-month' : ''}
                            ${today ? 'today' : ''}
                            ${status.blocked ? 'blocked' : ''}
                            ${status.checkIn && status.checkOut ? 'both-checks' : ''}
                            ${status.checkIn && !status.checkOut ? 'check-in' : ''}
                            ${!status.checkIn && status.checkOut ? 'check-out' : ''}
                          `}
                        >
                          <span className="modal-day-number">{day.date()}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-calendar-legend">
            <div className="modal-legend-item">
              <div className="modal-legend-square today-square" />
              <span>{t('calendarManager.today')}</span>
            </div>
            <div className="modal-legend-item">
              <div className="modal-legend-square blocked-square" />
              <span>{t('calendarManager.occupied')}</span>
            </div>
            <div className="modal-legend-item">
              <div className="modal-legend-square checkin-square" />
              <span>{t('calendarManager.checkIn')}</span>
            </div>
            <div className="modal-legend-item">
              <div className="modal-legend-square checkout-square" />
              <span>{t('calendarManager.checkOut')}</span>
            </div>
            <div className="modal-legend-item">
              <div className="modal-legend-square both-square" />
              <span>{t('calendarManager.checkInOut')}</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CalendarModal;