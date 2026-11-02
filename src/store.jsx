import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrfToken } from './api.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const CART_KEY = 'hv_bag';

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [publicDemo, setPublicDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState(loadCart);
  const [toast, setToast] = useState(null);

  const refreshAuth = useCallback(async () => {
    const data = await api('/api/auth/me');
    setUser(data.user);
    setMode(data.mode);
    setPublicDemo(data.publicDemo);
    setCsrfToken(data.csrfToken);
    setReady(true);
    return data;
  }, []);

  useEffect(() => {
    refreshAuth().catch(() => setReady(true));
  }, [refreshAuth]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Private windows can refuse storage. The bag still works for this page view.
    }
  }, [cart]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({
    user, mode, publicDemo, ready, refreshAuth, setUser, setMode, toast,
    notify: (message) => setToast(message),
    cart,
    cartCount: cart.reduce((s, i) => s + i.quantity, 0),
    addToCart: (slug, quantity = 1) => setCart((c) => {
      const found = c.find((i) => i.slug === slug);
      return found ? c.map((i) => (i.slug === slug ? { ...i, quantity: i.quantity + quantity } : i)) : [...c, { slug, quantity }];
    }),
    setQuantity: (slug, quantity) => setCart((c) => (quantity < 1 ? c.filter((i) => i.slug !== slug) : c.map((i) => (i.slug === slug ? { ...i, quantity } : i)))),
    clearCart: () => setCart([]),
    logout: async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setCsrfToken(null);
      await refreshAuth();
    },
  }), [user, mode, publicDemo, ready, refreshAuth, toast, cart]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
