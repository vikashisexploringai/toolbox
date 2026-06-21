/**
 * ========================================
 * Main App - PDF Toolbox
 * Loads tools dynamically from /tools/ folder
 * ========================================
 */

import { openModal, closeModal, setModalFooter, resetModal } from './modal.js';

// ===== Tool Configuration =====
const TOOLS = [
    {
        id: 'pdf-merger',
        icon: '📑',
        name: 'PDF Merger',
        description: 'Merge multiple PDFs with drag & drop, reverse order, and individual arrangement.',
        tag: 'Popular',
        scriptPath: './tools/pdf-merger/merger.js'
    },
    {
        id: 'pdf-split',
        icon: '✂️',
        name: 'PDF Splitter',
        description: 'Split a PDF into multiple files by page ranges. Extract specific pages.',
        tag: 'New',
        scriptPath: './tools/pdf-split/splitter.js'
    },
    {
        id: 'pdf-compress',
        icon: '📦',
        name: 'PDF Compressor',
        description: 'Reduce PDF file size with quality presets. Perfect for email attachments.',
        tag: 'Beta',
        scriptPath: './tools/pdf-compress/compressor.js'
    },
    {
        id: 'html-saver',
        icon: '💾',
        name: 'HTML Saver',
        description: 'Paste HTML code, preview it live, and download as a complete .html file.',
        tag: 'Stable',
        scriptPath: './tools/html-saver/saver.js'
    }
];

// Cache for loaded tool modules
const toolCache = {};

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
            const toolId = e.target.closest('.open-btn')?.dataset.tool || 
                          e.target.closest('.tool-card')?.dataset.tool;
            if (toolId) {
                openTool(toolId);
            }
        });
    });
}

// ===== Open Tool =====
async function openTool(toolId) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    
    try {
        // Load tool module (from cache or dynamically)
        let module = toolCache[toolId];
        if (!module) {
            const moduleUrl = tool.scriptPath;
            module = await import(moduleUrl);
            toolCache[toolId] = module;
        }
        
        // Get HTML content from tool
        const contentHTML = module.getToolHTML ? module.getToolHTML() : '<p>Tool content not available</p>';
        
        // Open modal with content
        openModal(tool.name, tool.icon, contentHTML, () => {
            // Initialize tool after modal opens
            if (typeof module.initTool === 'function') {
                module.initTool();
            }
        });
        
        // Set footer
        setModalFooter([
            {
                text: '✕ Close',
                className: 'btn-secondary',
                onClick: closeModal
            }
        ]);
        
    } catch (err) {
        console.error(`Failed to load tool "${toolId}":`, err);
        openModal('Error', '❌', `
            <div style="padding:2rem;text-align:center;color:#991B1B;">
                <p style="font-size:1.2rem;font-weight:600;">Failed to load tool</p>
                <p style="color:#64748B;">${err.message}</p>
                <p style="font-size:0.85rem;margin-top:1rem;">Please check the console for details.</p>
            </div>
        `);
    }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    renderTools();
});