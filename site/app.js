(() => {
  const DATA = window.ANIMASH;
  const ARENA = ["Vitality", "Attack", "Defense", "Accuracy", "Dodge", "Luck"];
  const VARIANTS = {
    normal: { label: "ปกติ", stars: 0, mult: 1 },
    gold: { label: "ทอง", stars: 3, mult: 1.5 },
    diamond: { label: "เพชร", stars: 5, mult: 2 },
    rainbow: { label: "รุ้ง", stars: 7, mult: 3 },
  };
  const RARITIES = [["Common", 3], ["Unique", 4], ["Rare", 5], ["Ultra Rare", 6], ["Legendary", 7], ["Mythical", 8],
    ["Divine", 9], ["Supreme", 10], ["Alpha Supreme", 11], ["Gamma Supreme", 12], ["Zeta Supreme", 13],
    ["Theta Supreme", 14], ["Kappa Supreme", 15]];
  const PAGE = 96;
  const MAX_POWER = 60;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`;
  window.PAW = icon("paw", "ic noimg");
  const thumb = (url, w) => url && url.includes("/revision/latest") ? url.replace("/revision/latest", `/revision/latest/scale-to-width-down/${w}`) : url;
  const img = (url, w, alt) => url
    ? `<img src="${esc(thumb(url, w))}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.outerHTML=window.PAW">`
    : window.PAW;

  const bases = new Map(DATA.bases.map((b) => [b.name, b]));
  const fusions = DATA.fusions.map((f) => ({
    ...f,
    power: ARENA.reduce((s, k) => s + (f.arena[k] || 0), 0),
    hasFull: !f.stub && Object.keys(f.arena).length === 6 && !!f.ability,
    haystack: [f.name, ...f.parents, f.ability?.name, ...f.moves.map((m) => m.name), ...f.ultra.map((m) => m.name),
      ...f.arenaSpecial.map((m) => m.name)].filter(Boolean).join(" ").toLowerCase(),
  }));
  const byName = new Map(fusions.map((f) => [f.name, f]));
  const byPair = new Map(fusions.map((f) => [[...f.parents].sort().join("|"), f]));
  const sets = new Map(DATA.sets.map((x) => [x.name, new Set(x.animals)]));
  const inSet = (f, pool) => pool.has(f.parents[0]) && pool.has(f.parents[1]);
  const permanent = new Set(DATA.permanent);

  const DEFAULTS = { set: "", q: "", starMin: 0, starMax: 99, type: "", sort: "name", fullOnly: false, parentA: "", parentB: "" };
  const state = { ...DEFAULTS, rarities: new Set(), variant: "normal" };
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
  $("#starMin").innerHTML = `<option value="0">ต่ำสุด</option>` + starOpts.map((n) => `<option value="${n}">${n} ดาว</option>`).join("");
  $("#starMax").innerHTML = `<option value="99">สูงสุด</option>` + starOpts.map((n) => `<option value="${n}">${n} ดาว</option>`).join("");
  $("#rarityChips").innerHTML = RARITIES.map(([r, n]) => `<button class="r${n}" data-r="${r}" aria-pressed="false">${r}</button>`).join("");
  $("#set").innerHTML += DATA.sets.map((x) => {
    const n = fusions.filter((f) => inSet(f, sets.get(x.name))).length;
    return `<option value="${esc(x.name)}">${esc(x.name)}${x.upcoming ? " (Upcoming)" : ""} · ${x.animals.length} ตัว · ${n} สูตร</option>`;
  }).join("");

  // ---------- filtering ----------
  function apply() {
    const q = state.q.trim().toLowerCase();
    const [a, b] = [state.parentA, state.parentB];
    const pool = state.set && sets.get(state.set);
    list = fusions.filter((f) => {
      if (pool && !inSet(f, pool)) return false;
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
    const V = VARIANTS[state.variant];
    $("#count").innerHTML = `พบ <b>${list.length.toLocaleString()}</b> จาก ${fusions.length.toLocaleString()} ตัว` +
      (state.variant !== "normal" ? ` · ร่าง${V.label} +${V.stars} ดาว, พลัง ×${V.mult}` : "");
    $("#grid").innerHTML = "";
    $("#empty").hidden = list.length > 0;
    shown = 0;
    more();
    renderMixer();
    renderSet();
    renderActive();
  }

  function card(f) {
    const s = starsOf(f);
    const V = VARIANTS[state.variant];
    const foot = f.power
      ? `<div class="power"><span>พลัง</span><span class="meter"><i style="width:${Math.min(100, (f.power / MAX_POWER) * 100)}%"></i></span><b>${Math.round(f.power * V.mult)}</b></div>`
      : `<div class="stub-note">${f.stub ? "ยังไม่มีหน้าข้อมูลใน wiki" : "ยังไม่มีค่าพลัง Arena"}</div>`;
    return `<article class="card r${f.stars || 0} v-${state.variant}" tabindex="0" role="button" aria-label="${esc(f.name)}" data-name="${esc(f.name)}">
      <div class="pic">${img(f.image, 260, f.name)}${s ? `<span class="stars">${STAR}${s}</span>` : ""}</div>
      <div class="card-body">
        <h3>${esc(f.name)}</h3>
        <span class="pill">${esc(f.rarity || "ไม่ทราบระดับ")}${f.type === "Object" ? " · สิ่งของ" : ""}</span>
        <div class="parents">${f.parents.map((p) => `<button class="chip" data-parent="${esc(p)}" aria-label="ดูสูตรทั้งหมดของ ${esc(p)}">${esc(p)}</button>`).join("<span>+</span>")}</div>
        ${foot}
      </div>
    </article>`;
  }

  function more() {
    if (shown >= list.length) return;
    $("#grid").insertAdjacentHTML("beforeend", list.slice(shown, shown + PAGE).map(card).join(""));
    shown += PAGE;
  }
  new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: "900px" }).observe($("#sentinel"));

  // ---------- active filter chips ----------
  function renderActive() {
    const chips = [];
    const add = (label, clear) => chips.push([label, clear]);
    if (state.q) add(`ค้นหา: ${state.q}`, () => { state.q = ""; $("#q").value = ""; });
    if (state.set) add(state.set, () => { state.set = ""; $("#set").value = ""; });
    if (state.parentA) add(`ตัวที่ 1: ${state.parentA}`, () => setParent("parentA", ""));
    if (state.parentB) add(`ตัวที่ 2: ${state.parentB}`, () => setParent("parentB", ""));
    if (state.starMin || state.starMax < 99) add(`ดาว ${state.starMin || 1}–${state.starMax < 99 ? state.starMax : "22"}`, () => {
      state.starMin = 0; state.starMax = 99; $("#starMin").value = "0"; $("#starMax").value = "99";
    });
    for (const r of state.rarities) add(r, () => { state.rarities.delete(r); syncRarity(); });
    if (state.type) add(state.type === "Living" ? "สิ่งมีชีวิต" : "สิ่งของ", () => { state.type = ""; syncType(); });
    if (state.fullOnly) add("ข้อมูลครบ", () => { state.fullOnly = false; $("#fullOnly").checked = false; });
    activeClears = chips.map((c) => c[1]);
    $("#activeChips").innerHTML = chips.map(([label], i) => `<button data-active="${i}" aria-label="ลบตัวกรอง ${esc(label)}">${esc(label)}${icon("x")}</button>`).join("");
    const n = (state.set ? 1 : 0) + (state.starMin || state.starMax < 99 ? 1 : 0) + state.rarities.size + (state.type ? 1 : 0) + (state.fullOnly ? 1 : 0);
    $("#filterBadge").hidden = !n;
    $("#filterBadge").textContent = n;
  }
  let activeClears = [];
  const syncRarity = () => $$("[data-r]").forEach((b) => {
    const on = state.rarities.has(b.dataset.r);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
  const syncType = () => $$("[data-type]").forEach((b) => {
    const on = b.dataset.type === state.type;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  });

  // ---------- mixer + sets ----------
  function setSlot(id, name) {
    const slot = $(id === "parentA" ? "#slotA" : "#slotB");
    const b = bases.get(name);
    slot.classList.toggle("filled", !!name);
    slot.querySelector(".slot-img").innerHTML = name ? img(b?.image, 120, "") : "";
  }
  const setParent = (id, name) => {
    state[id] = name;
    $("#" + id).value = name;
    setSlot(id, name);
  };
  const mini = (f) => `<button class="mini r${f.stars || 0}" data-name="${esc(f.name)}"><span class="thumb">${img(f.image, 120, f.name)}</span>
    <span><b>${esc(f.name)}</b><small>${starsOf(f) ?? "?"} ดาว · ${esc(f.rarity || "ไม่ทราบระดับ")} · กดเพื่อดูรายละเอียด</small></span></button>`;

  function renderMixer() {
    const [a, b] = [state.parentA, state.parentB];
    const box = $("#mixResult");
    if (a && b) {
      const f = byPair.get([a, b].sort().join("|"));
      box.innerHTML = f ? mini(f) : `<span class="hint">ยังไม่พบข้อมูลการผสม ${esc(a)} + ${esc(b)} ใน wiki</span>`;
    } else if (a || b) {
      box.innerHTML = `<span class="hint"><b>${esc(a || b)}</b> ผสมได้ ${list.length} สูตร (แสดงด้านล่าง) เลือกอีกตัวเพื่อดูผลลัพธ์</span>`;
    } else {
      box.innerHTML = `<span class="hint">ผลการผสมจะแสดงที่นี่</span>`;
    }
  }

  function renderSet() {
    const pool = state.set && DATA.sets.find((x) => x.name === state.set);
    $("#setWrap").hidden = !pool;
    if (!pool) return;
    $("#setTitle").innerHTML = `สัตว์ใน ${esc(pool.name)}${pool.upcoming ? " (Upcoming)" : ""} <small>กดเพื่อใส่ในช่องผสม · ${icon("lock", "ic lock")} = ปลดล็อกถาวรได้</small>`;
    $("#setStrip").innerHTML = pool.animals.map((name) => {
      const b = bases.get(name);
      const on = name === state.parentA || name === state.parentB;
      return `<button data-pick="${esc(name)}" class="${on ? "on" : ""}" aria-pressed="${on}"><span class="av">${img(b?.image, 64, "")}</span>${esc(name)}${permanent.has(name) ? icon("lock", "ic lock") : ""}${b?.status === "Upcoming" ? " <small>(Upcoming)</small>" : ""}</button>`;
    }).join("");
  }

  // ---------- detail ----------
  function openDetail(name, variant = state.variant) {
    const f = byName.get(name);
    if (!f) return;
    const V = VARIANTS[variant];
    const s = starsOf(f, variant);
    const parentBtn = (p) => `<button class="p" data-parent="${esc(p)}"><span class="av">${img(bases.get(p)?.image, 140, p)}</span>${esc(p)}</button>`;
    const ab = (tag, cls, x) => `<div class="ab ${cls}"><span class="tag">${tag}</span><b>${esc(x.name)}</b>${x.desc ? `<p>${esc(x.desc)}</p>` : ""}</div>`;
    const abilities = [
      f.ability && ab("Special Ability", "t-special", f.ability),
      ...f.arenaSpecial.filter((x) => x.desc && x.desc !== f.ability?.desc).map((x) => ab("Arena Special", "t-arena", x)),
      ...f.ultra.map((x) => ab("Ultra Ability", "t-ultra", x)),
      ...f.moves.map((x) => ab("Arena Move", "t-move", x)),
    ].filter(Boolean).join("");
    const grades = Object.entries(f.grades);
    const starRow = f.stars ? STAR.repeat(f.stars) + STAR.replace("<svg", '<svg class="bonus"').repeat(V.stars) : "";
    $("#detailBody").innerHTML = `
      <button class="icon-btn d-close" aria-label="ปิด">${icon("x")}</button>
      <div class="d-wrap r${f.stars || 0}">
        <div class="d-side">
          <div class="v-${variant}"><div class="pic">${img(f.image, 480, f.name)}</div></div>
          <div class="v-tabs" role="radiogroup" aria-label="ร่างพิเศษ">${Object.entries(VARIANTS).map(([k, v]) =>
            `<button role="radio" aria-checked="${k === variant}" data-v="${k}" class="${k === variant ? "on" : ""}"><span class="dot dot-${k}"></span>${v.label}</button>`).join("")}</div>
          <div class="d-sec">
            <h4>วิธีได้มา (Fusion)</h4>
            <div class="recipe">${parentBtn(f.parents[0])}<span class="op">${icon("plus")}</span>${parentBtn(f.parents[1])}</div>
          </div>
          ${f.url ? `<a class="wiki-link" href="${esc(f.url)}" target="_blank" rel="noopener">เปิดหน้า wiki ${icon("ext")}</a>` : ""}
        </div>
        <div class="d-main">
          <div>
            <h2 class="d-title" id="dTitle">${esc(f.name)}${variant !== "normal" ? ` <small>ร่าง${V.label}</small>` : ""}</h2>
            <div class="d-meta">
              <span class="pill">${esc(f.rarity || "ไม่ทราบระดับ")}${f.type === "Object" ? " · สิ่งของ" : ""}</span>
              ${starRow ? `<span class="starrow" aria-label="${s} ดาว">${starRow}</span>` : ""}
              <span class="num">${s ?? "?"} ดาว</span>
              ${V.stars && f.stars ? `<span class="base">(ปกติ ${f.stars} + ${V.stars} จากร่าง${V.label})</span>` : ""}
            </div>
          </div>
          ${f.description ? `<p class="desc">${esc(f.description)}</p>` : ""}
          ${grades.length ? `<section class="d-sec"><h4>Status</h4><div class="grades">${grades.map(([k, v]) => `<div><b>${esc(v)}</b>${esc(k)}</div>`).join("")}</div></section>` : ""}
          ${f.power ? `<section class="d-sec"><h4>Arena Stats${V.mult > 1 ? ` · ×${V.mult}` : ""}</h4><div class="bars">${ARENA.map((k) => {
            const v = statOf(f, k, variant);
            return v == null ? "" : `<div class="bar"><span>${k}</span><span class="track"><span class="fill" style="width:${Math.min(100, (f.arena[k] / 10) * 100)}%"></span></span><span class="num">${v}</span></div>`;
          }).join("")}<div class="bar total"><span>รวม</span><span></span><span class="num">${Math.round(f.power * V.mult)}</span></div></div></section>` : ""}
          ${abilities ? `<section class="d-sec"><h4>Ability</h4><div class="abilities">${abilities}</div></section>` : ""}
          ${!f.power && !abilities ? `<div class="note">wiki ยังไม่มีข้อมูล status และ ability ของตัวนี้ มีเพียงสูตรการผสมและระดับดาว</div>` : ""}
          ${Object.keys(f.info).length ? `<section class="d-sec"><h4>ข้อมูลเพิ่มเติม</h4><div class="abilities">${Object.entries(f.info).map(([k, v]) => `<div class="ab t-info"><span class="tag">${esc(k)}</span><p>${esc(v)}</p></div>`).join("")}</div></section>` : ""}
        </div>
      </div>`;
    $("#detailBody").dataset.name = f.name;
    const dlg = $("#detail");
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  // ---------- events ----------
  const filterByParent = (p) => {
    setParent("parentA", p);
    setParent("parentB", "");
    if ($("#detail").open) $("#detail").close();
    apply();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const resetAll = () => {
    Object.assign(state, DEFAULTS);
    state.rarities.clear();
    for (const id of ["q", "set", "starMin", "starMax", "sort", "parentA", "parentB"]) $("#" + id).value = state[id];
    $("#fullOnly").checked = false;
    syncRarity(); syncType();
    setSlot("parentA", ""); setSlot("parentB", "");
    apply();
  };

  document.addEventListener("click", (e) => {
    const t = e.target;
    const chip = t.closest("[data-parent]");
    if (chip) { e.stopPropagation(); return filterByParent(chip.dataset.parent); }
    const act = t.closest("[data-active]");
    if (act) { activeClears[+act.dataset.active]?.(); return apply(); }
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
      $$("[data-variant]").forEach((b) => { b.classList.toggle("on", b === variant); b.setAttribute("aria-checked", b === variant); });
      return apply();
    }
    const r = t.closest("[data-r]");
    if (r) {
      state.rarities.has(r.dataset.r) ? state.rarities.delete(r.dataset.r) : state.rarities.add(r.dataset.r);
      syncRarity();
      return apply();
    }
    const ty = t.closest("[data-type]");
    if (ty) { state.type = ty.dataset.type; syncType(); return apply(); }
    const clr = t.closest("[data-clear]");
    if (clr) { setParent(clr.dataset.clear, ""); return apply(); }
    if (t.closest("#reset, [data-action=reset]")) return resetAll();
    if (t.closest("#filterToggle")) {
      const open = $("#filters").classList.toggle("open");
      $("#filterToggle").setAttribute("aria-expanded", open);
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card")) { e.preventDefault(); openDetail(e.target.dataset.name); }
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); }
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
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; apply(); });
  $("#fullOnly").addEventListener("change", (e) => { state.fullOnly = e.target.checked; apply(); });

  apply();
})();
