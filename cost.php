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

// ── Build clean payload for /print-jobs/cost-calculations/ ───────────────
// Required: line_items[].pod_package_id, line_items[].page_count,
//           line_items[].quantity, shipping_address, shipping_option
// shipping_address needs 'country' key (NOT 'country_code')

$shippingAddr = $input['shipping_address'] ?? [];
// Normalise country_code → country (Lulu cost API uses 'country')
if (!isset($shippingAddr['country']) && isset($shippingAddr['country_code'])) {
    $shippingAddr['country'] = $shippingAddr['country_code'];
}
unset($shippingAddr['country_code']);

// Accept shipping_option OR shipping_level from JS
$shippingOption = $input['shipping_option'] ?? $input['shipping_level'] ?? null;

if (!$shippingOption) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'shipping_option is required.']);
    exit;
}

$cleanLineItems = array_map(function($item) {
    // Support both flat pod_package_id and nested printable_normalization structure
    $podPackageId = $item['pod_package_id']
        ?? $item['printable_normalization']['pod_package_id']
        ?? '';
    $li = [
        'pod_package_id' => $podPackageId,
        'quantity'       => (int)($item['quantity'] ?? 1),
    ];
    // page_count is required for cost-calculations
    if (!empty($item['page_count'])) {
        $li['page_count'] = (int)$item['page_count'];
    }
    return $li;
}, $input['line_items'] ?? []);

$payload = [
    'line_items'       => $cleanLineItems,
    'shipping_address' => $shippingAddr,
    'shipping_option'  => $shippingOption,
];

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
    CURLOPT_POSTFIELDS => json_encode($payload),
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
