/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_ENABLE_CHAT_WS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
