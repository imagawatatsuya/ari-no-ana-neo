/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LATEST_DEPLOYED_AT_ISO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
