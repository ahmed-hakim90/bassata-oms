"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, Banknote, ClipboardList, Search, ShoppingCart, Wallet } from "lucide-react";
import { CategoryRail } from "@/modules/pos/components/category-rail";
import { CartPanel } from "@/modules/pos/components/cart-panel";
import { ProductTile } from "@/modules/pos/components/product-tile";
import { VariantPickerDialog } from "@/modules/pos/components/variant-picker-dialog";
import {
  openCashDrawerHook,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { checkoutAction } from "@/modules/pos/actions/checkout.action";
import { openCashDrawerAction } from "@/modules/pos/actions/cash-drawer.action";
import type { POSProduct, POSVariant } from "@/modules/pos/services/catalog.service";
import {
  buildWhatsAppReceiptUrl,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { findPosProductByBarcode } from "@/modules/pos/utils/barcode-lookup";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import type { Category, CostCenter, ExpenseCategory, Product } from "@/lib/types";
import type { ExpenseSettings, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { FeatureFlag } from "@/lib/constants";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { usePosStore, getCartTotal } from "@/stores/pos-store";
import { PosReadinessBanner } from "@/components/SweetFlow/pos-readiness-banner";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { POS_READINESS_COPY } from "@/lib/auth/pos-readiness-copy";
import { ExpenseWizard } from "@/modules/expenses/components/expense-wizard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import { requiresManagerDiscountOverride } from "@/modules/pos/services/manager-override.service";
import { WeightAmountModal } from "@/modules/pos/components/weight-amount-modal";
import { PosDeviceGate } from "@/modules/pos/components/pos-device-gate";
import { PosStoreGate } from "@/modules/pos/components/pos-store-gate";
import { PosAccessDenied } from "@/modules/pos/components/pos-access-denied";
import { PosCloseSessionDialog } from "@/modules/pos/components/pos-close-session-dialog";
import { ManagerOverrideDialog } from "@/modules/pos/components/manager-override-dialog";
import { PosCreditCheckoutDialog } from "@/modules/pos/components/pos-credit-checkout-dialog";
import type { CreditCheckoutConfirm } from "@/modules/pos/components/pos-credit-checkout-dialog";
import { recordCustomerPaymentAction } from "@/modules/customers/actions/customer.actions";
import { PosCollectFlowDialog } from "@/modules/pos/components/pos-collect-flow-dialog";
import { PosReceiptSuccessDialog } from "@/modules/pos/components/pos-receipt-success-dialog";
import { QuickOpenSessionButton } from "@/modules/sessions/components/quick-open-session-button";
import type { Device } from "@/lib/repositories/device.repository";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import type { CashierSession, Expense, Store } from "@/lib/types";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import type {
  OnlineOrderWithItems,
  StaffOnlineProductOption,
} from "@/modules/online-orders/services/online-order.service";

interface PosScreenProps {
  categories: Category[];
  initialProducts: POSProduct[];
  hasActiveSession: boolean;
  enabledPaymentMethods: PaymentMethod[];
  readinessState: PosReadinessState;
  sessionId?: string | null;
  cashierId?: string | null;
  storeId?: string;
  costCenters?: CostCenter[];
  expenseCategories?: ExpenseCategory[];
  inventoryProducts?: Product[];
  expenseSettings?: ExpenseSettings;
  canAddSessionExpense?: boolean;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  canManagerOverride?: boolean;
  canCollectPayment?: boolean;
  managerDiscountOverrideAmount?: number | null;
  currentUserName?: string | null;
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
  receiptBranding: ReportBranding;
  onlineOrders?: OnlineOrderWithItems[];
  onlineOrderProducts?: StaffOnlineProductOption[];
  stores?: Store[];
  activeSession?: CashierSession | null;
  sessionReconciliation?: SessionReconciliation | null;
  sessionExpenses?: Expense[];
  cashierName?: string | null;
  costCenterMap?: Record<string, string>;
  expenseCategoryMap?: Record<string, string>;
  storeDevices?: Device[];
}

export function PosScreen({
  categories,
  initialProducts,
  hasActiveSession,
  enabledPaymentMethods,
  readinessState,
  sessionId,
  cashierId,
  storeId,
  costCenters = [],
  expenseCategories = [],
  inventoryProducts = [],
  expenseSettings,
  canAddSessionExpense = false,
  featureFlags = {},
  canManagerOverride = false,
  canCollectPayment = false,
  managerDiscountOverrideAmount = null,
  currentUserName = null,
  loyaltyRedemptionRate = null,
  minimumLoyaltyRedeemPoints = 0,
  receiptBranding,
  onlineOrders = [],
  onlineOrderProducts = [],
  stores = [],
  activeSession = null,
  sessionReconciliation = null,
  sessionExpenses = [],
  cashierName = null,
  costCenterMap,
  expenseCategoryMap,
  storeDevices = [],
}: PosScreenProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [attachExpanded, setAttachExpanded] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [onlineOrdersOpen, setOnlineOrdersOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerProduct, setPickerProduct] = useState<POSProduct | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const addItem = usePosStore((s) => s.addItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const salesMode = usePosStore((s) => s.salesMode);
  const [weightProduct, setWeightProduct] = useState<POSProduct | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{
    kind: "checkout" | "cash_drawer";
    title: string;
    defaultReason: string;
    payments?: PaymentSplit[];
    accountCollection?: number;
  } | null>(null);

  const barcodeEnabled = featureFlags.barcode_scanner !== false;
  const receiptEnabled = featureFlags.receipt_printing !== false;
  const checkoutBlocked =
    readinessState !== "ready" &&
    readinessState !== "session_warning" &&
    !(readinessState === "session_expired" && canManagerOverride);
  const cashDrawerEnabled = featureFlags.cash_drawer === true;
  const discountsEnabled = featureFlags.customer_discounts === true;
  const loyaltyEnabled = featureFlags.loyalty !== false;
  const cartTotal = getCartTotal(cart, discountAmount);
  const cartItemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const noPaymentMethods = enabledPaymentMethods.length === 0;
  const checkoutBlockedReason = pending
    ? "جاري إتمام البيع…"
    : readinessState === "session_expired"
      ? "أقفل الوردية عشان تكمّل البيع"
      : readinessState === "no_session"
        ? "افتح جلسة كاشير الأول"
        : checkoutBlocked
          ? POS_READINESS_COPY[readinessState]?.title ?? "الكاشير مش جاهز للبيع دلوقتي"
          : noPaymentMethods
            ? "مفيش طريقة دفع مفعّلة من الإعدادات"
            : null;
  const payLocked = checkoutBlocked || pending || noPaymentMethods;

  function cartCheckout(method?: PaymentMethod) {
    if (!method) return;
    setPaymentMethod(method);
    if (method === "credit") {
      setCreditOpen(true);
      return;
    }
    const total = Math.max(
      0,
      getCartTotal(cart, discountAmount) - (loyaltyRedemption?.amount ?? 0)
    );
    handleComplete([{ method, amount: total }]);
  }
  const activeOnlineOrdersCount = onlineOrders.filter(
    (order) => order.status !== "cancelled" && order.status !== "invoiced"
  ).length;

  const products = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const categoryProducts = categoryId
      ? initialProducts.filter((p) => p.category_id === categoryId)
      : initialProducts;

    if (!normalizedSearch) return categoryProducts;

    return categoryProducts.filter((product) => {
      const searchableText = [
        product.name,
        product.categoryName,
        product.sku,
        product.barcode,
        formatCurrency(product.base_price),
        ...product.variants.flatMap((variant) => [
          variant.name,
          variant.sku,
          variant.barcode,
          formatCurrency(variant.price),
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [categoryId, initialProducts, searchTerm]);

  function addToCart(product: POSProduct, variant: POSVariant | null) {
    const name = variant ? `${product.name} — ${variant.name}` : product.name;
    const unitPrice = variant ? variant.price : product.base_price;
    addItem({
      productId: product.id,
      variantId: variant?.id ?? null,
      name,
      quantity: 1,
      unitPrice,
      modifiers: [],
      imageUrl: variant?.imageUrl ?? product.image_url,
    });
  }

  function handleAdd(product: POSProduct) {
    if (product.supports_weight_sale || product.supports_amount_sale) {
      setWeightProduct(product);
      return;
    }
    if (product.hasVariants && product.variants.length > 0) {
      setPickerProduct(product);
      return;
    }
    addToCart(product, null);
  }

  function handleBarcodeSubmit(raw: string) {
    const trimmed = raw.trim();
    const match = barcodeEnabled ? findPosProductByBarcode(initialProducts, trimmed) : null;

    if (!match && products.length !== 1) {
      playPosErrorSound();
      toast.error("المنتج غير موجود");
      return;
    }

    const { product, variant } = match ?? { product: products[0]!, variant: null };
    if (product.hasVariants && !variant) {
      setPickerProduct(product);
      return;
    }
    addToCart(product, variant);
    setSearchTerm("");
  }

  function runCheckout(
    payments: PaymentSplit[],
    overrideReason?: string,
    accountCollection = 0
  ) {
    const checkoutPaymentMethod = payments[0]?.method ?? paymentMethod;
    const needsDiscountOverride = requiresManagerDiscountOverride(
      discountAmount,
      managerDiscountOverrideAmount
    );
    const needsExpiredSessionOverride =
      readinessState === "session_expired" && canManagerOverride;
    startTransition(async () => {
      const receiptCart = [...cart];
      const receiptCustomer = customer ? { name: customer.name, phone: customer.phone } : null;
      const attachedCustomer = customer;
      const collectionMethod =
        payments.find((payment) => payment.method !== "credit")?.method ?? "cash";
      const redemptionAmount = loyaltyRedemption?.amount ?? 0;
      const receiptDiscount = discountAmount + redemptionAmount;
      const receiptTotal = Math.max(0, getCartTotal(cart, discountAmount) - redemptionAmount);
      try {
        const result = await checkoutAction({
          cart,
          customer,
          paymentMethod: checkoutPaymentMethod,
          payments,
          salesMode,
          discount: discountAmount,
          loyaltyPoints: loyaltyRedemption?.points,
          override:
            needsDiscountOverride || needsExpiredSessionOverride
              ? {
                  discount: needsDiscountOverride || undefined,
                  expiredSession: needsExpiredSessionOverride || undefined,
                  reason: overrideReason,
                }
              : undefined,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
        if (!result.orderNumber) {
          throw new Error("فشل إتمام البيع");
        }

        let collectionNote = "";
        if (
          accountCollection > 0.001 &&
          attachedCustomer &&
          collectionMethod !== "credit"
        ) {
          const collected = await recordCustomerPaymentAction({
            customerId: attachedCustomer.id,
            amount: accountCollection,
            paymentMethod: collectionMethod,
            reference: result.orderNumber,
            notes: `تحصيل مع فاتورة ${result.orderNumber}`,
          });
          if (!collected.success) {
            toast.error(`تم البيع، لكن تحصيل المستحق فشل: ${collected.error}`);
          } else {
            collectionNote = ` · وتحصيل ${formatCurrency(accountCollection)} من الحساب`;
          }
        }

        setOverrideDialog(null);
        if (cashDrawerEnabled && payments.some((payment) => payment.method === "cash")) {
          openCashDrawerHook();
        }
        if (receiptEnabled) {
          setLastReceipt({
            orderNumber: result.orderNumber,
            createdAt: new Date().toISOString(),
            paymentMethod: checkoutPaymentMethod,
            payments,
            lines: receiptCart,
            discount: receiptDiscount,
            total: receiptTotal,
            customer: receiptCustomer,
            branding: receiptBranding,
          });
        }
        clearCart();
        setCreditOpen(false);
        playPosSuccessSound();
        toast.success(`تم إتمام الطلب ${result.orderNumber}${collectionNote}`);
      } catch (error) {
        playPosErrorSound();
        toast.error(error instanceof Error ? error.message : "فشل إتمام البيع");
      }
    });
  }

  function handleCreditConfirm({ payments, accountCollection }: CreditCheckoutConfirm) {
    handleComplete(payments, accountCollection);
  }

  function handleComplete(payments: PaymentSplit[], accountCollection = 0) {
    if (payments.some((payment) => payment.method === "credit") && !customer) {
      playPosErrorSound();
      toast.error("اختر عميلًا للبيع الآجل");
      return;
    }
    const needsDiscountOverride = requiresManagerDiscountOverride(
      discountAmount,
      managerDiscountOverrideAmount
    );
    const needsExpiredSessionOverride =
      readinessState === "session_expired" && canManagerOverride;
    if (needsDiscountOverride && !canManagerOverride) {
      playPosErrorSound();
      toast.error("هذا الخصم يحتاج موافقة المالك أو المدير");
      return;
    }
    if (needsDiscountOverride || needsExpiredSessionOverride) {
      const both = needsDiscountOverride && needsExpiredSessionOverride;
      setOverrideDialog({
        kind: "checkout",
        title: both
          ? "موافقة بيع بعد انتهاء الجلسة مع خصم"
          : needsExpiredSessionOverride
            ? "موافقة بيع بعد انتهاء الجلسة"
            : "موافقة المدير على الخصم",
        defaultReason: both
          ? "تمت الموافقة على بيع بخصم بعد انتهاء الجلسة"
          : needsExpiredSessionOverride
            ? "تمت الموافقة على بيع بعد انتهاء الجلسة"
            : "تمت الموافقة على الخصم",
        payments,
        accountCollection,
      });
      return;
    }
    runCheckout(payments, undefined, accountCollection);
  }

  if (readinessState === "no_device") {
    return <PosDeviceGate devices={storeDevices} />;
  }

  if (readinessState === "store_required" || readinessState === "store_mismatch") {
    return (
      <PosStoreGate
        stores={stores}
        activeStoreId={storeId}
        readinessState={readinessState}
        title={readinessState === "store_mismatch" ? "تغيير الفرع" : "اختيار الفرع"}
        description={
          readinessState === "store_mismatch"
            ? "هذا الجهاز مربوط بفرع مختلف. اختر الفرع الصحيح للمتابعة."
            : "اختر الفرع الذي ستعمل عليه في نقطة البيع."
        }
      />
    );
  }

  if (
    readinessState === "access_denied" ||
    readinessState === "role_denied" ||
    readinessState === "device_inactive"
  ) {
    return <PosAccessDenied state={readinessState} />;
  }

  const sessionBannerAction =
    readinessState === "no_session" ? (
      <QuickOpenSessionButton size="sm" label="ابدأ البيع" />
    ) : activeSession && sessionReconciliation ? (
      <PosCloseSessionDialog
        session={activeSession}
        reconciliation={sessionReconciliation}
        sessionExpenses={sessionExpenses}
        cashierName={cashierName ?? "الكاشير"}
        costCenterMap={costCenterMap}
        categoryMap={expenseCategoryMap}
        triggerVariant={readinessState === "session_expired" ? "destructive" : "outline"}
        triggerChildren={
          readinessState === "session_expired" || readinessState === "session_warning"
            ? "إغلاق الوردية"
            : "إغلاق الجلسة"
        }
      />
    ) : null;

  function handleOpenCashDrawer() {
    setOverrideDialog({
      kind: "cash_drawer",
      title: "فتح درج النقدية",
      defaultReason: "فتح درج النقدية يدويًا",
    });
  }

  function confirmCashDrawer(reason: string) {
    startTransition(async () => {
      try {
        await openCashDrawerAction(reason);
        openCashDrawerHook();
        setOverrideDialog(null);
        toast.success("تم فتح درج النقدية");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر فتح درج النقدية");
      }
    });
  }

  async function handleUsbPrintReceipt() {
    if (!lastReceipt) {
      toast.error("تعذرت طباعة الإيصال");
      return;
    }
    try {
      await printReceiptViaUsb(lastReceipt);
      toast.success("تم إرسال الإيصال لطابعة USB");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  function handleBrowserPrintReceipt() {
    if (!lastReceipt) {
      toast.error("تعذرت طباعة الإيصال");
      return;
    }
    if (typeof document !== "undefined" && !document.getElementById("CafeFlow-receipt")) {
      toast.error("تعذرت طباعة الإيصال — الإيصال غير جاهز");
      return;
    }
    setTimeout(() => triggerReceiptPrint(), 50);
  }

  function handleSendWhatsAppReceipt() {
    if (!lastReceipt) return;
    const url = buildWhatsAppReceiptUrl(lastReceipt);
    if (!url) {
      toast.error("رقم هاتف العميل غير صالح لواتساب");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
    <div className="print:hidden flex h-dvh max-h-dvh flex-col gap-3 overflow-hidden p-3 lg:gap-4 lg:p-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <PosReadinessBanner state={readinessState} action={sessionBannerAction} />
          {currentUserName ? (
            <span className="hidden max-w-40 truncate rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground lg:inline-flex">
              {currentUserName}
            </span>
          ) : null}
        </div>

        {hasActiveSession ? (
          <div className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-w-[5.5rem] flex-1 justify-center gap-1.5 rounded-xl border-sky-200 bg-sky-50 px-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20"
              onClick={() => setOnlineOrdersOpen(true)}
            >
              <ClipboardList className="size-4 shrink-0" />
              <span className="truncate">أونلاين</span>
              {activeOnlineOrdersCount > 0 ? (
                <span className="rounded-full bg-sky-700 px-1.5 py-0.5 text-[11px] text-white dark:bg-sky-400 dark:text-sky-950">
                  {activeOnlineOrdersCount}
                </span>
              ) : null}
            </Button>
            {canCollectPayment ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10 min-w-[5.5rem] flex-1 justify-center gap-1.5 rounded-xl border-emerald-200 bg-emerald-50 px-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                onClick={() => setCollectOpen(true)}
              >
                <Banknote className="size-4 shrink-0" />
                <span className="truncate">تحصيل</span>
              </Button>
            ) : null}
            {canAddSessionExpense && storeId && cashierId && sessionId ? (
              <div className="min-w-[5.5rem] flex-1 [&_button]:h-10 [&_button]:w-full">
                <ExpenseWizard
                  storeId={storeId}
                  sessionId={sessionId}
                  userId={cashierId}
                  costCenters={costCenters}
                  categories={expenseCategories}
                  products={inventoryProducts}
                  expenseSettings={expenseSettings}
                  sessionMode
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-center gap-1.5 rounded-xl border-rose-200 bg-rose-50 px-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                    >
                      <Wallet className="size-4 shrink-0" />
                      <span className="truncate">مصروف</span>
                    </Button>
                  }
                />
              </div>
            ) : null}
            {cashDrawerEnabled && canManagerOverride ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10 min-w-[5.5rem] flex-1 justify-center gap-1.5 rounded-xl border-violet-200 bg-violet-50 px-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                disabled={pending}
                onClick={handleOpenCashDrawer}
              >
                <Archive className="size-4 shrink-0" />
                <span className="truncate">الدرج</span>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {readinessState === "ready" && hasActiveSession && activeSession && sessionReconciliation ? (
            <PosCloseSessionDialog
              session={activeSession}
              reconciliation={sessionReconciliation}
              sessionExpenses={sessionExpenses}
              cashierName={cashierName ?? "الكاشير"}
              costCenterMap={costCenterMap}
              categoryMap={expenseCategoryMap}
              triggerSize="sm"
              triggerClassName="rounded-full"
              triggerChildren="إغلاق"
            />
          ) : null}
          {readinessState !== "login_required" ? <PosPinSwitch /> : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 lg:gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <CategoryRail
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchTerm.trim()) handleBarcodeSubmit(searchTerm);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={barcodeEnabled ? "ابحث أو امسح الباركود…" : "ابحث عن منتجات…"}
                aria-label={barcodeEnabled ? "بحث أو مسح باركود" : "بحث عن منتجات"}
                className="h-11 rounded-xl ps-10 text-base"
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="outline" className="h-11 rounded-xl px-5">
              إضافة
            </Button>
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-muted/50 p-3 pb-24 ring-1 ring-border/70 sm:p-4 xl:pb-4">
            {products.length === 0 ? (
              <EmptyStateBlock
                title={searchTerm.trim() ? "لا نتائج" : "لا توجد منتجات"}
                description={
                  searchTerm.trim()
                    ? "جرّب اسمًا أو باركود مختلف."
                    : categoryId
                      ? "لا توجد منتجات في هذا التصنيف."
                      : "أضف منتجات للكتالوج عشان تبدأ البيع."
                }
                className="flex min-h-48 flex-col items-center justify-center border-border/70 bg-card/80 p-4 py-10"
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fit,minmax(128px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(132px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(124px,1fr))]">
                {products.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    onAdd={() => handleAdd(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 w-[min(420px,32vw)] shrink-0 flex-col xl:flex">
          <CartPanel
            onCheckout={cartCheckout}
            checkoutDisabled={payLocked || cart.length === 0}
            checkoutBlockedReason={checkoutBlockedReason}
            discountsEnabled={discountsEnabled}
            loyaltyEnabled={loyaltyEnabled}
            enabledPaymentMethods={enabledPaymentMethods}
            loyaltyRedemptionRate={loyaltyRedemptionRate}
            minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
            attachExpanded={attachExpanded}
            onAttachExpandedChange={setAttachExpanded}
            discountOpen={discountOpen}
            onDiscountOpenChange={setDiscountOpen}
          />
          {checkoutBlocked ? (
            <div className="mt-2.5 space-y-2.5 rounded-2xl border border-amber-500/25 bg-amber-50/80 p-3.5 text-center dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {checkoutBlockedReason}
              </p>
              {readinessState === "no_session" ? (
                <QuickOpenSessionButton className="w-full" label="ابدأ البيع الآن" />
              ) : null}
              {readinessState === "session_expired" && sessionBannerAction ? (
                <div className="flex justify-center">{sessionBannerAction}</div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[min(92dvh,100%)] max-h-[min(92dvh,100%)] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0 data-[side=bottom]:h-[min(92dvh,100%)]"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CartPanel
                onCheckout={(method) => {
                  setCartOpen(false);
                  cartCheckout(method);
                }}
                checkoutDisabled={payLocked || cart.length === 0}
                checkoutBlockedReason={checkoutBlockedReason}
                discountsEnabled={discountsEnabled}
                loyaltyEnabled={loyaltyEnabled}
                enabledPaymentMethods={enabledPaymentMethods}
                loyaltyRedemptionRate={loyaltyRedemptionRate}
                minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
                attachExpanded={attachExpanded}
                onAttachExpandedChange={setAttachExpanded}
                discountOpen={discountOpen}
                onDiscountOpenChange={setDiscountOpen}
              />
              {checkoutBlocked ? (
                <div className="space-y-2.5 border-t border-border/60 p-4 text-center">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {checkoutBlockedReason}
                  </p>
                  {readinessState === "no_session" ? (
                    <QuickOpenSessionButton className="w-full" label="ابدأ البيع الآن" />
                  ) : null}
                  {readinessState === "session_expired" && sessionBannerAction ? (
                    <div className="flex justify-center">{sessionBannerAction}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <PosCreditCheckoutDialog
          open={creditOpen}
          onOpenChange={setCreditOpen}
          total={Math.max(
            0,
            getCartTotal(cart, discountAmount) - (loyaltyRedemption?.amount ?? 0)
          )}
          customer={customer}
          enabledMethods={enabledPaymentMethods}
          loading={pending}
          onConfirm={handleCreditConfirm}
        />

        <VariantPickerDialog
          open={Boolean(pickerProduct)}
          product={pickerProduct}
          onClose={() => setPickerProduct(null)}
          onSelect={(product, variant) => addToCart(product, variant)}
        />
        <Dialog open={onlineOrdersOpen} onOpenChange={setOnlineOrdersOpen}>
          <DialogContent className="max-h-[92dvh] max-w-[min(980px,calc(100%-1rem))] overflow-hidden p-0 sm:max-w-[min(980px,calc(100%-1rem))]">
            <DialogHeader className="border-b border-border/70 px-4 py-3">
              <DialogTitle className="flex items-center gap-2 pe-8">
                <ClipboardList className="size-5 text-primary" />
                طلبات الأونلاين
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[calc(92dvh-56px)] overflow-y-auto p-2">
              <OnlineOrdersPageClient
                orders={onlineOrders}
                products={onlineOrderProducts}
                compact
                enabledPaymentMethods={enabledPaymentMethods}
                receiptBranding={receiptBranding}
              />
            </div>
          </DialogContent>
        </Dialog>
        {canCollectPayment ? (
          <PosCollectFlowDialog open={collectOpen} onOpenChange={setCollectOpen} />
        ) : null}
      <WeightAmountModal
        open={Boolean(weightProduct)}
        onOpenChange={(open) => {
          if (!open) setWeightProduct(null);
        }}
        product={weightProduct}
        onConfirm={({ quantity, unitPrice, saleInputMode, enteredAmount }) => {
          if (!weightProduct) return;
          addItem({
            productId: weightProduct.id,
            variantId: null,
            name: weightProduct.name,
            quantity,
            unitPrice,
            modifiers: [],
            imageUrl: weightProduct.image_url,
            saleUnit: weightProduct.sale_unit,
            saleInputMode,
            enteredAmount,
          });
          setWeightProduct(null);
        }}
      />
      </div>

      <Button
        type="button"
        className="flex h-14 shrink-0 items-center justify-between rounded-2xl px-4 text-base shadow-lg xl:hidden"
        onClick={() => setCartOpen(true)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ShoppingCart className="size-5" />
          <span className="truncate">
            السلة · {cartItemCount} {cartItemCount === 1 ? "صنف" : "أصناف"}
          </span>
        </span>
        <span className="font-semibold tabular-nums">
          {cartTotal === 0 ? "السلة" : formatCurrency(cartTotal)}
        </span>
      </Button>

    </div>
      {lastReceipt && receiptEnabled ? (
        <PosReceiptSuccessDialog
          open={Boolean(lastReceipt)}
          receipt={lastReceipt}
          onOpenChange={(open) => {
            if (!open) setLastReceipt(null);
          }}
          onUsbPrint={handleUsbPrintReceipt}
          onBrowserPrint={handleBrowserPrintReceipt}
          onWhatsApp={handleSendWhatsAppReceipt}
        />
      ) : null}
    <ManagerOverrideDialog
      open={Boolean(overrideDialog)}
      onOpenChange={(open) => {
        if (!open) setOverrideDialog(null);
      }}
      title={overrideDialog?.title ?? "موافقة المدير"}
      defaultReason={overrideDialog?.defaultReason ?? ""}
      onConfirm={(reason) => {
        if (!overrideDialog || pending) return;
        if (overrideDialog.kind === "cash_drawer") {
          confirmCashDrawer(reason);
          return;
        }
        if (overrideDialog.payments) {
          runCheckout(
            overrideDialog.payments,
            reason,
            overrideDialog.accountCollection ?? 0
          );
        }
      }}
    />
    </>
  );
}
