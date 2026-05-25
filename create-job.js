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
const POLL_MAX  = 24; // 24 × 5s = ~2 minutes

// ── Validation rules ──────────────────────────────────────────────────────
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE   = /^[\+\d\s\-().]{6,20}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

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
form.querySelectorAll('input:not([type="file"]), select').forEach(wire);

document.getElementById('ship_country').addEventListener('input', function () {
  const pos = this.selectionStart;
  this.value = this.value.toUpperCase();
  this.setSelectionRange(pos, pos);
});

function validateAll() {
  let valid = true, firstInvalid = null;

  form.querySelectorAll('input:not([type="file"]), select').forEach(input => {
    if (!validateInput(input) && !firstInvalid) firstInvalid = input;
    if (input.classList.contains('is-invalid')) valid = false;
  });

  // Validate file inputs
  container.querySelectorAll('.item-block').forEach(item => {
    ['cover_pdf', 'interior_pdf'].forEach(name => {
      const fileInput = item.querySelector(`[name="${name}"]`);
      if (!fileInput) return;
      const errEl = fileInput.closest('.fw')?.querySelector('.fe');
      if (!fileInput.files?.length) {
        valid = false;
        if (errEl) errEl.textContent = name === 'cover_pdf' ? 'Cover PDF is required.' : 'Interior PDF is required.';
        if (!firstInvalid) firstInvalid = fileInput;
      } else {
        if (errEl) errEl.textContent = '';
      }
    });
  });

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

// ── pod_package_id builder ────────────────────────────────────────────────
// PPI (pages-per-inch) suffix varies by paper — from Lulu official spec sheet
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
  return `${trim}.${color}.${print}.${bind}.${paper}${ppi}.${finish}${linen}${foil}`;
}

// ── HTML escape helper ────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── File drop UI ──────────────────────────────────────────────────────────
function initFileDrop(dropEl) {
  const input      = dropEl.querySelector('.file-input');
  const labelDiv   = dropEl.querySelector('.file-drop-label');
  const chosenDiv  = dropEl.querySelector('.file-chosen');
  const chosenName = dropEl.querySelector('.file-chosen-name');
  const clearBtn   = dropEl.querySelector('.file-clear');

  input.addEventListener('change', () => {
    if (input.files && input.files[0]) {
      labelDiv.classList.add('hidden');
      chosenDiv.classList.remove('hidden');
      chosenName.textContent = input.files[0].name;
      dropEl.classList.add('has-file');
      const errEl = dropEl.closest('.fw')?.querySelector('.fe');
      if (errEl) errEl.textContent = '';
    }
  });

  clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    input.value = '';
    labelDiv.classList.remove('hidden');
    chosenDiv.classList.add('hidden');
    chosenName.textContent = '';
    dropEl.classList.remove('has-file');
  });
}

// ── Add / Remove items ────────────────────────────────────────────────────
function addItem() {
  itemCount++;
  const clone = document.getElementById('line_item_tpl').content.cloneNode(true);
  const el    = clone.querySelector('.item-block');
  el.querySelector('.item-num').textContent = itemCount;

  el.querySelectorAll('input:not([type="file"]), select').forEach(input => {
    const name = input.getAttribute('name');
    if (!name) return;
    const uid   = `item${itemCount}_${name}`;
    input.id    = uid;
    const lbl   = input.closest('.fw')?.querySelector('label');
    if (lbl && !lbl.getAttribute('for')) lbl.setAttribute('for', uid);
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

  el.querySelectorAll('.file-drop').forEach(initFileDrop);

  // ── Live pod_package_id preview + compatibility warnings ─────────────
  const pkgPreview    = el.querySelector('.pkg-preview');
  const pkgPreviewVal = el.querySelector('.pkg-preview-val');
  const specSelects   = ['trim_size','color_type','print_type','bind_type','paper_type','finish_type','linen_type','foil_type'];
  function updatePkgPreview() {
    const id = buildPodPackageId(el);
    const g  = n => el.querySelector(`[name="${n}"]`)?.value || '';
    const warnings = [];
    const bind  = g('bind_type');
    const paper = g('paper_type');
    const linen = g('linen_type');

    if (bind === 'CW' && (paper === '070CW' || paper === '100CW'))
      warnings.push('⚠ Case Wrap only supports 60# Uncoated or 80# Coated White — select 60UW, 60UC, or 80CW.');
    if (bind === 'LW' && linen === 'X')
      warnings.push('⚠ Linen Wrap (LW) requires a Linen color — select Navy, Black, Tan, etc.');
    if (bind && bind !== 'LW' && linen !== 'X')
      warnings.push('⚠ Linen color only applies to Linen Wrap (LW) — set Linen to N/A for other bindings.');

    el.querySelectorAll('.pkg-warning').forEach(w => w.remove());
    if (warnings.length) {
      const wDiv = document.createElement('div');
      wDiv.className = 'pkg-warning';
      wDiv.style.cssText = 'margin:6px 0;padding:8px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;font-size:12px;color:#854d0e;line-height:1.6';
      wDiv.innerHTML = warnings.map(w => `<div>${w}</div>`).join('');
      pkgPreview.insertAdjacentElement('afterend', wDiv);
    }
    if (id) { pkgPreviewVal.textContent = id; pkgPreview.style.display = ''; }
    else     { pkgPreview.style.display = 'none'; }
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

// ── Upload a single PDF to server ─────────────────────────────────────────
async function uploadPdf(file) {
  const fd = new FormData();
  fd.append('pdf', file);
  const res  = await fetch('upload.php', { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json.url;
}

// ── Collect shipping fields ───────────────────────────────────────────────
function collectShipping() {
  const f = name => form.querySelector(`[name="${name}"]`)?.value.trim() || '';
  const addr = {
    name:         f('ship_name'),
    phone_number: f('ship_phone'),
    street1:      f('ship_street1'),
    city:         f('ship_city'),
    postcode:     f('ship_postcode'),
    country_code: f('ship_country').toUpperCase(),
    email:        f('contact_email'),   // required by Lulu API
  };
  if (f('ship_street2')) addr.street2    = f('ship_street2');
  if (f('ship_state'))   addr.state_code = f('ship_state');
  return { shipping_address: addr, shipping_level: f('shipping_level') };
}

// ── Upload PDFs and collect line items ────────────────────────────────────
async function collectLineItems() {
  const blocks = [...container.querySelectorAll('.item-block')];
  const items  = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    const item = blocks[idx];
    const g    = n => item.querySelector(`[name="${n}"]`)?.value.trim() || '';

    submitBtn.textContent = blocks.length > 1
      ? `Uploading item ${idx + 1} of ${blocks.length} PDFs…`
      : 'Uploading PDFs…';

    const coverFile    = item.querySelector('[name="cover_pdf"]').files[0];
    const interiorFile = item.querySelector('[name="interior_pdf"]').files[0];
    const [coverUrl, interiorUrl] = await Promise.all([
      uploadPdf(coverFile),
      uploadPdf(interiorFile),
    ]);

    const pkgId = buildPodPackageId(item);
    if (!pkgId) throw new Error(`Item ${idx + 1}: Could not build Package ID — select all print spec fields.`);

    // Validate Case Wrap paper restriction before sending
    const paper = g('paper_type');
    if (g('bind_type') === 'CW' && (paper === '070CW' || paper === '100CW'))
      throw new Error(`Item ${idx + 1}: Case Wrap only supports 60# Uncoated or 80# Coated White paper.`);
    if (g('bind_type') === 'LW' && g('linen_type') === 'X')
      throw new Error(`Item ${idx + 1}: Linen Wrap requires a Linen color — select Navy, Black, Tan, etc.`);

    items.push({
      external_id: `item-${idx + 1}`,
      title:       g('title'),
      quantity:    parseInt(g('quantity') || '1', 10),
      printable_normalization: {
        pod_package_id: pkgId,
        cover:    { source_url: coverUrl },
        interior: { source_url: interiorUrl },
      },
    });
  }
  return items;
}

// ── Cost display helper ───────────────────────────────────────────────────
function fmt(v) { return '$' + parseFloat(v || 0).toFixed(2); }

function renderCosts(costs, status) {
  if (!costs) return '';
  const isRejected = status === 'REJECTED' || status === 'ERROR';

  const items = (costs.line_item_costs || []).map((li, i) =>
    `<div class="dg-row">
      <span class="dg-label">Item ${i + 1} × ${li.quantity}</span>
      <span class="dg-val">${fmt(li.total_cost_excl_tax)}</span>
    </div>`
  ).join('');

  const shipping = costs.shipping_cost
    ? `<div class="dg-row"><span class="dg-label">Shipping</span><span class="dg-val">${fmt(costs.shipping_cost.total_cost_excl_tax)}</span></div>`
    : '';

  const tax = parseFloat(costs.total_tax || 0) > 0
    ? `<div class="dg-row"><span class="dg-label">Tax</span><span class="dg-val">${fmt(costs.total_tax)}</span></div>`
    : '';

  const note = isRejected
    ? `<p class="costs-note" style="color:#b91c1c">⚠ Job was ${status}. These are the estimated costs calculated before rejection.</p>`
    : `<p class="costs-note">This amount has been charged to your Lulu account balance.</p>`;

  return `<div class="costs-panel${isRejected ? ' costs-panel--rejected' : ''}">
    <p class="costs-title">Cost Breakdown</p>
    <div class="dg-grid">
      ${items}${shipping}${tax}
      <div class="dg-row dg-total">
        <span class="dg-label">Total</span>
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

// ── Show success box ──────────────────────────────────────────────────────
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
      This job is now visible in your
      <a href="https://developers.lulu.com/print-jobs" target="_blank" rel="noopener"
         style="color:#059669;font-weight:600">Lulu Developer Portal</a>
      where you can also track it.
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
      if (status === 'UNPAID') showToast('Costs calculated — check the breakdown below!', 'success');

    } else if (TERMINAL_STATUSES.has(status) && pollAttempt >= 3) {
      stopPolling();
      if (pollArea) {
        const isRejected = status === 'REJECTED' || status === 'ERROR';
        pollArea.innerHTML = `<span style="font-size:13px;color:${isRejected ? '#b91c1c' : '#6b7280'}">
          Job status: <strong>${status}</strong>.
          ${job.status?.message ? `<br><span style="font-size:12px">${job.status.message}</span>` : ''}
          <br><a href="viewPrintJob.php" style="color:#6366f1;font-weight:600">View job details →</a>
        </span>`;
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
  form.querySelectorAll('input:not([type="file"]), select').forEach(el => {
    el.classList.remove('is-valid', 'is-invalid');
    el.setAttribute('aria-invalid', 'false');
  });
  addItem();
}

// ── Submit ────────────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  resultBox.classList.add('hidden');
  stopPolling();
  if (!validateAll()) return;

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Uploading PDFs…';

  try {
    const shipping   = collectShipping();
    const line_items = await collectLineItems();

    submitBtn.textContent = 'Creating print job…';

    const payload = {
      ...shipping,
      contact_email: form.querySelector('[name="contact_email"]')?.value.trim() || '',
      line_items,
    };

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
      resultBox.classList.remove('hidden');
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
