import React, { createContext, useContext, useEffect, useState } from "react";
import { apiV1, peekCacheV1, prefetchV1 } from "../lib/api";

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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(() => peekCacheV1<StoreConfig>("/config"));
  const [apiConnected, setApiConnected] = useState(!!peekCacheV1("/config"));
  const [loading, setLoading] = useState(() => !peekCacheV1("/config"));

  useEffect(() => {
    prefetchV1("/categories");
    prefetchV1("/products");
    prefetchV1("/products?featured=true");

    apiV1<StoreConfig>("/config")
      .then((data) => {
        setConfig(data);
        setApiConnected(true);
      })
      .catch(() => setApiConnected(false))
      .finally(() => setLoading(false));
  }, []);

  return (
    <StoreContext.Provider value={{ config, apiConnected, loading }}>
      {!loading && !apiConnected && (
        <div className="api-offline" role="alert">
          Boutique hors ligne — lancez <code>npm run dev</code> à la racine du projet.
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
