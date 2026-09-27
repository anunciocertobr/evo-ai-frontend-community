// Nome sugerido ao duplicar um público: o MESMO nome do original, ganhando
// sufixo só quando já existe um público com esse nome na conta de destino
// (e numerando enquanto houver repetição). Regra compartilhada entre a
// duplicação de público personalizado (AudienceCreateDialog) e de público
// salvo (TargetingBuilder) — o usuário pediu "o mesmo nome" e o conflito
// precisa ser resolvido sem ele ter que renomear na mão.
export function suggestCopyName(base: string, takenNames: string[]): string {
  const taken = new Set(takenNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base;
  let index = 1;
  while (taken.has(`${base} - Cópia ${index}`.trim().toLowerCase())) index += 1;
  return index === 1 ? `${base} - Cópia` : `${base} - Cópia ${index}`;
}
