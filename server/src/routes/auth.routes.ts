import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), controller.updateProfile);
router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), controller.changePassword);

export default router;
