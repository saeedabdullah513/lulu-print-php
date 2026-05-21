<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
header('Content-Type: application/json');

const MAX_BYTES   = 30 * 1024 * 1024;
const UPLOAD_DIR  = __DIR__ . '/uploads/';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_FILES['pdf'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file received.']);
    exit;
}

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

$file = $_FILES['pdf'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error code ' . $file['error'] . '.']);
    exit;
}

if ($file['size'] > MAX_BYTES) {
    http_response_code(413);
    echo json_encode(['error' => 'File is ' . round($file['size'] / 1048576, 1) . ' MB — maximum is 30 MB.']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
if ($finfo->file($file['tmp_name']) !== 'application/pdf') {
    http_response_code(415);
    echo json_encode(['error' => 'Only PDF files are accepted.']);
    exit;
}

$safe     = preg_replace('/[^a-z0-9_.-]/i', '_', pathinfo($file['name'], PATHINFO_FILENAME));
$filename = uniqid($safe . '_', true) . '.pdf';
$dest     = UPLOAD_DIR . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not save file on server.']);
    exit;
}

$base = rtrim(
    (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] .
    dirname($_SERVER['SCRIPT_NAME']),
    '/'
);
ob_end_clean();
echo json_encode(['url' => $base . '/uploads/' . $filename, 'name' => $file['name']]);
