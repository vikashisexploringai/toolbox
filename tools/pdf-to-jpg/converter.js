/**
 * ========================================
 * PDF to JPG Converter Tool
 * Convert PDF pages to JPG images
 * ========================================
 */

let currentFile = null;
let pdfDoc = null;
let elements = {};

/**
 * Get the HTML for the PDF to JPG converter
 */
export function getToolHTML() {
    return `
        <div id="pdfToJpgTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                🖼️ Convert PDF pages to JPG images
            </div>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;background:#FEFEFE;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Select a PDF file</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">Click the button below to browse</span><br>
                <button id="browseBtn" style="margin:0.75rem 0;padding:0.6rem 2rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Files
                </button>
                <input type="file" id="fileInput" accept=".pdf" style="display:none;">
            </div>
            
            <div id="fileInfo" style="display:none;margin-top:0.5rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="fileName" style="font-weight:600;">file.pdf</span> — 
                <span id="fileSize">0 KB</span>
                <span style="margin-left:1rem;font-size:0.8rem;color:#64748B;">Pages: <span id="pageCount">0</span></span>
            </div>
            
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Image Quality</label>
                <select id="imageQuality" style="width:100%;padding:0.7rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;background:white;">
                    <option value="0.5">Low (smaller file)</option>
                    <option value="0.75" selected>Medium (balanced)</option>
                    <option value="0.9">High (better quality)</option>
                    <option value="1.0">Maximum (largest file)</option>
                </select>
            </div>
            
            <div style="margin-top:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">Image Scale</label>
                <select id="imageScale" style="width:100%;padding:0.7rem 1rem;border:1px solid #E2E8F0;border-radius:10px;font-size:0.95rem;background:white;">
                    <option value="0.5">0.5x (small)</option>
                    <option value="0.75">0.75x</option>
                    <option value="1.0" selected>1x (original size)</option>
                    <option value="1.5">1.5x</option>
                    <option value="2.0">2x (large)</option>
                </select>
            </div>
            
            <div style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
                <button id="convertBtn" disabled style="flex:1;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📸 Convert to JPG
                </button>
                <button id="downloadZipBtn" disabled style="flex:0.5;padding:0.75rem;border:none;border-radius:12px;background:#F1F5F9;color:#475569;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📦 Download ZIP
                </button>
            </div>
            
            <div id="previewContainer" style="display:none;margin-top:1rem;padding:0.75rem;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;max-height:400px;overflow-y:auto;">
                <div id="previewGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));gap:0.75rem;"></div>
            </div>
            
            <div id="status" style="margin-top:1rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                📄 Upload a PDF to convert
            </div>
        </div>
    `;
}

/**
 * Initialize the PDF to JPG converter
 */
export function initTool() {
    elements = {
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        pageCount: document.getElementById('pageCount'),
        imageQuality: document.getElementById('imageQuality'),
        imageScale: document.getElementById('imageScale'),
        convertBtn: document.getElementById('convertBtn'),
        downloadZipBtn: document.getElementById('downloadZipBtn'),
        previewContainer: document.getElementById('previewContainer'),
        previewGrid: document.getElementById('previewGrid'),
        status: document.getElementById('status')
    };
    
    currentFile = null;
    pdfDoc = null;
    
    setupFileInput();
    setupButtons();
    
    // Load PDF.js
    loadPDFJS().catch(e => console.warn('PDF.js background load:', e));
    
    setStatus('📄 Upload a PDF to convert to JPG', 'info');
}

/**
 * Load PDF.js library
 */
function loadPDFJS() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            } else {
                reject(new Error('PDF.js failed to load'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
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
        await loadPDFJS();
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;
        elements.pageCount.textContent = pageCount;
        elements.convertBtn.disabled = false;
        elements.downloadZipBtn.disabled = false;
        setStatus(`✅ Loaded "${file.name}" — ${pageCount} pages. Click Convert to JPG.`, 'success');
    } catch (err) {
        elements.pageCount.textContent = '?';
        setStatus(`⚠️ Could not read PDF: ${err.message}`, 'error');
    }
}

/**
 * Setup buttons
 */
function setupButtons() {
    elements.convertBtn.addEventListener('click', convertToJpg);
    elements.downloadZipBtn.addEventListener('click', downloadZip);
}

/**
 * Convert PDF to JPG
 */
async function convertToJpg() {
    if (!pdfDoc) {
        setStatus('Please upload a PDF first', 'error');
        return;
    }
    
    elements.convertBtn.disabled = true;
    elements.convertBtn.textContent = '⏳ Converting...';
    setStatus('⏳ Converting pages to JPG...', 'info');
    
    try {
        const totalPages = pdfDoc.numPages;
        const quality = parseFloat(elements.imageQuality.value);
        const scale = parseFloat(elements.imageScale.value);
        const imageDataUrls = [];
        
        // Clear preview grid
        elements.previewGrid.innerHTML = '';
        elements.previewContainer.style.display = 'block';
        
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            // Convert to JPG
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            imageDataUrls.push(dataUrl);
            
            // Add preview thumbnail
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.width = '100%';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid #E2E8F0';
            img.alt = `Page ${i}`;
            const pageLabel = document.createElement('div');
            pageLabel.textContent = `Page ${i}`;
            pageLabel.style.textAlign = 'center';
            pageLabel.style.fontSize = '0.7rem';
            pageLabel.style.color = '#64748B';
            
            const container = document.createElement('div');
            container.appendChild(img);
            container.appendChild(pageLabel);
            elements.previewGrid.appendChild(container);
            
            setStatus(`⏳ Converting page ${i}/${totalPages}...`, 'info');
        }
        
        // Store images for ZIP download
        window._jpgImages = imageDataUrls;
        
        elements.downloadZipBtn.disabled = false;
        setStatus(`✅ Converted ${totalPages} pages to JPG. Click "Download ZIP" to save all.`, 'success');
        
    } catch (err) {
        console.error('Conversion error:', err);
        setStatus(`❌ Conversion failed: ${err.message}`, 'error');
    } finally {
        elements.convertBtn.disabled = false;
        elements.convertBtn.textContent = '📸 Convert to JPG';
    }
}

/**
 * Download all JPGs as ZIP
 */
async function downloadZip() {
    const images = window._jpgImages;
    if (!images || images.length === 0) {
        setStatus('Please convert to JPG first', 'error');
        return;
    }
    
    // Load JSZip library
    try {
        await loadJSZip();
        
        const zip = new JSZip();
        const fileName = currentFile.name.replace('.pdf', '');
        
        for (let i = 0; i < images.length; i++) {
            const dataUrl = images[i];
            const base64 = dataUrl.split(',')[1];
            zip.file(`${fileName}_page_${i+1}.jpg`, base64, { base64: true });
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${fileName}_images.zip`);
        
        setStatus(`✅ Downloaded ZIP with ${images.length} images`, 'success');
        
    } catch (err) {
        console.error('ZIP error:', err);
        setStatus(`❌ Failed to create ZIP: ${err.message}`, 'error');
    }
}

/**
 * Load JSZip library
 */
function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => {
            if (window.JSZip) {
                resolve();
            } else {
                reject(new Error('JSZip failed to load'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

/**
 * Download blob
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
 * Set status
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
