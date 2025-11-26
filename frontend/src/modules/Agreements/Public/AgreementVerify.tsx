import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { message, Spin } from 'antd';
import { motion } from 'framer-motion';
import { 
  FiCheck, 
  FiFileText, 
  FiCalendar,
  FiUsers,
  FiDownload,
  FiAlertCircle
} from 'react-icons/fi';
import styled from 'styled-components';
import { agreementsApi } from '@/api/agreements.api';

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
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: center;
  align-items: center;
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
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  
  @media (max-width: 768px) {
    padding: 20px;
    margin-bottom: 16px;
  }
`;

const VerifiedBanner = styled.div`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  margin-bottom: 32px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2);
  
  @media (max-width: 768px) {
    padding: 24px;
    margin-bottom: 24px;
  }
`;

const VerifiedIcon = styled.div`
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  
  svg {
    width: 40px;
    height: 40px;
  }
`;

const VerifiedTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: white;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const VerifiedSubtitle = styled.p`
  font-size: 16px;
  margin: 0;
  opacity: 0.9;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const CardTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    color: #666;
  }
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const InfoLabel = styled.span`
  font-size: 13px;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InfoValue = styled.span`
  font-size: 16px;
  color: #1a1a1a;
  font-weight: 500;
`;

const SignersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
`;

const SignerItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const SignerInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const SignerName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
`;

const SignerRole = styled.div`
  font-size: 14px;
  color: #666;
  text-transform: capitalize;
`;

const SignerDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  
  @media (max-width: 768px) {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const SignaturePreview = styled.div`
  img {
    max-height: 60px;
    max-width: 150px;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    padding: 4px;
    background: white;
  }
`;

const SignedDate = styled.div`
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StatusBadge = styled.div<{ signed: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  
  ${props => props.signed ? `
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  ` : `
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  `}
`;

const DownloadButton = styled(motion.button)`
  width: 100%;
  padding: 16px 24px;
  background: #4096ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
  
  &:hover {
    background: #1677ff;
  }
  
  @media (max-width: 768px) {
    padding: 14px 20px;
    font-size: 15px;
  }
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

// Component
const AgreementVerify = () => {
  const { verifyLink } = useParams<{ verifyLink: string }>();
  
  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (verifyLink) {
      fetchAgreement();
    }
  }, [verifyLink]);

  const fetchAgreement = async () => {
    try {
      const response = await agreementsApi.getAgreementByVerifyLink(verifyLink!);
      setAgreement(response.data.data);
      setError(null);
    } catch (error: any) {
      console.error('Fetch error:', error);
      if (error.response?.status === 404) {
        setError('Agreement not found');
      } else {
        setError('Error loading agreement data');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

const handleDownloadPDF = async () => {
    if (!agreement || !verifyLink) return;
    
    setDownloading(true);
    try {
      const response = await agreementsApi.downloadPDFPublic(verifyLink);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${agreement.agreement_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('PDF downloaded successfully');
    } catch (error: any) {
      message.error('Error downloading PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spin size="large" />
        <div style={{ fontSize: '16px', color: '#666' }}>
          Loading agreement data...
        </div>
      </LoadingContainer>
    );
  }

  if (error || !agreement) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <FiAlertCircle />
        </ErrorIcon>
        <ErrorTitle>Agreement Not Found</ErrorTitle>
        <ErrorMessage>
          {error || 'The agreement you are looking for does not exist or has been removed.'}
        </ErrorMessage>
      </ErrorContainer>
    );
  }

  const allSigned = agreement.signatures && 
    agreement.signatures.length > 0 && 
    agreement.signatures.every((s: any) => s.is_signed);

  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <Logo src="https://admin.novaestate.company/nova-logo.svg" alt="NOVA Estate" />
        </HeaderContent>
      </Header>

      <MainContent>
        {allSigned && (
          <VerifiedBanner>
            <VerifiedIcon>
              <FiCheck />
            </VerifiedIcon>
            <VerifiedTitle>Agreement Verified and Valid</VerifiedTitle>
            <VerifiedSubtitle>
              This agreement has been verified and is legally valid
            </VerifiedSubtitle>
          </VerifiedBanner>
        )}

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CardTitle>
            <FiFileText size={20} />
            Agreement Information
          </CardTitle>

          <InfoGrid>
            <InfoItem>
              <InfoLabel>Agreement Number</InfoLabel>
              <InfoValue>{agreement.agreement_number}</InfoValue>
            </InfoItem>

            <InfoItem>
              <InfoLabel>Created Date</InfoLabel>
              <InfoValue>{formatDate(agreement.created_at)}</InfoValue>
            </InfoItem>

            <InfoItem>
              <InfoLabel>Start Date</InfoLabel>
              <InfoValue>{formatDate(agreement.date_from)}</InfoValue>
            </InfoItem>

            <InfoItem>
              <InfoLabel>End Date</InfoLabel>
              <InfoValue>{formatDate(agreement.date_to)}</InfoValue>
            </InfoItem>

            <InfoItem>
              <InfoLabel>Type</InfoLabel>
              <InfoValue style={{ textTransform: 'capitalize' }}>
                {agreement.type}
              </InfoValue>
            </InfoItem>

            <InfoItem>
              <InfoLabel>Status</InfoLabel>
              <InfoValue style={{ textTransform: 'capitalize' }}>
                {allSigned ? 'Signed' : agreement.status.replace('_', ' ')}
              </InfoValue>
            </InfoItem>
          </InfoGrid>
        </Card>

        {agreement.signatures && agreement.signatures.length > 0 && (
          <Card
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CardTitle>
              <FiUsers size={20} />
              Signatories
            </CardTitle>

            <SignersList>
              {agreement.signatures.map((signer: any) => (
                <SignerItem key={signer.id}>
                  <SignerInfo>
                    <SignerName>{signer.signer_name}</SignerName>
                    <SignerRole>{signer.signer_role}</SignerRole>
                  </SignerInfo>
                  
                  <SignerDetails>
                    {signer.is_signed && signer.signature_data && (
                      <SignaturePreview>
                        <img 
                          src={signer.signature_data} 
                          alt={`${signer.signer_name}'s signature`}
                        />
                      </SignaturePreview>
                    )}
                    
                    {signer.is_signed && signer.signed_at && (
                      <SignedDate>
                        <FiCalendar size={14} />
                        Signed on {formatDate(signer.signed_at)}
                      </SignedDate>
                    )}
                    
                    <StatusBadge signed={signer.is_signed}>
                      <FiCheck size={14} />
                      {signer.is_signed ? 'Signed' : 'Pending'}
                    </StatusBadge>
                  </SignerDetails>
                </SignerItem>
              ))}
            </SignersList>
          </Card>
        )}

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DownloadButton
            onClick={handleDownloadPDF}
            disabled={downloading}
            whileTap={{ scale: 0.98 }}
          >
            <FiDownload size={20} />
            {downloading ? 'Downloading...' : 'Download Agreement PDF'}
          </DownloadButton>
        </Card>
      </MainContent>
    </PageContainer>
  );
};

export default AgreementVerify;