// backend/src/services/aiAgreementEditor.service.ts
import { config } from '../config/config';
import logger from '../utils/logger';
import axios from 'axios';

interface AgreementEditRequest {
  prompt: string;
  currentHtml: string;
  currentStructure: string;
  agreementData: any;
}

interface AgreementEditResponse {
  success: boolean;
  changes: {
    description: string;
    descriptionRu: string;
    changedFields: string[];
    changedSections?: Array<{
      section: string;
      action: 'added' | 'modified' | 'removed';
      clause_number: string;
      text_en: string;
      text_ru: string;
      reason_en: string;
      reason_ru: string;
    }>;
    conflictsDetected?: Array<{
      section: string;
      clause_number: string;
      conflict_description: string;
      conflict_description_ru: string;
      text_en: string;
      text_ru: string;
      resolution: string;
      resolution_ru: string;
    }>;
    htmlAfter: string;
    structureAfter: string;
    databaseUpdates: Record<string, any>;
  };
  aiResponse: string;
}

class AIAgreementEditorService {
  private isEnabled: boolean = false;
  private provider: 'openai' | 'claude' = 'openai';
  private proxyUrl: string = '';
  private proxySecret: string = '';

  constructor() {
    this.provider = config.ai.provider as 'openai' | 'claude';
    this.proxyUrl = config.ai.proxyUrl || '';
    this.proxySecret = config.ai.proxySecret || '';

    if (this.proxyUrl && this.proxySecret) {
      this.isEnabled = true;
      logger.info(`AI Agreement Editor service configured with provider: ${this.provider}`);
    } else {
      logger.warn('AI Agreement Editor not configured - missing proxy URL or secret');
    }
  }

  isAIEnabled(): boolean {
    return this.isEnabled;
  }

  async editAgreement(
    request: AgreementEditRequest,
    conversationHistory: any[] = []
  ): Promise<AgreementEditResponse> {
    if (!this.isAIEnabled()) {
      throw new Error('AI service is not available');
    }

    try {
      if (this.provider === 'openai') {
        return await this.editWithOpenAI(request, conversationHistory);
      } else {
        return await this.editWithClaude(request, conversationHistory);
      }
    } catch (error: any) {
      logger.error('AI agreement editing error:', error);
      throw this.handleAIError(error);
    }
  }

private async editWithOpenAI(
  request: AgreementEditRequest,
  conversationHistory: any[]
): Promise<AgreementEditResponse> {
  const systemPrompt = this.buildAgreementEditorSystemPrompt(request.agreementData);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    {
      role: 'user',
      content: this.buildEditPrompt(request)
    }
  ];

  logger.info('Sending agreement edit request to OpenAI via proxy');

  const response = await axios.post(
    `${this.proxyUrl}/api/openai/chat/completions`,
    {
      model: config.ai.openai.model,
      messages,
      temperature: 0.3,
      max_tokens: 16000,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${this.proxySecret}`,
        'Content-Type': 'application/json'
      },
      timeout: 300000
    }
  );

  logger.info('OpenAI agreement edit response received');

  if (!response.data || !response.data.choices || !response.data.choices[0]) {
    logger.error('Invalid OpenAI response structure');
    throw new Error('Invalid response from OpenAI');
  }

  let responseText = response.data.choices[0]?.message?.content;
  
  // Преобразование объекта в строку
  if (typeof responseText === 'object' && responseText !== null && !Array.isArray(responseText)) {
    logger.info('Converting object response to string');
    const keys = Object.keys(responseText).sort((a, b) => parseInt(a) - parseInt(b));
    responseText = keys.map(key => responseText[key]).join('');
  }
  
  if (!responseText || typeof responseText !== 'string') {
    logger.error('Empty or invalid response from OpenAI');
    throw new Error('Empty response from OpenAI');
  }

  logger.info('Response length: ' + responseText.length + ' chars');

  // Парсинг JSON
  let aiResult: any;
  try {
    aiResult = JSON.parse(responseText.trim());
    logger.info('✅ Successfully parsed JSON response');
  } catch (parseError: any) {
    logger.error('❌ JSON parse error: ' + parseError.message);
    logger.error('Response sample: ' + responseText.substring(0, 2000));
    throw new Error('Invalid JSON response from OpenAI');
  }
  
  if (!aiResult || typeof aiResult !== 'object') {
    logger.error('Invalid response structure from OpenAI');
    throw new Error('Invalid response structure from OpenAI');
  }

  // ✅ ДЕБАГ: Проверяем структуру ответа (ПРАВИЛЬНОЕ ЛОГИРОВАНИЕ!)
  logger.info('AI result keys: ' + JSON.stringify(Object.keys(aiResult)));
  logger.info('structure_after type: ' + (typeof aiResult.structure_after));
  logger.info('structure_after exists: ' + (!!aiResult.structure_after));

  // ✅ ГЕНЕРИРУЕМ HTML ИЗ СТРУКТУРЫ НА НАШЕЙ СТОРОНЕ
  let htmlAfter = request.currentHtml;
  let structureAfter = request.currentStructure;

  if (aiResult.structure_after) {
    try {
      logger.info('Processing structure_after...');
      
      let structureObj;
      if (typeof aiResult.structure_after === 'string') {
        logger.info('structure_after is string, parsing...');
        structureObj = JSON.parse(aiResult.structure_after);
      } else if (typeof aiResult.structure_after === 'object') {
        logger.info('structure_after is object, using directly');
        structureObj = aiResult.structure_after;
      } else {
        logger.error('structure_after has unexpected type: ' + (typeof aiResult.structure_after));
        throw new Error('Invalid structure_after type');
      }

      logger.info('Structure object keys: ' + JSON.stringify(Object.keys(structureObj)));
      logger.info('Structure has nodes: ' + (!!structureObj.nodes));
      logger.info('Nodes count: ' + (structureObj.nodes?.length || 0));
      
      // Генерируем HTML из структуры
      htmlAfter = this.generateHtmlFromStructure(structureObj);
      
      if (!htmlAfter || htmlAfter.trim() === '') {
        logger.error('❌ Generated HTML is empty!');
        logger.error('Structure object: ' + JSON.stringify(structureObj).substring(0, 500));
        throw new Error('Generated HTML is empty');
      }
      
      structureAfter = JSON.stringify(structureObj);
      
      logger.info('✅ Generated HTML from structure, length: ' + htmlAfter.length);
      logger.info('HTML preview: ' + htmlAfter.substring(0, 200));
    } catch (e: any) {
      logger.error('❌ Error generating HTML from structure: ' + e.message);
      logger.error('Error stack: ' + (e.stack || 'no stack'));
      throw new Error('Failed to process structure from AI: ' + e.message);
    }
  } else {
    logger.warn('⚠️ No structure_after in AI response, using original HTML');
  }

  // ✅ ВАЛИДАЦИЯ перед возвратом
  if (!htmlAfter || htmlAfter.trim() === '') {
    logger.error('❌ Final htmlAfter is empty! Using original HTML');
    htmlAfter = request.currentHtml;
  }

  if (!structureAfter || structureAfter.trim() === '' || structureAfter === '{}') {
    logger.error('❌ Final structureAfter is empty! Using original structure');
    structureAfter = request.currentStructure;
  }

  logger.info('Final HTML length: ' + htmlAfter.length);
  logger.info('Final structure length: ' + structureAfter.length);
  
  return {
    success: true,
    changes: {
      description: aiResult.changes_description || 'Changes applied',
      descriptionRu: aiResult.changes_description_ru || 'Изменения применены',
      changedFields: Array.isArray(aiResult.changed_fields) ? aiResult.changed_fields : [],
      changedSections: Array.isArray(aiResult.changed_sections) ? aiResult.changed_sections : [],
      conflictsDetected: Array.isArray(aiResult.conflicts_detected) ? aiResult.conflicts_detected : [],
      htmlAfter,
      structureAfter,
      databaseUpdates: aiResult.database_updates || {}
    },
    aiResponse: aiResult.ai_response || 'Изменения успешно применены'
  };
}

  /**
   * 🎨 ГЕНЕРАЦИЯ HTML ИЗ СТРУКТУРЫ
   */
private generateHtmlFromStructure(structure: any): string {
  try {
    if (!structure) {
      logger.error('❌ generateHtmlFromStructure: structure is null/undefined');
      return '';
    }

    if (typeof structure !== 'object') {
      logger.error('❌ generateHtmlFromStructure: structure is not an object, type: ' + (typeof structure));
      return '';
    }

    if (!structure.nodes) {
      logger.error('❌ generateHtmlFromStructure: structure.nodes is missing');
      logger.error('Available keys: ' + JSON.stringify(Object.keys(structure)));
      return '';
    }

    if (!Array.isArray(structure.nodes)) {
      logger.error('❌ generateHtmlFromStructure: structure.nodes is not an array');
      return '';
    }

    let html = '<h1>' + (structure.title || 'LEASE AGREEMENT') + '</h1>';
    html += '<p>Date: ' + (structure.date ? new Date(structure.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '') + '</p>';
    html += '<p>City: ' + (structure.city || 'Phuket') + '</p>';

    // Рекурсивно обрабатываем все ноды
    const nodesHtml = this.renderNodes(structure.nodes);
    
    if (!nodesHtml || nodesHtml.trim() === '') {
      logger.error('❌ renderNodes returned empty string');
      return '';
    }
    
    html += nodesHtml;

    logger.info('✅ HTML generation successful, length: ' + html.length);
    return html;
  } catch (error: any) {
    logger.error('❌ Error in generateHtmlFromStructure: ' + error.message);
    logger.error('Stack: ' + (error.stack || 'no stack'));
    return '';
  }
}

  /**
   * Рекурсивный рендеринг нодов
   */
private renderNodes(nodes: any[]): string {
  try {
    if (!Array.isArray(nodes)) {
      logger.error('❌ renderNodes: nodes is not an array');
      return '';
    }

    let html = '';

    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        logger.warn('⚠️ Skipping invalid node:', node);
        continue;
      }

      if (node.type === 'section') {
        html += '<h2>' + (node.content || '') + '</h2>';
        
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          html += this.renderNodes(node.children);
        }
      } 
      else if (node.type === 'subsection') {
        html += '<p>' + (node.content || '') + '</p>';
      }
      else if (node.type === 'paragraph') {
        html += '<p>' + (node.content || '') + '</p>';
      }
      else if (node.type === 'bulletList') {
        if (node.items && Array.isArray(node.items) && node.items.length > 0) {
          html += '<ul>';
          for (const item of node.items) {
            html += '<li>' + (item || '') + '</li>';
          }
          html += '</ul>';
        }
      } else {
        logger.warn('⚠️ Unknown node type:', node.type);
      }
    }

    return html;
  } catch (error: any) {
    logger.error('❌ Error in renderNodes:', error.message);
    return '';
  }
}

  private async editWithClaude(
    _request: AgreementEditRequest,
    _conversationHistory: any[]
  ): Promise<AgreementEditResponse> {
    // Аналогично OpenAI
    throw new Error('Claude not implemented yet');
  }

  /**
   * 🎯 УПРОЩЕННЫЙ ПРОМПТ - ТОЛЬКО СТРУКТУРА
   */
private buildAgreementEditorSystemPrompt(agreementData: any): string {
  return `You are a professional legal document editor for NOVA ESTATE in Phuket, Thailand.

═══════════════════════════════════════════════════════════════════
⚠️  CRITICAL: ANALYZE ENTIRE CONTRACT FOR CONFLICTS ⚠️
═══════════════════════════════════════════════════════════════════

**YOUR RESPONSIBILITIES:**
1. Understand user's request in Russian
2. Analyze ENTIRE contract for conflicts with requested change
3. Modify ALL conflicting clauses to maintain consistency
4. Report ALL changes (requested + additional conflict resolutions)
5. Return MINIFIED structure_after JSON (no spaces/newlines)

═══════════════════════════════════════════════════════════════════
🔍 CONFLICT DETECTION RULES
═══════════════════════════════════════════════════════════════════

When user requests a change, you MUST check:
- Does this contradict existing payment terms?
- Does this contradict existing obligations?
- Does this contradict existing penalties?
- Does this affect referenced sections?
- Does this create logical inconsistencies?

**EXAMPLES OF CONFLICTS:**

User: "Сделай депозит 50,000 THB"
Conflict: Section 5.1 says "SUMMA THB" but Section 4.4 references old amount
Action: Update BOTH Section 5.1 AND any references to deposit amount

User: "Добавь оплату 30% при подписании"
Conflict: Existing payment structure is 100% upon check-in
Action: Restructure ALL payment clauses to accommodate new 30% upfront

User: "Измени срок аренды"
Conflict: Payment terms reference old dates
Action: Update dates AND adjust any date-dependent clauses

═══════════════════════════════════════════════════════════════════
📊 STRUCTURE FORMAT (MINIFIED!)
═══════════════════════════════════════════════════════════════════

{
  "city":"Phuket",
  "date":"2025-09-01T07:33:28.474Z",
  "title":"LEASE AGREEMENT",
  "nodes":[
    {"id":"123","type":"section","level":0,"number":"7","content":"7. OBLIGATIONS OF THE PARTIES","children":[
      {"id":"456","type":"subsection","level":1,"number":"7.1","content":"Text here"}
    ]}
  ]
}

Node types: section, subsection, paragraph, bulletList
Required fields: id, type, level, content (children for sections, items for bulletList)

═══════════════════════════════════════════════════════════════════
📊 CURRENT AGREEMENT
═══════════════════════════════════════════════════════════════════

Agreement: ${agreementData.agreement_number}
Type: ${agreementData.type}
City: ${agreementData.city}
Dates: ${agreementData.date_from} to ${agreementData.date_to}
Monthly Rent: ${agreementData.rent_amount_monthly} THB
Total Rent: ${agreementData.rent_amount_total} THB
Deposit: ${agreementData.deposit_amount} THB

═══════════════════════════════════════════════════════════════════
🎓 PROFESSIONAL LEGAL ENGLISH
═══════════════════════════════════════════════════════════════════

User requests in RUSSIAN → Agreement text in PROFESSIONAL LEGAL ENGLISH

Examples:
"запрет шума после 21:00" → "The Tenant shall ensure that no excessive noise, disturbance, or any activity that may cause inconvenience to neighboring properties is permitted after 21:00 hours (9:00 PM)."

"депозит 50000" → "The deposit amount is 50,000 THB. Payment of the deposit is a mandatory condition for the handover of the Property to the Tenant."

Write in formal legal English with complete sentences and specific amounts/times.

═══════════════════════════════════════════════════════════════════
📝 REQUIRED RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════

{
  "success":true,
  "changes_description":"Brief English summary of ALL changes made",
  "changes_description_ru":"Краткое описание всех изменений на русском",
  "changed_sections":[
    {
      "section":"Section 4.4 - Rent and Services",
      "action":"modified",
      "clause_number":"4.4",
      "text_en":"Upon signing this Agreement, the Tenant shall pay 30% of the total rent amounting to 150,000 THB. Additionally 20% of the total rent, amounting to 100,000 THB, shall be paid upon check-in. The remaining 50% of the total rent, amounting to 250,000 THB, shall be paid after check-out. The security deposit of 50,000 THB is payable upon check-in.",
      "text_ru":"При подписании договора арендатор оплачивает 30% от общей суммы аренды, составляющей 150,000 THB. Дополнительно 20% от общей суммы аренды, составляющей 100,000 THB, оплачивается при заезде. Оставшиеся 50% от общей суммы аренды, составляющей 250,000 THB, оплачиваются после выезда. Депозит в размере 50,000 THB оплачивается при заезде.",
      "reason_en":"User requested to update deposit to 50,000 THB and add payment terms",
      "reason_ru":"Пользователь запросил обновить депозит до 50,000 THB и добавить условия оплаты"
    }
  ],
  "conflicts_detected":[
    {
      "section":"Section 5.1 - Security Deposit",
      "clause_number":"5.1",
      "conflict_description":"Referenced old deposit amount SUMMA THB, needed update to match new 50,000 THB",
      "conflict_description_ru":"Ссылался на старую сумму депозита SUMMA THB, требуется обновление до новых 50,000 THB",
      "text_en":"The deposit — 50,000 THB. Payment of the deposit is a mandatory condition for the handover of the Property to the Tenant.",
      "text_ru":"Депозит — 50,000 THB. Оплата депозита является обязательным условием для передачи Недвижимости Арендатору.",
      "resolution":"Updated deposit amount from SUMMA to 50,000 THB to maintain consistency",
      "resolution_ru":"Обновлена сумма депозита с SUMMA на 50,000 THB для поддержания согласованности"
    }
  ],
  "changed_fields":["Section 4","Section 5"],
  "structure_after":{"city":"Phuket","date":"2025-09-01T07:33:28.474Z","title":"LEASE AGREEMENT","nodes":[...MINIFIED...]},
  "database_updates":{"deposit_amount":50000,"upon_signed_pay":150000,"upon_checkin_pay":100000,"upon_checkout_pay":250000},
  "ai_response":"Готово! Обновлен депозит до 50,000 THB и добавлены условия оплаты. Также исправлены конфликты в разделе 5.1."
}

**CRITICAL FIELDS:**

**changed_sections[]** - Array of ALL changes made (requested + automatic fixes):
- section: Section name in English
- action: "added" | "modified" | "removed"
- clause_number: e.g., "4.4", "7.3"
- text_en: Full English text of the clause
- text_ru: Full Russian translation
- reason_en: Why this change was made
- reason_ru: Почему это изменение было сделано

**conflicts_detected[]** - Array of conflicts found and auto-resolved:
- section: Which section had conflict
- clause_number: Clause number
- conflict_description: What was the conflict (English)
- conflict_description_ru: Описание конфликта (Russian)
- text_en: New text after resolution
- text_ru: Новый текст после разрешения
- resolution: How it was resolved (English)
- resolution_ru: Как было разрешено (Russian)

**structure_after** - Complete MINIFIED structure as JSON object (no spaces/newlines)

═══════════════════════════════════════════════════════════════════
💡 EXAMPLE: Deposit Change with Conflict
═══════════════════════════════════════════════════════════════════

User: "Обнови депозит до 50000 бат и добавь оплату 30% при подписании, 20% при заезде, 50% после выезда"

Response:
{
  "success":true,
  "changes_description":"Updated deposit to 50,000 THB and restructured payment terms (30% upon signing, 20% check-in, 50% check-out). Auto-resolved conflicts in Sections 5.1 and 5.4.",
  "changes_description_ru":"Обновлен депозит до 50,000 THB и реструктурированы условия оплаты (30% при подписании, 20% при заезде, 50% после выезда). Автоматически исправлены конфликты в пунктах 5.1 и 5.4.",
  "changed_sections":[
    {
      "section":"Section 4 - Rent and Services",
      "action":"added",
      "clause_number":"4.4",
      "text_en":"Upon signing this Agreement, the Tenant shall pay 30% of the total rent amounting to 150,000 THB. Additionally 20% of the total rent, amounting to 100,000 THB, shall be paid upon check-in. The remaining 50% of the total rent, amounting to 250,000 THB, shall be paid after check-out. The security deposit of 50,000 THB is payable upon check-in.",
      "text_ru":"При подписании договора арендатор оплачивает 30% от общей суммы аренды, составляющей 150,000 THB. Дополнительно 20% от общей суммы аренды, составляющей 100,000 THB, оплачивается при заезде. Оставшиеся 50% от общей суммы аренды, составляющей 250,000 THB, оплачиваются после выезда. Депозит в размере 50,000 THB оплачивается при заезде.",
      "reason_en":"User requested new payment structure with specific percentages",
      "reason_ru":"Пользователь запросил новую структуру оплаты с указанными процентами"
    }
  ],
  "conflicts_detected":[
    {
      "section":"Section 5.1 - Security Deposit",
      "clause_number":"5.1",
      "conflict_description":"Referenced placeholder SUMMA THB instead of actual deposit amount",
      "conflict_description_ru":"Содержал заполнитель SUMMA THB вместо фактической суммы депозита",
      "text_en":"The deposit — 50,000 THB. Payment of the deposit is a mandatory condition for the handover of the Property to the Tenant.",
      "text_ru":"Депозит — 50,000 THB. Оплата депозита является обязательным условием для передачи Недвижимости Арендатору.",
      "resolution":"Updated deposit amount to match user's request of 50,000 THB",
      "resolution_ru":"Обновлена сумма депозита в соответствии с запросом пользователя на 50,000 THB"
    },
    {
      "section":"Section 5.4 - Security Deposit Return",
      "clause_number":"5.4",
      "conflict_description":"Referenced Section 5.3 but needs to account for new payment structure",
      "conflict_description_ru":"Ссылался на пункт 5.3, но нужно учесть новую структуру оплаты",
      "text_en":"The deposit of 50,000 THB shall be returned to the Tenant on the day of check-out upon the return of the Property to the Lessor, less expenses listed in clause 5.3 of the Agreement.",
      "text_ru":"Депозит в размере 50,000 THB возвращается Арендатору в день выезда при возврате Недвижимости Арендодателю за вычетом расходов, перечисленных в пункте 5.3 Договора.",
      "resolution":"Added specific deposit amount for clarity",
      "resolution_ru":"Добавлена конкретная сумма депозита для ясности"
    }
  ],
  "changed_fields":["Section 4 - Rent and Services","Section 5 - Security Deposit"],
  "structure_after":{"city":"Phuket","date":"2025-09-01T07:33:28.474Z","title":"LEASE AGREEMENT","nodes":[...COMPLETE MINIFIED STRUCTURE...]},
  "database_updates":{"deposit_amount":50000,"upon_signed_pay":150000,"upon_checkin_pay":100000,"upon_checkout_pay":250000},
  "ai_response":"Отлично! Я обновил депозит до 50,000 THB и добавил новую структуру оплаты (30% при подписании, 20% при заезде, 50% после выезда). Также автоматически исправил конфликтующие пункты 5.1 и 5.4, чтобы они соответствовали новым условиям."
}

═══════════════════════════════════════════════════════════════════
⚡ CRITICAL REQUIREMENTS
═══════════════════════════════════════════════════════════════════

✅ YOU MUST:
1. Analyze ENTIRE contract for conflicts
2. Auto-fix ALL conflicting clauses
3. Report ALL changes in changed_sections array
4. Report ALL conflicts in conflicts_detected array
5. Return structure_after as MINIFIED JSON object
6. Provide detailed English AND Russian text for each change
7. Update database_updates with affected fields
8. Be thorough and professional

❌ YOU MUST NOT:
1. Ignore conflicts between clauses
2. Make only requested changes without checking consistency
3. Return pretty-printed JSON
4. Leave placeholder text like "SUMMA THB"
5. Use casual language

Return ONLY valid JSON. Be comprehensive!`;
}

private buildEditPrompt(request: AgreementEditRequest): string {
    return `═══════════════════════════════════════════════════════════════════
📋 USER REQUEST (IN RUSSIAN)
═══════════════════════════════════════════════════════════════════

"${request.prompt}"

═══════════════════════════════════════════════════════════════════
📊 CURRENT STRUCTURE (MODIFY THIS)
═══════════════════════════════════════════════════════════════════

${request.currentStructure || '{}'}

═══════════════════════════════════════════════════════════════════
🎯 YOUR TASK
═══════════════════════════════════════════════════════════════════

1. Understand the Russian request
2. Analyze entire contract for conflicts
3. Modify structure (add/edit/remove nodes) in professional legal English
4. Auto-fix ALL conflicting clauses
5. Return COMPLETE MINIFIED structure + detailed change reports

**Remember:** 
- structure_after must be MINIFIED JSON object (no spaces/newlines)
- Report ALL changes in changed_sections array
- Report ALL conflicts in conflicts_detected array
- Provide English AND Russian text for each change

Return valid JSON response following the exact format specified in system prompt.`;
  }

async saveEditLog(
  db: any,
  data: {
    agreementId: number;
    userId: number;
    conversationId: string;
    prompt: string;
    aiResponse: string;
    changesDescription: string;
    changesList: any[];
    htmlBefore: string;
    htmlAfter: string;
    structureBefore: string;
    structureAfter: string;
    databaseFieldsChanged: any;
    wasApplied: boolean;
    appliedAt?: Date;
  }
): Promise<number> {
  try {
    logger.info('💾 saveEditLog started');
    logger.info('Data validation: ' + JSON.stringify({
      agreementId: data.agreementId,
      userId: data.userId,
      conversationId: data.conversationId,
      promptLength: data.prompt?.length || 0,
      aiResponseLength: data.aiResponse?.length || 0,
      changesDescriptionLength: data.changesDescription?.length || 0,
      changesListLength: data.changesList?.length || 0,
      htmlBeforeLength: data.htmlBefore?.length || 0,
      htmlAfterLength: data.htmlAfter?.length || 0,
      structureBeforeLength: data.structureBefore?.length || 0,
      structureAfterLength: data.structureAfter?.length || 0,
      hasDbUpdates: !!data.databaseFieldsChanged,
      wasApplied: data.wasApplied
    }));

    const result = await db.query(
      `INSERT INTO agreement_ai_edit_logs (
        agreement_id, user_id, conversation_id, prompt, ai_response,
        changes_description, changes_list, html_before, html_after,
        structure_before, structure_after, database_fields_changed,
        was_applied, applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.agreementId,
        data.userId,
        data.conversationId,
        data.prompt,
        data.aiResponse,
        data.changesDescription,
        JSON.stringify(data.changesList),
        data.htmlBefore,
        data.htmlAfter,
        data.structureBefore,
        data.structureAfter,
        JSON.stringify(data.databaseFieldsChanged),
        data.wasApplied,
        data.appliedAt || null
      ]
    );

    const insertId = (result as any).insertId;
    logger.info('✅ saveEditLog completed, insertId: ' + insertId);
    
    return insertId;
  } catch (error: any) {
    logger.error('❌ saveEditLog error: ' + error.message);
    logger.error('SQL error code: ' + (error.code || 'unknown'));
    logger.error('SQL error: ' + (error.sqlMessage || 'no sql message'));
    throw error;
  }
}

  async getEditHistory(db: any, agreementId: number): Promise<any[]> {
    const rows = await db.query(
      `SELECT 
        l.*,
        u.full_name as user_name
      FROM agreement_ai_edit_logs l
      LEFT JOIN admin_users u ON l.user_id = u.id
      WHERE l.agreement_id = ?
      ORDER BY l.created_at DESC`,
      [agreementId]
    );

    return rows as any[];
  }

  private handleAIError(error: any): Error {
    if (error.response?.status === 401) {
      return new Error('AI proxy authentication error');
    }
    if (error.response?.status === 503) {
      return new Error('AI service temporarily unavailable');
    }
    if (error.code === 'ECONNREFUSED') {
      return new Error('Could not connect to AI proxy server');
    }
    if (error.message?.includes('JSON')) {
      return new Error('AI returned invalid response format');
    }
    return new Error('Failed to process agreement edit request');
  }
}

export default new AIAgreementEditorService();