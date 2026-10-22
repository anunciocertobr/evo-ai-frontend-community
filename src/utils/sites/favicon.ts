// Favicon de um site cadastrado em Dashboards > Sites — resolvido 100% no
// front via o serviço público do Google, sem fetch/armazenamento nenhum no
// backend (decisão de escopo: não há precedente de favicon no repo, e
// manter/buscar favicon do lado do servidor é manutenção desnecessária
// quando esse serviço já cobre os casos comuns).
export function getFaviconUrl(hostname: string | null | undefined, size = 64): string {
  if (!hostname) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
}
