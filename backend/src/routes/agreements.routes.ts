// backend/src/routes/agreements.routes.ts
import { Router } from 'express';
import { AuthRequest } from '../types';
import agreementsController from '../controllers/agreements.controller';
import agreementTemplatesController from '../controllers/agreementTemplates.controller';
import agreementSignaturesController from '../controllers/agreementSignatures.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';

const router = Router();

console.log('🔥 Agreements routes file loaded');

// ========== Публичные роуты (без авторизации) ==========
router.get('/public/:link', (req, res) => {
  console.log('✅ Hit: GET /public/:link');
  agreementsController.getByPublicLink(req as AuthRequest, res);
});

router.get('/signatures/link/:link', (req, res) => {
  console.log('✅ Hit: GET /signatures/link/:link');
  agreementSignaturesController.getByLink(req as AuthRequest, res);
});

router.post('/signatures/sign/:link', (req, res) => {
  console.log('✅ Hit: POST /signatures/sign/:link');
  agreementSignaturesController.sign(req as AuthRequest, res);
});

// ========== Защищенные роуты ==========
router.use(authenticate);

// === ШАБЛОНЫ ===
router.get('/templates/list', requirePermission('agreements.manage_templates'), (req, res) => {
  console.log('✅ Hit: GET /templates/list');
  agreementTemplatesController.getAll(req as AuthRequest, res);
});

router.post('/templates', requirePermission('agreements.manage_templates'), (req, res) => {
  console.log('✅ Hit: POST /templates');
  agreementTemplatesController.create(req as AuthRequest, res);
});

router.get('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  console.log('✅ Hit: GET /templates/:id');
  agreementTemplatesController.getById(req as AuthRequest, res);
});

router.put('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  console.log('✅ Hit: PUT /templates/:id');
  agreementTemplatesController.update(req as AuthRequest, res);
});

router.delete('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  console.log('✅ Hit: DELETE /templates/:id');
  agreementTemplatesController.delete(req as AuthRequest, res);
});

// === ДОГОВОРЫ ===
router.get('/', requirePermission('agreements.view'), (req, res) => {
  console.log('✅ Hit: GET /');
  agreementsController.getAll(req as AuthRequest, res);
});

// КРИТИЧНЫЙ РОУТ - POST для создания договора
router.post('/', (req, res) => {
  console.log('🔥🔥🔥 Hit: POST / (create agreement)');
  const authReq = req as AuthRequest;
  console.log('User:', authReq.admin);
  console.log('Body:', authReq.body);
  
  // Проверяем права вручную для отладки
  if (!authReq.admin) {
    console.log('❌ No admin user');
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  if (!authReq.admin.is_super_admin) {
    console.log('❌ Not super admin, checking permissions...');
    const hasPermission = authReq.admin.roles?.some(role =>
      role.permissions?.some(p => p.permission_name === 'agreements.create')
    );
    
    if (!hasPermission) {
      console.log('❌ No permission');
      return res.status(403).json({ success: false, message: 'No permission' });
    }
  }
  
  console.log('✅ Permissions OK, calling controller...');
  return agreementsController.create(authReq, res);
});

router.post('/:id/signatures', requirePermission('agreements.manage_signatures'), (req, res) => {
  console.log('✅ Hit: POST /:id/signatures');
  agreementsController.createSignatures(req as AuthRequest, res);
});

router.get('/:id', requirePermission('agreements.view'), (req, res) => {
  console.log('✅ Hit: GET /:id');
  agreementsController.getById(req as AuthRequest, res);
});

router.put('/:id', requirePermission('agreements.edit'), (req, res) => {
  console.log('✅ Hit: PUT /:id');
  agreementsController.update(req as AuthRequest, res);
});

router.delete('/:id', requirePermission('agreements.delete'), (req, res) => {
  console.log('✅ Hit: DELETE /:id');
  agreementsController.delete(req as AuthRequest, res);
});

// === ПОДПИСИ ===
router.delete('/signatures/:id', requirePermission('agreements.manage_signatures'), (req, res) => {
  console.log('✅ Hit: DELETE /signatures/:id');
  agreementSignaturesController.delete(req as AuthRequest, res);
});

console.log('🔥 Agreements routes configured');

export default router;