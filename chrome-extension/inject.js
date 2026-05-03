// Intercept fetch API
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
        const clone = response.clone();
        const data = await clone.json();
        
        // Send ALL JSON to content script for filtering
        if (data && typeof data === 'object') {
            window.postMessage({
                type: 'SHOPEE_INTERCEPT',
                data: data
            }, '*');
        }
    } catch (e) {
        // Not a JSON response, ignore
    }
    
    return response;
};

// Intercept XMLHttpRequest
const originalXHR = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.addEventListener('load', function() {
        try {
            if (this.responseText) {
                const data = JSON.parse(this.responseText);
                if (data && typeof data === 'object') {
                    window.postMessage({
                        type: 'SHOPEE_INTERCEPT',
                        data: data
                    }, '*');
                }
            }
        } catch (e) {
            // Ignore
        }
    });
    originalXHR.call(this, method, url, ...rest);
};
