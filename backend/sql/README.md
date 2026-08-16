# Banco de dados — `itthri79_vipedia`

Scripts da **Fase 1** do plano de migração. Aplicar na ordem.

| Arquivo | O que faz |
|---|---|
| `01-schema.sql` | Cria as 14 tabelas, chaves estrangeiras e restrições |
| `02-dados-iniciais.sql` | Carrega o instrumento IPA/ACP v2 e as 36 palavras |

Ambos são **reaplicáveis**: rodar de novo não duplica nada nem gera erro.

## Como aplicar (cPanel / phpMyAdmin)

1. phpMyAdmin → selecionar o banco `itthri79_vipedia` na coluna da esquerda
2. aba **Importar** → **Escolher arquivo** → `01-schema.sql` → **Executar**
3. repetir com `02-dados-iniciais.sql`

Pela linha de comando, se houver acesso SSH:

```bash
mysql -u itthri79_vipedia_user -p itthri79_vipedia < 01-schema.sql
mysql -u itthri79_vipedia_user -p itthri79_vipedia < 02-dados-iniciais.sql
```

## Conferência depois de aplicar

```sql
SELECT COUNT(*) FROM information_schema.tables
 WHERE table_schema = 'itthri79_vipedia';        -- deve devolver 14

SELECT COUNT(*) FROM palavras;                    -- deve devolver 36
SELECT estilo, COUNT(*) FROM palavras GROUP BY estilo;  -- 9 para cada A, C, P, E
```

## Permissões necessárias

O usuário `itthri79_vipedia_user` precisa de `SELECT, INSERT, UPDATE, DELETE`
no banco. Para aplicar os scripts também precisa de `CREATE, ALTER, INDEX,
REFERENCES` — no cPanel isso equivale a marcar **ALL PRIVILEGES** em
*Bancos de Dados MySQL › Adicionar usuário ao banco*.

## O que ainda não existe

Estes scripts criam a estrutura, mas **nenhum usuário de acesso**. A conta do
administrador geral é criada na etapa seguinte, junto com a tela de login, porque
a senha precisa ser gravada já com `password_hash()` — nunca em texto no SQL.

## Verificação feita antes da entrega

Os scripts foram aplicados em um MariaDB 10.11 (mesma família da HostGator) e
testados:

- as duas etapas rodam em banco vazio sem erro, e são reaplicáveis
- 14 tabelas criadas, 36 palavras carregadas, 9 por estilo
- acentuação preservada (`EXPLÍCITO`, `ENFÁTICO`) em `utf8mb4_unicode_ci`
- as restrições recusam, como previsto: administrador de empresa sem empresa,
  administrador geral preso a uma empresa, e-mail repetido, peso fora de 0–11,
  peso repetido dentro do mesmo quadro, avaliação 360° sem ciclo ou sem relação,
  relatório sem vínculo ou com vínculo duplo, participante de empresa inexistente
- as restrições aceitam o que devem: mesmo peso em quadros diferentes,
  administrador geral sem empresa
- excluir uma empresa remove em cascata seus usuários, participantes,
  avaliações e respostas, sem tocar no administrador geral
