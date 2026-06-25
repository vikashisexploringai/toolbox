/**
 * ========================================
 * PDF Merger Tool
 * Merge multiple PDFs with drag & drop
 * ========================================
 */

let PDFDocument = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let pdfFiles = [];
let elements = {};
let statusTimeout = null;

/**
 * Get the HTML for the merger tool
 */
export function getToolHTML() {
    return `
        <div id="mergerTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📑 Merge multiple PDFs
            </div>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;background:#FEFEFE;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Select PDF files</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">Click the button below to browse</span><br>
                <button id="browseBtn" style="margin:0.75rem 0;padding:0.6rem 2rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Files
                </button>
                <input type="file" id="fileInput" multiple accept=".pdf" style="display:none;">
            </div>
            
            <div style="display:flex;gap:0.85rem;flex-wrap:wrap;margin:0.75rem 0 1rem 0;align-items:center;justify-content:space-between;">
                <div style="display:flex;gap:0.7rem;flex-wrap:wrap;">
                    <button id="reverseOrderBtn" style="border:none;font-weight:600;padding:0.6rem 1.3rem;border-radius:2rem;cursor:pointer;font-size:0.85rem;transition:all 0.2s;background:#FFFFFF;border:1px solid #CBD5E1;color:#1E293B;display:inline-flex;align-items:center;gap:6px;">
                        🔄 Reverse order
                    </button>
                    <button id="clearAllBtn" style="border:none;font-weight:600;padding:0.6rem 1.3rem;border-radius:2rem;cursor:pointer;font-size:0.85rem;transition:all 0.2s;background:#FFFFFF;border:1px solid #FECACA;color:#B91C1C;display:inline-flex;align-items:center;gap:6px;">
                        🗑️ Clear all
                    </button>
                </div>
                <div>
                    <span style="font-size:0.75rem;background:#EEF2FF;padding:0.2rem 0.9rem;border-radius:50px;">
                        📄 <span id="fileCounter">0</span> PDF(s)
                    </span>
                </div>
            </div>
            
            <div id="fileList" style="background:#FAFCFF;border-radius:1.25rem;padding:0.65rem;margin:1.2rem 0;max-height:340px;overflow-y:auto;border:1px solid #EEF2F6;box-shadow:inset 0 1px 3px #00000008;">
                <div id="emptyMessage" style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">✨ No PDFs selected — click Browse to add files</div>
            </div>
            
            <button id="mergeBtn" disabled style="width:100%;border:none;font-weight:600;padding:0.85rem;border-radius:2rem;cursor:pointer;font-size:0.95rem;transition:all 0.2s;background:#4F46E5;color:white;box-shadow:0 4px 8px rgba(79,70,229,0.2);justify-content:center;display:flex;align-items:center;gap:8px;">
                ⚡ Merge PDFs (preserve order)
            </button>
            <div id="status" style="margin-top:1.2rem;text-align:center;font-size:0.85rem;padding:0.65rem;border-radius:2.5rem;transition:0.1s;font-weight:500;background:#EEF2FF;color:#1E293B;">
                ✅ Ready — add PDFs, reverse order, merge offline
            </div>
        </div>
    `;
}

/**
 * Initialize the PDF Merger tool
 */
export function initTool() {
    elements = {
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        fileList: document.getElementById('fileList'),
        emptyMessage: document.getElementById('emptyMessage'),
        mergeBtn: document.getElementById('mergeBtn'),
        status: document.getElementById('status'),
        reverseOrderBtn: document.getElementById('reverseOrderBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        fileCounter: document.getElementById('fileCounter')
    };
    
    pdfFiles = [];
    
    setupFileInput();
    setupButtons();
    renderFileList();
    
    loadPDFLibrary().catch(e => {
        console.warn("Background load warning (needs internet once):", e);
        setStatusMessage('📡 First run needs internet to load PDF engine. After that fully offline.', false);
    });
    
    setStatusMessage('✨ Ready — add PDFs, then use Reverse order or ↑↓ arrows', false);
}

/**
 * Load PDF-Lib library
 */
function loadPDFLibrary() {
    if (pdfLibLoaded && PDFDocument) return Promise.resolve();
    if (loadingPromise) return loadingPromise;
    
    loadingPromise = new Promise((resolve, reject) => {
        if (window.PDFLib) {
            PDFDocument = window.PDFLib.PDFDocument;
            pdfLibLoaded = true;
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            if (window.PDFLib) {
                PDFDocument = window.PDFLib.PDFDocument;
                pdfLibLoaded = true;
                resolve();
            } else {
                reject(new Error('PDF-Lib failed to initialize'));
            }
        };
        script.onerror = () => reject(new Error('Network required to load PDF library (first run).'));
        document.head.appendChild(script);
    });
    return loadingPromise;
}

/**
 * Setup file input (NO drop zone)
 */
/**
 * Setup file input (NO drop zone)
 */
function setupFileInput() {
    // Guard against duplicate bindings if initTool() ever runs more than once
    // on the same DOM (e.g. tool re-selected without a fresh re-render of the HTML).
    // Cloning the nodes strips any previously attached listeners before we add ours,
    // so a stray leftover listener from a prior initTool() call can't fire alongside
    // this one and open the file picker twice.
    if (elements.browseBtn) {
        const freshBrowseBtn = elements.browseBtn.cloneNode(true);
        elements.browseBtn.replaceWith(freshBrowseBtn);
        elements.browseBtn = freshBrowseBtn;
    }
    if (elements.fileInput) {
        const freshFileInput = elements.fileInput.cloneNode(true);
        elements.fileInput.replaceWith(freshFileInput);
        elements.fileInput = freshFileInput;
    }

    // Browse button - opens file picker
    if (elements.browseBtn) {
        elements.browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.fileInput.click();
        });
    }

    // File input change
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
            const selected = Array.from(e.target.files);
            const pdfsOnly = selected.filter(f => f.name.toLowerCase().endsWith('.pdf'));
            if (pdfsOnly.length) addFiles(pdfsOnly);
            else setStatusMessage('No PDF files selected', true);
        }
        elements.fileInput.value = '';
    });
}

/**
 * Setup buttons
 */
function setupButtons() {
    elements.mergeBtn.addEventListener('click', performMerge);
    elements.reverseOrderBtn.addEventListener('click', reverseSequence);
    elements.clearAllBtn.addEventListener('click', clearAllFiles);
}

/**
 * Set status message
 */
function setStatusMessage(msg, isError = false, isSuccess = false) {
    const el = elements.status;
    if (!el) return;
    el.innerHTML = msg;
    el.style.backgroundColor = isError ? '#FEE2E2' : (isSuccess ? '#D1FAE5' : '#EEF2FF');
    el.style.color = isError ? '#B91C1C' : (isSuccess ? '#065F46' : '#1E293B');
    
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        if (el.innerHTML === msg) {
            el.style.backgroundColor = '#EEF2FF';
            el.style.color = '#1E293B';
            if (pdfFiles.length === 0) el.innerHTML = '📭 No PDFs — add files to start';
            else el.innerHTML = `✅ ${pdfFiles.length} PDF(s) ready — order can be reversed or adjusted`;
        }
    }, 3000);
}

/**
 * Add files
 */
function addFiles(newFiles) {
    let addedCount = 0;
    for (const file of newFiles) {
        const isDuplicate = pdfFiles.some(existing => existing.name === file.name && existing.size === file.size);
        if (isDuplicate) {
            setStatusMessage(`⚠️ "${file.name}" already in list`, false);
            continue;
        }
        pdfFiles.push(file);
        addedCount++;
    }
    if (addedCount > 0) {
        renderFileList();
        setStatusMessage(`✅ Added ${addedCount} PDF(s)`, false, true);
    }
}

/**
 * Render file list
 */
function renderFileList() {
    if (!elements.fileList) return;
    
    if (pdfFiles.length === 0) {
        elements.fileList.innerHTML = '<div style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">📭 No PDFs — click Browse to add files</div>';
        updateCounter();
        return;
    }
    
    let html = '';
    pdfFiles.forEach((file, idx) => {
        const sizeKB = (file.size / 1024).toFixed(1);
        const safeName = escapeHtml(file.name);
        html += `
            <div style="background:white;padding:0.7rem 1rem;margin:0.6rem 0;border-radius:1rem;display:flex;justify-content:space-between;align-items:center;border:1px solid #E2E8F0;transition:all 0.15s;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;word-break:break-word;max-width:55%;">
                    <span style="font-weight:500;font-size:0.9rem;background:#F1F5F9;padding:0.2rem 0.7rem;border-radius:30px;">📄 ${safeName}</span>
                    <span style="font-size:0.7rem;color:#4B5563;background:#F8FAFC;padding:0.2rem 0.6rem;border-radius:30px;">${sizeKB} KB</span>
                    <span style="font-size:0.7rem;background:#F1F3F8;padding:2px 8px;border-radius:30px;">#${idx+1}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="move-up" data-index="${idx}" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} style="background:#F1F4F9;border:none;width:34px;height:34px;border-radius:30px;font-weight:700;font-size:1rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:0.1s;color:#2C3E66;">↑</button>
                    <button class="move-down" data-index="${idx}" ${idx === pdfFiles.length-1 ? 'disabled style="opacity:0.4;"' : ''} style="background:#F1F4F9;border:none;width:34px;height:34px;border-radius:30px;font-weight:700;font-size:1rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:0.1s;color:#2C3E66;">↓</button>
                    <button class="remove-item" data-index="${idx}" style="background:#FEE9E6;border:none;color:#B91C1C;width:auto;padding:0 12px;border-radius:30px;font-size:0.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:0.1s;height:34px;">✕ Remove</button>
                </div>
            </div>
        `;
    });
    elements.fileList.innerHTML = html;
    
    elements.fileList.querySelectorAll('.move-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && idx > 0) moveFileUp(idx);
        });
    });
    elements.fileList.querySelectorAll('.move-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && idx < pdfFiles.length - 1) moveFileDown(idx);
        });
    });
    elements.fileList.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx)) removeFileAtIndex(idx);
        });
    });
    updateCounter();
}

/**
 * Escape HTML helper
 */
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/**
 * Update counter
 */
function updateCounter() {
    if (elements.fileCounter) {
        elements.fileCounter.innerText = pdfFiles.length;
    }
    if (elements.mergeBtn) {
        elements.mergeBtn.disabled = (pdfFiles.length === 0);
    }
}

/**
 * Move file up
 */
function moveFileUp(idx) {
    if (idx <= 0) return;
    [pdfFiles[idx - 1], pdfFiles[idx]] = [pdfFiles[idx], pdfFiles[idx - 1]];
    renderFileList();
    setStatusMessage(`⬆️ Moved "${pdfFiles[idx-1]?.name || 'file'}" up`, false, true);
}

/**
 * Move file down
 */
function moveFileDown(idx) {
    if (idx >= pdfFiles.length - 1) return;
    [pdfFiles[idx + 1], pdfFiles[idx]] = [pdfFiles[idx], pdfFiles[idx + 1]];
    renderFileList();
    setStatusMessage(`⬇️ Moved "${pdfFiles[idx+1]?.name || 'file'}" down`, false, true);
}

/**
 * Remove file at index
 */
function removeFileAtIndex(idx) {
    const removedName = pdfFiles[idx]?.name || 'PDF';
    pdfFiles.splice(idx, 1);
    renderFileList();
    setStatusMessage(`🗑️ Removed "${removedName}"`, false);
    if (pdfFiles.length === 0) setStatusMessage('All PDFs cleared. Add new files.', false);
}

/**
 * Clear all files
 */
function clearAllFiles() {
    if (pdfFiles.length === 0) {
        setStatusMessage('No files to clear', false);
        return;
    }
    pdfFiles = [];
    renderFileList();
    setStatusMessage('🧹 Cleared all PDFs', false, true);
}

/**
 * Reverse sequence
 */
function reverseSequence() {
    if (pdfFiles.length <= 1) {
        setStatusMessage('↺ Reverse: need at least 2 PDFs to reverse order', false);
        return;
    }
    pdfFiles.reverse();
    renderFileList();
    setStatusMessage('🔄 Sequence reversed!', false, true);
}

/**
 * Perform merge
 */
async function performMerge() {
    if (pdfFiles.length === 0) {
        setStatusMessage('No PDF files to merge', true);
        return;
    }
    
    if (elements.mergeBtn) {
        elements.mergeBtn.disabled = true;
        elements.mergeBtn.innerHTML = '⏳ Processing & merging...';
    }
    setStatusMessage(`📑 Loading ${pdfFiles.length} PDF(s) — preparing merge`, false);
    
    try {
        await loadPDFLibrary();
        if (!PDFDocument) throw new Error('PDF library unavailable');
        
        const mergedPdf = await PDFDocument.create();
        
        for (let i = 0; i < pdfFiles.length; i++) {
            const file = pdfFiles[i];
            setStatusMessage(`📖 Reading ${i+1}/${pdfFiles.length}: ${file.name}`, false);
            const arrayBuffer = await file.arrayBuffer();
            let sourcePdf;
            try {
                sourcePdf = await PDFDocument.load(arrayBuffer);
            } catch (loadErr) {
                throw new Error(`Cannot load PDF "${file.name}": ${loadErr.message}`);
            }
            const pageIndices = sourcePdf.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
            for (const page of copiedPages) {
                mergedPdf.addPage(page);
            }
        }
        
        setStatusMessage('💾 Saving merged PDF...', false);
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        a.download = `merged_${timestamp}_${pdfFiles.length}files.pdf`;
        a.href = downloadUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        setStatusMessage(`🎉 Success! Merged ${pdfFiles.length} PDF(s) — download started`, false, true);
    } catch (err) {
        console.error('Merge error:', err);
        let errorMsg = err.message || 'Unknown merge error';
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('network')) {
            errorMsg = 'PDF library needs internet connection once. Reload with internet, then works offline.';
        }
        setStatusMessage(`❌ Merge failed: ${errorMsg}`, true);
    } finally {
        if (elements.mergeBtn) {
            elements.mergeBtn.disabled = (pdfFiles.length === 0);
            elements.mergeBtn.innerHTML = '⚡ Merge PDFs (preserve order)';
        }
    }
}
