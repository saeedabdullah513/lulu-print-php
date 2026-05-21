<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();

header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON.']);
    exit;
}

// Auth
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
$tokenRes = json_decode(curl_exec($ch), true);
curl_close($ch);

if (empty($tokenRes['access_token'])) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Auth failed.']);
    exit;
}

// Cost calculation
$ch = curl_init(LULU_BASE_URL . '/print-job-cost-calculations/');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $tokenRes['access_token'],
        'Content-Type: application/json',
        'Cache-Control: no-cache',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'line_items'       => $input['line_items'],
        'shipping_address' => $input['shipping_address'],
        'shipping_option'  => $input['shipping_option'],
    ]),
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

ob_end_clean();

if ($curlErr) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL error: ' . $curlErr]);
    exit;
}

http_response_code($httpCode);
echo $response;
