<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
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

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (empty($input['line_items']) || empty($input['shipping_address'])) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'line_items and shipping_address are required.']);
    exit;
}

// Build clean payload for /shipping-options/
// - line_items need: pod_package_id, quantity, page_count (all required by Lulu)
// - shipping_address needs 'country' key (not 'country_code')
$shippingAddr = $input['shipping_address'];
// Normalise: accept either 'country_code' or 'country'
if (!isset($shippingAddr['country']) && isset($shippingAddr['country_code'])) {
    $shippingAddr['country'] = $shippingAddr['country_code'];
}
unset($shippingAddr['country_code']); // Lulu only accepts 'country' here

$cleanPayload = [
    'currency'         => $input['currency'] ?? 'USD',
    'line_items'       => array_map(function($item) {
        $li = [
            'pod_package_id' => $item['pod_package_id'],
            'quantity'       => (int)($item['quantity'] ?? 1),
        ];
        // page_count is required by Lulu /shipping-options/ endpoint
        if (!empty($item['page_count'])) {
            $li['page_count'] = (int)$item['page_count'];
        }
        return $li;
    }, $input['line_items']),
    'shipping_address' => $shippingAddr,
];

$ch = curl_init(LULU_BASE_URL . '/shipping-options/');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $tokenRes['access_token'],
        'Content-Type: application/json',
        'Cache-Control: no-cache',
    ],
    CURLOPT_POSTFIELDS => json_encode($cleanPayload),
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

ob_end_clean();
if ($curlErr) { http_response_code(500); echo json_encode(['error' => $curlErr]); exit; }
http_response_code($httpCode);
echo $response;
