document.getElementById('startBtn').addEventListener('click', async () => {
    document.getElementById('statusText').innerText = 'Trạng thái: Đang tự cuộn...';
    sendMessageToContent({ action: 'start_scroll' });
});

document.getElementById('stopBtn').addEventListener('click', async () => {
    document.getElementById('statusText').innerText = 'Trạng thái: Đã dừng cuộn';
    sendMessageToContent({ action: 'stop_scroll' });
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
    sendMessageToContent({ action: 'download_csv' });
});

document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đã thu thập?')) {
        sendMessageToContent({ action: 'clear_data' });
        document.getElementById('countText').innerText = 'Số sản phẩm: 0';
        document.getElementById('statusText').innerText = 'Trạng thái: Đã xóa dữ liệu';
    }
});

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

// Update UI from storage (more reliable than message if page is reloading)
function updateUI() {
    chrome.storage.local.get(['products', 'isScrolling'], (result) => {
        const count = result.products ? result.products.length : 0;
        document.getElementById('countText').innerText = 'Số sản phẩm: ' + count;
        
        if (result.isScrolling) {
            document.getElementById('statusText').innerText = 'Trạng thái: Đang tự cuộn...';
            document.getElementById('startBtn').disabled = true;
            document.getElementById('startBtn').style.opacity = '0.5';
        } else {
            document.getElementById('startBtn').disabled = false;
            document.getElementById('startBtn').style.opacity = '1';
            if (document.getElementById('statusText').innerText === 'Trạng thái: Đang tự cuộn...') {
                document.getElementById('statusText').innerText = 'Trạng thái: Đang chờ...';
            }
        }
    });
}

// Check storage and update UI periodically
setInterval(updateUI, 1000);
updateUI();

