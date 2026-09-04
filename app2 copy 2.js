async function boot() {
  showLogin();
  db.auth.onAuthStateChange((_e, s) => {
    session = s;
    s ? showApp() : showLogin();
  });
  const r = await Promise.race([
    db.auth.getSession(),
    new Promise((res) =>
      setTimeout(() => res({ data: { session: null } }), 2500),
    ),
  ]);
  if (r?.data?.session) {
    session = r.data.session;
    showApp();
  }
}
function showLogin() {
  $("login").classList.remove("hidden");
  $("app").classList.add("hidden");
}
async function showApp() {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  const today = new Date();
  $("dashTo").value = today.toISOString().slice(0, 10);
  $("dashFrom").value = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  $("spendDate").value = today.toISOString().slice(0, 10);
  await loadData();
}
async function loadData() {
  const [
    { data: l, error: le },
    { data: c, error: ce },
    { data: s, error: se },
  ] = await Promise.all([
    db
      .from("leads_inquiries")
      .select("*")
      .order("lead_at", { ascending: false }),
    db.from("leads_customers").select("*"),
    db
      .from("leads_ad_spend")
      .select("*")
      .order("spend_date", { ascending: false }),
  ]);
  if (le || ce || se) {
    alert((le || ce || se).message);
    return;
  }
  leads = l || [];
  customers = Object.fromEntries((c || []).map((x) => [x.id, x]));
  spends = s || [];
  renderAll();
}
function renderAll() {
  renderDashboard();
  renderLeadLists();
  renderAds();
  renderCampaigns();
}
function renderDashboard() {
  const p = filteredPeriod(),
    deals = p.filter((x) => x.status === "deal"),
    lost = p.filter((x) => x.status === "lost"),
    paid = p.filter((x) => x.entry_type === "ads");
  const { from, to } = dateRange();
  const ps = spends.filter(
    (s) =>
      (!from || new Date(s.spend_date + "T12:00:00+07:00") >= from) &&
      (!to || new Date(s.spend_date + "T12:00:00+07:00") <= to),
  );
  const spend = ps.reduce((a, b) => a + Number(b.spend || 0), 0),
    rev = deals.reduce((a, b) => a + Number(b.deal_value || 0), 0),
    allDealsValued =
      deals.length > 0 && deals.every((x) => Number(x.deal_value || 0) > 0),
    conv = p.length ? (deals.length / p.length) * 100 : 0,
    cpl = paid.length ? spend / paid.length : 0,
    paidDeals = deals.filter((x) => x.entry_type === "ads").length,
    roas = spend && allDealsValued ? rev / spend : null;
  $("kpis").innerHTML = [
    ["Total Leads", p.length, "periode dipilih"],
    ["Deal", deals.length, conv.toFixed(1) + "% conversion"],
    [
      "Open",
      p.filter((x) => ["new", "replied", "follow_up"].includes(x.status))
        .length,
      "perlu tindak lanjut",
    ],
    ["Ad Spend", fmtRp(spend), paid.length + " paid leads"],
    ["CPL", fmtRp(cpl), "biaya / paid lead"],
    [
      "ROAS",
      roas === null ? "-" : roas.toFixed(2) + "x",
      allDealsValued ? fmtRp(rev) + " nilai deal" : "nilai deal belum diinput",
    ],
  ]
    .map(
      (x) =>
        `<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`,
    )
    .join("");
  let groups = {};
  p.forEach((l) => {
    let k = sourceLabel(l);
    groups[k] ??= { leads: 0, deals: 0 };
    groups[k].leads++;
    if (l.status === "deal") groups[k].deals++;
  });
  let rows = Object.entries(groups)
    .map(
      ([k, v]) =>
        `<tr><td class="source">${esc(k)}</td><td>${v.leads}</td><td>${v.deals}</td><td>${v.leads ? ((v.deals / v.leads) * 100).toFixed(1) : 0}%</td></tr>`,
    )
    .join("");
  $("sourceTable").innerHTML = rows
    ? `<div class="table-wrap"><table style="min-width:0"><thead><tr><th>Sumber</th><th>Leads</th><th>Deal</th><th>Conversion</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<div class="empty">Belum ada data.</div>';
  let reasons = {};
  lost.forEach((l) => {
    reasons[l.lost_reason] = (reasons[l.lost_reason] || 0) + 1;
  });
  let max = Math.max(1, ...Object.values(reasons));
  $("lostReasons").innerHTML =
    Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([k, v]) =>
          `<div class="barrow"><span>${esc(reasonName[k] || k)}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><b>${v}</b></div>`,
      )
      .join("") || '<div class="empty">Belum ada lost lead.</div>';
  $("recentLeads").innerHTML = readTable(p.slice(0, 8), true);
}
function readTable(arr, compact = false) {
  if (!arr.length) return '<div class="empty">Belum ada lead.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Nama</th><th>WhatsApp</th><th>Sumber</th><th>Campaign</th><th>Status</th><th>Follow Up</th><th>Catatan</th><th></th></tr></thead><tbody>${arr
    .map((l) => {
      const c = customers[l.customer_id] || {};
      return `<tr><td>${fmtDate(l.lead_at)}</td><td><b>${esc(c.name || "-")}</b></td><td>${esc(c.phone || "-")}</td><td>${esc(sourceLabel(l))}</td><td>${esc(l.campaign_name || "-")}</td><td><span class="tag s-${l.status}">${esc(statusName[l.status] || l.status)}</span></td><td>${fmtDate(l.next_follow_up_at)}</td><td class="note-cell">${esc(l.notes || "-")}</td><td><button class="btn btn-secondary btn-sm" onclick="startEditFromAnywhere('${l.id}')">Edit</button></td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function editorRow(l = null, isNew = false) {
  const id = l?.id || "new";
  const c = l ? customers[l.customer_id] || {} : {};
  const ch = l?.channel || "instagram_lama",
    entry = l?.entry_type || "dm_organic",
    status = l?.status || "new";
  return `<tr class="${isNew ? "new-row" : "edit-row"}" id="row-${id}"><td>${isNew ? "Sekarang" : fmtDate(l.lead_at)}</td><td><input id="${id}-name" class="inline-input name-input" value="${esc(c.name || "")}" placeholder="Nama"/></td><td><input id="${id}-phone" class="inline-input phone-input" value="${esc(c.phone || "")}" placeholder="08..."/></td><td><select id="${id}-channel" class="inline-select" onchange="inlineChannelChanged('${id}')">${channelOptions(ch)}</select></td><td><select id="${id}-entry" class="inline-select">${entryOptions(ch, entry)}</select></td><td><input id="${id}-campaign" class="inline-input campaign-input" value="${esc(l?.campaign_name || "")}" placeholder="Campaign"/></td><td><select id="${id}-status" class="inline-select" onchange="inlineStatusChanged('${id}')">${statusOptions(status)}</select></td><td><input id="${id}-follow" class="inline-input follow-input" type="datetime-local" value="${localDateTimeValue(l?.next_follow_up_at)}"/></td><td><input id="${id}-notes" class="inline-input notes-input" value="${esc(l?.notes || "")}" placeholder="Catatan"/></td><td><div class="action-cell"><button class="btn btn-primary btn-sm" onclick="saveInlineLead('${id}',${isNew})">Simpan</button><button class="btn btn-secondary btn-sm" onclick="cancelInline()">Batal</button></div></td></tr><tr class="editor-extra" id="${id}-extra"><td colspan="10"><div class="extra-grid"><div class="field ${status === "lost" ? "" : "hidden"}" id="${id}-lost-wrap"><label>Alasan Tidak Deal *</label><select id="${id}-lost" class="inline-select">${reasonOptions(l?.lost_reason || "")}</select></div><div class="field ${status === "lost" ? "" : "hidden"}" id="${id}-lostnote-wrap"><label>Catatan Alasan</label><input id="${id}-lostnote" class="inline-input" value="${esc(l?.lost_note || "")}"/></div><div class="field ${status === "deal" ? "" : "hidden"}" id="${id}-deal-wrap"><label>Nilai Deal (opsional)</label><input id="${id}-deal" class="inline-input" type="number" min="0" step="1000" value="${l?.deal_value || ""}" placeholder="Rp"/></div></div></td></tr>`;
}
function leadManagementTable(arr) {
  let body = "";
  if (addingNew) body += editorRow(null, true);
  for (const l of arr) {
    if (editId === l.id) body += editorRow(l, false);
    else {
      const c = customers[l.customer_id] || {};
      body += `<tr><td>${fmtDate(l.lead_at)}</td><td><b>${esc(c.name || "-")}</b></td><td>${esc(c.phone || "-")}</td><td>${esc(chName[l.channel] || l.channel)}</td><td>${esc(entryName[l.entry_type] || l.entry_type)}</td><td>${esc(l.campaign_name || "-")}</td><td><span class="tag s-${l.status}">${esc(statusName[l.status] || l.status)}</span>${l.status === "lost" && l.lost_reason ? `<br><span class="muted">${esc(reasonName[l.lost_reason])}</span>` : ""}${l.status === "deal" && l.deal_value ? `<br><span class="muted">${fmtRp(l.deal_value)}</span>` : ""}</td><td>${fmtDate(l.next_follow_up_at)}</td><td class="note-cell">${esc(l.notes || "-")}</td><td><button class="btn btn-secondary btn-sm" onclick="startEdit('${l.id}')">Edit</button></td></tr>`;
    }
  }
  return `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Nama</th><th>WhatsApp</th><th>Channel</th><th>Cara Masuk</th><th>Campaign</th><th>Status</th><th>Follow Up</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${body || '<tr><td colspan="10" class="empty">Belum ada lead.</td></tr>'}</tbody></table></div>`;
}
function renderLeadLists() {
  let q = $("searchLead").value?.toLowerCase() || "",
    st = $("filterStatus").value,
    src = $("filterSource").value;
  let arr = leads.filter((l) => {
    let c = customers[l.customer_id] || {};
    return (
      (!q || `${c.name || ""} ${c.phone || ""}`.toLowerCase().includes(q)) &&
      (!st || l.status === st) &&
      (!src || l.channel === src)
    );
  });
  $("allLeads").innerHTML = leadManagementTable(arr);
  let fu = leads
    .filter(
      (l) =>
        ["new", "replied", "follow_up"].includes(l.status) &&
        l.next_follow_up_at,
    )
    .sort(
      (a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at),
    );
  $("followupLeads").innerHTML = readTable(fu);
}
function inlineChannelChanged(id) {
  const ch = $(`${id}-channel`).value;
  $(`${id}-entry`).innerHTML = entryOptions(ch, null);
}
function inlineStatusChanged(id) {
  const s = $(`${id}-status`).value;
  $(`${id}-lost-wrap`).classList.toggle("hidden", s !== "lost");
  $(`${id}-lostnote-wrap`).classList.toggle("hidden", s !== "lost");
  $(`${id}-deal-wrap`).classList.toggle("hidden", s !== "deal");
}
function startEdit(id) {
  editId = id;
  addingNew = false;
  renderLeadLists();
  setTimeout(() => $(`${id}-name`)?.focus(), 50);
}
function startEditFromAnywhere(id) {
  switchSection("leads");
  editId = id;
  addingNew = false;
  renderLeadLists();
  setTimeout(() => $(`${id}-name`)?.focus(), 50);
}
function startNew() {
  switchSection("leads");
  editId = null;
  addingNew = true;
  renderLeadLists();
  setTimeout(() => $("new-name")?.focus(), 50);
}
function cancelInline() {
  editId = null;
  addingNew = false;
  renderLeadLists();
}
async function getOrCreateCustomer(name, phone, currentCustomerId = null) {
  const norm = normalizePhone(phone);
  if (norm) {
    let { data: exist, error } = await db
      .from("leads_customers")
      .select("*")
      .eq("phone_normalized", norm)
      .maybeSingle();
    if (error) return { error };
    if (exist) {
      const { error: uerr } = await db
        .from("leads_customers")
        .update({ name, phone })
        .eq("id", exist.id);
      return { customerId: exist.id, error: uerr };
    }
  }
  if (currentCustomerId) {
    const { error } = await db
      .from("leads_customers")
      .update({ name, phone: phone || null, phone_normalized: norm })
      .eq("id", currentCustomerId);
    return { customerId: currentCustomerId, error };
  }
  const { data: newc, error } = await db
    .from("leads_customers")
    .insert({ name, phone: phone || null, phone_normalized: norm })
    .select()
    .single();
  return { customerId: newc?.id, error };
}
async function saveInlineLead(id, isNew) {
  const name = $(`${id}-name`).value.trim(),
    phone = $(`${id}-phone`).value.trim(),
    channel = $(`${id}-channel`).value,
    entry = $(`${id}-entry`).value,
    status = $(`${id}-status`).value,
    follow = $(`${id}-follow`).value,
    campaign = $(`${id}-campaign`).value.trim(),
    notes = $(`${id}-notes`).value.trim();
  if (!name) {
    alert("Nama customer wajib diisi.");
    $(`${id}-name`).focus();
    return;
  }
  const old = isNew ? null : leads.find((x) => x.id === id);
  if (status === "lost" && !$(`${id}-lost`).value) {
    alert("Pilih alasan tidak deal.");
    return;
  }
  const cust = await getOrCreateCustomer(name, phone, old?.customer_id || null);
  if (cust.error) {
    alert(cust.error.message);
    return;
  }
  const payload = {
    customer_id: cust.customerId,
    channel,
    entry_type: entry,
    destination_number: destinationFor(channel),
    status,
    lost_reason: status === "lost" ? $(`${id}-lost`).value : null,
    lost_note:
      status === "lost" ? $(`${id}-lostnote`).value.trim() || null : null,
    notes: notes || null,
    next_follow_up_at: follow ? new Date(follow).toISOString() : null,
    campaign_name: campaign || null,
    deal_at:
      status === "deal" ? old?.deal_at || new Date().toISOString() : null,
    deal_value:
      status === "deal" && $(`${id}-deal`).value
        ? Number($(`${id}-deal`).value)
        : null,
    updated_by: session.user.id,
  };
  if (isNew) {
    payload.created_by = session.user.id;
    payload.service_name = null;
    payload.assigned_to = null;
    payload.party_size = 1;
    payload.planned_visit_date = null;
    const { data: n, error } = await db
      .from("leads_inquiries")
      .insert(payload)
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    await db.from("leads_activities").insert({
      lead_id: n.id,
      activity_type: "created",
      actor_id: session.user.id,
      note: "Lead dibuat dari tabel",
    });
  } else {
    const { error } = await db
      .from("leads_inquiries")
      .update(payload)
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    if (old?.status !== status)
      await db.from("leads_activities").insert({
        lead_id: id,
        activity_type: "status_change",
        from_status: old.status,
        to_status: status,
        actor_id: session.user.id,
        note: "Status diperbarui dari tabel",
      });
  }
  editId = null;
  addingNew = false;
  await loadData();
}
