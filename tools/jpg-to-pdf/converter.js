/**
 * ========================================
 * JPG to PDF Converter Tool
 * Convert multiple JPG images to a single PDF
 * ========================================
 */

let PDFDocument = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let imageFiles = [];
let elements = {};
let statusTimeout = null;

/**
 * Get the HTML for the JPG to PDF converter
 */
export function getToolHTML() {
    return `
        <div id="jpgToPdfTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📄 Convert JPG images to PDF
            </div>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;background:#FEFEFE;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Select JPG images</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">Click the button below to browse</span><br>
                <button id="browseBtn" style="margin:0.75rem 0;padding:0.6rem 2rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Images
                </button>
                <input type="file" id="fileInput" multiple accept="image/jpeg,image/jpg,image/png" style="display:none;">
            </div>
            
            <div id="fileList" style="background:#FAFCFF;border-radius:1.25rem;padding:0.65rem;margin:1rem 0;max-height:300px;overflow-y:auto;border:1px solid #EEF2F6;">
                <div id="emptyMessage" style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">🖼️ No images selected — click Browse to add files</div>
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
                        🖼️ <span id="fileCounter">0</span> image(s)
                    </span>
                </div>
            </div>
            
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">PDF Page Size</label>
                <select id="pageSize" style="width:100%;padding:0.7rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;background:white;">
                    <option value="fit">Fit to image (auto)</option>
                    <option value="a4" selected>A4 (210 × 297 mm)</option>
                    <option value="letter">Letter (8.5 × 11 in)</option>
                    <option value="legal">Legal (8.5 × 14 in)</option>
                </select>
            </div>
            
            <button id="convertBtn" disabled style="width:100%;margin-top:1rem;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📄 Convert to PDF
            </button>
            
            <div id="status" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                🖼️ Select JPG images to convert to PDF
            </div>
        </div>
    `;
}

/**
 * Initialize the JPG to PDF converter
 */
export function initTool() {
    elements = {
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        fileList: document.getElementById('fileList'),
        emptyMessage: document.getElementById('emptyMessage'),
        convertBtn: document.getElementById('convertBtn'),
        reverseOrderBtn: document.getElementById('reverseOrderBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        fileCounter: document.getElementById('fileCounter'),
        pageSize: document.getElementById('pageSize'),
        status: document.getElementById('status')
    };
    
    imageFiles = [];
    
    setupFileInput();
    setupButtons();
    renderFileList();
    
    loadPDFLibrary().catch(e => console.warn('PDF library background load:', e));
    
    setStatus('🖼️ Select JPG images to convert to PDF', 'info');
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
 * Setup file input
 */
function setupFileInput() {
    // Clean up old listeners
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

    // Browse button
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
            const imageOnly = selected.filter(f => 
                f.type.startsWith('image/') || 
                f.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)
            );
            if (imageOnly.length) addFiles(imageOnly);
            else setStatus('No valid image files selected', 'error');
        }
        elements.fileInput.value = '';
    });
}

/**
 * Add files
 */
function addFiles(newFiles) {
    let addedCount = 0;
    for (const file of newFiles) {
        const isDuplicate = imageFiles.some(existing => 
            existing.name === file.name && existing.size === file.size
        );
        if (isDuplicate) {
            setStatus(`⚠️ "${file.name}" already in list`, false);
            continue;
        }
        imageFiles.push(file);
        addedCount++;
    }
    if (addedCount > 0) {
        renderFileList();
        setStatus(`✅ Added ${addedCount} image(s)`, false, true);
        elements.convertBtn.disabled = false;
    }
}

/**
 * Setup buttons
 */
function setupButtons() {
    elements.convertBtn.addEventListener('click', convertToPdf);
    elements.reverseOrderBtn.addEventListener('click', reverseSequence);
    elements.clearAllBtn.addEventListener('click', clearAllFiles);
}

/**
 * Render file list
 */
function renderFileList() {
    if (!elements.fileList) return;
    
    if (imageFiles.length === 0) {
        elements.fileList.innerHTML = '<div style="text-align:center;color:#6C757D;padding:2rem;font-style:italic;">🖼️ No images selected — click Browse to add files</div>';
        updateCounter();
        elements.convertBtn.disabled = true;
        return;
    }
    
    let html = '';
    imageFiles.forEach((file, idx) => {
        const sizeKB = (file.size / 1024).toFixed(1);
        const safeName = escapeHtml(file.name);
        // Get file extension for icon
        const ext = file.name.split('.').pop().toLowerCase();
        const icon = ext === 'png' ? '🖼️' : '📷';
        html += `
            <div style="background:white;padding:0.7rem 1rem;margin:0.6rem 0;border-radius:1rem;display:flex;justify-content:space-between;align-items:center;border:1px solid #E2E8F0;transition:all 0.15s;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;word-break:break-word;max-width:55%;">
                    <span style="font-weight:500;font-size:0.9rem;background:#F1F5F9;padding:0.2rem 0.7rem;border-radius:30px;">${icon} ${safeName}</span>
                    <span style="font-size:0.7rem;color:#4B5563;background:#F8FAFC;padding:0.2rem 0.6rem;border-radius:30px;">${sizeKB} KB</span>
                    <span style="font-size:0.7rem;background:#F1F3F8;padding:2px 8px;border-radius:30px;">#${idx+1}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="move-up" data-index="${idx}" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} style="background:#F1F4F9;border:none;width:34px;height:34px;border-radius:30px;font-weight:700;font-size:1rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:0.1s;color:#2C3E66;">↑</button>
                    <button class="move-down" data-index="${idx}" ${idx === imageFiles.length-1 ? 'disabled style="opacity:0.4;"' : ''} style="background:#F1F4F9;border:none;width:34px;height:34px;border-radius:30px;font-weight:700;font-size:1rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:0.1s;color:#2C3E66;">↓</button>
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
            if (!isNaN(idx) && idx < imageFiles.length - 1) moveFileDown(idx);
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

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function updateCounter() {
    if (elements.fileCounter) {
        elements.fileCounter.innerText = imageFiles.length;
    }
    elements.convertBtn.disabled = (imageFiles.length === 0);
}

function moveFileUp(idx) {
    if (idx <= 0) return;
    [imageFiles[idx - 1], imageFiles[idx]] = [imageFiles[idx], imageFiles[idx - 1]];
    renderFileList();
    setStatus(`⬆️ Moved "${imageFiles[idx-1]?.name || 'file'}" up`, false, true);
}

function moveFileDown(idx) {
    if (idx >= imageFiles.length - 1) return;
    [imageFiles[idx + 1], imageFiles[idx]] = [imageFiles[idx], imageFiles[idx + 1]];
    renderFileList();
    setStatus(`⬇️ Moved "${imageFiles[idx+1]?.name || 'file'}" down`, false, true);
}

function removeFileAtIndex(idx) {
    const removedName = imageFiles[idx]?.name || 'image';
    imageFiles.splice(idx, 1);
    renderFileList();
    setStatus(`🗑️ Removed "${removedName}"`, false);
    if (imageFiles.length === 0) setStatus('All images cleared. Add new files.', false);
}

function clearAllFiles() {
    if (imageFiles.length === 0) {
        setStatus('No files to clear', false);
        return;
    }
    imageFiles = [];
    renderFileList();
    setStatus('🧹 Cleared all images', false, true);
}

function reverseSequence() {
    if (imageFiles.length <= 1) {
        setStatus('↺ Reverse: need at least 2 images to reverse order', false);
        return;
    }
    imageFiles.reverse();
    renderFileList();
    setStatus('🔄 Sequence reversed!', false, true);
}

/**
 * Convert images to PDF
 */
async function convertToPdf() {
    if (imageFiles.length === 0) {
        setStatus('Please add images first', 'error');
        return;
    }
    
    elements.convertBtn.disabled = true;
    elements.convertBtn.textContent = '⏳ Converting...';
    setStatus(`⏳ Processing ${imageFiles.length} images...`, 'info');
    
    try {
        await loadPDFLibrary();
        if (!PDFDocument) throw new Error('PDF library unavailable');
        
        const pdfDoc = await PDFDocument.create();
        const pageSize = elements.pageSize.value;
        
        // Page size presets (in points: 1 pt = 1/72 inch)
        const sizes = {
            a4: { width: 595.28, height: 841.89 },
            letter: { width: 612, height: 792 },
            legal: { width: 612, height: 1008 },
            fit: null // Will fit to image
        };
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const arrayBuffer = await file.arrayBuffer();
            
            // Try to embed as JPG or PNG
            let image;
            try {
                // Try JPG first
                image = await pdfDoc.embedJpg(arrayBuffer);
            } catch (e) {
                try {
                    // Try PNG
                    image = await pdfDoc.embedPng(arrayBuffer);
                } catch (e2) {
                    throw new Error(`Cannot embed image "${file.name}": ${e2.message}`);
                }
            }
            
            const imgWidth = image.width;
            const imgHeight = image.height;
            
            let pageWidth, pageHeight;
            if (pageSize === 'fit') {
                pageWidth = imgWidth;
                pageHeight = imgHeight;
            } else {
                const size = sizes[pageSize];
                pageWidth = size.width;
                pageHeight = size.height;
            }
            
            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            
            // Calculate scaling to fit image within page
            const scaleX = pageWidth / imgWidth;
            const scaleY = pageHeight / imgHeight;
            const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for margin
            
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            const x = (pageWidth - scaledWidth) / 2;
            const y = (pageHeight - scaledHeight) / 2;
            
            page.drawImage(image, {
                x: x,
                y: y,
                width: scaledWidth,
                height: scaledHeight,
            });
            
            setStatus(`⏳ Processing image ${i+1}/${imageFiles.length}: ${file.name}`, 'info');
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        downloadBlob(blob, `converted_${timestamp}_${imageFiles.length}images.pdf`);
        
        setStatus(`✅ Converted ${imageFiles.length} images to PDF — download started`, 'success');
        
    } catch (err) {
        console.error('Conversion error:', err);
        setStatus(`❌ Conversion failed: ${err.message}`, 'error');
    } finally {
        elements.convertBtn.disabled = false;
        elements.convertBtn.textContent = '📄 Convert to PDF';
    }
}

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
