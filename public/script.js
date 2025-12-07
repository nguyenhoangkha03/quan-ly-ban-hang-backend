// ================= CẤU HÌNH =================
const SUPABASE_URL = 'https://vnvodtioquonmqghwusy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudm9kdGlvcXVvbm1xZ2h3dXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjY0MzAsImV4cCI6MjA4MDI0MjQzMH0.OxJ002jHMI-kKSKIYiL4aJMypn_m9ubzJF6KoHcvUZs';

const API_URL = 'http://localhost:5000/api';

if (!SUPABASE_KEY || SUPABASE_KEY.includes('DÁN_KEY')) console.warn('Thiếu Supabase Key');

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentFlow = ''; // 'register' hoặc 'forgot'
let currentPhone = '';
let currentUid = ''; // <== QUAN TRỌNG: Lưu UID sau khi xác thực OTP thành công

// ================= 1. ĐIỀU HƯỚNG MÀN HÌNH =================
function showScreen(screenId) {
    // Ẩn tất cả
    ['login-section', 'register-section', 'forgot-section', 'setpass-section', 'profile-section'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Reset các form con (Chỉ áp dụng cho Register/OTP flow)
    if (screenId !== 'setpass') {
        document.getElementById('reg-step-1').classList.remove('hidden');
        document.getElementById('otp-step').classList.add('hidden');
    }

    // Hiện màn hình mong muốn
    if (screenId === 'login') document.getElementById('login-section').classList.remove('hidden');
    if (screenId === 'register') document.getElementById('register-section').classList.remove('hidden');
    if (screenId === 'forgot') document.getElementById('forgot-section').classList.remove('hidden');
    if (screenId === 'setpass') document.getElementById('setpass-section').classList.remove('hidden');
    if (screenId === 'profile') document.getElementById('profile-section').classList.remove('hidden');
}

// ================= 2. XỬ LÝ LOGIC CHUNG =================

// Hàm chuẩn hóa số điện thoại (+84/0 -> 84...)
function formatPhone(phone) {
    phone = phone.trim();
    if (phone.startsWith('0')) return '84' + phone.substring(1);
    if (phone.startsWith('+84')) return phone.substring(1);
    return phone;
}

// Gọi API kiểm tra SĐT
async function checkPhoneExist(phone) {
    const res = await fetch(`${API_URL}/accounts/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatPhone(phone) })
    });
    return await res.json();
}

// Gửi OTP qua Supabase
async function sendSupabaseOtp(phone) {
    // Supabase cần định dạng +84
    let phonePlus = '+' + formatPhone(phone);
    // Supabase có thể yêu cầu 'channel: sms' hoặc 'channel: whatsapp'
    const { error } = await supabase.auth.signInWithOtp({ phone: phonePlus });
    if (error) throw error;
}

function handleLoginSuccess(responseData) {
    // 1. Lưu Token vào LocalStorage
    if (responseData.tokens) {
        localStorage.setItem('accessToken', responseData.tokens.accessToken);
        localStorage.setItem('refreshToken', responseData.tokens.refreshToken);
    }
    
    // 2. Lấy thông tin khách hàng (Backend giờ trả về 'customer' thay vì 'account')
    const customer = responseData.customer;

    // 3. Logic điều hướng
    if (responseData.requirePasswordSet) {
        // Đã có UID (currentUid), chỉ cần chuyển sang setpass
        showScreen('setpass');
        showToast('Tài khoản mới được tạo. Vui lòng thiết lập mật khẩu!', 'info');
    }
    // Trường hợp bình thường -> Vào Profile
    else {
        renderProfile(customer);
        showToast('Đăng nhập thành công!', 'success');
    }
}

// ================= 3. LOGIC ĐĂNG NHẬP (PASSWORD) =================
async function handleLoginPassword() {
    // ... (Giữ nguyên logic này)
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-pass').value;

    try {
        const res = await fetch(`${API_URL}/accounts/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formatPhone(phone), password })
        });
        const json = await res.json();

        if (json.success) {
            // Backend giờ trả về { customer, tokens }
            handleLoginSuccess(json.data); 
        } else {
            showToast(json.message || 'Đăng nhập thất bại', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Lỗi hệ thống', 'error');
    }
}

// ================= 4. LOGIC ĐĂNG KÝ (BƯỚC 1: CHECK) =================
async function handleRegisterCheck() {
    const phoneInput = document.getElementById('reg-phone').value;
    if (!phoneInput) return showToast('Nhập số điện thoại', 'error');

    currentPhone = phoneInput;

    // B1: Check xem tồn tại chưa
    const check = await checkPhoneExist(phoneInput);

    if (check.data.exists) {
        // Nếu tồn tại -> Hiện thông báo lựa chọn
        document.getElementById('modal-phone-display').innerText = phoneInput;
        // Kiểm tra xem có mật khẩu chưa để gợi ý chính xác
        const modalBody = document.querySelector('#existModal .modal-body');
        const hasPass = check.data.canLoginWithPassword;
        modalBody.innerHTML = `Số <b><span id="modal-phone-display-inner">${phoneInput}</span></b> đã được đăng ký. ${hasPass ? 'Bạn có thể đăng nhập bằng mật khẩu.' : 'Tài khoản này chưa có mật khẩu, bạn cần đặt lại.'} Bạn muốn làm gì?`;

        const modal = new bootstrap.Modal(document.getElementById('existModal'));
        modal.show();
    } else {
        // Nếu chưa tồn tại -> Gửi OTP để đăng ký
        currentFlow = 'register';
        startOtpProcess();
    }
}

// ================= 5. LOGIC QUÊN MẬT KHẨU (BƯỚC 1: CHECK) =================
async function handleForgotCheck() {
    const phoneInput = document.getElementById('forgot-phone').value;
    if (!phoneInput) return showToast('Nhập số điện thoại', 'error');

    currentPhone = phoneInput;

    // B1: Check xem tồn tại chưa
    const check = await checkPhoneExist(phoneInput);

    if (!check.data.exists) {
        // [Logic bạn yêu cầu]: Nếu chưa tồn tại -> Hỏi có cần đăng ký không
        // Tái sử dụng Modal để hỏi người dùng
        document.getElementById('modal-phone-display').innerText = phoneInput;
        const modalBody = document.querySelector('#existModal .modal-body');
        modalBody.innerHTML = `Số <b><span id="modal-phone-display-inner">${phoneInput}</span></b> chưa đăng ký tài khoản. Bạn có muốn chuyển sang Đăng ký không?`;
        
        // Sửa nút modal để chuyển sang đăng ký
        document.querySelector('#existModal .modal-footer').innerHTML = `
            <button type="button" class="btn btn-success" onclick="goToRegisterFromModal()">Đăng ký ngay</button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy bỏ</button>
        `;

        const modal = new bootstrap.Modal(document.getElementById('existModal'));
        modal.show();
        
    } else {
        // Nếu tồn tại -> Gửi OTP để reset
        currentFlow = 'forgot';
        startOtpProcess();
    }
}

// ================= 6. XỬ LÝ OTP & VERIFY (BƯỚC 2) =================
async function startOtpProcess() {
    // ... (Giữ nguyên logic này)
    try {
        await sendSupabaseOtp(currentPhone);

        // Chuyển UI sang nhập OTP
        // Tái sử dụng màn hình Register/OTP cho cả hai luồng
        document.getElementById('forgot-section').classList.add('hidden');
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('register-section').classList.remove('hidden');
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('otp-step').classList.remove('hidden');
        document.getElementById('display-phone').innerText = currentPhone;

        showToast('Mã OTP đã được gửi!', 'success');
    } catch (err) {
        showToast('Lỗi gửi OTP: ' + err.message, 'error');
    }
}

async function handleVerifyOtp() {
    const token = document.getElementById('otp-input').value;
    const phonePlus = '+' + formatPhone(currentPhone);

    const { data, error } = await supabase.auth.verifyOtp({
        phone: phonePlus, token: token, type: 'sms'
    });

    if (error) return showToast('Mã OTP không đúng', 'error');

    // **BƯỚC QUAN TRỌNG:** Lưu UID và gọi Backend API Sync
    currentUid = data.user.id; 

    try {
        // SỬA: Dùng API /sync-phone-account đã đổi tên
        const res = await fetch(`${API_URL}/accounts/sync-phone-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Truyền cả UID và SĐT (đã chuẩn hóa 84...)
            body: JSON.stringify({ uid: currentUid, phone: formatPhone(currentPhone) }) 
        });
        const json = await res.json();

        if (json.success) {
            // Nếu Backend báo cần đặt mật khẩu -> handleLoginSuccess sẽ tự chuyển sang Setpass
            // Nếu không cần đặt mật khẩu (vd: login lại sau reset) -> sẽ vào profile
            handleLoginSuccess(json.data);
            
            // Xóa form OTP
            document.getElementById('otp-input').value = ''; 

        } else {
            showToast(json.message || 'Lỗi đồng bộ tài khoản', 'error');
        }
    } catch (err) {
        showToast('Lỗi server khi đồng bộ', 'error');
    }
}

// ================= 7. ĐẶT MẬT KHẨU CUỐI CÙNG (BƯỚC 3) =================
async function handleSetPassword() {
    const pass = document.getElementById('new-pass').value;
    const confirm = document.getElementById('confirm-pass').value;
    
    // **QUAN TRỌNG:** API set-password đã chuyển sang PUBLIC và dùng UID + PHONE
    if (!currentUid || !currentPhone) return showToast('Lỗi luồng: Chưa xác thực SĐT/UID', 'error');
    if (pass !== confirm) return showToast('Mật khẩu không khớp', 'error');
    if (pass.length < 6) return showToast('Mật khẩu phải từ 6 ký tự', 'error');

    try {
        // SỬA: BỎ Authorization header và dùng API /set-password mới
        const res = await fetch(`${API_URL}/accounts/set-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // BỎ: 'Authorization': `Bearer ${token}` 
            },
            // Truyền SĐT, UID và mật khẩu mới
            body: JSON.stringify({ 
                phone: formatPhone(currentPhone), 
                uid: currentUid, 
                password: pass 
            }) 
        });
        const json = await res.json();

        if (json.success) {
            showToast('Đặt mật khẩu thành công! Đang đăng nhập...', 'success');
            
            // Backend Service mới trả về tokens sau khi set password thành công
            if(json.data && json.data.tokens) {
                 localStorage.setItem('accessToken', json.data.tokens.accessToken);
                 localStorage.setItem('refreshToken', json.data.tokens.refreshToken);
            }
            
            // Redirect để load profile
            window.location.reload(); 
        } else {
             showToast(json.message || 'Đặt mật khẩu thất bại', 'error');
        }

    } catch(err) {
        showToast('Lỗi hệ thống khi đặt mật khẩu', 'error');
    }
}

// ================= 8. LOGIC ĐĂNG NHẬP SOCIAL =================
async function loginSocial(provider) {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider, // 'google' hoặc 'facebook'
            options: {
                // QUAN TRỌNG: Supabase sẽ chuyển hướng người dùng trở lại URL này sau khi xác thực.
                // Đảm bảo URL này là URL bạn đang chạy local (hoặc đã cấu hình trong Supabase Dashboard)
                redirectTo: window.location.origin, 
            },
        });

        if (error) {
            console.error('Lỗi khi bắt đầu đăng nhập Social:', error);
            showToast('Lỗi khi bắt đầu đăng nhập Social: ' + error.message, 'error');
            return;
        }

        // Nếu thành công, Supabase sẽ tự động chuyển hướng (hoặc mở pop-up)
        // Lưu ý: Nếu bạn sử dụng trình duyệt cũ hoặc trình duyệt chặn pop-up, 
        // bạn có thể gặp vấn đề nếu không có chuyển hướng.
        
    } catch (err) {
        console.error(err);
        showToast('Lỗi hệ thống khi gọi Social Login', 'error');
    }
}

// ================= 9. XỬ LÝ CALLBACK SAU KHI ĐĂNG NHẬP SOCIAL =================

// Hàm này chạy ngay khi trang tải lại, xử lý thông tin Supabase trả về
async function handleSupabaseSession() {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error("Lỗi lấy session Supabase:", error);
        return;
    }

    const session = data?.session;
    
    if (session && session.provider_token) {
        // Nếu có session từ Supabase (sau khi Social Login thành công)
        const user = session.user;
        
        // Gọi Backend API để đồng bộ tài khoản và lấy JWT của riêng bạn
        await syncSocialAccount(user);

        // Sau khi đồng bộ, xóa bớt token Supabase để tránh lỗi liên tục
        await supabase.auth.signOut(); 
    }
}

async function syncSocialAccount(user) {
    const provider = user.app_metadata.provider; // google hoặc facebook
    
    try {
        const res = await fetch(`${API_URL}/accounts/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.id,
                email: user.email,
                name: user.user_metadata.full_name || user.user_metadata.name,
                avatar: user.user_metadata.avatar_url,
                provider: provider.toUpperCase(), // GOOGLE hoặc FACEBOOK
            })
        });
        const json = await res.json();

        if (json.success) {
            handleLoginSuccess(json.data);
        } else {
            showToast(json.message || 'Đồng bộ tài khoản Social thất bại', 'error');
        }
    } catch (err) {
        showToast('Lỗi server khi đồng bộ tài khoản Social', 'error');
    }
}

// ================= UTILS & MODAL LOGIC =================

// Hàm chung để chuyển màn hình từ Modal Đã tồn tại
function goToLoginFromModal() {
    bootstrap.Modal.getInstance(document.getElementById('existModal')).hide();
    document.getElementById('login-phone').value = currentPhone;
    showScreen('login');
}

function goToForgotFromModal() {
    bootstrap.Modal.getInstance(document.getElementById('existModal')).hide();
    document.getElementById('forgot-phone').value = currentPhone;
    showScreen('forgot');
}

// Hàm mới: Chuyển sang đăng ký từ Modal (khi sdt chưa tồn tại trong luồng Forgot)
function goToRegisterFromModal() {
    bootstrap.Modal.getInstance(document.getElementById('existModal')).hide();
    document.getElementById('reg-phone').value = currentPhone;
    showScreen('register');
}

function showToast(msg, type) {
    Toastify({ text: msg, style: { background: type === 'error' ? 'red' : 'green' } }).showToast();
}

function renderProfile(customer) {
    if (!customer) return;

    // ... (Giữ nguyên logic render profile)
    const displayName = customer.customerName || customer.phone || 'Khách hàng';
    const avatar = customer.avatarUrl || 'https://via.placeholder.com/150';

    document.getElementById('p-name').innerText = displayName;
    document.getElementById('p-phone').innerText = customer.phone || '';
    document.getElementById('p-avatar').src = avatar;

    showScreen('profile');
}

// Check session khi load trang
window.onload = async () => {
    // Gọi hàm xử lý session Supabase đầu tiên
    await handleSupabaseSession(); 
    
    if (localStorage.getItem('accessToken')) {
        // Tạm thời hiển thị profile fake hoặc gọi API getProfile
        showScreen('profile');
    } else {
        showScreen('login');
    }
}

async function logout() {
    localStorage.clear();
    // Vẫn gọi supabase.auth.signOut() để xóa session trên Supabase (nếu có)
    await supabase.auth.signOut(); 
    window.location.reload();
}