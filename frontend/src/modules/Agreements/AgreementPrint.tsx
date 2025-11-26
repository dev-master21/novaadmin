import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import DocumentEditor from '@/components/DocumentEditor';
import axios from 'axios';

const AgreementPrint = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgreement = async () => {
      try {
        const token = searchParams.get('token');
        const internalKey = searchParams.get('internalKey');

        if (!token && !internalKey) {
          setError(t('agreementPrint.errors.noToken'));
          setLoading(false);
          return;
        }

        const endpoint = internalKey 
          ? `/agreements/${id}/internal`
          : `/agreements/${id}/public`;

        const params = internalKey 
          ? { internalKey }
          : { token };

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}${endpoint}`,
          { params }
        );

        setAgreement(response.data.data);
        setError(null);
      } catch (error: any) {
        console.error('Error loading agreement:', error);
        
        if (error.response?.status === 403) {
          setError(t('agreementPrint.errors.invalidToken'));
        } else if (error.response?.status === 404) {
          setError(t('agreementPrint.errors.notFound'));
        } else {
          setError(t('agreementPrint.errors.loadFailed'));
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAgreement();
    }
  }, [id, searchParams, t]);

  useEffect(() => {
    const internalKey = searchParams.get('internalKey');
    
    if (agreement && !loading && !error && !internalKey) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [agreement, loading, error, searchParams]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f9f6f3'
      }}>
        <Spin size="large" tip={t('agreementPrint.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f9f6f3',
        gap: '20px'
      }}>
        <div style={{ fontSize: '18px', color: '#ff4d4f' }}>
          {error}
        </div>
        <button
          onClick={() => navigate('/agreements')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            background: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {t('agreementPrint.backToList')}
        </button>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f9f6f3'
      }}>
        {t('agreementPrint.errors.notFound')}
      </div>
    );
  }

  return (
    <div style={{ background: '#f2eee8', minHeight: '100vh', padding: 0, margin: 0 }}>
      <DocumentEditor
        agreement={agreement}
        isEditing={false}
        logoUrl="https://admin.novaestate.company/nova-logo.svg"
      />
    </div>
  );
};

export default AgreementPrint;