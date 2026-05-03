// Inject inject.js into the main page context
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

let products = [];
let productNames = new Set(); // To avoid duplicates by name
let itemIds = new Set(); // To avoid duplicates by itemid
let isScrolling = false;
let scrollInterval = null;
let lastScrollHeight = -1;
let sameScrollCount = 0;
let statusBadge = null;

// Load existing products and scrolling state from storage
chrome.storage.local.get(['products', 'isScrolling'], (result) => {
    if (result.products) {
        products = result.products;
        products.forEach(p => {
            productNames.add(p.name);
            if (p.itemid) itemIds.add(p.itemid);
        });
    }

    if (result.isScrolling) {
        isScrolling = true;
        console.log('Shopee Crawler: Đang khôi phục trạng thái cuộn...');
        setTimeout(startAutoScroll, 3000);
    }
});

// Đã loại bỏ hoàn toàn cơ chế lấy dữ liệu qua API (inject.js) 
// vì API Shopee trả về quá nhiều sản phẩm rác (Gợi ý, Flash sale ẩn) làm nhiễu dữ liệu.
// Bây giờ extension CHỈ TIN TƯỞNG các sản phẩm thực sự hiển thị trên màn hình.

function showStatusBadge(text) {
    // Hidden as requested
}

async function fetchProductRegion(url) {
    try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) return null;
        const html = await response.text();

        // Ưu tiên tìm trong __SHOPEE_STATE__
        const locMatch = html.match(/"shop_location":"([^"]+)"/);
        if (locMatch) {
            return locMatch[1];
        }

        // Thử tìm trong shipping info (fallback)
        const shipMatch = html.match(/"shipping_location":"([^"]+)"/);
        if (shipMatch) {
            return shipMatch[1];
        }
    } catch (e) {
        // Lỗi mạng hoặc bị block
    }
    return null;
}

function updateBadgeText(text) {
    // Hidden as requested
}

function removeStatusBadge() {
    // Hidden as requested
}

// Helpers
/**
 * parsePrice: Nhận vào 1 product card (DOM node) và trả về giá sạch (ví dụ: "1879080")
 * Chiến lược: Tìm MỌI element trong card có chứa '₫', đọc text của element đó
 * và của node liền kề để ghép lại thành chuỗi giá đầy đủ.
 */
function parsePrice(card) {
    // Lấy tất cả các element trong card có text chứa '₫'
    const priceEls = Array.from(card.querySelectorAll('*')).filter(el => {
        const t = el.innerText;
        return t && t.includes('₫');
    });

    // Ưu tiên element có text ngắn nhất (ít nhiễu nhất, ví dụ "1.879.080₫" thay vì cả block)
    priceEls.sort((a, b) => (a.innerText.length) - (b.innerText.length));

    const prices = [];

    for (const el of priceEls) {
        const raw = el.innerText.trim();

        // Bỏ qua nếu là Flash Sale placeholder
        if (raw.includes('?') || raw.toLowerCase().includes('at 00:00')) continue;

        // TH1: Element chứa số + '₫' trong cùng 1 text (ví dụ: "1.879.080₫" hoặc "₫1.879.080")
        const combined = raw.replace(/\s+/g, '');
        const matchCombined = combined.match(/(\d{1,3}(?:\.\d{3})+|\d{4,})/g);
        if (matchCombined) {
            for (const m of matchCombined) {
                const cleaned = m.replace(/\./g, '');
                // Giá hợp lệ: ít nhất 3 chữ số (>= 100đ)
                if (cleaned.length >= 3 && !prices.includes(cleaned)) {
                    prices.push(cleaned);
                }
            }
        }

        // Nếu đã tìm được giá hợp lệ, dừng sớm để tránh lấy trùng
        if (prices.length > 0) break;
    }

    // Trường hợp không tìm thấy qua element chứa '₫'
    // => Thử quét tất cả text node trong card tìm số tiền có dấu chấm nghìn
    if (prices.length === 0) {
        const allEls = Array.from(card.querySelectorAll('*'));
        for (const el of allEls) {
            if (el.childNodes.length !== 1) continue;
            const t = (el.innerText || '').trim();
            if (!t || t.includes('?') || t.toLowerCase().includes('at 00:00')) continue;
            // Bắt chuỗi số có dấu chấm nghìn chuẩn VN (ví dụ: 1.879.080)
            if (/^\d{1,3}(?:\.\d{3})+$/.test(t)) {
                const cleaned = t.replace(/\./g, '');
                if (!prices.includes(cleaned)) prices.push(cleaned);
                break;
            }
        }
    }

    return prices.join(' - ');
}

function parseDiscount(text) {
    const lowerText = text.toLowerCase();
    // Bỏ qua Flash Sale placeholder
    if (text.includes('?') || lowerText.includes('at 00:00')) return '';
    // Bắt các dạng: "-16%", "16% giảm", "giảm 16%", "16% off"
    const pctMatch = text.match(/(-?\d{1,2})%/);
    if (pctMatch) {
        const val = Math.abs(parseInt(pctMatch[1], 10));
        // Giảm giá hợp lệ: 1% - 99%
        if (val >= 1 && val <= 99) return val + '%';
    }
    return '';
}

/**
 * extractDiscount: Nhận vào 1 product card (DOM node) và trả về tỉ lệ khuyến mãi
 * Tìm element ngắn nhất chứa ký hiệu '%' trong card
 */
function extractDiscount(card) {
    // Tìm tất cả element có text chứa '%'
    const discountEls = Array.from(card.querySelectorAll('*')).filter(el => {
        const t = (el.innerText || '').trim();
        // Chỉ lấy element có text ngắn (tránh bắt block tổng)
        return t.includes('%') && t.length <= 8;
    });

    // Ưu tiên element có text ngắn nhất (ví dụ: "-16%" chứ không phải cả câu)
    discountEls.sort((a, b) => a.innerText.length - b.innerText.length);

    for (const el of discountEls) {
        const val = parseDiscount(el.innerText.trim());
        if (val) return val;
    }
    return '';
}

function parseRating(text) {
    if (text.includes('?') || text.toLowerCase().includes('at 00:00')) return '';

    // Thử tìm số rating (x.x) trong chuỗi, kể cả khi có text phụ như "4.9 Shop Rating"
    const ratingMatch = text.match(/([1-4]\.[0-9]|5\.0)/);
    if (ratingMatch) return ratingMatch[1];

    return '';
}


/**
 * parseSold: Nhận vào text và trả về số lượng đã bán
 * Hỗ trợ: "197 đã bán", "62 sold", "1k+", "Đã Bán 2.3k"
 */
function parseSold(text) {
    const lowerText = text.toLowerCase();
    if (!lowerText.includes('đã bán') && !lowerText.includes('sold')) return 0;

    // Tìm cụm: số (+ dấu chấm) theo sau là k hoặc k+ (tuỳ chọn)
    const kMatch = lowerText.match(/(\d+(?:[\.,]\d+)?)\s*k\+?/);
    if (kMatch) {
        const num = parseFloat(kMatch[1].replace(',', '.'));
        return Math.round(num * 1000);
    }

    // Tìm số nguyên thuần (197, 2.500, 1,200)
    const numMatch = lowerText.match(/(\d[\d.,]*)/);
    if (numMatch) {
        const cleaned = numMatch[1].replace(/[.,]/g, '');
        const val = parseInt(cleaned, 10);
        if (!isNaN(val)) return val;
    }

    return 0;
}

/**
 * extractSold: Nhận vào 1 product card (DOM node) và trả về số lượng bán
 * Tìm element ngắn nhất chứa từ khóa sold/đã bán trong card
 */
function extractSold(card) {
    // Tìm tất cả element có text chứa 'đã bán' hoặc 'sold'
    const soldEls = Array.from(card.querySelectorAll('*')).filter(el => {
        const t = (el.innerText || '').toLowerCase();
        return t.includes('đã bán') || t.includes('sold');
    });

    // Ưu tiên element có text ngắn nhất (ví dụ: "197 đã bán" chứ không phải cả block card)
    soldEls.sort((a, b) => a.innerText.length - b.innerText.length);

    for (const el of soldEls) {
        const val = parseSold(el.innerText);
        if (val > 0) return val;
    }
    return 0;
}

function findNextButton() {
    // 1. Try specific Shopee Page Controller (newer layouts)
    const nextBtn = document.querySelector('.shopee-page-controller__next-btn:not(.shopee-button-no-outline--disabled)') ||
        document.querySelector('.shopee-icon-button--right:not(.shopee-icon-button--disabled)') ||
        document.querySelector('.shopee-pager__next:not(.shopee-pager__next--disabled)');

    if (nextBtn && !nextBtn.disabled && nextBtn.offsetParent !== null) return nextBtn;

    // 2. Try text search in buttons
    const buttons = document.querySelectorAll('button, .shopee-button, a.shopee-button');
    for (const btn of buttons) {
        const text = btn.innerText.toLowerCase().trim();
        const isNext = text === '>' || text.includes('trang sau') || text.includes('next');
        if (isNext && !btn.disabled && !btn.className.includes('disabled') && !btn.hasAttribute('disabled') && btn.offsetParent !== null) {
            return btn;
        }
    }

    // 3. Try aria-labels
    const ariaNext = document.querySelector('[aria-label="Next Page"]:not([disabled])') ||
        document.querySelector('[aria-label="Trang sau"]:not([disabled])');
    if (ariaNext && ariaNext.offsetParent !== null && !ariaNext.className.includes('disabled')) return ariaNext;

    return null;
}

async function extractProductsFromDOM() {
    let newlyAdded = 0;
    const shopTitle = document.title.split('|')[0].trim();

    // Tìm thẻ <a> chứa href có chuỗi '-i.' hoặc '/product/'
    const cards = Array.from(document.querySelectorAll('a[href]')).filter(a => /-i\.\d+\.\d+/.test(a.href) || a.href.includes('/product/'));

    const pendingProducts = [];

    for (const card of cards) {
        try {
            const match = card.href.match(/-i\.(\d+)\.(\d+)/);
            const id = match ? match[2] : card.href;

            // Tên sản phẩm
            let name = '';
            const img = card.querySelector('img[alt]');
            if (img && img.alt) {
                name = img.alt;
            } else {
                const nameNode = card.querySelector('div[data-sqe="name"] > div') || card.querySelector('div[class*="line-clamp"]');
                if (nameNode) name = nameNode.innerText.trim();
            }
            if (!name) continue;

            if (productNames.has(name) || itemIds.has(id)) continue;

            let price = '';
            let sold = 0;
            let region = 'N/A';
            let discount = '0';
            let rating = '0';

            // 1. Lấy rating từ độ rộng của thanh sao (CSS width)
            const ratingElements = Array.from(card.querySelectorAll('[class*="rating"] [style*="width"], .shopee-rating-stars__lit'));
            for (const el of ratingElements) {
                if (el.style && el.style.width) {
                    const widthMatch = el.style.width.match(/(\d+(?:\.\d+)?)%/);
                    if (widthMatch) {
                        const pct = parseFloat(widthMatch[1]);
                        if (!isNaN(pct)) {
                            rating = (pct / 20).toFixed(1);
                            if (rating.endsWith('.0')) rating = rating.slice(0, -2);
                            break;
                        }
                    }
                }
            }

            // Lấy giá, số lượng bán và khuyến mãi ngay từ card - TRƯỚC vòng lặp text nodes
            price = parsePrice(card);
            sold = extractSold(card);
            discount = extractDiscount(card);

            const allTextNodes = Array.from(card.querySelectorAll('*'))
                .filter(el => el.childNodes.length === 1 && el.innerText && el.innerText.trim() !== '')
                .map(el => el.innerText.trim());

            const uniqueTexts = [...new Set(allTextNodes)];

            for (const text of uniqueTexts) {
                const lowerText = text.toLowerCase();

                // Bỏ qua hoàn toàn chuỗi văn bản rác báo giá tương lai Flash Sale
                if (text.includes('?') && lowerText.includes('at 00:00')) continue;
                if (lowerText.includes('free') && lowerText.includes('gift')) continue;

                // Khuyến mãi (fallback nếu extractDiscount chưa tìm được)
                if (discount === '0' || discount === '') {
                    const parsedDiscount = parseDiscount(text);
                    if (parsedDiscount) discount = parsedDiscount;
                }


                // Rating
                if (rating === '0') {
                    const parsedRating = parseRating(text);
                    if (parsedRating) rating = parsedRating;
                }

                // (Giá được lấy bên ngoài vòng lặp bằng parsePrice(card))

                // Vùng (Loại trừ free gift, voucher, quà tặng...)
                if (!lowerText.match(/^[0-9\.,]+$/) &&
                    text.length > 2 && text.length < 30 &&
                    !lowerText.includes('giảm') &&
                    !lowerText.includes('mua') &&
                    !lowerText.includes('tặng') &&
                    !lowerText.includes('đã bán') &&
                    !lowerText.includes('sold') &&
                    !lowerText.includes('₫') &&
                    !lowerText.includes('đánh giá') &&
                    !lowerText.includes('rating') &&
                    !lowerText.includes('free gift') &&
                    !lowerText.includes('mã') &&
                    !lowerText.includes('deal') &&
                    !lowerText.includes('hoàn tiền') &&
                    !lowerText.includes('voucher') &&
                    !lowerText.match(/^-\d+%$/) &&
                    !lowerText.includes('at 00:00') &&
                    !lowerText.includes('tìm sản phẩm tương tự')) {

                    if (lowerText.includes('thành phố') || lowerText.includes('hà nội') || lowerText.includes('tỉnh') || lowerText.includes('nước ngoài') || lowerText.includes('overseas') || lowerText.includes('quận') || lowerText.includes('huyện') || lowerText.includes('tp.')) {
                        region = text;
                    } else if (region === 'N/A') {
                        region = text;
                    }
                }
            }

            // Dọn dẹp lại giá cho gọn gàng (nếu có dấu - thừa)
            price = price.replace(/\s*-\s*-\s*/g, ' - ').replace(/^-|-$/g, '').trim() || '0';

            // Dọn dẹp Vùng
            if (region.toLowerCase().includes('sold') || region.toLowerCase().includes('đã bán') || region.toLowerCase().includes('free gift')) {
                region = 'N/A';
            }

            pendingProducts.push({
                shopName: shopTitle,
                name: name.replace(/"/g, '""'),
                rating: rating,
                price: price,
                sold: sold || 0,
                region: region,
                discount: discount,
                itemid: id,
                url: card.href
            });
            productNames.add(name);
            itemIds.add(id);
        } catch (e) { }
    }

    if (pendingProducts.length > 0) {
        console.log(`Shopee Crawler: Đang truy cập sâu ${pendingProducts.length} sản phẩm để lấy Vùng...`);
        // Chạy song song từng batch 3 request để tránh bị khóa IP
        for (let i = 0; i < pendingProducts.length; i += 3) {
            if (!isScrolling) break; // Dừng lại nếu người dùng bấm Dừng

            const batch = pendingProducts.slice(i, i + 3);
            await Promise.all(batch.map(async (prod) => {
                // Tự động truy cập sâu nếu Vùng đang trống hoặc để kiểm tra lại
                const deepRegion = await fetchProductRegion(prod.url);
                if (deepRegion) {
                    prod.region = deepRegion;
                } else if (prod.region === 'N/A') {
                    prod.region = ''; // Nếu không tìm thấy, để trống như yêu cầu
                }

                delete prod.url;
                products.push(prod);
                newlyAdded++;
            }));
            await wait(500); // Nghỉ 0.5s giữa các batch
        }
    }

    return newlyAdded;
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startAutoScroll() {
    // If called manually but already scrolling, ignore
    if (isScrolling && document.getElementById('statusText')) return;

    isScrolling = true;
    chrome.storage.local.set({ isScrolling: true }, () => {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
    });

    console.log('Shopee Crawler: Đang cuộn trang để tải dữ liệu (Lazy Loading)...');

    // Cuộn thông minh: Cuộn từng bước 500px để kích hoạt Shopee tải dữ liệu
    let lastHeight = 0;
    let retries = 0;
    while (isScrolling) {
        window.scrollBy(0, 500);
        await wait(600); // Chờ 0.6s để ảnh/HTML kịp load

        const newHeight = document.body.scrollHeight;
        // Kiểm tra xem đã cuộn đến cuối chưa
        if (window.scrollY + window.innerHeight >= newHeight - 1000) {
            if (newHeight === lastHeight) {
                retries++;
                if (retries >= 3) break; // Đã đến đáy và không có nội dung mới sau 3 lần thử
            } else {
                retries = 0; // Reset
            }
            lastHeight = newHeight;
            await wait(1000); // Đợi thêm xíu
        }
    }

    if (!isScrolling) return;

    // Lúc này DOM đã tải đủ 60 thẻ sản phẩm (hoặc số lượng tối đa trên trang)
    let added = await extractProductsFromDOM();
    if (added > 0) {
        chrome.storage.local.set({ products: products }, () => {
            if (chrome.runtime.lastError) {
                console.error("Lỗi lưu trữ DOM:", chrome.runtime.lastError);
            }
        });
        console.log(`Shopee Crawler: +${added} items (từ DOM). Total: ${products.length}`);
    } else {
        console.log(`Shopee Crawler: Trang trống hoặc DOM chưa kịp render.`);
    }

    if (!isScrolling) return;

    const nextBtn = findNextButton();
    if (nextBtn) {
        console.log('Shopee Crawler: Tìm thấy trang tiếp theo, đang chuyển trang...');

        // Chuyển trang bằng cách đổi URL parameter 'page'
        const url = new URL(window.location.href);
        let currentPage = 0;
        if (url.searchParams.has('page')) {
            currentPage = parseInt(url.searchParams.get('page'), 10);
            if (isNaN(currentPage)) currentPage = 0;
        }
        url.searchParams.set('page', currentPage + 1);

        window.location.href = url.toString();
    } else {
        console.log('Shopee Crawler: Không còn trang tiếp theo. Hoàn tất!');
        stopAutoScroll();
        // Notify popup that crawl is complete (popup will handle upload)
        chrome.storage.local.set({ crawlComplete: true });
    }
}

function stopAutoScroll() {
    isScrolling = false;
    chrome.storage.local.set({ isScrolling: false }, () => {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
    });
    console.log('Shopee Crawler: Đã dừng.');
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'start_scroll') {
        startAutoScroll();
        sendResponse({ status: 'started' });
    } else if (request.action === 'stop_scroll') {
        stopAutoScroll();
        sendResponse({ status: 'stopped' });
    } else if (request.action === 'get_count') {
        sendResponse({ count: products.length });
    } else if (request.action === 'download_csv') {
        downloadCSV();
        sendResponse({ status: 'downloading' });
    } else if (request.action === 'clear_data') {
        products = [];
        productNames.clear();
        itemIds.clear();
        stopAutoScroll();
        chrome.storage.local.set({ products: [], isScrolling: false }, () => {
            removeStatusBadge();
            sendResponse({ status: 'cleared' });
        });
        return true;
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
            const shopName = (p.shopName || '').toString().replace(/"/g, '""');
            const name = (p.name || '').toString().replace(/"/g, '""');
            const rating = (p.rating ?? '0').toString().replace(/"/g, '""');
            const price = (p.price || '0').toString().replace(/"/g, '""');
            const sold = (p.sold || '0').toString().replace(/"/g, '""');
            const region = (p.region || '').toString().replace(/"/g, '""');
            const discount = (p.discount || '0').toString().replace(/"/g, '""');

            // Bọc TẤT CẢ các trường trong dấu ngoặc kép để tránh lỗi tách cột nhầm khi mở bằng Excel
            csvContent += `"${shopName}","${name}","${rating}","${price}","${sold}","${region}","${discount}"\n`;
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




