# IPA — Indicador do Perfil de Atendimento (Abordagem ACP · VIPEDia)

Webapp unificado do diagnóstico IPA: consentimento LGPD → identificação →
questionário (3 quadros × 12 palavras) → cálculo → **relatório individual de
8 fases gerado automaticamente** → PDF.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `webapp/` | Aplicação completa (HTML/CSS/JS puros, sem build). Publicar esta pasta no servidor. |
| `api/` | **Backend único**: MySQL/PHP na própria hospedagem (`api.php` + `schema.sql` + guia). Todos os dados — diagnósticos IPA, avaliações 360° e relatórios — são registrados no banco. |
| `ANALISE-SISTEMA-IPA.md` | Análise detalhada do sistema, benchmark de mercado e roadmap de evolução. |

## Publicação rápida

1. Siga o `api/README.md`: crie o banco MySQL no cPanel, importe o `schema.sql`,
   preencha o `config.php` e envie a pasta `api/` para o servidor.
2. Envie `webapp/`, `painel/` e `home/` (mantendo esses nomes de pasta, lado a
   lado com `api/`) — todos os links internos já apontam entre elas.
3. **Checklist de segurança**: arquivar TODAS as implantações antigas do Google
   Apps Script (Implantar → Gerenciar implantações → Arquivar) — a planilha foi
   descontinuada; remover do servidor as páginas antigas `acp/` e `ipa/` originais
   e a aba "Configurações" da home antiga.

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
