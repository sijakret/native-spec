import { describe, expect, it } from "vitest";
import {
  availableFor,
  closeOrder,
  reserveOrder,
  reservedFor,
  restock,
  searchProducts,
  seedWorkspace,
  stockSummary,
  validateWorkspace,
} from "../src/domain.js";

const date = "2026-10-29T10:00:00.000Z";
const input = { customer: "Studio North", productId: "p-1", quantity: 3 };

export type specBindings = {
  seededInventory: typeof seededInventory;
  reservations: typeof reservations;
  restocking: typeof restocking;
  invalidQuantities: typeof invalidQuantities;
  overselling: typeof overselling;
  fulfillments: typeof fulfillments;
  cancellations: typeof cancellations;
  validOrders: typeof validOrders;
  aggregateReservations: typeof aggregateReservations;
  malformedInventory: typeof malformedInventory;
  importedOrders: typeof importedOrders;
};

function seededInventory() {
  const state = seedWorkspace();
  expect(validateWorkspace(state)).toEqual(state);
  expect(searchProducts(state, "  dEsK ")).toHaveLength(1);
  expect(searchProducts(state, "CUP-03")[0]?.name).toBe("Studio mug");
  expect(searchProducts(state, "missing")).toEqual([]);
  expect(stockSummary(state)).toEqual({
    onHand: 92,
    reserved: 0,
    available: 92,
    openOrders: 0,
    lowStock: 1,
  });
}

function reservations() {
  const original = seedWorkspace();
  const state = reserveOrder(original, input, "o-1", date);
  expect(state.products[0]?.onHand).toBe(24);
  expect(reservedFor(state, "p-1")).toBe(3);
  expect(availableFor(state, state.products[0]!)).toBe(21);
  expect(original.orders).toEqual([]);
  expect(stockSummary(state).openOrders).toBe(1);
}

function restocking() {
  const state = seedWorkspace();
  expect(restock(state, "p-3", 5).products[2]?.onHand).toBe(9);
  expect(state.products[2]?.onHand).toBe(4);
  expect(() => restock(state, "p-1", Number.MAX_SAFE_INTEGER)).toThrow();
  expect(() => restock(state, "missing", 1)).toThrow("Product not found");
  expect(() =>
    reserveOrder(state, { ...input, productId: "missing" }, "o-1", date),
  ).toThrow();
  expect(() => closeOrder(state, "missing", "cancelled")).toThrow(
    "Order not found",
  );
}

function invalidQuantities(quantity: number) {
  const state = seedWorkspace();
  const copy = JSON.stringify(state);
  expect(() =>
    reserveOrder(state, { ...input, quantity }, "o-1", date),
  ).toThrow();
  expect(() => restock(state, "p-1", quantity)).toThrow();
  expect(JSON.stringify(state)).toBe(copy);
}

function overselling() {
  const first = reserveOrder(
    seedWorkspace(),
    { ...input, quantity: 23 },
    "o-1",
    date,
  );
  expect(() =>
    reserveOrder(first, { ...input, quantity: 2 }, "o-2", date),
  ).toThrow("Only 1 units");
  const last = reserveOrder(first, { ...input, quantity: 1 }, "o-2", date);
  expect(reservedFor(last, "p-1")).toBe(24);
  expect(() =>
    reserveOrder(last, { ...input, quantity: 1 }, "o-3", date),
  ).toThrow("Only 0 units");
}

function fulfillments() {
  const first = reserveOrder(seedWorkspace(), input, "o-1", date);
  const second = reserveOrder(first, { ...input, quantity: 2 }, "o-2", date);
  const state = closeOrder(second, "o-1", "fulfilled");
  expect(state.products[0]?.onHand).toBe(21);
  expect(reservedFor(state, "p-1")).toBe(2);
  expect(availableFor(state, state.products[0]!)).toBe(19);
  expect(second.orders[0]?.status).toBe("reserved");
  expect(() => closeOrder(state, "o-1", "fulfilled")).toThrow("already closed");
  expect(() => closeOrder(state, "o-1", "cancelled")).toThrow("already closed");
}

function cancellations() {
  const reserved = reserveOrder(seedWorkspace(), input, "o-1", date);
  const cancelled = closeOrder(reserved, "o-1", "cancelled");
  expect(cancelled.products[0]?.onHand).toBe(24);
  expect(reservedFor(cancelled, "p-1")).toBe(0);
  expect(() => closeOrder(cancelled, "o-1", "cancelled")).toThrow(
    "already closed",
  );
  expect(() => closeOrder(cancelled, "o-1", "fulfilled")).toThrow(
    "already closed",
  );
}

function validOrders() {
  const state = reserveOrder(seedWorkspace(), input, "o-1", date);
  expect(() => reserveOrder(state, input, "o-1", date)).toThrow(
    "Duplicate order IDs",
  );
  expect(() =>
    reserveOrder(state, { ...input, customer: " " }, "o-2", date),
  ).toThrow("Customer");
  expect(() => reserveOrder(state, input, "o-2", "yesterday")).toThrow(
    "ISO dates",
  );
}

function aggregateReservations() {
  const state = reserveOrder(seedWorkspace(), input, "o-1", date);
  expect(() =>
    validateWorkspace({
      ...state,
      orders: [
        state.orders[0],
        { ...state.orders[0], id: "o-2", quantity: 22 },
      ],
    }),
  ).toThrow("Reservations exceed stock");
}

function malformedInventory(value: unknown) {
  expect(() => validateWorkspace(value)).toThrow();
}

function importedOrders() {
  const state = reserveOrder(seedWorkspace(), input, "o-1", date);
  for (const patch of [
    { productId: "missing" },
    { status: "draft" },
    { quantity: 0.5 },
  ])
    expect(() =>
      validateWorkspace({
        ...state,
        orders: [{ ...state.orders[0], ...patch }],
      }),
    ).toThrow();
}

describe("stockroom domain", () => {
  it(
    "seeds valid inventory, finds products, and flags low stock",
    seededInventory,
  );

  it(
    "reserves immediately without changing on-hand stock or the input",
    reservations,
  );

  it("rejects overselling and reserves the final available unit", overselling);

  it(
    "fulfills by reducing on-hand stock and releasing only that reservation",
    fulfillments,
  );

  it("cancels exactly once without deducting stock", cancellations);

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid quantities %s without changing state",
    invalidQuantities,
  );

  it("restocks immutably, rejects overflow and unknown targets", restocking);

  it(
    "rejects duplicate IDs, blank customers, and invalid timestamps",
    validOrders,
  );

  it("validates aggregate reservations when importing", aggregateReservations);

  it.each([
    null,
    {},
    { version: 2, products: [], orders: [] },
    { ...seedWorkspace(), products: [null] },
    {
      ...seedWorkspace(),
      products: [{ ...seedWorkspace().products[0], onHand: -1 }],
    },
    {
      ...seedWorkspace(),
      products: [...seedWorkspace().products, seedWorkspace().products[0]],
    },
    {
      ...seedWorkspace(),
      products: [
        { ...seedWorkspace().products[0], id: "a" },
        { ...seedWorkspace().products[0], id: "b", sku: "desk-01" },
      ],
    },
  ])("rejects malformed or duplicate inventory %#", malformedInventory);

  it(
    "rejects unknown products, invalid statuses, and fractional imported quantities",
    importedOrders,
  );
});
