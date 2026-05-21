<?php
// Suppress HTML error output so XAMPP warnings never corrupt the JSON response
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

// ── Get OAuth2 Bearer Token ────────────────────────────────────────────────
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
        throw new RuntimeException('No access_token in response: ' . $response);
    }
    return $data['access_token'];
}

// ── Read & validate incoming JSON ─────────────────────────────────────────
$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or empty JSON body.']);
    exit;
}

// ── Strip fields not accepted by the print-jobs endpoint ─────────────────
// page_count is only used for cost calculation, not for job creation
if (isset($input['line_items']) && is_array($input['line_items'])) {
    foreach ($input['line_items'] as &$item) {
        unset($item['page_count']);
    }
    unset($item);
}

// ── Get token ─────────────────────────────────────────────────────────────
try {
    $token = getLuluToken();
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Lulu auth failed: ' . $e->getMessage()]);
    exit;
}

// ── Send Print-Job to Lulu ────────────────────────────────────────────────
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

ob_end_clean(); // discard any stray PHP output before sending the real response

if ($curlErr) {
    http_response_code(500);
    echo json_encode(['error' => 'Lulu API cURL error: ' . $curlErr]);
    exit;
}

http_response_code($httpCode);
echo $response;
