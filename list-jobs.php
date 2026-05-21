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

try {
    $token = getLuluToken();
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Auth failed: ' . $e->getMessage()]);
    exit;
}

$page     = max(1, intval($_GET['page'] ?? 1));
$pageSize = min(100, max(1, intval($_GET['page_size'] ?? 20)));
$search   = trim($_GET['search'] ?? '');
$status   = trim($_GET['status'] ?? '');

$params = ['page' => $page, 'page_size' => $pageSize, 'ordering' => '-id'];
if ($search) $params['search'] = $search;
if ($status) $params['status'] = $status;

$ch = curl_init(LULU_BASE_URL . '/print-jobs/?' . http_build_query($params));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ],
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
