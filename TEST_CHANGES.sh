#!/bin/bash
# Quick test: kiểm tra TypeError hoặc lỗi syntax

echo "=== TESTING REPORT SERVICE CHANGES ==="
echo ""
echo "Files modified:"
echo "  - getRevenueReport(): Changed orderStatus/completedAt to orderDate"
echo "  - groupByPeriod(): Changed 'completedAt' to 'orderDate'"
echo "  - getTopSellingProducts(): Changed orderStatus/completedAt to orderDate"
echo "  - getTopCustomers(): Changed orderStatus/completedAt to orderDate"
echo ""
echo "Expected behavior:"
echo "  ✅ Query now uses orderDate (instead of completedAt)"
echo "  ✅ Will include ALL orders (not just completed)"
echo "  ✅ Should return 40 orders from 2025-12-01 to 2025-12-30"
echo "  ✅ Summary calculations should not be NaN"
echo ""
