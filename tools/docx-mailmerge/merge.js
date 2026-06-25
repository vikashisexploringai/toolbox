/**
 * ========================================
 * Docx Mail Merge Tool
 * Generate multiple .docx files from Excel data using a .docx template
 * ========================================
 */

let docxArrayBuffer = null;
let docxKeys = [];
let rows = [];
let headers = [];
let elements = {};

/**
 * Get the HTML for the mail merge tool
 */
export function getToolHTML() {
    return `
        <div id="docxMailMergeTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📧 Docx Mail Merge
            </div>
            
            <p style="font-size:0.85rem;color:#64748B;margin-bottom:1rem;">
                Upload a .docx template with <code style="background:#EEF2FF;padding:0.1rem 0.4rem;border-radius:4px;">{{placeholder}}</code> tokens,
                and an Excel file where each column header matches a placeholder. Each row generates one document.
            </p>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:1.5rem;background:#FEFEFE;margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">1. Word Template (.docx)</label>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <button id="docxBrowseBtn" style="padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        📁 Browse Template
                    </button>
                    <span id="docxFileName" style="font-size:0.85rem;color:#64748B;">No file selected</span>
                    <input type="file" id="docxFileInput" accept=".docx" style="display:none;">
                </div>
                <div id="docxStatus" style="margin-top:0.5rem;font-size:0.85rem;color:#64748B;"></div>
                <div id="templateDownloadContainer" style="display:none;margin-top:0.5rem;">
                    <a id="templateDownloadLink" style="display:inline-block;padding:0.4rem 1rem;background:#378ADD;color:white;text-decoration:none;border-radius:6px;font-size:0.85rem;cursor:pointer;">
                        ⬇️ Download Excel Template
                    </a>
                    <p id="templateMsg" style="font-size:0.8rem;color:#b58b00;margin-top:0.3rem;"></p>
                </div>
            </div>
            
            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:1.5rem;background:#FEFEFE;margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">2. Excel Data (.xlsx)</label>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <button id="xlsxBrowseBtn" disabled style="padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#CBD5E1;color:#64748B;font-weight:600;cursor:not-allowed;transition:all 0.2s;">
                        📁 Browse Data
                    </button>
                    <span id="xlsxFileName" style="font-size:0.85rem;color:#64748B;">Upload template first</span>
                    <input type="file" id="xlsxFileInput" accept=".xlsx,.xls" style="display:none;">
                </div>
                <div id="xlsxStatus" style="margin-top:0.5rem;font-size:0.85rem;color:#64748B;"></div>
                <div id="previewContainer" style="margin-top:0.5rem;overflow-x:auto;"></div>
            </div>
            
            <div style="margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">3. Filename Pattern</label>
                <input type="text" id="filenamePattern" placeholder="e.g. {{Name}}_{{Division}}.docx" style="width:100%;padding:0.6rem 0.8rem;border:1px solid #E2E8F0;border-radius:8px;font-size:0.9rem;box-sizing:border-box;">
                <div style="font-size:0.75rem;color:#64748B;margin-top:0.3rem;">💡 Use any column header in curly braces, e.g. <code>{{Name}}</code></div>
            </div>
            
            <button id="generateBtn" disabled style="width:100%;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📦 Generate Documents (.zip)
            </button>
            
            <div id="status" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;white-space:pre-line;">
                📤 Upload a .docx template to begin
            </div>
            
            <div id="downloadContainer" style="display:none;margin-top:0.75rem;text-align:center;">
                <a id="downloadLink" style="display:inline-block;padding:0.6rem 1.5rem;background:#10B981;color:white;text-decoration:none;border-radius:8px;font-weight:600;cursor:pointer;">
                    ⬇️ Download generated_documents.zip
                </a>
            </div>
        </div>
    `;
}

/**
 * Initialize the Docx Mail Merge tool
 */
export function initTool() {
    elements = {
        docxFileInput: document.getElementById('docxFileInput'),
        docxBrowseBtn: document.getElementById('docxBrowseBtn'),
        docxFileName: document.getElementById('docxFileName'),
        docxStatus: document.getElementById('docxStatus'),
        templateDownloadContainer: document.getElementById('templateDownloadContainer'),
        templateDownloadLink: document.getElementById('templateDownloadLink'),
        templateMsg: document.getElementById('templateMsg'),
        xlsxFileInput: document.getElementById('xlsxFileInput'),
        xlsxBrowseBtn: document.getElementById('xlsxBrowseBtn'),
        xlsxFileName: document.getElementById('xlsxFileName'),
        xlsxStatus: document.getElementById('xlsxStatus'),
        previewContainer: document.getElementById('previewContainer'),
        filenamePattern: document.getElementById('filenamePattern'),
        generateBtn: document.getElementById('generateBtn'),
        status: document.getElementById('status'),
        downloadContainer: document.getElementById('downloadContainer'),
        downloadLink: document.getElementById('downloadLink')
    };
    
    docxArrayBuffer = null;
    docxKeys = [];
    rows = [];
    headers = [];
    
    setupDocxInput();
    setupXlsxInput();
    setupGenerateButton();
    
    // Load libraries
    loadJSZip().catch(e => console.warn('JSZip background load:', e));
    loadXLSX().catch(e => console.warn('XLSX background load:', e));
    
    setStatus('📤 Upload a .docx template to begin', 'info');
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
            if (window.JSZip) resolve();
            else reject(new Error('JSZip failed to load'));
        };
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

/**
 * Load XLSX library
 */
function loadXLSX() {
    return new Promise((resolve, reject) => {
        if (window.XLSX) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => {
            if (window.XLSX) resolve();
            else reject(new Error('XLSX failed to load'));
        };
        script.onerror = () => reject(new Error('Failed to load XLSX'));
        document.head.appendChild(script);
    });
}

/**
 * Setup DOCX input
 */
function setupDocxInput() {
    // Clean up old listeners
    if (elements.docxBrowseBtn) {
        const freshBtn = elements.docxBrowseBtn.cloneNode(true);
        elements.docxBrowseBtn.replaceWith(freshBtn);
        elements.docxBrowseBtn = freshBtn;
    }
    if (elements.docxFileInput) {
        const freshInput = elements.docxFileInput.cloneNode(true);
        elements.docxFileInput.replaceWith(freshInput);
        elements.docxFileInput = freshInput;
    }

    elements.docxBrowseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.docxFileInput.click();
    });

    elements.docxFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length) {
            const file = e.target.files[0];
            if (file.name.toLowerCase().endsWith('.docx')) {
                await handleDocx(file);
            } else {
                setStatus('Please select a .docx file', 'error');
            }
        }
        elements.docxFileInput.value = '';
    });
}

/**
 * Handle DOCX upload
 */
async function handleDocx(file) {
    docxArrayBuffer = await file.arrayBuffer();
    elements.docxFileName.textContent = file.name;
    elements.docxFileName.style.color = '#065F46';
    elements.docxStatus.textContent = '⏳ Scanning placeholders...';
    elements.docxStatus.style.color = '#64748B';
    elements.templateDownloadContainer.style.display = 'none';
    elements.templateMsg.textContent = '';
    
    // ✅ Disable data browse button until template is downloaded
    elements.xlsxBrowseBtn.disabled = true;
    elements.xlsxBrowseBtn.style.background = '#CBD5E1';
    elements.xlsxBrowseBtn.style.color = '#64748B';
    elements.xlsxBrowseBtn.style.cursor = 'not-allowed';
    elements.xlsxFileName.textContent = 'Download template first';
    elements.xlsxFileName.style.color = '#64748B';
    elements.xlsxStatus.textContent = '';
    elements.previewContainer.innerHTML = '';
    rows = [];
    headers = [];
    checkReady();

    try {
        await loadJSZip();
        const zip = await JSZip.loadAsync(docxArrayBuffer);
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            elements.docxStatus.textContent = '❌ Could not find word/document.xml — is this a valid .docx?';
            elements.docxStatus.style.color = '#991B1B';
            docxArrayBuffer = null;
            checkReady();
            return;
        }
        const xml = await docFile.async('string');
        const normalized = dewordify(xml);
        docxKeys = extractKeys(normalized);

        if (docxKeys.length === 0) {
            elements.docxStatus.textContent = '❌ No {{placeholders}} found in this template.';
            elements.docxStatus.style.color = '#991B1B';
            checkReady();
            return;
        }

        elements.docxStatus.textContent = '✅ Found placeholders: ' + docxKeys.map(k => '{{' + k + '}}').join(', ');
        elements.docxStatus.style.color = '#065F46';

        // Build Excel template
        await loadXLSX();
        const exampleRow = {};
        docxKeys.forEach(k => { exampleRow[k] = ''; });
        const ws = XLSX.utils.json_to_sheet([exampleRow], { header: docxKeys });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        const wbArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const templateBlob = new Blob([wbArrayBuffer], { type: 'application/octet-stream' });
        const templateUrl = URL.createObjectURL(templateBlob);

        elements.templateDownloadLink.href = templateUrl;
        elements.templateDownloadLink.download = 'data_template.xlsx';
        elements.templateDownloadContainer.style.display = 'block';
        elements.templateMsg.textContent = '📝 Click the button above to download the template, fill it with data, then upload it below.';
        elements.templateMsg.style.color = '#b58b00';

        // ✅ Data browse button stays disabled until template download is clicked
        // The click listener on templateDownloadLink will enable it

        setStatus('✅ Template loaded. Click "Download Excel Template", fill it, then upload.', 'success');
        checkReady();
    } catch (err) {
        elements.docxStatus.textContent = '❌ Error reading template: ' + err.message;
        elements.docxStatus.style.color = '#991B1B';
        docxArrayBuffer = null;
        checkReady();
    }
}

/**
 * Setup XLSX input
 */
function setupXlsxInput() {
    if (elements.xlsxBrowseBtn) {
        const freshBtn = elements.xlsxBrowseBtn.cloneNode(true);
        elements.xlsxBrowseBtn.replaceWith(freshBtn);
        elements.xlsxBrowseBtn = freshBtn;
    }
    if (elements.xlsxFileInput) {
        const freshInput = elements.xlsxFileInput.cloneNode(true);
        elements.xlsxFileInput.replaceWith(freshInput);
        elements.xlsxFileInput = freshInput;
    }

    elements.xlsxBrowseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!elements.xlsxBrowseBtn.disabled) {
            elements.xlsxFileInput.click();
        }
    });

    elements.xlsxFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length) {
            const file = e.target.files[0];
            await handleXlsx(file);
        }
        elements.xlsxFileInput.value = '';
    });
}

/**
 * ✅ FIX: Enable data browse ONLY when template download link is clicked
 */
function setupTemplateDownloadListener() {
    // Remove old listener if exists
    if (elements.templateDownloadLink._listener) {
        elements.templateDownloadLink.removeEventListener('click', elements.templateDownloadLink._listener);
    }
    
    const handler = () => {
        // Enable the data browse button
        elements.xlsxBrowseBtn.disabled = false;
        elements.xlsxBrowseBtn.style.background = '#4F46E5';
        elements.xlsxBrowseBtn.style.color = 'white';
        elements.xlsxBrowseBtn.style.cursor = 'pointer';
        elements.xlsxFileName.textContent = 'Ready for data file';
        elements.xlsxFileName.style.color = '#4F46E5';
        elements.templateMsg.textContent = '✅ Template downloaded — fill it in, then upload it below.';
        elements.templateMsg.style.color = '#065F46';
        
        // Remove the listener after first click so it doesn't fire multiple times
        elements.templateDownloadLink.removeEventListener('click', handler);
    };
    
    elements.templateDownloadLink._listener = handler;
    elements.templateDownloadLink.addEventListener('click', handler);
}

/**
 * Handle XLSX upload
 */
async function handleXlsx(file) {
    elements.xlsxStatus.textContent = '⏳ Reading spreadsheet...';
    elements.xlsxStatus.style.color = '#64748B';
    elements.previewContainer.innerHTML = '';
    rows = [];
    headers = [];

    try {
        await loadXLSX();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
            elements.xlsxStatus.textContent = '❌ No data rows found in the first sheet.';
            elements.xlsxStatus.style.color = '#991B1B';
            checkReady();
            return;
        }

        rows = json;
        headers = Object.keys(json[0]);

        elements.xlsxStatus.textContent = '✅ Loaded ' + rows.length + ' row(s) from "' + firstSheetName + '". Columns: ' + headers.join(', ');
        elements.xlsxStatus.style.color = '#065F46';

        // Preview table (first 5 rows)
        const previewRows = rows.slice(0, 5);
        let html = '<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:0.8rem;width:100%;">';
        html += '<tr>' + headers.map(h => '<th style="border:1px solid #E2E8F0;padding:4px 8px;background:#F1F5F9;text-align:left;white-space:nowrap;">' + escapeHtml(h) + '</th>').join('') + '</tr>';
        previewRows.forEach(r => {
            html += '<tr>' + headers.map(h => '<td style="border:1px solid #E2E8F0;padding:4px 8px;white-space:nowrap;">' + escapeHtml(String(r[h])) + '</td>').join('') + '</tr>';
        });
        html += '</table></div>';
        if (rows.length > 5) html += '<p style="font-size:0.75rem;color:#64748B;margin-top:0.3rem;">Showing first 5 of ' + rows.length + ' rows.</p>';
        elements.previewContainer.innerHTML = html;

        // Check for missing columns
        const missingCols = docxKeys.filter(k => !headers.includes(k));
        if (missingCols.length > 0) {
            setStatus('⚠️ Warning: missing columns for: ' + missingCols.join(', ') + '. They will be left blank.', 'info');
        } else {
            setStatus('✅ Data loaded! ' + rows.length + ' rows ready.', 'success');
        }

        elements.xlsxFileName.textContent = file.name;
        elements.xlsxFileName.style.color = '#065F46';
        checkReady();
    } catch (err) {
        elements.xlsxStatus.textContent = '❌ Error reading spreadsheet: ' + err.message;
        elements.xlsxStatus.style.color = '#991B1B';
        checkReady();
    }
}

/**
 * Check if ready to generate
 */
function checkReady() {
    const ready = !!(docxArrayBuffer && rows.length > 0);
    elements.generateBtn.disabled = !ready;
    if (!ready) {
        if (!docxArrayBuffer) {
            elements.generateBtn.textContent = '📄 Upload template first';
        } else if (rows.length === 0) {
            elements.generateBtn.textContent = '📊 Upload data file';
        }
    } else {
        elements.generateBtn.textContent = '📦 Generate Documents (.zip)';
    }
}

/**
 * Setup generate button
 */
function setupGenerateButton() {
    elements.generateBtn.addEventListener('click', generateDocuments);
}

/**
 * Generate documents
 */
async function generateDocuments() {
    if (!docxArrayBuffer || rows.length === 0) {
        setStatus('Please upload both template and data files', 'error');
        return;
    }

    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = '⏳ Generating...';
    elements.downloadContainer.style.display = 'none';
    setStatus('⏳ Generating ' + rows.length + ' document(s)...', 'info');

    try {
        await loadJSZip();
        const outZip = new JSZip();
        const usedNames = new Set();
        const pattern = elements.filenamePattern.value.trim();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            const docZip = await JSZip.loadAsync(docxArrayBuffer);
            const docXmlPath = 'word/document.xml';
            const xml = await docZip.file(docXmlPath).async('string');
            let normalized = dewordify(xml);

            docxKeys.forEach((key) => {
                const value = headers.includes(key) ? row[key] : '';
                const re = new RegExp('\\{\\{' + escapeRegex(key) + '\\}\\}', 'g');
                normalized = normalized.replace(re, escapeXml(value));
            });

            docZip.file(docXmlPath, normalized);
            const outBlob = await docZip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            let filename;
            if (pattern) {
                filename = pattern;
                headers.forEach((h) => {
                    const re = new RegExp('\\{\\{' + escapeRegex(h) + '\\}\\}', 'g');
                    filename = filename.replace(re, String(row[h]));
                });
                filename = sanitizeFilename(filename);
                if (!filename.toLowerCase().endsWith('.docx')) filename += '.docx';
            } else {
                filename = 'document_' + (i + 1) + '.docx';
            }

            let finalName = filename;
            let counter = 2;
            while (usedNames.has(finalName)) {
                finalName = filename.replace(/\.docx$/i, '') + '_' + counter + '.docx';
                counter++;
            }
            usedNames.add(finalName);

            outZip.file(finalName, outBlob);

            if ((i + 1) % 5 === 0 || i === rows.length - 1) {
                setStatus('⏳ Generating ' + (i + 1) + '/' + rows.length + ' documents...', 'info');
            }
        }

        const zipBlob = await outZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        elements.downloadLink.href = url;
        elements.downloadLink.download = 'generated_documents.zip';
        elements.downloadContainer.style.display = 'block';

        setStatus('✅ Done! Generated ' + rows.length + ' document(s). Click the download button below.', 'success');

    } catch (err) {
        console.error('Generation error:', err);
        setStatus('❌ Error: ' + err.message, 'error');
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = '📦 Generate Documents (.zip)';
    }
}

/**
 * Utility functions
 */
function dewordify(xmlStr) {
    const pattern = /\{\{\s*(?:<[^>]+>\s*)*([a-zA-Z0-9_ ]+?)\s*(?:<[^>]+>\s*)*\}\}/g;
    return xmlStr.replace(pattern, (match, key) => '{{' + key.trim() + '}}');
}

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

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
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
