export type PosReadinessState =
  | "login_required"
  | "no_device"
  | "device_inactive"
  | "store_mismatch"
  | "store_required"
  | "access_denied"
  | "cashier_required"
  | "role_denied"
  | "no_session"
  | "session_warning"
  | "session_expired"
  | "ready";

export const POS_READINESS_COPY: Record<
  PosReadinessState,
  { title: string; description: string; href?: string; cta?: string }
> = {
  login_required: {
    title: "دخول الكاشير",
    description: "اكتب رقم PIN لفتح نقطة البيع من رابط الفرع.",
    href: "/pos",
    cta: "فتح الكاشير",
  },
  no_device: {
    title: "جاري تجهيز الكاشير",
    description: "بنجهّز نقطة البيع على الرابط ده. لو الرسالة فضلت، افتح رابط الفرع من /pos.",
    href: "/pos",
    cta: "اختيار الفرع",
  },
  device_inactive: {
    title: "جاري تجهيز الكاشير",
    description: "بنجهّز نقطة البيع تلقائيًا. افتح رابط الفرع لو الرسالة فضلت ظاهرة.",
    href: "/pos",
    cta: "اختيار الفرع",
  },
  store_mismatch: {
    title: "فرع غير مطابق",
    description: "اختار الفرع الصحيح أو افتح رابط الفرع المناسب زي /nutalla/pos.",
  },
  store_required: {
    title: "اختيار الفرع",
    description: "اختار الفرع اللي هتشتغل عليه، أو افتح رابط الفرع مباشرة.",
  },
  access_denied: {
    title: "غير مسموح",
    description: "حسابك مش مسموح يستخدم نقطة البيع على الفرع ده. راجع الصلاحيات مع المدير.",
  },
  cashier_required: {
    title: "مطلوب PIN الكاشير",
    description: "أدخل رقم PIN لفتح نقطة البيع. اقفل الشاشة من زر القفل لما تسيب الكاشير.",
  },
  role_denied: {
    title: "نقطة البيع غير متاحة",
    description: "دورك الحالي مش بيسمح باستخدام الكاشير. سجّل دخول كمالك أو مدير أو كاشير.",
  },
  no_session: {
    title: "ابدأ الوردية",
    description: "اضغط «ابدأ البيع» مرة واحدة ثم تقدر تبيع.",
  },
  session_warning: {
    title: "الوردية قربت تخلص",
    description: "الجلسة قربت توصل للحد الأقصى. اقفلها قريب.",
  },
  session_expired: {
    title: "اقفل الوردية للمتابعة",
    description: "الجلسة عدّت المدة المسموحة. البيع متوقف لحد ما تقفل الوردية.",
  },
  ready: {
    title: "جاهز",
    description: "تقدر تبيع دلوقتي.",
  },
};
