// Intercept fetch API
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0] instanceof Request ? args[0].url : args[0];
    
    if (typeof url === 'string' && (url.includes('api/v4/search/search_items') || url.includes('api/v4/item/get'))) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            
            // Send to content script
            window.postMessage({
                type: 'SHOPEE_INTERCEPT',
                url: url,
                data: data
            }, '*');
        } catch (e) {
            console.error('Shopee Crawler inject error:', e);
        }
    }
    return response;
};

// Intercept XMLHttpRequest
const originalXHR = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.addEventListener('load', function() {
        if (typeof url === 'string' && (url.includes('api/v4/search/search_items') || url.includes('api/v4/item/get'))) {
            try {
                if (this.responseText) {
                    const data = JSON.parse(this.responseText);
                    window.postMessage({
                        type: 'SHOPEE_INTERCEPT',
                        url: url,
                        data: data
                    }, '*');
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    });
    originalXHR.call(this, method, url, ...rest);
};
