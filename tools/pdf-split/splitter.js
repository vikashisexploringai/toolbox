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
            
            <div id="splitDropZone" style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;cursor:pointer;background:#FEFEFE;transition:all 0.2s;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Drop a PDF here</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">or</span>
                <button id="splitBrowseBtn" style="margin:0.5rem 0;padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Files
                </button>
                <input type="file" id="splitFileInput" accept=".pdf" style="display:none;">
            </div>
            
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
        browseBtn: document.getElementById('splitBrowseBtn'),
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
    // Drag over
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#EEF4FF';
        elements.dropZone.style.borderColor = '#4F46E5';
        elements.dropZone.style.borderStyle = 'solid';
    });
    
    // Drag leave
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
    });
    
    // Drop
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.style.background = '#FEFEFE';
        elements.dropZone.style.borderColor = '#94A3B8';
        elements.dropZone.style.borderStyle = 'dashed';
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (files.length) handleFile(files[0]);
        else setStatus('No valid PDF file dropped', 'error');
    });
    
    // Browse button - opens file picker (NO double-click issue)
    if (elements.browseBtn) {
        elements.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.fileInput.click();
        });
    }
    
    // File input change
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
            // Multiple ranges - create multiple PDFs
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
        indices.push(i - 1);
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
