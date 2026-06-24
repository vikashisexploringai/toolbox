/**
 * ========================================
 * Main App - PDF Toolbox
 * Loads tools using fetch + blob URL
 * ========================================
 */

import { openModal, closeModal, setModalFooter } from './modal.js';

// ===== Tool Configuration =====
const TOOLS = [
    {
        id: 'pdf-merger',
        icon: '📑',
        name: 'PDF Merger',
        description: 'Merge multiple PDFs with drag & drop, reverse order, and individual arrangement.',
        tag: 'Popular',
        scriptPath: 'tools/pdf-merger/merger.js'
    },
    {
        id: 'pdf-split',
        icon: '✂️',
        name: 'PDF Splitter',
        description: 'Split a PDF into multiple files by page ranges. Extract specific pages.',
        tag: 'New',
        scriptPath: 'tools/pdf-split/splitter.js'
    },
    {
        id: 'pdf-compress',
        icon: '📦',
        name: 'PDF Compressor',
        description: 'Reduce PDF file size with quality presets. Perfect for email attachments.',
        tag: 'Beta',
        scriptPath: 'tools/pdf-compress/compressor.js'
    },
       {
    id: 'pdf-rotator',
    icon: '🔄',
    name: 'PDF Rotator',
    description: 'Rotate PDF pages by 90° clockwise, counter-clockwise, or 180°.',
    tag: 'New',
    scriptPath: 'tools/pdf-rotate/rotator.js'
}
    {
        id: 'html-saver',
        icon: '💾',
        name: 'HTML Saver',
        description: 'Paste HTML code, preview it live, and download as a complete .html file.',
        tag: 'Stable',
        scriptPath: 'tools/html-saver/saver.js'
    },
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
    
    grid.querySelectorAll('.open-btn, .tool-card').forEach(el => {
        el.addEventListener('click', (e) => {
            const toolId = e.target.closest('.open-btn')?.dataset.tool || 
                          e.target.closest('.tool-card')?.dataset.tool;
            if (toolId) openTool(toolId);
        });
    });
}

// ===== Load Tool Using Fetch + Blob URL =====
async function loadTool(tool) {
    try {
        // Fetch the tool file as text
        const response = await fetch(tool.scriptPath);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const code = await response.text();
        
        // Create a blob URL from the code
        const blob = new Blob([code], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Import from the blob URL
        const module = await import(blobUrl);
        
        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);
        
        return module;
    } catch (err) {
        console.error(`Failed to load tool "${tool.id}":`, err);
        throw err;
    }
}

// ===== Open Tool =====
async function openTool(toolId) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    
    try {
        let module = toolCache[toolId];
        if (!module) {
            module = await loadTool(tool);
            toolCache[toolId] = module;
        }
        
        const contentHTML = module.getToolHTML ? module.getToolHTML() : '<p>Tool content not available</p>';
        
        openModal(tool.name, tool.icon, contentHTML, () => {
            if (typeof module.initTool === 'function') {
                setTimeout(() => module.initTool(), 50);
            }
        });
        
        setModalFooter([
            {
                text: '✕ Close',
                className: 'btn-secondary',
                onClick: closeModal
            }
        ]);
        
    } catch (err) {
        console.error(`Failed to open tool "${toolId}":`, err);
        openModal('Error', '❌', `
            <div style="padding:2rem;text-align:center;color:#991B1B;">
                <p style="font-size:1.2rem;font-weight:600;">Failed to load tool</p>
                <p style="color:#64748B;">${err.message}</p>
                <p style="font-size:0.85rem;margin-top:1rem;">Check console for details.</p>
            </div>
        `);
    }
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', renderTools);
