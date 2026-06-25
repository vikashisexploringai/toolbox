/**
 * ========================================
 * Docx Placeholder Filler Tool
 * Upload a .docx with {{placeholders}}, fill values, download updated docx
 * ========================================
 */

let uploadedArrayBuffer = null;
let detectedKeys = [];
let elements = {};

/**
 * Get the HTML for the docx filler tool
 */
export function getToolHTML() {
    return `
        <div id="docxFillerTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📝 Docx Placeholder Filler
            </div>
            
            <p style="font-size:0.85rem;color:#64748B;margin-bottom:1rem;">
                Upload a .docx containing <code style="background:#EEF2FF;padding:0.1rem 0.4rem;border-radius:4px;">{{placeholder}}</code> tokens. 
                Fields will be generated automatically based on what's found in the document.
            </p>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:2rem 1.5rem;text-align:center;background:#FEFEFE;margin-bottom:1rem;">
                <strong style="font-size:1.1rem;color:#1F3A6B;">📂 Select a .docx file</strong><br>
                <span style="font-size:0.85rem;color:#64748B;">Click the button below to browse</span><br>
                <button id="browseBtn" style="margin:0.75rem 0;padding:0.6rem 2rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                    📁 Browse Files
                </button>
                <input type="file" id="fileInput" accept=".docx" style="display:none;">
            </div>
            
            <div id="fileInfo" style="display:none;margin-top:0.5rem;padding:0.75rem 1rem;background:#F1F5F9;border-radius:12px;">
                <span id="fileName" style="font-weight:600;">file.docx</span> — 
                <span id="fileSize">0 KB</span>
            </div>
            
            <div id="detectStatus" style="margin-top:0.75rem;padding:0.5rem;border-radius:8px;font-size:0.85rem;color:#64748B;"></div>
            
            <div id="fieldsContainer" style="margin-top:0.5rem;"></div>
            
            <button id="generateBtn" disabled style="width:100%;margin-top:1rem;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📄 Generate Updated Document
            </button>
            
            <div id="status" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;">
                📤 Upload a .docx file with {{placeholders}}
            </div>
            
            <div id="downloadContainer" style="display:none;margin-top:0.75rem;text-align:center;">
                <a id="downloadLink" style="display:inline-block;padding:0.6rem 1.5rem;background:#10B981;color:white;text-decoration:none;border-radius:8px;font-weight:600;cursor:pointer;">
                    ⬇️ Download Updated Document
                </a>
            </div>
        </div>
    `;
}

/**
 * Initialize the Docx Filler tool
 */
export function initTool() {
    elements = {
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        detectStatus: document.getElementById('detectStatus'),
        fieldsContainer: document.getElementById('fieldsContainer'),
        generateBtn: document.getElementById('generateBtn'),
        status: document.getElementById('status'),
        downloadContainer: document.getElementById('downloadContainer'),
        downloadLink: document.getElementById('downloadLink')
    };
    
    uploadedArrayBuffer = null;
    detectedKeys = [];
    
    setupFileInput();
    setupGenerateButton();
    
    // Load JSZip
    loadJSZip().catch(e => console.warn('JSZip background load:', e));
    
    setStatus('📤 Upload a .docx file with {{placeholders}}', 'info');
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
            if (file.name.toLowerCase().endsWith('.docx')) {
                handleFile(file);
            } else {
                setStatus('Please select a .docx file', 'error');
            }
        }
        elements.fileInput.value = '';
    });
}

/**
 * Handle uploaded file
 */
async function handleFile(file) {
    uploadedArrayBuffer = await file.arrayBuffer();
    
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    elements.fileInfo.style.display = 'block';
    elements.downloadContainer.style.display = 'none';
    setStatus('', '');
    elements.generateBtn.disabled = true;
    elements.fieldsContainer.innerHTML = '';
    elements.detectStatus.textContent = '⏳ Scanning for placeholders...';
    elements.detectStatus.style.color = '#64748B';
    
    try {
        await loadJSZip();
        if (!window.JSZip) throw new Error('JSZip not loaded');
        
        const zip = await JSZip.loadAsync(uploadedArrayBuffer);
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            elements.detectStatus.textContent = '❌ Could not find word/document.xml — is this a valid .docx?';
            elements.detectStatus.style.color = '#991B1B';
            return;
        }
        
        const xml = await docFile.async('string');
        const normalized = dewordify(xml);
        detectedKeys = extractKeys(normalized);
        
        if (detectedKeys.length === 0) {
            elements.detectStatus.textContent = '❌ No {{placeholders}} found in this document.';
            elements.detectStatus.style.color = '#991B1B';
            return;
        }
        
        elements.detectStatus.textContent = '✅ Found ' + detectedKeys.length + ' placeholder(s): ' + 
            detectedKeys.map(k => '{{' + k + '}}').join(', ');
        elements.detectStatus.style.color = '#065F46';
        buildFields(detectedKeys);
        elements.generateBtn.disabled = false;
        setStatus('✅ File loaded. Fill in the fields and click Generate.', 'success');
        
    } catch (err) {
        elements.detectStatus.textContent = '❌ Error reading file: ' + err.message;
        elements.detectStatus.style.color = '#991B1B';
        setStatus('❌ Failed to read file: ' + err.message, 'error');
    }
}

/**
 * Removes XML tags that fall between matching {{ and }}
 * Supports spaces in placeholder names (e.g. {{Full Name}})
 */
function dewordify(xmlStr) {
    const pattern = /\{\{\s*(?:<[^>]+>\s*)*([a-zA-Z0-9_ ]+?)\s*(?:<[^>]+>\s*)*\}\}/g;
    return xmlStr.replace(pattern, (match, key) => '{{' + key.trim() + '}}');
}

/**
 * Extract all placeholder keys from normalized XML
 * Supports spaces in placeholder names
 */
function extractKeys(normalizedXml) {
    const keys = [];
    const seen = new Set();
    const re = /\{\{([a-zA-Z0-9_ ]+)\}\}/g;
    let m;
    while ((m = re.exec(normalizedXml)) !== null) {
        const key = m[1].trim();
        if (!seen.has(key)) {
            seen.add(key);
            keys.push(key);
        }
    }
    return keys;
}

/**
 * ✅ NEW: Escape XML special characters
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Build input fields for each detected placeholder
 */
function buildFields(keys) {
    elements.fieldsContainer.innerHTML = '';
    keys.forEach((key) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '0.5rem';
        
        const label = document.createElement('label');
        label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        label.style.display = 'block';
        label.style.fontSize = '0.85rem';
        label.style.fontWeight = '600';
        label.style.color = '#1E293B';
        label.style.marginBottom = '0.2rem';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'field_' + key;
        input.placeholder = 'Value for {{' + key + '}}';
        input.style.width = '100%';
        input.style.padding = '0.6rem 0.8rem';
        input.style.border = '1px solid #E2E8F0';
        input.style.borderRadius = '8px';
        input.style.fontSize = '0.9rem';
        input.style.boxSizing = 'border-box';
        
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        elements.fieldsContainer.appendChild(wrapper);
    });
}

/**
 * Setup generate button
 */
function setupGenerateButton() {
    elements.generateBtn.addEventListener('click', generateDocument);
}

/**
 * Generate updated document
 */
async function generateDocument() {
    if (!uploadedArrayBuffer || detectedKeys.length === 0) {
        setStatus('Please upload a .docx file first', 'error');
        return;
    }
    
    const values = {};
    let missing = [];
    detectedKeys.forEach((key) => {
        const el = document.getElementById('field_' + key);
        const val = el ? el.value.trim() : '';
        if (!val) missing.push(key);
        values[key] = val;
    });
    
    if (missing.length > 0) {
        setStatus('⚠️ Please fill in: ' + missing.join(', '), 'error');
        return;
    }
    
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = '⏳ Processing...';
    elements.downloadContainer.style.display = 'none';
    setStatus('⏳ Generating updated document...', 'info');
    
    try {
        await loadJSZip();
        if (!window.JSZip) throw new Error('JSZip not loaded');
        
        const zip = await JSZip.loadAsync(uploadedArrayBuffer);
        const docXmlPath = 'word/document.xml';
        const docFile = zip.file(docXmlPath);
        let xml = await docFile.async('string');
        
        let normalized = dewordify(xml);
        detectedKeys.forEach((key) => {
            const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp('\\{\\{' + escaped + '\\}\\}', 'g');
            // ✅ NEW: Escape XML special characters in the replacement value
            normalized = normalized.replace(re, escapeXml(values[key]));
        });
        
        zip.file(docXmlPath, normalized);
        const outBlob = await zip.generateAsync({ 
            type: 'blob', 
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        
        const url = URL.createObjectURL(outBlob);
        const fileName = (elements.fileName.textContent || 'document').replace('.docx', '') + '_filled.docx';
        elements.downloadLink.href = url;
        elements.downloadLink.download = fileName;
        elements.downloadContainer.style.display = 'block';
        
        setStatus('✅ Document ready — click the download button below.', 'success');
        
    } catch (err) {
        console.error('Generation error:', err);
        setStatus('❌ Error: ' + err.message, 'error');
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = '📄 Generate Updated Document';
    }
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
