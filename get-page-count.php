<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
header('Content-Type: application/json');

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);
$url   = $input['url'] ?? '';

if (!$url) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => 'url is required.']);
    exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; PDF-PageCount/1.0)',
    CURLOPT_SSL_VERIFYPEER => false,
]);
$content  = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Download failed: ' . $curlErr]);
    exit;
}
if ($httpCode >= 400 || !$content) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => "Could not download PDF (HTTP $httpCode). Check the URL is publicly accessible."]);
    exit;
}

// Method 1: /Count N in the PDF Pages dictionary (most reliable)
$pageCount = 0;
if (preg_match('/\/Count\s+(\d+)/', $content, $m)) {
    $pageCount = (int)$m[1];
}

// Method 2: count /Type /Page entries as fallback
if ($pageCount === 0) {
    $pageCount = preg_match_all('/\/Type\s*\/Page[^s]/', $content, $m);
}

if ($pageCount === 0) {
    ob_end_clean();
    http_response_code(422);
    echo json_encode(['error' => 'Could not determine page count. Make sure the file is a valid PDF.']);
    exit;
}

ob_end_clean();
echo json_encode(['page_count' => $pageCount]);
