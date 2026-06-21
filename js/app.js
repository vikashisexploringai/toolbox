/**
 * ========================================
 * Main App - PDF Toolbox
 * ========================================
 */

import { openModal, closeModal, setModalFooter, resetModal } from './modal.js';
import { formatFileSize, escapeHtml, downloadBlob, setStatus } from './utils.js';

// ===== Tool Configuration =====
const TOOLS = [
    {
        id: 'pdf-merger',
        icon: '📑',
        name: 'PDF Merger',
        description: 'Merge multiple PDFs with drag & drop, reverse order, and individual arrangement.',
        tag: 'Popular',
        getContent: () => getPDFMergerContent()
    },
    {
        id: 'pdf-split',
        icon: '✂️',
        name: 'PDF Splitter',
        description: 'Split a PDF into multiple files by page ranges. Extract specific pages.',
        tag: 'New',
        getContent: () => getPDFSplitterContent()
    },
    {
        id: 'pdf-compress',
        icon: '📦',
        name: 'PDF Compressor',
        description: 'Reduce PDF file size with quality presets. Perfect for email attachments.',
        tag: 'Beta',
        getContent: () => getPDFCompressorContent()
    },
    {
        id: 'html-saver',
        icon: '💾',
        name: 'HTML Saver',
        description: 'Paste HTML code, preview it live, and download as a complete .html file.',
        tag: 'Stable',
        getContent: () => getHTMLSaverContent()
    }
];

// ===== Render Tool Cards =====
function renderTools() {
    const grid = document.getElementById('toolGrid');
    if (!grid) return;
    
    grid.innerHTML = TOOLS.map(tool => `
        <div class="tool-card" data-tool="${tool.id}">
            <div class="tool-icon">${tool.icon}</div>
            <h3>${tool.name}</h3>
            <p>${tool.description}</p>
            <span class="tool-tag">${tool.tag}</span>
            <button class="open-btn" data-tool="${tool.id}">
                🔓 Open Tool
            </button>
        </div>
    `).join('');
    
    // Attach click events
    grid.querySelectorAll('.open-btn, .tool-card').forEach(el => {
        el.addEventListener('click', (e) => {
            // Prevent opening if clicking on button inside card (already handled)
            if (e.target.closest('.open-btn')) {
                const toolId = e.target.closest('.open-btn').dataset.tool;
                openTool(toolId);
            } else if (e.target.closest('.tool-card') && !e.target.closest('.open-btn')) {
                const toolId = e.target.closest('.tool-card').dataset.tool;
                openTool(toolId);
            }
        });
    });
}

// ===== Open Tool =====
function openTool(toolId) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    
    // Get content from tool
    const content = tool.getContent();
    
    // Open modal
    openModal(tool.name, tool.icon, content, () => {
        // After modal opens, initialize the tool
        const initFn = window[`init${toolId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`];
        if (typeof initFn === 'function') {
            initFn();
        }
    });
    
    // Set footer (close button only for now)
    setModalFooter([
        {
            text: '✕ Close',
            className: 'btn-secondary',
            onClick: closeModal
        }
    ]);
}

// ===== Tool Content Functions =====

/**
 * PDF Merger Content (Your extracted code will go here)
 */
function getPDFMergerContent() {
    return `
        <div id="pdfMergerContainer">
            <div id="toolStatus" class="status" style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;">
                ⚡ Loading PDF Merger...
            </div>
            <div id="mergerPlaceholder">
                <p style="color:#64748B;text-align:center;padding:2rem 0;">
                    ⏳ Loading PDF Merger tool...<br>
                    <span style="font-size:0.85rem;">Please wait a moment.</span>
                </p>
            </div>
        </div>
    `;
}

/**
 * PDF Splitter Content
 */
function getPDFSplitterContent() {
    return `
        <div id="pdfSplitterContainer">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                ✂️ Split a PDF by page ranges
            </div>
            <div style="border:2px dashed #CBD5E1;border-radius:16px;padding:2rem;text-align:center;cursor:pointer;background:#FAFBFC;" id="splitDropZone">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Drop a PDF here</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">or click to select a file</span>
                <input type="file" id="splitFileInput" accept=".pdf" style="display:none;">
            </div>
            <div id="splitFileInfo" style="display:none;margin-top:1rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="splitFileName">file.pdf</span> — <span id="splitFileSize">0 KB</span>
            </div>
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Page ranges (e.g., 1-3, 5, 7-9)</label>
                <input type="text" id="pageRanges" placeholder="1-3, 5, 7-9" style="width:100%;padding:0.6rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;">
            </div>
            <button id="splitBtn" disabled style="width:100%;margin-top:1rem;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                ✂️ Split PDF
            </button>
            <div id="splitStatus" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;">
                📄 Upload a PDF to split
            </div>
        </div>
    `;
}

/**
 * PDF Compressor Content
 */
function getPDFCompressorContent() {
    return `
        <div id="pdfCompressorContainer">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📦 Reduce PDF file size
            </div>
            <div style="border:2px dashed #CBD5E1;border-radius:16px;padding:2rem;text-align:center;cursor:pointer;background:#FAFBFC;" id="compressDropZone">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Drop a PDF here</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">or click to select a file</span>
                <input type="file" id="compressFileInput" accept=".pdf" style="display:none;">
            </div>
            <div id="compressFileInfo" style="display:none;margin-top:1rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="compressFileName">file.pdf</span> — <span id="compressFileSize">0 KB</span>
            </div>
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Compression Quality</label>
                <select id="compressQuality" style="width:100%;padding:0.6rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;background:white;">
                    <option value="high">High Quality (larger file)</option>
                    <option value="normal" selected>Normal Quality (balanced)</option>
                    <option value="low">Low Quality (smallest file)</option>
                </select>
            </div>
            <button id="compressBtn" disabled style="width:100%;margin-top:1rem;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📦 Compress PDF
            </button>
            <div id="compressStatus" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;">
                📄 Upload a PDF to compress
            </div>
        </div>
    `;
}

/**
 * HTML Saver Content
 */
function getHTMLSaverContent() {
    return `
        <div id="htmlSaverContainer">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                💾 Save HTML code as a downloadable .html file
            </div>
            <textarea id="htmlCodeInput" style="width:100%;height:200px;padding:0.75rem;border:1px solid #E2E8F0;border-radius:12px;font-family:monospace;font-size:0.9rem;resize:vertical;" placeholder="Paste your HTML code here..."></textarea>
            <div style="display:flex;gap:0.75rem;margin-top:0.75rem;flex-wrap:wrap;">
                <button id="previewHtmlBtn" style="flex:1;padding:0.6rem;border:none;border-radius:10px;background:#F1F5F9;color:#1E293B;font-weight:600;cursor:pointer;transition:all 0.2s;">👁️ Preview</button>
                <button id="downloadHtmlBtn" style="flex:1;padding:0.6rem;border:none;border-radius:10px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">💾 Download .html</button>
            </div>
            <div id="htmlPreviewFrame" style="display:none;margin-top:0.75rem;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
                <iframe id="htmlPreview" style="width:100%;height:250px;border:none;"></iframe>
            </div>
            <div id="htmlStatus" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;">
                📝 Paste HTML code and save as file
            </div>
        </div>
    `;
}

// ===== Initialize Tools =====

// These will be called when the modal opens
window.initPdfMerger = function() {
    // Load the PDF Merger tool
    const container = document.getElementById('pdfMergerContainer');
    const status = document.getElementById('toolStatus');
    const placeholder = document.getElementById('mergerPlaceholder');
    
    if (!container) return;
    
    // Load the merger.js script dynamically
    import('./tools/pdf-merger/merger.js')
        .then(module => {
            if (typeof module.initMerger === 'function') {
                // Replace placeholder with actual tool
                const mergerHTML = module.getMergerHTML();
                placeholder.innerHTML = mergerHTML;
                module.initMerger();
                status.innerHTML = '✅ PDF Merger loaded successfully';
                status.style.background = '#D1FAE5';
                status.style.color = '#065F46';
            }
        })
        .catch(err => {
            console.error('Failed to load PDF Merger:', err);
            status.innerHTML = '❌ Failed to load PDF Merger. Please refresh and try again.';
            status.style.background = '#FEE2E2';
            status.style.color = '#991B1B';
        });
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    renderTools();
});