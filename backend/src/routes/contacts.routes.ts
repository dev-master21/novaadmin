import { Router } from 'express';
import contactsController from '../controllers/contacts.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, contactsController.getAll);
router.post('/', authenticate, contactsController.create);
router.delete('/:id', authenticate, contactsController.delete);

export default router;