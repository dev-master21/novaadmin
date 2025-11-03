// frontend/src/modules/Properties/components/TranslationsEditor.tsx
import { Card, Tabs, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;


interface TranslationsEditorProps {
  value?: Record<string, { property_name: string; description: string }>;
  onChange?: (value: Record<string, { property_name: string; description: string }>) => void;
}

const TranslationsEditor = ({ value = {}, onChange }: TranslationsEditorProps) => {
  const { t } = useTranslation();

  const languages = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'th', label: 'ไทย', flag: '🇹🇭' },
    { code: 'zh', label: '中文', flag: '🇨🇳' }
  ];

  const handleChange = (langCode: string, field: string, fieldValue: string) => {
    const updated = {
      ...value,
      [langCode]: {
        ...value[langCode],
        [field]: fieldValue
      }
    };
    onChange?.(updated);
  };

  const tabItems = languages.map(lang => ({
    key: lang.code,
    label: (
      <Space>
        <span style={{ fontSize: 20 }}>{lang.flag}</span>
        <span>{lang.label}</span>
      </Space>
    ),
    children: (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            {t('properties.fields.propertyName')}
          </label>
          <Input
            value={value[lang.code]?.property_name || ''}
            onChange={(e) => handleChange(lang.code, 'property_name', e.target.value)}
            placeholder={t('properties.translations.namePlaceholder')}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            {t('properties.fields.description')}
          </label>
          <TextArea
            value={value[lang.code]?.description || ''}
            onChange={(e) => handleChange(lang.code, 'description', e.target.value)}
            placeholder={t('properties.translations.descriptionPlaceholder')}
            rows={6}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {(value[lang.code]?.description || '').length} {t('common.characters')}
          </div>
        </div>
      </Space>
    )
  }));

  return (
    <Card title={t('properties.translations.title')}>
      <Tabs items={tabItems} />
    </Card>
  );
};

export default TranslationsEditor;