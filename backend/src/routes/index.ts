// backend/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import propertiesRoutes from './properties.routes';
import usersRoutes from './users.routes';
import rolesRoutes from './roles.routes';
import mapsRoutes from './maps.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/api/maps', mapsRoutes);

export default router;