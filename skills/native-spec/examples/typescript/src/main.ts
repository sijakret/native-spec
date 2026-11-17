import {
  availableFor,
  closeOrder,
  reservedFor,
  reserveOrder,
  restock,
  searchProducts,
  seedWorkspace,
  stockSummary,
  type Workspace,
} from "./domain.js";
import { exportWorkspace, importWorkspace, WorkspaceStore } from "./storage.js";
import "./styles.css";

type View = "overview" | "inventory" | "orders";
let html: typeof import("lit-html").html;
let render: typeof import("lit-html").render;
let store: WorkspaceStore | undefined;
let state: Workspace | undefined;
let view: View = "overview";
let query = "";
let notice = "";
let failed = false;
let importing = false;
const root = document.getElementById("app");
if (!root) throw new Error("Stockroom mount point is missing.");

export interface specBindings {
  currentState: typeof currentState;
}
function currentState(): Workspace {
  if (!state)
    throw new Error(
      "No valid workspace is loaded. Import a valid backup or reset the demo.",
    );
  return state;
}

export interface specBindings {
  errorText: typeof errorText;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface specBindings {
  perform: typeof perform;
}
function perform(operation: () => Workspace, message: string): void {
  try {
    if (!store)
      throw new Error(
        "Browser storage is unavailable. Enable storage and reload.",
      );
    if (importing) throw new Error("Wait for the current import to finish.");
    const next = operation();
    store.save(next);
    state = next;
    notice = message;
    failed = false;
  } catch (error) {
    notice = errorText(error);
    failed = true;
  }
  draw();
}

export interface specBindings {
  formValues: typeof formValues;
}
function formValues(event: Event): FormData {
  event.preventDefault();
  if (!(event.currentTarget instanceof HTMLFormElement))
    throw new Error("Expected a form.");
  return new FormData(event.currentTarget);
}

export interface specBindings {
  onRestock: typeof onRestock;
}
function onRestock(event: Event): void {
  const form = formValues(event);
  perform(
    () =>
      restock(
        currentState(),
        String(form.get("product")),
        Number(form.get("quantity")),
      ),
    "Stock received.",
  );
}

export interface specBindings {
  onReserve: typeof onReserve;
}
function onReserve(event: Event): void {
  const form = formValues(event);
  perform(
    () =>
      reserveOrder(
        currentState(),
        {
          customer: String(form.get("customer") ?? ""),
          productId: String(form.get("product")),
          quantity: Number(form.get("quantity")),
        },
        crypto.randomUUID(),
        new Date().toISOString(),
      ),
    "Order reserved. Stock is held until fulfillment or cancellation.",
  );
}

export interface specBindings {
  onCloseOrder: typeof onCloseOrder;
}
function onCloseOrder(event: Event): void {
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement))
    throw new Error("Expected an order action button.");
  perform(
    () => {
      const status = button.dataset.status;
      if (status !== "fulfilled" && status !== "cancelled")
        throw new Error("Unknown order action.");
      return closeOrder(currentState(), button.dataset.order ?? "", status);
    },
    button.dataset.status === "fulfilled"
      ? "Order fulfilled."
      : "Order cancelled. Reserved stock released.",
  );
}

export interface specBindings {
  onNavigate: typeof onNavigate;
}
function onNavigate(event: Event): void {
  const tab = event.currentTarget;
  if (!(tab instanceof HTMLButtonElement))
    throw new Error("Expected a navigation button.");
  const target = tab.dataset.view;
  if (target !== "overview" && target !== "inventory" && target !== "orders")
    throw new Error("Unknown page.");
  view = target;
  draw();
}

export interface specBindings {
  onSearch: typeof onSearch;
}
function onSearch(event: Event): void {
  if (!(event.currentTarget instanceof HTMLInputElement))
    throw new Error("Expected a search input.");
  query = event.currentTarget.value;
  draw();
}

export interface specBindings {
  onReset: typeof onReset;
}
function onReset(): void {
  if (
    window.confirm(
      "Replace this workspace with sample inventory? Export a backup first.",
    )
  )
    perform(seedWorkspace, "Demo reset. Sample inventory is ready.");
}

export interface specBindings {
  onExport: typeof onExport;
}
function onExport(): void {
  try {
    const blob = new Blob([exportWorkspace(currentState())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "acme-stockroom.json";
    link.click();
    URL.revokeObjectURL(url);
    notice = "Workspace exported.";
    failed = false;
  } catch (error) {
    notice = errorText(error);
    failed = true;
  }
  draw();
}

export interface specBindings {
  onImport: typeof onImport;
}
async function onImport(event: Event): Promise<void> {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected an import input.");
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Import limit: 2 MB.");
    if (importing) throw new Error("An import is already in progress.");
    importing = true;
    draw();
    const next = importWorkspace(await file.text());
    if (!window.confirm("Replace this workspace with the imported data?"))
      return;
    if (!store) throw new Error("Browser storage is unavailable.");
    store.save(next);
    state = next;
    notice = `Imported ${next.products.length} products and ${next.orders.length} orders.`;
    failed = false;
  } catch (error) {
    notice = errorText(error);
    failed = true;
  } finally {
    importing = false;
    input.value = "";
    draw();
  }
}

export interface specBindings {
  orderTable: typeof orderTable;
}
function orderTable(workspace: Workspace, recent = false) {
  const orders = [...workspace.orders].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const shown = recent ? orders.slice(0, 5) : orders;
  return shown.length === 0
    ? html`<p class="empty">
        No orders yet. Reserve your first order in the Orders tab.
      </p>`
    : html`<div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer / order</th>
              <th>Product</th>
              <th class="numeric">Units</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${shown.map(
              (order) =>
                html`<tr>
                  <td>
                    <strong>${order.customer}</strong
                    ><small>${order.id.slice(0, 8)}</small>
                  </td>
                  <td>
                    ${workspace.products.find(
                      (product) => product.id === order.productId,
                    )?.name}
                  </td>
                  <td class="numeric">${order.quantity}</td>
                  <td>
                    <span class="badge ${order.status}">${order.status}</span>
                  </td>
                  <td>
                    ${order.status === "reserved"
                      ? html`<div class="row-actions">
                          <button
                            data-order=${order.id}
                            data-status="fulfilled"
                            @click=${onCloseOrder}
                            ?disabled=${importing}
                          >
                            Fulfill
                          </button>
                          <button
                            class="quiet"
                            data-order=${order.id}
                            data-status="cancelled"
                            @click=${onCloseOrder}
                            ?disabled=${importing}
                          >
                            Cancel
                          </button>
                        </div>`
                      : html`<span class="muted">Closed</span>`}
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>`;
}

export interface specBindings {
  overviewPage: typeof overviewPage;
}
function overviewPage(workspace: Workspace) {
  const summary = stockSummary(workspace);
  const low = workspace.products.filter(
    (product) => availableFor(workspace, product) <= product.lowStockAt,
  );
  return html` <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR STOCKROOM, AT A GLANCE</p>
        <h1>A clear view of what's in stock.</h1>
        <p class="muted">Reserve with confidence. Ship without surprises.</p>
      </div>
      <span class="workspace-tag">Single-user demo</span>
    </div>
    <section class="metrics" aria-label="Stock summary">
      ${[
        ["On hand", summary.onHand],
        ["Reserved", summary.reserved],
        ["Available", summary.available],
        ["Open orders", summary.openOrders],
      ].map(
        ([label, count]) =>
          html`<div><span>${label}</span><strong>${count}</strong></div>`,
      )}
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Needs attention</h2>
        <span class="muted">${low.length} low-stock products</span>
      </div>
      ${low.length
        ? html`<div class="low-stock">
            ${low.map(
              (product) =>
                html`<div>
                  <strong>${product.name}</strong>
                  <span
                    >${availableFor(workspace, product)} available
                    <small>/ threshold ${product.lowStockAt}</small></span
                  >
                </div>`,
            )}
          </div>`
        : html`<p class="empty">
            All products are above their low-stock thresholds.
          </p>`}
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Recent orders</h2>
        <span class="muted">Latest five</span>
      </div>
      ${orderTable(workspace, true)}
    </section>`;
}

export interface specBindings {
  inventoryPage: typeof inventoryPage;
}
function inventoryPage(workspace: Workspace) {
  const products = searchProducts(workspace, query);
  return html` <div class="page-heading">
      <div>
        <p class="eyebrow">INVENTORY</p>
        <h1>Everything on the shelf.</h1>
        <p class="muted">Reservations hold stock; fulfillment removes it.</p>
      </div>
      <label class="search"
        >Search products<input
          type="search"
          placeholder="Name or SKU"
          .value=${query}
          @input=${onSearch}
      /></label>
    </div>
    <section class="panel">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="numeric">On hand</th>
              <th class="numeric">Reserved</th>
              <th class="numeric">Available</th>
              <th>Receive stock</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(
              (product) =>
                html`<tr>
                  <td>
                    <strong>${product.name}</strong
                    ><small>${product.sku}</small>
                  </td>
                  <td class="numeric">${product.onHand}</td>
                  <td class="numeric">${reservedFor(workspace, product.id)}</td>
                  <td class="numeric">
                    <span
                      class=${availableFor(workspace, product) <=
                      product.lowStockAt
                        ? "low"
                        : ""}
                      >${availableFor(workspace, product)}</span
                    >
                  </td>
                  <td>
                    <form class="inline-form" @submit=${onRestock}>
                      <input type="hidden" name="product" value=${product.id} />
                      <input
                        aria-label=${`Restock ${product.name}`}
                        name="quantity"
                        type="number"
                        min="1"
                        step="1"
                        required
                        placeholder="Units"
                      />
                      <button type="submit" ?disabled=${importing}>
                        Receive
                      </button>
                    </form>
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
      ${products.length === 0
        ? html`<p class="empty">No products match "${query}".</p>`
        : ""}
    </section>`;
}

export interface specBindings {
  ordersPage: typeof ordersPage;
}
function ordersPage(workspace: Workspace) {
  return html` <div class="page-heading">
      <div>
        <p class="eyebrow">ORDERS</p>
        <h1>A promise you can keep.</h1>
        <p class="muted">
          One product per order. Reserve now, fulfill or cancel later.
        </p>
      </div>
    </div>
    <section class="panel">
      <h2>Reserve an order</h2>
      <form class="order-form" @submit=${onReserve}>
        <label
          >Customer<input
            name="customer"
            required
            maxlength="120"
            placeholder="e.g. Studio North"
        /></label>
        <label
          >Product<select name="product" required>
            ${workspace.products.map(
              (product) =>
                html`<option value=${product.id}>
                  ${product.name} (${availableFor(workspace, product)}
                  available)
                </option>`,
            )}
          </select></label
        >
        <label
          >Units<input
            name="quantity"
            type="number"
            min="1"
            step="1"
            required
            value="1"
        /></label>
        <button
          class="primary"
          type="submit"
          ?disabled=${importing || workspace.products.length === 0}
        >
          Reserve stock
        </button>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>All orders</h2>
        <span class="muted">${workspace.orders.length} total</span>
      </div>
      ${orderTable(workspace)}
    </section>`;
}

export interface specBindings {
  draw: typeof draw;
}
function draw(): void {
  if (!root) throw new Error("Stockroom mount point is missing.");
  render(
    html` <header class="app-header">
        <a class="brand" href="./"
          ><span class="brand-mark">A</span> Acme <span>Stockroom</span></a
        >
        <nav aria-label="Main navigation">
          ${(["overview", "inventory", "orders"] as const).map(
            (tab) =>
              html`<button
                data-view=${tab}
                aria-current=${view === tab ? "page" : "false"}
                @click=${onNavigate}
              >
                ${tab}
              </button>`,
          )}
        </nav>
        <span class="local-indicator"><span></span> Local workspace</span>
      </header>
      <main>
        <div
          class="notice ${failed ? "failure" : ""}"
          role=${failed ? "alert" : "status"}
          aria-live="polite"
        >
          ${notice}
        </div>
        ${state
          ? view === "overview"
            ? overviewPage(state)
            : view === "inventory"
              ? inventoryPage(state)
              : ordersPage(state)
          : html`<section class="panel recovery">
              <h1>Your saved workspace could not be opened.</h1>
              <p>
                Nothing has been overwritten. Import a valid backup, or reset
                the demo below to deliberately replace it.
              </p>
            </section>`}
      </main>
      <footer>
        <p>
          Browser-only demo. Data is stored locally, unencrypted. Export a
          backup before clearing browser data.
        </p>
        <div class="footer-actions">
          <button
            class="quiet"
            @click=${onExport}
            ?disabled=${!state || importing}
          >
            Export JSON
          </button>
          <label class="file-button" aria-disabled=${importing}
            >${importing ? "Importing..." : "Import JSON"}<input
              type="file"
              accept=".json,application/json"
              aria-label="Import JSON"
              @change=${onImport}
              ?disabled=${importing}
          /></label>
          <button class="quiet" @click=${onReset} ?disabled=${importing}>
            Reset demo
          </button>
        </div>
        <small
          >No backend or multi-user synchronization. Runtime renderer: pinned
          CDN dependency; network access is required to load it.</small
        >
      </footer>`,
    root,
  );
}

export interface specBindings {
  boot: typeof boot;
}
async function boot(): Promise<void> {
  try {
    ({ html, render } =
      await import("https://cdn.jsdelivr.net/npm/lit-html@3.3.1/+esm"));
  } catch (error) {
    if (root) {
      root.textContent = `Unable to load the CDN renderer. Check your connection and allow cdn.jsdelivr.net, then reload. ${errorText(error)}`;
      root.setAttribute("role", "alert");
    }
    return;
  }
  root?.replaceChildren();
  try {
    store = new WorkspaceStore(window.localStorage);
    state = store.load();
  } catch (error) {
    notice = errorText(error);
    failed = true;
  }
  draw();
}

void boot();
