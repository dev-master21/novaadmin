// backend/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import propertiesRoutes from './properties.routes';
import usersRoutes from './users.routes';
import rolesRoutes from './roles.routes';
import mapsRoutes from './maps.routes';
import fileManagerRoutes from './fileManager.routes';
import agreementsRoutes from './agreements.routes';
import requestsRoutes from './requests.routes';
import botSettingsRoutes from './botSettings.routes';
import financialDocumentsRoutes from './financialDocuments.routes';
import propertySearchRoutes from './propertySearch.routes';
import contactsRoutes from './contacts.routes';
import integrationsRoutes from './integrations.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/maps', mapsRoutes);
router.use('/file-manager', fileManagerRoutes);
router.use('/agreements', agreementsRoutes);
router.use('/requests', requestsRoutes);
router.use('/bot-settings', botSettingsRoutes);
router.use('/financial-documents', financialDocumentsRoutes);
router.use('/property-search', propertySearchRoutes);
router.use('/contacts', contactsRoutes);
router.use('/integrations', integrationsRoutes);

export default router;