import { Router } from 'express';
import LandingContent from '../models/LandingContent.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const content = await LandingContent.findOne();
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

export default router;
