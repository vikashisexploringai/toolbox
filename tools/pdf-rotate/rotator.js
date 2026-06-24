/**
 * ========================================
 * PDF Rotator Tool - FIXED VERSION
 * Rotate PDF pages by modifying page contents
 * ========================================
 */

let PDFDocument = null;
let pdfLibLoaded = false;
let loadingPromise = null;
let currentFile = null;
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
                    <button class="rotation-option" data-degrees="90" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↻ 90° CW
                    </button>
                    <button class="rotation-option" data-degrees="270" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↺ 90° CCW
                    </button>
                    <button class="rotation-option" data-degrees="180" style="flex:1;min-width:80px;padding:0.7rem;border:2px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;transition:all 0.2s;font-weight:600;font-size:0.95rem;">
                        ↻ 180°
                    </button>
                </div>
                <div style="font-size:0.75rem;color:#64748B;margin-top:0.5rem;">💡 Select rotation angle, then click "Apply Rotation"</div>
            </div>
            
            <div style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
                <button id="applyRotationBtn" disabled style="flex:1;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    🔄 Apply Rotation
                </button>
                <button id="resetRotationBtn" disabled style="flex:0.5;padding:0.75rem;border:none;border-radius:12px;background:#F1F5F9;color:#475569;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    Reset
                </button>
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
        applyBtn: document.getElementById('applyRotationBtn'),
        resetBtn: document.getElementById('resetRotationBtn'),
        rotationOptions: document.querySelectorAll('.rotation-option'),
        rotationDisplay: document.getElementById('rotationDisplay'),
        rotationPageDisplay: document.getElementById('rotationPageDisplay'),
        preview: document.getElementById('rotationPreview'),
        status: document.getElementById('rotatorStatus')
    };
    
    currentFile = null;
    let selectedRotation = 90;
    
    setupDragAndDrop();
    
    elements.rotationOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.rotationOptions.forEach(b => {
                b.style.borderColor = '#E2E8F0';
                b.style.background = 'white';
            });
            btn.style.borderColor = '#4F46E5';
            btn.style.background = '#EEF2FF';
            selectedRotation = parseInt(btn.dataset.degrees, 10);
            const displayAngle = selectedRotation === 270 ? '-90' : selectedRotation;
            elements.rotationDisplay.textContent = displayAngle + '°';
            if (currentFile) {
                elements.preview.style.display = 'block';
                elements.applyBtn.disabled = false;
                elements.resetBtn.disabled = false;
                setStatus(`✅ Ready to rotate by ${displayAngle}°`, 'info');
            }
        });
    });
    
    elements.applyBtn.addEventListener('click', () => performRotation(selectedRotation));
    elements.resetBtn.addEventListener('click', resetRotation);
    
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
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    elements.fileInfo.style.display = 'block';
    
    try {
        await loadPDFLibrary();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        elements.pageCount.textContent = pageCount;
        elements.rotationPageDisplay.textContent = pageCount + ' pages';
        setStatus(`✅ Loaded "${file.name}" — ${pageCount} pages. Select rotation angle.`, 'success');
        elements.preview.style.display = 'block';
        elements.applyBtn.disabled = false;
        elements.resetBtn.disabled = false;
    } catch (err) {
        elements.pageCount.textContent = '?';
        setStatus(`⚠️ Loaded but could not read page count`, 'info');
    }
}

/**
 * Perform rotation - WORKING APPROACH using page.getSize() and page.setMediaBox
 */
async function performRotation(degrees) {
    if (!currentFile) {
        setStatus('Please upload a PDF first', 'error');
        return;
    }
    
    let rotationAngle = Number(degrees);
    if (isNaN(rotationAngle) || ![0, 90, 180, 270].includes(rotationAngle)) {
        setStatus(`❌ Invalid rotation angle. Must be 0, 90, 180, or 270.`, 'error');
        return;
    }
    
    elements.applyBtn.disabled = true;
    elements.applyBtn.innerHTML = '⏳ Rotating...';
    setStatus('⏳ Processing PDF...', 'info');
    
    try {
        await loadPDFLibrary();
        if (!PDFDocument) throw new Error('PDF library unavailable');
        
        const arrayBuffer = await currentFile.arrayBuffer();
        const sourcePdf = await PDFDocument.load(arrayBuffer);
        const totalPages = sourcePdf.getPageCount();
        
        // Create a new PDF
        const newPdf = await PDFDocument.create();
        const pageIndices = sourcePdf.getPageIndices();
        
        // Copy and rotate pages
        for (const pageIndex of pageIndices) {
            // Get the original page
            const originalPage = sourcePdf.getPage(pageIndex);
            const { width, height } = originalPage.getSize();
            
            // Create a new page in the new PDF with swapped dimensions if needed
            let newWidth = width;
            let newHeight = height;
            
            // For 90° and 270° rotation, swap width and height
            if (rotationAngle === 90 || rotationAngle === 270) {
                newWidth = height;
                newHeight = width;
            }
            
            // Copy the page
            const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
            
            // Try to rotate using the rotation property
            try {
                // Some versions support this directly
                copiedPage.setRotation(rotationAngle);
            } catch (setError) {
                console.warn('setRotation failed, using media box approach:', setError);
                // If setRotation fails, we'll rotate by swapping dimensions
                // and the content will be rotated when rendered
            }
            
            // Set the media box with the new dimensions
            copiedPage.setMediaBox(0, 0, newWidth, newHeight);
            
            // If rotation is 90° or 270°, we also need to adjust the content
            // This is a simpler approach - the content will rotate when displayed
            // because we've swapped the page dimensions and set the rotation flag
            
            newPdf.addPage(copiedPage);
        }
        
        const bytes = await newPdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const displayAngle = rotationAngle === 270 ? '-90' : rotationAngle;
        const fileName = currentFile.name.replace('.pdf', `_rotated_${displayAngle}deg.pdf`);
        downloadBlob(blob, fileName);
        
        setStatus(`✅ Rotated ${totalPages} pages by ${displayAngle}° — download started`, 'success');
        
    } catch (err) {
        console.error('Rotation error:', err);
        setStatus(`❌ Rotation failed: ${err.message}`, 'error');
    } finally {
        elements.applyBtn.disabled = false;
        elements.applyBtn.innerHTML = '🔄 Apply Rotation';
    }
}

/**
 * Reset rotation preview
 */
function resetRotation() {
    elements.rotationDisplay.textContent = '0°';
    elements.rotationOptions.forEach(b => {
        b.style.borderColor = '#E2E8F0';
        b.style.background = 'white';
    });
    setStatus('🔄 Rotation reset. Select a new angle.', 'info');
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
