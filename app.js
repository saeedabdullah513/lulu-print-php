'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────
const form        = document.getElementById('print_job_form');
const container   = document.getElementById('line_items_container');
const addItemBtn  = document.getElementById('add_item_btn');
const submitBtn   = document.getElementById('submit_btn');
const resultBox   = document.getElementById('result_box');
const toastRegion = document.getElementById('toast_region');
const SUBMIT_HTML = submitBtn.innerHTML;

let itemCount      = 0;
let pollTimer      = null;
let pollJobId      = null;
let pollAttempt    = 0;
let pendingPayload = null; // stored after cost preview, used on confirm
const POLL_MAX     = 24;   // 24 × 5s = ~2 minutes

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
  contact_email:  { test: v => !v || EMAIL_RE.test(v),      msg: 'Enter a valid email address.' },
  ship_name:      { req: true, test: v => v.length >= 2,    msg: 'Name is required.' },
  ship_phone:     { req: true, test: v => PHONE_RE.test(v), msg: 'Enter a valid phone number.' },
  ship_street1:   { req: true, test: v => v.length >= 3,    msg: 'Street address is required.' },
  ship_city:      { req: true, test: v => v.length >= 2,    msg: 'City is required.' },
  ship_state:     { req: true, test: v => v.length >= 2,    msg: 'State code is required.' },
  ship_postcode:  { req: true, test: v => v.length >= 3,    msg: 'Postcode is required.' },
  ship_country:   { req: true, test: v => COUNTRY_RE.test(v), msg: '2-letter code e.g. US' },
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
  if (url.includes('dropbox.com')) {
    // Remove any existing dl param then add dl=1
    url = url.replace(/([?&])dl=\d/g, '$1').replace(/[?&]$/, '');
    url += (url.includes('?') ? '&' : '?') + 'dl=1';
    // Remove raw=0 if present, add raw=1 for direct binary download
    url = url.replace(/([?&])raw=0/g, '$1').replace(/[?&]$/, '');
  }
  return url;
}

// ── pod_package_id (dotted format) ───────────────────────────────────────
function buildPodPackageId(item) {
  const g = n => item.querySelector(`[name="${n}"]`)?.value || '';
  const trim   = g('trim_size'),  color  = g('color_type'), print = g('print_type'),
        bind   = g('bind_type'),  paper  = g('paper_type'), finish = g('finish_type');
  const linen  = g('linen_type') || 'X';
  const foil   = g('foil_type')  || 'X';
  if (!trim || !color || !print || !bind || !paper || !finish) return null;
  return `${trim}.${color}.${print}.${bind}.${paper}444.${finish}${linen}${foil}`;
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
  };
  if (f('ship_street2')) shipping_address.street2    = f('ship_street2');
  if (f('ship_state'))   shipping_address.state_code = f('ship_state');

  const line_items = [];
  container.querySelectorAll('.item-block').forEach((item, idx) => {
    line_items.push({
      external_id:    `item-${idx + 1}`,
      title:          item.querySelector('[name="title"]')?.value.trim() || '',
      quantity:       parseInt(item.querySelector('[name="quantity"]')?.value || '1', 10),
      pod_package_id: buildPodPackageId(item),
      cover:          { source_url: normalizePdfUrl(item.querySelector('[name="cover_url"]')?.value.trim()    || '') },
      interior:       { source_url: normalizePdfUrl(item.querySelector('[name="interior_url"]')?.value.trim() || '') },
    });
  });

  const payload = { shipping_address, line_items };
  const email = f('contact_email');
  if (email) payload.contact_email = email;
  return payload;
}

// ── Build cost calculation payload ────────────────────────────────────────
function buildCostPayload(payload) {
  return {
    line_items: payload.line_items.map(item => ({
      page_count:     item.page_count,
      pod_package_id: item.pod_package_id,
      quantity:       item.quantity,
    })),
    shipping_address: payload.shipping_address,
    shipping_option:  payload.shipping_level, // cost API uses shipping_option
  };
}

// ── Money formatter ───────────────────────────────────────────────────────
function fmt(v) { return '$' + parseFloat(v || 0).toFixed(2); }

// ── Render cost preview (pre-calculation response) ────────────────────────
function renderCostPreview(costs) {
  const items = (costs.line_item_costs || []).map((li, i) => {
    const discountHtml = (li.discounts || []).map(d =>
      `<div class="dg-row" style="color:#059669;font-size:12px">
        <span class="dg-label">Discount</span>
        <span class="dg-val">−${fmt(d.amount)} <span style="font-weight:400;color:#6b7280">(${d.description})</span></span>
      </div>`
    ).join('');
    return `<div class="dg-row">
      <span class="dg-label">Item ${i + 1} × ${li.quantity}</span>
      <span class="dg-val">${fmt(li.total_cost_excl_tax)}</span>
    </div>${discountHtml}`;
  }).join('');

  const shipping = costs.shipping_cost
    ? `<div class="dg-row"><span class="dg-label">Shipping</span><span class="dg-val">${fmt(costs.shipping_cost.total_cost_excl_tax)}</span></div>`
    : '';

  const fees = (costs.fees || []).map(fee =>
    `<div class="dg-row"><span class="dg-label">${fee.fee_type.replace(/_/g,' ')}</span><span class="dg-val">${fmt(fee.total_cost_excl_tax)}</span></div>`
  ).join('');

  const tax = parseFloat(costs.total_tax || 0) > 0
    ? `<div class="dg-row"><span class="dg-label">Tax</span><span class="dg-val">${fmt(costs.total_tax)}</span></div>`
    : '';

  const discount = parseFloat(costs.total_discount_amount || 0) > 0
    ? `<div class="dg-row" style="color:#059669"><span class="dg-label">Total Discount</span><span class="dg-val">−${fmt(costs.total_discount_amount)}</span></div>`
    : '';

  return `<div class="costs-panel">
    <p class="costs-title">Estimated Cost Breakdown</p>
    <div class="dg-grid">
      ${items}${shipping}${fees}${discount}${tax}
      <div class="dg-row dg-total">
        <span class="dg-label">Total</span>
        <span class="dg-val">${fmt(costs.total_cost_incl_tax)}</span>
      </div>
    </div>
    <p class="costs-note">Review your order below. Click <strong>Confirm &amp; Place Order</strong> to submit.</p>
  </div>`;
}

// ── Render post-creation cost breakdown ───────────────────────────────────
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

// ── Show cost preview panel ───────────────────────────────────────────────
function showCostPreview(costs) {
  resultBox.className = 'result-box is-success';
  resultBox.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <h3 style="margin:0">Order Summary</h3>
      <span style="font-size:12px;color:#6b7280">Review before placing order</span>
    </div>
    ${renderCostPreview(costs)}
    <div class="cost-actions" style="margin-top:16px;padding:0">
      <button type="button" id="confirm_btn" class="btn-confirm">
        Confirm &amp; Place Order
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
      <button type="button" id="edit_btn" class="btn-edit">← Edit</button>
    </div>`;
  resultBox.classList.remove('hidden');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('confirm_btn').addEventListener('click', confirmAndPlace);
  document.getElementById('edit_btn').addEventListener('click', () => {
    resultBox.classList.add('hidden');
    pendingPayload = null;
  });
}

// ── Confirm and place order ───────────────────────────────────────────────
async function confirmAndPlace() {
  if (!pendingPayload) return;

  const confirmBtn = document.getElementById('confirm_btn');
  const editBtn    = document.getElementById('edit_btn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Placing order…';
  if (editBtn) editBtn.disabled = true;

  // Strip page_count from line_items — not accepted by job creation endpoint
  const payload = JSON.parse(JSON.stringify(pendingPayload));
  payload.line_items.forEach(item => delete item.page_count);

  try {
    const res  = await fetch('api.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.ok) {
      const jobId   = json.id;
      const orderId = json.order_id || null;
      pendingPayload = null;
      showJobCreated(jobId, orderId);
      resetForm();
      showToast('Print job submitted! Waiting for costs…', 'success');
      pollJobId   = jobId;
      pollAttempt = 0;
      scheduleNextPoll();
    } else {
      resultBox.className = 'result-box is-error';
      resultBox.innerHTML = `<h3>✕ Lulu API Error (${res.status})</h3>
        <pre>${JSON.stringify(json, null, 2)}</pre>`;
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    resultBox.className = 'result-box is-error';
    resultBox.innerHTML = `<h3>✕ Network Error</h3>
      <pre>${JSON.stringify({ error: err.message }, null, 2)}</pre>`;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
  form.querySelectorAll('input, select').forEach(el => {
    el.classList.remove('is-valid', 'is-invalid');
    el.setAttribute('aria-invalid', 'false');
  });
  addItem();
}

// ── Date formatter for shipping estimates ────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Fetch real shipping options from Lulu ────────────────────────────────
async function fetchShippingOptions(payload) {
  const body = {
    line_items: payload.line_items.map(item => ({
      page_count:     item.page_count,
      pod_package_id: item.pod_package_id,
      quantity:       item.quantity,
    })),
    shipping_address: payload.shipping_address,
  };
  const res  = await fetch('shipping-options.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Shipping options error (${res.status})`);
  return Array.isArray(json) ? json : [];
}

// ── Show shipping option cards — user picks one ──────────────────────────
function showShippingSelector(options) {
  if (!options.length) {
    throw new Error('No shipping options available for this address and product combination.');
  }

  const cards = options.map(opt => {
    const cost    = opt.total_cost_excl_tax || opt.cost_excl_tax;
    const arrMin  = fmtDate(opt.estimated_arrival_min);
    const arrMax  = fmtDate(opt.estimated_arrival_max);
    const arrival = arrMin ? `${arrMin}–${arrMax}` : '';
    const safeLevel = String(opt.level || '').replace(/['"<>&]/g, '');
    const safeTitle = String(opt.title || opt.level || '').replace(/[<>&]/g, '');
    return `<button type="button" class="shipping-card" data-level="${safeLevel}">
      <div class="sc-left">
        <div class="sc-title">${safeTitle}</div>
        ${arrival ? `<div class="sc-arrival">Arrives ${arrival}</div>` : ''}
      </div>
      <div class="sc-cost">${cost ? fmt(cost) : 'Included'}</div>
    </button>`;
  }).join('');

  resultBox.className = 'result-box is-success';
  resultBox.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <h3 style="margin:0">Choose Shipping Method</h3>
      <span style="font-size:12px;color:#6b7280">Select one to continue</span>
    </div>
    <div id="shipping_cards_list">${cards}</div>
    <button type="button" id="back_to_form_btn" class="btn-edit" style="margin-top:14px">← Edit Form</button>`;
  resultBox.classList.remove('hidden');
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('shipping_cards_list').querySelectorAll('.shipping-card').forEach(card => {
    card.addEventListener('click', () => selectShipping(card.dataset.level));
  });
  document.getElementById('back_to_form_btn').addEventListener('click', () => {
    resultBox.classList.add('hidden');
    pendingPayload = null;
  });
}

// ── User picks shipping → calculate cost → show preview ──────────────────
async function selectShipping(level) {
  if (!pendingPayload) return;
  pendingPayload.shipping_level = level;

  resultBox.className = 'result-box is-success';
  resultBox.innerHTML = `<div class="poll-waiting">
    <div class="spinner" style="border-top-color:#6366f1"></div>
    <span>Calculating costs…</span>
  </div>`;

  try {
    const costPayload = buildCostPayload(pendingPayload);
    const res  = await fetch('cost.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(costPayload),
    });
    const json = await res.json();

    if (res.ok) {
      showCostPreview(json);
    } else {
      resultBox.className = 'result-box is-error';
      resultBox.innerHTML = `<h3>✕ Cost Calculation Error (${res.status})</h3>
        <pre>${JSON.stringify(json, null, 2)}</pre>`;
    }
  } catch (err) {
    resultBox.className = 'result-box is-error';
    resultBox.innerHTML = `<h3>✕ Error</h3>
      <pre>${JSON.stringify({ error: err.message }, null, 2)}</pre>`;
  }
}

// ── Validate interior PDF → get page_count automatically ─────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPageCount(interiorUrl, podPackageId) {
  // Start validation
  const startRes  = await fetch('validate-pdf.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ source_url: interiorUrl, pod_package_id: podPackageId }),
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(startData.error || 'Could not start PDF validation.');

  const validationId = startData.id;

  // Already done (unlikely but handle it)
  if (startData.page_count && ['VALIDATED','NORMALIZED'].includes(startData.status)) {
    return startData.page_count;
  }

  // Poll up to 12 × 5s = 60 seconds
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const pollRes  = await fetch(`validate-pdf.php?id=${encodeURIComponent(validationId)}`);
    const pollData = await pollRes.json();

    if (['VALIDATED','NORMALIZED'].includes(pollData.status)) {
      if (!pollData.page_count) throw new Error('PDF validated but page count not returned.');
      return pollData.page_count;
    }
    if (pollData.status === 'ERROR') {
      const errMsg = Array.isArray(pollData.errors) ? pollData.errors.join(', ') : (pollData.errors || 'Invalid PDF');
      throw new Error('PDF validation failed: ' + errMsg);
    }
  }
  throw new Error('PDF validation timed out. Please check your PDF URL and try again.');
}

// ── Submit → validate PDFs → fetch shipping options → user picks ──────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  resultBox.classList.add('hidden');
  stopPolling();
  pendingPayload = null;
  if (!validateAll()) return;

  submitBtn.disabled = true;

  try {
    const payload = collectData();
    const blocks  = [...container.querySelectorAll('.item-block')];

    // Step 1: Validate each interior PDF and get page_count automatically
    for (let idx = 0; idx < blocks.length; idx++) {
      const item        = blocks[idx];
      const interiorUrl = normalizePdfUrl(item.querySelector('[name="interior_url"]')?.value.trim());
      const podId       = buildPodPackageId(item);

      submitBtn.textContent = blocks.length > 1
        ? `Validating PDF ${idx + 1} of ${blocks.length}…`
        : 'Validating PDF…';

      const pageCount = await fetchPageCount(interiorUrl, podId);
      payload.line_items[idx].page_count = pageCount;
    }

    // Step 2: Fetch real shipping options from Lulu
    submitBtn.textContent = 'Loading shipping options…';
    resultBox.className = 'result-box is-success';
    resultBox.innerHTML = `<div class="poll-waiting">
      <div class="spinner" style="border-top-color:#6366f1"></div>
      <span>Loading available shipping options…</span>
    </div>`;
    resultBox.classList.remove('hidden');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const options = await fetchShippingOptions(payload);
    pendingPayload = payload;

    // Step 3: Show shipping cards — user picks one → selectShipping() handles the rest
    showShippingSelector(options);

  } catch (err) {
    resultBox.className = 'result-box is-error';
    resultBox.innerHTML = `<h3>✕ Error</h3>
      <pre>${JSON.stringify({ error: err.message }, null, 2)}</pre>`;
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
