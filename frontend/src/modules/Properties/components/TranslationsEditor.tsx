// frontend/src/modules/Properties/components/TranslationsEditor.tsx
import React from 'react';
import { Form, Input, Card, Space, Alert } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

interface TranslationsEditorProps {
  viewMode?: boolean;
}

const TranslationsEditor: React.FC<TranslationsEditorProps> = ({ viewMode = false }) => {
  const { t } = useTranslation();

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      
      <Alert
        message={t('translationsEditor.propertyNameInfo')}
        description={t('translationsEditor.propertyNameInfoDescription')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title={t('translationsEditor.languages.russian')} size="small">
        <Form.Item
          name={['translations', 'ru', 'description']}
          label={t('properties.description')}
        >
          <TextArea
            rows={10}
            placeholder={t('translationsEditor.placeholders.ru')}
            disabled={viewMode}
          />
        </Form.Item>
      </Card>

      <Card title={t('translationsEditor.languages.english')} size="small">
        <Form.Item
          name={['translations', 'en', 'description']}
          label={t('properties.description')}
        >
          <TextArea
            rows={10}
            placeholder={t('translationsEditor.placeholders.en')}
            disabled={viewMode}
          />
        </Form.Item>
      </Card>

      <Card title={t('translationsEditor.languages.thai')} size="small">
        <Form.Item
          name={['translations', 'th', 'description']}
          label={t('properties.description')}
        >
          <TextArea
            rows={10}
            placeholder={t('translationsEditor.placeholders.th')}
            disabled={viewMode}
          />
        </Form.Item>
      </Card>

      <Card title={t('translationsEditor.languages.chinese')} size="small">
        <Form.Item
          name={['translations', 'zh', 'description']}
          label={t('properties.description')}
        >
          <TextArea
            rows={10}
            placeholder={t('translationsEditor.placeholders.zh')}
            disabled={viewMode}
          />
        </Form.Item>
      </Card>

      <Card title={t('translationsEditor.languages.hebrew')} size="small">
        <Form.Item
          name={['translations', 'he', 'description']}
          label={t('properties.description')}
        >
          <TextArea
            rows={10}
            placeholder={t('translationsEditor.placeholders.he')}
            disabled={viewMode}
            dir="rtl"
          />
        </Form.Item>
      </Card>
    </Space>
  );
};

export default TranslationsEditor;