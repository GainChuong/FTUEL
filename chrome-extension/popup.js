// ==============================
// Supabase Config
// ==============================
const SUPABASE_URL = 'https://fhbqanmmfgwrltmqrpcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYnFhbm1tZmd3cmx0bXFycGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTI5MTksImV4cCI6MjA5MzI4ODkxOX0.o0xXBrlfLOY1N-V7ya_MGnHf8HN9rYfOlxOWh5Qc8p0';

// ==============================
// DOM Elements
// ==============================
const loginForm = document.getElementById('loginForm');
const loggedInState = document.getElementById('loggedInState');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userEmail = document.getElementById('userEmail');
const messageBox = document.getElementById('messageBox');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const uploadBtn = document.getElementById('uploadBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const statusText = document.getElementById('statusText');
const countText = document.getElementById('countText');

// ==============================
// Auth State
// ==============================
let currentSession = null;

async function initAuth() {
    const result = await chrome.storage.local.get(['supabase_session']);
    if (result.supabase_session) {
        const session = result.supabase_session;
        // Check if token is expired
        const expiresAt = session.expires_at * 1000; // to ms
        if (Date.now() < expiresAt - 60000) {
            // Token still valid (with 1 min buffer)
            currentSession = session;
            showLoggedIn(session.user);
        } else if (session.refresh_token) {
            // Try to refresh
            await refreshSession(session.refresh_token);
        } else {
            showLoggedOut();
        }
    } else {
        showLoggedOut();
    }
}

function showLoggedIn(user) {
    loginForm.classList.add('hidden');
    loggedInState.classList.remove('hidden');
    userEmail.textContent = user.email;
    userAvatar.textContent = user.email.charAt(0).toUpperCase();
    uploadBtn.disabled = false;
}

function showLoggedOut() {
    loginForm.classList.remove('hidden');
    loggedInState.classList.add('hidden');
    currentSession = null;
    uploadBtn.disabled = true;
    chrome.storage.local.remove(['supabase_session']);
}

function showMessage(text, type = 'error') {
    messageBox.textContent = text;
    messageBox.className = 'message ' + type;
    setTimeout(() => {
        messageBox.className = 'message';
    }, 5000);
}

// ==============================
// Supabase Auth via REST API
// ==============================
async function login(email, password) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error_description || data.msg || 'Đăng nhập thất bại');
    }

    return data;
}

async function refreshSession(refreshToken) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error('Refresh failed');

        currentSession = data;
        await chrome.storage.local.set({ supabase_session: data });
        showLoggedIn(data.user);
    } catch (e) {
        showLoggedOut();
    }
}

// ==============================
// Upload to Supabase
// ==============================
async function uploadToSupabase() {
    if (!currentSession) {
        showMessage('Vui lòng đăng nhập trước!', 'error');
        return;
    }

    // Check if token needs refresh
    const expiresAt = currentSession.expires_at * 1000;
    if (Date.now() >= expiresAt - 60000 && currentSession.refresh_token) {
        await refreshSession(currentSession.refresh_token);
        if (!currentSession) {
            showMessage('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', 'error');
            return;
        }
    }

    const result = await chrome.storage.local.get(['products']);
    const products = result.products || [];

    if (products.length === 0) {
        showMessage('Chưa có dữ liệu để đẩy lên!', 'error');
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span> Đang đẩy...';
    statusText.textContent = 'Đang upload lên Supabase...';
    statusText.classList.add('active');

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentSession.access_token}`,
            },
            body: JSON.stringify({ products }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload thất bại');
        }

        if (data.inserted === 0 && data.total > 0) {
            showMessage(`Lỗi: Không có sản phẩm nào được lưu. ${data.errors ? data.errors.join(', ') : ''}`, 'error');
        } else {
            showMessage(`Đã đẩy ${data.inserted}/${data.total} sản phẩm lên Supabase!`, data.inserted === data.total ? 'success' : 'error');
        }
        statusText.textContent = `Kết quả: ${data.inserted}/${data.total} SP`;
    } catch (err) {
        showMessage('Lỗi: ' + err.message, 'error');
        statusText.textContent = 'Upload thất bại!';
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '⬆ Đẩy lên Supabase';
        statusText.classList.remove('active');
    }
}

// ==============================
// Event Listeners
// ==============================

// Login
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('Vui lòng nhập email và mật khẩu.', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Đang đăng nhập...';

    try {
        const session = await login(email, password);
        currentSession = session;
        await chrome.storage.local.set({ supabase_session: session });
        showLoggedIn(session.user);
        showMessage('Đăng nhập thành công!', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Đăng nhập';
    }
});

// Allow Enter key to submit login
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// Logout
logoutBtn.addEventListener('click', () => {
    showLoggedOut();
    showMessage('Đã đăng xuất.', 'success');
});

// Crawl controls
startBtn.addEventListener('click', () => {
    statusText.textContent = 'Đang tự cuộn & crawl...';
    statusText.classList.add('active');
    sendMessageToContent({ action: 'start_scroll' });
});

stopBtn.addEventListener('click', () => {
    statusText.textContent = 'Đã dừng';
    statusText.classList.remove('active');
    sendMessageToContent({ action: 'stop_scroll' });
});

// Upload to Supabase
uploadBtn.addEventListener('click', uploadToSupabase);

// Download CSV (fallback)
downloadBtn.addEventListener('click', () => {
    sendMessageToContent({ action: 'download_csv' });
});

// Clear data
clearBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đã thu thập?')) {
        sendMessageToContent({ action: 'clear_data' });
        countText.textContent = '0 SP';
        statusText.textContent = 'Đã xóa dữ liệu';
    }
});

// ==============================
// Helpers
// ==============================
function sendMessageToContent(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Error sending message:', chrome.runtime.lastError.message);
                }
            });
        }
    });
}

function updateUI() {
    chrome.storage.local.get(['products', 'isScrolling'], (result) => {
        const count = result.products ? result.products.length : 0;
        countText.textContent = count + ' SP';

        if (result.isScrolling) {
            statusText.textContent = 'Đang tự cuộn & crawl...';
            statusText.classList.add('active');
            startBtn.disabled = true;
            startBtn.style.opacity = '0.5';
        } else {
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
        }
    });
}

// Periodic UI update
setInterval(updateUI, 1000);
updateUI();

// Init auth on popup open
initAuth();
