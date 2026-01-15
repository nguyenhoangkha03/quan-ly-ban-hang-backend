import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🌱 Inserting sales orders for today (2026-01-04)...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'khang',
    database: process.env.DB_NAME || 'qlbh',
  });

  try {
    // Get IDs
    const [customerRows]: any = await connection.query('SELECT id FROM customers LIMIT 1');
    const [userRows]: any = await connection.query('SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE role_key = "sales_staff") LIMIT 1');
    const [productRows]: any = await connection.query('SELECT id FROM products WHERE status = "active" LIMIT 1');
    const [warehouseRows]: any = await connection.query('SELECT id FROM warehouses LIMIT 1');

    const cid = customerRows[0].id;
    const uid = userRows[0].id;
    const pid = productRows[0].id;
    const wid = warehouseRows[0].id;

    console.log(`✓ Customer ID: ${cid}`);
    console.log(`✓ User ID: ${uid}`);
    console.log(`✓ Product ID: ${pid}`);
    console.log(`✓ Warehouse ID: ${wid}\n`);

    // Insert orders
    const orders = [
      ['DH-2026-00041', cid, wid, 'retail', 5000000, 500000, 400000, 50000, 3000000, 'partial', 'completed'],
      ['DH-2026-00042', cid, wid, 'wholesale', 8000000, 800000, 640000, 100000, 8000000, 'paid', 'completed'],
      ['DH-2026-00043', cid, wid, 'online', 3500000, 0, 280000, 30000, 3500000, 'paid', 'completed'],
      ['DH-2026-00044', cid, wid, 'distributor', 6000000, 600000, 480000, 80000, 0, 'unpaid', 'preparing'],
      ['DH-2026-00045', cid, wid, 'retail', 2500000, 250000, 200000, 30000, 1500000, 'partial', 'preparing'],
    ];

    for (const order of orders) {
      const completedAt = order[10] === 'completed' ? '2026-01-04 14:00:00' : null;
      
      await connection.query(
        `INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [order[0], order[1], order[2], '2026-01-04', completedAt, order[3], order[4], order[5], order[6], order[7], order[8], 'credit', order[9], order[10], '123 Test Address', 'Test order', uid]
      );
    }

    console.log('✅ Created 5 sales orders\n');

    // Get order IDs
    const [orderRows]: any = await connection.query(
      `SELECT id, order_code, total_amount FROM sales_orders 
       WHERE order_code IN ('DH-2026-00041', 'DH-2026-00042', 'DH-2026-00043', 'DH-2026-00044', 'DH-2026-00045')`
    );

    // Insert order details
    const quantities = [100, 150, 70, 120, 50];
    const prices = [50000, 53000, 50000, 50000, 50000];
    const discounts = [10, 10, 0, 10, 10];

    for (let i = 0; i < orderRows.length; i++) {
      await connection.query(
        `INSERT INTO sales_order_details (order_id, product_id, warehouse_id, quantity, unit_price, discount_percent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderRows[i].id, pid, wid, quantities[i], prices[i], discounts[i]]
      );
    }

    console.log('✅ Created 5 order details\n');

    // Summary
    console.log('📊 Summary:');
    let totalAmount = 0;
    orderRows.forEach((order: any) => {
      totalAmount += order.total_amount;
      console.log(`  ${order.order_code}: ${Number(order.total_amount).toLocaleString('vi-VN')} ₫`);
    });

    console.log(`\n  Total: ${totalAmount.toLocaleString('vi-VN')} ₫`);
    console.log(`\n✅ Done! Reload your page and test "Hôm nay" preset 🚀\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
