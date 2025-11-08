// backend/src/routes/agreements.routes.ts
import { Router } from 'express';
import { AuthRequest } from '../types';
import agreementsController from '../controllers/agreements.controller';
import agreementTemplatesController from '../controllers/agreementTemplates.controller';
import agreementSignaturesController from '../controllers/agreementSignatures.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { uploadPartyDocument } from '../middlewares/upload.middleware';

const router = Router();

// ========== Публичные роуты (без авторизации) ==========
router.get('/public/:link', (req, res) => {
  agreementsController.getByPublicLink(req as AuthRequest, res);
});

router.get('/signatures/link/:link', (req, res) => {
  agreementSignaturesController.getByLink(req as AuthRequest, res);
});

router.post('/signatures/sign/:link', (req, res) => {
  agreementSignaturesController.sign(req as AuthRequest, res);
});

// ========== Защищенные роуты ==========
router.use(authenticate);

// Получение объектов (должно быть ДО роутов с :id)
router.get('/properties', (req, res) => {
  agreementsController.getProperties(req as AuthRequest, res);
});

// === ШАБЛОНЫ ===
router.get('/templates/list', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.getAll(req as AuthRequest, res);
});

router.post('/templates', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.create(req as AuthRequest, res);
});

router.get('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.getById(req as AuthRequest, res);
});

router.put('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.update(req as AuthRequest, res);
});

router.delete('/templates/:id', requirePermission('agreements.manage_templates'), (req, res) => {
  agreementTemplatesController.delete(req as AuthRequest, res);
});

// === ДОГОВОРЫ ===
router.get('/', requirePermission('agreements.view'), (req, res) => {
  agreementsController.getAll(req as AuthRequest, res);
});

router.post('/', requirePermission('agreements.create'), (req, res) => {
  agreementsController.create(req as AuthRequest, res);
});

router.post('/:id/signatures', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementsController.createSignatures(req as AuthRequest, res);
});

router.get('/:id', requirePermission('agreements.view'), (req, res) => {
  agreementsController.getById(req as AuthRequest, res);
});

router.put('/:id', requirePermission('agreements.edit'), (req, res) => {
  agreementsController.update(req as AuthRequest, res);
});

router.delete('/:id', requirePermission('agreements.delete'), (req, res) => {
  agreementsController.delete(req as AuthRequest, res);
});
// Загрузка документа стороны
router.post('/parties/:partyId/document', 
  uploadPartyDocument.single('document'), 
  (req, res) => {
    agreementsController.uploadPartyDocument(req as AuthRequest, res);
  }
);

// Удаление документа стороны
router.delete('/parties/:partyId/document', (req, res) => {
  agreementsController.deletePartyDocument(req as AuthRequest, res);
});

// === ПОДПИСИ ===
router.put('/signatures/:id', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.update(req as AuthRequest, res);
});

router.post('/signatures/:id/regenerate', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.regenerateLink(req as AuthRequest, res);
});

router.delete('/signatures/:id', requirePermission('agreements.manage_signatures'), (req, res) => {
  agreementSignaturesController.delete(req as AuthRequest, res);
});
export default router;