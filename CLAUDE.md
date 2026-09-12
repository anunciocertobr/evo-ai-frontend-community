# Fluxo de trabalho: múltiplas máquinas, GitHub e VPS de produção

Este repositório é editado por sessões de Claude Code rodando em **mais de
uma máquina ao mesmo tempo**, e é implantado numa VPS compartilhada
(`145.223.26.168`) via `bin/deploy_vps.sh`. As duas regras abaixo existem
porque já foram violadas na prática e causaram um incidente real de
produção — leia antes de mesclar ou implantar qualquer coisa. (Mesmo
incidente, mesma regra, documentada em espelho no repo do backend
`evo-ai-crm-community/CLAUDE.md` — leia lá o relato completo se quiser mais
contexto; aqui vai a versão aplicada a este repo.)

## Incidente que gerou esta regra (2026-09-10/12)

Uma sessão numa outra máquina implantou várias features direto da branch
compartilhada `feat/multi-feature-sync-20260901` pra produção (via
`DEPLOY_BRANCH` apontando pra essa branch em vez de `main`), sem nunca
mesclar essa branch em `main` no GitHub. `main` e a produção divergiram: a
produção ficou 28 commits à frente do GitHub sem que ninguém percebesse,
porque "o deploy funcionou" e ninguém comparou o que estava rodando com o
que o GitHub mostrava.

## Regra 1 — nunca implante a partir de uma branch que não seja `main`

```bash
# 1) mesclar a branch de trabalho compartilhada em main
git checkout main && git pull && git merge --no-ff origin/feat/<branch-compartilhada>
# ... resolver conflitos, verificar (ver checklist abaixo), commitar, dar push ...
git push origin main

# 2) só ENTÃO implantar, sempre a partir de main
bin/deploy_vps.sh "descrição-curta-do-que-mudou"
```

Se for genuinamente necessário um hotfix implantado direto de uma branch,
mescle essa branch em `main` e dê push **imediatamente depois**, antes de
encerrar a sessão — nunca deixe o hotfix pendurado só na branch.

## Regra 2 — antes de mexer em qualquer coisa, compare os três estados

1. **GitHub**: `git fetch --all && git log origin/main -5` e `git log
   origin/feat/<branch-compartilhada> -5` — veja se a branch compartilhada
   tem commits que `main` ainda não tem.
2. **Local**: `git status`, `git log -5`.
3. **VPS de fato**: a tag da imagem Docker carrega timestamp + SHA curto +
   nota:
   ```bash
   ssh -i ~/.ssh/id_ed25519_vps_crm root@145.223.26.168 \
     "docker service inspect evocrm_evocrm_frontend --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'"
   ```
   Compare o SHA com `git log --oneline` / `git merge-base --is-ancestor
   <sha> origin/main`. Se encontrar divergência, pare e resolva isso
   primeiro antes de empilhar trabalho novo.

## Checklist de merge (aplicar sempre)

1. `git merge --no-commit --no-ff origin/<branch>` — nunca `--ff`.
2. Ler CADA conflito por completo, entender a intenção dos dois lados.
   Preferir o lado mais completo/testado; nunca descartar funcionalidade
   sem motivo técnico claro. Se dois lados parecerem redesenhos
   incompatíveis da MESMA área de UI (não um conflito textual trivial —
   já aconteceu com o modal "Criar Post" do Gestor de Posts), investigue
   qual é mais recente antes de decidir: `git merge-base --is-ancestor
   <commit> <branch>` e `git log --oneline <branch> -- <arquivo>` provam
   qual lado é "mais velho" e já foi substituído por um commit que o outro
   lado nunca recebeu.
3. Se o merge trouxe dependência nova em `package.json`/`package-lock.json`
   (ex.: uma lib de OAuth nova), rode `npm install` antes de verificar —
   senão o `tsc`/build vai acusar "Cannot find module" por um motivo que
   não é bug de código.
4. Verificação mínima antes de commitar o merge, sempre nos arquivos
   tocados pelo merge (não é preciso rodar no repo inteiro toda vez, mas
   rode pelo menos `tsc -b --force` completo pra não perder erro em cadeia
   entre arquivos):
   - `npx tsc -b --force` — este projeto tem um baseline de erros
     pré-existentes espalhados por arquivos não relacionados a nenhum
     trabalho atual (ex.: `FinancesPage.tsx`, `GtmPage.tsx`,
     `InventoryPage.tsx`, `HoleritePage.tsx`, `ga4Utils.ts`). Antes de
     "corrigir" um erro que aparece depois de um merge, confira se ele já
     existia ANTES do merge em ambos os lados
     (`git show <commit>:<arquivo> | grep ...`) — se sim, é dívida técnica
     pré-existente, não uma regressão sua, e não faz parte do escopo do
     merge corrigi-lo. Só corrija erros que o PRÓPRIO merge introduziu
     (import não usado num arquivo novo, tipo que só existe de um lado,
     etc.).
   - `npx eslint <arquivos tocados>`
   - `npx vite build` (build de produção de verdade, não só o dev server)
5. Commit detalhado explicando cada conflito resolvido e por quê. `git push
   origin main`. Só depois, `bin/deploy_vps.sh <nota>`.
6. Depois do deploy: `curl` checando 200 em
   `https://crmcerto.anunciocertobr.com.br/`.
