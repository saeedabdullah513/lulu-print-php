<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>View Print Jobs — Lulu API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

<header class="site-header">
  <div class="header-inner">
    <a href="index.php" class="header-back" title="Back to menu">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
    </a>
    <div class="header-logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      </svg>
    </div>
    <div>
      <h1 class="header-title">View Print Jobs</h1>
      <p class="header-sub">Lulu Direct API — Sandbox Environment</p>
    </div>
    <div class="header-badge">
      <span class="badge-dot"></span>API Connected
    </div>
  </div>
</header>

<main class="page-wrap">

  <!-- ── Filters ──────────────────────────────────────────────────────── -->
  <div class="form-card">
    <div class="card-head" style="justify-content:space-between">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="section-num" style="background:linear-gradient(135deg,#0ea5e9,#0284c7)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </div>
        <div>
          <h2 class="card-title">Print Jobs</h2>
          <p class="card-sub" id="jobs_count_label">Loading…</p>
        </div>
      </div>
      <button type="button" id="refresh_btn" class="btn-add">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </div>

    <div class="card-body" style="gap:14px">
      <div class="fg-3">
        <div class="fw">
          <label class="fl" for="filter_search">Search</label>
          <input type="text" id="filter_search" class="fi" placeholder="Job ID, title, address…">
        </div>
        <div class="fw">
          <label class="fl" for="filter_status">Status</label>
          <select id="filter_status" class="fi fi-select">
            <option value="">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAYMENT_IN_PROGRESS">Payment In Progress</option>
            <option value="PRODUCTION_DELAYED">Production Delayed</option>
            <option value="PRODUCTION_READY">Production Ready</option>
            <option value="IN_PRODUCTION">In Production</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELED">Canceled</option>
            <option value="ERROR">Error</option>
          </select>
        </div>
        <div class="fw" style="justify-content:flex-end;flex-direction:row;align-items:flex-end;gap:10px">
          <button type="button" id="search_btn" class="btn-submit" style="height:42px;padding:0 20px;font-size:13px">
            Search
          </button>
          <button type="button" id="clear_btn" class="btn-edit" style="height:42px">Clear</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Jobs Table ────────────────────────────────────────────────────── -->
  <div class="form-card" style="overflow:visible">
    <div id="jobs_loader" class="jobs-loader">
      <div class="spinner"></div>
      <span>Loading print jobs…</span>
    </div>
    <div id="jobs_empty" class="jobs-empty hidden">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <p>No print jobs found</p>
    </div>
    <div id="jobs_table_wrap" class="hidden">
      <table class="jobs-table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Status</th>
            <th>Items</th>
            <th>Created</th>
            <th>Ship To</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="jobs_tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- ── Pagination ────────────────────────────────────────────────────── -->
  <div id="pagination" class="pagination hidden"></div>

  <!-- ── Job Detail Modal ──────────────────────────────────────────────── -->
  <div id="detail_overlay" class="detail-overlay hidden" onclick="closeDetail(event)">
    <div class="detail-panel">
      <div class="detail-header">
        <div>
          <h3 id="detail_title" class="detail-title">Job Details</h3>
          <p id="detail_sub" class="detail-sub"></p>
        </div>
        <button type="button" class="detail-close" onclick="closeDetail()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="detail_body" class="detail-body"></div>
    </div>
  </div>

</main>

<div id="toast_region" class="toast-region"></div>

<script src="view.js"></script>
</body>
</html>
