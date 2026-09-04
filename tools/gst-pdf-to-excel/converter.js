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
const ROW_Y_TOLERANCE = 3;          // px difference to treat two text items as same row (fallback path only)
const WATERMARK_FONT_SIZE = 40;     // items rendered at/above this size are treated as a stamp/watermark, not table content
                                     // (portal "FILED" stamps in sample PDFs render at ~117-167pt vs ~8-18pt for real text)
const LINE_MERGE_TOLERANCE = 1.5;   // pt tolerance to merge near-duplicate parallel ruling lines into one grid line
const CELL_BOUND_TOLERANCE = 1.5;   // pt tolerance when checking a line actually spans a candidate cell's edge
const CELL_ITEM_PADDING = 2;        // pt padding when testing whether a text item falls inside a cell rectangle
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
                ⚠️ Tables are reconstructed from the PDF's own drawn grid lines where present, falling back to
                text-position heuristics elsewhere. Please review output before relying on it, especially for
                complex or multi-page tables.
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
                y: it.transform[5],
                // transform[3] approximates rendered font size for unrotated text
                fontSize: Math.abs(it.transform[3]) || 0
            }))
            .filter(it => it.fontSize < WATERMARK_FONT_SIZE);

        if (items.length === 0) continue;

        fullText += ' ' + items.map(i => i.str).join(' ');

        // 1) Try to reconstruct tables from the PDF's own drawn ruling lines —
        //    far more reliable than text-position guessing when lines exist.
        let gridEntries = [];
        let consumed = new Set();

        try {
            const segments = await extractPageLineSegments(page);
            if (segments.length > 0) {
                const { horizontals, verticals } = buildLineGrid(segments);
                const gridResult = extractGridRows(items, horizontals, verticals);
                gridEntries = gridResult.rows;
                consumed = gridResult.consumed;
            }
        } catch (err) {
            // Line-based detection failed for this page (unexpected PDF structure,
            // unsupported operator, etc.) — fall through to text-position parsing
            // for the whole page, same as before this feature existed.
            console.warn('Line-based table detection failed on page ' + pageNum + ', using text-position fallback:', err);
            gridEntries = [];
            consumed = new Set();
        }

        // 2) Anything not inside a detected grid cell — free text, headers, or
        //    an entire page/return-type with no ruling lines at all — still
        //    goes through the existing label/value-token fallback.
        const leftoverItems = items.filter((_, idx) => !consumed.has(idx));
        const fallbackGroups = clusterRows(leftoverItems);
        const fallbackEntries = fallbackGroups.map(rowItems => ({
            y: Math.max(...rowItems.map(it => it.y)),
            cells: buildRowCells(rowItems)
        }));

        // 3) Merge both sources back into top-to-bottom reading order
        const combined = [...gridEntries, ...fallbackEntries].sort((a, b) => b.y - a.y);
        combined.forEach(entry => allRows.push(entry.cells));
    }

    const profile = detectProfile(fullText);
    return { profile, rows: allRows };
}

/**
 * Walk a page's content-stream drawing operators and collect every straight
 * line segment actually drawn or filled (stroked borders, and the edges of
 * filled rectangles such as shaded header bands). Returns segments in the
 * same PDF user-space coordinates as text item positions, so both can be
 * compared directly.
 *
 * This uses pdf.js's lower-level getOperatorList() API — getTextContent()
 * has no concept of drawn lines, only text.
 */
async function extractPageLineSegments(page) {
    const OPS = window.pdfjsLib.OPS;
    const opList = await page.getOperatorList();

    let ctm = [1, 0, 0, 1, 0, 0]; // identity matrix [a, b, c, d, e, f]
    const matrixStack = [];
    let pending = [];
    const segments = [];

    function applyMatrix(m, x, y) {
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    }
    function multiplyMatrix(m1, m2) {
        // Result of applying m1 first, then m2 (m2 is the existing CTM)
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
            let cx = null, cy = null, sx = null, sy = null;

            for (let j = 0; j < pathOps.length; j++) {
                const pOp = pathOps[j];

                if (pOp === OPS.moveTo) {
                    const [tx, ty] = applyMatrix(ctm, coords[idx], coords[idx + 1]);
                    idx += 2;
                    cx = tx; cy = ty; sx = tx; sy = ty;
                } else if (pOp === OPS.lineTo) {
                    const [tx, ty] = applyMatrix(ctm, coords[idx], coords[idx + 1]);
                    idx += 2;
                    if (cx !== null) pending.push({ x0: cx, y0: cy, x1: tx, y1: ty });
                    cx = tx; cy = ty;
                } else if (pOp === OPS.curveTo) {
                    // Table borders are never curved — approximate as a straight
                    // line to the endpoint so a curve doesn't break line detection.
                    const [tx, ty] = applyMatrix(ctm, coords[idx + 4], coords[idx + 5]);
                    idx += 6;
                    if (cx !== null) pending.push({ x0: cx, y0: cy, x1: tx, y1: ty });
                    cx = tx; cy = ty;
                } else if (pOp === OPS.closePath) {
                    if (cx !== null && sx !== null) {
                        pending.push({ x0: cx, y0: cy, x1: sx, y1: sy });
                    }
                    cx = sx; cy = sy;
                } else if (pOp === OPS.rectangle) {
                    const x = coords[idx], y = coords[idx + 1], w = coords[idx + 2], h = coords[idx + 3];
                    idx += 4;
                    const p0 = applyMatrix(ctm, x, y);
                    const p1 = applyMatrix(ctm, x + w, y);
                    const p2 = applyMatrix(ctm, x + w, y + h);
                    const p3 = applyMatrix(ctm, x, y + h);
                    pending.push({ x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1] });
                    pending.push({ x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1] });
                    pending.push({ x0: p2[0], y0: p2[1], x1: p3[0], y1: p3[1] });
                    pending.push({ x0: p3[0], y0: p3[1], x1: p0[0], y1: p0[1] });
                    cx = p0[0]; cy = p0[1]; sx = cx; sy = cy;
                }
            }
        } else if (
            fn === OPS.stroke || fn === OPS.closeStroke ||
            fn === OPS.fill || fn === OPS.eoFill ||
            fn === OPS.fillStroke || fn === OPS.eoFillStroke ||
            fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke
        ) {
            // Path is actually painted (border stroke, or a filled rect like a
            // shaded header band) — its edges are real, usable grid lines.
            segments.push(...pending);
            pending = [];
        } else if (fn === OPS.endPath) {
            pending = [];
        }
    }

    return segments;
}

/**
 * Classify raw line segments as horizontal or vertical, then merge
 * near-duplicate parallel lines (e.g. a rect edge sitting almost on top of
 * a separately stroked border) into one representative grid line each,
 * keeping the widest span seen at that position.
 */
function buildLineGrid(segments) {
    const AXIS_TOL = 0.75; // how straight a segment must be to count as purely horizontal/vertical
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

/**
 * Reconstruct table rows from a grid of ruling lines. A candidate cell
 * (bounded by one adjacent pair of row-lines and one adjacent pair of
 * column-lines) is only accepted if lines actually span all four of its
 * edges — this is what makes the technique robust to a page containing
 * several unrelated tables at different positions: a cell is only "real"
 * where the document itself drew a box around it.
 */
function extractGridRows(items, horizontals, verticals) {
    if (horizontals.length < 2 || verticals.length < 2) {
        return { rows: [], consumed: new Set() };
    }

    const rowYs = [...new Set(horizontals.map(h => h.y))].sort((a, b) => b - a); // top to bottom
    const colXs = [...new Set(verticals.map(v => v.x))].sort((a, b) => a - b);   // left to right

    function hLineAt(y, left, right) {
        return horizontals.some(h =>
            Math.abs(h.y - y) <= CELL_BOUND_TOLERANCE &&
            h.x0 <= left + CELL_BOUND_TOLERANCE && h.x1 >= right - CELL_BOUND_TOLERANCE
        );
    }
    function vLineAt(x, top, bottom) {
        return verticals.some(v =>
            Math.abs(v.x - x) <= CELL_BOUND_TOLERANCE &&
            v.y0 <= bottom + CELL_BOUND_TOLERANCE && v.y1 >= top - CELL_BOUND_TOLERANCE
        );
    }

    const rows = [];
    const consumed = new Set();

    for (let r = 0; r < rowYs.length - 1; r++) {
        const top = rowYs[r];
        const bottom = rowYs[r + 1];
        if (top - bottom < 2) continue; // skip degenerate near-zero-height strips

        const rowCells = [];
        let anyBounded = false;

        for (let c = 0; c < colXs.length - 1; c++) {
            const left = colXs[c];
            const right = colXs[c + 1];

            const bounded =
                hLineAt(top, left, right) && hLineAt(bottom, left, right) &&
                vLineAt(left, top, bottom) && vLineAt(right, top, bottom);

            if (!bounded) {
                rowCells.push(null); // no drawn cell here — leave for the text-fallback pass
                continue;
            }

            anyBounded = true;
            const cellItems = [];
            items.forEach((item, idx) => {
                if (
                    item.x >= left - CELL_ITEM_PADDING && item.x <= right + CELL_ITEM_PADDING &&
                    item.y >= bottom - CELL_ITEM_PADDING && item.y <= top + CELL_ITEM_PADDING
                ) {
                    cellItems.push(item);
                    consumed.add(idx);
                }
            });
            cellItems.sort((a, b) => (a.y !== b.y ? b.y - a.y : a.x - b.x)); // top-to-bottom, then left-to-right (handles text wrapped within one cell)
            rowCells.push(cellItems.map(it => it.str.trim()).join(' '));
        }

        if (anyBounded) {
            rows.push({
                y: top,
                cells: rowCells.map(c => (c === null ? '' : parseCellValue(c)))
            });
        }
    }

    return { rows, consumed };
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
 * Split a row's text items into [label, value1, value2, ...].
 *
 * Rationale: page-wide x-position clustering does not hold up on real GST
 * PDFs, because wrapped label text starts at wildly different x-offsets
 * across different rows, filling in the gaps that would otherwise separate
 * "true" columns. Numbers, however, are a reliable signal — GST tables are
 * consistently "description, then N right-hand values" — so we walk each
 * row left to right, treat everything before the first value-looking token
 * as the label, and place every value-looking token after that in order.
 *
 * The row's very first token is never treated as a value, even if it looks
 * numeric — this avoids misreading leading section numbers like "3.1" or
 * "5.1" in a heading as a data value. A numeric token appearing later in a
 * sentence (e.g. a cross-reference to another section number) can still be
 * misread this way; that's a known residual limitation worth a manual check.
 */
function buildRowCells(rowItems) {
    const label = [];
    const values = [];
    let seenValue = false;

    rowItems.forEach((item, idx) => {
        const raw = item.str.trim();
        if (!raw) return;

        const treatAsValue = idx > 0 && isValueToken(raw);

        if (treatAsValue) {
            seenValue = true;
            values.push(parseCellValue(raw));
        } else if (seenValue) {
            // Text appearing after values have started (rare — e.g. a wrapped
            // heading that happens to contain an early number). Keep it as
            // its own trailing cell rather than losing it.
            values.push(raw);
        } else {
            label.push(raw);
        }
    });

    return [label.join(' '), ...values];
}

/**
 * Does this token look like a table value (a number, a "-" placeholder,
 * or a number with a single stray leading letter from a font-encoding
 * artifact — see parseCellValue)?
 */
function isValueToken(raw) {
    if (raw === '-') return true;
    if (/^\(?-?[\d,]+(\.\d+)?\)?$/.test(raw)) return true;
    if (/^[A-Za-z]\(?-?[\d,]+(\.\d+)?\)?$/.test(raw)) return true;
    return false;
}

/**
 * Convert Indian-formatted numbers (e.g. "1,23,456.00", "(500.00)") into real numbers where possible
 */
function parseCellValue(str) {
    if (!str) return '';
    let trimmed = str.trim();
    if (trimmed === '-') return '-';

    // Some GST portal PDFs embed a font that mis-maps the ₹ symbol to a
    // stray Latin letter glued directly onto the number (e.g. "L955067.25").
    // Strip a single leading letter immediately followed by a number.
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
