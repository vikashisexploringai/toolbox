/**
 * ========================================
 * Shared Utilities
 * ========================================
 */

/**
 * Format file size in bytes to human-readable string
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size (e.g., "2.4 MB")
 */
export function formatFileSize(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID for file items
 * @returns {string} Unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Name of the file to download
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Load a script dynamically (for loading tool JS)
 * @param {string} src - Script source URL
 * @returns {Promise} Resolves when script loads
 */
export function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.type = 'module';
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Show a status message in the modal body
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message to display
 * @param {string} type - 'info', 'success', 'error'
 */
export function setStatus(container, message, type = 'info') {
    if (!container) return;
    const colors = {
        info: { bg: '#EEF2FF', text: '#1E293B' },
        success: { bg: '#D1FAE5', text: '#065F46' },
        error: { bg: '#FEE2E2', text: '#991B1B' }
    };
    const style = colors[type] || colors.info;
    container.innerHTML = message;
    container.style.backgroundColor = style.bg;
    container.style.color = style.text;
    container.style.padding = '0.75rem 1rem';
    container.style.borderRadius = '12px';
    container.style.fontWeight = '500';
    container.style.fontSize = '0.9rem';
    container.style.transition = 'all 0.3s ease';
}