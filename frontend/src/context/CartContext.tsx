import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiV1, peekCacheV1 } from "../lib/api";
import { broadcast, onBroadcast } from "../lib/broadcast";
import { goWsUrl, goWsEnabled, goTrack } from "../lib/goApi";
import { useCartToast } from "./CartToastContext";
import { useAuth } from "./AuthContext";

export type CartItem = {
  productId: number;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  sizeLabel?: string;
  colorLabel?: string;
  colorId?: number;
};

export type CartVariant = {
  colorId?: number;
  colorLabel?: string;
  sizeLabel?: string;
};

type CartContextType = {
  items: CartItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity?: number, variant?: CartVariant) => Promise<void>;
  removeItem: (productId: number, variant?: CartVariant) => Promise<void>;
  updateQty: (productId: number, quantity: number, variant?: CartVariant) => Promise<void>;
  clear: () => Promise<void>;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);

const CART_CACHE_KEY = "kidelio_cart_items";

type CartResponse = {
  items: Array<{
    product_id: number;
    name: string;
    slug: string;
    unit_price: number;
    quantity: number;
    image_url?: string;
    size_label?: string;
    color_label?: string;
    color_id?: number;
  }>;
  subtotal: number;
  count: number;
};

function mapItems(data: CartResponse["items"]): CartItem[] {
  return data.map((i) => ({
    productId: i.product_id,
    name: i.name,
    slug: i.slug,
    price: Number(i.unit_price),
    quantity: i.quantity,
    imageUrl: i.image_url,
    sizeLabel: i.size_label,
    colorLabel: i.color_label,
    colorId: i.color_id,
  }));
}

function variantPayload(variant?: CartVariant) {
  return {
    color_id: variant?.colorId,
    color_label: variant?.colorLabel,
    size_label: variant?.sizeLabel,
  };
}

function readCartCache(): CartItem[] | null {
  try {
    const raw = localStorage.getItem(CART_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : null;
  } catch {
    return null;
  }
}

function writeCartCache(items: CartItem[]) {
  try {
    localStorage.setItem(CART_CACHE_KEY, JSON.stringify(items));
  } catch { /* private browsing */ }
}

function initialItems(): CartItem[] {
  const cachedApi = peekCacheV1<CartResponse>("/cart");
  if (cachedApi?.items) return mapItems(cachedApi.items);
  return readCartCache() ?? [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const showToast = useCartToast()
  const { user } = useAuth()
  const [items, setItemsState] = useState<CartItem[]>(initialItems);
  const [loading, setLoading] = useState(() => initialItems().length === 0 && !peekCacheV1("/cart"));

  const setItems = useCallback((next: CartItem[]) => {
    setItemsState(next);
    writeCartCache(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiV1<CartResponse>("/cart");
      setItems(mapItems(data.items));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [setItems]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // When the logged-in identity changes in THIS tab (login/logout), the
  // cross-tab broadcast doesn't fire locally — so resync the cart from the
  // server (which is now scoped to the new session) and drop stale cache.
  const prevUserId = useRef<number | null>(user?.id ?? null);
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserId.current !== currentId) {
      prevUserId.current = currentId;
      try { localStorage.removeItem(CART_CACHE_KEY); } catch { /* ignore */ }
      refresh();
    }
  }, [user, refresh]);

  useEffect(() => {
    return onBroadcast((event) => {
      if (event.type === "cart" || event.type === "auth") {
        refresh();
      }
    });
  }, [refresh]);

  // ── Go cart event tracker ─────────────────────────────────────────────────
  const cartWsRef = useRef<WebSocket | null>(null)
  const trackCart = useCallback((action: string, item?: CartItem | null, qty?: number) => {
    const payload = {
      action,
      product_id:   item?.productId,
      product_name: item?.name,
      quantity:     qty ?? item?.quantity ?? 1,
      price:        item?.price,
    }
    try {
      if (!goWsEnabled()) {
        goTrack("/cart/events", payload)
        return
      }
      if (!cartWsRef.current || cartWsRef.current.readyState !== WebSocket.OPEN) {
        const ws = new WebSocket(goWsUrl("/cart/ws"))
        ws.onclose = () => { cartWsRef.current = null }
        cartWsRef.current = ws
      }
      const body = JSON.stringify(payload)
      const ws = cartWsRef.current!
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(body)
      } else {
        ws.addEventListener("open", () => ws.send(body), { once: true })
      }
    } catch { /* non-critical */ }
  }, [])

  const addItem = async (productId: number, qty = 1, variant?: CartVariant) => {
    const data = await apiV1<CartResponse>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity: qty, ...variantPayload(variant) }),
    });
    const newItems = mapItems(data.items)
    setItems(newItems)
    broadcast({ type: "cart", action: "changed" });
    const added = newItems.find(i => i.productId === productId)
    trackCart("add", added, qty)
    if (added) showToast(added.name, added.imageUrl)
  };

  const removeItem = async (productId: number, variant?: CartVariant) => {
    const removed = items.find(i => i.productId === productId)
    const data = await apiV1<CartResponse>(`/cart/items/${productId}`, {
      method: "DELETE",
      body: JSON.stringify(variantPayload(variant)),
    });
    setItems(mapItems(data.items));
    broadcast({ type: "cart", action: "changed" });
    trackCart("remove", removed)
  };

  const updateQty = async (productId: number, quantity: number, variant?: CartVariant) => {
    const data = await apiV1<CartResponse>(`/cart/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity, ...variantPayload(variant) }),
    });
    setItems(mapItems(data.items));
    broadcast({ type: "cart", action: "changed" });
    const updated = items.find(i => i.productId === productId)
    trackCart("update", updated, quantity)
  };

  const clear = async () => {
    const data = await apiV1<CartResponse>("/cart", { method: "DELETE" });
    setItems(mapItems(data.items));
    broadcast({ type: "cart", action: "changed" });
    trackCart("clear")
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, loading, refresh, addItem, removeItem, updateQty, clear, total, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
