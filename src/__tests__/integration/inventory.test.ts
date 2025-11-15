import request from 'supertest';
import express, { Application } from 'express';
import inventoryRoutes from '@routes/inventory.routes';
import { errorHandler } from '@middlewares/errorHandler';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@utils/jwt';

const prisma = new PrismaClient();

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
};

describe('Inventory Integration Tests', () => {
  let app: Application;
  let accessToken: string;
  let testRole: any;
  let testUser: any;
  let testWarehouse: any;
  let testCategory: any;
  let testProduct: any;
  let testInventory: any;

  beforeAll(async () => {
    app = createTestApp();

    // Create test role with permissions
    testRole = await prisma.role.upsert({
      where: { roleKey: 'test_inventory' },
      update: {},
      create: {
        roleKey: 'test_inventory',
        roleName: 'Test Inventory Manager',
        status: 'active',
      },
    });

    // Create test user
    testUser = await prisma.user.upsert({
      where: { email: 'inventory@test.com' },
      update: {},
      create: {
        employeeCode: 'INV001',
        email: 'inventory@test.com',
        passwordHash: 'hashedpassword',
        fullName: 'Inventory Test User',
        roleId: testRole.id,
        status: 'active',
      },
    });

    // Generate access token
    accessToken = generateAccessToken({
      id: testUser.id,
      email: testUser.email,
      roleId: testUser.roleId,
      employeeCode: testUser.employeeCode,
    });

    // Create test warehouse
    testWarehouse = await prisma.warehouse.create({
      data: {
        warehouseCode: 'TEST-WH-001',
        warehouseName: 'Test Warehouse',
        warehouseType: 'finished_product',
        status: 'active',
      },
    });

    // Create test category
    testCategory = await prisma.category.create({
      data: {
        categoryCode: 'TEST-CAT-001',
        categoryName: 'Test Category',
        slug: 'test-category',
        status: 'active',
      },
    });

    // Create test product
    testProduct = await prisma.product.create({
      data: {
        sku: 'TEST-PROD-001',
        slug: 'test-product',
        productName: 'Test Product',
        productType: 'finished_product',
        unit: 'pcs',
        categoryId: testCategory.id,
        purchasePrice: 100,
        sellingPriceRetail: 150,
        minStockLevel: 10,
        status: 'active',
      },
    });

    // Create test inventory
    testInventory = await prisma.inventory.create({
      data: {
        warehouseId: testWarehouse.id,
        productId: testProduct.id,
        quantity: 100,
        reservedQuantity: 20,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.inventory.deleteMany({ where: { warehouseId: testWarehouse.id } });
    await prisma.product.deleteMany({ where: { categoryId: testCategory.id } });
    await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => {});
    await prisma.warehouse.delete({ where: { id: testWarehouse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    await prisma.role.delete({ where: { id: testRole.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('GET /api/inventory', () => {
    it('should get all inventory with authentication', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter inventory by warehouse', async () => {
      const response = await request(app)
        .get(`/api/inventory?warehouseId=${testWarehouse.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every((inv: any) => inv.warehouseId === testWarehouse.id)).toBe(
        true
      );
    });

    it('should filter inventory by product', async () => {
      const response = await request(app)
        .get(`/api/inventory?productId=${testProduct.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].productId).toBe(testProduct.id);
      }
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/inventory');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/inventory/warehouse/:id', () => {
    it('should get inventory by warehouse', async () => {
      const response = await request(app)
        .get(`/api/inventory/warehouse/${testWarehouse.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('warehouse');
      expect(response.body.data).toHaveProperty('inventory');
      expect(response.body.data.warehouse.id).toBe(testWarehouse.id);
    });

    it('should return 404 for non-existent warehouse', async () => {
      const response = await request(app)
        .get('/api/inventory/warehouse/99999')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/inventory/product/:id', () => {
    it('should get inventory by product', async () => {
      const response = await request(app)
        .get(`/api/inventory/product/${testProduct.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data).toHaveProperty('inventory');
      expect(response.body.data.product.id).toBe(testProduct.id);
    });
  });

  describe('POST /api/inventory/check', () => {
    it('should check if inventory is available', async () => {
      const response = await request(app)
        .post('/api/inventory/check')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          warehouseId: testWarehouse.id,
          items: [
            {
              productId: testProduct.id,
              quantity: 50,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('available');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.available).toBe(true);
    });

    it('should return false when quantity exceeds available', async () => {
      const response = await request(app)
        .post('/api/inventory/check')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          warehouseId: testWarehouse.id,
          items: [
            {
              productId: testProduct.id,
              quantity: 1000, // More than available
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.items[0].available).toBe(false);
    });

    it('should fail with invalid warehouse', async () => {
      const response = await request(app)
        .post('/api/inventory/check')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          warehouseId: 99999,
          items: [
            {
              productId: testProduct.id,
              quantity: 10,
            },
          ],
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/inventory/alerts', () => {
    it('should get low stock alerts', async () => {
      const response = await request(app)
        .get('/api/inventory/alerts')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lowStock');
      expect(Array.isArray(response.body.data.lowStock)).toBe(true);
    });
  });

  describe('Inventory calculations', () => {
    it('should correctly calculate available quantity', async () => {
      const response = await request(app)
        .get(`/api/inventory?productId=${testProduct.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      const inventory = response.body.data[0];
      const expectedAvailable = Number(inventory.quantity) - Number(inventory.reservedQuantity);
      expect(inventory.availableQuantity).toBe(expectedAvailable);
    });
  });
});
