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

## Relatório enriquecido por IA (opcional)

Com uma chave do Google AI Studio configurada, cada relatório passa a incluir
**6 blocos de análise personalizada** (interpretação do perfil, momentos,
talentos, desenvolvimento, recomendações e conclusão) escritos pelo Gemini
segundo as regras da metodologia ACP (tom encorajador, "pontos a desenvolver",
fidelidade terminológica). Para ativar:

1. Gere uma chave gratuita em <https://aistudio.google.com/apikey>.
2. No editor do Apps Script: **⚙️ Configurações do projeto → Propriedades do
   script → Adicionar propriedade**: chave `GEMINI_API_KEY`, valor = sua chave.
3. Pronto — não precisa reimplantar. Sem a propriedade, o relatório continua
   funcionando apenas com os textos padrão da metodologia (a IA nunca bloqueia
   o diagnóstico: qualquer falha é silenciosa).

A chave fica **somente no servidor** (Script Properties) — nunca no site.

## IPA 360° (`webapp/360.html`)

Avaliação externa e **anônima**: gestor, colegas e clientes avaliam como
percebem o atendimento do profissional, com os mesmos 3 quadros de 12 palavras.

- O consultor gera o link de convite na aba **IPA 360°** do painel
  (ex.: `.../ipa/360.html?avaliado=Ana%20Souza&org=Cl%C3%ADnica`).
- As respostas caem na aba `RESPOSTAS_360` da planilha (com a relação
  profissional, sem identificar o avaliador) e passam pela mesma validação
  estrita do IPA.
- O painel cruza autoavaliação × média das percepções externas e aponta a
  maior divergência (ponto cego ou força subestimada).

## Painel do Consultor (`painel/index.html`)

Dashboard com KPIs, distribuição de estilos predominantes, médias por organização
e tabela de participantes (busca, filtros, exportação CSV e link do relatório de
cada um). Para ativar o acesso aos dados reais:

1. No editor do Apps Script (com o código atualizado), execute **uma vez** a função
   `configurarChavePainel` (menu suspenso ao lado de "Executar").
2. Abra **Registro de execução** e copie a chave exibida.
3. Publique a pasta `painel/` no servidor (ex.: `.../vipedia/painel/`) e entre com
   essa chave na tela de acesso. A chave fica só na sessão do navegador.
4. Para trocar a chave (ex.: consultor desligado), execute `configurarChavePainel`
   novamente — a anterior deixa de valer na hora.

Sem a chave, o endpoint GET não expõe nenhum dado. O botão
**"Ver demonstração"** carrega dados fictícios, sem tocar na planilha.

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
