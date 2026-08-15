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
  const outletName = outletNameInput || 'the Health Club';
  const outletNameAr = getOutletArabicName(outletNameInput);
  const hotelName = hotelNameInput || 'the Facility (“Facility”)';
  const hotelNameAr = 'المنشأة ("المنشأة")';

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

export const getBilingualPTConsentText = (clubNameInput?: string) => {
  const clubName = clubNameInput || 'The Torch Club';
  const clubNameAr = getOutletArabicName(clubNameInput);

  return {
    clubName,
    clubNameAr,
    titleEn: 'Health Declaration & Participation Consent Form',
    titleAr: 'إقرار الحالة الصحية والموافقة على المشاركة',

    introParagraphs: [
      {
        en: `I understand that participation in ${clubName} services involves physical activity and exposure to environmental conditions (including heat, salt, and humidity), which may involve risks such as muscle or joint injury, dehydration, dizziness, allergic or adverse reactions to nutrition guidance, salt room or sauna exposure, and accidents within the facility.`,
        ar: `أقر بأن المشاركة في خدمات ${clubNameAr} تتضمن ممارسة أنشطة بدنية والتعرض لعوامل بيئية (مثل الحرارة والملح والرطوبة)، والتي قد تنطوي على مخاطر تشمل، على سبيل المثال لا الحصر، إصابات العضلات أو المفاصل، والجفاف، والدوخة، وردود الفعل السلبية تجاه الإرشادات الغذائية، أو غرفة الملح أو الساونا، بالإضافة إلى الحوادث التي قد تقع داخل مرافق النادي.`
      },
      {
        en: `I confirm that I have no known medical condition that would make participation unsafe, or I have informed ${clubName} of any relevant health conditions. I agree to seek medical clearance if necessary and to notify staff immediately of any changes to my health.`,
        ar: `أؤكد أنه لا توجد لدي أي حالة صحية معروفة تمنعني من المشاركة بأمان، أو أنني قمت بإبلاغ ${clubNameAr} بأي حالة صحية ذات صلة. كما أتعهد بالحصول على موافقة طبية عند الحاجة، وإبلاغ موظفي النادي فورًا بأي تغيير يطرأ على حالتي الصحية.`
      },
      {
        en: `Participation is voluntary, and I may stop at any time, understanding this may affect my personal goals.`,
        ar: `أفهم أن المشاركة اختيارية، ويحق لي التوقف في أي وقت، مع إدراكي أن ذلك قد يؤثر على تحقيق أهدافي الشخصية.`
      }
    ],

    parqTitleEn: 'PAR-Q (Physical Activity Readiness Questionnaire)',
    parqTitleAr: 'استبيان الجاهزية لممارسة النشاط البدني',
    parqInstructionEn: 'Please answer Yes or No:',
    parqInstructionAr: 'يرجى الإجابة بـ نعم أو لا على الأسئلة التالية:',

    parqQuestions: [
      {
        id: 1,
        en: 'Has a doctor ever told you that you have a heart condition or should only exercise under medical supervision?',
        ar: 'هل سبق أن أخبرك طبيب بأن لديك مرضًا في القلب أو أوصى بأن تمارس النشاط البدني فقط تحت إشراف طبي؟'
      },
      {
        id: 2,
        en: 'Do you experience chest pain, dizziness, fainting, or loss of balance during physical activity?',
        ar: 'هل تعاني من ألم في الصدر، أو دوخة، أو إغماء، أو فقدان للتوازن أثناء ممارسة النشاط البدني؟'
      },
      {
        id: 3,
        en: 'Do you have any bone, joint, muscle, or back condition that could be aggravated by exercise?',
        ar: 'هل لديك أي مشكلة في العظام أو المفاصل أو العضلات أو الظهر قد تتفاقم بسبب ممارسة التمارين الرياضية؟'
      },
      {
        id: 4,
        en: 'Are you taking any medication that may affect your ability to exercise safely?',
        ar: 'هل تتناول حاليًا أي أدوية قد تؤثر على قدرتك على ممارسة التمارين الرياضية بأمان؟'
      },
      {
        id: 5,
        en: 'Are you currently pregnant or have you given birth within the past six months?',
        ar: 'هل أنتِ حامل حاليًا، أو أنجبتِ طفلًا خلال الأشهر الستة الماضية؟'
      },
      {
        id: 6,
        en: 'Do you have any other medical condition, injury, recent surgery, or health concern your trainer should know about?',
        ar: 'هل لديك أي حالة طبية، أو إصابة، أو عملية جراحية حديثة، أو أي مشكلة صحية أخرى ينبغي أن يكون المدرب على علم بها؟'
      }
    ],

    parqDetailsPromptEn: 'If yes, please provide details:',
    parqDetailsPromptAr: 'في حال كانت الإجابة نعم، يرجى ذكر التفاصيل:',

    declarationTitleEn: 'Declaration',
    declarationTitleAr: 'الإقرار',

    declarationParagraphs: [
      {
        en: 'I confirm that the information provided is true and complete to the best of my knowledge. If I answered "Yes" to any question above, I understand that I may be asked to obtain medical clearance before participating.',
        ar: 'أقر بأن جميع المعلومات التي قدمتها صحيحة وكاملة حسب علمي. وأفهم أنه إذا كانت إجابتي "نعم" على أي من الأسئلة أعلاه، فقد يُطلب مني الحصول على موافقة أو تقرير طبي قبل المشاركة.'
      },
      {
        en: 'I accept full responsibility for my participation and agree to stop exercising and inform staff immediately if I experience pain, dizziness, shortness of breath, or any unusual symptoms.',
        ar: 'أتحمل المسؤولية الكاملة عن مشاركتي، وأتعهد بالتوقف عن ممارسة النشاط وإبلاغ موظفي النادي فورًا إذا شعرت بألم أو دوخة أو ضيق في التنفس أو أي أعراض غير طبيعية.'
      },
      {
        en: `I release and hold harmless ${clubName}, its owners, employees, and affiliates from liability for injury, illness, loss, or damage arising from my participation or use of its facilities, equipment, or services, except where caused by gross negligence or willful misconduct.`,
        ar: `أوافق على إبراء ذمة ${clubNameAr} وملاكه وموظفيه والجهات التابعة له من أي مسؤولية عن أي إصابة أو مرض أو خسارة أو ضرر ناتج عن مشاركتي أو استخدامي للمرافق أو المعدات أو الخدمات، باستثناء الحالات الناتجة عن الإهمال الجسيم أو سوء السلوك المتعمد.`
      },
      {
        en: `I understand that ${clubName} is not responsible for the loss, theft, or damage of personal belongings.`,
        ar: `كما أقر بأن ${clubNameAr} غير مسؤول عن فقدان أو سرقة أو تلف أي من متعلقاتي الشخصية.`
      },
      {
        en: 'I agree to follow all club rules, staff instructions, and health and safety procedures. Failure to do so may result in suspension or termination of services without refund.',
        ar: 'أوافق على الالتزام بجميع أنظمة النادي وتعليمات الموظفين وإجراءات الصحة والسلامة. ويحق للنادي تعليق أو إنهاء تقديم الخدمات في حال عدم الالتزام بهذه التعليمات، وذلك دون استرداد الرسوم.'
      },
      {
        en: 'I consent to the collection and use of my personal and health information for service delivery and safety in accordance with Qatar Law No. 13 of 2016, and understand that my information will not be shared except with my consent or where required by law.',
        ar: `أوافق على قيام ${clubNameAr} بجمع واستخدام بياناتي الشخصية والصحية لأغراض تقديم الخدمات وضمان السلامة، وذلك وفقًا لأحكام قانون حماية خصوصية البيانات الشخصية رقم (13) لسنة 2016 في دولة قطر. ولن تتم مشاركة هذه البيانات إلا بموافقتي أو إذا كان ذلك مطلوبًا بموجب القانون.`
      },
      {
        en: 'I have read, understood, and voluntarily agree to the terms of this Health Declaration & Participation Consent Form.',
        ar: 'أقر بأنني قرأت هذا النموذج وفهمت جميع بنوده، وأوافق عليها بمحض إرادتي.'
      }
    ],

    under18TitleEn: 'For Participants Under 18',
    under18TitleAr: 'للمشاركين الذين تقل أعمارهم عن 18 عامًا',
    under18TextEn: (guardianName?: string, participantName?: string) => 
      `I ${guardianName || '_____________________'} (Parent/Legal Guardian Name) confirm that I am the parent\\legal guardian of ${participantName || '___________________'} (Participant's Name) and consent to their participation in ${clubName}'s services. I have read, understood, and agree to the terms of this Health Declaration & Participation Consent Form on their behalf.`,
    under18TextAr: (guardianName?: string, participantName?: string) => 
      `أنا ${guardianName || '_____________________'} (اسم ولي أمر / الوصي القانوني) أُقر بأنني ولي الأمر أو الوصي القانوني لـ ${participantName || '___________________'} (اسم المشارك)، وأوافق على مشاركته في خدمات ${clubNameAr}. كما أؤكد أنني قرأت وفهمت وأوافق على شروط وأحكام إقرار الحالة الصحية والموافقة على المشاركة نيابةً عنه.`
  };
};
