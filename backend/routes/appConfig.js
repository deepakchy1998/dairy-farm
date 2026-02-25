import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';
import AppConfig from '../models/AppConfig.js';

const router = Router();

// Get app config (any authenticated user)
router.get('/', auth, async (req, res, next) => {
  try {
    let config = await AppConfig.findOne({ key: 'global' }).lean();
    if (!config) {
      config = await AppConfig.create({ key: 'global' });
      config = config.toObject();
    }
    // Remove internal fields
    delete config._id;
    delete config.__v;
    delete config.key;
    delete config.createdAt;
    delete config.updatedAt;
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

// Update app config (admin only)
router.put('/', auth, admin, async (req, res, next) => {
  try {
    const arrayFields = [
      'employeeRoles', 'cattleCategories', 'cattleBreeds', 'healthRecordTypes',
      'expenseCategories', 'revenueCategories', 'feedTypes', 'paymentMethods', 'milkDeliverySessions',
    ];
    const numberFields = [
      'notificationRetentionDays', 'maxBackupRecords', 'trialDays', 'maxFileUploadMB', 'sessionTimeoutHours',
    ];
    const stringFields = [
      'maintenanceMessage', 'welcomeMessage', 'currencySymbol', 'dateFormat', 'milkUnit', 'weightUnit',
    ];
    const boolFields = ['maintenanceMode'];

    let config = await AppConfig.findOne({ key: 'global' });
    if (!config) config = new AppConfig({ key: 'global' });

    for (const field of arrayFields) {
      if (req.body[field] !== undefined) {
        if (!Array.isArray(req.body[field])) {
          return res.status(400).json({ success: false, message: `${field} must be an array` });
        }
        config[field] = req.body[field].map(v => String(v).trim()).filter(Boolean);
      }
    }
    for (const field of numberFields) {
      if (req.body[field] !== undefined) config[field] = Number(req.body[field]) || 0;
    }
    for (const field of stringFields) {
      if (req.body[field] !== undefined) config[field] = String(req.body[field]);
    }
    for (const field of boolFields) {
      if (req.body[field] !== undefined) config[field] = !!req.body[field];
    }

    await config.save();
    console.log(`[ADMIN] AppConfig updated by admin=${req.user._id}`);
    res.json({ success: true, data: config, message: 'Configuration saved' });
  } catch (err) { next(err); }
});

export default router;
