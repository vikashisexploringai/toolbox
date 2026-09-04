/**
 * ========================================
 * Enhanced GST Return PDF to Excel Converter
 * Improved table extraction for GSTR-1, 3B, 2A/2B, 9, etc.
 * ========================================
 */

// ---- Improved heuristics based on real GST PDF structure ----
const ROW_Y_TOLERANCE = 4;
const COLUMN_X_TOLERANCE = 8;
const WATERMARK_FONT_SIZE = 40;
const LINE_MERGE_TOLERANCE = 1.5;
const CELL_BOUND_TOLERANCE = 2;
const CELL_ITEM_PADDING = 3;
const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// ---- Expanded return type detection ----
const RETURN_PROFILES = [
    { key: 'GSTR-1', label: 'GSTR-1 (Outward Supplies)', match: [/form\s*gstr-?1\b/i, /\bgstr-?1\b/i] },
    { key: 'GSTR-2A', label: 'GSTR-2A (Auto-drafted ITC)', match: [/\bgstr-?2a\b/i] },
    { key: 'GSTR-2B', label: 'GSTR-2B (Auto-drafted ITC Statement)', match: [/\bgstr-?2b\b/i] },
    { key: 'GSTR-3B', label: 'GSTR-3B (Summary Return)', match: [/form\s*gstr-?3b\b/i, /\bgstr-?3b\b/i] },
    { key: 'GSTR-9', label: 'GSTR-9 (Annual Return)', match: [/form\s*gstr-?9\b/i, /\bgstr-?9\b/i] }
];

let pdfFiles = [];
let elements = {};

// ============ LIBRARY LOADERS ============

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

// ============ LINE EXTRACTION FUNCTIONS (from original) ============

async function extractPageLineSegments(page) {
    const OPS = window.pdfjsLib.OPS;
    const opList = await page.getOperatorList();

    let ctm = [1, 0, 0, 1, 0, 0];
    const matrixStack = [];
    let pending = [];
    const segments = [];

    function applyMatrix(m, x, y) {
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    }

    function multiplyMatrix(m1, m2) {
        return [
            m1[0] * m2[0] + m1[1] * m2[2],
            m1[0] * m2[1] + m1[1] * m2[3],
            m1[2] * m2[0] + m1[3] * m2[2],
            m1[2] * m2[1] + m1[3] * m2[3],
            m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
            m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
        ];
    }

    for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === OPS.save) {
            matrixStack.push(ctm.slice());
        } else if (fn === OPS.restore) {
            ctm = matrixStack.pop() || ctm;
        } else if (fn === OPS.transform) {
            ctm = multiplyMatrix(args, ctm);
        } else if (fn === OPS.constructPath) {
            const pathOps = args[0];
            const coords = args[1];
            let idx = 0;
            let cx = null,
                cy = null,
                sx = null,
                sy = null;

            for (let j = 0; j < pathOps.length; j++) {
                const pOp = pathOps[j];

                if (pOp === OPS.moveTo) {
                    const [tx, ty] = applyMatrix(ctm, coords[idx], coords[idx + 1]);
                    idx += 2;
                    cx = tx;
                    cy = ty;
                    sx = tx;
                    sy = ty;
                } else if (pOp === OPS.lineTo) {
                    const [tx, ty] = applyMatrix(ctm, coords[idx], coords[idx + 1]);
                    idx += 2;
                    if (cx !== null) pending.push({ x0: cx, y0: cy, x1: tx, y1: ty });
                    cx = tx;
                    cy = ty;
                } else if (pOp === OPS.curveTo) {
                    const [tx, ty] = applyMatrix(ctm, coords[idx + 4], coords[idx + 5]);
                    idx += 6;
                    if (cx !== null) pending.push({ x0: cx, y0: cy, x1: tx, y1: ty });
                    cx = tx;
                    cy = ty;
                } else if (pOp === OPS.closePath) {
                    if (cx !== null && sx !== null) {
                        pending.push({ x0: cx, y0: cy, x1: sx, y1: sy });
                    }
                    cx = sx;
                    cy = sy;
                } else if (pOp === OPS.rectangle) {
                    const x = coords[idx],
                        y = coords[idx + 1],
                        w = coords[idx + 2],
                        h = coords[idx + 3];
                    idx += 4;
                    const p0 = applyMatrix(ctm, x, y);
                    const p1 = applyMatrix(ctm, x + w, y);
                    const p2 = applyMatrix(ctm, x + w, y + h);
                    const p3 = applyMatrix(ctm, x, y + h);
                    pending.push({ x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1] });
                    pending.push({ x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1] });
                    pending.push({ x0: p2[0], y0: p2[1], x1: p3[0], y1: p3[1] });
                    pending.push({ x0: p3[0], y0: p3[1], x1: p0[0], y1: p0[1] });
                    cx = p0[0];
                    cy = p0[1];
                    sx = cx;
                    sy = cy;
                }
            }
        } else if (
            fn === OPS.stroke || fn === OPS.closeStroke ||
            fn === OPS.fill || fn === OPS.eoFill ||
            fn === OPS.fillStroke || fn === OPS.eoFillStroke ||
            fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke
        ) {
            segments.push(...pending);
            pending = [];
        } else if (fn === OPS.endPath) {
            pending = [];
        }
    }

    return segments;
}

function buildLineGrid(segments) {
    const AXIS_TOL = 0.75;
    const horizontalsRaw = [];
    const verticalsRaw = [];

    segments.forEach(s => {
        const dx = Math.abs(s.x1 - s.x0);
        const dy = Math.abs(s.y1 - s.y0);
        if (dy < AXIS_TOL && dx > AXIS_TOL) {
            horizontalsRaw.push({ y: (s.y0 + s.y1) / 2, x0: Math.min(s.x0, s.x1), x1: Math.max(s.x0, s.x1) });
        } else if (dx < AXIS_TOL && dy > AXIS_TOL) {
            verticalsRaw.push({ x: (s.x0 + s.x1) / 2, y0: Math.min(s.y0, s.y1), y1: Math.max(s.y0, s.y1) });
        }
    });

    return {
        horizontals: mergeCollinear(horizontalsRaw, 'y', 'x0', 'x1'),
        verticals: mergeCollinear(verticalsRaw, 'x', 'y0', 'y1')
    };
}

function mergeCollinear(list, posKey, startKey, endKey) {
    const sorted = [...list].sort((a, b) => a[posKey] - b[posKey]);
    const merged = [];

    sorted.forEach(item => {
        const last = merged[merged.length - 1];
        if (last && Math.abs(item[posKey] - last[posKey]) <= LINE_MERGE_TOLERANCE) {
            last[startKey] = Math.min(last[startKey], item[startKey]);
            last[endKey] = Math.max(last[endKey], item[endKey]);
        } else {
            merged.push({ ...item });
        }
    });

    return merged;
}

// ============ UI FUNCTIONS ============

export function getToolHTML() {
    return `
        <div id="gstPdfToExcelTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                🧾 GST Returns to Excel (Enhanced)
            </div>

            <p style="font-size:0.85rem;color:#64748B;margin-bottom:0.5rem;">
                Upload one or more GST return PDFs downloaded from the portal (GSTR-1, 3B, 2A/2B, 9, etc.).
                Each PDF is converted to its own Excel file, packaged together as a .zip.
            </p>
            <p style="font-size:0.8rem;color:#b58b00;margin-bottom:1rem;">
                ⚠️ Enhanced extraction now handles hierarchical tables, merged headers, and multi-page formatting.
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
    
    // Load libraries in background
    loadJSZip().catch(e => console.warn('JSZip background load:', e));
    loadXLSX().catch(e => console.warn('XLSX background load:', e));
    loadPDFJS().catch(e => console.warn('PDF.js background load:', e));
    
    renderFileList();
    setStatus('📤 Upload one or more GST return PDFs to begin', 'info');
}

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

function setupGenerateButton() {
    elements.generateBtn.addEventListener('click', generateAll);
}

// ============ MAIN CONVERSION ============

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
            const { profile, structuredData } = await convertSinglePdfEnhanced(file);

            if (structuredData.length === 0) {
                results.push({ name: file.name, status: 'skip', reason: 'No extractable text found (likely scanned/image-only PDF).' });
                continue;
            }

            const xlsxArrayBuffer = buildEnhancedWorkbook(file.name, profile, structuredData);
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

// ============ ENHANCED PDF PARSING ============

async function convertSinglePdfEnhanced(file) {
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
    const allTables = [];
    const unstructuredText = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const items = textContent.items
            .filter(it => it.str && it.str.trim().length)
            .map(it => ({
                str: it.str,
                x: it.transform[4],
                y: it.transform[5],
                fontSize: Math.abs(it.transform[3]) || 0,
                width: it.width || 0,
                height: it.height || 0
            }))
            .filter(it => it.fontSize < WATERMARK_FONT_SIZE);

        if (items.length === 0) continue;

        fullText += ' ' + items.map(i => i.str).join(' ');

        // Try to extract tables using enhanced methods
        const pageTables = await extractTablesFromPageEnhanced(page, items);

        if (pageTables.length > 0) {
            allTables.push({
                page: pageNum,
                tables: pageTables
            });
        } else {
            // Fallback: extract as unstructured text with position clustering
            const clusters = clusterRows(items);
            unstructuredText.push({
                page: pageNum,
                rows: clusters.map(row => row.map(item => item.str).join(' '))
            });
        }
    }

    const profile = detectProfile(fullText);
    const structuredData = buildStructuredData(allTables, unstructuredText, profile);

    return { profile, structuredData };
}

// ============ TABLE EXTRACTION ============

async function extractTablesFromPageEnhanced(page, items) {
    const tables = [];

    try {
        const segments = await extractPageLineSegments(page);
        if (segments.length > 0) {
            const { horizontals, verticals } = buildLineGrid(segments);
            const gridTable = extractGridTable(items, horizontals, verticals);
            if (gridTable && gridTable.rows.length > 0) {
                tables.push(gridTable);
            }
        }
    } catch (err) {
        console.warn('Line-based detection failed, using fallback:', err);
    }

    if (tables.length === 0) {
        const textTable = detectTableFromText(items);
        if (textTable && textTable.rows.length > 0) {
            tables.push(textTable);
        }
    }

    return tables;
}

function extractGridTable(items, horizontals, verticals) {
    if (horizontals.length < 2 || verticals.length < 2) {
        return null;
    }

    const rowYs = [...new Set(horizontals.map(h => h.y))].sort((a, b) => b - a);
    const colXs = [...new Set(verticals.map(v => v.x))].sort((a, b) => a - b);

    function hLineAt(y, left, right) {
        return horizontals.some(h =>
            Math.abs(h.y - y) <= CELL_BOUND_TOLERANCE &&
            h.x0 <= left + CELL_BOUND_TOLERANCE &&
            h.x1 >= right - CELL_BOUND_TOLERANCE
        );
    }

    function vLineAt(x, top, bottom) {
        return verticals.some(v =>
            Math.abs(v.x - x) <= CELL_BOUND_TOLERANCE &&
            v.y0 <= bottom + CELL_BOUND_TOLERANCE &&
            v.y1 >= top - CELL_BOUND_TOLERANCE
        );
    }

    const tableRows = [];
    const consumed = new Set();
    const isHierarchical = detectHierarchicalStructure(items, rowYs, colXs);

    for (let r = 0; r < rowYs.length - 1; r++) {
        const top = rowYs[r];
        const bottom = rowYs[r + 1];
        if (top - bottom < 2) continue;

        const rowCells = [];
        let anyBounded = false;
        let rowHasData = false;

        for (let c = 0; c < colXs.length - 1; c++) {
            const left = colXs[c];
            const right = colXs[c + 1];

            const bounded = hLineAt(top, left, right) && hLineAt(bottom, left, right) &&
                vLineAt(left, top, bottom) && vLineAt(right, top, bottom);

            if (!bounded) {
                const spanningText = findSpanningText(items, left, right, bottom, top);
                if (spanningText) {
                    rowCells.push(spanningText);
                    rowHasData = true;
                } else {
                    rowCells.push(null);
                }
                continue;
            }

            anyBounded = true;
            const cellItems = [];
            items.forEach((item, idx) => {
                if (!consumed.has(idx) &&
                    item.x >= left - CELL_ITEM_PADDING &&
                    item.x <= right + CELL_ITEM_PADDING &&
                    item.y >= bottom - CELL_ITEM_PADDING &&
                    item.y <= top + CELL_ITEM_PADDING) {
                    cellItems.push(item);
                    consumed.add(idx);
                }
            });

            if (isHierarchical) {
                const cellText = cellItems
                    .sort((a, b) => a.y !== b.y ? b.y - a.y : a.x - b.x)
                    .map(it => it.str.trim())
                    .join(' ');
                if (cellText) {
                    rowCells.push(parseCellValue(cellText));
                    rowHasData = true;
                } else {
                    rowCells.push(null);
                }
            } else {
                const cellText = cellItems
                    .sort((a, b) => a.x - b.x)
                    .map(it => it.str.trim())
                    .join(' ');
                if (cellText) {
                    rowCells.push(parseCellValue(cellText));
                    rowHasData = true;
                } else {
                    rowCells.push(null);
                }
            }
        }

        if (anyBounded || rowHasData) {
            const cleanCells = rowCells.map(c => c === null ? '' : c);
            tableRows.push({
                y: top,
                cells: cleanCells
            });
        }
    }

    if (tableRows.length === 0) {
        return null;
    }

    if (isHierarchical) {
        return enhanceHierarchicalTable(tableRows, items);
    }

    return { rows: tableRows };
}

function detectHierarchicalStructure(items, rowYs, colXs) {
    const sectionPattern = /^(\d+\.\d+(\.\d+)?)\s/;
    let sectionCount = 0;

    items.forEach(item => {
        if (sectionPattern.test(item.str.trim())) {
            sectionCount++;
        }
    });

    return sectionCount >= 3;
}

function findSpanningText(items, left, right, bottom, top) {
    const candidates = items.filter(item =>
        item.x >= left - CELL_ITEM_PADDING &&
        item.x <= right + CELL_ITEM_PADDING &&
        item.y >= bottom - CELL_ITEM_PADDING &&
        item.y <= top + CELL_ITEM_PADDING
    );

    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.x - b.x).map(c => c.str.trim()).join(' ');
}

function enhanceHierarchicalTable(tableRows, items) {
    const enhancedRows = [];
    let currentSection = '';

    const headers = items.filter(item => /^\d+\.\d+(\.\d+)?\s/.test(item.str.trim()));
    const headerMap = new Map();

    headers.forEach(header => {
        const match = header.str.match(/^(\d+\.\d+(\.\d+)?)\s+(.+)/);
        if (match) {
            headerMap.set(header.y, {
                section: match[1],
                text: match[3] || header.str,
                y: header.y
            });
        }
    });

    const sortedHeaders = Array.from(headerMap.values()).sort((a, b) => b.y - a.y);

    tableRows.forEach(row => {
        let matchedHeader = null;
        for (const header of sortedHeaders) {
            if (Math.abs(row.y - header.y) <= 10) {
                matchedHeader = header;
                break;
            }
        }

        if (matchedHeader) {
            currentSection = matchedHeader.section;
            const headerText = matchedHeader.text;
            enhancedRows.push({
                y: row.y,
                cells: [`[${currentSection}] ${headerText}`, ...row.cells.slice(1)]
            });
        } else {
            if (currentSection) {
                const firstCell = row.cells[0] || '';
                enhancedRows.push({
                    y: row.y,
                    cells: [firstCell ? `${firstCell}` : '', ...row.cells.slice(1)]
                });
            } else {
                enhancedRows.push(row);
            }
        }
    });

    return { rows: enhancedRows, hierarchical: true };
}

function detectTableFromText(items) {
    if (items.length < 10) return null;

    const rowGroups = clusterRows(items);
    if (rowGroups.length < 2) return null;

    const allXs = items.map(it => it.x);
    const colClusters = clusterColumns(allXs);
    if (colClusters.length < 2) return null;

    const rows = [];
    rowGroups.forEach((rowItems) => {
        if (rowItems.length === 0) return;

        let labelParts = [];
        let valueParts = [];
        let seenNumeric = false;

        rowItems.forEach(item => {
            const text = item.str.trim();
            if (!text) return;

            const isNumeric = isValueToken(text);

            if (isNumeric && !seenNumeric) {
                seenNumeric = true;
                labelParts.push(text);
            } else if (!isNumeric && !seenNumeric) {
                labelParts.push(text);
            } else {
                valueParts.push(text);
            }
        });

        const label = labelParts.join(' ');
        const values = valueParts.map(v => parseCellValue(v));

        const rowCells = [label, ...values];
        while (rowCells.length < colClusters.length + 1) {
            rowCells.push('');
        }
        rows.push(rowCells.slice(0, colClusters.length + 1));
    });

    return { rows, fallback: true };
}

function clusterColumns(xValues) {
    const sorted = [...xValues].sort((a, b) => a - b);
    const clusters = [];
    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - currentCluster[currentCluster.length - 1] <= COLUMN_X_TOLERANCE) {
            currentCluster.push(sorted[i]);
        } else {
            clusters.push(calculateClusterCenter(currentCluster));
            currentCluster = [sorted[i]];
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(calculateClusterCenter(currentCluster));
    }
    return clusters;
}

function calculateClusterCenter(cluster) {
    return cluster.reduce((a, b) => a + b, 0) / cluster.length;
}

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
            if (currentRow.length > 0) {
                currentRow.sort((a, b) => a.x - b.x);
                rows.push(currentRow);
            }
            currentRow = [item];
            currentY = item.y;
        }
    });

    if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
    }
    return rows;
}

// ============ UTILITY FUNCTIONS ============

function buildStructuredData(allTables, unstructuredText, profile) {
    const structuredData = [];

    structuredData.push(['GST Return Conversion']);
    structuredData.push(['Return Type:', profile.label]);
    structuredData.push(['']);

    if (allTables.length > 0) {
        structuredData.push(['=== TABLES ===']);
        structuredData.push(['']);

        allTables.forEach(pageData => {
            structuredData.push([`Page ${pageData.page}`]);

            pageData.tables.forEach((table, tableIdx) => {
                if (tableIdx > 0) {
                    structuredData.push(['--- Next Table ---']);
                }

                if (table.header) {
                    structuredData.push(table.header);
                }

                table.rows.forEach(row => {
                    structuredData.push(row.cells);
                });

                structuredData.push(['']);
            });
        });
    }

    if (unstructuredText.length > 0) {
        structuredData.push(['=== UNSTRUCTURED TEXT ===']);
        unstructuredText.forEach(pageData => {
            structuredData.push([`Page ${pageData.page}`]);
            pageData.rows.forEach(row => {
                structuredData.push([row]);
            });
            structuredData.push(['']);
        });
    }

    return structuredData;
}

function buildEnhancedWorkbook(filename, profile, structuredData) {
    const maxColumns = Math.max(...structuredData.map(row =>
        Array.isArray(row) ? row.length : 1
    ));

    const sheetData = structuredData.map(row => {
        if (Array.isArray(row)) {
            return row;
        }
        return [String(row)];
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const colWidths = [];
    for (let c = 0; c < maxColumns; c++) {
        let maxLen = 0;
        for (let r = 0; r < sheetData.length; r++) {
            const val = sheetData[r][c] || '';
            maxLen = Math.max(maxLen, String(val).length);
        }
        colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 50) });
    }
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function isValueToken(raw) {
    if (raw === '-') return true;
    if (/^\(?-?[\d,]+(\.\d+)?\)?$/.test(raw)) return true;
    if (/^[A-Za-z]\(?-?[\d,]+(\.\d+)?\)?$/.test(raw)) return true;
    if (/^[\d,]+(\.\d+)?$/.test(raw.replace(/,/g, ''))) return true;
    return false;
}

function parseCellValue(str) {
    if (!str) return '';
    let trimmed = str.trim();
    if (trimmed === '-') return '-';

    const strayLetterMatch = trimmed.match(/^[A-Za-z](\(?-?[\d,]+(\.\d+)?\)?)$/);
    if (strayLetterMatch) trimmed = strayLetterMatch[1];

    const looksNumeric = /^\(?-?[\d,]+(\.\d+)?\)?$/.test(trimmed);

    if (looksNumeric) {
        const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
        const cleaned = trimmed.replace(/[(),]/g, '').replace(/^-/, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) return negative ? -num : num;
    }
    return trimmed;
}

function detectProfile(fullText) {
    for (const p of RETURN_PROFILES) {
        if (p.match.some(re => re.test(fullText))) {
            return { key: p.key, label: p.label };
        }
    }
    return { key: 'UNKNOWN', label: 'Unrecognized / Generic (review carefully)' };
}

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
