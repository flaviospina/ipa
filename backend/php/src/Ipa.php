<?php
/**
 * Núcleo do cálculo IPA no servidor.
 *
 * Fonte única da validação e do cálculo usados pelos dois endpoints
 * públicos (diagnóstico e 360°). Reproduz exatamente o engine.js do
 * webapp — a paridade foi verificada cruzando os resultados dos dois
 * lados com perfis de teste (ver backend/php/README.md).
 */
declare(strict_types=1);

require_once __DIR__ . '/Db.php';

final class Ipa
{
    /** Mesmo valor de ACP.CRITERIOS.LIMIAR no engine.js */
    public const LIMIAR = 15;

    /** Instrumento vigente (maior versão ativa). */
    public static function instrumento(): ?array
    {
        return Db::um('SELECT * FROM instrumentos WHERE ativo = 1 ORDER BY versao DESC LIMIT 1');
    }

    /**
     * Valida as respostas e recalcula tudo no servidor.
     *
     * @return array ou ['erro' => codigo] quando o envio é inválido; senão:
     *   scores    ['A'=>..,'C'=>..,'P'=>..,'E'=>..]
     *   linhas    [[palavra_id, quadro, peso], ...]  (36 itens, p/ gravação)
     *   total     198
     *   pred      estilo predominante ('A'|'C'|'P'|'E')
     *   regra     EQUILIBRADO_MODELO | EQUILIBRADO_NATURAL | FLEXIVEL | FORTE_APEGO
     *   difs      [d1, d2, d3]
     *   instrumento  linha da tabela instrumentos
     */
    public static function avaliar(mixed $respostas): array
    {
        $inst = self::instrumento();
        if (!$inst) {
            return ['erro' => 'instrumento_ausente'];
        }
        if (!is_array($respostas)) {
            return ['erro' => 'invalid_weights_q1'];
        }

        $palavras = Db::todos(
            'SELECT id, quadro, codigo, estilo FROM palavras WHERE instrumento_id = ? ORDER BY quadro, posicao',
            [(int)$inst['id']]
        );
        $porQuadro = [];
        foreach ($palavras as $p) {
            $porQuadro[(int)$p['quadro']][] = $p;
        }

        // validação estrita: permutação completa 0..peso_max em cada quadro
        $scores = ['A' => 0, 'C' => 0, 'P' => 0, 'E' => 0];
        $linhas = [];
        foreach ($porQuadro as $q => $lista) {
            $pesos = [];
            foreach ($lista as $p) {
                $v = $respostas[$p['codigo']] ?? null;
                if (!is_numeric($v) || (string)(int)$v !== (string)$v) {
                    return ['erro' => 'invalid_weights_q' . $q];
                }
                $v = (int)$v;
                if ($v < 0 || $v > (int)$inst['peso_max']) {
                    return ['erro' => 'invalid_weights_q' . $q];
                }
                $pesos[] = $v;
                $scores[$p['estilo']] += $v;
                $linhas[] = [(int)$p['id'], $q, $v];
            }
            if (count($pesos) !== (int)$inst['qtd_palavras_quadro']) {
                return ['erro' => 'invalid_weights_q' . $q];
            }
            if (count(array_unique($pesos)) !== count($pesos)) {
                return ['erro' => 'repeated_weights_q' . $q];
            }
            if (array_sum($pesos) !== 66) {
                return ['erro' => 'bad_sum_q' . $q];
            }
        }
        $total = array_sum($scores);
        if ($total !== (int)$inst['total_esperado']) {
            return ['erro' => 'bad_total'];
        }

        // ranking — desempate do engine.js: ordem alfabética do nome curto
        // (Atenção, Comunicação, Equilibrado, Procedimento) = ASCII de A,C,E,P
        $chaves = ['A', 'C', 'E', 'P'];
        usort($chaves, fn($x, $y) => ($scores[$y] <=> $scores[$x]) ?: strcmp($x, $y));
        $difs = [
            $scores[$chaves[0]] - $scores[$chaves[1]],
            $scores[$chaves[1]] - $scores[$chaves[2]],
            $scores[$chaves[2]] - $scores[$chaves[3]],
        ];
        if ($chaves[0] === 'E') {
            $regra = 'EQUILIBRADO_MODELO';
        } elseif (max($difs) < self::LIMIAR) {
            $regra = 'EQUILIBRADO_NATURAL';
        } elseif ($difs[0] >= self::LIMIAR) {
            $regra = 'FORTE_APEGO';
        } else {
            $regra = 'FLEXIVEL';
        }

        return [
            'scores' => $scores, 'linhas' => $linhas, 'total' => $total,
            'pred' => $chaves[0], 'regra' => $regra, 'difs' => $difs,
            'instrumento' => $inst,
        ];
    }

    /** Grava os 36 pesos de uma avaliação (chamar dentro de transação). */
    public static function gravarRespostas(int $avaliacaoId, array $linhas): void
    {
        $st = Db::conn()->prepare(
            'INSERT INTO avaliacao_respostas (avaliacao_id, palavra_id, quadro, peso) VALUES (?, ?, ?, ?)'
        );
        foreach ($linhas as $l) {
            $st->execute([$avaliacaoId, $l[0], $l[1], $l[2]]);
        }
    }

    /** Hash de IP com sal — minimização LGPD (nunca guardamos o IP cru na avaliação). */
    public static function ipHash(): string
    {
        $sal = (string)Db::opcao('app.sal_ip', 'vipedia');
        return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $sal);
    }

    /** Rate limit por origem: envios de avaliação no último minuto. */
    public static function estourouLimite(string $ipHash): bool
    {
        $limite = (int)Db::opcao('api.max_por_minuto', 10);
        $recentes = (int)Db::valor(
            'SELECT COUNT(*) FROM avaliacoes WHERE ip_hash = ? AND iniciada_em > DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
            [$ipHash]
        );
        return $recentes >= $limite;
    }

    /** Rótulos exibidos para o enum de relação do 360°. */
    public static function rotuloRelacao(string $r): string
    {
        return [
            'gestor'          => 'Gestor(a)',
            'par'             => 'Colega de equipe',
            'liderado'        => 'Liderado(a)',
            'cliente_interno' => 'Cliente interno',
            'outro'           => 'Outra relação',
        ][$r] ?? $r;
    }
}
