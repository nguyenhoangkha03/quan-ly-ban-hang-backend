/**
 * Seed Production Report Test Data
 * Run: ts-node -r tsconfig-paths/register prisma/seed-production.ts
 */

import { PrismaClient, ProductionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProductionData() {
  console.log('🌱 Seeding Production Report Test Data...\n');

  try {
    // 1. Get or create warehouse
    let warehouse = await prisma.warehouse.findFirst();
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          warehouseCode: 'KNL-001',
          warehouseName: 'Kho Nguyên Liệu Chính',
          warehouseType: 'raw_material',
          city: 'Ho Chi Minh',
          address: '123 Đường ABC',
        },
      });
      console.log('✅ Created warehouse:', warehouse.warehouseCode);
    } else {
      console.log('✅ Using existing warehouse:', warehouse.warehouseCode);
    }

    // 2. Get or create user (creator)
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log('⚠️  No user found. Create one first via API or seed.');
      process.exit(1);
    }
    console.log('✅ Using user:', user.fullName);

    // 3. Create or get products (materials & finished products)
    const products = await prisma.product.findMany({ take: 5 });
    if (products.length < 2) {
      console.log('⚠️  Not enough products. Need at least 2 products.');
      console.log('    Create products first via API or seed.');
      process.exit(1);
    }
    console.log(`✅ Found ${products.length} products`);

    const finishedProduct = products[0]; // First product as finished good
    const materialProducts = products.slice(1, 3); // Rest as materials

    // 4. Get or create BOM
    let bom = await prisma.bom.findFirst({
      where: { finishedProductId: finishedProduct.id },
    });

    if (!bom) {
      bom = await prisma.bom.create({
        data: {
          bomCode: `BOM-${finishedProduct.id}-001`,
          finishedProductId: finishedProduct.id,
          outputQuantity: 100,
          efficiencyRate: 95,
          status: 'active',
          createdBy: user.id,
          approvedBy: user.id,
        },
      });
      console.log('✅ Created BOM:', bom.bomCode);
    } else {
      console.log('✅ Using existing BOM:', bom.bomCode);
    }

    // 5. Create BOM Materials if not exist
    const existingBomMaterials = await prisma.bomMaterial.findMany({
      where: { bomId: bom.id },
    });

    if (existingBomMaterials.length === 0) {
      for (const material of materialProducts) {
        await prisma.bomMaterial.create({
          data: {
            bomId: bom.id,
            materialId: material.id,
            quantity: 10,
            materialType: 'raw_material',
          },
        });
      }
      console.log(`✅ Created ${materialProducts.length} BOM materials`);
    } else {
      console.log(`✅ Using existing ${existingBomMaterials.length} BOM materials`);
    }

    // 6. Create multiple Production Orders with different statuses
    const baseDate = new Date('2024-01-01');
    const statuses: ProductionStatus[] = ['pending', 'in_progress', 'completed', 'completed', 'in_progress'];

    for (let i = 0; i < 5; i++) {
      const startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() + i * 2);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 5);

      const completedAt = statuses[i] === 'completed' ? endDate : null;

      const order = await prisma.productionOrder.create({
        data: {
          orderCode: `LSX-20240101-00${i + 1}`,
          bomId: bom.id,
          finishedProductId: finishedProduct.id,
          warehouseId: warehouse.id,
          plannedQuantity: 100 + i * 10,
          actualQuantity: Math.floor((100 + i * 10) * (0.9 + Math.random() * 0.1)), // 90-100% efficiency
          productionCost: (100 + i * 10) * 1000, // 1000 per unit
          startDate: startDate,
          endDate: endDate,
          completedAt: completedAt,
          status: statuses[i],
          createdBy: user.id,
          approvedBy: statuses[i] !== 'pending' ? user.id : null,
        },
      });

      console.log(`✅ Created production order: ${order.orderCode} (${order.status})`);

      // 7. Create ProductionOrderMaterial records
      for (const material of materialProducts) {
        const plannedQty = 10 + Math.floor(Math.random() * 5);
        const actualQty = Math.floor(plannedQty * (0.85 + Math.random() * 0.15)); // 85-100% actual
        const wastageQty = plannedQty - actualQty;

        await prisma.productionOrderMaterial.create({
          data: {
            productionOrderId: order.id,
            materialId: material.id,
            plannedQuantity: plannedQty,
            actualQuantity: actualQty,
            wastage: wastageQty,
            unitPrice: (material.purchasePrice as any) || 50000, // Use product price or default
            materialType: 'raw_material',
          },
        });
      }

      console.log(`   └─ Added ${materialProducts.length} materials with wastage`);
    }

    console.log('\n✅ Production data seeding completed!');
    console.log('\n📊 Test data summary:');
    console.log('   - Production Orders: 5');
    console.log('   - Statuses: pending, in_progress, completed');
    console.log('   - Materials per order: 2');
    console.log('   - Wastage simulation: enabled');
    console.log('\n🚀 Now run your tests again:\n');
    console.log('   npx ts-node -r tsconfig-paths/register src/test/test-production-report.ts\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedProductionData();
