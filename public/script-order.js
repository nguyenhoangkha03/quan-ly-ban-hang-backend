// ============================================
// 1. DATA CONFIGURATION
// (Bạn có thể thêm/sửa/xóa sản phẩm và kho ở đây)
// ============================================

const API_URL = 'http://localhost:5000/api/cs/sale-order'; // Đổi port nếu cần

const WAREHOUSES = [
    { id: 3, code: "KHH-001", name: "Kho hàng hóa trung tâm" },
    { id: 4, code: "KTP-001", name: "Kho thành phẩm trung tâm" }, // Thường dùng kho này bán hàng
    { id: 5, code: "KBB-001", name: "Kho bao bì trung tâm" },
    { id: 6, code: "KNL-001", name: "Kho nguyên liệu trung tâm" }
];

// Danh sách sản phẩm (Copy từ file products.txt bạn cung cấp)
const PRODUCTS = [
    { id: 29, name: "SIÊU ĐẬU TRÁI 500ml", price: 65000 },
    { id: 30, name: "NAVI AMINO - Chuyên dùng cho Ớt 1L", price: 125000 },
    { id: 31, name: "BÓN LỚN TRÁI 17-17-17 (NPK) 1kg", price: 85000 },
    { id: 32, name: "CANXI-BO ỚT THÁI 500ml", price: 62000 },
    { id: 33, name: "AMINO ATONIC 1L", price: 135000 },
    { id: 34, name: "TRICHODERMA - Nấm đối kháng 500g", price: 95000 },
    { id: 35, name: "DOCTOR MANGO - Bộ 3 chai (Xoài)", price: 320000 },
    { id: 36, name: "CHỐNG RỤNG MẮC CA 500ml", price: 115000 },
    { id: 37, name: "ACID AMIN CHO RAU MÀU 1L", price: 118000 },
    { id: 38, name: "DOCTOR TIÊU 1L", price: 140000 }
];

// ============================================
// 2. INIT & RENDER FUNCTIONS
// ============================================
window.onload = function() {
    renderWarehouses();
    addItemRow(); // Thêm sẵn 1 dòng khi tải trang
};

function renderWarehouses() {
    const select = document.getElementById('warehouseSelect');
    select.innerHTML = ''; // Clear cũ
    WAREHOUSES.forEach(wh => {
        const option = document.createElement('option');
        option.value = wh.id;
        option.text = `${wh.name} (${wh.code})`;
        if(wh.id === 4) option.selected = true; // Mặc định chọn kho hàng hóa
        select.appendChild(option);
    });
}

function renderProductOptions() {
    let optionsHtml = '';
    PRODUCTS.forEach(p => {
        optionsHtml += `<option value="${p.id}">${p.name} - ${p.price.toLocaleString()}đ</option>`;
    });
    return optionsHtml;
}

// ============================================
// 3. UI LOGIC (Xử lý giao diện)
// ============================================

// Ẩn/Hiện chọn ngân hàng nếu thanh toán tiền mặt
function togglePaymentDetail() {
    const method = document.getElementById('paymentMethod').value;
    const detailDiv = document.getElementById('paymentMethodDetail');
    if (method === 'cash') {
        detailDiv.disabled = true;
        document.getElementById('paymentDetailGroup').style.opacity = '0.5';
    } else {
        detailDiv.disabled = false;
        document.getElementById('paymentDetailGroup').style.opacity = '1';
    }
}

// Thêm dòng sản phẩm mới vào bảng
function addItemRow() {
    const tbody = document.querySelector('#itemsTable tbody');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td>
            <select class="product-select">
                ${renderProductOptions()}
            </select>
        </td>
        <td>
            <input type="number" class="qty-input" value="1" min="1">
        </td>
        <td>
            <input type="text" class="note-input" placeholder="Ghi chú...">
        </td>
        <td>
            <button type="button" class="btn btn-remove" onclick="this.closest('tr').remove()">Xóa</button>
        </td>
    `;
    tbody.appendChild(tr);
}

// ============================================
// 4. API SUBMIT FUNCTION
// ============================================
async function submitOrder() {
    // Lấy Token
    const token = document.getElementById('accessToken').value.trim();
    if (!token) {
        alert("⚠️ Vui lòng nhập Access Token!");
        return;
    }

    // 1. Thu thập dữ liệu Items từ bảng
    const rows = document.querySelectorAll('#itemsTable tbody tr');
    if (rows.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất 1 sản phẩm.");
        return;
    }

    const items = [];
    rows.forEach(row => {
        const productId = parseInt(row.querySelector('.product-select').value);
        const quantity = parseInt(row.querySelector('.qty-input').value);
        const notes = row.querySelector('.note-input').value;
        
        items.push({
            productId,
            quantity,
            notes: notes || undefined
        });
    });

    // 2. Chuẩn bị Payload gửi đi
    const paymentMethod = document.getElementById('paymentMethod').value;
    
    const payload = {
        warehouseId: parseInt(document.getElementById('warehouseSelect').value),
        paymentMethod: paymentMethod,
        items: items,
        deliveryAddress: document.getElementById('deliveryAddress').value
    };

    // Nếu là chuyển khoản thì mới thêm detail (để Backend sinh QR)
    if (paymentMethod === 'transfer') {
        payload.paymentMethodDetail = document.getElementById('paymentMethodDetail').value;
    }

    // 3. Gọi API
    const responseArea = document.getElementById('responseArea');
    const resMessage = document.getElementById('resMessage');
    const jsonOutput = document.getElementById('jsonOutput');
    const qrDisplay = document.getElementById('qrDisplay');
    
    // Reset giao diện kết quả
    responseArea.style.display = 'block';
    resMessage.innerHTML = '⏳ Đang xử lý...';
    qrDisplay.style.display = 'none';
    jsonOutput.textContent = '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // Hiển thị JSON thô để debug
        jsonOutput.textContent = JSON.stringify(data, null, 2);

        if (response.ok && data.success) {
            // == THÀNH CÔNG ==
            resMessage.innerHTML = `<div class="success-box">✅ Tạo đơn hàng thành công! Mã đơn: <b>${data.data.order.orderCode}</b></div>`;
            
            // Hiển thị QR Code nếu backend trả về
            if (data.data.paymentInfo && data.data.paymentInfo.qrCode) {
                qrDisplay.style.display = 'block';
                document.getElementById('qrImage').src = data.data.paymentInfo.qrCode;
                document.getElementById('qrContent').textContent = data.data.paymentInfo.content;
                document.getElementById('qrAmount').textContent = parseInt(data.data.paymentInfo.amount).toLocaleString('vi-VN') + ' đ';
            }
        } else {
            // == CÓ LỖI TỪ SERVER ==
            let errorMsg = data.message || 'Có lỗi xảy ra';
            
            // Nếu có chi tiết lỗi (ví dụ Validation Error từ Zod)
            if (data.error && data.error.details) {
                // Format lỗi đẹp hơn một chút
                if(Array.isArray(data.error.details)) {
                     const detailList = data.error.details.map(d => `<li>${d.message} (Field: ${d.field})</li>`).join('');
                     errorMsg += `<ul>${detailList}</ul>`;
                } else {
                    errorMsg += '<br>Chi tiết: ' + JSON.stringify(data.error.details);
                }
            }
            resMessage.innerHTML = `<div class="error-box">❌ Lỗi: ${errorMsg}</div>`;
        }

    } catch (err) {
        console.error(err);
        resMessage.innerHTML = `<div class="error-box">❌ Lỗi kết nối: ${err.message}. <br>Hãy kiểm tra: Server đã bật chưa? Port 5000 có đúng không?</div>`;
    }
}

// ============================================
// 5. CANCEL ORDER FUNCTION (Mới thêm)
// ============================================
async function cancelOrder() {
    const token = document.getElementById('accessToken').value.trim();
    const orderId = document.getElementById('cancelOrderId').value.trim();
    const reason = document.getElementById('cancelReason').value.trim();

    if (!token) return alert("⚠️ Thiếu Access Token!");
    if (!orderId) return alert("⚠️ Vui lòng nhập ID đơn hàng cần hủy!");
    if (!reason) return alert("⚠️ Vui lòng nhập lý do hủy!");

    // Reset giao diện kết quả
    const responseArea = document.getElementById('responseArea');
    const resMessage = document.getElementById('resMessage');
    const jsonOutput = document.getElementById('jsonOutput');
    
    responseArea.style.display = 'block';
    resMessage.innerHTML = '⏳ Đang xử lý hủy đơn...';
    jsonOutput.textContent = '';

    try {
        // Gọi API PUT
        // URL: /api/cs/sale-order/{id}/cancel
        const url = `http://localhost:5000/api/cs/sale-order/${orderId}/cancel`;

        const response = await fetch(url, {
            method: 'PUT', // Lưu ý: Method là PUT
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason: reason }) // Gửi lý do lên
        });

        const data = await response.json();
        
        jsonOutput.textContent = JSON.stringify(data, null, 2);

        if (response.ok && data.success) {
            resMessage.innerHTML = `<div class="success-box">✅ Đã hủy thành công đơn hàng #${orderId}!</div>`;
        } else {
            let errorMsg = data.message || 'Lỗi khi hủy đơn';
            resMessage.innerHTML = `<div class="error-box">❌ Không thể hủy: ${errorMsg}</div>`;
        }

    } catch (err) {
        console.error(err);
        resMessage.innerHTML = `<div class="error-box">❌ Lỗi kết nối: ${err.message}</div>`;
    }
}