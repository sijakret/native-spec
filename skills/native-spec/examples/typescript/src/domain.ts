import type { Bindings } from "../specs/definition/process.js";
import type { StockDomainLinks } from "../specs/artifacts/architecture/001-stock-domain.abb.js";

export type specBindings = Bindings<
  StockDomainLinks["contract"],
  {
    seedWorkspace: typeof seedWorkspace;
    quantity: typeof quantity;
    validateWorkspace: typeof validateWorkspace;
    reservedFor: typeof reservedFor;
    availableFor: typeof availableFor;
    restock: typeof restock;
    reserveOrder: typeof reserveOrder;
    closeOrder: typeof closeOrder;
    searchProducts: typeof searchProducts;
    stockSummary: typeof stockSummary;
    record: typeof record;
    text: typeof text;
    parseProduct: typeof parseProduct;
    parseOrder: typeof parseOrder;
    unique: typeof unique;
  }
>;

export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly onHand: number;
  readonly lowStockAt: number;
}

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly productId: string;
  readonly quantity: number;
  readonly status: "reserved" | "fulfilled" | "cancelled";
  readonly createdAt: string;
}

export interface Workspace {
  readonly version: 1;
  readonly products: readonly Product[];
  readonly orders: readonly Order[];
}

export function seedWorkspace(): Workspace {
  return {
    version: 1,
    products: [
      {
        id: "p-1",
        sku: "DESK-01",
        name: "Desk lamp",
        onHand: 24,
        lowStockAt: 5,
      },
      {
        id: "p-2",
        sku: "NOTE-02",
        name: "Field notebook",
        onHand: 48,
        lowStockAt: 10,
      },
      {
        id: "p-3",
        sku: "CUP-03",
        name: "Studio mug",
        onHand: 4,
        lowStockAt: 5,
      },
      {
        id: "p-4",
        sku: "BAG-04",
        name: "Canvas tote",
        onHand: 16,
        lowStockAt: 4,
      },
    ],
    orders: [],
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 120)
    throw new Error(`${label} must contain 1-120 characters.`);
  return value.trim();
}

export function quantity(
  value: unknown,
  label = "Quantity",
  minimum = 1,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new Error(
      `${label} must be a safe whole number of at least ${minimum}.`,
    );
  return value;
}

function parseProduct(value: unknown): Product {
  const item = record(value);
  return {
    id: text(item.id, "Product ID"),
    sku: text(item.sku, "SKU"),
    name: text(item.name, "Product name"),
    onHand: quantity(item.onHand, "On-hand stock", 0),
    lowStockAt: quantity(item.lowStockAt, "Low-stock threshold", 0),
  };
}

function parseOrder(value: unknown): Order {
  const item = record(value);
  const status = item.status;
  if (status !== "reserved" && status !== "fulfilled" && status !== "cancelled")
    throw new Error("Unknown order status.");
  const createdAt = text(item.createdAt, "Order timestamp");
  if (
    !Number.isFinite(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString() !== createdAt
  )
    throw new Error("Order timestamps must be ISO dates.");
  return {
    id: text(item.id, "Order ID"),
    customer: text(item.customer, "Customer"),
    productId: text(item.productId, "Order product"),
    quantity: quantity(item.quantity),
    status,
    createdAt,
  };
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}.`);
}

export function validateWorkspace(value: unknown): Workspace {
  const data = record(value);
  if (
    data.version !== 1 ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.orders)
  )
    throw new Error("Expected a version 1 Stockroom workspace.");
  if (data.products.length > 500 || data.orders.length > 5000)
    throw new Error("Demo limit: 500 products and 5,000 orders.");
  const products = data.products.map((item: unknown) => parseProduct(item));
  const orders = data.orders.map((item: unknown) => parseOrder(item));
  unique(
    products.map((product) => product.id),
    "product IDs",
  );
  unique(
    products.map((product) => product.sku.toLowerCase()),
    "SKUs",
  );
  unique(
    orders.map((order) => order.id),
    "order IDs",
  );
  const ids = new Set(products.map((product) => product.id));
  if (orders.some((order) => !ids.has(order.productId)))
    throw new Error("An order references an unknown product.");
  const state: Workspace = { version: 1, products, orders };
  for (const product of products) {
    const reserved = reservedFor(state, product.id);
    if (!Number.isSafeInteger(reserved) || reserved > product.onHand)
      throw new Error(`Reservations exceed stock for ${product.sku}.`);
  }
  quantity(
    products.reduce((sum, product) => sum + product.onHand, 0),
    "Total stock",
    0,
  );
  return state;
}

export function reservedFor(state: Workspace, productId: string): number {
  return state.orders
    .filter(
      (order) => order.productId === productId && order.status === "reserved",
    )
    .reduce((sum, order) => sum + order.quantity, 0);
}

export function availableFor(state: Workspace, product: Product): number {
  return product.onHand - reservedFor(state, product.id);
}

export function restock(
  state: Workspace,
  productId: string,
  amount: number,
): Workspace {
  quantity(amount);
  if (!state.products.some((product) => product.id === productId))
    throw new Error("Product not found.");
  return validateWorkspace({
    ...state,
    products: state.products.map((product) =>
      product.id === productId
        ? { ...product, onHand: product.onHand + amount }
        : product,
    ),
  });
}

export function reserveOrder(
  state: Workspace,
  input: { customer: string; productId: string; quantity: number },
  id: string,
  createdAt: string,
): Workspace {
  quantity(input.quantity);
  const product = state.products.find(
    (candidate) => candidate.id === input.productId,
  );
  if (!product) throw new Error("Product not found.");
  if (input.quantity > availableFor(state, product))
    throw new Error(
      `Only ${availableFor(state, product)} units of ${product.name} are available.`,
    );
  const order: Order = { ...input, id, createdAt, status: "reserved" };
  return validateWorkspace({ ...state, orders: [...state.orders, order] });
}

export function closeOrder(
  state: Workspace,
  orderId: string,
  status: "fulfilled" | "cancelled",
): Workspace {
  const order = state.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new Error("Order not found.");
  if (order.status !== "reserved")
    throw new Error("This order is already closed.");
  return validateWorkspace({
    ...state,
    products: state.products.map((product) =>
      product.id === order.productId && status === "fulfilled"
        ? { ...product, onHand: product.onHand - order.quantity }
        : product,
    ),
    orders: state.orders.map((candidate) =>
      candidate.id === orderId ? { ...candidate, status } : candidate,
    ),
  });
}

export function searchProducts(
  state: Workspace,
  query: string,
): readonly Product[] {
  const needle = query.trim().toLowerCase();
  return state.products.filter((product) =>
    `${product.sku} ${product.name}`.toLowerCase().includes(needle),
  );
}

export function stockSummary(state: Workspace) {
  const onHand = state.products.reduce(
    (sum, product) => sum + product.onHand,
    0,
  );
  const reserved = state.orders
    .filter((order) => order.status === "reserved")
    .reduce((sum, order) => sum + order.quantity, 0);
  return {
    onHand,
    reserved,
    available: onHand - reserved,
    openOrders: state.orders.filter((order) => order.status === "reserved")
      .length,
    lowStock: state.products.filter(
      (product) => availableFor(state, product) <= product.lowStockAt,
    ).length,
  };
}
