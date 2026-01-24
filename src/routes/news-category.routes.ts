import { Router } from 'express';
import { NewsCategoryController } from '../controllers/news-category.controller';

const router = Router();

// Public routes
router.get('/', NewsCategoryController.getAllCategories);
router.get('/:slug', NewsCategoryController.getCategoryBySlug);

// Admin routes
router.post('/admin', NewsCategoryController.createCategory);
router.put('/admin/:id', NewsCategoryController.updateCategory);
router.delete('/admin/:id', NewsCategoryController.deleteCategory);

export default router;
