# Sistema VIPEDia — a pasta que vai para o servidor

Esta pasta é o **sistema completo no layout de publicação**: envie o conteúdo
dela para o servidor e nada falta. Roda em hospedagem compartilhada
(HostGator, PHP 8.1+ e MySQL), sem dependências externas.

## Instalação

**1. Banco.** Aplicar antes `backend/sql/01-schema.sql` e `02-dados-iniciais.sql`
(instruções em `backend/sql/README.md`).

**2. Arquivos.** Enviar o **CONTEÚDO desta pasta** para
`public_html/vipedia/new_ipa/`:

```
vipedia/new_ipa/
├── index.php    redireciona a raiz para home/
├── status.php   diagnóstico geral → /vipedia/new_ipa/status.php
├── home/        página inicial (vitrine)
├── webapp/      questionário IPA (index.html) e 360° (360.html)
├── admin/       painel            → /vipedia/new_ipa/admin/login.php
├── api/         endpoints públicos: diagnóstico e convite 360°
├── painel/      painel antigo por chave (legado — sai na Fase 5)
├── setup/       instalação (apagar depois de usar)
├── src/         código de apoio   (bloqueado pela web)
└── config/      senha do banco    (bloqueado pela web)
```

Os endereços das APIs do questionário são **calculados automaticamente** a
partir da pasta publicada (`webapp/` chama a `api/` vizinha) — nenhum arquivo
precisa ser editado ao trocar de pasta ou domínio.

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

## Como as avaliações chegam ao banco (Fase 3)

O questionário envia para **dois destinos** durante a transição: a API
(`api/diagnostico.php` → banco) e o Apps Script (→ planilha, como sempre).
O indicador na tela do respondente segue a planilha; a gravação no banco é
silenciosa e tem fila própria de reenvio no navegador.

**Vínculo com a empresa.** Compartilhe o questionário pelo link com
identificador — ele aparece pronto na tela **Empresas** do painel:

```
https://itthrive.com.br/vipedia/new_ipa/webapp/?empresa=clinica-alfa
```

Com o link, o campo "organização" vem preenchido e travado, e a resposta entra
vinculada à empresa certa. Sem o parâmetro, a API ainda tenta casar o texto
digitado com o nome ou o identificador de uma empresa cadastrada; se não
encontrar, recusa (`empresa_nao_identificada`) — e a planilha, que continua
recebendo em paralelo, segura o registro.

**Confiança no resultado.** A API não aceita os scores enviados pelo
navegador: recalcula tudo no servidor a partir da tabela `palavras` (validação
de permutação 0–11 por quadro incluída) e grava o que ela mesma calculou. Se o
valor do cliente divergir, fica uma marca na auditoria. Reenvios da fila local
não duplicam nada — o `uuid` da avaliação é idempotente.

**Verificação feita** (servidor PHP + MariaDB reais): 22 testes da API e do
painel passando, e — o principal — os scores, o estilo predominante, a regra de
flexibilidade e as diferenças calculados pelo PHP foram cruzados com o
`engine.js` de referência em três perfis distintos: **idênticos nos três**,
incluindo um caso Equilibrado Natural. Isolamento verificado: administrador da
empresa Beta não vê avaliações da Alfa e recebe 404 no relatório dela. O
relatório arquivado é exibido com CSP que bloqueia scripts (o HTML vem do
navegador do respondente e é tratado como não confiável).

## Como funciona o 360° por convite (Fase 4)

O fluxo inteiro dispensa e-mail configurado — os links são copiados e
distribuídos por quem abriu o ciclo (WhatsApp, e-mail pessoal, etc.):

1. **Abrir ciclo** (painel → 360°): escolhe o avaliado e o mínimo de respostas
   para exibir médias (padrão 3 — proteção do anonimato).
2. **Gerar convites** na tela do ciclo, por relação (gestor, colega, liderado,
   cliente interno, outra). Cada convite vira um link de uso único
   `webapp/360.html?convite=TOKEN`. Os links aparecem **uma única vez** — o
   banco guarda apenas o hash SHA-256 do token. Link perdido = cancelar o
   convite e gerar outro.
3. **O avaliador abre o link**: a página busca no servidor quem está sendo
   avaliado, a empresa e a relação — nada é digitado, nada pode ser trocado.
   Convite respondido, cancelado, expirado ou de ciclo fechado recebe uma
   mensagem explicativa e não deixa enviar.
4. **A resposta consome o convite** numa transação com `SELECT ... FOR UPDATE`:
   dois cliques simultâneos não geram duas avaliações. Os scores são
   recalculados no servidor pelo mesmo núcleo do diagnóstico (`src/Ipa.php`).
5. **Resultado consolidado** na tela do ciclo: autoavaliação × médias externas
   por relação; médias só aparecem quando a relação atinge o mínimo, e o
   painel nunca mostra qual avaliador respondeu o quê.

A página 360 continua enviando também para a planilha (registro paralelo da
transição), e o modo antigo por parâmetros (`?avaliado=&org=`) segue
funcionando como reserva enquanto a planilha existir.

**Verificação feita** (servidor PHP + MariaDB reais): ciclo aberto pelo painel,
6 convites gerados e respondidos via API, reenvio idempotente, convite
cancelado e ciclo fechado recusando GET/POST, limiar de anonimato conferido na
tela (1 gestor e 2 pares ocultos; 3 liderados e o geral exibidos com médias
idênticas ao cálculo manual), scores do 360° cruzados com o `engine.js` e
isolamento entre empresas (404 para admin de outra empresa).

## O que ainda não existe

- **Envio de e-mail.** Senhas iniciais e convites 360° são entregues na tela
  para distribuição manual. Com SMTP configurado, o envio automático entra.
- **Recuperação de senha pelo próprio usuário.** Hoje quem redefine é o
  administrador, pelo botão na lista de usuários. A tabela `usuario_tokens` já
  está pronta para o autoatendimento quando houver e-mail configurado.
