'use strict';

// ── State ─────────────────────────────────────────────────────────────────
let currentPage = 1;
let totalCount  = 0;
const PAGE_SIZE = 20;

// ── DOM refs ──────────────────────────────────────────────────────────────
const loader       = document.getElementById('jobs_loader');
const emptyState   = document.getElementById('jobs_empty');
const tableWrap    = document.getElementById('jobs_table_wrap');
const tbody        = document.getElementById('jobs_tbody');
const countLabel   = document.getElementById('jobs_count_label');
const pagination   = document.getElementById('pagination');
const filterSearch = document.getElementById('filter_search');
const filterStatus = document.getElementById('filter_status');
const toastRegion  = document.getElementById('toast_region');

// ── Status badge config ───────────────────────────────────────────────────
const STATUS_META = {
  CREATED:              { label: 'Created',             cls: 'badge-blue'   },
  UNPAID:               { label: 'Unpaid',              cls: 'badge-yellow' },
  PAYMENT_IN_PROGRESS:  { label: 'Payment Processing',  cls: 'badge-orange' },
  PRODUCTION_DELAYED:   { label: 'Production Delayed',  cls: 'badge-orange' },
  PRODUCTION_READY:     { label: 'Production Ready',    cls: 'badge-teal'   },
  IN_PRODUCTION:        { label: 'In Production',       cls: 'badge-indigo' },
  SHIPPED:              { label: 'Shipped',              cls: 'badge-green'  },
  DELIVERED:            { label: 'Delivered',            cls: 'badge-green'  },
  REJECTED:             { label: 'Rejected',             cls: 'badge-red'    },
  CANCELED:             { label: 'Canceled',             cls: 'badge-gray'   },
  ERROR:                { label: 'Error',                cls: 'badge-red'    },
};

function badge(statusName) {
  const m = STATUS_META[statusName] || { label: statusName, cls: 'badge-gray' };
  return `<span class="status-badge ${m.cls}">${m.label}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── Load jobs ─────────────────────────────────────────────────────────────
async function loadJobs(page = 1) {
  currentPage = page;
  loader.classList.remove('hidden');
  emptyState.classList.add('hidden');
  tableWrap.classList.add('hidden');
  pagination.classList.add('hidden');

  const search = filterSearch.value.trim();
  const status = filterStatus.value;

  const params = new URLSearchParams({ page, page_size: PAGE_SIZE });
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  try {
    const res  = await fetch('list-jobs.php?' + params.toString());
    const json = await res.json();

    loader.classList.add('hidden');

    if (!res.ok) {
      showToast('Failed to load jobs: ' + (json.error || res.status), 'error');
      emptyState.classList.remove('hidden');
      return;
    }

    const results = json.results || [];
    totalCount = json.count || 0;

    countLabel.textContent = `${totalCount} job${totalCount !== 1 ? 's' : ''} total`;

    if (results.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    renderTable(results);
    renderPagination(totalCount, page);

    tableWrap.classList.remove('hidden');
    if (totalCount > PAGE_SIZE) pagination.classList.remove('hidden');

  } catch (err) {
    loader.classList.add('hidden');
    emptyState.classList.remove('hidden');
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── Render table rows ─────────────────────────────────────────────────────
function fmtMoney(v) {
  if (!v) return '—';
  return '$' + parseFloat(v).toFixed(2);
}

function renderTable(jobs) {
  tbody.innerHTML = jobs.map(job => {
    const status  = job.status?.name || '—';
    const items   = (job.line_items || []).length;
    const addr    = job.shipping_address;
    const shipTo  = addr ? [addr.name, addr.city, addr.country_code].filter(Boolean).join(', ') : '—';
    const created = fmtDate(job.date_created);
    const total   = job.costs?.total_cost_incl_tax;
    const priceEl = total
      ? `<span class="price-val">$${parseFloat(total).toFixed(2)}</span>`
      : `<span class="price-pending">—</span>`;

    return `<tr class="jobs-row" onclick="openDetail(${job.id})">
      <td><span class="job-id">#${job.id}</span></td>
      <td>${badge(status)}</td>
      <td><span class="item-count">${items} item${items !== 1 ? 's' : ''}</span></td>
      <td class="date-cell">${created}</td>
      <td class="ship-cell">${escHtml(shipTo)}</td>
      <td class="price-cell">${priceEl}</td>
      <td><span class="view-link">View →</span></td>
    </tr>`;
  }).join('');
}

// ── Render pagination ─────────────────────────────────────────────────────
function renderPagination(total, current) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { pagination.classList.add('hidden'); return; }

  let html = '';
  const prev = current - 1;
  const next = current + 1;

  html += `<button class="pg-btn" ${current === 1 ? 'disabled' : ''} onclick="loadJobs(${prev})">← Prev</button>`;

  for (let p = Math.max(1, current - 2); p <= Math.min(pages, current + 2); p++) {
    html += `<button class="pg-btn ${p === current ? 'pg-active' : ''}" onclick="loadJobs(${p})">${p}</button>`;
  }

  html += `<button class="pg-btn" ${current === pages ? 'disabled' : ''} onclick="loadJobs(${next})">Next →</button>`;
  html += `<span class="pg-info">Page ${current} of ${pages}</span>`;

  pagination.innerHTML = html;
}

// ── Detail modal ──────────────────────────────────────────────────────────
async function openDetail(jobId) {
  const overlay = document.getElementById('detail_overlay');
  const title   = document.getElementById('detail_title');
  const sub     = document.getElementById('detail_sub');
  const body    = document.getElementById('detail_body');

  title.textContent = `Print Job #${jobId}`;
  sub.textContent   = 'Loading details…';
  body.innerHTML    = '<div class="detail-loading"><div class="spinner"></div></div>';
  overlay.classList.remove('hidden');

  try {
    const res  = await fetch(`job-status.php?id=${jobId}`);
    const job  = await res.json();

    if (!res.ok) {
      sub.textContent = 'Failed to load';
      body.innerHTML  = `<p class="detail-err">${escHtml(job.error || 'Unknown error')}</p>`;
      return;
    }

    const status  = job.status?.name || '—';
    const addr    = job.shipping_address || {};
    const items   = job.line_items || [];

    sub.innerHTML = badge(status);

    let html = '';

    // Shipping address
    html += `<div class="detail-section">
      <h4 class="detail-section-title">Shipping Address</h4>
      <div class="detail-grid">
        <div class="dg-row"><span class="dg-label">Name</span><span class="dg-val">${escHtml(addr.name || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">Phone</span><span class="dg-val">${escHtml(addr.phone_number || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">Address</span><span class="dg-val">${escHtml([addr.street1, addr.street2].filter(Boolean).join(', ') || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">City</span><span class="dg-val">${escHtml(addr.city || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">State</span><span class="dg-val">${escHtml(addr.state_code || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">Postcode</span><span class="dg-val">${escHtml(addr.postcode || '—')}</span></div>
        <div class="dg-row"><span class="dg-label">Country</span><span class="dg-val">${escHtml(addr.country_code || '—')}</span></div>
      </div>
    </div>`;

    // Line items
    if (items.length) {
      html += `<div class="detail-section"><h4 class="detail-section-title">Line Items</h4>`;
      items.forEach((item, i) => {
        const ls       = item.status?.name || '—';
        const tracking = item.tracking_id || item.status?.messages?.tracking_id;
        const itemErr  = item.status?.messages?.error;
        const itemInfo = item.status?.messages?.info;

        // Rejection details from printable_normalization
        const pn = item.status?.messages?.printable_normalization;
        let rejectionHtml = '';
        if ((ls === 'REJECTED' || ls === 'ERROR') && pn) {
          const msgs = [];
          if (Array.isArray(pn.cover)    && pn.cover.length)    pn.cover.forEach(m    => msgs.push({ src: 'Cover',    msg: m }));
          if (Array.isArray(pn.interior) && pn.interior.length) pn.interior.forEach(m => msgs.push({ src: 'Interior', msg: m }));
          if (msgs.length) {
            rejectionHtml = `<div style="margin-top:8px;padding:10px 12px;background:#fef2f2;
              border-radius:8px;border-left:3px solid #ef4444">
              <p style="font-size:11px;font-weight:700;color:#b91c1c;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Rejection Reason</p>
              ${msgs.map(m => `<p style="font-size:12px;color:#991b1b;margin:3px 0">
                <strong>${m.src}:</strong> ${escHtml(m.msg)}</p>`).join('')}
            </div>`;
          }
        }

        html += `<div class="detail-item">
          <div class="detail-item-head">
            <span class="detail-item-num">Item ${i + 1}: ${escHtml(item.title || '—')}</span>
            ${badge(ls)}
          </div>
          <div class="detail-grid">
            <div class="dg-row"><span class="dg-label">Quantity</span><span class="dg-val">${item.quantity ?? '—'}</span></div>
            <div class="dg-row"><span class="dg-label">Package ID</span><span class="dg-val dg-mono">${escHtml(item.pod_package_id || '—')}</span></div>
            ${tracking ? `<div class="dg-row"><span class="dg-label">Tracking</span><span class="dg-val dg-mono">${escHtml(tracking)}</span></div>` : ''}
            ${itemErr  ? `<div class="dg-row"><span class="dg-label" style="color:#b91c1c">Error</span><span class="dg-val" style="color:#b91c1c">${escHtml(itemErr)}</span></div>` : ''}
            ${itemInfo && !itemErr ? `<div class="dg-row"><span class="dg-label" style="color:#6b7280">Info</span><span class="dg-val" style="color:#6b7280">${escHtml(itemInfo)}</span></div>` : ''}
          </div>
          ${rejectionHtml}
        </div>`;
      });
      html += `</div>`;
    }

    // Costs (show for all statuses including REJECTED)
    if (job.costs) {
      const c          = job.costs;
      const isRejected = ['REJECTED', 'ERROR', 'CANCELED'].includes(status);
      const lineItems  = (c.line_item_costs || []).map((li, i) =>
        `<div class="dg-row">
          <span class="dg-label">Item ${i + 1} × ${li.quantity}</span>
          <span class="dg-val">$${parseFloat(li.total_cost_excl_tax || 0).toFixed(2)}</span>
        </div>`
      ).join('');
      const shipping = c.shipping_cost
        ? `<div class="dg-row"><span class="dg-label">Shipping</span><span class="dg-val">$${parseFloat(c.shipping_cost.total_cost_excl_tax || 0).toFixed(2)}</span></div>`
        : '';
      const tax = parseFloat(c.total_tax || 0) > 0
        ? `<div class="dg-row"><span class="dg-label">Tax</span><span class="dg-val">$${parseFloat(c.total_tax).toFixed(2)}</span></div>`
        : '';

      html += `<div class="detail-section">
        <h4 class="detail-section-title">Costs${isRejected ? ` <span style="color:#b91c1c;font-size:10px;font-weight:600">(Job ${status})</span>` : ''}</h4>
        <div class="detail-grid">
          ${lineItems}${shipping}${tax}
          <div class="dg-row dg-total">
            <span class="dg-label">Total</span>
            <span class="dg-val">$${parseFloat(c.total_cost_incl_tax || 0).toFixed(2)}</span>
          </div>
        </div>
        ${isRejected ? `<p style="font-size:11px;color:#b91c1c;margin-top:8px">⚠ These costs were calculated before the job was ${status}.</p>` : ''}
      </div>`;
    }

    // Status history
    if (job.status?.changed) {
      html += `<div class="detail-section">
        <h4 class="detail-section-title">Status Info</h4>
        <div class="detail-grid">
          <div class="dg-row"><span class="dg-label">Status</span><span class="dg-val">${badge(status)}</span></div>
          <div class="dg-row"><span class="dg-label">Updated</span><span class="dg-val">${fmtDate(job.status.changed)}</span></div>
          ${job.status.message ? `<div class="dg-row"><span class="dg-label">Message</span><span class="dg-val">${escHtml(job.status.message)}</span></div>` : ''}
        </div>
      </div>`;
    }

    // Estimated shipping dates
    if (job.estimated_shipping_dates) {
      const s = job.estimated_shipping_dates;
      html += `<div class="detail-section">
        <h4 class="detail-section-title">Estimated Shipping</h4>
        <div class="detail-grid">
          <div class="dg-row"><span class="dg-label">Dispatch</span><span class="dg-val">${fmtDate(s.dispatch_min)} – ${fmtDate(s.dispatch_max)}</span></div>
          <div class="dg-row"><span class="dg-label">Arrival</span><span class="dg-val">${fmtDate(s.arrival_min)} – ${fmtDate(s.arrival_max)}</span></div>
        </div>
      </div>`;
    }

    // Raw JSON toggle
    html += `<div class="detail-section">
      <button type="button" class="btn-raw-toggle" onclick="toggleRaw(this)">Show Raw JSON</button>
      <pre class="raw-json hidden">${escHtml(JSON.stringify(job, null, 2))}</pre>
    </div>`;

    body.innerHTML = html;

  } catch (err) {
    sub.textContent = 'Error';
    body.innerHTML = `<p class="detail-err">Network error: ${escHtml(err.message)}</p>`;
  }
}

function closeDetail(e) {
  if (e && e.target !== document.getElementById('detail_overlay')) return;
  document.getElementById('detail_overlay').classList.add('hidden');
}


function toggleRaw(btn) {
  const pre = btn.nextElementSibling;
  const show = pre.classList.toggle('hidden');
  btn.textContent = show ? 'Show Raw JSON' : 'Hide Raw JSON';
}

// ── Helpers ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// ── Events ────────────────────────────────────────────────────────────────
document.getElementById('refresh_btn').addEventListener('click', () => loadJobs(currentPage));
document.getElementById('search_btn').addEventListener('click', () => loadJobs(1));
document.getElementById('clear_btn').addEventListener('click', () => {
  filterSearch.value = '';
  filterStatus.value = '';
  loadJobs(1);
});
filterSearch.addEventListener('keydown', e => { if (e.key === 'Enter') loadJobs(1); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('detail_overlay').classList.add('hidden');
});

// ── Init ──────────────────────────────────────────────────────────────────
loadJobs(1);
