-- ============================================================
-- HOMOLOGAÇÃO — Migração "Configuração de entrega do relatório"
-- Rodar UMA vez no phpMyAdmin, no banco da HOMOLOGAÇÃO.
-- Puramente aditiva.
-- ============================================================
CREATE TABLE IF NOT EXISTS ipa_hml_config (
    chave  VARCHAR(60)  NOT NULL PRIMARY KEY,
    valor  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- marca o envio automático do relatório por e-mail (dispara uma única vez)
ALTER TABLE ipa_respostas ADD COLUMN rel_email_em DATETIME NULL;
