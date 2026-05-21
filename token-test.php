<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

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
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cURL error: ' . $curlErr]);
    exit;
}

$data = json_decode($response, true);

if (!empty($data['access_token'])) {
    echo json_encode([
        'success'      => true,
        'http_code'    => $httpCode,
        'token_type'   => $data['token_type']   ?? null,
        'expires_in'   => $data['expires_in']   ?? null,
        'access_token' => substr($data['access_token'], 0, 40) . '…  (truncated)',
    ], JSON_PRETTY_PRINT);
} else {
    http_response_code($httpCode ?: 400);
    echo json_encode([
        'success'   => false,
        'http_code' => $httpCode,
        'response'  => $data ?? $response,
    ], JSON_PRETTY_PRINT);
}
