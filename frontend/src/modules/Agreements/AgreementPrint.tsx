import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import DocumentEditor from '@/components/DocumentEditor';
import axios from 'axios';

const AgreementPrint = () => {
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

        // Если нет ни токена, ни внутреннего ключа
        if (!token && !internalKey) {
          setError('Токен доступа отсутствует');
          setLoading(false);
          return;
        }

        // Определяем какой endpoint использовать
        const endpoint = internalKey 
          ? `/agreements/${id}/internal`
          : `/agreements/${id}/public`;

        const params = internalKey 
          ? { internalKey }
          : { token };

        // Запрашиваем договор
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}${endpoint}`,
          { params }
        );

        setAgreement(response.data.data);
        setError(null);
      } catch (error: any) {
        console.error('Error loading agreement:', error);
        
        if (error.response?.status === 403) {
          setError('Недействительный или истекший токен доступа');
        } else if (error.response?.status === 404) {
          setError('Договор не найден');
        } else {
          setError('Ошибка загрузки договора');
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAgreement();
    }
  }, [id, searchParams]);

  // Автоматически открываем диалог печати после загрузки (только для пользователей, не для Puppeteer)
  useEffect(() => {
    const internalKey = searchParams.get('internalKey');
    
    // Не открываем диалог печати если это Puppeteer (есть internalKey)
    if (agreement && !loading && !error && !internalKey) {
      // Задержка чтобы страница успела отрендериться
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
        <Spin size="large" tip="Загрузка договора..." />
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
          Вернуться к списку договоров
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
        Договор не найден
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