/**
 * ========================================
 * GST Return PDF to Excel Converter
 * Convert one or more GST return PDFs (GSTR-1, 3B, 2A/2B, 9, etc.)
 * into Excel files natively in the browser, packaged as a .zip
 * ========================================
 *
 * NOTE ON ACCURACY:
 * Table reconstruction from PDF text is heuristic (position-based
 * clustering), not a guaranteed 1:1 extraction. It works best on
 * clean, text-based (non-scanned) PDFs like those downloaded directly
 * from the GST portal. Always spot-check output before relying on it.
 */

// ---- Tunable heuristics (adjust based on real-world GST PDF testing) ----
const ROW_Y_TOLERANCE = 3;        // px difference to treat two text items as same row
const COLUMN_GAP_THRESHOLD = 12;  // px gap to treat two x-positions as different columns
const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// ---- Return type detection (display label only — does not alter parsing) ----
const RETURN_PROFILES = [
    { key: 'GSTR-1', label: 'GSTR-1 (Outward Supplies)', match: [/form\s*gstr-?1\b/i, /\bgstr-?1\b/i] },
    { key: 'GSTR-2A', label: 'GSTR-2A (Auto-drafted ITC)', match: [/\bgstr-?2a\b/i] },
    { key: 'GSTR-2B', label: 'GSTR-2B (Auto-drafted ITC Statement)', match: [/\bgstr-?2b\b/i] },
    { key: 'GSTR-3B', label: 'GSTR-3B (Summary Return)', match: [/form\s*gstr-?3b\b/i, /\bgstr-?3b\b/i] },
    { key: 'GSTR-9', label: 'GSTR-9 (Annual Return)', match: [/form\s*gstr-?9\b/i, /\bgstr-?9\b/i] }
];

let pdfFiles = [];
let elements = {};

/**
 * Get the HTML for the GST converter tool
 */
export function getToolHTML() {
    return `
        <div id="gstPdfToExcelTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                🧾 GST Returns to Excel
            </div>

            <p style="font-size:0.85rem;color:#64748B;margin-bottom:0.5rem;">
                Upload one or more GST return PDFs downloaded from the portal (GSTR-1, 3B, 2A/2B, 9, etc.).
                Each PDF is converted to its own Excel file, packaged together as a .zip.
            </p>
            <p style="font-size:0.8rem;color:#b58b00;margin-bottom:1rem;">
                ⚠️ Table detection is heuristic-based (position clustering, not a guaranteed template match).
                Please review output before relying on it, especially for complex or multi-page tables.
            </p>

            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:1.5rem;background:#FEFEFE;margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">GST Return PDFs</label>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <button id="gstBrowseBtn" style="padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        📁 Browse PDFs
                    </button>
                    <span style="font-size:0.8rem;color:#64748B;">You can select multiple files, or add more in separate steps.</span>
                    <input type="file" id="gstFileInput" accept=".pdf" multiple style="display:none;">
                </div>
                <div id="gstFileList"></div>
            </div>

            <button id="gstGenerateBtn" disabled style="width:100%;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📄 Select PDF files first
            </button>

            <div id="gstStatus" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;white-space:pre-line;">
                📤 Upload one or more GST return PDFs to begin
            </div>

            <div id="gstResultsContainer" style="margin-top:0.75rem;"></div>

            <div id="gstDownloadContainer" style="display:none;margin-top:0.75rem;text-align:center;">
                <a id="gstDownloadLink" style="display:inline-block;padding:0.6rem 1.5rem;background:#10B981;color:white;text-decoration:none;border-radius:8px;font-weight:600;cursor:pointer;">
                    ⬇️ Download gst_converted_excel.zip
                </a>
            </div>
        </div>
    `;
}

/**
 * Initialize the GST PDF to Excel tool
 */
export function initTool() {
    elements = {
        browseBtn: document.getElementById('gstBrowseBtn'),
        fileInput: document.getElementById('gstFileInput'),
        fileListContainer: document.getElementById('gstFileList'),
        generateBtn: document.getElementById('gstGenerateBtn'),
        status: document.getElementById('gstStatus'),
        resultsContainer: document.getElementById('gstResultsContainer'),
        downloadContainer: document.getElementById('gstDownloadContainer'),
        downloadLink: document.getElementById('gstDownloadLink')
    };

    pdfFiles = [];

    setupFileInput();
    setupGenerateButton();

    // Load libraries in background so they're ready by the time the user hits generate
    loadJSZip().catch(e => console.warn('JSZip background load:', e));
    loadXLSX().catch(e => console.warn('XLSX background load:', e));
    loadPDFJS().catch(e => console.warn('PDF.js background load:', e));

    renderFileList();
    setStatus('📤 Upload one or more GST return PDFs to begin', 'info');
}

/**
 * Library loaders (same on-demand pattern as other tools)
 */
function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => window.JSZip ? resolve() : reject(new Error('JSZip failed to load'));
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

function loadXLSX() {
    return new Promise((resolve, reject) => {
        if (window.XLSX) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => window.XLSX ? resolve() : reject(new Error('XLSX failed to load'));
        script.onerror = () => reject(new Error('Failed to load XLSX'));
        document.head.appendChild(script);
    });
}

function loadPDFJS() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
            }
            return resolve();
        }
        const script = document.createElement('script');
        script.src = PDFJS_LIB_URL;
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
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
 * File input handling (multi-file, additive selection with remove)
 */
function setupFileInput() {
    if (elements.browseBtn) {
        const freshBtn = elements.browseBtn.cloneNode(true);
        elements.browseBtn.replaceWith(freshBtn);
        elements.browseBtn = freshBtn;
    }
    if (elements.fileInput) {
        const freshInput = elements.fileInput.cloneNode(true);
        elements.fileInput.replaceWith(freshInput);
        elements.fileInput = freshInput;
    }

    elements.browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files || [])
            .filter(f => f.name.toLowerCase().endsWith('.pdf'));
        pdfFiles = pdfFiles.concat(newFiles);
        renderFileList();
        elements.fileInput.value = '';
    });
}

function renderFileList() {
    if (!pdfFiles.length) {
        elements.fileListContainer.innerHTML = '';
        elements.generateBtn.disabled = true;
        elements.generateBtn.textContent = '📄 Select PDF files first';
        return;
    }

    let html = '<div style="margin-top:0.75rem;">';
    pdfFiles.forEach((f, idx) => {
        html += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;background:#F8FAFC;border-radius:8px;margin-bottom:0.3rem;font-size:0.85rem;">
                <span>📄 ${escapeHtml(f.name)} <span style="color:#94A3B8;">(${(f.size / 1024).toFixed(0)} KB)</span></span>
                <button data-idx="${idx}" class="gstRemoveBtn" style="border:none;background:none;color:#991B1B;cursor:pointer;font-weight:600;font-size:0.9rem;">✕</button>
            </div>`;
    });
    html += '</div>';
    elements.fileListContainer.innerHTML = html;

    elements.fileListContainer.querySelectorAll('.gstRemoveBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
            pdfFiles.splice(idx, 1);
            renderFileList();
        });
    });

    elements.generateBtn.disabled = false;
    elements.generateBtn.textContent = `📦 Convert ${pdfFiles.length} File(s) to Excel (.zip)`;
}

/**
 * Generate button + main batch pipeline
 */
function setupGenerateButton() {
    elements.generateBtn.addEventListener('click', generateAll);
}

async function generateAll() {
    if (!pdfFiles.length) {
        setStatus('Please select at least one PDF', 'error');
        return;
    }

    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = '⏳ Converting...';
    elements.downloadContainer.style.display = 'none';
    elements.resultsContainer.innerHTML = '';
    setStatus('⏳ Preparing...', 'info');

    try {
        await Promise.all([loadJSZip(), loadXLSX(), loadPDFJS()]);
    } catch (err) {
        setStatus('❌ Could not load required libraries: ' + err.message, 'error');
        elements.generateBtn.disabled = false;
        renderFileList();
        return;
    }

    const outZip = new JSZip();
    const usedNames = new Set();
    const results = [];

    for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        setStatus(`⏳ Converting ${i + 1}/${pdfFiles.length}: ${file.name}...`, 'info');

        try {
            const { profile, rows } = await convertSinglePdf(file);

            if (rows.length === 0) {
                results.push({ name: file.name, status: 'skip', reason: 'No extractable text found (likely a scanned/image-only PDF).' });
                continue;
            }

            const xlsxArrayBuffer = buildWorkbook(file.name, profile, rows);
            const blob = new Blob([xlsxArrayBuffer], { type: 'application/octet-stream' });

            const baseName = sanitizeFilename(file.name.replace(/\.pdf$/i, '')) + '.xlsx';
            let finalName = baseName;
            let counter = 2;
            while (usedNames.has(finalName)) {
                finalName = baseName.replace(/\.xlsx$/i, '') + '_' + counter + '.xlsx';
                counter++;
            }
            usedNames.add(finalName);

            outZip.file(finalName, blob);
            results.push({ name: file.name, status: 'ok', reason: profile.label, outName: finalName });

        } catch (err) {
            const reason = (err && err.message) ? err.message : 'Unknown error';
            results.push({ name: file.name, status: 'error', reason });
        }
    }

    renderResults(results);

    const successCount = results.filter(r => r.status === 'ok').length;

    if (successCount === 0) {
        setStatus('❌ No files could be converted. See details below.', 'error');
        elements.generateBtn.disabled = false;
        renderFileList();
        return;
    }

    try {
        const zipBlob = await outZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        elements.downloadLink.href = url;
        elements.downloadLink.download = 'gst_converted_excel.zip';
        elements.downloadContainer.style.display = 'block';

        setStatus(`✅ Converted ${successCount}/${pdfFiles.length} file(s). Click below to download.`, 'success');
    } catch (err) {
        setStatus('❌ Error building zip: ' + err.message, 'error');
    }

    elements.generateBtn.disabled = false;
    renderFileList();
}

/**
 * Render per-file results summary
 */
function renderResults(results) {
    const icons = { ok: '✅', skip: '⚠️', error: '❌' };
    let html = '<div style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">';
    results.forEach(r => {
        html += `
            <div style="padding:0.5rem 0.75rem;border-bottom:1px solid #F1F5F9;font-size:0.82rem;display:flex;gap:0.5rem;align-items:flex-start;">
                <span>${icons[r.status] || 'ℹ️'}</span>
                <span>
                    <strong>${escapeHtml(r.name)}</strong><br>
                    <span style="color:${r.status === 'error' ? '#991B1B' : '#64748B'};">${escapeHtml(r.reason)}</span>
                </span>
            </div>`;
    });
    html += '</div>';
    elements.resultsContainer.innerHTML = html;
}

/**
 * Core per-PDF conversion: extract text positions -> cluster into rows/columns -> return grid
 */
async function convertSinglePdf(file) {
    const buffer = await file.arrayBuffer();
    let pdf;

    try {
        pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (err) {
        if (err && err.name === 'PasswordException') {
            throw new Error('Password-protected PDF — not supported yet. Please remove the password and re-upload.');
        }
        throw new Error('Could not read PDF: ' + (err && err.message ? err.message : 'unknown error'));
    }

    let fullText = '';
    const allRows = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const items = textContent.items
            .filter(it => it.str && it.str.trim().length)
            .map(it => ({
                str: it.str,
                x: it.transform[4],
                y: it.transform[5]
            }));

        if (items.length === 0) continue;

        fullText += ' ' + items.map(i => i.str).join(' ');

        const columnBins = buildColumnBins(items);
        const rowGroups = clusterRows(items);
        rowGroups.forEach(rowItems => {
            allRows.push(assignToColumns(rowItems, columnBins));
        });
    }

    const profile = detectProfile(fullText);
    return { profile, rows: allRows };
}

/**
 * Group text items into rows based on shared y-coordinate (PDF y-axis: higher = further up the page)
 */
function clusterRows(items) {
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const rows = [];
    let currentRow = [];
    let currentY = null;

    sorted.forEach(item => {
        if (currentY === null || Math.abs(item.y - currentY) <= ROW_Y_TOLERANCE) {
            currentRow.push(item);
            currentY = currentY === null ? item.y : (currentY + item.y) / 2;
        } else {
            currentRow.sort((a, b) => a.x - b.x);
            rows.push(currentRow);
            currentRow = [item];
            currentY = item.y;
        }
    });

    if (currentRow.length) {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
    }
    return rows;
}

/**
 * Build column boundaries for a page based on gaps between x-positions of all items on it
 */
function buildColumnBins(items) {
    const xs = [...new Set(items.map(i => Math.round(i.x)))].sort((a, b) => a - b);
    const bins = [];
    let binStart = xs[0];
    let prev = xs[0];

    xs.forEach(x => {
        if (x - prev > COLUMN_GAP_THRESHOLD) {
            bins.push({ start: binStart, end: prev });
            binStart = x;
        }
        prev = x;
    });
    bins.push({ start: binStart, end: prev });
    return bins;
}

/**
 * Assign a row's text items into column bins, producing one cell string per bin
 */
function assignToColumns(rowItems, bins) {
    const cells = new Array(bins.length).fill('');

    rowItems.forEach(item => {
        let idx = bins.findIndex(b => item.x >= b.start - 6 && item.x <= b.end + 20);

        if (idx === -1) {
            let bestIdx = 0;
            let bestDist = Infinity;
            bins.forEach((b, i) => {
                const center = (b.start + b.end) / 2;
                const dist = Math.abs(item.x - center);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            });
            idx = bestIdx;
        }

        cells[idx] = (cells[idx] ? cells[idx] + ' ' : '') + item.str.trim();
    });

    return cells.map(parseCellValue);
}

/**
 * Convert Indian-formatted numbers (e.g. "1,23,456.00", "(500.00)") into real numbers where possible
 */
function parseCellValue(str) {
    if (!str) return '';
    const trimmed = str.trim();
    const looksNumeric = /^\(?-?[\d,]+(\.\d+)?\)?$/.test(trimmed);

    if (looksNumeric) {
        const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
        const cleaned = trimmed.replace(/[(),]/g, '').replace(/^-/, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) return negative ? -num : num;
    }
    return trimmed;
}

/**
 * Identify return type from extracted text (label only — does not change parsing logic)
 */
function detectProfile(fullText) {
    for (const p of RETURN_PROFILES) {
        if (p.match.some(re => re.test(fullText))) {
            return { key: p.key, label: p.label };
        }
    }
    return { key: 'UNKNOWN', label: 'Unrecognized / Generic (review carefully)' };
}

/**
 * Build an .xlsx ArrayBuffer for one converted PDF
 */
function buildWorkbook(filename, profile, rows) {
    const sheetData = [
        ['Source File:', filename],
        ['Detected Return Type:', profile.label],
        [],
        ...rows
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

/**
 * Utility functions
 */
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
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
