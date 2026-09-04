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
    loadJSZip().catch(e => console.warn('JSZip background load:', e));
    loadXLSX().catch(e => console.warn('XLSX background load:', e));
    loadPDFJS().catch(e => console.warn('PDF.js background load:', e));
    renderFileList();
    setStatus('📤 Upload one or more GST return PDFs to begin', 'info');
}

// [Library loaders remain the same as before]
function loadJSZip() { /* ... */ }
function loadXLSX() { /* ... */ }
function loadPDFJS() { /* ... */ }

// [File input handling remains the same]
function setupFileInput() { /* ... */ }
function renderFileList() { /* ... */ }

function setupGenerateButton() {
    elements.generateBtn.addEventListener('click', generateAll);
}

// ============ ENHANCED CONVERSION LOGIC ============

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
    
    // Structure the data for Excel output
    const structuredData = buildStructuredData(allTables, unstructuredText, profile);
    
    return { profile, structuredData };
}

// ============ ENHANCED TABLE EXTRACTION ============

async function extractTablesFromPageEnhanced(page, items) {
    const tables = [];
    
    try {
        // Method 1: Extract using grid lines (most reliable for structured tables)
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

    // Method 2: If no grid found, use enhanced text-based detection
    if (tables.length === 0) {
        const textTable = detectTableFromText(items);
        if (textTable && textTable.rows.length > 0) {
            tables.push(textTable);
        }
    }

    return tables;
}

// ============ ENHANCED GRID-BASED TABLE EXTRACTION ============

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

    // Detect if this is a hierarchical table (like GSTR-3B with nested sections)
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
                // For hierarchical tables, try to find text that spans multiple columns
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

            // For hierarchical tables, preserve row structure
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
            // Remove trailing nulls
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

    // For hierarchical tables, add section headers and structure
    if (isHierarchical) {
        return enhanceHierarchicalTable(tableRows, items);
    }

    return { rows: tableRows };
}

// ============ HIERARCHICAL TABLE DETECTION ============

function detectHierarchicalStructure(items, rowYs, colXs) {
    // Check for patterns common in GSTR-3B: section numbers (3.1, 3.1.1, 4, 5, 5.1, 6.1)
    const sectionPattern = /^(\d+\.\d+(\.\d+)?)\s/;
    let sectionCount = 0;
    
    items.forEach(item => {
        if (sectionPattern.test(item.str.trim())) {
            sectionCount++;
        }
    });

    // If we find multiple sections with numbers, it's likely a hierarchical table
    return sectionCount >= 3;
}

function findSpanningText(items, left, right, bottom, top) {
    // Find text that spans across multiple column boundaries (like section headers)
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
    // Add section headers and structure for hierarchical tables
    const enhancedRows = [];
    let currentSection = '';

    // Find section headers from the original items
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

    // Sort headers by y position
    const sortedHeaders = Array.from(headerMap.values()).sort((a, b) => b.y - a.y);

    // Add section headers to the table rows
    tableRows.forEach(row => {
        // Check if this row is a section header
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
            // Add section prefix to the row if we're in a section
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

// ============ TEXT-BASED TABLE DETECTION (Fallback) ============

function detectTableFromText(items) {
    if (items.length < 10) return null;

    // Group by approximate row position
    const rowGroups = clusterRows(items);
    if (rowGroups.length < 2) return null;

    // Analyze column structure
    const allXs = items.map(it => it.x);
    const colClusters = clusterColumns(allXs);
    if (colClusters.length < 2) return null;

    const rows = [];
    rowGroups.forEach((rowItems, index) => {
        if (rowItems.length === 0) return;

        // Create cells based on column clusters
        const cells = new Array(colClusters.length).fill('');
        
        // Add label detection for first column
        let labelParts = [];
        let valueParts = [];
        let seenNumeric = false;

        rowItems.forEach(item => {
            const text = item.str.trim();
            if (!text) return;

            // Check if this is numeric or looks like a value
            const isNumeric = isValueToken(text);
            
            if (isNumeric && !seenNumeric) {
                seenNumeric = true;
                // The label is everything before the first numeric value
                labelParts.push(text);
            } else if (!isNumeric && !seenNumeric) {
                labelParts.push(text);
            } else {
                valueParts.push(text);
            }
        });

        // Build the row with label and values
        const label = labelParts.join(' ');
        const values = valueParts.map(v => parseCellValue(v));
        
        const rowCells = [label, ...values];
        
        // Pad or trim to match column count
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

// ============ BUILD STRUCTURED DATA ============

function buildStructuredData(allTables, unstructuredText, profile) {
    const structuredData = [];
    
    // Add header info
    structuredData.push(['GST Return Conversion']);
    structuredData.push(['Return Type:', profile.label]);
    structuredData.push(['']);
    
    // Add tables
    if (allTables.length > 0) {
        structuredData.push(['=== TABLES ===']);
        structuredData.push(['']);
        
        allTables.forEach(pageData => {
            structuredData.push([`Page ${pageData.page}`]);
            
            pageData.tables.forEach((table, tableIdx) => {
                if (tableIdx > 0) {
                    structuredData.push(['--- Next Table ---']);
                }
                
                // Add headers if available
                if (table.header) {
                    structuredData.push(table.header);
                }
                
                // Add rows with proper formatting
                table.rows.forEach(row => {
                    structuredData.push(row.cells);
                });
                
                structuredData.push(['']);
            });
        });
    }
    
    // Add unstructured text as fallback
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

// ============ ENHANCED EXCEL BUILDER ============

function buildEnhancedWorkbook(filename, profile, structuredData) {
    // First, clean up the data and auto-detect column widths
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
    
    // Auto-column width heuristics
    const colWidths = [];
    for (let c = 0; c < maxColumns; c++) {
        let maxLen = 0;
        for (let r = 0; r < sheetData.length; r++) {
            const val = sheetData[r][c] || '';
            maxLen = Math.max(maxLen, String(val).length);
        }
        // Cap width for readability
        colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 50) });
    }
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

// ============ UTILITY FUNCTIONS ============

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

// [Keep the line extraction functions from the original]
async function extractPageLineSegments(page) {
    // ... (same as original)
}

function buildLineGrid(segments) {
    // ... (same as original)
}
