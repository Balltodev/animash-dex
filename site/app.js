(() => {
  const DATA = window.ANIMASH;
  const ARENA = ["Vitality", "Attack", "Defense", "Accuracy", "Dodge", "Luck"];
  const VARIANTS = {
    normal: { label: "ปกติ", stars: 0, mult: 1 },
    gold: { label: "🟡 ทอง", stars: 3, mult: 1.5 },
    diamond: { label: "💎 เพชร", stars: 5, mult: 2 },
    rainbow: { label: "🌈 รุ้ง", stars: 7, mult: 3 },
  };
  const RARITIES = ["Common", "Unique", "Rare", "Ultra Rare", "Legendary", "Mythical", "Divine", "Supreme",
    "Alpha Supreme", "Gamma Supreme", "Zeta Supreme", "Theta Supreme", "Kappa Supreme"];
  const PAGE = 96;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const thumb = (url, w) => url && url.includes("/revision/latest") ? url.replace("/revision/latest", `/revision/latest/scale-to-width-down/${w}`) : url;
  const img = (url, w, alt) => url
    ? `<img src="${esc(thumb(url, w))}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'noimg',textContent:'🐾'}))">`
    : `<span class="noimg">🐾</span>`;

  const bases = new Map(DATA.bases.map((b) => [b.name, b]));
  const fusions = DATA.fusions.map((f) => ({
    ...f,
    power: ARENA.reduce((s, k) => s + (f.arena[k] || 0), 0),
    hasFull: !f.stub && Object.keys(f.arena).length === 6 && !!f.ability,
    haystack: [f.name, ...f.parents, f.ability?.name, ...f.moves.map((m) => m.name), ...f.ultra.map((m) => m.name),
      ...f.arenaSpecial.map((m) => m.name)].filter(Boolean).join(" ").toLowerCase(),
  }));
  const byPair = new Map(fusions.map((f) => [[...f.parents].sort().join("|"), f]));

  const sets = new Map(DATA.sets.map((x) => [x.name, new Set(x.animals)]));
  const inSet = (f, pool) => pool.has(f.parents[0]) && pool.has(f.parents[1]);
  const permanent = new Set(DATA.permanent);

  const state = { set: "", q: "", starMin: 0, starMax: 99, type: "", sort: "name", fullOnly: false, rarities: new Set(),
    parentA: "", parentB: "", variant: "normal" };
  let list = [], shown = 0;

  const starsOf = (f, v = state.variant) => (f.stars ? f.stars + VARIANTS[v].stars : null);
  const statOf = (f, k, v = state.variant) => (f.arena[k] != null ? +(f.arena[k] * VARIANTS[v].mult).toFixed(1) : null);
  const resolveBase = (s) => {
    s = s.trim().toLowerCase();
    if (!s) return "";
    for (const name of bases.keys()) if (name.toLowerCase() === s) return name;
    return null;
  };

  // ---------- setup ----------
  $("#src").href = DATA.source;
  $("#baseList").innerHTML = DATA.bases.map((b) => `<option value="${esc(b.name)}">${esc(b.class)}${b.status === "Upcoming" ? " · Upcoming" : ""}</option>`).join("");
  const starOpts = Array.from({ length: 22 }, (_, i) => i + 1);
  $("#starMin").innerHTML = `<option value="0">ต่ำสุด</option>` + starOpts.map((n) => `<option>${n}</option>`).join("");
  $("#starMax").innerHTML = `<option value="99">สูงสุด</option>` + starOpts.map((n) => `<option>${n}</option>`).join("");
  $("#set").innerHTML += DATA.sets.map((x) => {
    const n = fusions.filter((f) => inSet(f, sets.get(x.name))).length;
    return `<option value="${esc(x.name)}">${esc(x.name)}${x.upcoming ? " (Upcoming)" : ""} · ${x.animals.length} ตัว · ผสมได้ ${n} แบบ</option>`;
  }).join("");
  $("#rarityChips").innerHTML = RARITIES.map((r) => `<button data-r="${r}">${r}</button>`).join("");

  // ---------- filtering ----------
  function apply() {
    const q = state.q.trim().toLowerCase();
    const [a, b] = [state.parentA, state.parentB];
    list = fusions.filter((f) => {
      if (state.set && !inSet(f, sets.get(state.set))) return false;
      if (q && !f.haystack.includes(q)) return false;
      if (state.type && f.type !== state.type) return false;
      if (state.fullOnly && !f.hasFull) return false;
      if (state.rarities.size && !state.rarities.has(f.rarity)) return false;
      const s = starsOf(f);
      if ((state.starMin || state.starMax < 99) && (s == null || s < state.starMin || s > state.starMax)) return false;
      if (a && b) {
        if (a === b) { if (f.parents[0] !== a || f.parents[1] !== a) return false; }
        else if (!(f.parents.includes(a) && f.parents.includes(b))) return false;
      } else if (a || b) {
        if (!f.parents.includes(a || b)) return false;
      }
      return true;
    });
    const key = state.sort.replace("-", "");
    const dir = state.sort.startsWith("-") ? -1 : 1;
    const val = (f) => key === "name" ? f.name.toLowerCase() : key === "stars" ? f.stars : key === "power" ? (f.power || null) : f.arena[key];
    list.sort((x, y) => {
      const vx = val(x), vy = val(y);
      if (vx == null && vy != null) return 1;
      if (vy == null && vx != null) return -1;
      if (vx !== vy) return (vx > vy ? 1 : -1) * dir;
      return x.name.localeCompare(y.name);
    });
    $("#count").textContent = `พบ ${list.length.toLocaleString()} จาก ${fusions.length.toLocaleString()} ตัว` +
      (state.variant !== "normal" ? ` · แสดงแบบ ${VARIANTS[state.variant].label} (+${VARIANTS[state.variant].stars}★, พลัง Arena ×${VARIANTS[state.variant].mult})` : "");
    $("#grid").innerHTML = "";
    shown = 0;
    more();
    renderMixer();
    renderSet();
  }

  function card(f) {
    const s = starsOf(f);
    const pw = f.power ? Math.round(f.power * VARIANTS[state.variant].mult) : null;
    return `<article class="card r${f.stars || 0} v-${state.variant}" tabindex="0" data-name="${esc(f.name)}">
      <div class="pic">${img(f.image, 240, f.name)}${s ? `<span class="stars"><i>★</i> ${s}</span>` : ""}</div>
      <h3>${esc(f.name)}</h3>
      <div class="rar">${esc(f.rarity || "ไม่ทราบระดับ")}${f.type === "Object" ? " · สิ่งของ" : ""}</div>
      <div class="parents">${f.parents.map((p) => `<button class="chip" data-parent="${esc(p)}">${esc(p)}</button>`).join("<span>+</span>")}</div>
      <div class="pw">${pw ? `พลัง Arena <b>${pw}</b>` : f.stub ? "ยังไม่มีหน้าข้อมูลใน wiki" : ""}</div>
    </article>`;
  }

  function more() {
    if (shown >= list.length) return;
    $("#grid").insertAdjacentHTML("beforeend", list.slice(shown, shown + PAGE).map(card).join(""));
    shown += PAGE;
  }
  new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: "800px" }).observe($("#sentinel"));

  // ---------- mixer ----------
  function setSlot(id, name) {
    const slot = $(id === "parentA" ? "#slotA .slot-img" : "#slotB .slot-img");
    const b = bases.get(name);
    slot.style.backgroundImage = b?.image ? `url("${thumb(b.image, 96)}")` : "";
    slot.textContent = name && !b?.image ? "🐾" : "";
  }
  function renderMixer() {
    const [a, b] = [state.parentA, state.parentB];
    const box = $("#mixResult");
    if (a && b) {
      const f = byPair.get([a, b].sort().join("|"));
      box.innerHTML = f ? mini(f) : `<span class="hint">ยังไม่พบข้อมูลการผสม ${esc(a)} + ${esc(b)} ใน wiki</span>`;
    } else if (a || b) {
      box.innerHTML = `<span class="hint">${esc(a || b)} ผสมได้ ${list.length} แบบ (แสดงด้านล่าง) — เลือกอีกตัวเพื่อดูผลลัพธ์เดียว</span>`;
    } else {
      box.innerHTML = `<span class="hint">เลือกสัตว์ 1 หรือ 2 ตัว เพื่อดูผลการผสม</span>`;
    }
  }
  const mini = (f) => `<button class="mini" data-name="${esc(f.name)}">${img(f.image, 96, f.name)}<span><b>${esc(f.name)}</b>★ ${starsOf(f) ?? "?"} · ${esc(f.rarity || "")}</span></button>`;

  function renderSet() {
    const strip = $("#setStrip");
    const pool = state.set && DATA.sets.find((x) => x.name === state.set);
    strip.hidden = !pool;
    if (!pool) return;
    strip.innerHTML = pool.animals.map((name) => {
      const b = bases.get(name);
      const on = name === state.parentA || name === state.parentB;
      return `<button data-pick="${esc(name)}" class="${on ? "on" : ""} ${permanent.has(name) ? "perm" : ""}" title="${permanent.has(name) ? "ปลดล็อกถาวรได้ (Rewards)" : esc(b?.class || "")}">${img(b?.image, 64, name)}${esc(name)}${b?.status === "Upcoming" ? " <small>(Upcoming)</small>" : ""}</button>`;
    }).join("");
  }
  const setParent = (id, name) => {
    state[id] = name;
    $("#" + id).value = name;
    setSlot(id, name);
  };

  // ---------- detail ----------
  function openDetail(name, variant = state.variant) {
    const f = fusions.find((x) => x.name === name);
    if (!f) return;
    const s = starsOf(f, variant);
    const V = VARIANTS[variant];
    const parentBtn = (p) => {
      const b = bases.get(p);
      return `<button class="p" data-parent="${esc(p)}">${img(b?.image, 128, p)}${esc(p)}</button>`;
    };
    const ab = (tag, x) => `<div class="ab"><span class="tag">${tag}</span><b>${esc(x.name)}</b>${x.desc ? `<p>${esc(x.desc)}</p>` : ""}</div>`;
    const abilities = [
      f.ability && ab("Special Ability", f.ability),
      ...f.arenaSpecial.filter((x) => x.desc && x.desc !== f.ability?.desc).map((x) => ab("Arena Special", x)),
      ...f.ultra.map((x) => ab("Ultra Ability", x)),
      ...f.moves.map((x) => ab("Arena Move", x)),
    ].filter(Boolean).join("");
    const grades = Object.entries(f.grades);
    const maxStat = 10 * 3;
    $("#detailBody").innerHTML = `
      <button class="d-close" aria-label="ปิด">×</button>
      <div class="d-wrap">
        <div class="d-side">
          <div class="card v-${variant}" style="padding:0;box-shadow:none;background:none;cursor:default"><div class="pic">${img(f.image, 400, f.name)}</div></div>
          <div class="v-tabs">${Object.entries(VARIANTS).map(([k, v]) => `<button data-v="${k}" class="${k === variant ? "on" : ""}">${v.label}</button>`).join("")}</div>
          <div>
            <h4>วิธีได้มา (Fusion)</h4>
            <div class="recipe">${parentBtn(f.parents[0])}<span class="op">+</span>${parentBtn(f.parents[1])}</div>
          </div>
          ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">เปิดหน้า wiki ↗</a>` : ""}
        </div>
        <div class="d-main">
          <div>
            <h2 class="d-title">${esc(f.name)}${variant !== "normal" ? ` <small style="font-size:16px">(${esc(V.label)})</small>` : ""}</h2>
            <div class="starrow">${s ? "★".repeat(s) : "?"}<span class="dim">${s ?? "?"} ดาว · ${esc(f.rarity || "ไม่ทราบระดับ")}${V.stars ? ` (ปกติ ${f.stars}★ +${V.stars})` : ""}</span></div>
          </div>
          ${f.description ? `<p class="desc">${esc(f.description)}</p>` : ""}
          ${grades.length ? `<div><h4>Status</h4><div class="grades">${grades.map(([k, v]) => `<div><b>${esc(v)}</b>${esc(k)}</div>`).join("")}</div></div>` : ""}
          ${f.power ? `<div><h4>Arena Stats ${V.mult > 1 ? `(×${V.mult})` : ""}</h4><div class="bars">${ARENA.map((k) => {
            const v = statOf(f, k, variant);
            return v == null ? "" : `<div class="bar"><span>${k}</span><span class="track"><span class="fill" style="width:${Math.min(100, (v / maxStat) * 100)}%"></span></span><span class="num">${v}</span></div>`;
          }).join("")}<div class="bar"><span><b>รวม</b></span><span></span><span class="num">${Math.round(f.power * V.mult)}</span></div></div></div>` : ""}
          ${abilities ? `<div><h4>Ability</h4>${abilities}</div>` : ""}
          ${!f.power && !abilities ? `<div class="note">wiki ยังไม่มีข้อมูล status / ability ของตัวนี้ — มีเพียงสูตรการผสมและระดับดาว</div>` : ""}
          ${Object.keys(f.info).length ? `<div><h4>ข้อมูลเพิ่มเติม</h4>${Object.entries(f.info).map(([k, v]) => `<div class="ab"><span class="tag">${esc(k)}</span><p>${esc(v)}</p></div>`).join("")}</div>` : ""}
        </div>
      </div>`;
    $("#detailBody").dataset.name = f.name;
    const dlg = $("#detail");
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  // ---------- events ----------
  const filterByParent = (p) => {
    state.parentA = p; state.parentB = "";
    $("#parentA").value = p; $("#parentB").value = "";
    setSlot("parentA", p); setSlot("parentB", "");
    if ($("#detail").open) $("#detail").close();
    apply();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  document.addEventListener("click", (e) => {
    const t = e.target;
    const chip = t.closest("[data-parent]");
    if (chip) { e.stopPropagation(); return filterByParent(chip.dataset.parent); }
    const pick = t.closest("[data-pick]");
    if (pick) {
      const name = pick.dataset.pick;
      if (state.parentA === name && !state.parentB) setParent("parentA", "");
      else if (state.parentB === name) setParent("parentB", "");
      else if (!state.parentA) setParent("parentA", name);
      else if (!state.parentB) setParent("parentB", name);
      else { setParent("parentA", name); setParent("parentB", ""); }
      return apply();
    }
    const vt = t.closest("[data-v]");
    if (vt) return openDetail($("#detailBody").dataset.name, vt.dataset.v);
    if (t.closest(".d-close") || t === $("#detail")) return $("#detail").close();
    const c = t.closest("[data-name]");
    if (c && !t.closest("#detailBody")) return openDetail(c.dataset.name);
    const variant = t.closest("[data-variant]");
    if (variant) {
      state.variant = variant.dataset.variant;
      document.querySelectorAll("[data-variant]").forEach((b) => b.classList.toggle("on", b === variant));
      return apply();
    }
    const r = t.closest("[data-r]");
    if (r) {
      state.rarities.has(r.dataset.r) ? state.rarities.delete(r.dataset.r) : state.rarities.add(r.dataset.r);
      r.classList.toggle("on");
      return apply();
    }
    const clr = t.closest("[data-clear]");
    if (clr) {
      $("#" + clr.dataset.clear).value = "";
      state[clr.dataset.clear] = "";
      setSlot(clr.dataset.clear, "");
      return apply();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".card")) openDetail(e.target.dataset.name);
  });

  let timer;
  $("#q").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value; apply(); }, 150); });
  for (const id of ["parentA", "parentB"]) {
    $("#" + id).addEventListener("input", (e) => {
      const name = resolveBase(e.target.value);
      if (name === null) return;
      state[id] = name;
      setSlot(id, name);
      apply();
    });
  }
  $("#set").addEventListener("change", (e) => { state.set = e.target.value; apply(); });
  $("#starMin").addEventListener("change", (e) => { state.starMin = +e.target.value; apply(); });
  $("#starMax").addEventListener("change", (e) => { state.starMax = +e.target.value; apply(); });
  $("#type").addEventListener("change", (e) => { state.type = e.target.value; apply(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; apply(); });
  $("#fullOnly").addEventListener("change", (e) => { state.fullOnly = e.target.checked; apply(); });
  $("#reset").addEventListener("click", () => {
    Object.assign(state, { set: "", q: "", starMin: 0, starMax: 99, type: "", sort: "name", fullOnly: false, parentA: "", parentB: "" });
    state.rarities.clear();
    for (const [id, v] of [["set", ""], ["q", ""], ["starMin", "0"], ["starMax", "99"], ["type", ""], ["sort", "name"], ["parentA", ""], ["parentB", ""]]) $("#" + id).value = v;
    $("#fullOnly").checked = false;
    document.querySelectorAll("[data-r]").forEach((b) => b.classList.remove("on"));
    setSlot("parentA", ""); setSlot("parentB", "");
    apply();
  });

  apply();
})();
