import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HistoryItem } from '../../shared/types.js';

export function exportToCsv(items: HistoryItem[]): void {
  const headers = ['Question #', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'AI Answer', 'Final Answer', 'Confidence', 'Status', 'Explanation', 'Date'];
  const rows = items.map((item, idx) => [
    idx + 1,
    `"${(item.question || '').replace(/"/g, '""')}"`,
    `"${(item.options?.A || '').replace(/"/g, '""')}"`,
    `"${(item.options?.B || '').replace(/"/g, '""')}"`,
    `"${(item.options?.C || '').replace(/"/g, '""')}"`,
    `"${(item.options?.D || '').replace(/"/g, '""')}"`,
    item.aiAnswer || 'N/A',
    item.finalAnswer || 'N/A',
    `${Math.round(item.confidence * 100)}%`,
    item.isOverridden ? 'Manually Corrected' : item.verificationStatus,
    `"${(item.explanation || '').replace(/"/g, '""')}"`,
    new Date(item.timestamp).toLocaleString(),
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `MCQ_Answer_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToXlsx(items: HistoryItem[]): void {
  const data = items.map((item, idx) => ({
    '#': idx + 1,
    'Question': item.question,
    'A': item.options?.A || '',
    'B': item.options?.B || '',
    'C': item.options?.C || '',
    'D': item.options?.D || '',
    'AI Answer': item.aiAnswer || 'N/A',
    'Final Answer': item.finalAnswer || 'N/A',
    'Confidence': `${Math.round(item.confidence * 100)}%`,
    'Status': item.isOverridden ? 'Manually Corrected' : item.verificationStatus,
    'Explanation': item.explanation || '',
    'Timestamp': new Date(item.timestamp).toLocaleString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Answer Key');
  XLSX.writeFile(workbook, `MCQ_Answer_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToPdf(items: HistoryItem[]): void {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('MCQ Answer Key & Solution Sheet', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleString()} | Total Questions: ${items.length}`, 14, 28);

  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.question ? (item.question.length > 60 ? item.question.slice(0, 57) + '...' : item.question) : 'N/A',
    item.aiAnswer || '-',
    item.finalAnswer || '-',
    `${Math.round(item.confidence * 100)}%`,
    item.isOverridden ? 'Corrected' : item.verificationStatus === 'VERIFIED' ? 'Verified' : 'Review',
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Question', 'AI Ans', 'Final Ans', 'Conf', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 105 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
    },
  });

  doc.save(`MCQ_Answer_Sheet_${new Date().toISOString().slice(0, 10)}.pdf`);
}
