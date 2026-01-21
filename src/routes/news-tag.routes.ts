import { Router } from 'express';
import { NewsTagController } from '../controllers/news-tag.controller';

const router = Router();

// Public routes
router.get('/', NewsTagController.getAllTags);
router.get('/:slug', NewsTagController.getTagBySlug);

// Admin routes
router.post('/admin', NewsTagController.createTag);
router.delete('/admin/:id', NewsTagController.deleteTag);

export default router;
