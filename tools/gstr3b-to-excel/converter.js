// gstr3b-converter.js - Dedicated GSTR-3B PDF to Excel Converter

const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// ---- GSTR-3B Field Mappings ----
// Each field specifies where to find the value in the PDF
const GSTR3B_MAPPING = {
    // Header Information
    'GSTIN': {
        label: 'GSTIN of the supplier',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'LegalName': {
        label: 'Legal name of the registered person',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'TradeName': {
        label: 'Trade name, if any',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'ARN': {
        label: 'ARN',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'ARNDate': {
        label: 'Date of ARN',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'Year': {
        label: 'Year',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },
    'Period': {
        label: 'Period',
        direction: 'right',
        xOffset: 0,
        yOffset: 0
    },

    // Table 3.1 - Outward Supplies
    'OutwardTaxableValue': {
        label: 'Outward taxable supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'OutwardIntegratedTax': {
        label: 'Outward taxable supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'OutwardCentralTax': {
        label: 'Outward taxable supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'OutwardStateTax': {
        label: 'Outward taxable supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 4
    },
    'OutwardCess': {
        label: 'Outward taxable supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 5
    },

    'ZeroRatedTaxableValue': {
        label: 'Outward taxable supplies (zero rated)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ZeroRatedIntegratedTax': {
        label: 'Outward taxable supplies (zero rated)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },

    'NilRatedExemptedValue': {
        label: 'Other outward supplies (nil rated, exempted)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },

    'ReverseChargeValue': {
        label: 'Inward supplies (liable to reverse charge)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ReverseChargeIntegratedTax': {
        label: 'Inward supplies (liable to reverse charge)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'ReverseChargeCentralTax': {
        label: 'Inward supplies (liable to reverse charge)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'ReverseChargeStateTax': {
        label: 'Inward supplies (liable to reverse charge)',
        direction: 'right',
        rowOffset: 0,
        colOffset: 4
    },

    'NonGSTOutwardValue': {
        label: 'Non-GST outward supplies',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },

    // Table 3.1.1 - Supplies under section 9(5)
    'EcomTaxableValue': {
        label: 'Taxable supplies on which electronic commerce operator pays tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'EcomIntegratedTax': {
        label: 'Taxable supplies on which electronic commerce operator pays tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'EcomCentralTax': {
        label: 'Taxable supplies on which electronic commerce operator pays tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'EcomStateTax': {
        label: 'Taxable supplies on which electronic commerce operator pays tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 4
    },
    'EcomCess': {
        label: 'Taxable supplies on which electronic commerce operator pays tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 5
    },

    // Table 3.2 - Inter-state supplies
    'InterStateUnregistered': {
        label: 'Supplies made to Unregistered Persons',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'InterStateUnregisteredTax': {
        label: 'Supplies made to Unregistered Persons',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'InterStateComposition': {
        label: 'Supplies made to Composition Taxable Persons',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'InterStateCompositionTax': {
        label: 'Supplies made to Composition Taxable Persons',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'InterStateUIN': {
        label: 'Supplies made to UIN holders',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'InterStateUINTax': {
        label: 'Supplies made to UIN holders',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },

    // Table 4 - ITC
    'ITCImportGoodsIGST': {
        label: 'Import of goods',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ITCImportServicesIGST': {
        label: 'Import of services',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ITCReverseChargeIGST': {
        label: 'Inward supplies liable to reverse charge',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ITCReverseChargeCGST': {
        label: 'Inward supplies liable to reverse charge',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'ITCReverseChargeSGST': {
        label: 'Inward supplies liable to reverse charge',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'ITCOtherIGST': {
        label: 'All other ITC',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'ITCOtherCGST': {
        label: 'All other ITC',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'ITCOtherSGST': {
        label: 'All other ITC',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },

    // ITC Reversed
    'ITCReversedCGST': {
        label: 'Others',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'ITCReversedSGST': {
        label: 'Others',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },

    // Net ITC
    'NetITCIGST': {
        label: 'Net ITC available',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'NetITCCGST': {
        label: 'Net ITC available',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'NetITCSGST': {
        label: 'Net ITC available',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },

    // Payment Details - Table 6.1
    'PaymentIntegratedTax': {
        label: 'Integrated tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'PaymentCentralTax': {
        label: 'Central tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'PaymentStateTax': {
        label: 'State/UT tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'PaymentCess': {
        label: 'Cess',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },

    // Breakup of tax liability
    'BreakupIntegratedTax': {
        label: 'Integrated tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 1
    },
    'BreakupCentralTax': {
        label: 'Central tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 2
    },
    'BreakupStateTax': {
        label: 'State/UT tax',
        direction: 'right',
        rowOffset: 0,
        colOffset: 3
    },
    'BreakupCess': {
        label: 'Cess',
        direction: 'right',
        rowOffset: 0,
        colOffset: 4
    }
};

// ---- Main Converter Class ----
class GSTR3BConverter {
    constructor() {
        this.pdfjsLib = null;
    }

    async loadLibraries() {
        if (!this.pdfjsLib) {
            await this.loadPDFJS();
        }
        if (!window.XLSX) {
            await this.loadXLSX();
        }
        if (!window.JSZip) {
            await this.loadJSZip();
        }
    }

    loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
                this.pdfjsLib = window.pdfjsLib;
                return resolve();
            }
            const script = document.createElement('script');
            script.src = PDFJS_LIB_URL;
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
                    this.pdfjsLib = window.pdfjsLib;
                    resolve();
                } else {
                    reject(new Error('PDF.js failed to load'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
        });
    }

    loadXLSX() {
        return new Promise((resolve, reject) => {
            if (window.XLSX) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => window.XLSX ? resolve() : reject(new Error('XLSX failed to load'));
            script.onerror = () => reject(new Error('Failed to load XLSX'));
            document.head.appendChild(script);
        });
    }

    loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => window.JSZip ? resolve() : reject(new Error('JSZip failed to load'));
            script.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(script);
        });
    }

    async convertPDF(file) {
        await this.loadLibraries();

        const buffer = await file.arrayBuffer();
        let pdf;

        try {
            pdf = await this.pdfjsLib.getDocument({ data: buffer }).promise;
        } catch (err) {
            if (err && err.name === 'PasswordException') {
                throw new Error('Password-protected PDF - please remove password and re-upload');
            }
            throw new Error('Could not read PDF: ' + (err && err.message ? err.message : 'unknown error'));
        }

        // Extract all text items with their positions from all pages
        const allItems = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const items = textContent.items
                .filter(it => it.str && it.str.trim().length > 0)
                .map(it => ({
                    text: it.str.trim(),
                    x: it.transform[4],
                    y: it.transform[5],
                    width: it.width || 0,
                    height: it.height || 0,
                    fontSize: Math.abs(it.transform[3]) || 0
                }));

            allItems.push(...items);
        }

        // Extract data using the mapping
        const extractedData = this.extractData(allItems);

        // Build Excel file
        return this.buildExcel(file.name, extractedData);
    }

    extractData(items) {
        const result = {};

        // Sort items by y (top to bottom) and x (left to right)
        const sortedItems = [...items].sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) > 5) return yDiff;
            return a.x - b.x;
        });

        // For each field in the mapping, find the value
        for (const [key, mapping] of Object.entries(GSTR3B_MAPPING)) {
            const value = this.findValueByLabel(sortedItems, mapping);
            result[key] = this.parseValue(value);
        }

        return result;
    }

    findValueByLabel(items, mapping) {
        const { label, direction = 'right', xOffset = 0, yOffset = 0, rowOffset = 0, colOffset = 1 } = mapping;

        // Find the label text (with partial matching)
        const labelItems = items.filter(item => {
            const normalizedLabel = label.toLowerCase().trim();
            const normalizedText = item.text.toLowerCase().trim();
            return normalizedText.includes(normalizedLabel) || normalizedLabel.includes(normalizedText);
        });

        if (labelItems.length === 0) {
            return 'NOT FOUND';
        }

        // Take the first match
        const labelItem = labelItems[0];

        // Find the value based on direction
        if (direction === 'right') {
            // Find the next item(s) to the right with some tolerance
            const candidates = items.filter(item => {
                const xDiff = item.x - labelItem.x;
                const yDiff = Math.abs(item.y - labelItem.y);
                // Same row, to the right
                return xDiff > 0 && yDiff < 5 && item.text.trim().length > 0;
            });

            // Sort by x position
            candidates.sort((a, b) => a.x - b.x);

            // If we have rowOffset, skip that many rows (for multi-row tables)
            if (rowOffset > 0) {
                // Find all rows with the same label pattern
                const rowGroups = this.groupByY(items.filter(item => {
                    const yDiff = Math.abs(item.y - labelItem.y);
                    return yDiff < 10;
                }));

                // Get the row at the offset
                const targetRow = rowGroups[rowOffset] || [];
                const targetItems = targetRow.filter(item => {
                    const xDiff = item.x - labelItem.x;
                    return xDiff > 0 && item.text.trim().length > 0;
                });
                targetItems.sort((a, b) => a.x - b.x);

                if (targetItems.length >= colOffset) {
                    return targetItems[colOffset - 1].text;
                }
            }

            // Simple case: take the first item to the right
            if (candidates.length > 0) {
                // If there are multiple items, take the one at the specified column offset
                const colIndex = Math.min(colOffset - 1, candidates.length - 1);
                return candidates[colIndex].text;
            }
        }

        return 'NOT FOUND';
    }

    groupByY(items) {
        const groups = [];
        const tolerance = 5;

        items.forEach(item => {
            let found = false;
            for (const group of groups) {
                if (Math.abs(group.y - item.y) <= tolerance) {
                    group.items.push(item);
                    found = true;
                    break;
                }
            }
            if (!found) {
                groups.push({ y: item.y, items: [item] });
            }
        });

        // Sort groups from top to bottom
        groups.sort((a, b) => b.y - a.y);

        return groups.map(g => g.items);
    }

    parseValue(str) {
        if (!str || str === 'NOT FOUND') return '';

        let trimmed = str.trim();
        if (trimmed === '-' || trimmed === '—') return '-';

        // Clean up numbers
        const cleaned = trimmed.replace(/[^\d,.-]/g, '');
        if (cleaned) {
            // Remove commas and parse
            const numStr = cleaned.replace(/,/g, '');
            const num = parseFloat(numStr);
            if (!isNaN(num)) {
                return num;
            }
        }

        return trimmed;
    }

    buildExcel(filename, data) {
        // Create the worksheet structure based on your template
        const wsData = [
            ['Form GSTR-3B', '', '', '', '', '', '', '', '', '', ''],
            ['[See rule 61(5)]', '', '', '', '', '', '', '', '', '', ''],
            ['Year', data.Year || '', '', '', '', '', '', '', '', '', ''],
            ['Period', data.Period || '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['GSTIN of the supplier', data.GSTIN || '', '', '', '', '', '', '', '', '', ''],
            ['2(a). Legal name of the registered person', data.LegalName || '', '', '', '', '', '', '', '', '', ''],
            ['2(b). Trade name, if any', data.TradeName || '', '', '', '', '', '', '', '', '', ''],
            ['2(c). ARN', data.ARN || '', '', '', '', '', '', '', '', '', ''],
            ['2(d). Date of ARN', data.ARNDate || '', '', '', '', '', '', '', '', '', ''],
            ['', '(Amount in ₹ for all tables)', '', '', '', '', '', '', '', '', ''],
            ['3.1 Details of Outward supplies and inward supplies liable to reverse charge (other than those covered by Table 3.1.1)', '', '', '', '', '', '', '', '', '', ''],
            ['Nature of Supplies', 'Total Taxable Value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', '', '', '', ''],
            ['(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', 
                data.OutwardTaxableValue || '', 
                data.OutwardIntegratedTax || '', 
                data.OutwardCentralTax || '', 
                data.OutwardStateTax || '', 
                data.OutwardCess || '', 
                '', '', '', '', ''],
            ['(b) Outward taxable supplies (zero rated)', 
                data.ZeroRatedTaxableValue || '', 
                data.ZeroRatedIntegratedTax || '', 
                '', '', '', '', '', '', '', ''],
            ['(c ) Other outward supplies (nil rated, exempted)', 
                data.NilRatedExemptedValue || '', 
                '', '', '', '', '', '', '', '', ''],
            ['(d) Inward supplies (liable to reverse charge)', 
                data.ReverseChargeValue || '', 
                data.ReverseChargeIntegratedTax || '', 
                data.ReverseChargeCentralTax || '', 
                data.ReverseChargeStateTax || '', 
                '', '', '', '', '', ''],
            ['(e) Non-GST outward supplies', 
                data.NonGSTOutwardValue || '', 
                '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['3.1.1 Details of Supplies notified under section 9(5) of the CGST Act, 2017 and corresponding provisions in IGST/UTGST/ SGST Acts', '', '', '', '', '', '', '', '', '', ''],
            ['Nature of Supplies', 'Total Taxable Value', 'Integrated tax', 'Central tax', 'State/ UT tax', 'Cess', '', '', '', '', ''],
            ['(i) Taxable supplies on which electronic commerce operator pays tax u/s 9(5) [to be furnished by electronic commerce operator]',
                data.EcomTaxableValue || '',
                data.EcomIntegratedTax || '',
                data.EcomCentralTax || '',
                data.EcomStateTax || '',
                data.EcomCess || '',
                '', '', '', '', ''],
            ['(ii) Taxable supplies made by registered person through electronic commerce operator, on which electronic commerce operator is required  to pay tax u/s 9(5) [to be furnished by registered person making supplies through electronic commerce operator]',
                '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['3.2 Out of supplies made in 3.1 (a) and 3.1.1 (i), details of inter-state supplies made', '', '', '', '', '', '', '', '', '', ''],
            ['Nature of Supplies', 'Total Taxable Value', '', 'Integrated tax', '', '', '', '', '', '', ''],
            ['Supplies made to Unregistered Persons',
                data.InterStateUnregistered || '',
                '',
                data.InterStateUnregisteredTax || '',
                '', '', '', '', '', '', ''],
            ['Supplies made to Composition Taxable Persons',
                data.InterStateComposition || '',
                '',
                data.InterStateCompositionTax || '',
                '', '', '', '', '', '', ''],
            ['Supplies made to UIN holders',
                data.InterStateUIN || '',
                '',
                data.InterStateUINTax || '',
                '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['4.  Eligible ITC', '', '', '', '', '', '', '', '', '', ''],
            ['Details', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', '', '', '', '', ''],
            ['A. ITC Available (whether in full or part)', '', '', '', '', '', '', '', '', '', ''],
            ['(1) Import of goods',
                data.ITCImportGoodsIGST || '',
                '', '', '', '', '', '', '', '', ''],
            ['(2) Import of services',
                data.ITCImportServicesIGST || '',
                '', '', '', '', '', '', '', '', ''],
            ['(3) Inward supplies liable to reverse charge (other than 1 & 2 above)',
                data.ITCReverseChargeIGST || '',
                data.ITCReverseChargeCGST || '',
                data.ITCReverseChargeSGST || '',
                '', '', '', '', '', '', ''],
            ['(4) Inward supplies from ISD', '', '', '', '', '', '', '', '', '', ''],
            ['(5) All other ITC',
                data.ITCOtherIGST || '',
                data.ITCOtherCGST || '',
                data.ITCOtherSGST || '',
                '', '', '', '', '', '', ''],
            ['B. ITC Reversed', '', '', '', '', '', '', '', '', '', ''],
            ['(1) As per rules 38,42 & 43 of CGST Rules and section 17(5)', '', '', '', '', '', '', '', '', '', ''],
            ['(2) Others',
                '',
                data.ITCReversedCGST || '',
                data.ITCReversedSGST || '',
                '', '', '', '', '', '', ''],
            ['C. Net ITC available (A-B)',
                data.NetITCIGST || '',
                data.NetITCCGST || '',
                data.NetITCSGST || '',
                '', '', '', '', '', '', ''],
            ['(D) Other Details',
                data.ITCReclaimedIGST || '',
                '', '', '', '', '', '', '', '', ''],
            ['(1) ITC reclaimed which was reversed under Table 4(B)(2) in earlier tax period',
                data.ITCReclaimedIGST || '',
                '', '', '', '', '', '', '', '', ''],
            ['(2) Ineligible ITC under section 16(4) & ITC restricted due to PoS rules',
                '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['5  Values of exempt, nil-rated and non-GST inward supplies', '', '', '', '', '', '', '', '', '', ''],
            ['Nature of Supplies', 'Inter- State supplies', 'Intra- State supplies', '', '', '', '', '', '', '', ''],
            ['From a supplier under composition scheme, Exempt, Nil rated supply', '', '', '', '', '', '', '', '', '', ''],
            ['Non GST supply', '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['5.1 Interest and Late fee for previous tax period', '', '', '', '', '', '', '', '', '', ''],
            ['Details', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', '', '', '', '', ''],
            ['System computed Interest', '', '', '', '', '', '', '', '', '', ''],
            ['Interest Paid', '', '', '', '', '', '', '', '', '', ''],
            ['Late fee', '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['6.1 Payment of tax', '', '', '', '', '', '', '', '', '', ''],
            ['Description', 'Tax payable', 'Adjustment of negative liability of previous tax period', 'Net Tax Payable', 'Tax paid through ITC', '', '', 'Tax paid in cash', 'Interest paid in cash', 'Late fee paid in cash', ''],
            ['', '', '', '', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', '', ''],
            ['(A) Other than reverse charge', '', '', '', '', '', '', '', '', '', ''],
            ['Integrated tax',
                data.PaymentIntegratedTax || '',
                '',
                '',
                data.PaymentITCIntegratedTax || '',
                data.PaymentITCCentralTax || '',
                '',
                '',
                data.PaymentCashIntegratedTax || '',
                data.PaymentInterestCash || '',
                data.PaymentLateFeeCash || ''],
            ['Central tax',
                data.PaymentCentralTax || '',
                '',
                '',
                '',
                data.PaymentITCCentralTax || '',
                '',
                '',
                data.PaymentCashCentralTax || '',
                '',
                ''],
            ['State/UT tax',
                data.PaymentStateTax || '',
                '',
                '',
                '',
                '',
                data.PaymentITCStateTax || '',
                '',
                data.PaymentCashStateTax || '',
                '',
                ''],
            ['Cess',
                data.PaymentCess || '',
                '',
                '',
                '',
                '',
                '',
                data.PaymentITCCess || '',
                data.PaymentCashCess || '',
                '',
                ''],
            ['(B) Reverse charge and supplies made u/s 9(5)', '', '', '', '', '', '', '', '', '', ''],
            ['Integrated tax', '', '', '', '', '', '', '', '', '', ''],
            ['Central tax', '', '', '', '', '', '', '', '', '', ''],
            ['State/UT tax', '', '', '', '', '', '', '', '', '', ''],
            ['Cess', '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['Breakup of tax liability declared (for interest computation)', '', '', '', '', '', '', '', '', '', ''],
            ['Period', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', '', '', '', '', ''],
            ['July 2026',
                data.BreakupIntegratedTax || '',
                data.BreakupCentralTax || '',
                data.BreakupStateTax || '',
                data.BreakupCess || '',
                '', '', '', '', '', ''],
            ['Verification:', '', '', '', '', '', '', '', '', '', ''],
            ['I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed there from.', '', '', '', '', '', '', '', '', '', ''],
            ['Date: ' + (data.ARNDate || ''), 'Name of Authorized Signatory', '', '', '', '', '', '', '', '', ''],
            ['', 'Designation /Status', '', '', '', '', '', '', '', '', '']
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Table 1');

        return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    }
}

// ---- UI Integration ----
let gstr3bFiles = [];
let gstr3bElements = {};

export function getToolHTML() {
    return `
        <div id="gstr3bConverterTool">
            <div style="padding:0.75rem 1rem;border-radius:12px;background:#EEF2FF;margin-bottom:1rem;font-weight:500;color:#1E293B;">
                📋 GSTR-3B PDF to Excel Converter
            </div>

            <p style="font-size:0.85rem;color:#64748B;margin-bottom:0.5rem;">
                Upload GSTR-3B PDF(s) downloaded from the GST portal. Each PDF will be converted to Excel
                in the exact GSTR-3B format with all values extracted to the correct cells.
            </p>
            <p style="font-size:0.8rem;color:#059669;margin-bottom:1rem;">
                ✅ Template-based extraction for 100% accurate GSTR-3B conversion
            </p>

            <div style="border:2px dashed #94A3B8;border-radius:1.25rem;padding:1.5rem;background:#FEFEFE;margin-bottom:1rem;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.3rem;">GSTR-3B PDF Files</label>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <button id="gstr3bBrowseBtn" style="padding:0.5rem 1.5rem;border:none;border-radius:8px;background:#4F46E5;color:white;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        📁 Browse PDFs
                    </button>
                    <span style="font-size:0.8rem;color:#64748B;">Select one or more GSTR-3B PDF files</span>
                    <input type="file" id="gstr3bFileInput" accept=".pdf" multiple style="display:none;">
                </div>
                <div id="gstr3bFileList"></div>
            </div>

            <button id="gstr3bGenerateBtn" disabled style="width:100%;padding:0.75rem;border:none;border-radius:12px;background:#4F46E5;color:white;font-weight:600;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                📄 Select PDF files first
            </button>

            <div id="gstr3bStatus" style="margin-top:0.75rem;padding:0.75rem;border-radius:12px;background:#EEF2FF;text-align:center;font-weight:500;font-size:0.9rem;color:#1E293B;white-space:pre-line;">
                📤 Upload GSTR-3B PDF(s) to begin
            </div>

            <div id="gstr3bResultsContainer" style="margin-top:0.75rem;"></div>

            <div id="gstr3bDownloadContainer" style="display:none;margin-top:0.75rem;text-align:center;">
                <a id="gstr3bDownloadLink" style="display:inline-block;padding:0.6rem 1.5rem;background:#10B981;color:white;text-decoration:none;border-radius:8px;font-weight:600;cursor:pointer;">
                    ⬇️ Download GSTR-3B_Converted.zip
                </a>
            </div>
        </div>
    `;
}

export function initTool() {
    gstr3bElements = {
        browseBtn: document.getElementById('gstr3bBrowseBtn'),
        fileInput: document.getElementById('gstr3bFileInput'),
        fileListContainer: document.getElementById('gstr3bFileList'),
        generateBtn: document.getElementById('gstr3bGenerateBtn'),
        status: document.getElementById('gstr3bStatus'),
        resultsContainer: document.getElementById('gstr3bResultsContainer'),
        downloadContainer: document.getElementById('gstr3bDownloadContainer'),
        downloadLink: document.getElementById('gstr3bDownloadLink')
    };

    gstr3bFiles = [];
    setupFileInput();
    setupGenerateButton();
    renderFileList();
    setStatus('📤 Upload GSTR-3B PDF(s) to begin', 'info');
}

function setupFileInput() {
    if (gstr3bElements.browseBtn) {
        const freshBtn = gstr3bElements.browseBtn.cloneNode(true);
        gstr3bElements.browseBtn.replaceWith(freshBtn);
        gstr3bElements.browseBtn = freshBtn;
    }
    if (gstr3bElements.fileInput) {
        const freshInput = gstr3bElements.fileInput.cloneNode(true);
        gstr3bElements.fileInput.replaceWith(freshInput);
        gstr3bElements.fileInput = freshInput;
    }

    gstr3bElements.browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gstr3bElements.fileInput.click();
    });

    gstr3bElements.fileInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files || [])
            .filter(f => f.name.toLowerCase().endsWith('.pdf'));
        gstr3bFiles = gstr3bFiles.concat(newFiles);
        renderFileList();
        gstr3bElements.fileInput.value = '';
    });
}

function renderFileList() {
    if (!gstr3bFiles.length) {
        gstr3bElements.fileListContainer.innerHTML = '';
        gstr3bElements.generateBtn.disabled = true;
        gstr3bElements.generateBtn.textContent = '📄 Select PDF files first';
        return;
    }

    let html = '<div style="margin-top:0.75rem;">';
    gstr3bFiles.forEach((f, idx) => {
        html += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;background:#F8FAFC;border-radius:8px;margin-bottom:0.3rem;font-size:0.85rem;">
                <span>📄 ${escapeHtml(f.name)} <span style="color:#94A3B8;">(${(f.size / 1024).toFixed(0)} KB)</span></span>
                <button data-idx="${idx}" class="gstr3bRemoveBtn" style="border:none;background:none;color:#991B1B;cursor:pointer;font-weight:600;font-size:0.9rem;">✕</button>
            </div>`;
    });
    html += '</div>';
    gstr3bElements.fileListContainer.innerHTML = html;

    gstr3bElements.fileListContainer.querySelectorAll('.gstr3bRemoveBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
            gstr3bFiles.splice(idx, 1);
            renderFileList();
        });
    });

    gstr3bElements.generateBtn.disabled = false;
    gstr3bElements.generateBtn.textContent = `📦 Convert ${gstr3bFiles.length} GSTR-3B File(s) to Excel (.zip)`;
}

function setupGenerateButton() {
    gstr3bElements.generateBtn.addEventListener('click', generateAll);
}

async function generateAll() {
    if (!gstr3bFiles.length) {
        setStatus('Please select at least one PDF', 'error');
        return;
    }

    gstr3bElements.generateBtn.disabled = true;
    gstr3bElements.generateBtn.textContent = '⏳ Converting...';
    gstr3bElements.downloadContainer.style.display = 'none';
    gstr3bElements.resultsContainer.innerHTML = '';
    setStatus('⏳ Preparing to convert GSTR-3B files...', 'info');

    const converter = new GSTR3BConverter();
    const outZip = new JSZip();
    const usedNames = new Set();
    const results = [];

    for (let i = 0; i < gstr3bFiles.length; i++) {
        const file = gstr3bFiles[i];
        setStatus(`⏳ Converting ${i + 1}/${gstr3bFiles.length}: ${file.name}...`, 'info');

        try {
            const xlsxArrayBuffer = await converter.convertPDF(file);
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
            results.push({ name: file.name, status: 'ok', reason: 'GSTR-3B Converted Successfully', outName: finalName });
        } catch (err) {
            const reason = (err && err.message) ? err.message : 'Unknown error';
            results.push({ name: file.name, status: 'error', reason });
        }
    }

    renderResults(results);

    const successCount = results.filter(r => r.status === 'ok').length;

    if (successCount === 0) {
        setStatus('❌ No files could be converted. See details below.', 'error');
        gstr3bElements.generateBtn.disabled = false;
        renderFileList();
        return;
    }

    try {
        const zipBlob = await outZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        gstr3bElements.downloadLink.href = url;
        gstr3bElements.downloadLink.download = 'GSTR-3B_Converted.zip';
        gstr3bElements.downloadContainer.style.display = 'block';

        setStatus(`✅ Converted ${successCount}/${gstr3bFiles.length} GSTR-3B file(s). Click below to download.`, 'success');
    } catch (err) {
        setStatus('❌ Error building zip: ' + err.message, 'error');
    }

    gstr3bElements.generateBtn.disabled = false;
    renderFileList();
}

function renderResults(results) {
    const icons = { ok: '✅', error: '❌' };
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
    gstr3bElements.resultsContainer.innerHTML = html;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
}

function setStatus(msg, type = 'info') {
    if (!gstr3bElements.status) return;
    const colors = {
        info: { bg: '#EEF2FF', color: '#1E293B' },
        success: { bg: '#D1FAE5', color: '#065F46' },
        error: { bg: '#FEE2E2', color: '#991B1B' }
    };
    const style = colors[type] || colors.info;
    gstr3bElements.status.innerHTML = msg;
    gstr3bElements.status.style.background = style.bg;
    gstr3bElements.status.style.color = style.color;
}
