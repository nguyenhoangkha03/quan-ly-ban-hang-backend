import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';

const router = Router();

// Public routes
router.get('/', NewsController.getAllNews);
router.get('/featured', NewsController.getFeaturedNews);
router.get('/:slug', NewsController.getNewsBySlug);
router.post('/:id/view', NewsController.incrementViewCount);
router.get('/:id/related', NewsController.getRelatedNews);

// Admin routes
router.get('/admin/all', NewsController.getAllNewsAdmin);
router.get('/admin/:id', NewsController.getNewsById);
router.post('/admin', NewsController.createNews);
router.put('/admin/:id', NewsController.updateNews);
router.delete('/admin/:id', NewsController.deleteNews);
router.post('/admin/:id/publish', NewsController.publishNews);
router.post('/admin/:id/archive', NewsController.archiveNews);

export default router;
