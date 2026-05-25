<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

function getLuluToken(): string {
    $ch = curl_init(LULU_AUTH_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type'    => 'client_credentials',
            'client_id'     => LULU_CLIENT_ID,
            'client_secret' => LULU_CLIENT_SECRET,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) throw new RuntimeException('Token cURL error: ' . $curlErr);
    $data = json_decode($response, true);
    if (empty($data['access_token'])) {
        throw new RuntimeException('No access_token: ' . $response);
    }
    return $data['access_token'];
}

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or empty JSON body.']);
    exit;
}

// ── Clean payload for /print-jobs/ ────────────────────────────────────────

// 1. Remove page_count from line_items (only for cost calc, not job creation)
if (isset($input['line_items']) && is_array($input['line_items'])) {
    foreach ($input['line_items'] as &$item) {
        unset($item['page_count']);
    }
    unset($item);
}

// 2. Lulu /print-jobs/ requires 'shipping_level' (NOT 'shipping_option')
//    JS may send either — normalize to shipping_level
if (isset($input['shipping_option']) && !isset($input['shipping_level'])) {
    $input['shipping_level'] = $input['shipping_option'];
}
unset($input['shipping_option']); // remove so only shipping_level reaches Lulu

try {
    $token = getLuluToken();
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Lulu auth failed: ' . $e->getMessage()]);
    exit;
}

$ch = curl_init(LULU_BASE_URL . '/print-jobs/');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Cache-Control: no-cache',
    ],
    CURLOPT_POSTFIELDS => json_encode($input),
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

ob_end_clean();

if ($curlErr) {
    http_response_code(500);
    echo json_encode(['error' => 'Lulu API cURL error: ' . $curlErr]);
    exit;
}

http_response_code($httpCode);
echo $response;
