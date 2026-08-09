export const getOutletArabicName = (outletName?: string): string => {
  if (!outletName) return 'نادي الشعلة';
  const nameLower = outletName.toLowerCase();
  if (nameLower.includes('torch')) return 'نادي الشعلة';
  if (nameLower.includes('padel')) return 'نادي البادل';
  if (nameLower.includes('health') || nameLower.includes('fitness')) return 'النادي الصحي';
  if (nameLower.includes('spa')) return 'السبا والنادي الصحي';
  if (nameLower.includes('pool') || nameLower.includes('swimming')) return 'حمام السباحة والنادي الصحي';
  return `مرافق ${outletName}`;
};

export const getBilingualWaiverText = (outletNameInput?: string, hotelNameInput?: string) => {
  const outletName = outletNameInput || 'The Torch Club';
  const outletNameAr = getOutletArabicName(outletNameInput);
  const hotelName = hotelNameInput || 'The Torch Doha (“Hotel”)';
  const hotelNameAr = 'فندق ذا تورش الدوحة ("الفندق")';

  return {
    outletName,
    outletNameAr,
    hotelName,
    hotelNameAr,

    // 1. IMPORTANT DISCLAIMER
    importantDisclaimerEn: `By signing in and/or use of ${outletName} Facilities, I agree to ${outletName} Facilities and Exercise Waiver (printed overleaf), as if such document were signed by me directly, and waive any and all claims or liability against ${hotelName}, that may arise as a result of my use of ${outletName} Facilities or my participation in any exercise classes or group exercise events at ${outletName} Facilities. USE OF EQUIPMENTS AND FACILITIES IS AT MY OWN RISK.`,
    
    importantDisclaimerAr: `بموجب انضمامي و/أو استخدامي لمرافق ${outletNameAr} ، فأنا أوافق على لوائح مرافق ${outletNameAr} ، والتنازل عن المسؤولية عن التمارين (المطبوع على ظهر الصفحة). كما لو كان هذا المستند موقع شخصياً بصورة مباشرة من طرفي، وأتنازل بموجب هذا عن أي جميع المطالبات أو مسؤولية ضد ${hotelNameAr}، والتي قد تنشأ نتيجة لاستخدامي لمرافق ${outletNameAr} أو مشاركتي في أي دروس تمرينات رياضية أو فاعليات تمارين جماعية في ${outletNameAr} ، و أتحمل المخاطر المرافقة لهذه المرافق بالنادي.`,

    // 2. FULL WAIVER HEADER
    waiverTitleEn: `${outletName} FACILITIES AND EXERCISE WAIVER`,
    waiverSubEn: `PLEASE READ THIS CAREFULLY`,
    waiverTitleAr: `التنازل عن المسؤولية عن التمارين ومرافق ${outletNameAr}`,
    waiverSubAr: `الرجاء القراءة بعناية`,

    // 3. FULL WAIVER PARAGRAPHS
    p1En: `IN CONSIDERATION for being allowed to use the hotel “${outletName}” facilities, which includes, but is not limited to, participating in any exercise classes or group exercise events at ${outletName} and/or using any of the equipment at ${outletName} and/or swimming pool (the “${outletName} Facilities”), I hereby waive, on my own behalf and on behalf of all persons claiming by, through, or under me, any and all claims that I have or may have against ${outletName}, or any person or entity who directly or indirectly, through one or more intermediaries, controls or is controlled by, or is under common control with ${outletName}, the legal entity that owns the Hotel, on account of any bodily injury, (including death), personal property loss, or other damages of any kind whatsoever, for negligence or otherwise, arising out of my use of ${outletName} Facilities. I acknowledge that I use ${outletName} Facilities at my own risk and hereby assume all risk of injury associated with my participation in and/or use of ${outletName} Facilities, known or unknown, inherent or otherwise, including but not limited to, injury and/or death to me or to third parties.`,

    p1Ar: `في مقابل السماح باستخدام مرافق " ${outletNameAr} " بالفندق، والتي تتضمن، ولكن لا تقتصر على، المشاركة في أي دروس تمرينات رياضية أو فاعليات تمارين جماعية في الفندق و/أو استخدام المعدات الرياضية في ${outletNameAr} و/أو حمام السباحة (مرافق ${outletNameAr}) و أتنازل بموجب هذا بالأصالة عن نفسي و بالنيابة عن جميع الأشخاص الذين يحق لهم المطالبة من خلالي أو بواسطتي عن أي و جميع المطالبات تخصني أو ربما تخصني ضد ${outletNameAr} أو أي شخص أو كيان يسيطر بشكل مباشر أو غير مباشر ، من خلال وسيط أو أكثر, أو يقع تحت السيطرة المشتركة لنادي الشعلة أو الكيان القانوني الذي يملك الفندق فيما يتعلق بالإصابات الجسدية, (بما في ذلك الوفاة), و فقدان الممتلكات الشخصية, أو غيرها من الأضرار من أي نوع كانت, الناتجة عن الإهمال أو غيره, و الناشئة عن استخدامي لمرافق ${outletNameAr}, و أقر بموجب هذا أنني استخدم مرافق ${outletNameAr} على مسؤوليتي الخاصة و أتحمل بموجب هذا جميع مخاطر الإصابة المرنبطة بمشاركتي في و/أو استخدامي لمرافق ${outletNameAr}, المعروفة أو غير المعروفة, أو الملازمة لذلك أو غير ذلك. بما في ذلك على سبيل المثال لا الحصر الإصابة و/أو الوفاة بالنسبة لي أو لأي طرف ثالث.`,

    p2En: `I will indemnify and save harmless ${outletName}, or any of its affiliates, and respective officers, directors, shareholders, partners, employees, members and agents from all claims, demands, penalties, liabilities, causes of action, and actions, and from any and all loss, cost, and expense associated therewith or derived therefrom (including, without limitation, attorneys’ fees and paralegal fees, and disbursements through all appeals) for damages and injuries of all kinds sustained by me including, without limitation, claims for personal injury and death (negligent or intentional), claims arising out of my negligent act(s) or omission(s), or claims that I may have against any third parties that may arise as a result of my use of ${outletName} Facilities.`,

    p2Ar: `وأعوض وأحمي ${outletNameAr}, أو أيا من الشركات التابعة له و مسؤوليه و مديريه و المساهمين و الشركاء به و موظفيه و أعضائه ووكلائه من جميع المطالبات و الطلبات و العقوبات و الدعاوى و من أي و كافة الخسائر و التكاليف و النفقات المرتبطة بها أو المشتقة منها (بما في ذلك على سبيل المثال و ليس الحصر. أتعاب المحاماة و الرسوم شبه القانونية, و المدفوعات بواسطة جميع الطعون) الناتجة عن الأضرار  و الإصابات من جميع الأنواع التي لحقت بي بما في ذلك, دون حصر, المطالبات عن الإصابة الشخصية و الوفاة (عن طريق الإهمال أو التعمد), و المطالبات الناشئة عن الإهمال أو السهو أو المطالبات التي تخصني ضد أي طرف ثالث و التي قد تنشأ نتيجة استخدامي لمرافق ${outletNameAr}.`,

    p3En: `I attest that I have carefully read and understand this Waiver. By signing the attached sign-in sheet and/or using ${outletName} Facilities, I fully agree to the terms and conditions of this Waiver, with full knowledge of its significance.`,

    p3Ar: `أقرّ أنني قد قرأت هذا التنازل بعناية و فهمته, و بموجب توقيعي على صحيفة الانضمام المرفقة و/أو استخدام مرافق ${outletNameAr} ، فأنا أوافق تمامًا على شروط وأحكام هذا التنازل، مع علمي الكامل بأهميته.`
  };
};
