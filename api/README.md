# Backend MySQL (recomendado) — substitui o Google Apps Script

Roda **na mesma hospedagem do site** (HostGator): mesma origem, sem CORS, sem
implantações, sem URL externa. Testado de ponta a ponta (14 testes de integração).

## Instalação (uma vez, ~10 minutos)

1. **Criar o banco** — no cPanel do HostGator: *MySQL® Databases*:
   - Crie o banco (ex.: `itthri00_ipa`);
   - Crie o usuário (ex.: `itthri00_ipauser`) com senha forte;
   - Em *Add User To Database*, associe usuário ↔ banco com **ALL PRIVILEGES**.
2. **Criar as tabelas** — no cPanel, abra o *phpMyAdmin*, selecione o banco e
   use a aba **Importar** com o arquivo [`schema.sql`](./schema.sql).
3. **Configurar** — copie `config.example.php` como `config.php` e preencha:
   dados do banco, uma `PANEL_KEY` longa (é a senha do Painel do Consultor) e,
   opcionalmente, a `GEMINI_API_KEY` (análise de IA no relatório).
4. **Publicar** — envie a pasta `api/` (com `api.php` + `config.php`) para o
   servidor, como **pasta irmã** de `ipa/` (webapp) e `painel/`:

   ```
   /vipedia/new_ipa/
   ├── home/
   ├── ipa/        <- webapp (index.html, 360.html, css/, js/)
   ├── painel/
   └── api/        <- api.php, config.php   (NÃO envie o schema.sql nem o example)
   ```

5. **Testar** — abra `https://SEU-SITE/.../api/api.php` no navegador:
   deve responder `{"ok":false,"code":"method_not_allowed","v":4}`.

O front-end já aponta para `../api/api.php` (mesma origem) — nada a configurar.
No painel, a chave de acesso é a `PANEL_KEY` do `config.php`.

## O que a API faz

| Ação | Método | Descrição |
|---|---|---|
| (padrão) | POST | Grava o diagnóstico IPA (validação estrita: permutação 0–11 por quadro, honeypot, rate-limit, scores recalculados no servidor). Reenvio da fila com o mesmo id não duplica. Retorna a análise de IA se configurada. |
| `relatorio` | POST | Arquiva o HTML do relatório no banco, vinculado ao registro. |
| `360` | POST | Grava a avaliação externa anônima (IPA 360°). |
| `list` / `list360` | GET + `key` | Alimenta o Painel do Consultor (exige `PANEL_KEY`). |
| `relatorio` | GET + `token` | Serve o relatório arquivado por link secreto (o link aparece no painel). |

## Exportar para Excel

No phpMyAdmin: selecione a tabela `ipa_respostas` → aba **Exportar** → formato
CSV ou XLSX. (O painel também exporta CSV filtrado.)

## Segurança e LGPD

- `config.php` nunca vai para o repositório (contém credenciais).
- Relatórios servidos apenas por token aleatório de 32 caracteres.
- Dados pessoais ficam no seu banco, na sua hospedagem — sem terceiros.
- Validação estrita torna inútil a injeção de dados fabricados.
