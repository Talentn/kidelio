import React, { createContext, useContext, useEffect, useState } from "react";
import { apiV1, peekCacheV1, prefetchV1 } from "../lib/api";

const STORE_PATH = "/store";

export type StoreConfig = {
  store: string;
  currency: string;
  authenticated: boolean;
  shipping_cost: number;
  free_shipping_threshold: number;
  communication?: string;
  google_auth?: boolean;
  urls: { site: string; admin: string };
};

type StoreContextType = {
  config: StoreConfig | null;
  apiConnected: boolean;
  loading: boolean;
};

const StoreContext = createContext<StoreContextType>({
  config: null,
  apiConnected: false,
  loading: true,
});

async function fetchStoreConfig(): Promise<StoreConfig> {
  const attempts = import.meta.env.PROD ? 3 : 1;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await apiV1<StoreConfig>(STORE_PATH);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(() => peekCacheV1<StoreConfig>(STORE_PATH));
  const [apiConnected, setApiConnected] = useState(!!peekCacheV1(STORE_PATH));
  const [loading, setLoading] = useState(() => !peekCacheV1(STORE_PATH));

  useEffect(() => {
    prefetchV1("/categories");
    prefetchV1("/products");
    prefetchV1("/products?featured=true");

    fetchStoreConfig()
      .then((data) => {
        setConfig(data);
        setApiConnected(true);
      })
      .catch(() => setApiConnected(false))
      .finally(() => setLoading(false));
  }, []);

  return (
    <StoreContext.Provider value={{ config, apiConnected, loading }}>
      {import.meta.env.DEV && !loading && !apiConnected && (
        <div
          className="bg-amber-500 text-white text-center text-sm font-semibold px-4 py-2"
          role="alert"
        >
          Boutique hors ligne — lancez <code className="bg-amber-600/50 px-1 rounded">npm run dev</code> à la racine du projet.
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
