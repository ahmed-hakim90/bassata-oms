import type {
  AppSetting,
  AppUser,
  AuditLog,
  CashierSession,
  Category,
  Customer,
  Device,
  Expense,
  ExpenseCategory,
  CostCenter,
  Permission,
  ImportJob,
  InventoryMovement,
  LoyaltyLedgerEntry,
  LoyaltyRule,
  MeasurementUnit,
  Order,
  OrderItem,
  OrderItemDeduction,
  OrderPayment,
  OnlineOrder,
  OnlineOrderItem,
  Organization,
  Product,
  ProductRecipe,
  ProductRecipeLine,
  ProductType,
  ProductVariant,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  SupplierPayment,
  StockCount,
  StockCountLine,
  StockLevel,
  Store,
  Supplier,
  TransferOrder,
  TransferOrderLine,
  WasteRecord,
  Warehouse,
} from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import type {
  AppSettingRow,
  AuditLogRow,
  CategoryRow,
  CustomerRow,
  DeviceRow,
  ExpenseRow,
  ExpenseCategoryRow,
  CostCenterRow,
  PermissionRow,
  ImportJobRow,
  LoyaltyLedgerRow,
  LoyaltyRuleRow,
  MovementRow,
  OrderItemDeductionRow,
  OrderItemRow,
  OrderPaymentRow,
  OnlineOrderItemRow,
  OnlineOrderRow,
  OrderRow,
  OrganizationRow,
  ProductRow,
  RecipeLineRow,
  RecipeRow,
  PurchaseLineRow,
  PurchaseRow,
  SupplierPaymentRow,
  SessionRow,
  StockCountLineRow,
  StockCountRow,
  StockLevelRow,
  StoreRow,
  SupplierRow,
  TransferLineRow,
  TransferRow,
  UserRow,
  VariantRow,
  WasteRow,
  WarehouseRow,
} from "@/lib/supabase/database.types";

function num(v: number | string): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

export function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    logo_url: row.logo_url ?? null,
    country: row.country ?? "",
    status: (row.status ?? "active") as Organization["status"],
    settings: (row.settings ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  };
}

export function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    code: row.code ?? "",
    address: row.address,
    phone: row.phone ?? "",
    timezone: row.timezone ?? null,
    is_active: row.is_active,
    settings: (row.settings ?? {}) as Record<string, unknown>,
  };
}

export function mapWarehouse(row: WarehouseRow): Warehouse {
  return row;
}

export function mapUser(row: UserRow, storeIds: string[]): AppUser {
  return {
    id: row.id,
    org_id: row.org_id,
    auth_user_id: row.auth_user_id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    is_active: row.is_active,
    store_ids: storeIds,
  };
}

export function mapDevice(row: DeviceRow): Device {
  return row;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    sort_order: row.sort_order,
    color: row.color,
    icon: row.icon,
    expiry_tracking_enabled_default: row.expiry_tracking_enabled_default ?? false,
    inventory_rotation_method_default:
      (row.inventory_rotation_method_default ?? "FIFO") as Category["inventory_rotation_method_default"],
    expiry_policy_default: (row.expiry_policy_default ?? "block_sale") as Category["expiry_policy_default"],
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    category_id: row.category_id ?? "",
    base_price: num(row.base_price),
    description: row.description ?? "",
    sale_price: row.sale_price != null ? num(row.sale_price) : null,
    image_url: row.image_url,
    is_active: row.is_active,
    is_popular: row.is_popular,
    track_inventory: row.track_inventory,
    product_type: (row.product_type ?? "finished_product") as ProductType,
    inventory_product_type: (row.inventory_product_type ?? row.product_type ?? "finished_product") as ProductType,
    inventory_tracking_mode: (row.inventory_tracking_mode ?? "standard") as Product["inventory_tracking_mode"],
    inventory_rotation_method:
      (row.inventory_rotation_method ?? "FIFO") as Product["inventory_rotation_method"],
    expiry_policy: (row.expiry_policy ?? "block_sale") as Product["expiry_policy"],
    expiry_tracking_enabled: row.expiry_tracking_enabled ?? false,
    shelf_life_value: row.shelf_life_value ?? 0,
    shelf_life_unit: (row.shelf_life_unit ?? "days") as Product["shelf_life_unit"],
    unit: (row.unit ?? "piece") as MeasurementUnit,
    base_unit: (row.base_unit ?? row.unit ?? "piece") as MeasurementUnit,
    sale_unit: (row.sale_unit ?? row.unit ?? "piece") as MeasurementUnit,
    sales_unit_type: (row.sales_unit_type ?? "piece") as Product["sales_unit_type"],
    allow_fractional_quantity: row.allow_fractional_quantity ?? false,
    allow_price_input: row.allow_price_input ?? false,
    wholesale_enabled: row.wholesale_enabled ?? false,
    supports_weight_sale: row.supports_weight_sale ?? false,
    supports_amount_sale: row.supports_amount_sale ?? false,
    last_unit_cost: num(row.last_unit_cost ?? 0),
    cost_unit: (row.cost_unit ?? row.unit ?? "piece") as MeasurementUnit,
    updated_at: row.updated_at ?? row.created_at,
  };
}

export function mapVariant(row: VariantRow): ProductVariant {
  return {
    ...row,
    price_delta: num(row.price_delta),
    price: row.price != null ? num(row.price) : null,
    image_url: row.image_url ?? null,
    variant_kind: (row.variant_kind ?? "standard") as ProductVariant["variant_kind"],
    quantity_value: row.quantity_value != null ? num(row.quantity_value) : null,
    quantity_unit: (row.quantity_unit ?? null) as ProductVariant["quantity_unit"],
    price_mode: (row.price_mode ?? null) as ProductVariant["price_mode"],
    fixed_price: row.fixed_price != null ? num(row.fixed_price) : null,
  };
}

export function mapStockLevel(row: StockLevelRow): StockLevel {
  return { ...row, quantity: row.quantity, reorder_point: row.reorder_point };
}

export function mapMovement(row: MovementRow): InventoryMovement {
  return {
    ...row,
    movement_type: row.movement_type as InventoryMovement["movement_type"],
    reference_id: row.reference_id,
  };
}

export function mapSupplier(row: SupplierRow): Supplier {
  return row;
}

export function mapSupplierPayment(row: SupplierPaymentRow): SupplierPayment {
  return {
    id: row.id,
    org_id: row.org_id,
    store_id: row.store_id,
    supplier_id: row.supplier_id,
    amount: num(row.amount),
    payment_method: row.payment_method as SupplierPayment["payment_method"],
    reference: row.reference,
    notes: row.notes,
    paid_at: row.paid_at,
    created_by: row.created_by,
    created_at: row.created_at,
    voided_at: row.voided_at,
  };
}

export function mapPurchase(row: PurchaseRow): PurchaseInvoice {
  return {
    id: row.id,
    store_id: row.store_id,
    warehouse_id: row.warehouse_id,
    supplier_id: row.supplier_id,
    invoice_number: row.invoice_number,
    status: row.status as PurchaseInvoice["status"],
    subtotal: num(row.subtotal),
    extra_cost: num(row.extra_cost ?? 0),
    tax: num(row.tax),
    total: num(row.total),
    received_at: row.received_at,
    cancelled_at: row.cancelled_at ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapPurchaseLine(row: PurchaseLineRow): PurchaseInvoiceLine {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    quantity: row.quantity,
    unit_cost: num(row.unit_cost),
    line_total: num(row.line_total),
    landed_unit_cost: row.landed_unit_cost == null ? null : num(row.landed_unit_cost),
    landed_line_total: row.landed_line_total == null ? null : num(row.landed_line_total),
    batch_number: row.batch_number ?? null,
    production_date: row.production_date ?? null,
    expiry_date: row.expiry_date ?? null,
  };
}

export function mapTransfer(row: TransferRow): TransferOrder {
  return {
    id: row.id,
    from_store_id: row.from_store_id,
    to_store_id: row.to_store_id,
    from_warehouse_id: row.from_warehouse_id,
    to_warehouse_id: row.to_warehouse_id,
    status: row.status as TransferOrder["status"],
    sent_at: row.sent_at,
    received_at: row.received_at,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapTransferLine(row: TransferLineRow): TransferOrderLine {
  return {
    ...row,
    batch_id: row.batch_id ?? null,
    batch_number: row.batch_number ?? null,
  };
}

export function mapWaste(row: WasteRow): WasteRecord {
  return {
    ...row,
    batch_id: row.batch_id ?? null,
    batch_number: row.batch_number ?? null,
    expiry_date: row.expiry_date ?? null,
  };
}

export function mapStockCount(row: StockCountRow): StockCount {
  return {
    id: row.id,
    store_id: row.store_id,
    warehouse_id: row.warehouse_id,
    status: row.status as StockCount["status"],
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_by: row.created_by,
  };
}

export function mapStockCountLine(row: StockCountLineRow): StockCountLine {
  return {
    ...row,
    batch_id: row.batch_id ?? null,
    batch_number: row.batch_number ?? null,
    expiry_date: row.expiry_date ?? null,
  };
}

export function mapSession(row: SessionRow): CashierSession {
  return {
    id: row.id,
    store_id: row.store_id,
    device_id: row.device_id,
    cashier_id: row.cashier_id,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    opening_cash: num(row.opening_cash),
    expected_cash: row.expected_cash != null ? num(row.expected_cash) : null,
    actual_cash: row.actual_cash != null ? num(row.actual_cash) : null,
    variance: row.variance != null ? num(row.variance) : null,
    status: row.status as CashierSession["status"],
    notes: row.notes,
    closed_by: row.closed_by ?? null,
    close_reason: row.close_reason ?? null,
    force_closed: row.force_closed ?? false,
  };
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    ...row,
    total_spent: num(row.total_spent),
    account_balance: num(row.account_balance ?? 0),
    credit_limit: num(row.credit_limit ?? 0),
    payment_terms: row.payment_terms ?? "",
  };
}

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    store_id: row.store_id,
    session_id: row.session_id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    status: row.status as Order["status"],
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    tax: num(row.tax),
    total: num(row.total),
    payment_status: row.payment_status as Order["payment_status"],
    sales_mode: (row.sales_mode ?? "retail") as Order["sales_mode"],
    activity_type: (row.activity_type ?? "retail") as Order["activity_type"],
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    order_id: row.order_id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    quantity: row.quantity,
    unit_price: num(row.unit_price),
    modifiers: (row.modifiers ?? []) as OrderItem["modifiers"],
    line_total: num(row.line_total),
    unit_cost: num(row.unit_cost ?? 0),
    line_cost: num(row.line_cost ?? 0),
    sale_unit: (row.sale_unit ?? null) as OrderItem["sale_unit"],
    base_quantity: row.base_quantity != null ? num(row.base_quantity) : null,
    sale_input_mode: (row.sale_input_mode ?? null) as OrderItem["sale_input_mode"],
    tier_id: row.tier_id ?? null,
    wholesale_applied: row.wholesale_applied ?? false,
    line_note: row.line_note ?? null,
  };
}

export function mapOrderItemDeduction(row: OrderItemDeductionRow): OrderItemDeduction {
  return {
    id: row.id,
    order_item_id: row.order_item_id,
    ingredient_product_id: row.ingredient_product_id,
    quantity: num(row.quantity),
    unit: row.unit as MeasurementUnit,
    unit_cost: num(row.unit_cost),
    line_cost: num(row.line_cost),
  };
}

export function mapRecipe(row: RecipeRow): ProductRecipe {
  return row;
}

export function mapRecipeLine(row: RecipeLineRow): ProductRecipeLine {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    ingredient_product_id: row.ingredient_product_id,
    quantity: num(row.quantity),
    unit: row.unit as MeasurementUnit,
    sort_order: row.sort_order,
  };
}

export function mapOrderPayment(row: OrderPaymentRow): OrderPayment {
  return {
    id: row.id,
    order_id: row.order_id,
    method: row.method as OrderPayment["method"],
    amount: num(row.amount),
    reference: row.reference,
  };
}

export function mapOnlineOrder(row: OnlineOrderRow): OnlineOrder {
  return {
    id: row.id,
    store_id: row.store_id,
    order_id: row.order_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    status: row.status as OnlineOrder["status"],
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    tax: num(row.tax),
    total: num(row.total),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapOnlineOrderItem(row: OnlineOrderItemRow): OnlineOrderItem {
  return {
    id: row.id,
    online_order_id: row.online_order_id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    product_name: row.product_name,
    variant_name: row.variant_name,
    quantity: row.quantity,
    unit_price: num(row.unit_price),
    line_total: num(row.line_total),
    created_at: row.created_at,
  };
}

export function mapExpense(row: ExpenseRow): Expense {
  return {
    ...row,
    amount: num(row.amount),
    quantity: row.quantity != null ? num(row.quantity) : null,
    unit_cost: row.unit_cost != null ? num(row.unit_cost) : null,
    payment_method: row.payment_method as Expense["payment_method"],
    expense_source: row.expense_source as Expense["expense_source"],
    status: row.status as Expense["status"],
  };
}

export function mapCostCenter(row: CostCenterRow): CostCenter {
  return { ...row, type: row.type as CostCenter["type"] };
}

export function mapExpenseCategory(row: ExpenseCategoryRow): ExpenseCategory {
  return row;
}

export function mapPermission(row: PermissionRow): Permission {
  return row;
}

export function mapLoyaltyRule(row: LoyaltyRuleRow): LoyaltyRule {
  return {
    id: row.id,
    org_id: row.org_id,
    points_per_currency: num(row.points_per_currency),
    redemption_rate: num(row.redemption_rate),
    minimum_redeem_points: row.minimum_redeem_points ?? 0,
    is_active: row.is_active,
  };
}

export function mapLoyaltyLedger(row: LoyaltyLedgerRow): LoyaltyLedgerEntry {
  return row;
}

export function mapImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    org_id: row.org_id,
    type: row.type,
    status: row.status as ImportJob["status"],
    file_url: row.file_url,
    result: (row.result ?? {}) as Record<string, unknown>,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    org_id: row.org_id,
    store_id: row.store_id,
    user_id: row.user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  };
}

export function mapAppSetting(row: AppSettingRow): AppSetting {
  return {
    id: row.id,
    org_id: row.org_id,
    key: row.key,
    value: (row.value ?? {}) as Record<string, unknown>,
  };
}
