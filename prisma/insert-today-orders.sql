-- Insert 5 sales orders for today (2026-01-04)
-- Run this in your MySQL database directly

-- First, get IDs from existing data
-- SELECT id FROM customers LIMIT 1;
-- SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE role_key = 'sales_staff') LIMIT 1;
-- SELECT id FROM products WHERE status = 'active' LIMIT 1;

-- Assuming customer_id=1, user_id=8, product_id=1, warehouse_id=1

INSERT INTO sales_orders (
  order_code, customer_id, warehouse_id, order_date, completed_at,
  sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
  paid_amount, payment_method, payment_status, order_status, delivery_address,
  notes, created_by, created_at, updated_at
) VALUES

-- Order 1: Completed - Retail
('DH-2026-00041', 1, 1, '2026-01-04', '2026-01-04 14:00:00',
 'retail', 5000000, 500000, 400000, 50000,
 3000000, 'credit', 'partial', 'completed', '123 Đường Lê Lợi, TP HCM',
 'Đơn hàng bán lẻ hôm nay', 8, NOW(), NOW()),

-- Order 2: Completed - Wholesale
('DH-2026-00042', 1, 1, '2026-01-04', '2026-01-04 14:00:00',
 'wholesale', 8000000, 800000, 640000, 100000,
 8000000, 'transfer', 'paid', 'completed', '456 Đường Nguyễn Huệ, TP HCM',
 'Đơn hàng bán sỉ hôm nay', 8, NOW(), NOW()),

-- Order 3: Completed - Online
('DH-2026-00043', 1, 1, '2026-01-04', '2026-01-04 14:00:00',
 'online', 3500000, 0, 280000, 30000,
 3500000, 'cash', 'paid', 'completed', '789 Đường Võ Văn Kiệt, TP HCM',
 'Đơn hàng bán online hôm nay', 8, NOW(), NOW()),

-- Order 4: Preparing - Distributor
('DH-2026-00044', 1, 1, '2026-01-04', NULL,
 'distributor', 6000000, 600000, 480000, 80000,
 0, 'credit', 'unpaid', 'preparing', '321 Đường Tạ Quang Bửu, TP HCM',
 'Đơn hàng bán đại lý hôm nay', 8, NOW(), NOW()),

-- Order 5: Preparing - Retail
('DH-2026-00045', 1, 1, '2026-01-04', NULL,
 'retail', 2500000, 250000, 200000, 30000,
 1500000, 'installment', 'partial', 'preparing', '654 Đường Lê Văn Sỹ, TP HCM',
 'Đơn hàng bán lẻ hôm nay', 8, NOW(), NOW());

-- Insert order details (assuming product_id=1)
-- Get the IDs of the orders just inserted
SET @order1 = (SELECT id FROM sales_orders WHERE order_code = 'DH-2026-00041');
SET @order2 = (SELECT id FROM sales_orders WHERE order_code = 'DH-2026-00042');
SET @order3 = (SELECT id FROM sales_orders WHERE order_code = 'DH-2026-00043');
SET @order4 = (SELECT id FROM sales_orders WHERE order_code = 'DH-2026-00044');
SET @order5 = (SELECT id FROM sales_orders WHERE order_code = 'DH-2026-00045');

INSERT INTO sales_order_details (
  order_id, product_id, warehouse_id, quantity, unit_price, discount_percent
) VALUES
(@order1, 1, 1, 100, 50000, 10),
(@order2, 1, 1, 150, 53000, 10),
(@order3, 1, 1, 70, 50000, 0),
(@order4, 1, 1, 120, 50000, 10),
(@order5, 1, 1, 50, 50000, 10);

-- Verify inserted data
SELECT '=== TODAY ORDERS (2026-01-04) ===' as status;
SELECT 
  order_code, 
  sales_channel, 
  order_status,
  total_amount,
  payment_status,
  created_at
FROM sales_orders 
WHERE DATE(order_date) = '2026-01-04'
ORDER BY order_code;

SELECT '=== SUMMARY ===' as status;
SELECT 
  COUNT(*) as total_orders,
  SUM(total_amount) as total_revenue,
  SUM(paid_amount) as total_paid
FROM sales_orders 
WHERE DATE(order_date) = '2026-01-04';
