import { useState, useEffect } from 'react';
import { Modal, Checkbox, Button, Select, Space, message, Divider, Alert, Radio, InputNumber, Collapse, Spin, Tag } from 'antd';
import { DownloadOutlined, FileTextOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { propertiesApi, PriceMarkup, PropertyPricesInfo } from '@/api/properties.api';
import './PropertyHTMLGeneratorModal.css';

const { Panel } = Collapse;

interface PropertyHTMLGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: number;
  propertyNumber?: string;
  dealType?: 'rent' | 'sale' | 'both';
}

const PropertyHTMLGeneratorModal: React.FC<PropertyHTMLGeneratorModalProps> = ({
  visible,
  onClose,
  propertyId,
  propertyNumber,
  dealType = 'rent'
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [pricesInfo, setPricesInfo] = useState<PropertyPricesInfo | null>(null);
  
  const [language, setLanguage] = useState('ru');
  const [displayMode, setDisplayMode] = useState<'rent' | 'sale' | 'both'>(
    dealType === 'both' ? 'both' : dealType
  );
  const [showRentalPrices, setShowRentalPrices] = useState(true);
  const [showSalePrices, setShowSalePrices] = useState(true);
  const [includeSeasonalPrices, setIncludeSeasonalPrices] = useState(true);
  const [includeMonthlyPrices, setIncludeMonthlyPrices] = useState(true);
  const [includeYearlyPrice, setIncludeYearlyPrice] = useState(true);
  const [forAgent, setForAgent] = useState(false);

  // Состояния для наценок
  const [yearlyMarkupType, setYearlyMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [yearlyMarkupValue, setYearlyMarkupValue] = useState<number>(0);
  const [yearlyMarkupEnabled, setYearlyMarkupEnabled] = useState(false);

  const [seasonalMarkupType, setSeasonalMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [seasonalMarkupValue, setSeasonalMarkupValue] = useState<number>(0);
  const [seasonalMarkupEnabled, setSeasonalMarkupEnabled] = useState(false);

  const [monthlyMarkupType, setMonthlyMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [monthlyMarkupValues, setMonthlyMarkupValues] = useState<{ [key: number]: number }>({});
  const [monthlyMarkupEnabled, setMonthlyMarkupEnabled] = useState(false);
  const [applyToAllMonths, setApplyToAllMonths] = useState(false);
  const [allMonthsValue, setAllMonthsValue] = useState<number>(0);

  const [saleMarkupType, setSaleMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [saleMarkupValue, setSaleMarkupValue] = useState<number>(0);
  const [saleMarkupEnabled, setSaleMarkupEnabled] = useState(false);

  // Загрузка цен при открытии модального окна
  useEffect(() => {
    if (visible && propertyId) {
      loadPrices();
    }
  }, [visible, propertyId]);

  useEffect(() => {
    if (pricesInfo?.dealType && visible) {
      setDisplayMode(pricesInfo.dealType);
    }
  }, [pricesInfo, visible]);

  const loadPrices = async () => {
    try {
      setLoadingPrices(true);
      const response: any = await propertiesApi.getPropertyPrices(propertyId);
      console.log('📊 Loaded prices info:', response.data);
      
      // ✅ Правильно извлекаем данные из вложенной структуры
      const pricesData = response.data.data || response.data;
      setPricesInfo(pricesData);
      
      // ✅ Обновляем displayMode на основе deal_type из данных
      if (pricesData.dealType) {
        setDisplayMode(pricesData.dealType);
      }
    } catch (error: any) {
      console.error('Load prices error:', error);
      message.error('Ошибка загрузки цен объекта');
    } finally {
      setLoadingPrices(false);
    }
  };

  // Сброс наценок при изменении displayMode
  useEffect(() => {
    if (displayMode === 'sale') {
      setYearlyMarkupEnabled(false);
      setSeasonalMarkupEnabled(false);
      setMonthlyMarkupEnabled(false);
    } else if (displayMode === 'rent') {
      setSaleMarkupEnabled(false);
    }
  }, [displayMode]);

  // Применить наценку ко всем месяцам
  useEffect(() => {
    if (applyToAllMonths && allMonthsValue >= 0) {
      const newValues: { [key: number]: number } = {};
      for (let i = 1; i <= 12; i++) {
        newValues[i] = allMonthsValue;
      }
      setMonthlyMarkupValues(newValues);
    }
  }, [applyToAllMonths, allMonthsValue]);

  // Функция для расчета наценки
  const calculateMarkup = (originalPrice: number, type: 'percent' | 'fixed', value: number): number => {
    if (type === 'percent') {
      return Math.round(originalPrice + (originalPrice * value / 100));
    } else {
      return Math.round(originalPrice + value);
    }
  };

  // Форматирование цены
  const formatPrice = (price: number): string => {
    return `฿${Math.round(price).toLocaleString('en-US')}`;
  };

// ✅ Функция для парсинга чисел с запятой
const parseNumberWithComma = (value: string | number | null | undefined): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  // Заменяем запятую на точку для правильного парсинга
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

  const handleGenerate = async () => {
    try {
      setLoading(true);

      // ✅ Подготавливаем наценки с логированием
      const yearlyPriceMarkup: PriceMarkup | undefined = yearlyMarkupEnabled && yearlyMarkupValue > 0
        ? { type: yearlyMarkupType, value: yearlyMarkupValue }
        : undefined;

      const seasonalPricesMarkup: PriceMarkup | undefined = seasonalMarkupEnabled && seasonalMarkupValue > 0
        ? { type: seasonalMarkupType, value: seasonalMarkupValue }
        : undefined;

      const monthlyPricesMarkup: { [key: number]: PriceMarkup } | undefined = monthlyMarkupEnabled
        ? Object.entries(monthlyMarkupValues).reduce((acc, [month, value]) => {
            if (value > 0) {
              acc[parseInt(month)] = { type: monthlyMarkupType, value };
            }
            return acc;
          }, {} as { [key: number]: PriceMarkup })
        : undefined;

      const salePriceMarkup: PriceMarkup | undefined = saleMarkupEnabled && saleMarkupValue > 0
        ? { type: saleMarkupType, value: saleMarkupValue }
        : undefined;

      // ✅ КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ
      console.log('🔥 ГЕНЕРАЦИЯ HTML - НАЦЕНКИ:');
      console.log('Sale Markup Enabled:', saleMarkupEnabled);
      console.log('Sale Markup Value:', saleMarkupValue);
      console.log('Sale Markup Type:', saleMarkupType);
      console.log('Sale Price Markup Object:', salePriceMarkup);
      console.log('Yearly Price Markup:', yearlyPriceMarkup);
      console.log('Seasonal Prices Markup:', seasonalPricesMarkup);
      console.log('Monthly Prices Markup:', monthlyPricesMarkup);

      const requestData = {
        language,
        displayMode,
        showRentalPrices: displayMode !== 'sale' && showRentalPrices,
        showSalePrices: displayMode !== 'rent' && showSalePrices,
        includeSeasonalPrices,
        includeMonthlyPrices,
        includeYearlyPrice,
        forAgent,
        yearlyPriceMarkup,
        seasonalPricesMarkup,
        monthlyPricesMarkup,
        salePriceMarkup
      };

      console.log('📤 Request Data:', requestData);

      const response = await propertiesApi.generateHTML(propertyId, requestData);

      const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `property_${propertyNumber || propertyId}_${language}_${displayMode}.html`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(t('htmlGenerator.success'));
      onClose();
    } catch (error: any) {
      console.error('Generate HTML error:', error);
      message.error(error.response?.data?.message || t('htmlGenerator.error'));
    } finally {
      setLoading(false);
    }
  };

  const availableModes = (() => {
    if (dealType === 'rent') {
      return [{ value: 'rent' as const, label: t('htmlGenerator.rentOnly') }];
    } else if (dealType === 'sale') {
      return [{ value: 'sale' as const, label: t('htmlGenerator.saleOnly') }];
    } else {
      return [
        { value: 'rent' as const, label: t('htmlGenerator.rentOnly') },
        { value: 'sale' as const, label: t('htmlGenerator.saleOnly') },
        { value: 'both' as const, label: t('htmlGenerator.both') }
      ];
    }
  })();

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // ✅ Проверяем наличие цен
  const hasYearlyPrice = pricesInfo?.yearlyPrice && pricesInfo.yearlyPrice > 0;
  const hasSeasonalPrices = pricesInfo?.seasonalPrices && pricesInfo.seasonalPrices.length > 0;
  const hasMonthlyPrices = pricesInfo?.monthlyPrices && pricesInfo.monthlyPrices.length > 0;
  const hasSalePrice = pricesInfo?.salePrice && pricesInfo.salePrice > 0;

  // ✅ НОВЫЙ КОД (показывает секции на основе наличия цен):
  const showRentSection = hasYearlyPrice || hasSeasonalPrices || hasMonthlyPrices;
  const showSaleSection = hasSalePrice;

// ✅ ДОБАВЬТЕ ЭТО ЛОГИРОВАНИЕ:
console.log('🔍 DEBUG INFO:');
console.log('pricesInfo:', pricesInfo);
console.log('hasSalePrice:', hasSalePrice);
console.log('pricesInfo?.salePrice:', pricesInfo?.salePrice);
console.log('showSaleSection:', showSaleSection);
console.log('showRentSection:', showRentSection);

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          {t('htmlGenerator.title')}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel')}
        </Button>,
        <Button
          key="generate"
          type="primary"
          icon={<DownloadOutlined />}
          loading={loading}
          onClick={handleGenerate}
          disabled={loadingPrices}
        >
          {loading ? t('htmlGenerator.generating') : t('htmlGenerator.generate')}
        </Button>
      ]}
      width={700}
      style={{ maxHeight: '90vh' }}
      bodyStyle={{ maxHeight: 'calc(90vh - 110px)', overflowY: 'auto' }}
      className="html-generator-modal"
    >
      {loadingPrices ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#8b949e' }}>Загрузка цен...</div>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Язык */}
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500, color: '#c9d1d9' }}>
              {t('htmlGenerator.language')}
            </div>
            <Select
              style={{ width: '100%' }}
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'ru', label: 'Русский' },
                { value: 'en', label: 'English' },
                { value: 'th', label: 'ไทย' },
                { value: 'zh', label: '中文' },
                { value: 'he', label: 'עברית' }
              ]}
            />
          </div>

          <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />

          {/* Режим отображения */}
          {availableModes.length > 1 && (
            <>
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500, color: '#c9d1d9' }}>
                  {t('htmlGenerator.displayMode')}
                </div>
                <Radio.Group
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {availableModes.map(mode => (
                      <Radio key={mode.value} value={mode.value}>
                        {mode.label}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
              <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />
            </>
          )}

          {/* ✅ Опции цен для аренды - показываем ТОЛЬКО если dealType = 'rent' или 'both' */}
          {showRentSection && (
            <div>
              <div style={{ marginBottom: 12, fontWeight: 500, color: '#c9d1d9' }}>
                {t('htmlGenerator.rentalPriceOptions') || 'Опции цен для аренды'}
              </div>
              
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={showRentalPrices}
                  onChange={(e) => setShowRentalPrices(e.target.checked)}
                >
                  {t('htmlGenerator.showRentalPrices')}
                </Checkbox>

                {showRentalPrices && (
                  <div style={{ marginLeft: 24, width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Checkbox
                        checked={includeSeasonalPrices}
                        onChange={(e) => setIncludeSeasonalPrices(e.target.checked)}
                        disabled={!hasSeasonalPrices}
                      >
                        <Space>
                          {t('htmlGenerator.seasonalPrices')}
                          {!hasSeasonalPrices && <Tag color="red">Нет цен</Tag>}
                          {hasSeasonalPrices && <Tag color="green">{pricesInfo!.seasonalPrices.length} период(ов)</Tag>}
                        </Space>
                      </Checkbox>
                      
                      <Checkbox
                        checked={includeMonthlyPrices}
                        onChange={(e) => setIncludeMonthlyPrices(e.target.checked)}
                        disabled={!hasMonthlyPrices}
                      >
                        <Space>
                          {t('htmlGenerator.monthlyPrices')}
                          {!hasMonthlyPrices && <Tag color="red">Нет цен</Tag>}
                          {hasMonthlyPrices && <Tag color="green">{pricesInfo!.monthlyPrices.length} месяц(ев)</Tag>}
                        </Space>
                      </Checkbox>
                      
                      <Checkbox
                        checked={includeYearlyPrice}
                        onChange={(e) => setIncludeYearlyPrice(e.target.checked)}
                        disabled={!hasYearlyPrice}
                      >
                        <Space>
                          {t('htmlGenerator.yearlyPrice')}
                          {!hasYearlyPrice && <Tag color="red">Нет цены</Tag>}
                          {hasYearlyPrice && <Tag color="green">{formatPrice(pricesInfo!.yearlyPrice!)}</Tag>}
                        </Space>
                      </Checkbox>
                    </Space>
                  </div>
                )}
              </Space>

              {/* НАЦЕНКИ ДЛЯ АРЕНДЫ */}
              {showRentalPrices && (hasYearlyPrice || hasSeasonalPrices || hasMonthlyPrices) && (
                <Collapse 
                  ghost 
                  style={{ marginTop: 16, background: '#161b22', borderRadius: 8 }}
                >
                  <Panel header="⚙️ Настройки наценок для аренды" key="1">
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      
                      {/* Наценка на годовую цену */}
                      {hasYearlyPrice && includeYearlyPrice && (
                        <div style={{ padding: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #30363d' }}>
                          <Checkbox
                            checked={yearlyMarkupEnabled}
                            onChange={(e) => setYearlyMarkupEnabled(e.target.checked)}
                            style={{ marginBottom: 12 }}
                          >
                            <strong style={{ color: '#c9d1d9' }}>Наценка на годовую цену</strong>
                          </Checkbox>
                          
                          <div style={{ marginLeft: 24, marginBottom: 12, fontSize: 13, color: '#8b949e' }}>
                            Исходная цена: <strong style={{ color: '#58a6ff' }}>{formatPrice(pricesInfo!.yearlyPrice!)}</strong>
                            {yearlyMarkupEnabled && yearlyMarkupValue > 0 && (
                              <>
                                {' → '}
                                <strong style={{ color: '#3fb950' }}>
                                  {formatPrice(calculateMarkup(pricesInfo!.yearlyPrice!, yearlyMarkupType, yearlyMarkupValue))}
                                </strong>
                              </>
                            )}
                          </div>
                          
                          {yearlyMarkupEnabled && (
                            <Space direction="vertical" style={{ width: '100%', marginLeft: 24 }}>
                              <Radio.Group 
                                value={yearlyMarkupType} 
                                onChange={(e) => setYearlyMarkupType(e.target.value)}
                              >
                                <Radio value="percent">Процент (%)</Radio>
                                <Radio value="fixed">Фиксированная сумма (฿)</Radio>
                              </Radio.Group>
                              
                              <InputNumber
                                style={{ width: 200 }}
                                placeholder={yearlyMarkupType === 'percent' ? '0' : '0'}
                                value={yearlyMarkupValue}
                                onChange={(value) => setYearlyMarkupValue(parseNumberWithComma(value))}
                                min={0}
                                step={yearlyMarkupType === 'percent' ? 0.1 : 1000}
                                prefix={yearlyMarkupType === 'percent' ? <PercentageOutlined /> : <DollarOutlined />}
                                decimalSeparator=","
                              />
                            </Space>
                          )}
                        </div>
                      )}

                      {/* Наценка на сезонные цены */}
                      {hasSeasonalPrices && includeSeasonalPrices && (
                        <div style={{ padding: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #30363d' }}>
                          <Checkbox
                            checked={seasonalMarkupEnabled}
                            onChange={(e) => setSeasonalMarkupEnabled(e.target.checked)}
                            style={{ marginBottom: 12 }}
                          >
                            <strong style={{ color: '#c9d1d9' }}>Наценка на сезонные цены</strong>
                          </Checkbox>
                          
                          <div style={{ marginLeft: 24, marginBottom: 12, fontSize: 13, color: '#8b949e' }}>
                            Периодов: {pricesInfo!.seasonalPrices.length}
                            {seasonalMarkupEnabled && seasonalMarkupValue > 0 && pricesInfo!.seasonalPrices.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                Пример: {formatPrice(pricesInfo!.seasonalPrices[0].price_per_night)}
                                {' → '}
                                <strong style={{ color: '#3fb950' }}>
                                  {formatPrice(calculateMarkup(
                                    pricesInfo!.seasonalPrices[0].price_per_night,
                                    seasonalMarkupType,
                                    seasonalMarkupValue
                                  ))}
                                </strong>
                                {pricesInfo!.seasonalPrices[0].pricing_type === 'per_period' && ' (за период)'}
                              </div>
                            )}
                          </div>
                          
                          {seasonalMarkupEnabled && (
                            <Space direction="vertical" style={{ width: '100%', marginLeft: 24 }}>
                              <Radio.Group 
                                value={seasonalMarkupType} 
                                onChange={(e) => setSeasonalMarkupType(e.target.value)}
                              >
                                <Radio value="percent">Процент (%)</Radio>
                                <Radio value="fixed">Фиксированная сумма (฿)</Radio>
                              </Radio.Group>
                              
                              <InputNumber
                                style={{ width: 200 }}
                                placeholder={seasonalMarkupType === 'percent' ? '0' : '0'}
                                value={seasonalMarkupValue}
                                onChange={(value) => setSeasonalMarkupValue(parseNumberWithComma(value))}
                                min={0}
                                step={seasonalMarkupType === 'percent' ? 0.1 : 1000}
                                prefix={seasonalMarkupType === 'percent' ? <PercentageOutlined /> : <DollarOutlined />}
                                decimalSeparator=","
                              />
                            </Space>
                          )}
                        </div>
                      )}

                      {/* Наценка на месячные цены */}
                      {hasMonthlyPrices && includeMonthlyPrices && (
                        <div style={{ padding: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #30363d' }}>
                          <Checkbox
                            checked={monthlyMarkupEnabled}
                            onChange={(e) => setMonthlyMarkupEnabled(e.target.checked)}
                            style={{ marginBottom: 12 }}
                          >
                            <strong style={{ color: '#c9d1d9' }}>Наценка на месячные цены</strong>
                          </Checkbox>
                          
                          {monthlyMarkupEnabled && (
                            <Space direction="vertical" style={{ width: '100%', marginLeft: 24 }}>
                              <Radio.Group 
                                value={monthlyMarkupType} 
                                onChange={(e) => setMonthlyMarkupType(e.target.value)}
                              >
                                <Radio value="percent">Процент (%)</Radio>
                                <Radio value="fixed">Фиксированная сумма (฿)</Radio>
                              </Radio.Group>

                              <Checkbox
                                checked={applyToAllMonths}
                                onChange={(e) => setApplyToAllMonths(e.target.checked)}
                              >
                                Применить ко всем месяцам
                              </Checkbox>

                              {applyToAllMonths ? (
                                <InputNumber
                                  style={{ width: 200 }}
                                  placeholder={monthlyMarkupType === 'percent' ? '0' : '0'}
                                  value={allMonthsValue}
                                  onChange={(value) => setAllMonthsValue(parseNumberWithComma(value))}
                                  min={0}
                                  step={monthlyMarkupType === 'percent' ? 0.1 : 1000}
                                  prefix={monthlyMarkupType === 'percent' ? <PercentageOutlined /> : <DollarOutlined />}
                                  decimalSeparator=","
                                />
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxHeight: 200, overflowY: 'auto', padding: 8 }}>
                                  {pricesInfo!.monthlyPrices.map((monthPrice) => {
                                    const monthIndex = monthPrice.month_number - 1;
                                    const currentMarkup = monthlyMarkupValues[monthPrice.month_number] || 0;
                                    const finalPrice = currentMarkup > 0 
                                      ? calculateMarkup(monthPrice.price_per_month, monthlyMarkupType, currentMarkup)
                                      : monthPrice.price_per_month;
                                    
                                    return (
                                      <div key={monthPrice.month_number} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 8,
                                        padding: 8,
                                        background: '#161b22',
                                        borderRadius: 6
                                      }}>
                                        <span style={{ width: 80, fontSize: 12, color: '#8b949e' }}>
                                          {monthNames[monthIndex]}:
                                        </span>
                                        <span style={{ flex: 1, fontSize: 12, color: '#58a6ff' }}>
                                          {formatPrice(monthPrice.price_per_month)}
                                          {currentMarkup > 0 && (
                                            <>
                                              {' → '}
                                              <strong style={{ color: '#3fb950' }}>
                                                {formatPrice(finalPrice)}
                                              </strong>
                                            </>
                                          )}
                                        </span>
                                        <InputNumber
                                          size="small"
                                          style={{ width: 100 }}
                                          placeholder="0"
                                          value={currentMarkup}
                                          onChange={(value) => {
                                            setMonthlyMarkupValues(prev => ({
                                              ...prev,
                                              [monthPrice.month_number]: parseNumberWithComma(value)
                                            }));
                                          }}
                                          min={0}
                                          step={monthlyMarkupType === 'percent' ? 0.1 : 1000}
                                          decimalSeparator=","
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </Space>
                          )}
                        </div>
                      )}
                    </Space>
                  </Panel>
                </Collapse>
              )}
            </div>
          )}

          {/* ✅ Опции для продажи - показываем ТОЛЬКО если dealType = 'sale' или 'both' */}
          {showSaleSection && (
            <>
              {showRentSection && <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />}
              
              <div>
                <div style={{ marginBottom: 12, fontWeight: 500, color: '#c9d1d9' }}>
                  {t('htmlGenerator.salePriceOptions') || 'Опции цен для продажи'}
                </div>
                
                <Checkbox
                  checked={showSalePrices}
                  onChange={(e) => setShowSalePrices(e.target.checked)}
                  disabled={!hasSalePrice}
                >
                  <Space>
                    {t('htmlGenerator.showSalePrices')}
                    {!hasSalePrice && <Tag color="red">Нет цены</Tag>}
                    {hasSalePrice && <Tag color="green">{formatPrice(pricesInfo!.salePrice!)}</Tag>}
                  </Space>
                </Checkbox>

                {/* НАЦЕНКА НА ЦЕНУ ПРОДАЖИ */}
                {hasSalePrice && showSalePrices && (
                  <Collapse 
                    ghost 
                    style={{ marginTop: 16, background: '#161b22', borderRadius: 8 }}
                  >
                    <Panel header="⚙️ Настройки наценки для продажи" key="1">
                      <div style={{ padding: 12, background: '#0d1117', borderRadius: 8, border: '1px solid #30363d' }}>
                        <Checkbox
                          checked={saleMarkupEnabled}
                          onChange={(e) => {
                            console.log('🔥 Sale Markup Checkbox Changed:', e.target.checked);
                            setSaleMarkupEnabled(e.target.checked);
                          }}
                          style={{ marginBottom: 12 }}
                        >
                          <strong style={{ color: '#c9d1d9' }}>Наценка на цену продажи</strong>
                        </Checkbox>
                        
                        <div style={{ marginLeft: 24, marginBottom: 12, fontSize: 13, color: '#8b949e' }}>
                          Исходная цена: <strong style={{ color: '#58a6ff' }}>{formatPrice(pricesInfo!.salePrice!)}</strong>
                          {saleMarkupEnabled && saleMarkupValue > 0 && (
                            <>
                              {' → '}
                              <strong style={{ color: '#3fb950' }}>
                                {formatPrice(calculateMarkup(pricesInfo!.salePrice!, saleMarkupType, saleMarkupValue))}
                              </strong>
                            </>
                          )}
                        </div>
                        
                        {saleMarkupEnabled && (
                          <Space direction="vertical" style={{ width: '100%', marginLeft: 24 }}>
                            <Radio.Group 
                              value={saleMarkupType} 
                              onChange={(e) => {
                                console.log('🔥 Sale Markup Type Changed:', e.target.value);
                                setSaleMarkupType(e.target.value);
                              }}
                            >
                              <Radio value="percent">Процент (%)</Radio>
                              <Radio value="fixed">Фиксированная сумма (฿)</Radio>
                            </Radio.Group>
                            
                            <InputNumber
                              style={{ width: 200 }}
                              placeholder={saleMarkupType === 'percent' ? '0' : '0'}
                              value={saleMarkupValue}
                              onChange={(value) => {
                                const parsed = parseNumberWithComma(value);
                                console.log('🔥 Sale Markup Value Changed:', value, '→', parsed);
                                setSaleMarkupValue(parsed);
                              }}
                              min={0}
                              step={saleMarkupType === 'percent' ? 0.1 : 1000}
                              prefix={saleMarkupType === 'percent' ? <PercentageOutlined /> : <DollarOutlined />}
                              decimalSeparator=","
                            />
                          </Space>
                        )}
                      </div>
                    </Panel>
                  </Collapse>
                )}
              </div>
            </>
          )}

          <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />

          {/* Для агента */}
          <Checkbox
            checked={forAgent}
            onChange={(e) => setForAgent(e.target.checked)}
          >
            {t('htmlGenerator.forAgent')} (без логотипа и футера)
          </Checkbox>

          <Alert
            message={
              displayMode === 'both' 
                ? 'HTML будет содержать переключатель между режимами аренды и продажи'
                : 'HTML файл будет содержать все фотографии в формате base64 и будет полностью автономным.'
            }
            type="info"
            showIcon
          />
        </Space>
      )}
    </Modal>
  );
};

export default PropertyHTMLGeneratorModal;