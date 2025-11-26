// frontend/src/modules/Agreements/Templates/CreateTemplate.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Switch,
  Tag,
  Divider,
  Collapse,
  Row,
  Col,
  Typography
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { agreementsApi } from '@/api/agreements.api';
import './CreateTemplate.css';

const { Option } = Select;
const { Text } = Typography;

const CreateTemplate = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const templateId = pathParts[3];
    
    if (templateId && templateId !== 'create' && !isNaN(Number(templateId))) {
      fetchTemplateData(Number(templateId));
    }
  }, [location.pathname]);

  const fetchTemplateData = async (templateId: number) => {
    try {
      setLoading(true);
      const response = await agreementsApi.getTemplateById(templateId);
      const data = response.data.data;
      
      form.setFieldsValue({
        name: data.name,
        type: data.type,
        is_active: data.is_active ?? true
      });

      setEditorContent(data.content || '');

      message.success(t('createTemplate.messages.dataLoaded'));
    } catch (error: any) {
      message.error(t('createTemplate.messages.loadError'));
      navigate('/agreements/templates');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = () => {
    const pathParts = location.pathname.split('/');
    const templateId = pathParts[3];
    return templateId && templateId !== 'create' && !isNaN(Number(templateId));
  };

  const getTemplateId = () => {
    const pathParts = location.pathname.split('/');
    return Number(pathParts[3]);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      if (!editorContent || editorContent.trim() === '<p><br></p>') {
        message.error(t('createTemplate.messages.emptyContent'));
        setLoading(false);
        return;
      }

      const data = {
        name: values.name,
        type: values.type,
        content: editorContent,
        structure: undefined,
        is_active: values.is_active ?? true
      };

      if (isEditing()) {
        await agreementsApi.updateTemplate(getTemplateId(), data);
        message.success(t('createTemplate.messages.updated'));
      } else {
        await agreementsApi.createTemplate(data);
        message.success(t('createTemplate.messages.created'));
      }

      navigate('/agreements/templates');
    } catch (error: any) {
      console.error('Error saving template:', error);
      message.error(error.response?.data?.message || t('createTemplate.messages.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`;
    setEditorContent(prev => prev + placeholder);
    message.success(t('createTemplate.messages.variableInserted', { variable }));
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ]
  };

const commonVariables = [
  // Основные
  { key: 'contract_number', label: t('createTemplate.variables.contractNumber'), example: 'NOVA-123456' },
  { key: 'agreement_number', label: t('createTemplate.variables.agreementNumber'), example: 'NOVA-123456' },
  { key: 'date', label: t('createTemplate.variables.currentDate'), example: 'November 6, 2025' },
  { key: 'city', label: t('createTemplate.variables.city'), example: 'Phuket' },
  { key: 'date_from', label: t('createTemplate.variables.dateFrom'), example: 'January 1, 2025' },
  { key: 'date_to', label: t('createTemplate.variables.dateTo'), example: 'December 31, 2025' },
  
  // Объект недвижимости
  { key: 'property_name', label: t('createTemplate.variables.propertyName'), example: 'Villa Sunset' },
  { key: 'property_address', label: t('createTemplate.variables.propertyAddress'), example: '123 Beach Road' },
  { key: 'property_number', label: t('createTemplate.variables.propertyNumber'), example: 'PROP-001' },
  
  // Финансы
  { key: 'rent_amount', label: t('createTemplate.variables.rentAmount'), example: '50,000 THB' },
  { key: 'rent_amount_monthly', label: t('createTemplate.variables.rentAmountMonthly'), example: '50,000 THB' },
  { key: 'rent_amount_total', label: t('createTemplate.variables.rentAmountTotal'), example: '600,000 THB' },
  { key: 'deposit_amount', label: t('createTemplate.variables.depositAmount'), example: '100,000 THB' },
  { key: 'utilities_included', label: t('createTemplate.variables.utilitiesIncluded'), example: 'Gardening, Wi-Fi' },
  
  // Банк
  { key: 'bank_name', label: t('createTemplate.variables.bankName'), example: 'Bangkok Bank' },
  { key: 'bank_account_name', label: t('createTemplate.variables.bankAccountName'), example: 'John Doe' },
  { key: 'bank_account_number', label: t('createTemplate.variables.bankAccountNumber'), example: '123-4-56789-0' },
  
  // ✅ НОВЫЕ ПОЛЯ - Условия оплаты
  { key: 'upon_signed_pay', label: t('createTemplate.variables.uponSignedPay'), example: '200,000 THB' },
  { key: 'upon_checkin_pay', label: t('createTemplate.variables.uponCheckinPay'), example: '200,000 THB' },
  { key: 'upon_checkout_pay', label: t('createTemplate.variables.uponCheckoutPay'), example: '200,000 THB' },
  { key: 'upon_signed_pay_percent', label: t('createTemplate.variables.uponSignedPayPercent'), example: '33.3%' },
  { key: 'upon_checkin_pay_percent', label: t('createTemplate.variables.uponCheckinPayPercent'), example: '33.3%' },
  { key: 'upon_checkout_pay_percent', label: t('createTemplate.variables.uponCheckoutPayPercent'), example: '33.3%' },
  
  // Landlord
  { key: 'landlord_name', label: t('createTemplate.variables.landlordName'), example: 'John Smith' },
  { key: 'landlord_country', label: t('createTemplate.variables.landlordCountry'), example: 'Thailand' },
  { key: 'landlord_passport', label: t('createTemplate.variables.landlordPassport'), example: 'AB1234567' },
  { key: 'landlord_passport_number', label: t('createTemplate.variables.landlordPassportNumber'), example: 'AB1234567' },
  
  // Representative
  { key: 'representative_name', label: t('createTemplate.variables.representativeName'), example: 'Sarah Johnson' },
  { key: 'representative_country', label: t('createTemplate.variables.representativeCountry'), example: 'USA' },
  { key: 'representative_passport', label: t('createTemplate.variables.representativePassport'), example: 'US7654321' },
  { key: 'representative_passport_number', label: t('createTemplate.variables.representativePassportNumber'), example: 'US7654321' },
  
  // Tenant
  { key: 'tenant_name', label: t('createTemplate.variables.tenantName'), example: 'Jane Doe' },
  { key: 'tenant_country', label: t('createTemplate.variables.tenantCountry'), example: 'USA' },
  { key: 'tenant_passport', label: t('createTemplate.variables.tenantPassport'), example: 'CD9876543' },
  { key: 'tenant_passport_number', label: t('createTemplate.variables.tenantPassportNumber'), example: 'CD9876543' },
  
  // Lessor
  { key: 'lessor_name', label: t('createTemplate.variables.lessorName'), example: 'Company Ltd' },
  { key: 'lessor_country', label: t('createTemplate.variables.lessorCountry'), example: 'Thailand' },
  { key: 'lessor_passport', label: t('createTemplate.variables.lessorPassport'), example: 'EF1234567' },
  { key: 'lessor_passport_number', label: t('createTemplate.variables.lessorPassportNumber'), example: 'EF1234567' },
  
  // Agent
  { key: 'agent_name', label: t('createTemplate.variables.agentName'), example: 'Real Estate Co.' },
  { key: 'agent_country', label: t('createTemplate.variables.agentCountry'), example: 'Thailand' },
  { key: 'agent_passport', label: t('createTemplate.variables.agentPassport'), example: 'GH1234567' },
  { key: 'agent_passport_number', label: t('createTemplate.variables.agentPassportNumber'), example: 'GH1234567' },
  
  // Seller
  { key: 'seller_name', label: t('createTemplate.variables.sellerName'), example: 'Seller Name' },
  { key: 'seller_country', label: t('createTemplate.variables.sellerCountry'), example: 'Thailand' },
  { key: 'seller_passport', label: t('createTemplate.variables.sellerPassport'), example: 'IJ1234567' },
  { key: 'seller_passport_number', label: t('createTemplate.variables.sellerPassportNumber'), example: 'IJ1234567' },
  
  // Buyer
  { key: 'buyer_name', label: t('createTemplate.variables.buyerName'), example: 'Buyer Name' },
  { key: 'buyer_country', label: t('createTemplate.variables.buyerCountry'), example: 'USA' },
  { key: 'buyer_passport', label: t('createTemplate.variables.buyerPassport'), example: 'KL9876543' },
  { key: 'buyer_passport_number', label: t('createTemplate.variables.buyerPassportNumber'), example: 'KL9876543' },
  
  // Principal
  { key: 'principal_name', label: t('createTemplate.variables.principalName'), example: 'Principal Name' },
  { key: 'principal_country', label: t('createTemplate.variables.principalCountry'), example: 'Russia' },
  { key: 'principal_passport', label: t('createTemplate.variables.principalPassport'), example: 'MN1234567' },
  { key: 'principal_passport_number', label: t('createTemplate.variables.principalPassportNumber'), example: 'MN1234567' },
  
  // Witnesses (до 5 свидетелей)
  { key: 'witness_name', label: t('createTemplate.variables.witness1Name'), example: 'Witness Name' },
  { key: 'witness_country', label: t('createTemplate.variables.witness1Country'), example: 'Thailand' },
  { key: 'witness_passport', label: t('createTemplate.variables.witness1Passport'), example: 'OP1234567' },
  
  { key: 'witness2_name', label: t('createTemplate.variables.witness2Name'), example: 'Witness 2 Name' },
  { key: 'witness2_country', label: t('createTemplate.variables.witness2Country'), example: 'USA' },
  { key: 'witness2_passport', label: t('createTemplate.variables.witness2Passport'), example: 'QR1234567' },
  
  { key: 'witness3_name', label: t('createTemplate.variables.witness3Name'), example: 'Witness 3 Name' },
  { key: 'witness3_country', label: t('createTemplate.variables.witness3Country'), example: 'UK' },
  { key: 'witness3_passport', label: t('createTemplate.variables.witness3Passport'), example: 'ST1234567' },
  
  { key: 'witness4_name', label: t('createTemplate.variables.witness4Name'), example: 'Witness 4 Name' },
  { key: 'witness4_country', label: t('createTemplate.variables.witness4Country'), example: 'Australia' },
  { key: 'witness4_passport', label: t('createTemplate.variables.witness4Passport'), example: 'UV1234567' },
  
  { key: 'witness5_name', label: t('createTemplate.variables.witness5Name'), example: 'Witness 5 Name' },
  { key: 'witness5_country', label: t('createTemplate.variables.witness5Country'), example: 'Canada' },
  { key: 'witness5_passport', label: t('createTemplate.variables.witness5Passport'), example: 'WX1234567' },
  
  // Companies (до 3 компаний)
  { key: 'company1_name', label: t('createTemplate.variables.company1Name'), example: 'Company Ltd' },
  { key: 'company1_address', label: t('createTemplate.variables.company1Address'), example: '123 Business St' },
  { key: 'company1_tax_id', label: t('createTemplate.variables.company1TaxId'), example: '1234567890' },
  { key: 'company1_director_name', label: t('createTemplate.variables.company1DirectorName'), example: 'John Smith' },
  { key: 'company1_director_passport', label: t('createTemplate.variables.company1DirectorPassport'), example: 'AB1234567' },
  { key: 'company1_director_country', label: t('createTemplate.variables.company1DirectorCountry'), example: 'Thailand' },
  
  { key: 'company2_name', label: t('createTemplate.variables.company2Name'), example: 'Second Co Ltd' },
  { key: 'company2_address', label: t('createTemplate.variables.company2Address'), example: '456 Trade Ave' },
  { key: 'company2_tax_id', label: t('createTemplate.variables.company2TaxId'), example: '0987654321' },
  { key: 'company2_director_name', label: t('createTemplate.variables.company2DirectorName'), example: 'Jane Doe' },
  { key: 'company2_director_passport', label: t('createTemplate.variables.company2DirectorPassport'), example: 'CD9876543' },
  { key: 'company2_director_country', label: t('createTemplate.variables.company2DirectorCountry'), example: 'USA' },
  
  { key: 'company3_name', label: t('createTemplate.variables.company3Name'), example: 'Third Corp' },
  { key: 'company3_address', label: t('createTemplate.variables.company3Address'), example: '789 Market Rd' },
  { key: 'company3_tax_id', label: t('createTemplate.variables.company3TaxId'), example: '1122334455' },
  { key: 'company3_director_name', label: t('createTemplate.variables.company3DirectorName'), example: 'Mike Johnson' },
  { key: 'company3_director_passport', label: t('createTemplate.variables.company3DirectorPassport'), example: 'EF1122334' },
  { key: 'company3_director_country', label: t('createTemplate.variables.company3DirectorCountry'), example: 'Singapore' }
];

  return (
    <div className="create-template-container">
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/agreements/templates')}
          >
            {t('createTemplate.actions.backToList')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading}
          >
            {isEditing() ? t('createTemplate.actions.saveChanges') : t('createTemplate.actions.createTemplate')}
          </Button>
        </Space>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="name"
                label={t('createTemplate.fields.templateName')}
                rules={[{ required: true, message: t('createTemplate.validation.enterTemplateName') }]}
              >
                <Input placeholder={t('createTemplate.placeholders.templateName')} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="type"
                label={t('createTemplate.fields.agreementType')}
                rules={[{ required: true, message: t('createTemplate.validation.selectType') }]}
              >
                <Select placeholder={t('createTemplate.placeholders.selectType')} size="large">
                  <Option value="rent">{t('createTemplate.agreementTypes.rent')}</Option>
                  <Option value="sale">{t('createTemplate.agreementTypes.sale')}</Option>
                  <Option value="bilateral">{t('createTemplate.agreementTypes.bilateral')}</Option>
                  <Option value="trilateral">{t('createTemplate.agreementTypes.trilateral')}</Option>
                  <Option value="agency">{t('createTemplate.agreementTypes.agency')}</Option>
                  <Option value="transfer_act">{t('createTemplate.agreementTypes.transferAct')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="is_active" label={t('createTemplate.fields.status')} valuePropName="checked" initialValue={true}>
            <Switch 
              checkedChildren={t('createTemplate.status.active')} 
              unCheckedChildren={t('createTemplate.status.inactive')} 
            />
          </Form.Item>

          <Divider />

          <Collapse
            defaultActiveKey={['variables']}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'variables',
                label: (
                  <Space>
                    <InfoCircleOutlined />
                    <strong>{t('createTemplate.variablesPanel.title')}</strong>
                  </Space>
                ),
                children: (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <Row gutter={[8, 8]}>
                      {commonVariables.map(variable => (
                        <Col key={variable.key} xs={24} sm={12} md={8} lg={6}>
                          <Tag
                            color="blue"
                            style={{ 
                              cursor: 'pointer', 
                              width: '100%',
                              textAlign: 'center',
                              padding: '4px 8px'
                            }}
                            onClick={() => insertVariable(variable.key)}
                          >
                            {variable.label}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>
                            {`{{${variable.key}}}`}
                          </Text>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )
              }
            ]}
          />

          <Form.Item
            label={t('createTemplate.fields.templateContent')}
            required
            help={t('createTemplate.hints.useVariables')}
          >
            <ReactQuill
              value={editorContent}
              onChange={setEditorContent}
              modules={modules}
              theme="snow"
              style={{ height: '500px', marginBottom: '60px' }}
              placeholder={t('createTemplate.placeholders.templateContent')}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateTemplate;