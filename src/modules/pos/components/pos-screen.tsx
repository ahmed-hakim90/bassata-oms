"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, MessageCircle, Printer, Search, ShoppingCart, Wallet } from "lucide-react";
import { CategoryRail } from "@/modules/pos/components/category-rail";
import { CartPanel } from "@/modules/pos/components/cart-panel";
import { PaymentPanel } from "@/modules/pos/components/payment-panel";
import { ProductTile } from "@/modules/pos/components/product-tile";
import { VariantPickerDialog } from "@/modules/pos/components/variant-picker-dialog";
import {
  openCashDrawerHook,
  ReceiptPrint,
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
import type { Category, CostCenter, ExpenseCategory, Product } from "@/lib/types";
import type { ExpenseSettings, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { FeatureFlag } from "@/lib/constants";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { usePosStore, getCartTotal } from "@/stores/pos-store";
import { PosReadinessBanner } from "@/components/SweetFlow/pos-readiness-banner";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
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
  costCenterMap?: Map<string, string>;
  expenseCategoryMap?: Map<string, string>;
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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [onlineOrdersOpen, setOnlineOrdersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerProduct, setPickerProduct] = useState<POSProduct | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const addItem = usePosStore((s) => s.addItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const salesMode = usePosStore((s) => s.salesMode);
  const [weightProduct, setWeightProduct] = useState<POSProduct | null>(null);
  const router = useRouter();

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

  function handleComplete(payments: PaymentSplit[]) {
    const checkoutPaymentMethod = payments[0]?.method ?? paymentMethod;
    if (payments.some((payment) => payment.method === "credit") && !customer) {
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
      toast.error("هذا الخصم يحتاج موافقة المالك أو المدير");
      return;
    }
    const overrideReason = needsDiscountOverride || needsExpiredSessionOverride
      ? window.prompt(
          "سبب موافقة المدير",
          needsExpiredSessionOverride ? "تمت الموافقة على بيع بعد انتهاء الجلسة" : "تمت الموافقة على الخصم"
        )?.trim()
      : undefined;
    if ((needsDiscountOverride || needsExpiredSessionOverride) && !overrideReason) return;
    startTransition(async () => {
      const receiptCart = [...cart];
      const receiptCustomer = customer ? { name: customer.name, phone: customer.phone } : null;
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
          override: needsDiscountOverride
            ? { discount: true, reason: overrideReason }
            : needsExpiredSessionOverride
              ? { expiredSession: true, reason: overrideReason }
              : undefined,
        });
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
        setPaymentOpen(false);
        toast.success(`تم إتمام الطلب ${result.orderNumber}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل إتمام البيع");
      }
    });
  }

  if (readinessState === "no_device") {
    return <PosDeviceGate devices={storeDevices} />;
  }

  if (readinessState === "store_required" || readinessState === "store_mismatch") {
    return (
      <PosStoreGate
        stores={stores}
        activeStoreId={storeId}
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
    const reason = window.prompt("سبب موافقة المدير", "فتح درج النقدية يدويًا")?.trim();
    if (!reason) return;
    startTransition(async () => {
      try {
        await openCashDrawerAction(reason);
        openCashDrawerHook();
        toast.success("تم فتح درج النقدية");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر فتح درج النقدية");
      }
    });
  }

  async function handleUsbPrintReceipt() {
    if (!lastReceipt) return;
    try {
      await printReceiptViaUsb(lastReceipt);
      toast.success("تم إرسال الإيصال لطابعة USB");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  function handleBrowserPrintReceipt() {
    if (!lastReceipt) return;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PosReadinessBanner state={readinessState} action={sessionBannerAction} />
          {currentUserName ? (
            <span className="rounded-lg border border-border/60 bg-background/70 px-3 py-1 text-sm text-muted-foreground">
              المستخدم: <span className="font-medium text-foreground">{currentUserName}</span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
              triggerChildren="إغلاق الجلسة"
            />
          ) : null}
          {readinessState !== "login_required" ? <PosPinSwitch /> : null}
        </div>
      </div>
      {hasActiveSession ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 rounded-xl px-4 text-sm"
            onClick={() => setOnlineOrdersOpen(true)}
          >
            <ClipboardList className="mr-2 size-4" />
            طلبات الأونلاين
            {activeOnlineOrdersCount > 0 ? (
              <span className="ms-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {activeOnlineOrdersCount}
              </span>
            ) : null}
          </Button>
          {cashDrawerEnabled && canManagerOverride ? (
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-xl px-4 text-sm"
              disabled={pending}
              onClick={handleOpenCashDrawer}
            >
              فتح الدرج
            </Button>
          ) : null}
          {canAddSessionExpense && storeId && cashierId && sessionId ? (
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
                <Button variant="outline" size="sm" className="h-11 rounded-xl px-4 text-sm">
                  <Wallet className="mr-2 size-4" />
                  إضافة مصروف
                </Button>
              }
            />
          ) : null}
        </div>
      ) : null}
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
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={barcodeEnabled ? "ابحث أو امسح الباركود…" : "ابحث عن منتجات…"}
                className="h-11 rounded-xl pl-10 text-base"
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="outline" className="h-11 rounded-xl px-5">
              إضافة
            </Button>
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-muted/45 p-3 pb-24 ring-1 ring-border/60 sm:p-4 xl:pb-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {products.length === 0 && (
                <div className="col-span-full flex min-h-48 items-center justify-center rounded-2xl bg-card/80 px-4 text-center text-sm text-muted-foreground ring-1 ring-border">
                  لا توجد منتجات
                </div>
              )}
              {products.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onAdd={() => handleAdd(product)}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 w-[min(420px,32vw)] shrink-0 flex-col xl:flex">
          <CartPanel
            onCheckout={() => setPaymentOpen(true)}
            checkoutDisabled={checkoutBlocked || cart.length === 0}
            discountsEnabled={discountsEnabled}
            loyaltyEnabled={loyaltyEnabled}
            loyaltyRedemptionRate={loyaltyRedemptionRate}
            minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
          />
          {(readinessState === "ready" || readinessState === "session_warning") &&
            !hasActiveSession && (
            <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
              افتح جلسة كاشير لإتمام البيع
            </p>
          )}
          {readinessState === "session_expired" && (
            <p className="mt-2 text-center text-xs text-destructive">
              أغلق الوردية لمتابعة البيع
            </p>
          )}
        </aside>

        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[min(92dvh,100%)] max-h-[min(92dvh,100%)] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0 data-[side=bottom]:h-[min(92dvh,100%)]"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CartPanel
                onCheckout={() => {
                  setCartOpen(false);
                  setPaymentOpen(true);
                }}
                checkoutDisabled={checkoutBlocked || cart.length === 0}
                discountsEnabled={discountsEnabled}
                loyaltyEnabled={loyaltyEnabled}
                loyaltyRedemptionRate={loyaltyRedemptionRate}
                minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
              />
              {(readinessState === "ready" || readinessState === "session_warning") &&
                !hasActiveSession && (
                <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
                  افتح جلسة كاشير لإتمام البيع
                </p>
              )}
              {readinessState === "session_expired" && (
                <p className="mt-2 text-center text-xs text-destructive">
                  أغلق الوردية لمتابعة البيع
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <PaymentPanel
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          onComplete={handleComplete}
          enabledMethods={enabledPaymentMethods}
          customerName={customer?.name ?? null}
          loading={pending}
          disabled={readinessState === "session_expired" && !canManagerOverride}
          loyaltyRedemptionRate={loyaltyEnabled ? loyaltyRedemptionRate : null}
          minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
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
          {cartTotal === 0 ? "فتح" : formatCurrency(cartTotal)}
        </span>
      </Button>

      {lastReceipt && receiptEnabled ? (
        <div className="print:hidden rounded-2xl border bg-background/95 p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">تم إتمام الطلب {lastReceipt.orderNumber}</p>
              <p className="text-xs text-muted-foreground">
                اطبع الإيصال الحراري أو أرسله للعميل على واتساب.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl"
                onClick={handleUsbPrintReceipt}
              >
                <Printer className="size-4" />
                طباعة USB
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-xl"
                onClick={handleSendWhatsAppReceipt}
                disabled={!lastReceipt.customer?.phone}
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl"
                onClick={handleBrowserPrintReceipt}
              >
                طباعة المتصفح
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
    {lastReceipt && receiptEnabled ? <ReceiptPrint receipt={lastReceipt} /> : null}
    </>
  );
}
