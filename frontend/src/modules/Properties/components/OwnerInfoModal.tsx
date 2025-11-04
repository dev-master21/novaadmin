// frontend/src/modules/Properties/components/OwnerInfoModal.tsx
import { Modal, Descriptions, Empty, Typography } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Paragraph } = Typography;

interface OwnerInfoModalProps {
  visible: boolean;
  onClose: () => void;
  ownerData: {
    owner_name?: string;
    owner_phone?: string;
    owner_email?: string;
    owner_telegram?: string;
    owner_instagram?: string;
    owner_notes?: string;
  } | null;
}

const OwnerInfoModal = ({ visible, onClose, ownerData }: OwnerInfoModalProps) => {
  const { t } = useTranslation();

  if (!ownerData) {
    return (
      <Modal
        title={t('properties.ownerInfo')}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={600}
      >
        <Empty description={t('properties.noOwnerInfo')} />
      </Modal>
    );
  }

  const hasAnyInfo = ownerData.owner_name || ownerData.owner_phone || ownerData.owner_email || 
                      ownerData.owner_telegram || ownerData.owner_instagram || ownerData.owner_notes;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined />
          <span>{t('properties.ownerInfo')}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      {hasAnyInfo ? (
        <Descriptions column={1} bordered>
          {ownerData.owner_name && (
            <Descriptions.Item 
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined />
                  {t('properties.ownerName')}
                </span>
              }
            >
              <strong>{ownerData.owner_name}</strong>
            </Descriptions.Item>
          )}
          
          {ownerData.owner_phone && (
            <Descriptions.Item 
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PhoneOutlined />
                  {t('properties.ownerPhone')}
                </span>
              }
            >
              <a href={`tel:${ownerData.owner_phone}`}>{ownerData.owner_phone}</a>
            </Descriptions.Item>
          )}
          
          {ownerData.owner_email && (
            <Descriptions.Item 
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MailOutlined />
                  {t('properties.ownerEmail')}
                </span>
              }
            >
              <a href={`mailto:${ownerData.owner_email}`}>{ownerData.owner_email}</a>
            </Descriptions.Item>
          )}
          
          {ownerData.owner_telegram && (
            <Descriptions.Item 
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageOutlined />
                  {t('properties.ownerTelegram')}
                </span>
              }
            >
              <a href={`https://t.me/${ownerData.owner_telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                {ownerData.owner_telegram}
              </a>
            </Descriptions.Item>
          )}
          
          {ownerData.owner_instagram && (
            <Descriptions.Item 
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageOutlined />
                  {t('properties.ownerInstagram')}
                </span>
              }
            >
              <a href={`https://instagram.com/${ownerData.owner_instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                {ownerData.owner_instagram}
              </a>
            </Descriptions.Item>
          )}
          
          {ownerData.owner_notes && (
            <Descriptions.Item label={t('properties.ownerNotes')}>
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {ownerData.owner_notes}
              </Paragraph>
            </Descriptions.Item>
          )}
        </Descriptions>
      ) : (
        <Empty description={t('properties.noOwnerInfo')} />
      )}
    </Modal>
  );
};

export default OwnerInfoModal;