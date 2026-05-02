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

// Update count from storage (more reliable than message if page is reloading)
function updateCount() {
    chrome.storage.local.get(['products'], (result) => {
        const count = result.products ? result.products.length : 0;
        document.getElementById('countText').innerText = 'Số sản phẩm: ' + count;
    });
}

// Check if content script is active and update UI
setInterval(updateCount, 1000);
updateCount();
