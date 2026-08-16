# VIPEDia · IPA — Indicador de Preferência de Conduta (Abordagem ACP)

Sistema completo do diagnóstico IPA: o profissional responde o questionário
(3 quadros × 12 palavras), recebe o **relatório individual de 8 fases** na hora,
e os resultados ficam no banco de dados — organizados **por empresa**, com painel
de acesso restrito e ciclos de avaliação **360°** por convite.

- Homologação: `https://itthrive.com.br/vipedia/new_ipa/`
- Banco: `itthri79_vipedia` · usuário `itthri79_vipedia_user` (MySQL/HostGator)

---

## Mapa do projeto

| Pasta | O que é | Guia |
|---|---|---|
| `webapp/` | O questionário (IPA e 360°). HTML/CSS/JS puros, sem build | este arquivo |
| `backend/sql/` | Criação do banco: 14 tabelas + carga do instrumento | `backend/sql/README.md` |
| `backend/php/` | Painel administrativo + APIs que gravam no banco | `backend/php/README.md` |
| `backend/apps-script.gs` | Apps Script legado (planilha) — ainda ativo na transição | `backend/README.md` |
| `home/`, `painel/` | Página inicial e painel antigo por chave (`painel/` será desativado na Fase 5) | — |
| `apresentacao/` | Apresentação executiva da Abordagem ACP (`.pptx`/`.pdf`) | `apresentacao/README.md` |
| `ANALISE-SISTEMA-IPA.md` | Análise do sistema, benchmark e roadmap | — |

## Estado das fases

| Fase | Entrega | Status |
|---|---|---|
| 0 | Correção do vínculo relatório ↔ planilha no Apps Script | ✅ pronta — **exige reimplantar o Apps Script** (v4) |
| 1 | Banco `itthri79_vipedia` (14 tabelas + instrumento) | ✅ pronta |
| 2 | Painel: login, empresas, usuários, auditoria | ✅ pronta |
| 3 | Avaliações gravadas no banco (envio duplo: banco + planilha) | ✅ pronta |
| 4 | 360° por convite de uso único + consolidado | ✅ pronta |
| 5 | Migrar histórico da planilha e desligar o Apps Script | ⏳ próxima |

---

## Instalação do zero (HostGator)

### 1. Criar o banco

No cPanel → *Bancos de Dados MySQL*: crie o banco `itthri79_vipedia`, o usuário
`itthri79_vipedia_user` e associe-os com **ALL PRIVILEGES**.

No phpMyAdmin, com o banco selecionado, importe **nesta ordem**:

1. `backend/sql/01-schema.sql`
2. `backend/sql/02-dados-iniciais.sql`

Conferência: `SELECT COUNT(*) FROM palavras;` deve devolver **36**.

### 2. Enviar os arquivos

Para `public_html/vipedia/new_ipa/`:

```
new_ipa/
├── home/        (já existe — página inicial)
├── webapp/      ← conteúdo da pasta webapp/ deste repositório
├── admin/       ┐
├── api/         │
├── setup/       ├─ conteúdo da pasta backend/php/
├── src/         │
└── config/      ┘
```

### 3. Configurar

Copie `config/config.exemplo.php` para `config/config.php` e preencha:
a **senha do banco**, o `base_url` e uma frase aleatória em `sal_ip`.
O `config.php` está no `.gitignore` — nunca vai para o repositório.

### 4. Criar o administrador geral

Abra **uma vez**: `https://itthrive.com.br/vipedia/new_ipa/setup/criar-admin-geral.php`

A senha inicial aparece **uma única vez** (o banco guarda só o hash). Depois de
entrar, **apague a pasta `setup/`** do servidor.

### 5. Verificações finais

- `.../new_ipa/config/config.exemplo.php` e `.../new_ipa/src/Db.php` devem
  devolver **403** (proteção por `.htaccess`). Se abrirem, mova `config/` e
  `src/` para fora de `public_html` e ajuste o caminho no topo de `src/Db.php`.
- `.../new_ipa/api/diagnostico.php` deve devolver `{"ok":false,"code":"method_not_allowed","v":1}`.
- No editor do Apps Script, cole o `backend/apps-script.gs` atualizado, faça uma
  **nova implantação** e confirme `v: 4` abrindo a URL `/exec` (correção da Fase 0).

---

## Guia de operação

### Cadastrar uma empresa cliente

Painel → **Empresas** → *Cadastrar nova empresa*. O sistema cria junto o acesso
do administrador da empresa e mostra a senha inicial **uma única vez** — repasse
para o cliente; no primeiro acesso a troca é obrigatória. O administrador da
empresa enxerga **apenas os dados da própria empresa**: o filtro é aplicado nas
consultas ao banco, não nas telas.

### Aplicar o diagnóstico IPA

Use o **link do questionário com o identificador da empresa** — ele aparece
pronto na tela Empresas:

```
https://itthrive.com.br/vipedia/new_ipa/webapp/?empresa=clinica-alfa
```

Com esse link o campo "organização" vem preenchido e travado, e a resposta entra
no banco já vinculada à empresa. Os resultados aparecem no painel em
**Avaliações** (scores, estilo predominante, flexibilidade e o relatório
arquivado). Sem o parâmetro, o sistema tenta casar o texto digitado com uma
empresa cadastrada; se não conseguir, o registro fica só na planilha.

### Rodar um ciclo 360°

1. Painel → **360°** → *Abrir novo ciclo* — escolha o participante (ou cadastre)
   e o mínimo de respostas para exibir médias (padrão 3, protege o anonimato).
2. Na tela do ciclo, **Gerar convites**: informe quantos avaliadores por relação
   (gestor, colegas, liderados, cliente interno). Os links aparecem **uma única
   vez** — copie e distribua por WhatsApp ou e-mail. Cada link aceita **uma**
   resposta; o avaliador não digita nome de ninguém.
3. Acompanhe respondidos na mesma tela. O **Resultado consolidado** compara a
   autoavaliação com as médias externas por relação — médias só aparecem quando
   a relação atinge o mínimo. Link perdido? Cancele o convite e gere outro.
4. Ao final, **Fechar ciclo** — os links restantes param de aceitar respostas.

### Papéis de acesso

| Papel | Pode |
|---|---|
| Administrador geral | Tudo, em todas as empresas; cadastra empresas |
| Administrador da empresa | Resultados e usuários **da própria empresa**; abre ciclos 360° |
| Consultor | Resultados e ciclos 360° da empresa |
| Gestor | Consulta resultados da empresa |

---

## Como o sistema garante os resultados

- **O servidor não confia no navegador**: scores, estilo predominante e regra de
  flexibilidade são recalculados no PHP a partir da tabela `palavras`; envio com
  peso repetido ou fora da escala é recusado (também por restrição do banco).
- **Paridade verificada**: o cálculo do PHP foi cruzado com o `engine.js` do
  questionário em perfis de teste distintos — resultados idênticos.
- **Idempotência**: reenvios automáticos da fila do navegador não duplicam nada.
- **Transição segura**: o questionário envia para o banco **e** para a planilha;
  a planilha só será desligada na Fase 5, após conferência.
- **LGPD**: consentimento registrado com versão e data; IP guardado só como
  hash; log de auditoria de quem viu qual relatório; anonimato do 360° protegido
  por mínimo de respostas.

## Desenvolvimento

Sem build e sem dependências externas: `webapp/` é HTML/CSS/JS puro e
`backend/php/` é PHP 8 padrão (PDO). Para testar localmente, suba um
MySQL/MariaDB, aplique os dois SQLs, crie `backend/php/config/config.php`
apontando para ele e rode `php -S 127.0.0.1:8199 -t backend/php`.
Cada README de subpasta descreve a bateria de testes já executada.

## Próximos passos

- **Fase 5** — importar o histórico da planilha para o banco, conferir totais,
  arquivar a implantação do Apps Script e desativar o painel antigo por chave.
- **E-mail** — envio automático de convites 360° e de senhas iniciais
  (hoje: links e senhas são copiados da tela e distribuídos manualmente).
- **Recuperação de senha** pelo próprio usuário (a tabela `usuario_tokens` já
  está pronta; depende do e-mail).
