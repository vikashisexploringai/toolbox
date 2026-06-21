/**
 * ========================================
 * HTML Saver Tool
 * Paste HTML code, preview, and download as .html
 * ========================================
 */

let elements = {};

/**
 * Get the HTML for the HTML Saver tool
 */
export function getToolHTML() {
    return `
        <div id="htmlSaverTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                💾 Save HTML code as a downloadable .html file
            </div>
            
            <textarea id="htmlCodeInput" style="width:100%;height:220px;padding:0.75rem;border:1px solid #E2E8F0;border-radius:12px;font-family:monospace;font-size:0.9rem;resize:vertical;" placeholder="Paste your HTML code here..."></textarea>
            
            <div style="display:flex;gap:0.75rem;margin-top:0.75rem;flex-wrap:wrap;">
                <button id="previewHtmlBtn" style="flex:1;padding:0.6rem;border:none;border-radius:10px;background:#F1F5F9;color:#1E293B;font-weight:600;cursor:pointer;transition:all 0.2s;">
                    👁️ Preview
                </button>
                <button id="downloadHtmlBtn" style="flex:1;padding:0.6rem;border:none;border-radius:10px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                    💾 Download .html
                </button>
            </div>
            
            <div id="htmlPreviewFrame" style="display:none;margin-top:0.75rem;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
                <iframe id="htmlPreview" style="width:100%;height:300px;border:none;"></iframe>
            </div>
            
            <div id="htmlStatus" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                📝 Paste HTML code and save as file
            </div>
        </div>
    `;
}

/**
 * Initialize the HTML Saver tool
 */
export function initTool() {
    elements = {
        codeInput: document.getElementById('htmlCodeInput'),
        previewBtn: document.getElementById('previewHtmlBtn'),
        downloadBtn: document.getElementById('downloadHtmlBtn'),
        previewFrame: document.getElementById('htmlPreviewFrame'),
        previewIframe: document.getElementById('htmlPreview'),
        status: document.getElementById('htmlStatus')
    };
    
    setupPreviewButton();
    setupDownloadButton();
    
    // Auto-preview on Ctrl+Enter
    elements.codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            previewHTML();
        }
    });
    
    setStatus('📝 Paste HTML code and save as file', 'info');
}

/**
 * Setup preview button
 */
function setupPreviewButton() {
    elements.previewBtn.addEventListener('click', previewHTML);
}

/**
 * Setup download button
 */
function setupDownloadButton() {
    elements.downloadBtn.addEventListener('click', downloadHTML);
}

/**
 * Preview HTML
 */
function previewHTML() {
    const html = elements.codeInput.value.trim();
    if (!html) {
        setStatus('⚠️ Please paste some HTML code first', 'error');
        return;
    }
    
    elements.previewFrame.style.display = 'block';
    const iframe = elements.previewIframe;
    
    // Write to iframe
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    
    setStatus('✅ Preview updated', 'success');
}

/**
 * Download HTML
 */
function downloadHTML() {
    let html = elements.codeInput.value.trim();
    if (!html) {
        setStatus('⚠️ Please paste some HTML code first', 'error');
        return;
    }
    
    // Wrap in full HTML if not already
    if (!html.toLowerCase().includes('<!doctype') && !html.toLowerCase().includes('<html')) {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>
</head>
<body>
${html}
</body>
</html>`;
    }
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const filename = `page_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.html`;
    downloadBlob(blob, filename);
    
    setStatus(`✅ Downloaded "${filename}"`, 'success');
}

/**
 * Download a blob
 */
function downloadBlob(blob, filename) {
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
 * Set status message
 */
function setStatus(msg, type = 'info') {
    if (!elements.status) return;
    const colors = {
        info: { bg: '#EEF2FF', color: '#1E293B' },
        success: { bg: '#D1FAE5', color: '#065F46' },
        error: { bg: '#FEE2E2', color: '#991B1B' }
    };
    const style = colors[type] || colors.info;
    elements.status.innerHTML = msg;
    elements.status.style.background = style.bg;
    elements.status.style.color = style.color;
}