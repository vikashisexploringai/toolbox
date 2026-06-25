/**
 * ========================================
 * PDF Rotator Tool
 * Rotate PDF pages by 90°, 180°, or 270°
 * ========================================
 */

let PDFDocument = null;
let degrees = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let currentFile = null;
let currentFileBytes = null;
let elements = {};

/**
 * Get the HTML for the rotator tool
 */
export function getToolHTML() {
    return `
        <div id="rotatorTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                🔄 Rotate PDF pages
            </div>
            
            <div id="rotatorDropZone" style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;cursor:pointer;background:#FEFEFE;transition:all 0.2s;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Drop a PDF here</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">or</span>
                <button id="rotatorBrowseBtn" style="margin:0.5rem 0;padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Files
                </button>
                <input type="file" id="rotatorFileInput" accept=".pdf" style="display:none;">
            </div>
            
            <div id="rotatorFileInfo" style="display:none;margin-top:0.5rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="rotatorFileName" style="font-weight:600;">file.pdf</span> — 
                <span id="rotatorFileSize">0 KB</span>
                <span style="margin-left:1rem;font-size:0.8rem;color:#64748B;">Pages: <span id="rotatorPageCount">0</span></span>
            </div>
            
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Rotation Options</label>
                <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.5rem;">
                    <button id="rotateCCWBtn" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↺ 90° CCW
                    </button>
                    <button id="rotateCWBtn" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↻ 90° CW
                    </button>
                    <button id="rotate180Btn" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↻ 180°
                    </button>
                </div>
            </div>
            
            <div id="rotationPreview" style="display:none;margin-top:1rem;padding:0.75rem;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.9rem;">
                    <span><strong>Rotation:</strong> <span id="rotationDisplay">0°</span></span>
                    <span><strong>Pages:</strong> <span id="rotationPageDisplay">All</span></span>
                </div>
            </div>
            
            <div id="rotatorStatus" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                📄 Upload a PDF to rotate
            </div>
        </div>
    `;
}

/**
 * Initialize the PDF Rotator tool
 */
export function initTool() {
    elements = {
        dropZone: document.getElementById('rotatorDropZone'),
        fileInput: document.getElementById('rotatorFileInput'),
        browseBtn: document.getElementById('rotatorBrowseBtn'),
        fileInfo: document.getElementById('rotatorFileInfo'),
        fileName: document.getElementById('rotatorFileName'),
        fileSize: document.getElementById('rotatorFileSize'),
        pageCount: document.getElementById('rotatorPageCount'),
        rotateCWBtn: document.getElementById('rotateCWBtn'),
        rotateCCWBtn: document.getElementById('rotateCCWBtn'),
        rotate180Btn: document.getElementById('rotate180Btn'),
        rotationDisplay: document.getElementById('rotationDisplay'),
        rotationPageDisplay: document.getElementById('rotationPageDisplay'),
        preview: document.getElementById('rotationPreview'),
        status: document.getElementById('rotatorStatus')
    };
    
    currentFile = null;
    currentFileBytes = null;
    
    setupDragAndDrop();
    setupButtons();
    
    // Preload PDF library
    loadPDFLibrary().catch(e => console.warn('PDF library background load:', e));
    
    setStatus('📄 Upload a PDF to rotate', 'info');
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
            degrees = window.PDFLib.degrees;
            pdfLibLoaded = true;
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        script.onload = () => {
            if (window.PDFLib) {
                PDFDocument = window.PDFLib.PDFDocument;
                degrees = window.PDFLib.degrees;
                pdfLibLoaded = true;
                resolve();
            } else {
                reject(new Error('PDF-Lib failed to initialize'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load PDF library'));
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
    
    if (elements.browseBtn) {
        elements.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.fileInput.click();
        });
    }
    
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
    currentFileBytes = await file.arrayBuffer();
    
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    elements.fileInfo.style.display = 'block';
    
    try {
        await loadPDFLibrary();
        const srcDoc = await PDFDocument.load(currentFileBytes);
        const pageCount = srcDoc.getPageCount();
        elements.pageCount.textContent = pageCount;
        elements.rotationPageDisplay.textContent = pageCount + ' pages';
        elements.preview.style.display = 'block';
        elements.rotateCWBtn.disabled = false;
        elements.rotateCCWBtn.disabled = false;
        elements.rotate180Btn.disabled = false;
        setStatus(`✅ Loaded "${file.name}" — ${pageCount} pages. Select rotation angle.`, 'success');
    } catch (err) {
        elements.pageCount.textContent = '?';
        setStatus(`⚠️ Could not read PDF: ${err.message}`, 'error');
    }
}

/**
 * Setup rotation buttons
 */
function setupButtons() {
    elements.rotateCWBtn.addEventListener('click', () => rotatePdf(-90));
    elements.rotateCCWBtn.addEventListener('click', () => rotatePdf(90));
    elements.rotate180Btn.addEventListener('click', () => rotatePdf(180));
    
    // Initially disabled
    elements.rotateCWBtn.disabled = true;
    elements.rotateCCWBtn.disabled = true;
    elements.rotate180Btn.disabled = true;
}

/**
 * ⭐ THE WORKING APPROACH - Using embedPages() + drawPage()
 * This is what the working code uses
 */
async function rotatePdf(angle) {
    if (!currentFileBytes) {
        setStatus('Please upload a PDF first', 'error');
        return;
    }
    
    // Disable buttons
    elements.rotateCWBtn.disabled = true;
    elements.rotateCCWBtn.disabled = true;
    elements.rotate180Btn.disabled = true;
    elements.rotateCWBtn.textContent = '⏳ Processing...';
    elements.rotateCCWBtn.textContent = '⏳ Processing...';
    elements.rotate180Btn.textContent = '⏳ Processing...';
    
    setStatus('⏳ Rotating PDF...', 'info');
    
    try {
        await loadPDFLibrary();
        if (!PDFDocument) throw new Error('PDF library unavailable');
        
        const srcDoc = await PDFDocument.load(currentFileBytes);
        const outDoc = await PDFDocument.create();
        
        const indices = srcDoc.getPageIndices();
        const embeddedPages = await outDoc.embedPages(srcDoc.getPages());
        
        // Normalize angle to 0-360 range (positive = counterclockwise)
        const norm = ((angle % 360) + 360) % 360;
        
        // Display name for status
        let angleName = '';
        if (norm === 90) angleName = '90° CCW';
        else if (norm === 270) angleName = '90° CW';
        else if (norm === 180) angleName = '180°';
        
        let displayAngle = norm;
        if (displayAngle === 270) displayAngle = -90;
        
        indices.forEach((_, i) => {
            const embedded = embeddedPages[i];
            const { width, height } = embedded;
            
            // Swap dimensions for 90° and 270° rotations
            const swap = (Math.abs(angle) % 180) === 90;
            const newWidth = swap ? height : width;
            const newHeight = swap ? width : height;
            
            const page = outDoc.addPage([newWidth, newHeight]);
            
            // Calculate translation so all 4 corners fit in the new page
            let x = 0, y = 0;
            if (norm === 90) { 
                // CCW: rotate 90° counterclockwise
                x = height; 
                y = 0; 
            } else if (norm === 270) { 
                // CW: rotate 90° clockwise
                x = 0; 
                y = width; 
            } else if (norm === 180) { 
                // 180° rotation
                x = width; 
                y = height; 
            }
            
            page.drawPage(embedded, {
                x: x,
                y: y,
                rotate: degrees(norm),
            });
        });
        
        const outBytes = await outDoc.save();
        
        // Download
        const fileName = currentFile.name.replace(/\.pdf$/i, `_rotated_${displayAngle}deg.pdf`);
        downloadBlob(outBytes, fileName);
        
        setStatus(`✅ Rotated ${indices.length} pages by ${angleName} — download started`, 'success');
        
    } catch (err) {
        console.error('Rotation error:', err);
        setStatus(`❌ Rotation failed: ${err.message}`, 'error');
    } finally {
        // Re-enable buttons
        elements.rotateCWBtn.disabled = false;
        elements.rotateCCWBtn.disabled = false;
        elements.rotate180Btn.disabled = false;
        elements.rotateCWBtn.textContent = '↻ 90° CW';
        elements.rotateCCWBtn.textContent = '↺ 90° CCW';
        elements.rotate180Btn.textContent = '↻ 180°';
    }
}

/**
 * Download a blob
 */
function downloadBlob(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
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
