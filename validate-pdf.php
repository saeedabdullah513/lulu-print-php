<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
header('Content-Type: application/json');
require_once __DIR__ . '/config.php';

function getLuluToken() {
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
    $res = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $res['access_token'] ?? null;
}

// ── Normalize Dropbox URL → www.dropbox.com with dl=1 ────────────────────
// IMPORTANT: Do NOT convert to CDN URLs — they expire before Lulu fetches them
// Just ensure dl=1 is set on the www.dropbox.com URL
function normalizeDropboxUrl(string $url): string {
    if (strpos($url, 'dropbox.com') === false &&
        strpos($url, 'dropboxusercontent.com') === false) {
        return $url; // not Dropbox
    }

    // If it's already a CDN URL, convert back to www.dropbox.com
    // (CDN URLs expire — Lulu gets 404 when it tries to fetch later)
    $url = str_replace('https://dl.dropboxusercontent.com/', 'https://www.dropbox.com/', $url);

    // Remove any existing dl= or raw= param
    $url = preg_replace('/([?&])(dl|raw)=\d/', '$1', $url);
    $url = preg_replace('/[?&]+$/', '', $url);

    // Force dl=1 — makes Dropbox serve the file directly
    $url .= (strpos($url, '?') !== false ? '&' : '?') . 'dl=1';

    return $url;
}

$token = getLuluToken();
if (!$token) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Auth failed.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// ── POST: Start interior validation ──────────────────────────────────────
if ($method === 'POST') {
    $raw   = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if (empty($input['source_url'])) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode(['error' => 'source_url is required.']);
        exit;
    }

    $sourceUrl = normalizeDropboxUrl(trim($input['source_url']));

    $payload = ['source_url' => $sourceUrl];
    if (!empty($input['pod_package_id'])) {
        $payload['pod_package_id'] = $input['pod_package_id'];
    }

    $ch = curl_init(LULU_BASE_URL . '/validate-interior/');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
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

// ── GET: Poll validation status ──────────────────────────────────────────
} elseif ($method === 'GET') {
    $id = $_GET['id'] ?? '';
    if (!$id) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode(['error' => 'id is required.']);
        exit;
    }

    $ch = curl_init(LULU_BASE_URL . '/validate-interior/' . urlencode($id) . '/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Cache-Control: no-cache',
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

} else {
    ob_end_clean();
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
}
