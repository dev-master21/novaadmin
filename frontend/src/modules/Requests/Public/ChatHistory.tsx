import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { 
  FiUser,
  FiClock,
  FiAlertCircle,
  FiFile,
  FiPhone,
  FiPhoneMissed,
  FiPlay,
  FiPause,
  FiDownload,
  FiMic
} from 'react-icons/fi';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { requestsApi } from '@/api/requests.api';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/ru';
import ImageGallery from 'react-image-gallery';
import 'react-image-gallery/styles/css/image-gallery.css';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ru');

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  background: #ffffff;
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
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
  
  @media (max-width: 768px) {
    padding: 0 16px;
  }
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: #666;
  }
  
  @media (max-width: 768px) {
    font-size: 20px;
  }
`;

const Subtitle = styled.div`
  font-size: 14px;
  color: #666;
`;

const MessagesContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 24px 80px;
  
  @media (max-width: 768px) {
    padding: 16px 16px 60px;
  }
`;

const MessageItem = styled(motion.div)<{ isFromClient: boolean }>`
  display: flex;
  justify-content: ${props => props.isFromClient ? 'flex-end' : 'flex-start'};
  margin-bottom: 12px;
`;

const MessageBubble = styled.div<{ isFromClient: boolean }>`
  max-width: 70%;
  background: ${props => props.isFromClient ? '#007AFF' : '#E9ECEF'};
  color: ${props => props.isFromClient ? 'white' : '#1a1a1a'};
  border-radius: 18px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  
  @media (max-width: 768px) {
    max-width: 85%;
    padding: 10px 14px;
  }
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 6px;
`;

const MessageAuthor = styled.span`
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MessageTime = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MessageText = styled.div`
  font-size: 15px;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
`;

const MessageMedia = styled.div`
  margin-top: 8px;
`;

const PhotoGrid = styled.div<{ count: number }>`
  display: grid;
  grid-template-columns: ${props => props.count === 1 ? '1fr' : props.count === 2 ? '1fr 1fr' : 'repeat(3, 1fr)'};
  gap: 4px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  max-width: 400px;
  
  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const PhotoItem = styled.img`
  width: 100%;
  height: ${props => props.style?.height || '200px'};
  object-fit: cover;
  display: block;
  
  @media (max-width: 768px) {
    height: 150px;
  }
`;

const VideoPlayer = styled.video`
  max-width: 400px;
  width: 100%;
  border-radius: 12px;
  background: #000;
  
  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const AudioPlayer = styled.div<{ isFromClient: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'};
  border-radius: 12px;
  min-width: 250px;
`;

const PlayButton = styled.button<{ isFromClient: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'};
  color: ${props => props.isFromClient ? 'white' : '#1a1a1a'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  
  &:hover {
    background: ${props => props.isFromClient ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)'};
  }
  
  svg {
    font-size: 18px;
  }
`;

const AudioProgress = styled.div`
  flex: 1;
`;

const ProgressBar = styled.div<{ isFromClient: boolean }>`
  height: 4px;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'};
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
  cursor: pointer;
`;

const ProgressFill = styled.div<{ isFromClient: boolean }>`
  height: 100%;
  background: ${props => props.isFromClient ? 'white' : '#007AFF'};
  border-radius: 2px;
  transition: width 0.1s;
`;

const AudioTime = styled.div`
  font-size: 11px;
  opacity: 0.8;
`;

const DocumentItem = styled.a<{ isFromClient: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'};
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.isFromClient ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)'};
  }
`;

const DocumentIcon = styled.div<{ isFromClient: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    font-size: 20px;
  }
`;

const DocumentInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const DocumentName = styled.div`
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DocumentSize = styled.div`
  font-size: 12px;
  opacity: 0.7;
  margin-top: 2px;
`;

const PhoneCallItem = styled.div<{ isFromClient: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'};
  border-radius: 12px;
`;

const PhoneCallIcon = styled.div<{ isFromClient: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.isFromClient ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    font-size: 20px;
  }
`;

const PhoneCallText = styled.div`
  font-size: 14px;
`;

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  flex-direction: column;
  gap: 20px;
`;

const ErrorContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
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

const GalleryModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  
  @media (max-width: 768px) {
    padding: 0;
  }
  
  .image-gallery {
    max-width: 100%;
    max-height: 100vh;
  }
  
  .image-gallery-slide img {
    max-height: 85vh;
    object-fit: contain;
    
    @media (max-width: 768px) {
      max-height: 75vh;
    }
  }
`;

const GalleryClose = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  @media (max-width: 768px) {
    top: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    font-size: 24px;
    border: 2px solid rgba(255, 255, 255, 0.8);
    background: rgba(0, 0, 0, 0.85);
  }
`;

const WhatsAppBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #25D366;
  color: white;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
`;

const ScreenshotsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 24px;
`;

const ScreenshotItem = styled.div`
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  
  img {
    width: 100%;
    height: 300px;
    object-fit: cover;
    display: block;
  }
`;

// Component
const ChatHistory = () => {
  const { chatUuid } = useParams<{ chatUuid: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestInfo, setRequestInfo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<any[]>([]);
  
  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  
  // Audio states
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<number, number>>({});
  const audioRefs = useRef<Record<number, HTMLAudioElement>>({});

  const getBaseUrl = (): string => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return apiUrl.replace(/\/api\/?$/, '');
  };

  useEffect(() => {
    if (chatUuid) {
      fetchChatHistory();
    }
  }, [chatUuid]);

  useEffect(() => {
    if (messages.length > 0 && requestInfo) {
      // Группируем фото только для Telegram заявок
      if (requestInfo.request_source === 'telegram') {
        groupPhotoMessages();
      } else {
        // Для WhatsApp просто копируем сообщения
        setGroupedMessages(messages);
      }
    }
  }, [messages, requestInfo]);

  const fetchChatHistory = async () => {
    setLoading(true);
    try {
      const response = await requestsApi.getChatHistory(chatUuid!);
      console.log('API Response:', response.data.data);
      console.log('Request Info:', response.data.data.request_info);
      setRequestInfo(response.data.data.request_info);
      setMessages(response.data.data.messages);
      setError(null);
    } catch (err: any) {
      console.error('Fetch chat history error:', err);
      setError(err.response?.data?.message || 'Не удалось загрузить историю чата');
    } finally {
      setLoading(false);
    }
  };

  const groupPhotoMessages = () => {
    const grouped: any[] = [];
    let currentPhotoGroup: any[] = [];
    let lastFromId: string | null = null;

    messages.forEach((msg) => {
      const msgFromId = String(msg.from_telegram_id);
      
      if (msg.message_type === 'photo' && msgFromId === lastFromId) {
        currentPhotoGroup.push(msg);
      } else {
        if (currentPhotoGroup.length > 0) {
          grouped.push({
            type: 'photo_group',
            photos: currentPhotoGroup,
            from_telegram_id: lastFromId,
            message_date: currentPhotoGroup[0].message_date
          });
          currentPhotoGroup = [];
        }
        
        if (msg.message_type === 'photo') {
          currentPhotoGroup.push(msg);
          lastFromId = msgFromId;
        } else {
          grouped.push(msg);
          lastFromId = null;
        }
      }
    });

    if (currentPhotoGroup.length > 0) {
      grouped.push({
        type: 'photo_group',
        photos: currentPhotoGroup,
        from_telegram_id: lastFromId,
        message_date: currentPhotoGroup[0].message_date
      });
    }

    setGroupedMessages(grouped);
  };

  const formatDate = (date: string): string => {
    return dayjs(date).tz('Asia/Bangkok').format('DD MMMM YYYY');
  };

  const formatTime = (date: string): string => {
    return dayjs(date).tz('Asia/Bangkok').format('HH:mm');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openGallery = (photos: any[], startIndex: number = 0) => {
    const baseUrl = getBaseUrl();
    const images = photos.map(photo => ({
      original: `${baseUrl}${photo.media_file_path || photo}`,
      thumbnail: `${baseUrl}${photo.media_file_path || photo}`,
    }));
    
    setGalleryImages(images);
    setGalleryStartIndex(startIndex);
    setGalleryOpen(true);
  };

  const toggleAudio = (messageId: number, audioSrc: string) => {
    const baseUrl = getBaseUrl();
    
    if (playingAudio === messageId) {
      audioRefs.current[messageId]?.pause();
      setPlayingAudio(null);
    } else {
      if (playingAudio !== null) {
        audioRefs.current[playingAudio]?.pause();
      }
      
      if (!audioRefs.current[messageId]) {
        const audio = new Audio(`${baseUrl}${audioSrc}`);
        audioRefs.current[messageId] = audio;
        
        audio.addEventListener('timeupdate', () => {
          setAudioProgress(prev => ({
            ...prev,
            [messageId]: audio.currentTime
          }));
        });
        
        audio.addEventListener('loadedmetadata', () => {
          setAudioDurations(prev => ({
            ...prev,
            [messageId]: audio.duration
          }));
        });
        
        audio.addEventListener('ended', () => {
          setPlayingAudio(null);
          setAudioProgress(prev => ({
            ...prev,
            [messageId]: 0
          }));
        });
      }
      
      audioRefs.current[messageId].play();
      setPlayingAudio(messageId);
    }
  };

  const seekAudio = (messageId: number, progress: number) => {
    const audio = audioRefs.current[messageId];
    if (audio) {
      audio.currentTime = progress;
      setAudioProgress(prev => ({
        ...prev,
        [messageId]: progress
      }));
    }
  };

  const renderPhotoGroup = (photos: any[]) => {
    const baseUrl = getBaseUrl();
    const count = Math.min(photos.length, 9);
    
    const validPhotos = photos.filter(p => {
      if (!p.media_file_path) {
        console.error('Photo missing media_file_path:', p.id);
        return false;
      }
      return true;
    });
    
    if (validPhotos.length === 0) {
      return (
        <div style={{ 
          padding: '12px', 
          background: 'rgba(255,0,0,0.1)', 
          borderRadius: '8px',
          fontSize: '13px',
          color: '#dc2626'
        }}>
          ⚠️ Фотографии не загружены
        </div>
      );
    }
    
    return (
      <PhotoGrid count={count} onClick={() => openGallery(validPhotos)}>
        {validPhotos.slice(0, 9).map((photo) => (
          <PhotoItem
            key={photo.id}
            src={`${baseUrl}${photo.media_file_path}`}
            alt="Photo"
            style={{ height: count === 1 ? '300px' : count === 2 ? '200px' : '150px' }}
          />
        ))}
      </PhotoGrid>
    );
  };

  const renderMedia = (msg: any, isFromClient: boolean) => {
    const baseUrl = getBaseUrl();
    
    switch (msg.message_type) {
      case 'photo':
        if (!msg.media_file_path) {
          console.error('Photo media_file_path is empty for message:', msg.id);
          return (
            <div style={{ 
              padding: '12px', 
              background: 'rgba(255,0,0,0.1)', 
              borderRadius: '8px',
              fontSize: '13px',
              color: '#dc2626'
            }}>
              ⚠️ Фото не загружено
            </div>
          );
        }
        
        console.log('Photo URL:', `${baseUrl}${msg.media_file_path}`);
        
        return (
          <PhotoGrid count={1} onClick={() => openGallery([msg])}>
            <PhotoItem
              src={`${baseUrl}${msg.media_file_path}`}
              alt="Photo"
              style={{ height: '300px' }}
              onError={(e) => {
                console.error('Failed to load image:', `${baseUrl}${msg.media_file_path}`);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </PhotoGrid>
        );
      
      case 'video':
        return (
          <VideoPlayer controls>
            <source src={`${baseUrl}${msg.media_file_path}`} type={msg.media_mime_type || 'video/mp4'} />
          </VideoPlayer>
        );
      
      case 'voice':
      case 'audio':
        const duration = audioDurations[msg.id] || msg.media_duration || 0;
        const progress = audioProgress[msg.id] || 0;
        const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
        
        return (
          <AudioPlayer isFromClient={isFromClient}>
            <PlayButton 
              isFromClient={isFromClient}
              onClick={() => toggleAudio(msg.id, msg.media_file_path)}
            >
              {playingAudio === msg.id ? <FiPause /> : <FiPlay />}
            </PlayButton>
            <AudioProgress>
              <ProgressBar 
                isFromClient={isFromClient}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  seekAudio(msg.id, duration * percent);
                }}
              >
                <ProgressFill 
                  isFromClient={isFromClient}
                  style={{ width: `${progressPercent}%` }}
                />
              </ProgressBar>
              <AudioTime>
                {formatDuration(Math.floor(progress))} / {formatDuration(Math.floor(duration))}
              </AudioTime>
            </AudioProgress>
            <FiMic style={{ opacity: 0.6 }} />
          </AudioPlayer>
        );
      
      case 'document':
        return (
          <DocumentItem 
            isFromClient={isFromClient}
            href={`${baseUrl}${msg.media_file_path}`}
            download
            target="_blank"
          >
            <DocumentIcon isFromClient={isFromClient}>
              <FiFile />
            </DocumentIcon>
            <DocumentInfo>
              <DocumentName>
                {msg.caption || 'Документ'}
              </DocumentName>
              {msg.media_file_size && (
                <DocumentSize>
                  {formatFileSize(msg.media_file_size)}
                </DocumentSize>
              )}
            </DocumentInfo>
            <FiDownload style={{ opacity: 0.6 }} />
          </DocumentItem>
        );
      
      case 'phone_call':
        return (
          <PhoneCallItem isFromClient={isFromClient}>
            <PhoneCallIcon isFromClient={isFromClient}>
              {msg.media_duration ? <FiPhone /> : <FiPhoneMissed />}
            </PhoneCallIcon>
            <PhoneCallText>
              {msg.media_duration 
                ? `Звонок • ${formatDuration(msg.media_duration)}`
                : 'Пропущенный звонок'
              }
            </PhoneCallText>
          </PhoneCallItem>
        );
      
      default:
        return null;
    }
  };

  const renderWhatsAppScreenshots = () => {
    const baseUrl = getBaseUrl();
    const screenshots = messages.filter(msg => msg.message_type === 'whatsapp_screenshot');

    if (screenshots.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#999' 
        }}>
          Нет скриншотов
        </div>
      );
    }

    return (
      <ScreenshotsGrid>
        {screenshots.map((screenshot, index) => (
          <ScreenshotItem 
            key={screenshot.id}
            onClick={() => openGallery(screenshots.map(s => s.media_file_path), index)}
          >
            <img 
              src={`${baseUrl}${screenshot.media_file_path}`}
              alt={`Скриншот ${index + 1}`}
            />
          </ScreenshotItem>
        ))}
      </ScreenshotsGrid>
    );
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spin size="large" />
        <div style={{ fontSize: '16px', color: '#666' }}>
          Загрузка...
        </div>
      </LoadingContainer>
    );
  }

  if (error || !requestInfo) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <FiAlertCircle />
        </ErrorIcon>
        <ErrorTitle>История не найдена</ErrorTitle>
        <ErrorMessage>
          {error || 'Проверьте правильность ссылки или попробуйте позже'}
        </ErrorMessage>
      </ErrorContainer>
    );
  }

  const clientName = requestInfo.request_source === 'whatsapp'
    ? requestInfo.client_first_name || 'Клиент'
    : [requestInfo.client_first_name, requestInfo.client_last_name]
        .filter(Boolean)
        .join(' ') || requestInfo.client_username || 'Клиент';

  // Для WhatsApp заявок показываем скриншоты
  if (requestInfo.request_source === 'whatsapp') {
    return (
      <PageContainer>
        <Header>
          <HeaderContent>
            <Title>
              <FiUser size={24} />
              Скриншоты переписки
            </Title>
            <Subtitle>
              {clientName} • {requestInfo.request_number}
            </Subtitle>
            <WhatsAppBadge>
              📱 WhatsApp
            </WhatsAppBadge>
          </HeaderContent>
        </Header>

        <MessagesContainer>
          {renderWhatsAppScreenshots()}
        </MessagesContainer>

        {galleryOpen && (
          <GalleryModal onClick={() => setGalleryOpen(false)}>
            <GalleryClose onClick={() => setGalleryOpen(false)}>
              ×
            </GalleryClose>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '1000px' }}>
              <ImageGallery
                items={galleryImages}
                startIndex={galleryStartIndex}
                showPlayButton={false}
                showFullscreenButton={true}
                showThumbnails={galleryImages.length > 1}
              />
            </div>
          </GalleryModal>
        )}
      </PageContainer>
    );
  }

  // Для Telegram заявок показываем обычные сообщения
  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <Title>
            <FiUser size={24} />
            История чата
          </Title>
          <Subtitle>
            {clientName} • {requestInfo.request_number}
          </Subtitle>
        </HeaderContent>
      </Header>

      <MessagesContainer>
        {groupedMessages.map((item, index) => {
          if (item.type === 'photo_group') {
            const msgFromId = String(item.from_telegram_id);
            const clientId = String(requestInfo.client_telegram_id);
            const isFromClient = msgFromId === clientId;
            const isRightAligned = !isFromClient;

            const authorName = isFromClient ? clientName : 'Менеджер';
        
            const showDate = index === 0 || 
              formatDate(item.message_date) !== formatDate(groupedMessages[index - 1].message_date);
        
            return (
              <div key={`group-${index}`}>
                {showDate && (
                  <div style={{ 
                    textAlign: 'center', 
                    margin: '20px 0 10px',
                    fontSize: '13px',
                    color: '#999'
                  }}>
                    {formatDate(item.message_date)}
                  </div>
                )}

                <MessageItem
                  isFromClient={isRightAligned}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <MessageBubble isFromClient={isRightAligned}>
                    <MessageHeader>
                      <MessageAuthor>
                        <FiUser style={{ fontSize: 10 }} />
                        {authorName}
                      </MessageAuthor>
                      <span>•</span>
                      <MessageTime>
                        <FiClock style={{ fontSize: 10 }} />
                        {formatTime(item.message_date)}
                      </MessageTime>
                    </MessageHeader>

                    <MessageMedia>
                      {renderPhotoGroup(item.photos)}
                    </MessageMedia>
                  </MessageBubble>
                </MessageItem>
              </div>
            );
          }
      
          const msg = item;
          const msgFromId = String(msg.from_telegram_id);
          const clientId = String(requestInfo.client_telegram_id);
          const isFromClient = msgFromId === clientId;
          const isRightAligned = !isFromClient;
      
          const showDate = index === 0 || 
            formatDate(msg.message_date) !== formatDate(groupedMessages[index - 1].message_date);
      
          const authorName = isFromClient ? clientName : 'Менеджер';
      
          return (
            <div key={msg.id}>
              {showDate && (
                <div style={{ 
                  textAlign: 'center', 
                  margin: '20px 0 10px',
                  fontSize: '13px',
                  color: '#999'
                }}>
                  {formatDate(msg.message_date)}
                </div>
              )}

              <MessageItem
                isFromClient={isRightAligned}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <MessageBubble isFromClient={isRightAligned}>
                  <MessageHeader>
                    <MessageAuthor>
                      <FiUser style={{ fontSize: 10 }} />
                      {authorName}
                    </MessageAuthor>
                    <span>•</span>
                    <MessageTime>
                      <FiClock style={{ fontSize: 10 }} />
                      {formatTime(msg.message_date)}
                    </MessageTime>
                  </MessageHeader>

                  {msg.message_text && (
                    <MessageText>{msg.message_text}</MessageText>
                  )}

                  {msg.message_type !== 'text' && (
                    <MessageMedia>
                      {renderMedia(msg, isRightAligned)}
                    </MessageMedia>
                  )}
                </MessageBubble>
              </MessageItem>
            </div>
          );
        })}
      </MessagesContainer>

      {galleryOpen && (
        <GalleryModal onClick={() => setGalleryOpen(false)}>
          <GalleryClose onClick={() => setGalleryOpen(false)}>
            ×
          </GalleryClose>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '1000px' }}>
            <ImageGallery
              items={galleryImages}
              startIndex={galleryStartIndex}
              showPlayButton={false}
              showFullscreenButton={true}
              showThumbnails={galleryImages.length > 1}
            />
          </div>
        </GalleryModal>
      )}
    </PageContainer>
  );
};

export default ChatHistory;