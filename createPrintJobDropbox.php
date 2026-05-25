<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Print Job — Lulu API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

<!-- ── Header ──────────────────────────────────────────────────────── -->
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
      <h1 class="header-title">Create Print Jobs</h1>
      <p class="header-sub">Lulu Direct API — Sandbox Environment</p>
    </div>
    <div class="header-badge">
      <span class="badge-dot"></span>API Connected
    </div>
  </div>
</header>

<!-- ── Main ────────────────────────────────────────────────────────── -->
<main class="page-wrap">
  <form id="print_job_form" novalidate>

    <!-- ── Shipping Address ──────────────────────────────────────── -->
    <div class="form-card">
      <div class="card-head">
        <div class="section-num">1</div>
        <div>
          <h2 class="card-title">Shipping Address</h2>
          <p class="card-sub">Recipient and delivery information</p>
        </div>
      </div>

      <div class="card-body">

        <div class="fg-3">
          <div class="fw">
            <label class="fl" for="contact_email">Contact Email <em class="req">*</em></label>
            <input type="email" id="contact_email" name="contact_email"
                   class="fi" placeholder="you@example.com" required aria-invalid="false">
            <span class="fe"></span>
          </div>
          <div class="fw">
            <label class="fl" for="ship_name">Name <em class="req">*</em></label>
            <input type="text" id="ship_name" name="ship_name"
                   class="fi" placeholder="Jane Doe" required aria-invalid="false">
            <span class="fe"></span>
          </div>
          <div class="fw">
            <label class="fl" for="ship_phone">Phone Number <em class="req">*</em></label>
            <input type="tel" id="ship_phone" name="ship_phone"
                   class="fi" placeholder="+1 555 000 0000" required aria-invalid="false">
            <span class="fe"></span>
          </div>
        </div>

        <div class="fg-3">
          <div class="fw">
            <label class="fl" for="ship_street1">Street Address <em class="req">*</em></label>
            <input type="text" id="ship_street1" name="ship_street1"
                   class="fi" placeholder="123 Main Street" required aria-invalid="false" maxlength="30">
            <span class="fe"></span>
          </div>
          <div class="fw">
            <label class="fl" for="ship_street2">Street Address 2</label>
            <input type="text" id="ship_street2" name="ship_street2"
                   class="fi" placeholder="Apt, Suite, Floor…" maxlength="30">
          </div>
          <div class="fw">
            <label class="fl" for="ship_city">City <em class="req">*</em></label>
            <input type="text" id="ship_city" name="ship_city"
                   class="fi" placeholder="New York" required aria-invalid="false">
            <span class="fe"></span>
          </div>
        </div>

        <div class="fg-3">
          <div class="fw">
            <label class="fl" for="ship_state">State Code <em class="req">*</em></label>
            <input type="text" id="ship_state" name="ship_state"
                   class="fi" placeholder="NY" required aria-invalid="false">
            <span class="fe"></span>
          </div>
          <div class="fw">
            <label class="fl" for="ship_postcode">Postcode <em class="req">*</em></label>
            <input type="text" id="ship_postcode" name="ship_postcode"
                   class="fi" placeholder="10001" required aria-invalid="false">
            <span class="fe"></span>
          </div>
          <div class="fw">
            <label class="fl" for="ship_country">Country Code <em class="req">*</em></label>
            <input type="text" id="ship_country" name="ship_country"
                   class="fi" placeholder="US" maxlength="2" required aria-invalid="false"
                   style="text-transform:uppercase">
            <span class="fe"></span>
          </div>
        </div>

        <div class="fg-3" style="margin-top:4px">
          <div class="fw">
            <label class="fl" for="shipping_level">Shipping Method <em class="req">*</em></label>
            <select id="shipping_level" name="shipping_level" class="fi fi-select" required aria-invalid="false">
              <option value="">Select Shipping Method</option>
              <option value="MAIL">Mail</option>
              <option value="PRIORITY_MAIL">Priority Mail</option>
              <option value="GROUND_HD">Ground Home Delivery</option>
              <option value="GROUND_BUS">Ground Business</option>
              <option value="GROUND">Ground</option>
              <option value="EXPEDITED">Expedited</option>
              <option value="EXPRESS">Express</option>
            </select>
            <span class="fe"></span>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Item Details ──────────────────────────────────────────── -->
    <div class="form-card">
      <div class="card-head" style="justify-content:space-between">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="section-num">2</div>
          <div>
            <h2 class="card-title">Item Details</h2>
            <p class="card-sub">Book specifications and PDF source files</p>
          </div>
        </div>
        <button type="button" id="add_item_btn" class="btn-add">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add More Item
        </button>
      </div>
      <div id="line_items_container"></div>
    </div>

    <!-- ── Submit ────────────────────────────────────────────────── -->
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <button type="submit" id="submit_btn" class="btn-submit">
        Submit Print Job
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
      <p class="req-note"><em class="req">*</em> Required fields</p>
    </div>

  </form>

  <div id="result_box" class="result-box hidden"></div>
</main>

<!-- ── Line Item Template ──────────────────────────────────────────── -->
<template id="line_item_tpl">
  <div class="item-block">

    <div class="item-head">
      <span class="item-title">
        <span class="item-dot"></span>
        Item #<span class="item-num">1</span>
      </span>
      <button type="button" class="btn-remove">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Remove Item
      </button>
    </div>

    <div class="card-body">

      <p class="spec-label">Print Specifications</p>

      <div class="fg-3">
        <div class="fw">
          <label class="fl">Trim Size <em class="req">*</em></label>
          <select name="trim_size" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="0425X0687">Pocketbook 4.25″ × 6.875″</option>
            <option value="0500X0800">Novella 5″ × 8″</option>
            <option value="0550X0850">Digest 5.5″ × 8.5″</option>
            <option value="0583X0827">A5 5.83″ × 8.27″</option>
            <option value="0600X0900">US Trade 6″ × 9″</option>
            <option value="0614X0921">Royal 6.14″ × 9.21″</option>
            <option value="0663X1025">Comic 6.63″ × 10.25″</option>
            <option value="0700X1000">Executive 7″ × 10″</option>
            <option value="0750X0750">Small Square 7.5″ × 7.5″</option>
            <option value="0744X0968">Crown Quarto 7.44″ × 9.68″</option>
            <option value="0827X1169">A4 8.27″ × 11.69″</option>
            <option value="0850X0850">Square 8.5″ × 8.5″</option>
            <option value="0850X1100">US Letter 8.5″ × 11″</option>
            <option value="0900X0700">Landscape 9″ × 7″</option>
            <option value="1100X0850">US Letter Landscape 11″ × 8.5″</option>
            <option value="1169X0827">A4 Landscape 11.69″ × 8.27″</option>
          </select>
          <span class="fe"></span>
        </div>
        <div class="fw">
          <label class="fl">Color Type <em class="req">*</em></label>
          <select name="color_type" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="BW">Mono</option>
            <option value="FC">Color</option>
          </select>
          <span class="fe"></span>
        </div>
        <div class="fw">
          <label class="fl">Print Type <em class="req">*</em></label>
          <select name="print_type" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="STD">Standard</option>
            <option value="PRE">Premium</option>
          </select>
          <span class="fe"></span>
        </div>
      </div>

      <div class="fg-3">
        <div class="fw">
          <label class="fl">Bind Type <em class="req">*</em></label>
          <select name="bind_type" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="PB">Perfect Bound</option>
            <option value="CO">Coil</option>
            <option value="SS">Saddle Stitch</option>
            <option value="CW">Case Wrap</option>
            <option value="LW">Linen Wrap</option>
            <option value="WO">Wire-O</option>
          </select>
          <span class="fe"></span>
        </div>
        <div class="fw">
          <label class="fl">Paper Type <em class="req">*</em></label>
          <select name="paper_type" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="060UW">60# Uncoated White</option>
            <option value="060UC">60# Uncoated Cream</option>
            <option value="070CW">70# Coated White</option>
            <option value="080CW">80# Coated White</option>
            <option value="100CW">100# Coated White</option>
          </select>
          <span class="fe"></span>
        </div>
        <div class="fw">
          <label class="fl">Finish Type <em class="req">*</em></label>
          <select name="finish_type" class="fi fi-select" required aria-invalid="false">
            <option value="">Select Any</option>
            <option value="G">Gloss</option>
            <option value="M">Matte</option>
            <option value="U">Unlaminated</option>
          </select>
          <span class="fe"></span>
        </div>
      </div>

      <div class="fg-3">
        <div class="fw">
          <label class="fl">Linen Type</label>
          <select name="linen_type" class="fi fi-select">
            <option value="X">N/A</option>
            <option value="N">Navy</option>
            <option value="G">Gray</option>
            <option value="R">Red</option>
            <option value="B">Black</option>
            <option value="T">Tan</option>
            <option value="F">Forest</option>
            <option value="P">Interior Cover Print</option>
          </select>
        </div>
        <div class="fw">
          <label class="fl">Foil Type</label>
          <select name="foil_type" class="fi fi-select">
            <option value="X">N/A</option>
            <option value="G">Gold</option>
            <option value="B">Black</option>
            <option value="W">White</option>
          </select>
        </div>
        <div class="fw">
          <label class="fl">Quantity <em class="req">*</em></label>
          <input type="number" name="quantity" value="1" min="1" max="10000"
                 class="fi" required aria-invalid="false">
          <span class="fe"></span>
        </div>
      </div>

      <!-- Live pod_package_id preview -->
      <div class="pkg-preview" style="display:none;margin:8px 0 4px;padding:6px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;color:#0369a1">
        <span style="font-weight:600">Package ID:</span>
        <span class="pkg-preview-val" style="font-family:monospace;margin-left:4px"></span>
      </div>

      <p class="spec-label" style="margin-top:4px">Book Info &amp; PDF Files</p>

      <div class="fg-3">
        <div class="fw">
          <label class="fl">Title <em class="req">*</em></label>
          <input type="text" name="title" class="fi" placeholder="My Book Title"
                 required aria-invalid="false">
          <span class="fe"></span>
        </div>
        <div class="fw">
          <div class="label-row">
            <label class="fl">Cover (PDF) <em class="req">*</em></label>
            <button type="button" class="btn-demo" data-target="cover_url">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Demo
            </button>
          </div>
          <input type="url" name="cover_url" class="fi" placeholder="DropBox / Drive link"
                 required aria-invalid="false">
          <span class="fe"></span>
        </div>
        <div class="fw">
          <div class="label-row">
            <label class="fl">Interior (PDF) <em class="req">*</em></label>
            <button type="button" class="btn-demo" data-target="interior_url">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Demo
            </button>
          </div>
          <input type="url" name="interior_url" class="fi" placeholder="DropBox / Drive link"
                 required aria-invalid="false">
          <span class="fe"></span>
        </div>
      </div>

    </div>
  </div>
</template>

<!-- Toast -->
<div id="toast_region" class="toast-region"></div>

<script src="app.js"></script>
</body>
</html>
