"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * The basket.
 *
 * **It lives in the browser, and there is no `carts` table** (ADR-64). The
 * roadmap's Phase 4 assumed server-side carts because it assumed online payment:
 * a cart has to survive a redirect to a payment provider and come back. Bondo
 * takes no payment online, so a basket never leaves the tab it was filled in,
 * and the first thing worth persisting is the order itself.
 *
 * What that buys, beyond less code: a guest basket needs no anonymous session,
 * no merge-on-sign-in, and no expiry job. What it costs is that a basket does
 * not follow a shopper to their phone. That is the right trade for a shop whose
 * checkout is a phone call, and it is reversible — the storage key below is the
 * only thing that would change.
 *
 * Lines carry a **price snapshot for display only**. The order's real prices are
 * read inside `place_order()` from the catalog, so a stale or tampered figure
 * here changes what the shopper sees, never what they are charged.
 */

export type CartLine = {
  productId: string;
  variantId: string | null;
  /** For the basket panel; the order re-reads all of this server-side. */
  name: string;
  slug: string;
  sku: string;
  imagePath: string | null;
  unitPriceCents: number;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  /** `false` until localStorage has been read, so nothing renders mid-hydration. */
  ready: boolean;
  itemCount: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "bondo.cart.v1";

/** Matches `order_items_quantity_sane`, so the basket cannot build a rejected order. */
const MAX_QUANTITY = 100;

/** Matches the guard in `place_order`. */
const MAX_LINES = 50;

const sameLine = (
  line: CartLine,
  productId: string,
  variantId: string | null,
) => line.productId === productId && line.variantId === variantId;

/**
 * Reads the stored basket, discarding anything that is not shaped like one.
 *
 * `localStorage` is user-writable, so this is parsing untrusted input: a
 * malformed entry must produce an empty basket rather than a render crash on
 * every page that shows the header.
 */
function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (line): line is CartLine =>
          typeof line === "object" &&
          line !== null &&
          typeof (line as CartLine).productId === "string" &&
          typeof (line as CartLine).name === "string" &&
          typeof (line as CartLine).quantity === "number" &&
          (line as CartLine).quantity > 0,
      )
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount, never during render: the server has no localStorage, and
  // seeding state from it directly is the classic hydration mismatch.
  useEffect(() => {
    setLines(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing and a full quota both land here. A basket that cannot
      // be saved still works for this tab, which is better than a thrown error
      // on every change.
    }
  }, [lines, ready]);

  // A second tab is a second basket otherwise, and the shopper only has one.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStored());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((entry) =>
        sameLine(entry, line.productId, line.variantId),
      );

      if (existing) {
        return current.map((entry) =>
          sameLine(entry, line.productId, line.variantId)
            ? {
                ...entry,
                quantity: Math.min(entry.quantity + quantity, MAX_QUANTITY),
              }
            : entry,
        );
      }

      if (current.length >= MAX_LINES) return current;

      return [
        ...current,
        { ...line, quantity: Math.min(quantity, MAX_QUANTITY) },
      ];
    });
  }, []);

  const setQuantity = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      setLines((current) =>
        quantity <= 0
          ? current.filter((entry) => !sameLine(entry, productId, variantId))
          : current.map((entry) =>
              sameLine(entry, productId, variantId)
                ? { ...entry, quantity: Math.min(quantity, MAX_QUANTITY) }
                : entry,
            ),
      );
    },
    [],
  );

  const remove = useCallback((productId: string, variantId: string | null) => {
    setLines((current) =>
      current.filter((entry) => !sameLine(entry, productId, variantId)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalCents: lines.reduce(
        (sum, line) => sum + line.unitPriceCents * line.quantity,
        0,
      ),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * The basket, from any client component.
 *
 * Throws when there is no provider above it. That is a wiring mistake in this
 * repository rather than a runtime condition, and failing loudly here beats
 * every basket control silently doing nothing.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }

  return context;
}
