/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ORIGIN?: string;
  readonly VITE_WEB_ORIGIN?: string;
  readonly SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
