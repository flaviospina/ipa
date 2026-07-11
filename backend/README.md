# Backend IPA — Guia de implantação e segurança

## Passo a passo (Google Apps Script)

1. Abra a **Planilha Google** que receberá as respostas (crie uma nova, de preferência —
   não reutilize a antiga, que recebeu dados de teste misturados com produção).
2. Menu **Extensões → Apps Script**. Apague o conteúdo e cole o arquivo
   [`apps-script.gs`](./apps-script.gs).
3. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Você**
   - Quem pode acessar: **Qualquer pessoa**
4. Copie a URL gerada (termina em `/exec`) e cole em
   `webapp/js/config.js` no campo `ENDPOINT`.
5. Publique a pasta `webapp/` no servidor (ex.: `https://itthrive.com.br/vipedia/ipa/`).

## Ações de segurança OBRIGATÓRIAS no ambiente antigo

- [ ] **Arquivar a implantação antiga do Apps Script** (a URL `AKfycbxI2...` ficou
      exposta no código-fonte público das páginas `home` e `acp`): no editor do Apps
      Script antigo, **Implantar → Gerenciar implantações → Arquivar**.
- [ ] **Remover do servidor as páginas antigas** `acp/index.html` e `ipa/index.html`
      (substituídas pelo novo `webapp/`), e na `home/index.html` **remover a aba
      "Configurações"** e todo o bloco do "Laboratório Técnico" (a senha `VIP2026`
      estava visível no código-fonte, junto com o simulador de lote que gravava na
      base de produção).
- [ ] **Limpar da planilha antiga** os registros de teste ("Simulado ...", "TESTE LAB").

## Atualizando o script (quando o código mudar)

Se você já tem uma implantação ativa e o arquivo `apps-script.gs` foi atualizado:

1. Cole o novo código por cima do antigo no editor e salve.
2. **Implantar → Gerenciar implantações → ✏️ (editar) → Versão: "Nova versão" → Implantar.**
   A URL `/exec` continua a mesma — não precisa mexer no `config.js`.
3. Na primeira execução após a atualização o Google pode pedir novas permissões
   (o arquivamento de relatórios usa o Google Drive) — autorize normalmente.

## Arquivo do relatório de cada participante

A cada envio, o backend salva o relatório individual na pasta **"IPA - Relatórios"**
do Drive da conta dona da planilha (PDF; se a conversão falhar, HTML) e grava o
link na coluna **"Relatório (link)"** da aba `RESPOSTAS`. Os arquivos ficam
**privados** — só a conta dona da planilha acessa, adequado à LGPD. Para entregar
a um participante, baixe o arquivo ou compartilhe individualmente pelo Drive.

## O que o novo backend garante

| Proteção | Como funciona |
|---|---|
| Validação estrita | Cada quadro precisa ser uma permutação completa dos pesos 0–11 (soma 66). Envios fabricados são rejeitados. |
| Scores no servidor | Os totais por estilo são recalculados no servidor — o cliente não consegue enviar scores adulterados. |
| Honeypot | Campo `website` invisível para humanos; se vier preenchido (bots), rejeita. |
| Rate limit | Máx. 10 gravações/minuto — bloqueia rajadas de spam. |
| Testes isolados | Simulações rodam só pelo editor do Apps Script (exige login) e gravam na aba `SIMULADOS`, nunca em `RESPOSTAS`. |
| Anti fórmula-injection | Campos de texto são sanitizados antes de gravar na planilha. |
| Resposta verificável | Devolve `{ ok: true }` — o front-end confirma a gravação e, se falhar, guarda localmente e reenvia. |
| LGPD | O timestamp do consentimento é registrado junto com cada resposta. |

## Limitações conhecidas (e o próximo passo)

O Apps Script com acesso "Qualquer pessoa" continua sendo um endpoint público —
as validações acima tornam o abuso inócuo, mas não o impedem por completo.
Quando o projeto evoluir para um backend próprio (Node/Python + banco de dados),
adicionar: autenticação por convite (link único por participante), painel do
consultor e trilha de auditoria. Essa evolução está descrita no documento
`ANALISE-SISTEMA-IPA.md` (Horizonte 1).
