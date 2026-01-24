import { Router } from 'express';
import publicProductController from '@controllers/cs-product.controller';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
// 👇 Import middleware MỚI
import { optionalCustomerAuthentication } from '@middlewares/authCustomer'; 
import {
     productQuerySchema,
     productIdSchema } from '@validators/product.validator';

const router = Router();
router.get(
    '/',
    optionalCustomerAuthentication,
    validate(productQuerySchema, 'query'),
    asyncHandler(publicProductController.getAll.bind(publicProductController))
);

router.get(
    '/:id',
    optionalCustomerAuthentication, // ✅ Dùng cái này
    validate(productIdSchema, 'params'),
    asyncHandler(publicProductController.getById.bind(publicProductController))
);

export default router;