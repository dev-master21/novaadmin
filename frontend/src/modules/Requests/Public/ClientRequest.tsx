import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { message, Input, DatePicker, Button, Modal, Select, Spin } from 'antd';
import { createGlobalStyle } from 'styled-components';
import { motion } from 'framer-motion';
import { agreementsApi } from '@/api/agreements.api';
import { 
  FiUser,
  FiPhone,
  FiMessageCircle,
  FiCalendar,
  FiDollarSign,
  FiFileText,
  FiMapPin,
  FiClock,
  FiSave,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiCheckCircle,
  FiHome,
  FiX,
  FiPlus,
  FiEdit,
  FiThumbsDown,
  FiRefreshCw
} from 'react-icons/fi';
import styled from 'styled-components';
import { requestsApi, Request, FieldHistory } from '@/api/requests.api';
import ContractRequestModal from './ContractRequestModal';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/ru';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ru');

const { TextArea } = Input;
const { Option } = Select;

// Styled Components

const AntModalStyles = createGlobalStyle`
  .ant-modal-root {
    .ant-modal-content {
      background: white !important;
    }
    
    .ant-modal-header {
      background: white !important;
      border-bottom: 1px solid #e8e8e8 !important;
    }
    
    .ant-modal-body {
      background: white !important;
      
      /* Стилизация Input полей */
      .ant-input,
      input.ant-input {
        background: white !important;
        border: 1px solid #d9d9d9 !important;
        color: #1a1a1a !important;
        border-radius: 8px !important;
        padding: 10px 12px !important;
        
        &::placeholder {
          color: #bfbfbf !important;
        }
        
        &:hover {
          border-color: #40a9ff !important;
        }
        
        &:focus {
          border-color: #1890ff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1) !important;
        }
      }
      
      /* Стилизация TextArea */
      .ant-input-textarea {
        textarea.ant-input {
          background: white !important;
          border: 1px solid #d9d9d9 !important;
          color: #1a1a1a !important;
          border-radius: 8px !important;
          
          &::placeholder {
            color: #bfbfbf !important;
          }
        }
      }
      
      /* Стилизация Select */
      .ant-select {
        .ant-select-selector {
          background: white !important;
          border: 1px solid #d9d9d9 !important;
          color: #1a1a1a !important;
          border-radius: 8px !important;
          
          .ant-select-selection-search-input {
            color: #1a1a1a !important;
          }
          
          .ant-select-selection-placeholder {
            color: #bfbfbf !important;
          }
          
          .ant-select-selection-item {
            color: #1a1a1a !important;
          }
        }
        
        &:hover .ant-select-selector {
          border-color: #40a9ff !important;
        }
        
        &.ant-select-focused .ant-select-selector {
          border-color: #1890ff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1) !important;
        }
      }
    }
    
    .ant-modal-footer {
      background: white !important;
      border-top: 1px solid #e8e8e8 !important;
      
      /* Стилизация кнопок в футере */
      .ant-btn {
        height: 40px !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        background: white !important;
        color: #1a1a1a !important;
        border: 1px solid #d9d9d9 !important;
        
        &:hover:not(.ant-btn-primary) {
          border-color: #40a9ff !important;
          color: #40a9ff !important;
          background: white !important;
        }
        
        &.ant-btn-primary {
          background: #1890ff !important;
          color: white !important;
          border: 1px solid #1890ff !important;
          
          &:hover {
            background: #40a9ff !important;
            border-color: #40a9ff !important;
          }
        }
      }
    }
  }
  
  /* Dropdown для Select */
  .ant-select-dropdown {
    background: white !important;
    
    .ant-select-item {
      color: #1a1a1a !important;
      
      &:hover {
        background: #f5f5f5 !important;
      }
      
      &.ant-select-item-option-selected {
        background: #e6f7ff !important;
        color: #1890ff !important;
      }
    }
  }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const Header = styled.header`
  background: white;
  border-bottom: 1px solid #e8e8e8;
  padding: 24px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const HeaderContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  
  @media (max-width: 768px) {
    padding: 0 16px;
  }
`;

const Logo = styled.img`
  height: 72px;
  filter: brightness(0);
  
  @media (max-width: 768px) {
    height: 56px;
  }
`;

const MainContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 48px 24px;
  
  @media (max-width: 768px) {
    padding: 24px 16px;
  }
`;

const Card = styled(motion.div)`
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  
  @media (max-width: 768px) {
    padding: 20px;
    margin-bottom: 16px;
    border-radius: 12px;
  }
  
  /* Стилизация всех input полей внутри карточки */
  .ant-input,
  .ant-input-textarea textarea,
  .ant-picker,
  .ant-select-selector {
    background: #ffffff !important;
    border: 1px solid #d9d9d9 !important;
    border-radius: 8px !important;
    color: #1a1a1a !important;
    font-size: 14px !important;
    padding: 10px 12px !important;
    transition: all 0.2s !important;
    
    &:hover {
      border-color: #40a9ff !important;
    }
    
    &:focus,
    &.ant-input-focused,
    &.ant-picker-focused {
      border-color: #1890ff !important;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1) !important;
    }
  }
  
  .ant-input-textarea textarea {
    min-height: 80px !important;
  }
  
  .ant-picker-input > input {
    color: #1a1a1a !important;
  }
  
  .ant-select-selection-placeholder {
    color: #bfbfbf !important;
  }
  
  .ant-input::placeholder,
  .ant-input-textarea textarea::placeholder {
    color: #bfbfbf !important;
  }
  
  /* Исправляем кнопки внутри Card - делаем их светлыми */
  .ant-btn {
    background: white !important;
    color: #1a1a1a !important;
    border: 1px solid #d9d9d9 !important;
    
    &.ant-btn-primary {
      background: #1890ff !important;
      color: white !important;
      border: 1px solid #1890ff !important;
    }
    
    &.ant-btn-dashed {
      background: white !important;
      color: #1a1a1a !important;
      border: 1px dashed #d9d9d9 !important;
    }
  }
`;

const CardTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    color: #1890ff;
  }
  
  @media (max-width: 768px) {
    font-size: 18px;
    margin-bottom: 20px;
  }
`;

const StatusBadge = styled.div<{ status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'new':
        return `
          background: #e6f7ff;
          color: #1890ff;
          border: 1px solid #91d5ff;
        `;
      case 'in_progress':
        return `
          background: #fff7e6;
          color: #fa8c16;
          border: 1px solid #ffd591;
        `;
      case 'completed':
        return `
          background: #f6ffed;
          color: #52c41a;
          border: 1px solid #b7eb8f;
        `;
      case 'deal_created':
        return `
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        `;
      case 'rejected':
        return `
          background: #fff1f0;
          color: #ff4d4f;
          border: 1px solid #ffa39e;
        `;
      default:
        return `
          background: #f5f5f5;
          color: #666;
          border: 1px solid #d9d9d9;
        `;
    }
  }}
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-top: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
`;

const InfoLabel = styled.span`
  font-size: 12px;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  svg {
    font-size: 14px;
    color: #1890ff;
  }
`;

const InfoValue = styled.span`
  font-size: 15px;
  color: #1a1a1a;
  font-weight: 500;
`;

const FieldContainer = styled.div`
  margin-bottom: 28px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 10px;
  
  svg {
    color: #1890ff;
    font-size: 16px;
  }
`;

const FieldActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const SaveButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  border-radius: 8px;
  font-weight: 500;
`;

const HistoryToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  border: 1px solid #d9d9d9;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  height: 36px;
  font-weight: 500;
  
  &:hover {
    background: #fafafa;
    border-color: #40a9ff;
    color: #1890ff;
  }
`;

const HistoryList = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  max-height: 300px;
  overflow-y: auto;
`;

const HistoryItem = styled.div`
  padding: 12px 0;
  border-bottom: 1px solid #e8e8e8;
  
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  &:first-child {
    padding-top: 0;
  }
`;

const HistoryTime = styled.div`
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
  font-weight: 500;
`;

const HistoryValue = styled.div`
  font-size: 14px;
  color: #1a1a1a;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  margin-bottom: 4px;
`;

const HistoryAuthor = styled.div`
  font-size: 12px;
  color: #1890ff;
  margin-top: 4px;
  font-weight: 500;
`;

const ChatButton = styled(Button)`
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  margin-top: 20px;
  border-radius: 10px;
  font-weight: 500;
`;

const PropertiesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
`;

const PropertyItem = styled.div`
  padding: 20px;
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  position: relative;
  transition: all 0.2s;
  
  &:hover {
    border-color: #d9d9d9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
`;

const PropertyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const PropertyInfo = styled.div`
  flex: 1;
`;

const PropertyName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 6px;
`;

const PropertyDetails = styled.div`
  font-size: 14px;
  color: #666;
  margin-top: 4px;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #ff4d4f;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: #fff1f0;
  }
  
  svg {
    font-size: 20px;
  }
`;

const PropertyRejection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
`;

const AddPropertyButton = styled(Button)`
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 15px;
`;

const ActionButtons = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 32px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ActionButton = styled(Button)<{ variant?: 'danger' | 'success' | 'warning' }>`
  height: 56px;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  
  ${props => props.variant === 'danger' && `
    background: #fff1f0;
    color: #ff4d4f;
    border: 1px solid #ffa39e;
    
    &:hover {
      background: #ffccc7 !important;
      border-color: #ff7875 !important;
      color: #ff4d4f !important;
    }
  `}
  
  ${props => props.variant === 'success' && `
    background: #f6ffed;
    color: #52c41a;
    border: 1px solid #b7eb8f;
    
    &:hover {
      background: #d9f7be !important;
      border-color: #95de64 !important;
      color: #52c41a !important;
    }
  `}
  
  ${props => props.variant === 'warning' && `
    background: #fffbe6;
    color: #faad14;
    border: 1px solid #ffe58f;
    
    &:hover {
      background: #fff7cc !important;
      border-color: #ffd666 !important;
      color: #faad14 !important;
    }
  `}
`;

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  flex-direction: column;
  gap: 20px;
`;

const ErrorContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  text-align: center;
`;

const ErrorIcon = styled.div`
  width: 80px;
  height: 80px;
  background: #fef2f2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 40px;
    height: 40px;
    color: #dc2626;
  }
`;

const ErrorTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const ErrorMessage = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
`;

// Component
const ClientRequest = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [agreementVerifyLink, setAgreementVerifyLink] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  
  // Field states
  const [description, setDescription] = useState('');
  const [checkInDate, setCheckInDate] = useState<any>(null);
  const [checkOutDate, setCheckOutDate] = useState<any>(null);
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [rentalPeriod, setRentalPeriod] = useState('');
  const [district, setDistrict] = useState('');
  
  // Price fields for deal completion
  const [ownerPrice, setOwnerPrice] = useState('');
  const [clientPrice, setClientPrice] = useState('');
  const [priceMarkupPercent, setPriceMarkupPercent] = useState(0);
  
  // History states
  const [historyVisible, setHistoryVisible] = useState<Record<string, boolean>>({});
  const [fieldHistories, setFieldHistories] = useState<Record<string, FieldHistory[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  
  // Modal states
  const [propertyModalVisible, setPropertyModalVisible] = useState(false);
  const [dealModalVisible, setDealModalVisible] = useState(false);
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [customPropertyName, setCustomPropertyName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Функция для расчета процента наценки
  const calculateMarkup = (owner: string, client: string) => {
    const ownerNum = parseFloat(owner) || 0;
    const clientNum = parseFloat(client) || 0;
    
    if (ownerNum === 0) {
      setPriceMarkupPercent(0);
      return;
    }
    
    const markup = ((clientNum - ownerNum) / ownerNum) * 100;
    setPriceMarkupPercent(Math.round(markup * 100) / 100);
  };

  useEffect(() => {
    if (uuid) {
      fetchRequest();
      fetchProperties();
    }
  }, [uuid]);

useEffect(() => {
  if (request && request.agreement_id) {
    // Загружаем информацию о договоре
    fetchAgreementInfo(request.agreement_id);
  }
}, [request]);

  useEffect(() => {
    if (request) {
      // Заполняем поля данными из заявки
      setDescription(request.description || '');
      setCheckInDate(request.check_in_date ? dayjs(request.check_in_date) : null);
      setCheckOutDate(request.check_out_date ? dayjs(request.check_out_date) : null);
      setBudget(request.budget || '');
      setNotes(request.notes || '');
      setRentalPeriod(request.rental_period || '');
      setDistrict(request.district || '');
      
      // Загружаем цены если они есть
      setOwnerPrice((request as any).owner_price?.toString() || '');
      setClientPrice((request as any).client_price?.toString() || '');
      setPriceMarkupPercent((request as any).price_markup_percent || 0);
    }
  }, [request]);

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const response = await requestsApi.getByUuid(uuid!);
      setRequest(response.data.data);
      setError(null);
    } catch (err: any) {
      console.error('Fetch request error:', err);
      setError(err.response?.data?.message || 'Не удалось загрузить заявку');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await requestsApi.getProperties();
      setProperties(response.data.data);
    } catch (err) {
      console.error('Fetch properties error:', err);
    }
  };

const fetchAgreementInfo = async (agreementId: number) => {
  try {
    const response = await agreementsApi.getById(agreementId);
    if (response.data.success) {
      setAgreementVerifyLink(response.data.data.verify_link || null);
    }
  } catch (err) {
    console.error('Error fetching agreement:', err);
  }
};

  const saveField = async (fieldName: string, fieldValue: any) => {
    if (!uuid) return;

    try {
      await requestsApi.updateField(uuid, {
        field_name: fieldName,
        field_value: fieldValue,
        agent_telegram_id: undefined
      });
      
      message.success('Поле успешно сохранено');
      
      // Обновляем только данные заявки без полной перезагрузки
      const response = await requestsApi.getByUuid(uuid);
      setRequest(response.data.data);
      
      // Перезагружаем историю для этого поля если она открыта
      if (historyVisible[fieldName]) {
        await loadFieldHistory(fieldName);
      }
      
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка сохранения');
    }
  };

  const loadFieldHistory = async (fieldName: string) => {
    if (!uuid) return;
    
    setLoadingHistory(prev => ({ ...prev, [fieldName]: true }));
    
    try {
      const response = await requestsApi.getFieldHistory(uuid, fieldName);
      setFieldHistories(prev => ({
        ...prev,
        [fieldName]: response.data.data
      }));
    } catch (err) {
      message.error('Ошибка загрузки истории');
    } finally {
      setLoadingHistory(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const toggleHistory = async (fieldName: string) => {
    const isVisible = historyVisible[fieldName];
    
    if (!isVisible) {
      // Загружаем историю при открытии
      await loadFieldHistory(fieldName);
    }
    
    setHistoryVisible(prev => ({
      ...prev,
      [fieldName]: !isVisible
    }));
  };

  const formatDateTime = (date: string): string => {
    return dayjs(date).tz('Asia/Bangkok').format('DD.MM.YYYY HH:mm');
  };

  const addProperty = async () => {
    if (!selectedProperty && !customPropertyName) {
      message.warning('Выберите объект или укажите название');
      return;
    }

    try {
      await requestsApi.addProposedProperty(uuid!, {
        property_id: selectedProperty || undefined,
        custom_name: customPropertyName || undefined,
        rejection_reason: rejectionReason || undefined,
        agent_telegram_id: undefined
      });
      
      message.success('Вариант добавлен');
      setPropertyModalVisible(false);
      setSelectedProperty(null);
      setCustomPropertyName('');
      setRejectionReason('');
      
      const response = await requestsApi.getByUuid(uuid!);
      setRequest(response.data.data);
      
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка добавления варианта');
    }
  };

  const removeProperty = async (_propertyId: number) => {
    message.info('Функция удаления будет добавлена');
  };

  const updateStatus = async (status: string, includeFinancials: boolean = false) => {
    try {
      const payload: any = {
        status,
        agent_telegram_id: undefined
      };
      
      if (includeFinancials && (status === 'completed' || status === 'deal_created')) {
        payload.owner_price = ownerPrice ? parseFloat(ownerPrice) : null;
        payload.client_price = clientPrice ? parseFloat(clientPrice) : null;
        payload.price_markup_percent = priceMarkupPercent;
      }
      
      await requestsApi.updateStatus(uuid!, payload);
      
      message.success('Статус обновлен');
      
      const response = await requestsApi.getByUuid(uuid!);
      setRequest(response.data.data);
      
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка обновления статуса');
    }
  };

  const openChatHistory = () => {
    if (request?.chat_uuid) {
      window.open(`/request/chat/${request.chat_uuid}`, '_blank');
    }
  };

  const getStatusText = (status: string): string => {
    const statuses: Record<string, string> = {
      'new': 'Новая',
      'in_progress': 'В работе',
      'rejected': 'Отказ',
      'completed': 'Выполнена',
      'deal_created': 'Договор создан'
    };
    return statuses[status] || status;
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spin size="large" />
        <div style={{ fontSize: '16px', color: '#666' }}>
          Загрузка заявки...
        </div>
      </LoadingContainer>
    );
  }

  if (error || !request) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <FiAlertCircle />
        </ErrorIcon>
        <ErrorTitle>Заявка не найдена</ErrorTitle>
        <ErrorMessage>
          {error || 'Проверьте правильность ссылки или попробуйте позже'}
        </ErrorMessage>
      </ErrorContainer>
    );
  }

  const clientName = [request.client_first_name, request.client_last_name]
    .filter(Boolean)
    .join(' ') || request.client_username || 'Клиент';

  const agentName = request.agent_username 
    ? `@${request.agent_username}`
    : request.agent_first_name
    ? [request.agent_first_name, request.agent_last_name].filter(Boolean).join(' ')
    : 'Не назначен';

  return (
    <PageContainer>
      <AntModalStyles />
      <Header>
        <HeaderContent>
          <Logo src="https://admin.novaestate.company/nova-logo.svg" alt="NOVA Estate" />
        </HeaderContent>
      </Header>

      <MainContent>
        {/* Основная информация */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <CardTitle>
              <FiFileText size={20} />
              Заявка {request.request_number}
            </CardTitle>
            <StatusBadge status={request.status}>
              {request.status === 'completed' && <FiCheckCircle size={14} />}
              {getStatusText(request.status)}
            </StatusBadge>
          </div>

          <InfoGrid>
            <InfoItem>
              <InfoLabel>
                <FiUser />
                Клиент
              </InfoLabel>
              <InfoValue>{clientName}</InfoValue>
            </InfoItem>

            {request.client_username && (
              <InfoItem>
                <InfoLabel>
                  <FiMessageCircle />
                  Username
                </InfoLabel>
                <InfoValue>@{request.client_username}</InfoValue>
              </InfoItem>
            )}

            {request.client_phone && (
              <InfoItem>
                <InfoLabel>
                  <FiPhone />
                  Телефон
                </InfoLabel>
                <InfoValue>{request.client_phone}</InfoValue>
              </InfoItem>
            )}

            <InfoItem>
              <InfoLabel>
                <FiUser />
                Агент
              </InfoLabel>
              <InfoValue>{agentName}</InfoValue>
            </InfoItem>

            {request.first_message_at && (
              <InfoItem>
                <InfoLabel>
                  <FiCalendar />
                  Первое сообщение
                </InfoLabel>
                <InfoValue>{formatDateTime(request.first_message_at)}</InfoValue>
              </InfoItem>
            )}

            {request.last_message_at && (
              <InfoItem>
                <InfoLabel>
                  <FiCalendar />
                  Последнее сообщение
                </InfoLabel>
                <InfoValue>{formatDateTime(request.last_message_at)}</InfoValue>
              </InfoItem>
            )}
          </InfoGrid>

          {request.initial_note && (
            <div style={{ marginTop: 24, padding: 16, background: '#e6f7ff', borderRadius: 12, border: '1px solid #91d5ff' }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4, fontWeight: 500 }}>Заметка при создании:</div>
              <div style={{ fontSize: 15, color: '#1a1a1a' }}>{request.initial_note}</div>
            </div>
          )}

          <ChatButton type="primary" size="large" onClick={openChatHistory}>
            <FiMessageCircle size={20} />
            Просмотреть историю чата
          </ChatButton>
        </Card>

        {/* Детали заявки */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CardTitle>
            <FiEdit size={20} />
            Детали заявки
          </CardTitle>

          {/* Описание */}
          <FieldContainer>
            <FieldLabel>
              <FiFileText />
              Описание заявки
            </FieldLabel>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание заявки"
              rows={4}
            />
            <FieldActions>
              <SaveButton 
                type="primary" 
                icon={<FiSave />}
                onClick={() => saveField('description', description)}
              >
                Сохранить
              </SaveButton>
              <HistoryToggle onClick={() => toggleHistory('description')}>
                {historyVisible['description'] ? <FiChevronUp /> : <FiChevronDown />}
                История
              </HistoryToggle>
            </FieldActions>
            {historyVisible['description'] && (
              <HistoryList>
                {loadingHistory['description'] ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                  </div>
                ) : fieldHistories['description']?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                    Нет истории изменений
                  </div>
                ) : (
                  fieldHistories['description']?.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                      <HistoryValue>{item.new_value || '(пусто)'}</HistoryValue>
                      {item.telegram_username && (
                        <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                      )}
                    </HistoryItem>
                  ))
                )}
              </HistoryList>
            )}
          </FieldContainer>

          {/* Даты заезда/выезда */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <FieldContainer>
              <FieldLabel>
                <FiCalendar />
                Дата заезда
              </FieldLabel>
              <DatePicker
                value={checkInDate}
                onChange={(date) => setCheckInDate(date)}
                style={{ width: '100%' }}
                placeholder="Выберите дату"
              />
              <FieldActions>
                <SaveButton 
                  type="primary" 
                  icon={<FiSave />}
                  onClick={() => saveField('check_in_date', checkInDate ? checkInDate.format('YYYY-MM-DD') : null)}
                >
                  Сохранить
                </SaveButton>
                <HistoryToggle onClick={() => toggleHistory('check_in_date')}>
                  {historyVisible['check_in_date'] ? <FiChevronUp /> : <FiChevronDown />}
                  История
                </HistoryToggle>
              </FieldActions>
              {historyVisible['check_in_date'] && (
                <HistoryList>
                  {loadingHistory['check_in_date'] ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <Spin size="small" />
                    </div>
                  ) : fieldHistories['check_in_date']?.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                      Нет истории изменений
                    </div>
                  ) : (
                    fieldHistories['check_in_date']?.map((item) => (
                      <HistoryItem key={item.id}>
                        <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                        <HistoryValue>{item.new_value ? dayjs(item.new_value).format('DD.MM.YYYY') : '(пусто)'}</HistoryValue>
                        {item.telegram_username && (
                          <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                        )}
                      </HistoryItem>
                    ))
                  )}
                </HistoryList>
              )}
            </FieldContainer>

            <FieldContainer>
              <FieldLabel>
                <FiCalendar />
                Дата выезда
              </FieldLabel>
              <DatePicker
                value={checkOutDate}
                onChange={(date) => setCheckOutDate(date)}
                style={{ width: '100%' }}
                placeholder="Выберите дату"
              />
              <FieldActions>
                <SaveButton 
                  type="primary" 
                  icon={<FiSave />}
                  onClick={() => saveField('check_out_date', checkOutDate ? checkOutDate.format('YYYY-MM-DD') : null)}
                >
                  Сохранить
                </SaveButton>
                <HistoryToggle onClick={() => toggleHistory('check_out_date')}>
                  {historyVisible['check_out_date'] ? <FiChevronUp /> : <FiChevronDown />}
                  История
                </HistoryToggle>
              </FieldActions>
              {historyVisible['check_out_date'] && (
                <HistoryList>
                  {loadingHistory['check_out_date'] ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <Spin size="small" />
                    </div>
                  ) : fieldHistories['check_out_date']?.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                      Нет истории изменений
                    </div>
                  ) : (
                    fieldHistories['check_out_date']?.map((item) => (
                      <HistoryItem key={item.id}>
                        <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                        <HistoryValue>{item.new_value ? dayjs(item.new_value).format('DD.MM.YYYY') : '(пусто)'}</HistoryValue>
                        {item.telegram_username && (
                          <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                        )}
                      </HistoryItem>
                    ))
                  )}
                </HistoryList>
              )}
            </FieldContainer>
          </div>

          {/* Бюджет */}
          <FieldContainer>
            <FieldLabel>
              <FiDollarSign />
              Бюджет
            </FieldLabel>
            <Input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Введите бюджет"
            />
            <FieldActions>
              <SaveButton 
                type="primary" 
                icon={<FiSave />}
                onClick={() => saveField('budget', budget)}
              >
                Сохранить
              </SaveButton>
              <HistoryToggle onClick={() => toggleHistory('budget')}>
                {historyVisible['budget'] ? <FiChevronUp /> : <FiChevronDown />}
                История
              </HistoryToggle>
            </FieldActions>
            {historyVisible['budget'] && (
              <HistoryList>
                {loadingHistory['budget'] ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                  </div>
                ) : fieldHistories['budget']?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                    Нет истории изменений
                  </div>
                ) : (
                  fieldHistories['budget']?.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                      <HistoryValue>{item.new_value || '(пусто)'}</HistoryValue>
                      {item.telegram_username && (
                        <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                      )}
                    </HistoryItem>
                  ))
                )}
              </HistoryList>
            )}
          </FieldContainer>

          {/* Срок аренды */}
          <FieldContainer>
            <FieldLabel>
              <FiClock />
              Срок аренды
            </FieldLabel>
            <Input
              value={rentalPeriod}
              onChange={(e) => setRentalPeriod(e.target.value)}
              placeholder="Например: 3 месяца"
            />
            <FieldActions>
              <SaveButton 
                type="primary" 
                icon={<FiSave />}
                onClick={() => saveField('rental_period', rentalPeriod)}
              >
                Сохранить
              </SaveButton>
              <HistoryToggle onClick={() => toggleHistory('rental_period')}>
                {historyVisible['rental_period'] ? <FiChevronUp /> : <FiChevronDown />}
                История
              </HistoryToggle>
            </FieldActions>
            {historyVisible['rental_period'] && (
              <HistoryList>
                {loadingHistory['rental_period'] ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                  </div>
                ) : fieldHistories['rental_period']?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                    Нет истории изменений
                  </div>
                ) : (
                  fieldHistories['rental_period']?.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                      <HistoryValue>{item.new_value || '(пусто)'}</HistoryValue>
                      {item.telegram_username && (
                        <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                      )}
                    </HistoryItem>
                  ))
                )}
              </HistoryList>
            )}
          </FieldContainer>

          {/* Район */}
          <FieldContainer>
            <FieldLabel>
              <FiMapPin />
              Район
            </FieldLabel>
            <Input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Введите район"
            />
            <FieldActions>
              <SaveButton 
                type="primary" 
                icon={<FiSave />}
                onClick={() => saveField('district', district)}
              >
                Сохранить
              </SaveButton>
              <HistoryToggle onClick={() => toggleHistory('district')}>
                {historyVisible['district'] ? <FiChevronUp /> : <FiChevronDown />}
                История
              </HistoryToggle>
            </FieldActions>
            {historyVisible['district'] && (
              <HistoryList>
                {loadingHistory['district'] ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                  </div>
                ) : fieldHistories['district']?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                    Нет истории изменений
                  </div>
                ) : (
                  fieldHistories['district']?.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                      <HistoryValue>{item.new_value || '(пусто)'}</HistoryValue>
                      {item.telegram_username && (
                        <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                      )}
                    </HistoryItem>
                  ))
                )}
              </HistoryList>
            )}
          </FieldContainer>

          {/* Примечание */}
          <FieldContainer>
            <FieldLabel>
              <FiFileText />
              Примечание
            </FieldLabel>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация"
              rows={3}
            />
            <FieldActions>
              <SaveButton 
                type="primary" 
                icon={<FiSave />}
                onClick={() => saveField('notes', notes)}
              >
                Сохранить
              </SaveButton>
              <HistoryToggle onClick={() => toggleHistory('notes')}>
                {historyVisible['notes'] ? <FiChevronUp /> : <FiChevronDown />}
                История
              </HistoryToggle>
            </FieldActions>
            {historyVisible['notes'] && (
              <HistoryList>
                {loadingHistory['notes'] ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" />
                  </div>
                ) : fieldHistories['notes']?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                    Нет истории изменений
                  </div>
                ) : (
                  fieldHistories['notes']?.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryTime>{formatDateTime(item.changed_at)}</HistoryTime>
                      <HistoryValue>{item.new_value || '(пусто)'}</HistoryValue>
                      {item.telegram_username && (
                        <HistoryAuthor>Изменил: @{item.telegram_username}</HistoryAuthor>
                      )}
                    </HistoryItem>
                  ))
                )}
              </HistoryList>
            )}
          </FieldContainer>
        </Card>

        {/* Предложенные варианты */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CardTitle>
            <FiHome size={20} />
            Предложенные варианты
          </CardTitle>

          <PropertiesList>
            {request.proposed_properties && request.proposed_properties.length > 0 ? (
              request.proposed_properties.map((prop) => (
                <PropertyItem key={prop.id}>
                  <PropertyHeader>
                    <PropertyInfo>
                      <PropertyName>
                        {prop.property_name || prop.custom_name || 'Объект'}
                      </PropertyName>
                      {prop.property_number && (
                        <PropertyDetails>№ {prop.property_number}</PropertyDetails>
                      )}
                      {prop.address && (
                        <PropertyDetails>{prop.address}</PropertyDetails>
                      )}
                    </PropertyInfo>
                    <RemoveButton onClick={() => removeProperty(prop.id)} title="Удалить">
                      <FiX />
                    </RemoveButton>
                  </PropertyHeader>
                  
                  {prop.rejection_reason && (
                    <PropertyRejection>
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 6, fontWeight: 500 }}>
                        Причина отказа:
                      </div>
                      <div style={{ fontSize: 14, color: '#666' }}>
                        {prop.rejection_reason}
                      </div>
                    </PropertyRejection>
                  )}
                </PropertyItem>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                Нет предложенных вариантов
              </div>
            )}
          </PropertiesList>

          <AddPropertyButton type="dashed" size="large" onClick={() => setPropertyModalVisible(true)}>
            <FiPlus size={20} />
            Добавить вариант
          </AddPropertyButton>
        </Card>

{/* Действия */}
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <CardTitle>Действия</CardTitle>

          {/* Показываем информацию если договор уже запрошен */}
          {request.contract_requested_at && (
            <div style={{
              padding: 20,
              background: '#e6f7ff',
              borderRadius: 12,
              border: '1px solid #91d5ff',
              marginBottom: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FiCheckCircle style={{ color: '#1890ff', fontSize: 20 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#0050b3' }}>
                  Договор уже запрошен
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#003a8c' }}>
                Запрос на создание договора был отправлен {new Date(request.contract_requested_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}

            <ActionButtons>
              {/* Показываем разные кнопки в зависимости от статуса */}
              {request.status === 'rejected' && (
                <ActionButton 
                  variant="warning" 
                  size="large"
                  onClick={() => updateStatus('in_progress')}
                >
                  <FiRefreshCw size={20} />
                  Возобновить
                </ActionButton>
              )}
            
              {request.status === 'deal_created' && (
                <>
                  {agreementVerifyLink && (
                    <ActionButton 
                      type="primary"
                      size="large"
                      onClick={() => window.open(`https://agreement.novaestate.company/agreement-verify/${agreementVerifyLink}`, '_blank')}
                    >
                      <FiFileText size={20} />
                      Просмотреть договор
                    </ActionButton>
                  )}
            
                  {/* ✅ ИСПРАВЛЕНО: Всегда открываем модальное окно для ввода цен */}
                  <ActionButton 
                    variant="success" 
                    size="large"
                    onClick={() => setDealModalVisible(true)}
                  >
                    <FiCheckCircle size={20} />
                    Выполнено
                  </ActionButton>
                </>
              )}
            
              {request.status === 'completed' && (
                <ActionButton 
                  variant="warning" 
                  size="large"
                  onClick={() => updateStatus('in_progress')}
                >
                  <FiRefreshCw size={20} />
                  Вернуть в работу
                </ActionButton>
              )}
            
              {(request.status !== 'completed' && request.status !== 'deal_created' && request.status !== 'rejected') && (
                <>
                  <ActionButton 
                    variant="danger" 
                    size="large"
                    onClick={() => updateStatus('rejected')}
                  >
                    <FiThumbsDown size={20} />
                    Отказался
                  </ActionButton>
              
                  <ActionButton 
                    variant="success" 
                    size="large"
                    onClick={() => setDealModalVisible(true)}
                  >
                    <FiCheckCircle size={20} />
                    Выполнено
                  </ActionButton>
              
                  {/* Показываем кнопку запроса договора только если договор еще не создан */}
                  {!request.contract_requested_at && !request.agreement_id && (
                    <ActionButton 
                      type="primary"
                      size="large"
                      onClick={() => setContractModalVisible(true)}
                    >
                      <FiFileText size={20} />
                      Запросить создание договора
                    </ActionButton>
                  )}
                </>
              )}
            </ActionButtons>
        </Card>

        {/* Модальное окно добавления варианта */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 600 }}>
              <FiHome style={{ color: '#1890ff' }} />
              Добавить вариант
            </div>
          }
          open={propertyModalVisible}
          onCancel={() => {
            setPropertyModalVisible(false);
            setSelectedProperty(null);
            setCustomPropertyName('');
            setRejectionReason('');
          }}
          onOk={addProperty}
          okText="Добавить"
          cancelText="Отмена"
          width={600}
        >
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>
              <FiHome />
              Выберите объект из базы данных
            </FieldLabel>
            <Select
              style={{ width: '100%' }}
              placeholder="Выберите объект"
              value={selectedProperty}
              onChange={(value) => {
                setSelectedProperty(value);
                if (value) setCustomPropertyName('');
              }}
              allowClear
              showSearch
              filterOption={(input, option: any) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              <Option value={0}>Не из базы данных</Option>
              {properties.map((prop) => (
                <Option key={prop.id} value={prop.id}>
                  {prop.property_name} ({prop.property_number})
                </Option>
              ))}
            </Select>
          </div>

          {(selectedProperty === 0 || selectedProperty === null) && (
            <div style={{ marginBottom: 20 }}>
              <FieldLabel>
                <FiEdit />
                Или укажите название вручную
              </FieldLabel>
              <Input
                value={customPropertyName}
                onChange={(e) => {
                  setCustomPropertyName(e.target.value);
                  if (e.target.value) setSelectedProperty(0);
                }}
                placeholder="Название объекта"
              />
            </div>
          )}

          <div>
            <FieldLabel>
              <FiThumbsDown />
              Причина отказа (если клиент отказался)
            </FieldLabel>
            <TextArea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Почему клиент отказался от этого варианта?"
              rows={3}
            />
          </div>
        </Modal>

        {/* Модальное окно выполнения сделки */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 600 }}>
              <FiCheckCircle style={{ color: '#52c41a' }} />
              Выполнено
            </div>
          }
          open={dealModalVisible}
          onCancel={() => {
            setDealModalVisible(false);
            setOwnerPrice('');
            setClientPrice('');
            setPriceMarkupPercent(0);
          }}
          width={600}
          footer={null}
        >
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 15, color: '#666', marginBottom: 20 }}>
              Укажите финансовые данные для завершения сделки:
            </p>
            
            {/* Стоимость у хозяина */}
            <FieldContainer>
              <FieldLabel>
                <FiDollarSign />
                Стоимость у хозяина <span style={{ color: '#ff4d4f' }}>*</span>
              </FieldLabel>
              <Input
                type="number"
                value={ownerPrice}
                onChange={(e) => {
                  setOwnerPrice(e.target.value);
                  calculateMarkup(e.target.value, clientPrice);
                }}
                placeholder="Введите стоимость"
                suffix="฿"
                style={{ fontSize: 16 }}
              />
            </FieldContainer>
            
            {/* Стоимость для клиента */}
            <FieldContainer>
              <FieldLabel>
                <FiDollarSign />
                Стоимость для клиента <span style={{ color: '#ff4d4f' }}>*</span>
              </FieldLabel>
              <Input
                type="number"
                value={clientPrice}
                onChange={(e) => {
                  setClientPrice(e.target.value);
                  calculateMarkup(ownerPrice, e.target.value);
                }}
                placeholder="Введите стоимость"
                suffix="฿"
                style={{ fontSize: 16 }}
              />
            </FieldContainer>
            
            {/* Автоматический расчет наценки */}
            {ownerPrice && clientPrice && (
              <div style={{
                padding: 16,
                background: priceMarkupPercent >= 0 ? '#f6ffed' : '#fff1f0',
                borderRadius: 12,
                border: `1px solid ${priceMarkupPercent >= 0 ? '#b7eb8f' : '#ffa39e'}`,
                marginBottom: 20
              }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
                  Наценка:
                </div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: priceMarkupPercent >= 0 ? '#52c41a' : '#ff4d4f'
                }}>
                  {priceMarkupPercent > 0 ? '+' : ''}{priceMarkupPercent}%
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  Разница: {Math.abs((parseFloat(clientPrice) || 0) - (parseFloat(ownerPrice) || 0)).toFixed(2)} ฿
                </div>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <Button 
              size="large"
              onClick={() => setDealModalVisible(false)}
              style={{ flex: 1, height: 48, fontSize: 15, borderRadius: 8 }}
            >
              Отмена
            </Button>
            <Button 
              type="primary"
              size="large"
              onClick={() => {
                if (!ownerPrice || !clientPrice) {
                  message.warning('Заполните обязательные поля');
                  return;
                }
                updateStatus('completed', true);
                setDealModalVisible(false);
              }}
              style={{ flex: 1, height: 48, fontSize: 15, borderRadius: 8 }}
            >
              <FiCheckCircle style={{ marginRight: 8 }} />
              Готово
            </Button>
          </div>
        </Modal>

        {/* Модальное окно запроса договора */}
        <ContractRequestModal
          visible={contractModalVisible}
          onCancel={() => setContractModalVisible(false)}
          onSuccess={() => {
            setContractModalVisible(false);
            fetchRequest();
          }}
          requestUuid={uuid!}
        />
      </MainContent>
    </PageContainer>
  );
};

export default ClientRequest;