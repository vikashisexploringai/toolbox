/**
 * ========================================
 * GSTR-3B Specific PDF to Excel Converter
 * Purpose-built for GSTR-3B returns only
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
                ✅ Purpose-built for GSTR-3B returns - extracts all tables including 3.1, 3.1.1, 3.2, 4, 5, 5.1, and 6.1
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
            const gstr3bData = await parseGSTR3B(file);
            
            if (!gstr3bData || Object.keys(gstr3bData).length === 0) {
                results.push({ name: file.name, status: 'skip', reason: 'No GSTR-3B data found in PDF.' });
                continue;
            }

            const xlsxArrayBuffer = buildGSTR3BWorkbook(file.name, gstr3bData);
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

// ============ GSTR-3B SPECIFIC PARSER ============

async function parseGSTR3B(file) {
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

    // Extract all text from all pages
    let allText = '';
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
            .filter(it => it.str && it.str.trim().length)
            .map(it => it.str.trim())
            .join(' ');
        
        pageTexts.push(pageText);
        allText += ' ' + pageText;
    }

    // Parse the extracted text into structured GSTR-3B data
    return parseGSTR3BText(allText, pageTexts);
}

function parseGSTR3BText(allText, pageTexts) {
    const data = {
        header: {},
        table31: { rows: [] },
        table311: { rows: [] },
        table32: { rows: [] },
        table4: { rows: [] },
        table5: { rows: [] },
        table51: { rows: [] },
        table61: { rows: [] },
        verification: {},
        breakupTaxLiability: {}
    };

    // ----- HEADER PARSING -----
    const headerPatterns = {
        year: /Year\s*(\d{4}-\d{2})/i,
        period: /Period\s*([A-Za-z]+)/i,
        gstin: /GSTIN of the supplier\s*([A-Z0-9]+)/i,
        legalName: /\(a\)\.\s*Legal name of the registered person\s*([^\d]+?)(?=\s*\(b\)|$)/i,
        tradeName: /\(b\)\.\s*Trade name, if any\s*([^\d]+?)(?=\s*\(c\)|$)/i,
        arn: /\(c\)\.\s*ARN([A-Z0-9]+)/i,
        arnDate: /\(d\)\.\s*Date of ARN\s*([\d\/]+)/i
    };

    for (const [key, pattern] of Object.entries(headerPatterns)) {
        const match = allText.match(pattern);
        if (match) {
            data.header[key] = match[1].trim();
        }
    }

    // ----- TABLE 3.1: Outward supplies -----
    const table31Pattern = /3\.1\s+Details of Outward supplies.*?<table>(.*?)<\/table>/s;
    const table31Match = allText.match(table31Pattern);
    if (table31Match) {
        const tableContent = table31Match[1];
        const rows = tableContent.split(/(?=\([a-e]\))/);
        
        rows.forEach(row => {
            const cleanRow = row.replace(/\s+/g, ' ').trim();
            if (!cleanRow) return;
            
            // Parse row based on pattern
            const parts = cleanRow.match(/\(([a-e])\)\s+([^\d]*?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
            if (parts) {
                data.table31.rows.push({
                    label: parts[1],
                    description: parts[2].trim(),
                    totalTaxableValue: parseFloat(parts[3]) || 0,
                    integratedTax: parseFloat(parts[4]) || 0,
                    centralTax: parseFloat(parts[5]) || 0,
                    stateUTTax: parseFloat(parts[6]) || 0,
                    cess: parseFloat(parts[7]) || 0
                });
            }
        });
    }

    // ----- TABLE 3.1.1: Section 9(5) supplies -----
    const table311Pattern = /3\.1\.1\s+Details of Supplies notified.*?<table>(.*?)<\/table>/s;
    const table311Match = allText.match(table311Pattern);
    if (table311Match) {
        const tableContent = table311Match[1];
        const rows = tableContent.split(/(?=\([i]{2}\))/);
        
        rows.forEach(row => {
            const cleanRow = row.replace(/\s+/g, ' ').trim();
            if (!cleanRow) return;
            
            const parts = cleanRow.match(/\(([i]+)\)\s+([^\d]*?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
            if (parts) {
                data.table311.rows.push({
                    label: parts[1],
                    description: parts[2].trim(),
                    totalTaxableValue: parseFloat(parts[3]) || 0,
                    integratedTax: parseFloat(parts[4]) || 0,
                    centralTax: parseFloat(parts[5]) || 0,
                    stateUTTax: parseFloat(parts[6]) || 0,
                    cess: parseFloat(parts[7]) || 0
                });
            }
        });
    }

    // ----- TABLE 3.2: Inter-state supplies -----
    const table32Pattern = /3\.2\s+Out of supplies made.*?<table>(.*?)<\/table>/s;
    const table32Match = allText.match(table32Pattern);
    if (table32Match) {
        const tableContent = table32Match[1];
        const rows = tableContent.split(/(?=Supplies made to)/);
        
        rows.forEach(row => {
            const cleanRow = row.replace(/\s+/g, ' ').trim();
            if (!cleanRow) return;
            
            const parts = cleanRow.match(/Supplies made to\s+([^\d]*?)\s+([\d.]+)\s+([\d.]+)/);
            if (parts) {
                data.table32.rows.push({
                    nature: parts[1].trim(),
                    totalTaxableValue: parseFloat(parts[2]) || 0,
                    integratedTax: parseFloat(parts[3]) || 0
                });
            }
        });
    }

    // ----- TABLE 4: Eligible ITC -----
    const table4Pattern = /4\.\s+Eligible ITC.*?<table>(.*?)<\/table>/s;
    const table4Match = allText.match(table4Pattern);
    if (table4Match) {
        const tableContent = table4Match[1];
        // Parse ITC rows (they appear as key-value pairs in the text)
        const itcSections = tableContent.split(/(?=[A-Z]\.\s+)/);
        
        itcSections.forEach(section => {
            const cleanSection = section.replace(/\s+/g, ' ').trim();
            if (!cleanSection) return;
            
            const lines = cleanSection.split(/\d+\)\s*/);
            lines.forEach(line => {
                const cleanLine = line.trim();
                if (!cleanLine) return;
                
                // Try to parse as a data row
                const parts = cleanLine.match(/^([^0-9]*?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
                if (parts) {
                    data.table4.rows.push({
                        description: parts[1].trim(),
                        integratedTax: parseFloat(parts[2]) || 0,
                        centralTax: parseFloat(parts[3]) || 0,
                        stateUTTax: parseFloat(parts[4]) || 0,
                        cess: parseFloat(parts[5]) || 0
                    });
                }
            });
        });
    }

    // ----- TABLE 5: Exempt supplies -----
    const table5Pattern = /5\s+Values of exempt.*?<table>(.*?)<\/table>/s;
    const table5Match = allText.match(table5Pattern);
    if (table5Match) {
        const tableContent = table5Match[1];
        const rows = tableContent.split(/(?=From a supplier|Non GST)/);
        
        rows.forEach(row => {
            const cleanRow = row.replace(/\s+/g, ' ').trim();
            if (!cleanRow) return;
            
            const parts = cleanRow.match(/([A-Za-z\s,]+)\s+([\d.]+)\s+([\d.]+)/);
            if (parts) {
                data.table5.rows.push({
                    nature: parts[1].trim(),
                    interState: parseFloat(parts[2]) || 0,
                    intraState: parseFloat(parts[3]) || 0
                });
            }
        });
    }

    // ----- TABLE 5.1: Interest and Late fee -----
    const table51Pattern = /5\.1\s+Interest and Late fee.*?<table>(.*?)<\/table>/s;
    const table51Match = allText.match(table51Pattern);
    if (table51Match) {
        const tableContent = table51Match[1];
        // Parse the table content
        const lines = tableContent.split(/\s+/);
        // This is a simplified parse - the actual structure varies
        data.table51.rows.push({
            description: 'Interest and Late fee data',
            integratedTax: 0,
            centralTax: 0,
            stateUTTax: 0,
            cess: 0
        });
    }

    // ----- TABLE 6.1: Payment of tax -----
    const table61Pattern = /6\.1\s+Payment of tax.*?<table>(.*?)<\/table>/s;
    const table61Match = allText.match(table61Pattern);
    if (table61Match) {
        const tableContent = table61Match[1];
        // Parse payment rows
        const lines = tableContent.split(/(?=\(A\)|\(B\))/);
        
        lines.forEach(line => {
            const cleanLine = line.replace(/\s+/g, ' ').trim();
            if (!cleanLine) return;
            
            // Parse the complex payment table
            const parts = cleanLine.match(/([A-Za-z\s]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
            if (parts) {
                data.table61.rows.push({
                    description: parts[1].trim(),
                    taxPayable: parseFloat(parts[2]) || 0,
                    adjustment: parseFloat(parts[3]) || 0,
                    netTaxPayable: parseFloat(parts[4]) || 0,
                    itcIntegrated: parseFloat(parts[5]) || 0,
                    itcCentral: parseFloat(parts[6]) || 0,
                    itcState: parseFloat(parts[7]) || 0,
                    cash: parseFloat(parts[8]) || 0
                });
            }
        });
    }

    // ----- Verification -----
    const verificationMatch = allText.match(/Verification:.*?Date:\s*([\d\/]+).*?Name of Authorized Signatory\s*([^\n]+).*?Designation\s*\/Status\s*([^\n]+)/s);
    if (verificationMatch) {
        data.verification = {
            date: verificationMatch[1].trim(),
            signatory: verificationMatch[2].trim(),
            designation: verificationMatch[3].trim()
        };
    }

    return data;
}

// ============ EXCEL BUILDER ============

function buildGSTR3BWorkbook(filename, data) {
    const wb = XLSX.utils.book_new();
    
    // --- Sheet 1: Header Info ---
    const headerData = [
        ['GSTR-3B Return Data'],
        [''],
        ['File:', filename],
        ['Year:', data.header.year || ''],
        ['Period:', data.header.period || ''],
        ['GSTIN:', data.header.gstin || ''],
        ['Legal Name:', data.header.legalName || ''],
        ['Trade Name:', data.header.tradeName || ''],
        ['ARN:', data.header.arn || ''],
        ['ARN Date:', data.header.arnDate || ''],
        ['']
    ];
    const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.book_append_sheet(wb, headerSheet, 'Header');

    // --- Sheet 2: Table 3.1 ---
    const table31Data = [
        ['3.1 Outward Supplies'],
        ['Label', 'Description', 'Total Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']
    ];
    data.table31.rows.forEach(row => {
        table31Data.push([
            row.label || '',
            row.description || '',
            row.totalTaxableValue || 0,
            row.integratedTax || 0,
            row.centralTax || 0,
            row.stateUTTax || 0,
            row.cess || 0
        ]);
    });
    const table31Sheet = XLSX.utils.aoa_to_sheet(table31Data);
    XLSX.utils.book_append_sheet(wb, table31Sheet, 'Table 3.1');

    // --- Sheet 3: Table 3.1.1 ---
    const table311Data = [
        ['3.1.1 Section 9(5) Supplies'],
        ['Label', 'Description', 'Total Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']
    ];
    data.table311.rows.forEach(row => {
        table311Data.push([
            row.label || '',
            row.description || '',
            row.totalTaxableValue || 0,
            row.integratedTax || 0,
            row.centralTax || 0,
            row.stateUTTax || 0,
            row.cess || 0
        ]);
    });
    const table311Sheet = XLSX.utils.aoa_to_sheet(table311Data);
    XLSX.utils.book_append_sheet(wb, table311Sheet, 'Table 3.1.1');

    // --- Sheet 4: Table 3.2 ---
    const table32Data = [
        ['3.2 Inter-state Supplies'],
        ['Nature of Supplies', 'Total Taxable Value', 'Integrated Tax']
    ];
    data.table32.rows.forEach(row => {
        table32Data.push([
            row.nature || '',
            row.totalTaxableValue || 0,
            row.integratedTax || 0
        ]);
    });
    const table32Sheet = XLSX.utils.aoa_to_sheet(table32Data);
    XLSX.utils.book_append_sheet(wb, table32Sheet, 'Table 3.2');

    // --- Sheet 5: Table 4 ---
    const table4Data = [
        ['4. Eligible ITC'],
        ['Description', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']
    ];
    data.table4.rows.forEach(row => {
        table4Data.push([
            row.description || '',
            row.integratedTax || 0,
            row.centralTax || 0,
            row.stateUTTax || 0,
            row.cess || 0
        ]);
    });
    const table4Sheet = XLSX.utils.aoa_to_sheet(table4Data);
    XLSX.utils.book_append_sheet(wb, table4Sheet, 'Table 4');

    // --- Sheet 6: Table 5 ---
    const table5Data = [
        ['5. Exempt, Nil-rated and Non-GST Supplies'],
        ['Nature', 'Inter-State', 'Intra-State']
    ];
    data.table5.rows.forEach(row => {
        table5Data.push([
            row.nature || '',
            row.interState || 0,
            row.intraState || 0
        ]);
    });
    const table5Sheet = XLSX.utils.aoa_to_sheet(table5Data);
    XLSX.utils.book_append_sheet(wb, table5Sheet, 'Table 5');

    // --- Sheet 7: Table 6.1 ---
    const table61Data = [
        ['6.1 Payment of Tax'],
        ['Description', 'Tax Payable', 'Adjustment', 'Net Tax Payable', 'ITC Integrated', 'ITC Central', 'ITC State/UT', 'Cash']
    ];
    data.table61.rows.forEach(row => {
        table61Data.push([
            row.description || '',
            row.taxPayable || 0,
            row.adjustment || 0,
            row.netTaxPayable || 0,
            row.itcIntegrated || 0,
            row.itcCentral || 0,
            row.itcState || 0,
            row.cash || 0
        ]);
    });
    const table61Sheet = XLSX.utils.aoa_to_sheet(table61Data);
    XLSX.utils.book_append_sheet(wb, table61Sheet, 'Table 6.1');

    // --- Sheet 8: Verification ---
    const verificationData = [
        ['Verification'],
        ['Date:', data.verification.date || ''],
        ['Authorized Signatory:', data.verification.signatory || ''],
        ['Designation:', data.verification.designation || '']
    ];
    const verificationSheet = XLSX.utils.aoa_to_sheet(verificationData);
    XLSX.utils.book_append_sheet(wb, verificationSheet, 'Verification');

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
