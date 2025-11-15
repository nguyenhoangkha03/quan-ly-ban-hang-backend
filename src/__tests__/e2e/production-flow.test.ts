import request from 'supertest';
import express, { Application } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@utils/password';

import authRoutes from '@routes/auth.routes';
import warehouseRoutes from '@routes/warehouse.routes';
import categoryRoutes from '@routes/category.routes';
import productRoutes from '@routes/product.routes';
import bomRoutes from '@routes/bom.routes';
import productionOrderRoutes from '@routes/production-order.routes';
import inventoryRoutes from '@routes/inventory.routes';
import { errorHandler } from '@middlewares/errorHandler';

const prisma = new PrismaClient();

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/warehouses', warehouseRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/bom', bomRoutes);
  app.use('/api/production-orders', productionOrderRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
};

describe('E2E: Complete Production Flow', () => {
  let app: Application;
  let accessToken: string;
  let adminRole: any;
  let adminUser: any;
  let warehouseRawMaterial: any;
  let warehousePackaging: any;
  let warehouseFinished: any;
  let category: any;
  let rawMaterial: any;
  let packaging: any;
  let finishedProduct: any;
  let bom: any;
  let productionOrder: any;

  beforeAll(async () => {
    app = createTestApp();

    // Create admin role
    adminRole = await prisma.role.upsert({
      where: { roleKey: 'production_admin' },
      update: {},
      create: {
        roleKey: 'production_admin',
        roleName: 'Production Admin',
        status: 'active',
      },
    });

    // Create admin user
    const hashedPassword = await hashPassword('Production@123');
    adminUser = await prisma.user.upsert({
      where: { email: 'production@e2etest.com' },
      update: {},
      create: {
        employeeCode: 'PROD-ADMIN',
        email: 'production@e2etest.com',
        passwordHash: hashedPassword,
        fullName: 'Production Admin',
        roleId: adminRole.id,
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Clean up
    if (productionOrder) {
      await prisma.productionOrderMaterial.deleteMany({
        where: { productionOrderId: productionOrder.id },
      });
      await prisma.productionOrder.delete({ where: { id: productionOrder.id } }).catch(() => {});
    }
    if (bom) {
      await prisma.bomMaterial.deleteMany({ where: { bomId: bom.id } });
      await prisma.bom.delete({ where: { id: bom.id } }).catch(() => {});
    }
    if (finishedProduct) {
      await prisma.inventory.deleteMany({ where: { productId: finishedProduct.id } });
      await prisma.product.delete({ where: { id: finishedProduct.id } }).catch(() => {});
    }
    if (packaging) {
      await prisma.inventory.deleteMany({ where: { productId: packaging.id } });
      await prisma.product.delete({ where: { id: packaging.id } }).catch(() => {});
    }
    if (rawMaterial) {
      await prisma.inventory.deleteMany({ where: { productId: rawMaterial.id } });
      await prisma.product.delete({ where: { id: rawMaterial.id } }).catch(() => {});
    }
    if (category) {
      await prisma.category.delete({ where: { id: category.id } }).catch(() => {});
    }
    if (warehouseRawMaterial) {
      await prisma.warehouse.delete({ where: { id: warehouseRawMaterial.id } }).catch(() => {});
    }
    if (warehousePackaging) {
      await prisma.warehouse.delete({ where: { id: warehousePackaging.id } }).catch(() => {});
    }
    if (warehouseFinished) {
      await prisma.warehouse.delete({ where: { id: warehouseFinished.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
    await prisma.role.delete({ where: { roleKey: 'production_admin' } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('should complete full production flow', async () => {
    // Step 1: Login
    console.log('Step 1: Login...');
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'production@e2etest.com',
      password: 'Production@123',
    });

    expect(loginResponse.status).toBe(200);
    accessToken = loginResponse.body.data.tokens.accessToken;
    console.log('✓ Login successful');

    // Step 2: Create warehouses
    console.log('Step 2: Creating warehouses...');
    const whRawResponse = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        warehouseCode: 'WH-RAW-E2E',
        warehouseName: 'E2E Raw Material Warehouse',
        warehouseType: 'raw_material',
        status: 'active',
      });
    warehouseRawMaterial = whRawResponse.body.data;

    const whPackResponse = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        warehouseCode: 'WH-PACK-E2E',
        warehouseName: 'E2E Packaging Warehouse',
        warehouseType: 'packaging',
        status: 'active',
      });
    warehousePackaging = whPackResponse.body.data;

    const whFinResponse = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        warehouseCode: 'WH-FIN-E2E',
        warehouseName: 'E2E Finished Product Warehouse',
        warehouseType: 'finished_product',
        status: 'active',
      });
    warehouseFinished = whFinResponse.body.data;
    console.log('✓ Warehouses created');

    // Step 3: Create category
    console.log('Step 3: Creating category...');
    const categoryResponse = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryCode: 'CAT-PROD-E2E',
        categoryName: 'Production Test Category',
        slug: 'production-test-category',
        status: 'active',
      });
    category = categoryResponse.body.data;
    console.log('✓ Category created');

    // Step 4: Create raw material product
    console.log('Step 4: Creating raw material...');
    const rawMaterialResponse = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'RAW-SUGAR-E2E',
        slug: 'raw-sugar-e2e',
        productName: 'Sugar (Raw Material)',
        productType: 'raw_material',
        categoryId: category.id,
        unit: 'kg',
        purchasePrice: 20,
        status: 'active',
      });
    rawMaterial = rawMaterialResponse.body.data;
    console.log('✓ Raw material created:', rawMaterial.sku);

    // Step 5: Create packaging product
    console.log('Step 5: Creating packaging...');
    const packagingResponse = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'PACK-BOTTLE-E2E',
        slug: 'pack-bottle-e2e',
        productName: 'Bottle 500ml (Packaging)',
        productType: 'packaging',
        packagingType: 'bottle',
        categoryId: category.id,
        unit: 'pcs',
        purchasePrice: 5,
        status: 'active',
      });
    packaging = packagingResponse.body.data;
    console.log('✓ Packaging created:', packaging.sku);

    // Step 6: Create finished product
    console.log('Step 6: Creating finished product...');
    const finishedResponse = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: 'FIN-JUICE-E2E',
        slug: 'fin-juice-e2e',
        productName: 'Lemon Juice 500ml',
        productType: 'finished_product',
        categoryId: category.id,
        unit: 'pcs',
        sellingPriceRetail: 50,
        status: 'active',
      });
    finishedProduct = finishedResponse.body.data;
    console.log('✓ Finished product created:', finishedProduct.sku);

    // Step 7: Add inventory for raw materials and packaging
    console.log('Step 7: Adding inventory for materials...');
    await prisma.inventory.createMany({
      data: [
        {
          warehouseId: warehouseRawMaterial.id,
          productId: rawMaterial.id,
          quantity: 1000,
          reservedQuantity: 0,
        },
        {
          warehouseId: warehousePackaging.id,
          productId: packaging.id,
          quantity: 500,
          reservedQuantity: 0,
        },
      ],
    });
    console.log('✓ Inventory added: 1000kg sugar, 500 bottles');

    // Step 8: Create BOM
    console.log('Step 8: Creating BOM...');
    const bomResponse = await request(app)
      .post('/api/bom')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bomCode: 'BOM-JUICE-E2E',
        finishedProductId: finishedProduct.id,
        version: '1.0',
        outputQuantity: 100,
        efficiencyRate: 95,
        productionTime: 60,
        materials: [
          {
            materialId: rawMaterial.id,
            quantity: 50,
            unit: 'kg',
            materialType: 'raw_material',
          },
          {
            materialId: packaging.id,
            quantity: 100,
            unit: 'pcs',
            materialType: 'packaging',
          },
        ],
      });

    expect(bomResponse.status).toBe(201);
    bom = bomResponse.body.data;
    console.log('✓ BOM created:', bom.bomCode);

    // Step 9: Approve BOM
    console.log('Step 9: Approving BOM...');
    const approveBomResponse = await request(app)
      .put(`/api/bom/${bom.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(approveBomResponse.status).toBe(200);
    console.log('✓ BOM approved');

    // Step 10: Create production order
    console.log('Step 10: Creating production order...');
    const productionResponse = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bomId: bom.id,
        warehouseId: warehouseFinished.id,
        plannedQuantity: 100,
        startDate: new Date().toISOString().split('T')[0],
        notes: 'E2E Production Test',
      });

    expect(productionResponse.status).toBe(201);
    productionOrder = productionResponse.body.data;
    console.log('✓ Production order created:', productionOrder.orderCode);

    // Step 11: Start production (exports materials)
    console.log('Step 11: Starting production...');
    const startResponse = await request(app)
      .put(`/api/production-orders/${productionOrder.id}/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        materials: [
          {
            materialId: rawMaterial.id,
            actualQuantity: 50,
          },
          {
            materialId: packaging.id,
            actualQuantity: 100,
          },
        ],
      });

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.data.status).toBe('in_progress');
    console.log('✓ Production started');

    // Step 12: Verify materials were exported
    console.log('Step 12: Verifying material export...');
    const rawInventoryAfterExport = await prisma.inventory.findFirst({
      where: {
        warehouseId: warehouseRawMaterial.id,
        productId: rawMaterial.id,
      },
    });

    expect(Number(rawInventoryAfterExport!.quantity)).toBeLessThan(1000);
    console.log('✓ Materials exported from warehouse');

    // Step 13: Complete production (imports finished products)
    console.log('Step 13: Completing production...');
    const completeResponse = await request(app)
      .put(`/api/production-orders/${productionOrder.id}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        actualQuantity: 95,
        notes: 'Production completed successfully',
      });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.data.status).toBe('completed');
    console.log('✓ Production completed');

    // Step 14: Verify finished products were imported
    console.log('Step 14: Verifying finished product import...');
    const finishedInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId: warehouseFinished.id,
        productId: finishedProduct.id,
      },
    });

    expect(finishedInventory).toBeDefined();
    expect(Number(finishedInventory!.quantity)).toBe(95);
    console.log('✓ Finished products imported:', finishedInventory!.quantity);

    // Step 15: Verify wastage calculation
    console.log('Step 15: Verifying wastage...');
    const updatedOrder = await prisma.productionOrder.findUnique({
      where: { id: productionOrder.id },
      include: { materials: true },
    });

    expect(updatedOrder!.actualQuantity).toBe(95);
    expect(updatedOrder!.plannedQuantity).toBe(100);
    const wastage = updatedOrder!.plannedQuantity! - updatedOrder!.actualQuantity!;
    expect(wastage).toBe(5);
    console.log('✓ Wastage calculated:', wastage, 'units');

    console.log('\n✅ Full production E2E flow completed successfully!');
  });
});
