<?php
/**
 * API pública do IPA 360° por convite — Fase 4.
 *
 * O avaliador externo recebe um LINK DE USO ÚNICO gerado no painel
 * (webapp/360.html?convite=TOKEN). O token identifica o convite — quem
 * está sendo avaliado, em que empresa e em que relação — então o
 * avaliador não digita nome de ninguém, e cada convite aceita uma
 * única resposta. O banco guarda apenas o hash do token.
 *
 * Anonimato: a resposta não carrega a identidade do avaliador; o painel
 * só exibe médias por relação quando o mínimo de respondentes do ciclo
 * é atingido.
 *
 * Endpoints:
 *   GET  ?token=...  → dados do convite (avaliado, empresa, relação)
 *   POST {token, respostas, schema, website}
 *                    → registra a avaliação e consome o convite
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Audit.php';
require_once __DIR__ . '/../src/Ipa.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

function responder(bool $ok, string $code, array $extra = []): never
{
    echo json_encode(['ok' => $ok, 'code' => $code] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Localiza o convite pelo token e classifica o estado.
 * @return array{convite: ?array, erro: ?string}
 */
function acharConvite(string $token): array
{
    if (!preg_match('/^[a-f0-9]{40}$/', $token)) {
        return ['convite' => null, 'erro' => 'convite_invalido'];
    }
    $c = Db::um(
        "SELECT c.*, ci.status AS ciclo_status, ci.participante_id, ci.empresa_id,
                p.nome AS avaliado, e.nome AS empresa_nome
           FROM convites_360 c
           JOIN ciclos_360    ci ON ci.id = c.ciclo_id
           JOIN participantes p  ON p.id  = ci.participante_id
           JOIN empresas      e  ON e.id  = ci.empresa_id
          WHERE c.token_hash = ?",
        [hash('sha256', $token)]
    );
    if (!$c) {
        return ['convite' => null, 'erro' => 'convite_invalido'];
    }
    if ($c['status'] === 'respondido') {
        return ['convite' => $c, 'erro' => 'ja_respondido'];
    }
    if ($c['status'] === 'cancelado') {
        return ['convite' => null, 'erro' => 'convite_invalido'];
    }
    if ($c['ciclo_status'] !== 'aberto') {
        return ['convite' => null, 'erro' => 'ciclo_encerrado'];
    }
    if (strtotime((string)$c['expira_em']) < time()) {
        return ['convite' => null, 'erro' => 'convite_expirado'];
    }
    return ['convite' => $c, 'erro' => null];
}

try {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    /* ------------------------------------ GET: dados p/ montar a tela */
    if ($metodo === 'GET') {
        $r = acharConvite(trim((string)($_GET['token'] ?? '')));
        if ($r['erro'] !== null) {
            responder(false, $r['erro']);
        }
        $c = $r['convite'];
        responder(true, 'convite', [
            'avaliado' => $c['avaliado'],
            'empresa'  => $c['empresa_nome'],
            'relacao'  => $c['relacao'],
            'relacao_rotulo' => Ipa::rotuloRelacao((string)$c['relacao']),
        ]);
    }

    if ($metodo !== 'POST') {
        responder(false, 'method_not_allowed');
    }

    /* ------------------------------------------- POST: registrar 360 */
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        responder(false, 'json_invalido');
    }
    if (!empty($data['website'])) {          // honeypot
        responder(false, 'rejected');
    }
    if ((int)($data['schema'] ?? 0) !== 2) {
        responder(false, 'bad_schema');
    }

    $token = trim((string)($data['token'] ?? ''));
    $r = acharConvite($token);
    if ($r['erro'] === 'ja_respondido') {
        // reenvio (fila/duplo clique) de um convite já consumido: sucesso
        responder(true, 'saved_360', ['dup' => true]);
    }
    if ($r['erro'] !== null) {
        responder(false, $r['erro']);
    }
    $convite = $r['convite'];

    $ipHash = Ipa::ipHash();
    if (Ipa::estourouLimite($ipHash)) {
        responder(false, 'rate_limited');
    }

    $calc = Ipa::avaliar($data['respostas'] ?? null);
    if (isset($calc['erro'])) {
        responder(false, $calc['erro']);
    }
    $scores = $calc['scores'];

    $pdo = Db::conn();
    $pdo->beginTransaction();
    try {
        // tranca o convite: dois envios simultâneos não geram duas respostas
        $trancado = Db::um('SELECT status, avaliacao_id FROM convites_360 WHERE id = ? FOR UPDATE', [(int)$convite['id']]);
        if ($trancado === null || $trancado['avaliacao_id'] !== null || $trancado['status'] === 'respondido') {
            $pdo->rollBack();
            responder(true, 'saved_360', ['dup' => true]);
        }

        $uuid = bin2hex(random_bytes(16));   // gerado no servidor: 32 hex
        $avalId = Db::inserir(
            "INSERT INTO avaliacoes
                    (uuid, empresa_id, participante_id, instrumento_id, tipo, ciclo_id, relacao, status,
                     score_a, score_c, score_p, score_e, total,
                     estilo_predominante, regra_flexibilidade, dif_1, dif_2, dif_3,
                     concluida_em, ip_hash, user_agent)
             VALUES (?, ?, ?, ?, '360', ?, ?, 'concluida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)",
            [
                $uuid, (int)$convite['empresa_id'], (int)$convite['participante_id'],
                (int)$calc['instrumento']['id'], (int)$convite['ciclo_id'], $convite['relacao'],
                $scores['A'], $scores['C'], $scores['P'], $scores['E'], $calc['total'],
                $calc['pred'], $calc['regra'], $calc['difs'][0], $calc['difs'][1], $calc['difs'][2],
                $ipHash, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]
        );
        Ipa::gravarRespostas($avalId, $calc['linhas']);

        Db::q(
            "UPDATE convites_360 SET status = 'respondido', respondido_em = NOW(), avaliacao_id = ? WHERE id = ?",
            [$avalId, (int)$convite['id']]
        );
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }

    Audit::registrar(null, (int)$convite['empresa_id'], 'avaliacao_360_recebida', 'avaliacoes', $avalId,
        ['ciclo' => (int)$convite['ciclo_id'], 'relacao' => $convite['relacao']]);

    responder(true, 'saved_360');
} catch (Throwable $e) {
    error_log('[vipedia api 360] ' . $e->getMessage());
    responder(false, 'error');
}
