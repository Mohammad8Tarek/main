
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { AppSettings } from '../types';
import { defaultLogoBase64 } from '../logo';

/**
 * Reverses a string to simulate RTL rendering in jsPDF for Arabic support.
 */
const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

const processRtlText = (text: string): string => {
    if (!containsArabic(text)) return text;
    return text.split('').reverse().join('');
};

const processDataForRtl = (data: any[][], language: 'en' | 'ar') => {
    if (language !== 'ar') return data;
    return data.map(row => row.map(cell => {
        if (typeof cell === 'string') return processRtlText(cell);
        return cell;
    }));
};

// --- Template generator ---
export const downloadEmployeeTemplate = (t: (key: string) => string) => {
    const headers = [
        'employeeId',
        'firstName', 
        'lastName', 
        'nationalId', 
        'nationality',
        'address',
        'phone', 
        'department', 
        'jobTitle', 
        'level',
        'gender',
        'hireDate'
    ];
    
    const example = [
        'CLK-001',
        'Ahmed', 
        'Ali', 
        '29001010101234', 
        'Egyptian',
        '123 Cairo St, Egypt',
        '01012345678', 
        'it', 
        'System Administrator', 
        'L3',
        'male',
        '2022-01-15'
    ];

    const wsData = [
        headers,
        example
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "EmployeeData");
    XLSX.writeFile(wb, `sunrise_staff_template.xlsx`);
};

// --- Excel Export ---
interface ExcelExportOptions {
    headers: string[];
    data: any[][];
    sheetName?: string;
    filename: string;
    settings: any;
}

export const exportToExcel = ({ headers, data, sheetName = 'Ledger', filename }: ExcelExportOptions) => {
    const ws_data = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
};


// --- PDF Export ---
interface PdfExportOptions {
    headers: string[];
    data: any[][];
    title: string;
    filename: string;
    settings: AppSettings;
    language: 'en' | 'ar';
}

export const exportToPdf = ({ headers, data, title, filename, settings, language }: PdfExportOptions) => {
    const doc = new jsPDF({ 
        orientation: 'l', // Force Landscape for analytical tables
        unit: 'cm', 
        format: 'a4' 
    });
    
    const isRtl = language === 'ar';
    const logoData = settings.reportLogo || settings.systemLogo || defaultLogoBase64;
    const processedHeaders = isRtl ? headers.map(processRtlText) : headers;
    const processedData = processDataForRtl(data, language);
    const tableHeaderColor = '#0F2A44'; 
    const pageWidth = doc.internal.pageSize.getWidth();

    autoTable(doc, {
        head: [processedHeaders],
        body: processedData,
        startY: 3.5,
        margin: { top: 3.5, right: 0.5, bottom: 2, left: 0.5 },
        theme: 'grid',
        headStyles: { 
            fillColor: tableHeaderColor, 
            textColor: '#FFFFFF', 
            fontStyle: 'bold', 
            halign: 'center',
            fontSize: 7
        },
        styles: { 
            font: 'Helvetica', 
            fontSize: 7, 
            cellPadding: 0.1, 
            halign: isRtl ? 'right' : 'left',
            overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: '#F8FAFC' },
        didDrawPage: (data: any) => {
            const logoX = pageWidth - 2.5;
            try { doc.addImage(logoData, 'PNG', logoX, 0.5, 2, 2); } catch (e) {}
            
            doc.setFontSize(18);
            doc.setTextColor('#0F2A44');
            const systemNameText = isRtl ? processRtlText(settings.systemName) : settings.systemName;
            doc.text(systemNameText, 0.5, 1.2);
            
            doc.setFontSize(11);
            doc.setTextColor('#64748B');
            const reportTitleText = isRtl ? processRtlText(title) : title;
            doc.text(reportTitleText, 0.5, 2.2);
            
            doc.setFontSize(7);
            doc.setTextColor('#94A3B8');
            const footerText = isRtl ? processRtlText(settings.reportFooter) : settings.reportFooter;
            doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 0.5, { align: 'center' });
            doc.text(`Page ${data.pageNumber} | Analytical Audit`, 0.5, doc.internal.pageSize.getHeight() - 0.5);
        },
    });

    doc.save(filename);
};
