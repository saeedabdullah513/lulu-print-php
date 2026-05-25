'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────
const form        = document.getElementById('print_job_form');
const container   = document.getElementById('line_items_container');
const addItemBtn  = document.getElementById('add_item_btn');
const submitBtn   = document.getElementById('submit_btn');
const resultBox   = document.getElementById('result_box');
const toastRegion = document.getElementById('toast_region');
const SUBMIT_HTML = submitBtn.innerHTML;

let itemCount   = 0;
let pollTimer   = null;
let pollJobId   = null;
let pollAttempt = 0;
const POLL_MAX  = 24;   // 24 × 5s = ~2 minutes

// ── Demo PDF URLs (official Lulu test files from API spec) ─────────────────
const DEMO_URLS = {
  cover_url:    'https://www.dropbox.com/sh/p3zh22vzsaegiri/AADP367j0bTWlt8fCu-_tm2ia/161025/139056_cover.pdf?dl=1',
  interior_url: 'https://www.dropbox.com/sh/p3zh22vzsaegiri/AACOUn3LFKsITDzylh13bQpsa/161025/thesis2.pdf?dl=1',
};

// ── Validation rules ──────────────────────────────────────────────────────
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE   = /^[\+\d\s\-().]{6,20}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;
const URL_RE     = /^https?:\/\/.{4,}/;

const RULES = {
  contact_email:  { req: true, test: v => EMAIL_RE.test(v), msg: 'Enter a valid email address.' },
  ship_name:      { req: true, test: v => v.length >= 2,    msg: 'Name is required.' },
  ship_phone:     { req: true, test: v => PHONE_RE.test(v), msg: 'Enter a valid phone number.' },
  ship_street1:   { req: true, test: v => v.length >= 3,    msg: 'Street address is required.' },
  ship_city:      { req: true, test: v => v.length >= 2,    msg: 'City is required.' },
  ship_state:     { req: true, test: v => v.length >= 2,    msg: 'State code is required.' },
  ship_postcode:  { req: true, test: v => v.length >= 3,    msg: 'Postcode is required.' },
  ship_country:   { req: true, test: v => COUNTRY_RE.test(v), msg: '2-letter code e.g. US' },
  shipping_level: { req: true, test: v => !!v,              msg: 'Select a shipping method.' },
  trim_size:      { req: true, test: v => !!v,              msg: 'Select trim size.' },
  color_type:     { req: true, test: v => !!v,              msg: 'Select color type.' },
  print_type:     { req: true, test: v => !!v,              msg: 'Select print type.' },
  bind_type:      { req: true, test: v => !!v,              msg: 'Select bind type.' },
  paper_type:     { req: true, test: v => !!v,              msg: 'Select paper type.' },
  finish_type:    { req: true, test: v => !!v,              msg: 'Select finish type.' },
  quantity:       { req: true, test: v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 10000; }, msg: 'Quantity must be 1–10,000.' },
  title:          { req: true, test: v => v.length >= 1,    msg: 'Book title is required.' },
  cover_url:      { req: true, test: v => URL_RE.test(v),   msg: 'Enter a valid https:// URL.' },
  interior_url:   { req: true, test: v => URL_RE.test(v),   msg: 'Enter a valid https:// URL.' },
};

// ── Validation helpers ────────────────────────────────────────────────────
function getErrorEl(input) {
  return input.closest('.fw')?.querySelector('.fe') ?? null;
}
function setError(input, msg) {
  input.setAttribute('aria-invalid', 'true');
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  const err = getErrorEl(input);
  if (err) err.textContent = msg;
}
function clearError(input) {
  input.setAttribute('aria-invalid', 'false');
  input.classList.remove('is-invalid');
  const err = getErrorEl(input);
  if (err) err.textContent = '';
}
function markValid(input) {
  clearError(input);
  if (input.value.trim()) input.classList.add('is-valid');
}
function validateInput(input) {
  const name  = input.getAttribute('name');
  const value = input.value.trim();
  const rule  = RULES[name];
  if (!rule) return true;
  if (!value) {
    if (rule.req) { setError(input, rule.msg); return false; }
    clearError(input); return true;
  }
  if (!rule.test(value)) { setError(input, rule.msg); return false; }
  markValid(input);
  return true;
}
function wire(input) {
  let touched = false;
  input.addEventListener('blur',   () => { touched = true; validateInput(input); });
  input.addEventListener('input',  () => { if (touched) validateInput(input); });
  input.addEventListener('change', () => { touched = true; validateInput(input); });
}
form.querySelectorAll('input, select').forEach(wire);

document.getElementById('ship_country').addEventListener('input', function () {
  const pos = this.selectionStart;
  this.value = this.value.toUpperCase();
  this.setSelectionRange(pos, pos);
});

function validateAll() {
  let valid = true, firstInvalid = null;
  form.querySelectorAll('input, select').forEach(input => {
    if (!validateInput(input) && !firstInvalid) firstInvalid = input;
    if (input.classList.contains('is-invalid')) valid = false;
  });
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

// ── Normalize Dropbox/Drive URLs ─────────────────────────────────────────
function normalizePdfUrl(url) {
  if (!url) return url;

  if (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')) {
    // Convert CDN URLs back to www.dropbox.com — CDN URLs expire before Lulu fetches them
    url = url.replace('https://dl.dropboxusercontent.com/', 'https://www.dropbox.com/');

    // Remove any existing dl= or raw= param
    url = url.replace(/([?&])(dl|raw)=\d/g, '$1').replace(/[?&]+$/, '');

    // Add dl=1 — makes Dropbox serve the PDF directly (confirmed working with Lulu)
    url += (url.includes('?') ? '&' : '?') + 'dl=1';
  }

  return url;
}

// ── pod_package_id builder ────────────────────────────────────────────────
// Lulu format (WITH dots): e.g. 0600X0900.BW.STD.PB.060UW444.GXX
// PPI (pages-per-inch) suffix varies by paper type — from Lulu spec sheet
const PAPER_PPI = {
  '060UW': '444',
  '060UC': '444',
  '070CW': '460',   // 70# Coated White bulk = 460 ppi
  '080CW': '444',
  '100CW': '200',   // 100# Coated White bulk = 200 ppi
};

function buildPodPackageId(item) {
  const g = n => item.querySelector(`[name="${n}"]`)?.value || '';
  const trim   = g('trim_size'),  color  = g('color_type'), print = g('print_type'),
        bind   = g('bind_type'),  paper  = g('paper_type'), finish = g('finish_type');
  const linen  = g('linen_type') || 'X';
  const foil   = g('foil_type')  || 'X';
  if (!trim || !color || !print || !bind || !paper || !finish) return null;
  const ppi = PAPER_PPI[paper] || '444';
  // Format: TRIM.COLOR.PRINT.BIND.PAPER{PPI}.FINISH+LINEN+FOIL
  return `${trim}.${color}.${print}.${bind}.${paper}${ppi}.${finish}${linen}${foil}`;
}

// ── Add / Remove items ────────────────────────────────────────────────────
function addItem() {
  itemCount++;
  const clone = document.getElementById('line_item_tpl').content.cloneNode(true);
  const el    = clone.querySelector('.item-block');
  el.querySelector('.item-num').textContent = itemCount;

  el.querySelectorAll('input, select').forEach(input => {
    const name = input.getAttribute('name');
    if (!name) return;
    const uid = `item${itemCount}_${name}`;
    input.id  = uid;
    const label = input.closest('.fw')?.querySelector('label');
    if (label && !label.getAttribute('for')) label.setAttribute('for', uid);
    wire(input);
  });

  el.querySelector('.btn-remove').addEventListener('click', () => {
    if (container.querySelectorAll('.item-block').length === 1) {
      showToast('At least one book item is required.', 'error');
      return;
    }
    el.remove();
    renumber();
  });

  el.querySelectorAll('.btn-demo').forEach(btn => {
    btn.addEventListener('click', () => {
      const demoUrl = DEMO_URLS[btn.dataset.target];
      if (demoUrl) window.open(demoUrl, '_blank', 'noopener,noreferrer');
      else showToast('No demo URL configured.', 'error');
    });
  });

  // ── Live pod_package_id preview + compatibility warnings ─────────────
  const pkgPreview    = el.querySelector('.pkg-preview');
  const pkgPreviewVal = el.querySelector('.pkg-preview-val');
  const specSelects   = ['trim_size','color_type','print_type','bind_type','paper_type','finish_type','linen_type','foil_type'];
  function updatePkgPreview() {
    const id = buildPodPackageId(el);
    const g  = n => el.querySelector(`[name="${n}"]`)?.value || '';

    // Compatibility warnings
    const warnings = [];
    const color  = g('color_type');
    const paper  = g('paper_type');
    const bind   = g('bind_type');
    const linen  = g('linen_type');
    const ptype  = g('print_type');

    // Case Wrap (CW) only supports 060UW, 060UC, 080CW — not 070CW or 100CW
    if (bind === 'CW' && paper && (paper === '070CW' || paper === '100CW')) {
      warnings.push('⚠ Case Wrap only supports 60# Uncoated or 80# Coated White paper — select 60UW, 60UC, or 80CW.');
    }
    // Linen Wrap requires a linen colour selection
    if (bind === 'LW' && linen === 'X') {
      warnings.push('⚠ Linen Wrap (LW) requires a Linen color — select Navy, Black, Tan, etc. instead of N/A.');
    }
    // Linen doesn't apply to non-LW bindings
    if (bind && bind !== 'LW' && linen !== 'X') {
      warnings.push('⚠ Linen color only applies to Linen Wrap (LW) — set Linen to N/A for other binding types.');
    }
    if (bind === 'WO' && linen !== 'X') {
      warnings.push('⚠ Wire-O binding does not use Linen — set Linen to N/A.');
    }

    // Remove old warnings
    el.querySelectorAll('.pkg-warning').forEach(w => w.remove());

    if (warnings.length) {
      const wDiv = document.createElement('div');
      wDiv.className = 'pkg-warning';
      wDiv.style.cssText = 'margin:6px 0;padding:8px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;font-size:12px;color:#854d0e;line-height:1.6';
      wDiv.innerHTML = warnings.map(w => `<div>${w}</div>`).join('');
      pkgPreview.insertAdjacentElement('afterend', wDiv);
    }

    if (id) {
      pkgPreviewVal.textContent = id;
      pkgPreview.style.display  = '';
    } else {
      pkgPreview.style.display = 'none';
    }
  }
  specSelects.forEach(name => {
    const sel = el.querySelector(`[name="${name}"]`);
    if (sel) sel.addEventListener('change', updatePkgPreview);
  });

  container.appendChild(el);
}

function renumber() {
  container.querySelectorAll('.item-block').forEach((el, i) => {
    el.querySelector('.item-num').textContent = i + 1;
  });
  itemCount = container.querySelectorAll('.item-block').length;
}

// ── Collect full payload ──────────────────────────────────────────────────
function collectData() {
  const f = name => form.querySelector(`[name="${name}"]`)?.value.trim() || '';

  const shipping_address = {
    name:         f('ship_name'),
    phone_number: f('ship_phone'),
    street1:      f('ship_street1'),
    city:         f('ship_city'),
    postcode:     f('ship_postcode'),
    country_code: f('ship_country').toUpperCase(),
    email:        f('contact_email'),
  };
  if (f('ship_street2')) shipping_address.street2    = f('ship_street2');
  if (f('ship_state'))   shipping_address.state_code = f('ship_state');

  const line_items = [];
  container.querySelectorAll('.item-block').forEach((item, idx) => {
    line_items.push({
      external_id: `item-${idx + 1}`,
      title:       item.querySelector('[name="title"]')?.value.trim() || '',
      quantity:    parseInt(item.querySelector('[name="quantity"]')?.value || '1', 10),
      printable_normalization: {
        pod_package_id: buildPodPackageId(item),
        cover:          { source_url: normalizePdfUrl(item.querySelector('[name="cover_url"]')?.value.trim()    || '') },
        interior:       { source_url: normalizePdfUrl(item.querySelector('[name="interior_url"]')?.value.trim() || '') },
      },
    });
  });

  return {
    contact_email:  f('contact_email'),
    shipping_address,
    shipping_level: f('shipping_level'),
    line_items,
  };
}

// ── HTML escape helper ────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Money formatter ───────────────────────────────────────────────────────
function fmt(v) { return '$' + parseFloat(v || 0).toFixed(2); }

// ── Render post-creation cost breakdown ───────────────────────────────────
function renderCosts(costs, status) {
  if (!costs) return '';
  const isRejected = status === 'REJECTED' || status === 'ERROR';

  // Item Subtotal rows
  const items = (costs.line_item_costs || []).map((li, i) =>
    `<div class="dg-row">
      <span class="dg-label">Item ${i + 1} × ${li.quantity}</span>
      <span class="dg-val">${fmt(li.total_cost_excl_tax)}</span>
    </div>`
  ).join('');

  // Fulfillment Fee — Lulu returns it as fulfillment_cost (separate field)
  const fees = costs.fulfillment_cost
    ? `<div class="dg-row"><span class="dg-label">Fulfillment Fee</span><span class="dg-val">${fmt(costs.fulfillment_cost.total_cost_excl_tax)}</span></div>`
    : (costs.fees || []).map(fee => {
        const label = fee.fee_type
          ? fee.fee_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : 'Fee';
        return `<div class="dg-row"><span class="dg-label">${label}</span><span class="dg-val">${fmt(fee.total_cost_excl_tax)}</span></div>`;
      }).join('');

  // Shipping & Handling
  const shipping = costs.shipping_cost
    ? `<div class="dg-row"><span class="dg-label">Shipping &amp; Handling</span><span class="dg-val">${fmt(costs.shipping_cost.total_cost_excl_tax)}</span></div>`
    : '';

  // Sales Tax
  const tax = parseFloat(costs.total_tax || 0) > 0
    ? `<div class="dg-row"><span class="dg-label">Sales Tax</span><span class="dg-val">${fmt(costs.total_tax)}</span></div>`
    : '';

  const note = isRejected
    ? `<p class="costs-note" style="color:#b91c1c">⚠ Job was ${status}. These are the estimated costs calculated before rejection.</p>`
    : `<p class="costs-note">This amount has been charged to your Lulu account balance.</p>`;

  return `<div class="costs-panel${isRejected ? ' costs-panel--rejected' : ''}">
    <p class="costs-title">Cost Breakdown</p>
    <div class="dg-grid">
      ${items}${fees}${shipping}${tax}
      <div class="dg-row dg-total">
        <span class="dg-label">Payment Total</span>
        <span class="dg-val">${fmt(costs.total_cost_incl_tax)}</span>
      </div>
    </div>
    ${note}
  </div>`;
}

// ── Status badge ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  CREATED: '#3b82f6', UNPAID: '#f59e0b', PAYMENT_IN_PROGRESS: '#f97316',
  PRODUCTION_DELAYED: '#f97316', PRODUCTION_READY: '#14b8a6',
  IN_PRODUCTION: '#6366f1', SHIPPED: '#10b981', DELIVERED: '#059669',
  REJECTED: '#ef4444', CANCELED: '#94a3b8', ERROR: '#ef4444',
};
function statusBadge(name) {
  const color = STATUS_COLOR[name] || '#94a3b8';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;
    font-size:11.5px;font-weight:700;background:${color}22;
    color:${color};border:1px solid ${color}44">${name}</span>`;
}

// ── Show job created success box ──────────────────────────────────────────
function showJobCreated(jobId, orderId) {
  const orderLine = orderId
    ? `<span style="font-size:12px;color:#6b7280">Order ID: <strong>${orderId}</strong></span>`
    : '';
  resultBox.className = 'result-box is-success';
  resultBox.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <h3 style="margin:0">✓ Print Job Created</h3>
      <a href="viewPrintJob.php" style="font-size:12px;font-weight:600;color:#065f46;text-decoration:none;
         padding:5px 12px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7">
        View All Jobs →
      </a>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <span style="font-size:13px;color:#374151;font-weight:600">Job ID: <strong>#${jobId}</strong></span>
      ${orderLine}
      <span id="live_status">${statusBadge('CREATED')}</span>
    </div>
    <div id="cost_poll_area" class="poll-waiting">
      <div class="spinner" style="border-top-color:#059669"></div>
      <span>Lulu is validating your PDFs and calculating costs…</span>
    </div>
    <p style="font-size:11.5px;color:#6b7280;margin-top:10px">
      Track this job in your
      <a href="https://developers.lulu.com/print-jobs" target="_blank" rel="noopener"
         style="color:#059669;font-weight:600">Lulu Developer Portal</a>
    </p>`;
  resultBox.classList.remove('hidden');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Poll job status ───────────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set([
  'UNPAID', 'PAYMENT_IN_PROGRESS', 'PRODUCTION_DELAYED',
  'PRODUCTION_READY', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED',
  'REJECTED', 'CANCELED', 'ERROR',
]);

function stopPolling() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

async function pollStatus() {
  if (!pollJobId) return;
  pollAttempt++;

  try {
    const res = await fetch(`job-status.php?id=${pollJobId}`);
    if (!res.ok) { scheduleNextPoll(); return; }

    const job    = await res.json();
    const status = job.status?.name || 'CREATED';

    const liveEl = document.getElementById('live_status');
    if (liveEl) liveEl.innerHTML = statusBadge(status);

    const pollArea = document.getElementById('cost_poll_area');
    const hasCosts = job.costs && job.costs.total_cost_incl_tax;

    if (hasCosts) {
      stopPolling();
      if (pollArea) pollArea.outerHTML = renderCosts(job.costs, status);
      if (status === 'UNPAID') showToast('Costs calculated! Pay via developers.lulu.com', 'success');

    } else if (TERMINAL_STATUSES.has(status) && pollAttempt >= 3) {
      stopPolling();
      if (pollArea) {
        const isRejected = status === 'REJECTED' || status === 'ERROR';

        // Extract printable_normalization rejection reasons from each line item
        let rejHtml = '';
        if (isRejected && Array.isArray(job.line_items)) {
          const reasons = [];
          job.line_items.forEach((item, idx) => {
            const pn = item.status?.messages?.printable_normalization;
            if (pn) {
              (pn.cover    || []).forEach(m => reasons.push(`Item ${idx + 1} Cover: ${m.message || m}`));
              (pn.interior || []).forEach(m => reasons.push(`Item ${idx + 1} Interior: ${m.message || m}`));
            }
          });
          if (reasons.length) {
            rejHtml = `<div style="margin-top:10px;background:#fef2f2;border:1px solid #fca5a5;
              border-radius:8px;padding:10px 14px;font-size:12px;color:#b91c1c;line-height:1.6">
              <strong>Rejection reason:</strong><br>
              ${reasons.map(r => `• ${r}`).join('<br>')}
            </div>`;
          } else {
            rejHtml = `<div style="margin-top:10px;font-size:12px;color:#b91c1c">
              Check that your PDF page size matches the selected trim size, and that both PDF URLs are publicly accessible.
            </div>`;
          }
        }

        pollArea.innerHTML = `<div style="font-size:13px;color:${isRejected ? '#b91c1c' : '#6b7280'}">
          Job status: <strong>${status}</strong>.
          ${job.status?.message ? `<span style="font-size:12px;display:block;margin-top:4px">${job.status.message}</span>` : ''}
          ${rejHtml}
          <a href="viewPrintJob.php" style="display:inline-block;margin-top:8px;color:#6366f1;font-weight:600;font-size:12px">View full job details →</a>
        </div>`;
      }

    } else if (pollAttempt >= POLL_MAX) {
      stopPolling();
      if (pollArea) {
        pollArea.innerHTML = `<span style="font-size:13px;color:#6b7280">
          Still validating…
          <a href="viewPrintJob.php" style="color:#6366f1;font-weight:600">Check job status manually</a>
        </span>`;
      }
    } else {
      scheduleNextPoll();
    }

  } catch {
    if (pollAttempt < POLL_MAX) scheduleNextPoll();
  }
}

function scheduleNextPoll() {
  pollTimer = setTimeout(pollStatus, 5000);
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetForm() {
  form.reset();
  container.innerHTML = '';
  itemCount = 0;
  form.querySelectorAll('input, select').forEach(el => {
    el.classList.remove('is-valid', 'is-invalid');
    el.setAttribute('aria-invalid', 'false');
  });
  addItem();
}

// ── Submit → validate → create job → poll for status & costs ─────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  resultBox.classList.add('hidden');
  stopPolling();
  if (!validateAll()) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing order…';

  resultBox.className = 'result-box is-success';
  resultBox.innerHTML = `<div class="poll-waiting">
    <div class="spinner" style="border-top-color:#6366f1"></div>
    <span>Creating print job…</span>
  </div>`;
  resultBox.classList.remove('hidden');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const payload = collectData();

    // Validate pod_package_ids & known invalid combinations before sending
    container.querySelectorAll('.item-block').forEach((itemEl, i) => {
      const pkgId = payload.line_items[i]?.printable_normalization?.pod_package_id;
      if (!pkgId) throw new Error(`Item ${i + 1}: Could not build Pod Package ID — select all print specification fields.`);
      const g = n => itemEl.querySelector(`[name="${n}"]`)?.value || '';
      const paper = g('paper_type');
      // Case Wrap only supports 060UW, 060UC, 080CW papers (per Lulu spec sheet)
      if (g('bind_type') === 'CW' && (paper === '070CW' || paper === '100CW'))
        throw new Error(`Item ${i + 1}: Case Wrap only supports 60# Uncoated or 80# Coated White paper — select 60UW, 60UC, or 80CW.`);
      // Linen Wrap requires a linen colour
      if (g('bind_type') === 'LW' && g('linen_type') === 'X')
        throw new Error(`Item ${i + 1}: Linen Wrap requires a Linen color — select Navy, Black, Tan, etc.`);
    });

    // POST directly to Lulu — Lulu calculates costs internally after job creation
    const res  = await fetch('api.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.ok) {
      const jobId   = json.id;
      const orderId = json.order_id || null;
      showJobCreated(jobId, orderId);
      resetForm();
      showToast('Print job submitted! Lulu is calculating costs…', 'success');
      pollJobId   = jobId;
      pollAttempt = 0;
      scheduleNextPoll();
    } else {
      resultBox.className = 'result-box is-error';
      resultBox.innerHTML = `<h3>✕ Lulu API Error (${res.status})</h3>
        <pre style="white-space:pre-wrap;word-break:break-word">${escHtml(JSON.stringify(json, null, 2))}</pre>`;
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    resultBox.className = 'result-box is-error';
    resultBox.innerHTML = `<h3>✕ Error</h3>
      <pre style="white-space:pre-wrap;word-break:break-word">${escHtml(err.message)}</pre>`;
    resultBox.classList.remove('hidden');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } finally {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = SUBMIT_HTML;
  }
});

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = `toast toast-${type === 'success' ? 'success' : 'error'}`;
  t.textContent = msg;
  t.style.cssText = 'opacity:0;transform:translateY(8px)';
  toastRegion.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateY(4px)';
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 3200);
}

// ── Init ──────────────────────────────────────────────────────────────────
addItemBtn.addEventListener('click', addItem);
addItem();
