-- ============================================================
-- IPA — Migração "Contas de administrador" para BANCO EXISTENTE
-- Rodar UMA vez no phpMyAdmin. Puramente ADITIVA: cria só a tabela
-- nova; nenhum dado existente é lido ou alterado.
-- Instalação do zero: use o schema.sql completo (já a inclui).
-- ============================================================
CREATE TABLE IF NOT EXISTS ipa_admins (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nome       VARCHAR(120) NOT NULL,
    email      VARCHAR(190) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo      TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
