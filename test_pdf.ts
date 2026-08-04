import { jsPDF } from 'jspdf';
const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
console.log("getWidth:", doc.internal.pageSize.getWidth());
console.log("getHeight:", doc.internal.pageSize.getHeight());
