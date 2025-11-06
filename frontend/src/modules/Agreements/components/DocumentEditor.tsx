// frontend/src/modules/Agreements/components/DocumentEditor.tsx
import { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Divider } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import './DocumentEditor.css';

interface DocumentEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

const DocumentEditor = ({ initialContent = '', onChange, readOnly = false }: DocumentEditorProps) => {
  const [content, setContent] = useState(initialContent);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (editorRef.current && !readOnly) {
      editorRef.current.innerHTML = content;
    }
  }, [content, readOnly]);

  const handleInput = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      onChange?.(newContent);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertVariable = (variable: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'variable-tag';
      span.textContent = `{{${variable}}}`;
      range.insertNode(span);
      range.collapse(false);
      handleInput();
    }
  };

  const commonVariables = [
    { key: 'agreement_number', label: 'Номер договора' },
    { key: 'date', label: 'Дата' },
    { key: 'city', label: 'Город' },
    { key: 'landlord_name', label: 'Арендодатель' },
    { key: 'tenant_name', label: 'Арендатор' },
    { key: 'property_name', label: 'Объект' },
    { key: 'property_address', label: 'Адрес' },
    { key: 'date_from', label: 'Дата начала' },
    { key: 'date_to', label: 'Дата окончания' }
  ];

  if (readOnly) {
    return (
      <div
        className="document-editor-readonly"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className="document-editor-container">
      {/* Панель инструментов */}
      <Card size="small" style={{ marginBottom: 8 }}>
        <Space split={<Divider type="vertical" />}>
          {/* Форматирование текста */}
          <Space size="small">
            <Button
              size="small"
              icon={<BoldOutlined />}
              onClick={() => execCommand('bold')}
              title="Жирный"
            />
            <Button
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => execCommand('italic')}
              title="Курсив"
            />
            <Button
              size="small"
              icon={<UnderlineOutlined />}
              onClick={() => execCommand('underline')}
              title="Подчёркнутый"
            />
          </Space>

          {/* Списки */}
          <Space size="small">
            <Button
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => execCommand('insertUnorderedList')}
              title="Маркированный список"
            />
            <Button
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => execCommand('insertOrderedList')}
              title="Нумерованный список"
            />
          </Space>

          {/* Переменные */}
          <Space size="small" wrap>
            {commonVariables.slice(0, 5).map(variable => (
              <Button
                key={variable.key}
                size="small"
                onClick={() => insertVariable(variable.key)}
                title={`Вставить: ${variable.label}`}
              >
                {variable.label}
              </Button>
            ))}
          </Space>
        </Space>
      </Card>

      {/* Редактор */}
      <div
        ref={editorRef}
        className="document-editor"
        contentEditable
        onInput={handleInput}
        style={{
          minHeight: '600px',
          padding: '20px',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          backgroundColor: '#fff'
        }}
      />
    </div>
  );
};

export default DocumentEditor;