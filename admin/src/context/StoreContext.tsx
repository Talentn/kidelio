import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    api<StoreConfig>("/v1/config")
      .then((data) => {
        setConfig(data);
        setApiConnected(true);
      })
      .catch(() => setApiConnected(false));
  }, []);

  return (
    <StoreContext.Provider value={{ config, apiConnected }}>
      {!apiConnected && (
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
