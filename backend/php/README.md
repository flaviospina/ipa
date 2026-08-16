# Painel VIPEDia — Fase 2

Fundação PHP: acesso com login, separação entre empresas e gestão de usuários.
Roda em hospedagem compartilhada (HostGator, PHP 8 + MySQL), sem dependências externas.

## Instalação

**1. Banco.** Aplicar antes `backend/sql/01-schema.sql` e `02-dados-iniciais.sql`
(instruções em `backend/sql/README.md`).

**2. Arquivos.** Enviar o conteúdo desta pasta para
`public_html/vipedia/new_ipa/`, mantendo a estrutura:

```
vipedia/new_ipa/
├── admin/       telas do painel   → /vipedia/new_ipa/admin/login.php
├── setup/       instalação (apagar depois de usar)
├── src/         código de apoio   (bloqueado pela web)
└── config/      senha do banco    (bloqueado pela web)
```

**3. Configuração.** Copiar `config/config.exemplo.php` para `config/config.php`
e preencher a senha do banco. Conferir também `base_url`.

**4. Administrador geral.** Abrir uma vez:

```
https://itthrive.com.br/vipedia/new_ipa/setup/criar-admin-geral.php
```

A senha aparece **uma única vez** — anote. O script se recusa a rodar de novo
depois que a conta existe, mas mesmo assim **apague a pasta `setup/`**.

**5. Entrar** em `/vipedia/new_ipa/admin/login.php`. O sistema exige a troca da
senha no primeiro acesso.

## Como funciona o acesso

| Papel | Alcance |
|---|---|
| `admin_geral` | Todas as empresas. Cadastra empresas e cria o administrador de cada uma |
| `admin_empresa` | Só a própria empresa. Cria consultores e gestores dela |
| `consultor`, `gestor` | Só a própria empresa, sem gerenciar usuários |

A separação não é uma regra de tela: `Auth::escopoEmpresa()` devolve o id da
empresa do usuário (ou `null` para o administrador geral) e esse valor entra na
cláusula `WHERE` das consultas. Um administrador de empresa não alcança outra
nem trocando o endereço no navegador.

Senhas nunca são guardadas nem exibidas em texto: `password_hash()` na gravação,
`password_verify()` na conferência. A senha inicial gerada pelo administrador é
mostrada uma vez na tela e some — para dar outra, use **Redefinir senha**.

## Verificação já feita

Testado contra servidor PHP e MariaDB reais — 22 testes, todos passando:

- páginas protegidas redirecionam para o login sem sessão
- POST sem token CSRF devolve 419
- senha correta com `trocar_senha` obriga a troca antes de qualquer outra tela
- senha fraca é recusada (mínimo 10, maiúscula, minúscula, número)
- administrador geral cadastra empresa e o acesso dela numa transação só
- administrador de empresa: recebe **403** em `empresas.php`, e a lista de
  usuários dele **não inclui** o administrador geral nem contas de outra empresa
- 3 tentativas erradas bloqueiam a conta — a senha certa em seguida é recusada
- logout encerra a sessão no banco, não só o cookie

## Um ponto que precisa ser conferido no servidor

As pastas `config/` e `src/` são protegidas por `.htaccess` (`Require all denied`,
com a variante do Apache 2.2 junto). **O servidor embutido do PHP ignora
`.htaccess`, então isso não pôde ser testado aqui.** Depois de publicar, abra:

```
https://itthrive.com.br/vipedia/new_ipa/config/config.exemplo.php
https://itthrive.com.br/vipedia/new_ipa/src/Db.php
```

As duas devem devolver **403 Forbidden**. Se abrirem, o `AllowOverride` do plano
está desligado — nesse caso mova `config/` e `src/` para fora de `public_html`
e ajuste o caminho no topo de `src/Db.php`.

## O que ainda não existe

- **Gravação das avaliações no banco.** O questionário continua enviando para o
  Apps Script e gravando na planilha. É a próxima etapa.
- **Envio de e-mail.** As senhas iniciais são entregues na tela, para o
  administrador repassar. O envio automático entra junto com os convites 360°.
- **Recuperação de senha pelo próprio usuário.** Hoje quem redefine é o
  administrador, pelo botão na lista de usuários. A tabela `usuario_tokens` já
  está pronta para o autoatendimento quando houver e-mail configurado.
