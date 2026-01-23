import { Router } from 'express';
import generalSettingController from '@controllers/general-setting.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

router.use(authentication);

// Get general settings
router.get(
  '/',
  authorize('manage_settings'),
  asyncHandler(generalSettingController.getGeneralSetting.bind(generalSettingController))
);

// Update general settings
router.put(
  '/',
  authorize('manage_settings'),
  asyncHandler(generalSettingController.updateGeneralSetting.bind(generalSettingController))
);

export default router;
