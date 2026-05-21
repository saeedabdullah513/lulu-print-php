<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Print Jobs — Lulu API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

<header class="site-header">
  <div class="header-inner">
    <div class="header-logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      </svg>
    </div>
    <div>
      <h1 class="header-title">Print Jobs</h1>
      <p class="header-sub">Lulu Direct API — Sandbox Environment</p>
    </div>
    <div class="header-badge">
      <span class="badge-dot"></span>API Connected
    </div>
  </div>
</header>

<main class="page-wrap">
  <div class="nav-hero">
    <h2 class="nav-hero-title">What would you like to do?</h2>
    <p class="nav-hero-sub">Select an option below to get started with Lulu Print API</p>
  </div>

  <div class="nav-cards">

    <a href="createPrintJobDropbox.php" class="nav-card">
      <div class="nav-card-icon nav-card-icon--blue">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div class="nav-card-body">
        <h3 class="nav-card-title">Create Print Jobs Via DropBox</h3>
        <p class="nav-card-sub">Submit print jobs using Dropbox or public PDF URLs for cover and interior files</p>
      </div>
      <div class="nav-card-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </a>

    <a href="createPrintJob.php" class="nav-card">
      <div class="nav-card-icon nav-card-icon--violet">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </div>
      <div class="nav-card-body">
        <h3 class="nav-card-title">Create Print Jobs</h3>
        <p class="nav-card-sub">Upload files directly and submit a new print job to the Lulu production network</p>
      </div>
      <div class="nav-card-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </a>

    <a href="viewPrintJob.php" class="nav-card">
      <div class="nav-card-icon nav-card-icon--green">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="nav-card-body">
        <h3 class="nav-card-title">View Print Jobs</h3>
        <p class="nav-card-sub">Browse all submitted print jobs, track statuses, and view shipping details</p>
      </div>
      <div class="nav-card-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </a>

  </div>
</main>

</body>
</html>
