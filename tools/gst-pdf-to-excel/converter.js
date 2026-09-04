/**
 * ========================================
 * GSTR-3B Specific PDF to Excel Converter
 * All tables in a single sheet, stacked vertically
 * ========================================
 */

const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

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

// ============ UI FUNCTIONS ============

export function getToolHTML() {
    return `
        <div id="gstPdfToExcelTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                🧾 GSTR-3B to Excel Converter
            </div>

            <p style="font-size:0.85rem;color:#64748B;margin-bottom:0.5rem;">
                Upload GSTR-3B PDFs downloaded from the GST portal. Each PDF is converted to Excel format.
            </p>
            <p style="font-size:0.8rem;color:#059669;margin-bottom:1rem;">
                ✅ Purpose-built for GSTR-3B returns - extracts all tables into a single sheet
            </p>

            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:1.5rem;background:#FEFEFE;margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">GSTR-3B PDFs</label>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <button id="gstBrowseBtn" style="padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        📁 Browse PDFs
                    </button>
                    <span style="font-size:0.8rem;color:#64748B;">Select one or more GSTR-3B PDF files</span>
                    <input type="file" id="gstFileInput" accept=".pdf" multiple style="display:none;">
                </div>
                <div id="gstFileList"></div>
            </div>

            <button id="gstGenerateBtn" disabled style="width:100%;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📄 Select PDF files first
            </button>

            <div id="gstStatus" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;white-space:pre-line;">
                📤 Upload GSTR-3B PDFs to begin
            </div>

            <div id="gstResultsContainer" style="margin-top:0.75rem;"></div>

            <div id="gstDownloadContainer" style="display:none;margin-top:0.75rem;text-align:center;">
                <a id="gstDownloadLink" style="display:inline-block;padding:0.6rem 1.5rem;background:#10B981;color:white;text-decoration:none;border-radius:8px;font-weight:600;cursor:pointer;">
                    ⬇️ Download gstr3b_converted_excel.zip
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
    setStatus('📤 Upload GSTR-3B PDFs to begin', 'info');
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
    elements.generateBtn.textContent = `📦 Convert ${pdfFiles.length} GSTR-3B File(s) to Excel (.zip)`;
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
            const extractedData = await extractGSTR3BData(file);
            
            if (!extractedData || extractedData.length === 0) {
                results.push({ name: file.name, status: 'skip', reason: 'No GSTR-3B data found in PDF.' });
                continue;
            }

            const xlsxArrayBuffer = buildSingleSheetWorkbook(file.name, extractedData);
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
            results.push({ name: file.name, status: 'ok', reason: 'GSTR-3B Converted', outName: finalName });

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
        elements.downloadLink.download = 'gstr3b_converted_excel.zip';
        elements.downloadContainer.style.display = 'block';
        setStatus(`✅ Converted ${successCount}/${pdfFiles.length} file(s). Click below to download.`, 'success');
    } catch (err) {
        setStatus('❌ Error building zip: ' + err.message, 'error');
    }

    elements.generateBtn.disabled = false;
    renderFileList();
}

// ============ GSTR-3B DATA EXTRACTION ============

async function extractGSTR3BData(file) {
    const buffer = await file.arrayBuffer();
    let pdf;

    try {
        pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (err) {
        if (err && err.name === 'PasswordException') {
            throw new Error('Password-protected PDF — not supported yet.');
        }
        throw new Error('Could not read PDF: ' + (err && err.message ? err.message : 'unknown error'));
    }

    // Extract ALL text from ALL pages as a single string
    let fullText = '';
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
            .filter(it => it.str && it.str.trim().length)
            .map(it => it.str.trim())
            .join(' ');
        
        pageTexts.push(pageText);
        fullText += ' ' + pageText;
    }

    // Parse the full text
    return parseGSTR3BFullText(fullText);
}

function parseGSTR3BFullText(text) {
    const rows = [];
    let currentSection = '';
    let rowIndex = 0;

    // Split by newlines or table markers
    const lines = text.split(/\s+(?=<table>|<\/table>|(?=\d+\.\d+))/);
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Clean up the line - remove table tags and extra spaces
        line = line.replace(/<table>|<\/table>/g, '').replace(/\s+/g, ' ').trim();
        if (!line) continue;

        // Check if this is a section header
        const sectionMatch = line.match(/^(\d+(\.\d+)?)\s+(.+)/);
        if (sectionMatch) {
            currentSection = sectionMatch[1] + ' ' + sectionMatch[3];
            rows.push([currentSection]);
            rows.push([]); // Empty row for spacing
            rowIndex = rows.length;
            continue;
        }

        // Check for header patterns (GSTR-3B specific)
        if (line.includes('GSTIN of the supplier')) {
            const gstinMatch = line.match(/GSTIN of the supplier\s*([A-Z0-9]+)/);
            if (gstinMatch) {
                rows.push(['GSTIN:', gstinMatch[1]]);
            }
            continue;
        }

        if (line.includes('Legal name of the registered person')) {
            const nameMatch = line.match(/Legal name of the registered person\s*(.+?)(?=\s*\(b\)|$)/);
            if (nameMatch) {
                rows.push(['Legal Name:', nameMatch[1]]);
            }
            continue;
        }

        if (line.includes('Date of ARN')) {
            const dateMatch = line.match(/Date of ARN\s*([\d\/]+)/);
            if (dateMatch) {
                rows.push(['ARN Date:', dateMatch[1]]);
            }
            continue;
        }

        // Parse Table 3.1 rows - pattern: (a) Description 12345.00 12345.00 12345.00 12345.00 12345.00
        const table31Match = line.match(/\(([a-e])\)\s+([A-Za-z\s,()]+?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (table31Match) {
            rows.push([
                '3.1.' + table31Match[1],
                table31Match[2].trim(),
                parseFloat(table31Match[3]) || 0,
                parseFloat(table31Match[4]) || 0,
                parseFloat(table31Match[5]) || 0,
                parseFloat(table31Match[6]) || 0,
                parseFloat(table31Match[7]) || 0
            ]);
            continue;
        }

        // Parse Table 3.1.1 rows - pattern: (i) Description 12345.00 12345.00 12345.00 12345.00 12345.00
        const table311Match = line.match(/\(([i]+)\)\s+([A-Za-z\s,()\[\]]+?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (table311Match) {
            rows.push([
                '3.1.1.' + table311Match[1],
                table311Match[2].trim(),
                parseFloat(table311Match[3]) || 0,
                parseFloat(table311Match[4]) || 0,
                parseFloat(table311Match[5]) || 0,
                parseFloat(table311Match[6]) || 0,
                parseFloat(table311Match[7]) || 0
            ]);
            continue;
        }

        // Parse Table 3.2 rows
        const table32Match = line.match(/Supplies made to\s+([A-Za-z\s,]+?)\s+([\d.]+)\s+([\d.]+)/);
        if (table32Match && line.includes('3.2')) {
            rows.push([
                '3.2.' + table32Match[1].trim(),
                table32Match[1].trim(),
                parseFloat(table32Match[2]) || 0,
                parseFloat(table32Match[3]) || 0
            ]);
            continue;
        }

        // Parse Table 4 - ITC rows
        // Pattern: Description 12345.00 12345.00 12345.00 12345.00
        const itcMatch = line.match(/^([A-Z][A-Za-z\s,.()\d]+?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (itcMatch && (line.includes('ITC') || line.includes('Import') || line.includes('supplies'))) {
            rows.push([
                '4.' + itcMatch[1].trim(),
                itcMatch[1].trim(),
                parseFloat(itcMatch[2]) || 0,
                parseFloat(itcMatch[3]) || 0,
                parseFloat(itcMatch[4]) || 0,
                parseFloat(itcMatch[5]) || 0
            ]);
            continue;
        }

        // Parse Table 5 rows
        const table5Match = line.match(/(From a supplier under composition scheme|Non GST supply)\s+([\d.]+)\s+([\d.]+)/);
        if (table5Match) {
            rows.push([
                '5.' + table5Match[1],
                table5Match[1],
                parseFloat(table5Match[2]) || 0,
                parseFloat(table5Match[3]) || 0
            ]);
            continue;
        }

        // Parse Table 5.1 - Interest and Late fee
        if (line.includes('Interest Paid') || line.includes('Late fee')) {
            const values = line.match(/([\d.]+)/g);
            if (values && values.length >= 4) {
                rows.push([
                    '5.1 ' + (line.includes('Interest') ? 'Interest' : 'Late fee'),
                    line.includes('Interest') ? 'Interest Paid' : 'Late fee',
                    parseFloat(values[0]) || 0,
                    parseFloat(values[1]) || 0,
                    parseFloat(values[2]) || 0,
                    parseFloat(values[3]) || 0
                ]);
            }
            continue;
        }

        // Parse Table 6.1 - Payment of tax
        // Pattern: (A) Other than reverse charge Integrated tax 12345.00 12345.00 12345.00 ...
        const paymentMatch = line.match(/\(([A-Z])\)\s+([A-Za-z\s,]+?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (paymentMatch) {
            rows.push([
                '6.1.' + paymentMatch[1] + ' ' + paymentMatch[2].trim(),
                paymentMatch[2].trim(),
                parseFloat(paymentMatch[3]) || 0,
                parseFloat(paymentMatch[4]) || 0,
                parseFloat(paymentMatch[5]) || 0,
                parseFloat(paymentMatch[6]) || 0,
                parseFloat(paymentMatch[7]) || 0,
                parseFloat(paymentMatch[8]) || 0,
                parseFloat(paymentMatch[9]) || 0
            ]);
            continue;
        }

        // Parse Verification
        if (line.includes('Verification')) {
            rows.push(['VERIFICATION']);
            continue;
        }
        if (line.includes('Name of Authorized Signatory')) {
            const signMatch = line.match(/Name of Authorized Signatory\s+(.+?)(?=\s+Designation|$)/);
            if (signMatch) {
                rows.push(['Signatory:', signMatch[1]]);
            }
            continue;
        }
        if (line.includes('Designation')) {
            const desigMatch = line.match(/Designation\s*\/Status\s+(.+?)$/);
            if (desigMatch) {
                rows.push(['Designation:', desigMatch[1]]);
            }
            continue;
        }
    }

    // If we have very few rows, try a different parsing approach - extract number patterns
    if (rows.length < 10) {
        return extractNumbersBySection(text);
    }

    return rows;
}

// Fallback parser - extract numbers and labels by section
function extractNumbersBySection(text) {
    const rows = [];
    
    // Find all section headers
    const sections = text.match(/\d+\.\d+(\.\d+)?\s+[A-Za-z\s,()]+?(?=\d+\.\d+\.\d+?|$)/g);
    
    if (sections) {
        sections.forEach(section => {
            const cleanSection = section.replace(/\s+/g, ' ').trim();
            if (cleanSection) {
                rows.push([cleanSection]);
            }
        });
    }

    // Find all number patterns that look like GST values
    const numberPatterns = text.match(/\d+\.\d+|\d{2,}(?:\.\d{2})?/g);
    
    // Group numbers by section
    let currentRow = [];
    let sectionCounter = 0;
    
    numberPatterns.forEach(num => {
        currentRow.push(num);
        if (currentRow.length >= 6) {
            rows.push(['Row ' + (sectionCounter + 1), ...currentRow]);
            currentRow = [];
            sectionCounter++;
        }
    });

    return rows;
}

// ============ EXCEL BUILDER - Single Sheet ============

function buildSingleSheetWorkbook(filename, data) {
    const sheetData = [];

    // Header
    sheetData.push(['GSTR-3B Return Data']);
    sheetData.push(['File:', filename]);
    sheetData.push([]);

    // Add all data rows
    data.forEach(row => {
        if (Array.isArray(row)) {
            sheetData.push(row);
        } else {
            sheetData.push([String(row)]);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Auto column widths
    const maxCols = Math.max(...sheetData.map(row => Array.isArray(row) ? row.length : 1));
    const colWidths = [];
    for (let c = 0; c < maxCols; c++) {
        let maxLen = 0;
        for (let r = 0; r < sheetData.length; r++) {
            const val = sheetData[r][c] || '';
            maxLen = Math.max(maxLen, String(val).length);
        }
        colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 40) });
    }
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GSTR-3B Data');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

// ============ UTILITY FUNCTIONS ============

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
