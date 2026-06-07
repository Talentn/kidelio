import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const STORE_PATH = "/v1/store";
const IS_DEV = process.env.NODE_ENV === "development";

type StoreConfig = {
  store: string;
  urls: { storefront: string; admin: string };
};

type StoreContextType = {
  config: StoreConfig | null;
  apiConnected: boolean;
};

const StoreContext = createContext<StoreContextType>({
  config: null,
  apiConnected: false,
});

async function fetchStoreConfig(): Promise<StoreConfig> {
  const attempts = IS_DEV ? 1 : 3;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await api<StoreConfig>(STORE_PATH);
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
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreConfig()
      .then((data) => {
        setConfig(data);
        setApiConnected(true);
      })
      .catch(() => setApiConnected(false))
      .finally(() => setLoading(false));
  }, []);

  return (
    <StoreContext.Provider value={{ config, apiConnected }}>
      {IS_DEV && !loading && !apiConnected && (
        <div className="api-offline" role="alert">
          API non connectée — lancez <code>npm run dev</code> depuis la racine du projet.
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
