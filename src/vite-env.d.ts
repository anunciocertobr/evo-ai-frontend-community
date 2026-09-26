/// <reference types="vite/client" />

// Assets importados via `import url from './arquivo.png'` (o Vite resolve a URL
// com hash no build). Necessário pro Leaflet: os PNGs do marcador padrão são
// importados direto do pacote em RealEstateItemModal.tsx, senão o TypeScript
// não reconhece o módulo.
declare module '*.png' {
  const url: string;
  export default url;
}

declare const __APP_VERSION__: string;

declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}
