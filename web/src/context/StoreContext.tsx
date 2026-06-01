import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

export type StoreConfig = {
  store: string;
  currency: string;
  authenticated: boolean;
  shipping_cost: number;
  free_shipping_threshold: number;
  urls: { storefront: string; admin: string };
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
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<StoreConfig>("/config")
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
          Boutique hors ligne — démarrez l&apos;API Rails sur le port 3000 (<code>npm run dev</code> à la racine).
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
