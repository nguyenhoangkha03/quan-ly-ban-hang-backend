// --- Dữ liệu Mẫu (Dựa trên Product Model của bạn) ---
// Giả định các Product ID này tồn tại trong database
const MOCK_PRODUCTS = [
    { id: 101, sku: 'SP-001', productName: 'Gạo Trắng Thơm (5kg)', unitPrice: 120000, maxQuantity: 10 },
    { id: 102, sku: 'SP-002', productName: 'Nước Tẩy Rửa Đa Năng', unitPrice: 75000, maxQuantity: 5 },
    { id: 103, sku: 'SP-003', productName: 'Bàn Chải Điện Sonic', unitPrice: 850000, maxQuantity: 3 },
];

// Giả định Token đã được lấy sau khi đăng nhập (THAY THẾ BẰNG TOKEN CỦA BẠN)
const AUTH_TOKEN = 'Bearer YOUR_ACTUAL_CUSTOMER_JWT_TOKEN'; 

let CURRENT_ORDER_ID = null;
let CURRENT_ORDER_CODE = null; 

// --- DOM Elements ---
const form = document.getElementById('order-form');
const itemsContainer = document.getElementById('items-container');
const responseContainer = document.getElementById('response-container');
const orderData = document.getElementById('order-data');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');
const totalValueSpan = document.getElementById('total-value');
const btnInitiatePayment = document.getElementById('btn-initiate-payment');
const paymentModal = document.getElementById('payment-modal');
const btnConfirmPayment = document.getElementById('btn-confirm-payment');
const paymentMethodDetail = document.getElementById('paymentMethodDetail');
const paymentQrInfo = document.getElementById('payment-qr-info');


// --- Functions ---

function renderProductItems() {
    itemsContainer.innerHTML = MOCK_PRODUCTS.map(p => `
        <div class="item-row">
            <div class="item-name">
                ${p.productName} (SKU: ${p.sku})
                <span class="text-gray-500 text-xs">| Giá: ${p.unitPrice.toLocaleString()} VND</span>
            </div>
            <input 
                type="number" 
                min="0" 
                max="${p.maxQuantity}" 
                value="0" 
                data-product-id="${p.id}"
                data-unit-price="${p.unitPrice}"
                class="item-input border border-gray-300 rounded-md p-2 text-right quantity-input"
            >
        </div>
    `).join('');
}

function calculateTotal() {
    let total = 0;
    const inputs = document.querySelectorAll('.quantity-input');
    inputs.forEach(input => {
        const quantity = parseInt(input.value) || 0;
        const unitPrice = parseFloat(input.dataset.unitPrice);
        total += quantity * unitPrice;
    });

    const shippingFee = parseFloat(document.getElementById('shippingFee').value) || 0;
    const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
    
    const finalTotal = total + shippingFee - discountAmount;
    totalValueSpan.textContent = finalTotal.toLocaleString() + ' VND';
    return finalTotal;
}

async function handleSubmit(e) {
    e.preventDefault();
    hideMessages();

    if (AUTH_TOKEN === 'Bearer YOUR_ACTUAL_CUSTOMER_JWT_TOKEN') {
        showError('Lỗi Token', 'Vui lòng thay thế YOUR_ACTUAL_CUSTOMER_JWT_TOKEN bằng token thực tế trong script.js.');
        return;
    }

    const items = [];
    document.querySelectorAll('.quantity-input').forEach(input => {
        const quantity = parseInt(input.value) || 0;
        if (quantity > 0) {
            items.push({
                productId: parseInt(input.dataset.productId),
                quantity: quantity,
                unitPrice: parseFloat(input.dataset.unitPrice),
                // Các trường tùy chọn khác như discountPercent, taxRate có thể thêm vào đây
            });
        }
    });

    if (items.length === 0) {
        showError('Lỗi Input', 'Vui lòng chọn ít nhất một sản phẩm.');
        return;
    }

    const totalValue = calculateTotal();
    const paidAmountValue = parseFloat(document.getElementById('paidAmount').value) || 0;

    // Data gửi lên API
    const orderPayload = {
        paymentMethod: document.getElementById('paymentMethod').value,
        paidAmount: paidAmountValue,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        shippingFee: parseFloat(document.getElementById('shippingFee').value) || 0,
        discountAmount: parseFloat(document.getElementById('discountAmount').value) || 0,
        notes: document.getElementById('notes').value,
        items: items,
        // warehouseId có thể thêm vào nếu cần
    };

    try {
        const response = await fetch('/api/v1/customer/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AUTH_TOKEN 
            },
            body: JSON.stringify(orderPayload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to create order.');
        }

        CURRENT_ORDER_ID = result.data.id;
        CURRENT_ORDER_CODE = result.data.orderCode;
        
        showSuccess(result.data, result.warnings);

    } catch (error) {
        showError('API Lỗi', error.message);
        console.error('Order Submission Error:', error);
    }
}

async function handleInitiatePayment() {
    hideMessages();
    if (!CURRENT_ORDER_ID || document.getElementById('paymentMethod').value !== 'transfer') {
        showError('Lỗi', 'Chức năng chỉ áp dụng cho đơn hàng mới tạo và có phương thức là "Chuyển khoản".');
        return;
    }

    const methodDetail = paymentMethodDetail.value;

    try {
        const response = await fetch(`/api/v1/customer/orders/${CURRENT_ORDER_ID}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AUTH_TOKEN
            },
            // Gửi paymentMethodDetail (amount là optional, service tự tính)
            body: JSON.stringify({ paymentMethodDetail: methodDetail }) 
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to initiate payment.');
        }

        // Hiển thị thông tin thanh toán trong modal
        paymentQrInfo.innerHTML = `
            <p><strong>Ref:</strong> ${result.data.paymentReference}</p>
            <p><strong>Amount:</strong> ${result.data.amount.toLocaleString()} VND</p>
            <p class="text-sm text-gray-600">(${methodDetail})</p>
            ${result.data.qrCode ? 
                `<p class="text-center mt-3 text-sm text-red-500">QR Code Mockup: ${result.data.qrCode.substring(0, 30)}...</p>` : ''}
            <div class="bg-yellow-50 p-3 rounded mt-2">
                <p class="font-semibold text-sm">Hướng dẫn:</p>
                <p class="text-xs whitespace-pre-wrap">${result.data.instructions}</p>
            </div>
        `;
        paymentModal.classList.remove('hidden');

    } catch (error) {
        showError('Thanh toán Lỗi', error.message);
        console.error('Payment Initiation Error:', error);
    }
}


function showSuccess(data, warnings) {
    errorContainer.classList.add('hidden');
    responseContainer.classList.remove('hidden');
    orderData.textContent = JSON.stringify(data, null, 2);
    
    // Nếu có cảnh báo tồn kho, hiển thị nó rõ ràng
    if (warnings && warnings.inventoryShortages) {
        document.getElementById('order-data').prepend(
            '⚠️ WARNING: INVENTORY SHORTAGES EXIST:\n' + JSON.stringify(warnings.inventoryShortages, null, 2) + '\n\n'
        );
    }

    if (data.paymentMethod === 'transfer' && data.orderStatus === 'pending') {
        btnInitiatePayment.classList.remove('hidden');
    } else {
        btnInitiatePayment.classList.add('hidden');
    }
}

function showError(title, message) {
    responseContainer.classList.add('hidden');
    errorContainer.classList.remove('hidden');
    errorMessage.textContent = title + ': ' + message;
    errorDetails.textContent = '';
}

function hideMessages() {
    responseContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    renderProductItems();
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('input', calculateTotal);
    });
    document.getElementById('shippingFee').addEventListener('input', calculateTotal);
    document.getElementById('discountAmount').addEventListener('input', calculateTotal);
    
    // Initial calculation
    calculateTotal();
});

form.addEventListener('submit', handleSubmit);
btnInitiatePayment.addEventListener('click', () => {
    // Tải lại thông tin paymentDetail khi mở modal
    handleInitiatePayment();
});
document.getElementById('btn-close-modal').addEventListener('click', () => {
    paymentModal.classList.add('hidden');
});
btnConfirmPayment.addEventListener('click', () => {
    // Logic thực tế sẽ gọi API xác nhận/tiến hành thanh toán,
    // ở đây ta chỉ đóng modal sau khi khách hàng đã "xác nhận khởi tạo"
    alert('Đã khởi tạo giao dịch. Giả lập rằng khách hàng đã chuyển sang ứng dụng thanh toán.');
    paymentModal.classList.add('hidden');
});