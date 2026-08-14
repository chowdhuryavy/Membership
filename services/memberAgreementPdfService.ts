import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
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

export const GYM_RULES = [
  { en: "Only registered members and authorized visitors are allowed entry.", ar: "يسمح بالدخول فقط للأعضاء المسجلين والزوار المعتمدين." },
  { en: "No person below 18 years old is allowed to use the facility.", ar: "لا يسمح لأي شخص يقل عمره عن 18 عامًا باستخدام المرفق." },
  { en: "Members should consult a doctor before starting a new fitness routine.", ar: "يجب على الأعضاء استشارة الطبيب قبل البدء في روتين لياقة بدنية جديد." },
  { en: "If you suffer from medical conditions or are taking medications, please consult your doctor and inform the club staff before using the gym.", ar: "إذا كنت تعاني من حالات طبية أو تتناول أدوية، يرجى استشارة طبيبك وإبلاغ موظفي النادي قبل استخدام الصالة الرياضية." },
  { en: "Pregnant women must consult their healthcare provider before exercising; a liability waiver may be required.", ar: "يجب على النساء الحوامل استشارة مقدم الرعاية الصحية قبل ممارسة الرياضة؛ قد يُطلب التنازل عن المسؤولية." },
  { en: "Proper athletic attire and non-marking footwear are required at all times.", ar: "مطلوب ارتداء ملابس رياضية مناسبة وأحذية لا تترك أثرًا في جميع الأوقات." },
  { en: "Follow equipment instructions and report malfunctions.", ar: "اتبع تعليمات المعدات وأبلغ عن الأعطال." },
  { en: "Use the gym at your own risk and be responsible for your own safety.", ar: "استخدم الصالة الرياضية على مسؤوليتك الخاصة وكن مسؤولاً عن سلامتك." },
  { en: "Use lockers for personal items. The gym is not responsible for losses.", ar: "استخدم الخزائن للأغراض الشخصية. الصالة الرياضية ليست مسؤولة عن الخسائر." },
  { en: "Daily lockers must be emptied before closing.", ar: "يجب إفراغ الخزائن اليومية قبل الإغلاق." },
  { en: "Re-rack weights after use.", ar: "أعد الأوزان إلى مكانها بعد الاستخدام." },
  { en: "Do not drop dumbbells or barbells.", ar: "لا تسقط الدمبل أو الأثقال." },
  { en: "Chalk or talcum powder is strictly prohibited.", ar: "يمنع منعاً باتاً استخدام الطباشير أو بودرة التلك." },
  { en: "Ask staff or another member for assistance with heavy lifting.", ar: "اطلب المساعدة من الموظفين أو عضو آخر عند رفع الأثقال." },
  { en: "Only approved trainers may offer personal training.", ar: "يُسمح فقط للمدربين المعتمدين بتقديم التدريب الشخصي." },
  { en: "No loud music or phone calls in gym areas.", ar: "لا يسمح بالموسيقى الصاخبة أو المكالمات الهاتفية في مناطق الصالة الرياضية." },
  { en: "Photography and videography require prior approval.", ar: "التصوير الفوتوغرافي وتصوير الفيديو يتطلب موافقة مسبقة." },
  { en: "Harassment, intimidation, or inappropriate behavior is not tolerated.", ar: "لن يتم التسامح مع التحرش أو الترهيب أو السلوك غير اللائق." },
  { en: "Smoking and alcohol are strictly prohibited.", ar: "يمنع منعاً باتاً التدخين والكحول." },
  { en: "Do not exercise under the influence of alcohol.", ar: "لا تمارس الرياضة تحت تأثير الكحول." },
  { en: "No outside food or beverages allowed.", ar: "لا يسمح بإدخال الأطعمة أو المشروبات من الخارج." },
  { en: "No glass containers allowed.", ar: "لا يسمح بالأوعية الزجاجية." },
  { en: "Pets are not allowed in gym areas.", ar: "لا يسمح باصطحاب الحيوانات الأليفة في مناطق الصالة الرياضية." },
  { en: "Lost items will be held at reception for a limited time.", ar: "سيتم الاحتفاظ بالأشياء المفقودة في الاستقبال لفترة محدودة." },
  { en: "Report any injuries or health issues immediately.", ar: "أبلغ عن أي إصابات أو مشاكل صحية على الفور." },
  { en: "Staff are trained in first aid; AEDs are available.", ar: "الموظفون مدربون على الإسعافات الأولية؛ تتوفر أجهزة تنظيم ضربات القلب." },
  { en: "Memberships must be renewed on time; cancellation policies apply.", ar: "يجب تجديد العضويات في الوقت المحدد؛ تطبق سياسات الإلغاء." },
  { en: "Guests are allowed only with prior approval.", ar: "يسمح للضيوف فقط بموافقة مسبقة." },
  { en: "Violations may result in warning, suspension, or termination.", ar: "قد تؤدي الانتهاكات إلى التحذير أو التعليق أو الإنهاء." },
  { en: "The club is not liable for injury, death, or loss related to gym use.", ar: "النادي غير مسؤول عن الإصابة أو الوفاة أو الخسارة المتعلقة باستخدام الصالة الرياضية." },
  { en: "In case of emergency, contact club staff immediately.", ar: "في حالة الطوارئ، اتصل بموظفي النادي على الفور." }
];

async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  const promises = images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  });
  await Promise.all(promises);
}

export async function generateMemberAgreementPdfBase64(
  member: any,
  outlet: any,
  property: any,
  settings: any
): Promise<string> {
  if (typeof document !== 'undefined') {
    try {
      const propertyName = (property?.name || settings?.company_name || 'AL AZIZIYAH BOUTIQUE HOTEL').toUpperCase();
      const outletName = (outlet?.name || 'NOVA SPA').toUpperCase();
      const logoUrl = property?.logo_url || settings?.logo_url || '';
      
      const startDateStr = member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : '---';
      const endDateStr = (member.current_end_date || member.original_end_date)
        ? format(parseISO(member.current_end_date || member.original_end_date), 'dd MMM yyyy')
        : '---';
      const dobStr = member.dob ? format(parseISO(member.dob), 'dd MMM yyyy') : '---';
      const netAmountStr = `QAR ${(member.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const isNew = member.membership_type === 'New';
      const isRenew = member.membership_type === 'Renew';
      const isPool = member.access_type === 'Pool' || member.access_type === 'Both';
      const isSpa = member.access_type === 'Spa' || member.access_type === 'Both';

      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'absolute';
      renderContainer.style.left = '-9999px';
      renderContainer.style.top = '0';
      renderContainer.style.width = '800px';
      renderContainer.style.backgroundColor = '#ffffff';
      renderContainer.style.zIndex = '-9999';

      const renderCheckbox = (checked: boolean, labelEn: string, labelAr: string) => `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; border: 2px solid black; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; background: ${checked ? '#000' : 'transparent'}; color: ${checked ? '#fff' : '#000'}; shrink: 0;">
            ${checked ? '✓' : ''}
          </div>
          <div style="display: flex; gap: 8px; align-items: center; font-size: 9px; font-weight: bold; color: black; text-transform: uppercase;">
            <span>${labelEn}</span>
            <span dir="rtl" style="font-family: 'Amiri', 'Traditional Arabic', serif;">${labelAr}</span>
          </div>
        </div>
      `;

      let familySectionHtml = '';
      if (member.package_type === 'Couple' || member.package_type === 'Double' || member.package_type === 'Family') {
        const spouseDobStr = member.spouse_dob ? format(parseISO(member.spouse_dob), 'dd MMM yyyy') : '---';
        let kidsHtml = '';
        if (member.kids && Array.isArray(member.kids) && member.kids.length > 0) {
          kidsHtml = member.kids.map((kid: any, i: number) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; margin-top: 4px;">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; font-weight: 900; text-transform: uppercase;">Dependent ${i + 1}: ${kid.name || 'N/A'}</span>
              </div>
              <div style="display: flex; flex-direction: column; text-align: right;">
                <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">DOB: ${kid.dob ? format(parseISO(kid.dob), 'dd MMM yyyy') : '---'}</span>
              </div>
            </div>
          `).join('');
        }

        familySectionHtml = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid black; padding-bottom: 4px; margin-bottom: 8px;">
              <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">
                ${(member.package_type === 'Couple' || member.package_type === 'Double') ? 'Partner Details' : 'Family Manifest'}
              </h3>
              <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">
                ${(member.package_type === 'Couple' || member.package_type === 'Double') ? 'بيانات الشريكين' : 'بيانات العائلة'}
              </h3>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px; border: 1px solid #f1f5f9; border-radius: 12px;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                  <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Spouse Name</p>
                  <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">اسم الزوج/الزوجة</p>
                </div>
                <p style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${member.spouse_name || 'Not Declared'}</p>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                  <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Date of Birth</p>
                  <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">تاريخ الميلاد</p>
                </div>
                <p style="font-size: 12px; font-weight: 900; margin: 2px 0 0 0;">${spouseDobStr}</p>
              </div>
            </div>
            ${kidsHtml}
          </div>
        `;
      }

      renderContainer.innerHTML = `
        <!-- Page 1 -->
        <div id="pdf-page-1" style="width: 800px; min-height: 1130px; height: 1130px; background: #ffffff; padding: 48px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 4px solid black; padding-bottom: 16px;">
              <div style="flex: 1;">
                <h1 style="font-size: 24px; font-weight: 900; tracking: -0.05em; text-transform: uppercase; color: black; margin: 0 0 4px 0;">${propertyName}</h1>
                <h2 style="font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.3em; margin: 0;">${outletName}</h2>
                <div style="margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: black; color: white; border-radius: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;">
                  <span>🛡️ Certified Member Record</span>
                  <span style="font-family: 'Amiri', serif;" dir="rtl">سجل عضو معتمد</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />` : ''}
                <div style="text-align: right;">
                  <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px;">
                    <p style="font-size: 10px; font-weight: 900; letter-spacing: 0.1em; margin: 0;">Membership No..</p>
                    <p style="font-size: 10px; font-weight: 900; letter-spacing: 0.1em; font-family: 'Amiri', serif; margin: 0;" dir="rtl">الرقم التسلسلي</p>
                  </div>
                  <p style="font-size: 22px; font-weight: 900; letter-spacing: 0.1em; color: #4f46e5; margin: 2px 0 0 0;">${member.membership_number || '---'}</p>
                </div>
              </div>
            </div>

            <!-- 2-Column Info -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px;">
              <!-- Left: Member Identity -->
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid black; padding-bottom: 4px;">
                  <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">Member Identity</h3>
                  <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">هوية العضو</h3>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Legal Name</p>
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">الاسم القانوني</p>
                  </div>
                  <p style="font-size: 14px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${member.guest_name || '---'}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Nationality</p>
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">الجنسية</p>
                    </div>
                    <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${member.nationality || '---'}</p>
                  </div>
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Date of Birth</p>
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">تاريخ الميلاد</p>
                    </div>
                    <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${dobStr}</p>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Contact Information</p>
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">معلومات الاتصال</p>
                  </div>
                  <p style="font-size: 11px; font-weight: 900; margin: 2px 0 0 0;">${member.email || '---'}</p>
                  <p style="font-size: 11px; font-weight: 900; margin: 2px 0 0 0;">${member.phone || '---'}</p>
                </div>
              </div>

              <!-- Right: Enrollment Logic -->
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid black; padding-bottom: 4px;">
                  <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">Enrollment Logic</h3>
                  <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">تفاصيل التسجيل</h3>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Tier Designation</p>
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">نوع العضوية</p>
                  </div>
                  <p style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #4f46e5; margin: 2px 0 0 0;">${member.category_name || member.package_type || 'Custom Membership'}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Commencement</p>
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">تاريخ البدء</p>
                    </div>
                    <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${startDateStr}</p>
                  </div>
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Expiry Date</p>
                      <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">تاريخ الانتهاء</p>
                    </div>
                    <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${endDateStr}</p>
                  </div>
                </div>
                <div style="padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Referral Name</p>
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">اسم المرجع</p>
                  </div>
                  <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 2px 0 0 0;">${member.referrer_name || 'Self / Direct'}</p>
                </div>
                <div style="padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 0;">Total Contribution</p>
                    <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; font-family: 'Amiri', serif; margin: 0;" dir="rtl">إجمالي المبلغ</p>
                  </div>
                  <p style="font-size: 18px; font-weight: 900; margin: 2px 0 0 0;">${netAmountStr}</p>
                </div>
              </div>
            </div>

            <!-- Checkbox Panel -->
            <div style="background: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${renderCheckbox(isNew, "New Enrollment", "طلب جديد")}
                ${renderCheckbox(isRenew, "Renewal", "تجديد")}
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${renderCheckbox(isPool, "Pool Access", "حمام السباحة")}
                ${renderCheckbox(isSpa, "Spa Facilities", "نادي السبا")}
              </div>
            </div>

            ${familySectionHtml}

            <!-- Conditions of Enrollment -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 4px solid black;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <h4 style="font-size: 11px; font-weight: 900; text-transform: uppercase; text-decoration: underline; margin: 0;">Conditions of Enrollment</h4>
                  <p style="font-size: 9px; line-height: 1.5; text-align: justify; margin: 0; color: #1e293b;">
                    Membership is non-transferable and non-refundable. All facility rules must be strictly adhered to. The management reserves the right to suspend or terminate membership for breach of protocols. Members must present their ID upon entry.
                  </p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;" dir="rtl">
                  <h4 style="font-size: 11px; font-weight: 900; text-transform: uppercase; text-decoration: underline; font-family: 'Amiri', serif; margin: 0;">شروط العضوية</h4>
                  <p style="font-size: 9px; line-height: 1.5; text-align: justify; font-family: 'Amiri', serif; margin: 0; color: #1e293b;">
                    العضوية غير قابلة للتحويل وغير قابلة للاسترداد. يجب الالتزام الصارم بجميع قواعد المنشأة. تحتفظ الإدارة بالحق في تعليق أو إنهاء العضوية بسبب خرق البروتوكولات. يجب على الأعضاء تقديم هويتهم عند الدخول.
                  </p>
                </div>
              </div>
            </div>

            <!-- Signatures -->
            <div style="margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
              <div style="display: flex; flex-direction: column; justify-content: flex-end; height: 80px;">
                ${member.member_signature ? `<img src="${member.member_signature}" alt="Member Signature" style="height: 50px; object-fit: contain; margin-bottom: 6px; align-self: flex-start;" />` : ''}
                <div style="border-top: 1px solid black; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 11px; font-weight: 900; text-transform: uppercase;">Member Signature</span>
                  <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; font-family: 'Amiri', serif;" dir="rtl">توقيع العضو</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; justify-content: flex-end; height: 80px;">
                ${member.staff_signature ? `<img src="${member.staff_signature}" alt="Staff Signature" style="height: 50px; object-fit: contain; margin-bottom: 6px; align-self: flex-start;" />` : ''}
                <div style="border-top: 1px solid black; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 11px; font-weight: 900; text-transform: uppercase;">Authorized Officer</span>
                  <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; font-family: 'Amiri', serif;" dir="rtl">المسؤول المعتمد</span>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <p style="font-size: 9px; font-weight: bold; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.3em; margin: 0;">THIS IS A DIGITALLY GENERATED LEGAL INSTRUMENT &bull; SYSTEM ID: ${String(member.id || 'RECORD').substring(0,8)}</p>
          </div>
        </div>

        <!-- Page 2 -->
        <div id="pdf-page-2" style="width: 800px; min-height: 1130px; height: 1130px; background: #ffffff; padding: 48px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="text-align: center; margin-bottom: 20px;">
              <h3 style="font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid black; display: inline-block; padding-bottom: 4px; margin: 0;">Gymnasium Rules & Regulations</h3>
              <h3 style="font-size: 15px; font-weight: bold; margin-top: 4px; font-family: 'Amiri', serif;" dir="rtl">القواعد و اللوائح الخاصة بصالة الألعاب الرياضية</h3>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 9px; font-weight: 500; line-height: 1.4; margin-bottom: 20px;">
              ${GYM_RULES.map((rule, idx) => `
                <div style="display: flex; gap: 12px; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 900; width: 20px;">${idx + 1}.</span>
                  <span style="flex: 1; text-align: left;">${rule.en}</span>
                  <span style="flex: 1; text-align: right; font-family: 'Amiri', serif;" dir="rtl">${rule.ar}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="margin-top: auto; padding-top: 16px; border-top: 2px solid black;">
            <div style="display: flex; justify-content: space-between; padding: 0 8px;">
              <div style="width: 280px; display: flex; flex-direction: column; justify-content: flex-end; height: 70px;">
                ${member.member_signature ? `<img src="${member.member_signature}" alt="Member Signature" style="height: 40px; object-fit: contain; margin-bottom: 4px; align-self: flex-start;" />` : ''}
                <div style="border-top: 1px solid black; padding-top: 4px; font-size: 11px; display: flex; justify-content: space-between;">
                  <span style="font-weight: bold;">Member Signature</span>
                  <span style="font-weight: bold; font-family: 'Amiri', serif;" dir="rtl">توقيع العضو :</span>
                </div>
              </div>
              <div style="width: 280px; display: flex; flex-direction: column; justify-content: flex-end; height: 70px;">
                <div style="border-top: 1px solid black; padding-top: 4px; font-size: 11px; display: flex; justify-content: space-between;">
                  <span style="font-weight: bold;">Date</span>
                  <span style="font-weight: bold; font-family: 'Amiri', serif;" dir="rtl">التاريخ : ${format(new Date(), 'dd MMM yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(renderContainer);
      await waitForImages(renderContainer);
      await new Promise(r => setTimeout(r, 100));

      const page1El = renderContainer.querySelector('#pdf-page-1') as HTMLElement;
      const page2El = renderContainer.querySelector('#pdf-page-2') as HTMLElement;

      const dataUrl1 = await toPng(page1El, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: true,
        includeQueryParams: true,
      });

      const dataUrl2 = await toPng(page2El, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: true,
        includeQueryParams: true,
      });

      document.body.removeChild(renderContainer);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(dataUrl1, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.addPage();
      pdf.addImage(dataUrl2, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      const dataUri = pdf.output('datauristring');
      return dataUri.split(',')[1];
    } catch (err) {
      console.error('[MemberAgreementPdfService] High-res DOM PDF generation failed.', {
        error: err,
        type: err instanceof Error ? 'Error Object' : typeof err,
        message: (err as any)?.message || 'No message'
      });
      console.warn('[MemberAgreementPdfService] Falling back to programmatic jsPDF generator...');
    }
  }
  
  // Fallback programmatic jsPDF builder
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const propertyName = (property?.name || settings?.company_name || 'AL AZIZIYAH BOUTIQUE HOTEL').toUpperCase();
  const outletName = (outlet?.name || 'NOVA SPA').toUpperCase();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(propertyName, 15, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${outletName} - MEMBERSHIP AGREEMENT LEDGER`, 15, 27);

  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(`MEMBERSHIP NO: ${member.membership_number || 'N/A'}`, 140, 20);

  doc.setLineWidth(0.8);
  doc.setDrawColor(15, 23, 42);
  doc.line(15, 32, 195, 32);

  let y = 42;
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Legal Name: ${member.guest_name || 'N/A'}`, 15, y);
  doc.text(`Tier: ${member.category_name || member.package_type || 'Custom'}`, 110, y);

  y += 7;
  doc.text(`Contact: ${member.email || 'N/A'} / ${member.phone || 'N/A'}`, 15, y);
  doc.text(`Type: ${member.membership_type || 'New'} (${member.access_type || 'Both'})`, 110, y);

  y += 7;
  doc.text(`Commencement: ${member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : 'N/A'}`, 15, y);
  doc.text(`Expiry Date: ${member.current_end_date ? format(parseISO(member.current_end_date), 'dd MMM yyyy') : 'N/A'}`, 110, y);

  y += 10;
  doc.setFontSize(12);
  doc.text(`Total Contribution: QAR ${(member.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 15, y);

  y += 20;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`System ID: ${member.id ? String(member.id).substring(0, 8) : 'RECORD'} • Page 1 of 2`, 105, 280, { align: 'center' });

  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('GYMNASIUM RULES & REGULATIONS', 105, 20, { align: 'center' });
  doc.line(15, 25, 195, 25);

  let ry = 35;
  doc.setFontSize(8);
  GYM_RULES.forEach((rule, idx) => {
    doc.text(`${idx + 1}. ${rule.en}`, 15, ry);
    ry += 6;
  });

  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
