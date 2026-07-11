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
    title: "يلزم تسجيل الدخول",
    description: "سجّل الدخول بحساب كاشير أو مدير أو مالك.",
    href: "/login",
    cta: "تسجيل الدخول",
  },
  no_device: {
    title: "الجهاز غير مربوط",
    description:
      "هذا المتصفح مش مربوط كجهاز كاشير. اربطه مرة من الإعدادات ← الأجهزة، واستخدم نفس الرابط على الجهاز ده.",
    href: "/device/pair",
    cta: "ربط الجهاز",
  },
  device_inactive: {
    title: "الجهاز غير نشط",
    description: "الجهاز موجود بس متعطّل. اطلب من المدير تفعيله من الإعدادات ← الأجهزة.",
  },
  store_mismatch: {
    title: "فرع غير مطابق",
    description:
      "المتصفح مربوط بفرع مختلف عن الفرع النشط. اختار الفرع الصحيح أو اربط الجهاز تاني للفرع الحالي.",
  },
  store_required: {
    title: "اختيار الفرع",
    description: "اختار الفرع اللي هتشتغل عليه.",
  },
  access_denied: {
    title: "غير مسموح",
    description: "حسابك مش مسموح يستخدم نقطة البيع على الفرع أو الجهاز ده. راجع الصلاحيات مع المدير.",
  },
  cashier_required: {
    title: "مطلوب PIN الكاشير",
    description: "أدخل رقم PIN الكاشير على الجهاز قبل البيع.",
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
    description: "تقدر تبيع على الجهاز ده.",
  },
};
