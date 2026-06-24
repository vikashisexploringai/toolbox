/**
 * ========================================
 * PDF Splitter Tool
 * Split a PDF by page ranges
 * ========================================
 */

let PDFDocument = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let currentFile = null;
let elements = {};

/**
 * Get the HTML for the splitter tool
 */
export function getToolHTML() {
    return `
        <div id="splitterTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                ✂️ Split a PDF by page ranges
            </div>
            
            /**
 * ========================================
 * PDF Merger Tool
 * Extracted from the provided code
 * ========================================
 */

let PDFDocument = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let pdfFiles = [];

// DOM references (will be set when tool initializes)
let elements = {};

/**
 * Get the HTML for the merger tool
 */
export function getToolHTML() {
    return `
        <div id="mergerTool">
            <div id="dropZone" style="...">
    <strong>📂 Drop PDFs anywhere</strong><br>
    <span style="font-size:0.85rem;color:#64748B;">or</span>
    <button id="browseBtn" style="margin:0.5rem 0;padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
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
                <div id="emptyMessage" style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">✨ No PDFs selected — drag & drop or click above</div>
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
    // Get all DOM elements after they're rendered
    elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        fileList: document.getElementById('fileList'),
        emptyMessage: document.getElementById('emptyMessage'),
        mergeBtn: document.getElementById('mergeBtn'),
        status: document.getElementById('status'),
        reverseOrderBtn: document.getElementById('reverseOrderBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        fileCounter: document.getElementById('fileCounter')
    };
    
    // Reset state
    pdfFiles = [];
    
    // Setup event listeners
    setupDragAndDrop();
    setupButtons();
    renderFileList();
    
    // Preload PDF library
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
 * Setup drag and drop
 */
function setupDragAndDrop() {
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#EEF4FF';
        elements.dropZone.style.borderColor = '#4F46E5';
        elements.dropZone.style.borderStyle = 'solid';
        elements.dropZone.style.transform = 'scale(0.99)';
    });
    
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
        elements.dropZone.style.transform = 'scale(1)';
    });
    
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
        elements.dropZone.style.transform = 'scale(1)';
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (files.length) addFiles(files);
        else setStatusMessage('No valid PDF files dropped', true);
    });
    
    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
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
    
    // Auto-reset after 3 seconds
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
let statusTimeout = null;

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
        elements.fileList.innerHTML = '<div style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">📭 No PDFs — drag & drop or click to add</div>';
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
    
    // Attach events
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
    setStatusMessage(`🔄 Sequence reversed!`, false, true);
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
        
        setStatusMessage(`💾 Saving merged PDF...`, false);
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
            
            <div id="splitFileInfo" style="display:none;margin-top:0.5rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="splitFileName" style="font-weight:600;">file.pdf</span> — 
                <span id="splitFileSize">0 KB</span>
                <span style="margin-left:1rem;font-size:0.8rem;color:#64748B;">Pages: <span id="splitPageCount">0</span></span>
            </div>
            
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Page ranges (e.g., 1-3, 5, 7-9)</label>
                <input type="text" id="pageRanges" placeholder="1-3, 5, 7-9" style="width:100%;padding:0.7rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;">
                <div style="font-size:0.75rem;color:#64748B;margin-top:0.3rem;">💡 Separate ranges with commas. Use hyphen for ranges.</div>
            </div>
            
            <button id="splitBtn" disabled style="width:100%;margin-top:1rem;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                ✂️ Split PDF
            </button>
            
            <div id="splitStatus" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                📄 Upload a PDF to split
            </div>
        </div>
    `;
}

/**
 * Initialize the PDF Splitter tool
 */
export function initTool() {
    // Get DOM elements
    elements = {
        dropZone: document.getElementById('splitDropZone'),
        fileInput: document.getElementById('splitFileInput'),
        fileInfo: document.getElementById('splitFileInfo'),
        fileName: document.getElementById('splitFileName'),
        fileSize: document.getElementById('splitFileSize'),
        pageCount: document.getElementById('splitPageCount'),
        pageRanges: document.getElementById('pageRanges'),
        splitBtn: document.getElementById('splitBtn'),
        status: document.getElementById('splitStatus')
    };
    
    // Reset state
    currentFile = null;
    
    // Setup event listeners
    setupDragAndDrop();
    setupSplitButton();
    
    // Preload PDF library
    loadPDFLibrary().catch(e => console.warn('PDF library background load:', e));
    
    setStatus('📄 Upload a PDF to split', 'info');
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
        script.onerror = () => reject(new Error('Network required to load PDF library'));
        document.head.appendChild(script);
    });
    return loadingPromise;
}

/**
 * Setup drag and drop
 */
function setupDragAndDrop() {
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#EEF4FF';
        elements.dropZone.style.borderColor = '#4F46E5';
        elements.dropZone.style.borderStyle = 'solid';
    });
    
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
    });
    
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (files.length) handleFile(files[0]);
        else setStatus('No valid PDF file dropped', 'error');
    });
    
    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
            const file = e.target.files[0];
            if (file.name.toLowerCase().endsWith('.pdf')) {
                handleFile(file);
            } else {
                setStatus('Please select a PDF file', 'error');
            }
        }
        elements.fileInput.value = '';
    });
}

/**
 * Handle uploaded file
 */
async function handleFile(file) {
    currentFile = file;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    elements.fileInfo.style.display = 'block';
    elements.splitBtn.disabled = false;
    
    // Try to get page count
    try {
        await loadPDFLibrary();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        elements.pageCount.textContent = pageCount;
        setStatus(`✅ Loaded "${file.name}" — ${pageCount} pages`, 'success');
    } catch (err) {
        elements.pageCount.textContent = '?';
        setStatus(`⚠️ Loaded but could not read page count`, 'info');
    }
}

/**
 * Setup split button
 */
function setupSplitButton() {
    elements.splitBtn.addEventListener('click', performSplit);
}

/**
 * Perform split
 */
async function performSplit() {
    if (!currentFile) {
        setStatus('Please upload a PDF first', 'error');
        return;
    }
    
    const ranges = elements.pageRanges.value.trim();
    if (!ranges) {
        setStatus('Please enter page ranges (e.g., 1-3, 5, 7-9)', 'error');
        return;
    }
    
    elements.splitBtn.disabled = true;
    elements.splitBtn.innerHTML = '⏳ Splitting...';
    setStatus('⏳ Processing PDF...', 'info');
    
    try {
        await loadPDFLibrary();
        if (!PDFDocument) throw new Error('PDF library unavailable');
        
        const arrayBuffer = await currentFile.arrayBuffer();
        const sourcePdf = await PDFDocument.load(arrayBuffer);
        const totalPages = sourcePdf.getPageCount();
        
        // Parse ranges
        const rangesArray = parseRanges(ranges, totalPages);
        if (rangesArray.length === 0) {
            setStatus('⚠️ No valid page ranges found', 'error');
            return;
        }
        
        // Create a new PDF for each range
        const fileName = currentFile.name.replace('.pdf', '');
        
        if (rangesArray.length === 1) {
            // Single range - create one PDF
            const [start, end] = rangesArray[0];
            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(sourcePdf, getPageIndices(start, end));
            pages.forEach(p => newPdf.addPage(p));
            const bytes = await newPdf.save();
            downloadPDF(bytes, `${fileName}_pages-${start}-${end}.pdf`);
            setStatus(`✅ Created 1 PDF (pages ${start}-${end})`, 'success');
        } else {
            // Multiple ranges - create multiple PDFs and download as ZIP
            const pdfBlobs = [];
            for (let i = 0; i < rangesArray.length; i++) {
                const [start, end] = rangesArray[i];
                const newPdf = await PDFDocument.create();
                const pages = await newPdf.copyPages(sourcePdf, getPageIndices(start, end));
                pages.forEach(p => newPdf.addPage(p));
                const bytes = await newPdf.save();
                pdfBlobs.push({
                    name: `${fileName}_part${i+1}_pages-${start}-${end}.pdf`,
                    blob: new Blob([bytes], { type: 'application/pdf' })
                });
            }
            
            // Download all
            if (pdfBlobs.length === 1) {
                downloadBlob(pdfBlobs[0].blob, pdfBlobs[0].name);
            } else {
                // Download each file individually (simple approach)
                for (const item of pdfBlobs) {
                    downloadBlob(item.blob, item.name);
                }
                setStatus(`✅ ${pdfBlobs.length} PDFs created and downloaded`, 'success');
            }
        }
        
    } catch (err) {
        console.error('Split error:', err);
        setStatus(`❌ Split failed: ${err.message}`, 'error');
    } finally {
        elements.splitBtn.disabled = false;
        elements.splitBtn.innerHTML = '✂️ Split PDF';
    }
}

/**
 * Parse page ranges
 */
function parseRanges(input, totalPages) {
    const ranges = [];
    const parts = input.split(',').map(s => s.trim());
    
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end) && start > 0 && end <= totalPages && start <= end) {
                ranges.push([start, end]);
            }
        } else {
            const page = Number(part);
            if (!isNaN(page) && page > 0 && page <= totalPages) {
                ranges.push([page, page]);
            }
        }
    }
    return ranges;
}

/**
 * Get page indices (0-based)
 */
function getPageIndices(start, end) {
    const indices = [];
    for (let i = start; i <= end; i++) {
        indices.push(i - 1); // 0-based for pdf-lib
    }
    return indices;
}

/**
 * Download a PDF blob
 */
function downloadPDF(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    downloadBlob(blob, filename);
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
