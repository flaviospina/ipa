# IPA — Indicador do Perfil de Atendimento (Abordagem ACP · VIPEDia)

Webapp unificado do diagnóstico IPA: consentimento LGPD → identificação →
questionário (3 quadros × 12 palavras) → cálculo → **relatório individual de
8 fases gerado automaticamente** → PDF.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `webapp/` | Aplicação completa (HTML/CSS/JS puros, sem build). Publicar esta pasta no servidor. |
| `api/` | **Backend recomendado**: MySQL/PHP na própria hospedagem (`api.php` + `schema.sql` + guia). |
| `backend/` | Backend legado em Google Apps Script (mantido como alternativa). |
| `ANALISE-SISTEMA-IPA.md` | Análise detalhada do sistema, benchmark de mercado e roadmap de evolução. |

## Publicação rápida

1. Siga o `api/README.md`: crie o banco MySQL no cPanel, importe o `schema.sql`,
   preencha o `config.php` e envie a pasta `api/` para o servidor.
2. Envie `webapp/` (como `ipa/`), `painel/` e `home/` — o front-end já aponta
   para `../api/api.php` (mesma origem, sem configuração).
4. **Execute o checklist de segurança** do `backend/README.md` (arquivar a URL antiga
   do Apps Script, remover as páginas antigas `acp/` e `ipa/` e a aba "Configurações"
   da home).

## O que mudou em relação à versão anterior

- **Fluxo unificado**: o relatório (8 fases da metodologia) é gerado na hora, no
  navegador — sem copiar/colar planilha, sem etapa manual.
- **Segurança**: sem senha no código-fonte, sem simulador público, backend com
  validação estrita (permutação 0–11 por quadro), honeypot, rate-limit, scores
  recalculados no servidor e dados de teste em aba separada.
- **LGPD**: consentimento explícito registrado com cada resposta.
- **Confiabilidade**: envio com resposta verificável (sem `no-cors` cego),
  progresso salvo localmente (retomada após recarregar) e fila de reenvio offline.
- **Validação do instrumento**: é impossível avançar sem uma escala completa e
  sem repetição de notas, como exige a metodologia.
- **Acessibilidade**: paleta dos 4 estilos ajustada e validada para daltonismo e
  contraste (dourado `#D9A400`, laranja `#E8401A`, azul `#2952CC`, verde `#0E9F6E`),
  com rótulos diretos em todos os gráficos.
