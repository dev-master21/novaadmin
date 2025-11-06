// backend/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import propertiesRoutes from './properties.routes';
import usersRoutes from './users.routes';
import rolesRoutes from './roles.routes';
import mapsRoutes from './maps.routes';
import fileManagerRoutes from './fileManager.routes';
import agreementsRoutes from './agreements.routes'; // ВАЖНО: эта строка должна быть

const router = Router();

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/maps', mapsRoutes);
router.use('/file-manager', fileManagerRoutes);
router.use('/agreements', agreementsRoutes); // ВАЖНО: эта строка должна быть

export default router;