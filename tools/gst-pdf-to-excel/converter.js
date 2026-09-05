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
const RENDER_SCALE = 2;             // canvas render resolution multiplier for line detection (higher = more accurate, slower)
const DARK_THRESHOLD = 200;         // average RGB below this is treated as "ink" when scanning for lines (0=black, 255=white)
const MIN_LINE_LENGTH_PT = 30;      // a contiguous dark pixel run must span at least this many PDF points to count as a ruling line
const GRID_MATCH_TOLERANCE = 1.5;   // pt tolerance when bucketing a text item into a detected grid row/column
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
                ⚠️ Tables are reconstructed by detecting the PDF's own ruling lines (like most PDF-to-Excel tools do),
                building one grid per page. Different tables on the same page may share a wider grid with some
                blank filler cells — please review output before relying on it.
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
 * Core per-PDF conversion.
 *
 * Approach (matches how general-purpose PDF-to-Excel converters like
 * iLovePDF do it): render the page, detect ruling lines from the actual
 * pixels, build ONE grid per page from the union of all detected lines,
 * and bucket every text item into whichever grid cell it falls in. This
 * deliberately does not try to detect separate table regions — a page
 * with several differently-shaped tables just produces a wider grid with
 * blank filler cells, same as iLovePDF's output. That's a trade of some
 * neatness for reliability: it doesn't depend on subtle per-table
 * boundary logic that's easy to get subtly wrong.
 *
 * If a page has no detectable grid lines at all (e.g. a borderless
 * return type), it falls back to the text-position label/value-token
 * parser further down in this file.
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

        // 1) Render the page and detect grid lines from the actual pixels.
        let gridEntries = [];
        let consumed = new Set();

        try {
            const { rowYsPdf, colXsPdf } = await detectPageGridLines(page);
            console.log(`[gst-pdf-to-excel] page ${pageNum}: detected ${rowYsPdf.length} row lines, ${colXsPdf.length} column lines`);

            const bucketResult = bucketRowsFromGrid(items, rowYsPdf, colXsPdf);
            gridEntries = bucketResult.grid;
            consumed = bucketResult.consumed;
        } catch (err) {
            console.warn('Grid-line detection failed on page ' + pageNum + ', using text-position fallback:', err);
            gridEntries = [];
            consumed = new Set();
        }

        // 2) Anything not captured by the grid (no lines detected at all, or a
        //    text item that fell outside every detected row/column band)
        //    still goes through the label/value-token fallback so nothing is lost.
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
 * Render a page to an offscreen canvas and scan its pixels for long
 * contiguous dark runs — these are the page's ruling lines and filled
 * cell/header borders. This deliberately avoids parsing pdf.js's internal
 * operator-list format (which caused problems previously) in favour of
 * pdf.js's core, stable render() API plus plain pixel scanning.
 *
 * Returns line positions in PDF user-space coordinates (via pdf.js's
 * built-in viewport.convertToPdfPoint), so they line up directly with
 * text item positions from getTextContent().
 */
async function detectPageGridLines(page) {
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    await page.render({ canvasContext: ctx, viewport }).promise;

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    function isDark(px, py) {
        const idx = (py * width + px) * 4;
        if (data[idx + 3] === 0) return false; // fully transparent
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < DARK_THRESHOLD;
    }

    const minRunPx = Math.round(MIN_LINE_LENGTH_PT * RENDER_SCALE);

    // Horizontal candidates: rows where some contiguous run of dark pixels is long enough
    const rowPixelHits = [];
    for (let y = 0; y < height; y++) {
        let runStart = -1;
        let bestRun = 0;
        for (let x = 0; x < width; x++) {
            if (isDark(x, y)) {
                if (runStart === -1) runStart = x;
            } else if (runStart !== -1) {
                bestRun = Math.max(bestRun, x - runStart);
                runStart = -1;
            }
        }
        if (runStart !== -1) bestRun = Math.max(bestRun, width - runStart);
        if (bestRun >= minRunPx) rowPixelHits.push(y);
    }

    // Vertical candidates: columns where some contiguous run of dark pixels is long enough
    const colPixelHits = [];
    for (let x = 0; x < width; x++) {
        let runStart = -1;
        let bestRun = 0;
        for (let y = 0; y < height; y++) {
            if (isDark(x, y)) {
                if (runStart === -1) runStart = y;
            } else if (runStart !== -1) {
                bestRun = Math.max(bestRun, y - runStart);
                runStart = -1;
            }
        }
        if (runStart !== -1) bestRun = Math.max(bestRun, height - runStart);
        if (bestRun >= minRunPx) colPixelHits.push(x);
    }

    const rowYsPdf = mergePixelRuns(rowPixelHits).map(py => viewport.convertToPdfPoint(0, py)[1]);
    const colXsPdf = mergePixelRuns(colPixelHits).map(px => viewport.convertToPdfPoint(px, 0)[0]);

    return { rowYsPdf, colXsPdf };
}

/**
 * Collapse consecutive/near-adjacent pixel rows or columns (a real line is
 * usually a few pixels thick) into one representative coordinate each.
 */
function mergePixelRuns(sortedPixelCoords) {
    const merged = [];
    let group = [];

    sortedPixelCoords.forEach(v => {
        if (group.length === 0 || v - group[group.length - 1] <= 2) {
            group.push(v);
        } else {
            merged.push(Math.round(group.reduce((a, b) => a + b, 0) / group.length));
            group = [v];
        }
    });
    if (group.length) merged.push(Math.round(group.reduce((a, b) => a + b, 0) / group.length));

    return merged;
}

/**
 * Build one page-wide grid from the union of all detected row/column
 * lines, then bucket every text item into whichever cell it falls in —
 * same "one shared grid, leave blanks" approach as iLovePDF. No attempt
 * is made to detect separate table regions.
 */
function bucketRowsFromGrid(items, rowYsPdf, colXsPdf) {
    if (rowYsPdf.length < 2 || colXsPdf.length < 2) {
        return { grid: [], consumed: new Set() };
    }

    const rowBoundaries = [...new Set(rowYsPdf.map(v => Math.round(v * 10) / 10))].sort((a, b) => b - a);
    const colBoundaries = [...new Set(colXsPdf.map(v => Math.round(v * 10) / 10))].sort((a, b) => a - b);

    const grid = [];
    const consumed = new Set();

    for (let r = 0; r < rowBoundaries.length - 1; r++) {
        const top = rowBoundaries[r];
        const bottom = rowBoundaries[r + 1];
        if (top - bottom < 2) continue; // skip degenerate near-zero-height strips

        const rowCells = new Array(colBoundaries.length - 1).fill('');
        let any = false;

        items.forEach((item, idx) => {
            if (item.y > top + GRID_MATCH_TOLERANCE || item.y < bottom - GRID_MATCH_TOLERANCE) return;

            let colIdx = -1;
            for (let c = 0; c < colBoundaries.length - 1; c++) {
                if (item.x >= colBoundaries[c] - GRID_MATCH_TOLERANCE && item.x < colBoundaries[c + 1] + GRID_MATCH_TOLERANCE) {
                    colIdx = c;
                    break;
                }
            }
            if (colIdx === -1) return;

            rowCells[colIdx] = rowCells[colIdx] ? rowCells[colIdx] + ' ' + item.str.trim() : item.str.trim();
            consumed.add(idx);
            any = true;
        });

        if (any) {
            grid.push({ y: top, cells: rowCells.map(parseCellValue) });
        }
    }

    return { grid, consumed };
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
