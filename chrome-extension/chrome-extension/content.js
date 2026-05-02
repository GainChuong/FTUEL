// Inject inject.js into the main page context
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

let products = [];
let isScrolling = false;
let scrollInterval = null;
let lastScrollHeight = -1;
let sameScrollCount = 0;

// Load existing products from storage
chrome.storage.local.get(['products'], (result) => {
    if (result.products) {
        products = result.products;
        console.log('Shopee Crawler: Đã tải ' + products.length + ' sản phẩm từ bộ nhớ.');
    }
});

// Listen for intercepted data from inject.js
window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data || event.data.type !== 'SHOPEE_INTERCEPT') {
        return;
    }

    const data = event.data.data;
    let items = data?.items || data?.data?.items || [];
    
    if (Array.isArray(items) && items.length > 0) {
        chrome.storage.local.get(['products'], (result) => {
            let currentProducts = result.products || [];
            let addedCount = 0;

            for (const itemObj of items) {
                const item = itemObj.item_basic || itemObj;
                if (!item.name) continue;

                if (!currentProducts.some(p => p.name === item.name)) {
                    const rating = item.item_rating && item.item_rating.rating_star ? item.item_rating.rating_star.toFixed(2) : '0';
                    const price = item.price ? (item.price / 100000).toString() : '0';
                    const sold = item.historical_sold || 0;
                    const region = item.shop_location || '';
                    const discount = item.discount || item.show_discount || '';

                    currentProducts.push({
                        shopName: document.title.split('|')[0].trim(),
                        name: item.name.replace(/"/g, '""'),
                        rating: rating,
                        price: price,
                        sold: sold,
                        region: region,
                        discount: discount
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                products = currentProducts;
                chrome.storage.local.set({ products: currentProducts }, () => {
                    console.log('Shopee Crawler: Đã thêm ' + addedCount + ' sản phẩm mới. Tổng cộng: ' + products.length);
                });
            }
        });
    }
});

// Listen for commands from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'start_scroll') {
        if (!isScrolling) {
            isScrolling = true;
            lastScrollHeight = -1;
            sameScrollCount = 0;
            console.log('Shopee Crawler: Bắt đầu tự động cuộn...');
            
            scrollInterval = setInterval(() => {
                window.scrollBy({ top: 800, behavior: 'smooth' });
                
                const isNearBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 600);
                
                if (window.scrollY === lastScrollHeight) {
                    sameScrollCount++;
                } else {
                    sameScrollCount = 0;
                    lastScrollHeight = window.scrollY;
                }

                if (sameScrollCount > 2 || isNearBottom) {
                    const nextBtn = document.querySelector('button.shopee-icon-button--right:not(.shopee-icon-button--disabled)') || 
                                    document.querySelector('.shopee-page-controller__next-btn:not(.shopee-button-no-outline--disabled)') ||
                                    document.querySelector('button.shopee-button-outline--primary + button:not(.shopee-button-no-outline--disabled)') ||
                                    document.querySelector('[aria-label="Next Page"]:not([disabled])') ||
                                    document.querySelector('[aria-label="Trang sau"]:not([disabled])');

                    if (nextBtn && !nextBtn.classList.contains('shopee-button-no-outline--disabled') && !nextBtn.disabled) {
                        console.log('Shopee Crawler: Đang sang trang mới...');
                        sameScrollCount = 0;
                        lastScrollHeight = -1;
                        nextBtn.click();
                        
                        setTimeout(() => {
                            window.scrollTo(0, 0);
                        }, 1000);
                    }
                }
            }, 3000);
        }
        sendResponse({ status: 'started' });
    } else if (request.action === 'stop_scroll') {
        isScrolling = false;
        if (scrollInterval) clearInterval(scrollInterval);
        sendResponse({ status: 'stopped' });
    } else if (request.action === 'get_count') {
        sendResponse({ count: products.length });
    } else if (request.action === 'download_csv') {
        downloadCSV();
        sendResponse({ status: 'downloading' });
    } else if (request.action === 'clear_data') {
        products = [];
        chrome.storage.local.set({ products: [] }, () => {
            console.log('Shopee Crawler: Đã xóa toàn bộ dữ liệu.');
            sendResponse({ status: 'cleared' });
        });
        return true; // Keep channel open for async response
    }
});

function downloadCSV() {
    chrome.storage.local.get(['products'], (result) => {
        const dataToExport = result.products || [];
        if (dataToExport.length === 0) {
            alert('Chưa có dữ liệu!');
            return;
        }

        let csvContent = '\uFEFFTên Shop,Tên sản phẩm,Rating,Giá,Đã bán,Vùng,Khuyến mại\n';
        dataToExport.forEach(p => {
            csvContent += `"${p.shopName}","${p.name}",${p.rating},${p.price},${p.sold},"${p.region}","${p.discount}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `shopee_data_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
