import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const parseISO = (dateString?: string) => {
  if (!dateString) return new Date();
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch (e) {
    return new Date();
  }
};

const GYM_RULES = [
  "1. Only registered members and authorized visitors are allowed entry. (يسمح بالدخول فقط للأعضاء المسجلين والزوار المعتمدين)",
  "2. No person below 18 years old is allowed to use the facility without supervision.",
  "3. Members should consult a doctor before starting a new fitness routine.",
  "4. Proper athletic attire and non-marking footwear are required at all times.",
  "5. Follow equipment instructions and report any equipment malfunctions to staff immediately.",
  "6. Use lockers for personal items. The club is not responsible for lost or stolen items.",
  "7. Re-rack weights and return equipment to designated areas after use.",
  "8. Do not drop dumbbells, barbells, or heavy weight plates.",
  "9. Photography and videography require prior management approval.",
  "10. Smoking, alcohol, and prohibited substances are strictly forbidden.",
  "11. Outside food and beverages are not allowed inside the facility.",
  "12. Violations of facility policies may result in suspension or termination of membership."
];

export async function generateMemberAgreementPdfBase64(
  member: any,
  outlet: any,
  property: any,
  settings: any
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const propertyName = (property?.name || settings?.company_name || 'THE TORCH DOHA').toUpperCase();
  const outletName = (outlet?.name || 'TORCH CLUB').toUpperCase();
  const currencySymbol = 'QAR';

  // Colors
  const primaryColor: [number, number, number] = [15, 23, 42]; // #0f172a slate-900
  const accentColor: [number, number, number] = [79, 70, 229]; // #4f46e5 indigo-600
  const grayText: [number, number, number] = [100, 116, 139]; // #64748b slate-500
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc slate-50

  // Header Banner Line
  doc.setLineWidth(1);
  doc.setDrawColor(...primaryColor);
  doc.line(15, 36, 195, 36);

  // Property Title & Outlet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text(propertyName, 15, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text(`${outletName}  |  CERTIFIED MEMBER ENROLLMENT RECORD`, 15, 27);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL MEMBERSHIP AGREEMENT & LEGAL INSTRUMENT', 15, 32);

  // Membership Number Card (Top Right)
  doc.setFillColor(...lightBg);
  doc.roundedRect(130, 10, 65, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(130, 10, 65, 22, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('MEMBERSHIP NO.', 135, 16);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text(String(member.membership_number || 'N/A'), 135, 26);

  // Section 1: Member Identity & Package
  let y = 43;
  doc.setFillColor(...primaryColor);
  doc.rect(15, y, 180, 7, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('1. MEMBER IDENTITY & ENROLLMENT PARTICULARS', 18, y + 5);

  y += 9;

  const startDateFormatted = member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : 'N/A';
  const endDateFormatted = (member.current_end_date || member.original_end_date)
    ? format(parseISO(member.current_end_date || member.original_end_date), 'dd MMM yyyy')
    : 'N/A';
  const dobFormatted = member.dob ? format(parseISO(member.dob), 'dd MMM yyyy') : 'N/A';

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
      1: { fontStyle: 'bold', cellWidth: 52 },
      2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
      3: { fontStyle: 'bold', cellWidth: 52 },
    },
    body: [
      ['Member Name:', member.guest_name || 'N/A', 'Package & Access:', `${member.package_type || 'Single'} (${member.access_type || 'Both'})`],
      ['Email Address:', member.email || 'N/A', 'Enrollment Type:', member.membership_type || 'New'],
      ['Phone Number:', member.phone || 'N/A', 'Commencement:', startDateFormatted],
      ['Nationality:', member.nationality || 'N/A', 'Expiry Date:', endDateFormatted],
      ['Date of Birth:', dobFormatted, 'Referral:', member.referrer_name || 'Direct Purchase'],
    ]
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Amount Paid Card
  doc.setFillColor(30, 27, 75); // #1e1b4b indigo-950
  doc.roundedRect(15, y, 180, 20, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(165, 180, 252);
  doc.text('TOTAL CONTRIBUTION PAID', 20, y + 6);

  const safeNet = (member.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${currencySymbol} ${safeNet}`, 20, y + 15);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Payment Ref: ${member.check_no || 'Direct Purchase / Card'}`, 115, y + 15);

  y += 26;

  // Family / Dependents Section (if applicable)
  if (member.package_type === 'Couple' || member.package_type === 'Double' || member.package_type === 'Family') {
    doc.setFillColor(...primaryColor);
    doc.rect(15, y, 180, 6, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('FAMILY & DEPENDENT MANIFEST', 18, y + 4.5);
    y += 8;

    const familyRows: any[] = [];
    if (member.spouse_name) {
      familyRows.push(['Spouse / Partner', member.spouse_name, member.spouse_dob ? format(parseISO(member.spouse_dob), 'dd MMM yyyy') : 'N/A']);
    }
    if (member.kids && Array.isArray(member.kids) && member.kids.length > 0) {
      member.kids.forEach((k: any, i: number) => {
        familyRows.push([`Dependent ${i + 1}`, k.name || 'N/A', k.dob ? format(parseISO(k.dob), 'dd MMM yyyy') : 'N/A']);
      });
    }

    if (familyRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: 15, right: 15 },
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['Role / Relation', 'Full Name', 'Date of Birth']],
        body: familyRows
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Section 2: Terms & Conditions
  doc.setFillColor(...primaryColor);
  doc.rect(15, y, 180, 6, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('2. TERMS & CONDITIONS OF ENROLLMENT', 18, y + 4.5);

  y += 9;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const termsList = [
    "1. Non-Refundable & Non-Transferable: Membership fees paid are strictly non-refundable and non-transferable under any circumstances.",
    "2. Compliance with Rules: Members agree to abide by all club guidelines, facility regulations, and instructions issued by management.",
    "3. Health Declaration: Members certify that they are physically fit to participate in physical exercise and use facility amenities.",
    "4. Liability Disclaimer: The management accepts no responsibility for injuries, illness, or loss of personal property on club premises.",
    "5. Access Credentials: Members must present valid membership credentials upon every facility visit to gain entry."
  ];

  termsList.forEach(term => {
    doc.text(term, 17, y);
    y += 4.5;
  });

  y += 4;

  // Signatures
  doc.setLineWidth(0.4);
  doc.setDrawColor(203, 213, 225);

  const sigBoxY = y;
  
  // Member Signature box
  if (member.member_signature && typeof member.member_signature === 'string' && member.member_signature.startsWith('data:image')) {
    try {
      doc.addImage(member.member_signature, 'PNG', 20, sigBoxY, 40, 14);
    } catch (e) {
      console.warn('Failed to render member signature image into PDF', e);
    }
  }
  doc.line(20, sigBoxY + 15, 85, sigBoxY + 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Member Signature (توقيع العضو)', 20, sigBoxY + 20);

  // Staff Signature box
  if (member.staff_signature && typeof member.staff_signature === 'string' && member.staff_signature.startsWith('data:image')) {
    try {
      doc.addImage(member.staff_signature, 'PNG', 125, sigBoxY, 40, 14);
    } catch (e) {
      console.warn('Failed to render staff signature image into PDF', e);
    }
  }
  doc.line(125, sigBoxY + 15, 190, sigBoxY + 15);
  doc.text('Authorized Officer (المسؤول المعتمد)', 125, sigBoxY + 20);

  // Footer for Page 1
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `System ID: ${member.id ? String(member.id).substring(0, 8) : 'RECORD'} • Page 1 of 2 • Verified Member Enrollment Document`,
    105,
    285,
    { align: 'center' }
  );

  // Page 2: Rules & Regulations
  doc.addPage();

  // Page 2 Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('GYMNASIUM & HEALTH CLUB RULES', 105, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('GENERAL TERMS & OPERATIONAL PROTOCOLS', 105, 24, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.setDrawColor(...primaryColor);
  doc.line(15, 28, 195, 28);

  let py = 35;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  GYM_RULES.forEach((rule) => {
    const splitLines = doc.splitTextToSize(rule, 175);
    doc.text(splitLines, 17, py);
    py += splitLines.length * 4.5 + 2;
  });

  py += 8;
  doc.setFillColor(...lightBg);
  doc.roundedRect(15, py, 180, 24, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, py, 180, 24, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ACKNOWLEDGEMENT', 20, py + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'By registering for membership at ' + propertyName + ', the member acknowledges receipt and acceptance of all facility rules, health disclosures, and terms listed in this document.',
    20,
    py + 12,
    { maxWidth: 170 }
  );

  // Footer for Page 2
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `System ID: ${member.id ? String(member.id).substring(0, 8) : 'RECORD'} • Page 2 of 2 • ${propertyName}`,
    105,
    285,
    { align: 'center' }
  );

  // Return base64 string
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
