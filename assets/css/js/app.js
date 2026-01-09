console.log("✅ app.js cargado");

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function on(sel, evt, handler) {
  const el = $(sel);
  if (!el) {
    console.warn(`⚠️ No existe el elemento: ${sel}`);
    return;
  }
  el.addEventListener(evt, handler);
}

function fmtInt(n){ return new Intl.NumberFormat("es-ES").format(n); }

function csvEscape(v){
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replaceAll('"','""')}"`;
  }
  return s;
}

function downloadText(filename, content, mime="text/plain"){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isoToday(){
  return new Date().toISOString().slice(0,10);
}

function monthKey(dateStr){
  // dateStr YYYY-MM-DD
  return (dateStr || "").slice(0,7); // YYYY-MM
}

function monthLabelFromKey(key){
  const [y,m] = key.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString("es-ES", { month:"long", year:"numeric" });
}

function rangeLabel(count){
  if (count <= 1) return "Bajo";
  if (count <= 4) return "Medio";
  return "Alto";
}

// ---------- Auth ----------
const AUTH_KEY = "bp_auth";
const ADMIN_USER = "admin";
const ADMIN_PASS = "12345";

function isAuthed(){
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

function setAuthed(v){
  sessionStorage.setItem(AUTH_KEY, v ? "1" : "0");
}

function showLogin(){
  $("#loginScreen")?.classList.remove("hidden");
  $("#appShell")?.classList.add("hidden");
}

function showApp(){
  $("#loginScreen")?.classList.add("hidden");
  $("#appShell")?.classList.remove("hidden");
}

// ---------- State ----------
const State = {
  get cocktails(){ return Storage.get("bp_cocktails", []); },
  set cocktails(v){ Storage.set("bp_cocktails", v); },

  get events(){ return Storage.get("bp_events", []); },
  set events(v){ Storage.set("bp_events", v); },

  get bottleSizes(){ return Storage.get("bp_bottle_sizes", {}); },
  set bottleSizes(v){ Storage.set("bp_bottle_sizes", v); },

  get selectedEventId(){ return Storage.get("bp_selected_event", null); },
  set selectedEventId(v){ Storage.set("bp_selected_event", v); },

  get feedbacks(){ return Storage.get("bp_feedbacks", []); },
  set feedbacks(v){ Storage.set("bp_feedbacks", v); },
};

// ---------- Navigation ----------
const views = ["dashboard","cocktails","events","planner","feedback","calendar","movements","personales"];
const viewMeta = {
  dashboard: { title:"Panel Principal", desc:"Resumen rápido de tu barra." },
  cocktails: { title:"Tragos", desc:"Crea recetas clásicas y de autor." },
  events: { title:"Eventos", desc:"Crea eventos y arma el menú con porcentajes." },
  planner: { title:"Plan del evento", desc:"Genera insumos, botellas y herramientas." },
  feedback: { title:"Opiniones", desc:"Respuestas y feedback del cliente por evento." },
  calendar: { title:"Calendario", desc:"Fechas con eventos y acceso rápido." },
  movements: { title:"Movimientos", desc:"Estadísticas: sube/baja, rangos y mes con más eventos." },
  personales: { title:"Personales", desc:"Gestión de personal (próximamente)." },
};

function showView(name){
  if (!viewMeta[name]) return;

  for (const v of views){
    const el = $(`#view-${v}`);
    if (el) el.classList.toggle("hidden", v !== name);
  }

  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));

  $("#viewTitle").textContent = viewMeta[name].title;
  $("#viewDesc").textContent = viewMeta[name].desc;

  if (name === "dashboard") renderDashboard();
  if (name === "cocktails") renderCocktails();
  if (name === "events") renderEvents();
  if (name === "planner") renderPlannerSelect();
  if (name === "feedback") renderFeedback();
  if (name === "calendar") renderCalendar();
  if (name === "movements") renderMovements();
}

// ---------- Dashboard ----------
function renderDashboard(){
  $("#statCocktails").textContent = fmtInt(State.cocktails.length);
  $("#statEvents").textContent = fmtInt(State.events.length);

  const sel = State.events.find(e => e.id === State.selectedEventId);
  $("#statLastPlan").textContent = sel ? sel.name : "—";
}

// ---------- Cocktails ----------
let editingCocktailId = null;

function renderCocktails(){
  const tbody = $("#cocktailsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  for (const c of State.cocktails){
    const tr = document.createElement("tr");
    const ingCount = c.recipe?.length ?? 0;
    tr.innerHTML = `
      <td><b>${c.name}</b></td>
      <td><span class="badge">${c.method}</span></td>
      <td class="muted">${ingCount} items</td>
      <td class="right">
        <div class="actions-cell">
          <button class="ghost" data-edit="${c.id}">Editar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openCocktailModal(btn.dataset.edit));
  });
}

function openCocktailModal(id=null){
  editingCocktailId = id;
  const isEdit = Boolean(id);
  const c = isEdit ? State.cocktails.find(x => x.id === id) : null;

  $("#cocktailModalTitle").textContent = isEdit ? "Editar trago" : "Nuevo trago";
  const delBtn = $("#btnDeleteCocktail");
  delBtn.style.visibility = isEdit ? "visible" : "hidden";

  $("#cocktailName").value = c?.name ?? "";
  $("#cocktailMethod").value = c?.method ?? "build";
  $("#cocktailRecipe").value = (c?.recipe ?? []).map(r => `${r.ingredient},${r.ml}`).join("\n");

  $("#cocktailModal").classList.remove("hidden");
}

function closeCocktailModal(){
  $("#cocktailModal").classList.add("hidden");
  editingCocktailId = null;
}

function parseRecipe(text){
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const line of lines){
    const [ingredientRaw, mlRaw] = line.split(",").map(s => s.trim());
    const ml = Number(mlRaw);
    if (!ingredientRaw || !Number.isFinite(ml) || ml <= 0) continue;
    out.push({ ingredient: ingredientRaw, ml });
  }
  return out;
}

on("#btnNewCocktail", "click", () => openCocktailModal());
on("#btnCloseCocktailModal", "click", closeCocktailModal);

on("#cocktailForm", "submit", (e) => {
  e.preventDefault();

  const name = $("#cocktailName").value.trim();
  const method = $("#cocktailMethod").value;
  const recipe = parseRecipe($("#cocktailRecipe").value);

  if (!name) return alert("Pon un nombre.");
  if (recipe.length === 0) return alert("Agrega al menos 1 ingrediente válido (Ingrediente,ml).");

  const cocktails = State.cocktails.slice();

  if (editingCocktailId){
    const idx = cocktails.findIndex(x => x.id === editingCocktailId);
    if (idx >= 0) cocktails[idx] = { ...cocktails[idx], name, method, recipe };
  } else {
    cocktails.unshift({ id: crypto.randomUUID(), name, method, recipe });
  }

  State.cocktails = cocktails;
  closeCocktailModal();
  renderCocktails();
  renderPlannerSelect();
  renderDashboard();
});

on("#btnDeleteCocktail", "click", () => {
  if (!editingCocktailId) return;
  if (!confirm("¿Eliminar este trago?")) return;

  const cocktails = State.cocktails.filter(c => c.id !== editingCocktailId);
  const events = State.events.map(ev => ({
    ...ev,
    menu: (ev.menu ?? []).filter(m => m.cocktailId !== editingCocktailId)
  }));

  State.cocktails = cocktails;
  State.events = events;

  closeCocktailModal();
  renderCocktails();
  renderEvents();
  renderPlannerSelect();
  renderDashboard();
});

// ---------- Events ----------
let editingEventId = null;

function normalizeEvent(ev){
  return {
    status: ev.status ?? "active",
    clientName: ev.clientName ?? "",
    eventType: ev.eventType ?? "Otro",
    createdAt: ev.createdAt ?? new Date().toISOString(),
    ...ev,
  };
}

function renderEvents(){
  const tbody = $("#eventsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filter = $("#eventsFilter")?.value ?? "all";
  let list = State.events.map(normalizeEvent);

  if (filter === "active"){
    list = list.filter(ev => (ev.status ?? "active") !== "completed");
  } else if (filter === "completed"){
    list = list.filter(ev => (ev.status ?? "active") === "completed");
  }

  for (const ev of list){
    const status = ev.status ?? "active";
    const statusLabel = status === "completed" ? "Terminado" : "Activo";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${ev.name}</b></td>
      <td class="muted">${ev.date}</td>
      <td>${ev.clientName ? `<b>${ev.clientName}</b>` : `<span class="muted">—</span>`}</td>
      <td><span class="badge">${ev.eventType || "Otro"}</span></td>
      <td><span class="badge">${ev.mode}</span></td>
      <td><span class="badge">${statusLabel}</span></td>
      <td class="right">${fmtInt(ev.totalDrinks)}</td>
      <td class="right">
        <div class="actions-cell">
          <button class="ghost" data-select="${ev.id}">Seleccionar</button>
          <button class="ghost" data-edit="${ev.id}">Editar</button>
          <button class="ghost" data-toggle="${ev.id}">${status === "completed" ? "Reabrir" : "Terminar"}</button>
          <button class="ghost danger" data-del="${ev.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEventModal(btn.dataset.edit));
  });

  tbody.querySelectorAll("[data-select]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.selectedEventId = btn.dataset.select;
      alert("Evento seleccionado para el plan.");
      renderDashboard();
      renderPlannerSelect();
      renderFeedback();
      renderCalendar();
      renderMovements();
    });
  });

  tbody.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      const events = State.events.slice();
      const idx = events.findIndex(e => e.id === id);
      if (idx < 0) return;

      const current = events[idx].status ?? "active";
      events[idx].status = (current === "completed") ? "active" : "completed";

      State.events = events;
      renderEvents();
      renderDashboard();
      renderPlannerSelect();
      renderFeedback();
      renderCalendar();
      renderMovements();
    });
  });

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.del;
      const ev = State.events.find(e => e.id === id);
      if (!ev) return;

      if (!confirm(`¿Eliminar el evento "${ev.name}"? Esto no se puede deshacer.`)) return;

      const events = State.events.filter(e => e.id !== id);
      State.events = events;

      State.feedbacks = State.feedbacks.filter(fb => fb.eventId !== id);

      if (State.selectedEventId === id){
        State.selectedEventId = events[0]?.id ?? null;
      }

      renderEvents();
      renderDashboard();
      renderPlannerSelect();
      renderFeedback();
      renderCalendar();
      renderMovements();
    });
  });
}

function makeMenuRow(menuItem){
  const row = document.createElement("div");
  row.className = "menu-row";

  const sel = document.createElement("select");
  sel.className = "menu-cocktail";
  for (const c of State.cocktails){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  }
  if (menuItem?.cocktailId) sel.value = menuItem.cocktailId;

  const pct = document.createElement("input");
  pct.type = "number";
  pct.min = "0";
  pct.max = "100";
  pct.value = menuItem?.percent ?? 0;
  pct.className = "menu-percent";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon danger";
  del.textContent = "🗑";
  del.addEventListener("click", () => row.remove());

  row.appendChild(sel);
  row.appendChild(pct);
  row.appendChild(del);

  return row;
}

function openEventModal(id=null){
  editingEventId = id;
  const isEdit = Boolean(id);
  const ev = isEdit ? normalizeEvent(State.events.find(x => x.id === id) || {}) : null;

  $("#eventModalTitle").textContent = isEdit ? "Editar evento" : "Nuevo evento";
  $("#btnDeleteEvent").style.visibility = isEdit ? "visible" : "hidden";

  $("#eventName").value = ev?.name ?? "";
  $("#eventClient").value = ev?.clientName ?? "";
  $("#eventType").value = ev?.eventType ?? "Otro";
  $("#eventDate").value = ev?.date ?? isoToday();
  $("#eventMode").value = ev?.mode ?? "by_drinks";
  $("#eventTotalDrinks").value = ev?.totalDrinks ?? 100;
  $("#eventWaste").value = ev?.wastePercent ?? 10;

  const menuWrap = $("#eventMenuRows");
  menuWrap.innerHTML = "";

  const menu = (ev?.menu?.length ? ev.menu : [{ cocktailId: State.cocktails[0]?.id, percent: 100 }]);
  for (const m of menu){
    menuWrap.appendChild(makeMenuRow(m));
  }

  $("#eventModal").classList.remove("hidden");
}

function closeEventModal(){
  $("#eventModal").classList.add("hidden");
  editingEventId = null;
}

on("#btnNewEvent", "click", () => openEventModal());
on("#btnQuickNewEvent", "click", () => { showView("events"); openEventModal(); });
on("#btnCloseEventModal", "click", closeEventModal);

on("#btnAddMenuRow", "click", () => {
  const wrap = $("#eventMenuRows");
  if (!wrap) return;
  if (State.cocktails.length === 0) return alert("Primero crea al menos 1 trago.");
  wrap.appendChild(makeMenuRow({ cocktailId: State.cocktails[0].id, percent: 0 }));
});

on("#eventForm", "submit", (e) => {
  e.preventDefault();

  const name = $("#eventName").value.trim();
  const clientName = $("#eventClient").value.trim();
  const eventType = $("#eventType").value;
  const date = $("#eventDate").value;
  const mode = $("#eventMode").value;
  const totalDrinks = Number($("#eventTotalDrinks").value);
  const wastePercent = Number($("#eventWaste").value);

  if (!name) return alert("Pon nombre del evento.");
  if (!date) return alert("Pon fecha.");
  if (!Number.isFinite(totalDrinks) || totalDrinks <= 0) return alert("Total de tragos inválido.");

  const rows = Array.from($("#eventMenuRows")?.querySelectorAll(".menu-row") ?? []);
  const menu = rows.map(r => ({
    cocktailId: r.querySelector(".menu-cocktail").value,
    percent: Number(r.querySelector(".menu-percent").value),
  })).filter(m => m.cocktailId && Number.isFinite(m.percent) && m.percent >= 0);

  const pctSum = menu.reduce((a,b)=>a+b.percent,0);
  if (menu.length === 0) return alert("Agrega al menos 1 trago al menú.");
  if (Math.round(pctSum) !== 100) return alert(`Los porcentajes deben sumar 100%. Ahora suman ${pctSum}%.`);

  const events = State.events.slice();

  if (editingEventId){
    const idx = events.findIndex(x => x.id === editingEventId);
    if (idx >= 0) {
      events[idx] = {
        ...normalizeEvent(events[idx]),
        name, clientName, eventType, date, mode, totalDrinks, wastePercent, menu,
      };
    }
  } else {
    const id = crypto.randomUUID();
    events.unshift({
      id,
      name,
      clientName,
      eventType,
      date,
      mode,
      totalDrinks,
      wastePercent,
      menu,
      status: "active",
      createdAt: new Date().toISOString()
    });
    State.selectedEventId = id;
  }

  State.events = events;
  closeEventModal();
  renderEvents();
  renderDashboard();
  renderPlannerSelect();
  renderFeedback();
  renderCalendar();
  renderMovements();
});

on("#btnDeleteEvent", "click", () => {
  if (!editingEventId) return;
  if (!confirm("¿Eliminar este evento?")) return;

  const id = editingEventId;

  const events = State.events.filter(ev => ev.id !== id);
  State.events = events;

  State.feedbacks = State.feedbacks.filter(fb => fb.eventId !== id);

  if (State.selectedEventId === id){
    State.selectedEventId = events[0]?.id ?? null;
  }

  closeEventModal();
  renderEvents();
  renderDashboard();
  renderPlannerSelect();
  renderFeedback();
  renderCalendar();
  renderMovements();
});

on("#eventsFilter", "change", () => renderEvents());

// ---------- Planner ----------
function calculatePlan(eventId){
  const ev = normalizeEvent(State.events.find(e => e.id === eventId) || {});
  if (!ev?.id) return null;

  const cocktailsMap = new Map(State.cocktails.map(c => [c.id, c]));
  const bottleSizes = State.bottleSizes;

  const totals = new Map();
  const methods = new Set();

  for (const item of (ev.menu ?? [])){
    const c = cocktailsMap.get(item.cocktailId);
    if (!c) continue;

    methods.add(c.method);

    const drinksForCocktail = ev.totalDrinks * (item.percent / 100);
    for (const r of (c.recipe ?? [])){
      const ml = drinksForCocktail * r.ml;
      totals.set(r.ingredient, (totals.get(r.ingredient) ?? 0) + ml);
    }
  }

  const wasteFactor = 1 + ((ev.wastePercent ?? 0) / 100);

  const rows = Array.from(totals.entries())
    .map(([ingredient, ml]) => {
      const withWaste = ml * wasteFactor;
      const bottleSize = Number(bottleSizes[ingredient]) || 750;
      const bottles = Math.ceil(withWaste / bottleSize);
      return { ingredient, ml: Math.round(ml), withWaste: Math.round(withWaste), bottleSize, bottles };
    })
    .sort((a,b) => b.withWaste - a.withWaste);

  const tools = toolsFromMethods(methods);
  return { event: ev, rows, tools };
}

function toolsFromMethods(methods){
  const tools = new Set([
    "Hielera / contenedor de hielo",
    "Pinzas",
    "Cuchillo + tabla",
    "Servilletas",
    "Abridor / destapador",
    "Cucharas de bar (barspoon)"
  ]);

  if (methods.has("build")) tools.add("Jigger/medidor");
  if (methods.has("shake")) { tools.add("Shaker"); tools.add("Strainer/colador"); tools.add("Jigger/medidor"); }
  if (methods.has("stir")) { tools.add("Vaso mezclador"); tools.add("Colador"); }
  if (methods.has("muddle")) { tools.add("Muddler/macera"); tools.add("Jigger/medidor"); }

  return Array.from(tools);
}

function renderPlannerSelect(){
  const sel = $("#plannerEventSelect");
  if (!sel) return;

  sel.innerHTML = "";

  const events = State.events.map(normalizeEvent);
  if (events.length === 0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay eventos todavía";
    sel.appendChild(opt);
    return;
  }

  for (const ev of events){
    const opt = document.createElement("option");
    opt.value = ev.id;
    opt.textContent = `${ev.name} (${ev.date})`;
    sel.appendChild(opt);
  }

  const current = State.selectedEventId ?? events[0].id;
  sel.value = current;
  State.selectedEventId = current;
}

function renderPlanTables(plan){
  const tbody = $("#planIngredientsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  for (const r of plan.rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${r.ingredient}</b> <span class="badge">${r.bottleSize}ml</span></td>
      <td class="right">${fmtInt(r.ml)}</td>
      <td class="right">${fmtInt(r.withWaste)}</td>
      <td class="right">${fmtInt(r.bottles)}</td>
    `;
    tbody.appendChild(tr);
  }

  const ul = $("#toolsList");
  if (ul){
    ul.innerHTML = "";
    for (const t of plan.tools){
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    }
  }

  renderDashboard();
}

on("#btnGeneratePlan", "click", () => {
  const eventId = $("#plannerEventSelect")?.value;
  if (!eventId) return alert("Selecciona un evento.");

  State.selectedEventId = eventId;
  const plan = calculatePlan(eventId);
  if (!plan) return alert("No se pudo generar el plan.");
  renderPlanTables(plan);
});

on("#btnPrint", "click", () => window.print());

on("#btnExportCsv", "click", () => {
  const eventId = $("#plannerEventSelect")?.value;
  const plan = eventId ? calculatePlan(eventId) : null;
  if (!plan) return alert("Primero genera el plan.");

  const lines = [];
  lines.push(["Ingrediente","Total_ml","Con_merma_ml","Botella_ml","Botellas_aprox"].map(csvEscape).join(","));
  for (const r of plan.rows){
    lines.push([r.ingredient, r.ml, r.withWaste, r.bottleSize, r.bottles].map(csvEscape).join(","));
  }
  downloadText("plan_evento.csv", lines.join("\n"), "text/csv");
});

// ---------- Reset demo ----------
on("#btnResetDemo", "click", () => {
  if (!confirm("Esto borra la data demo guardada en el navegador. ¿Seguro?")) return;
  Storage.clear();
  location.reload();
});

// ---------- Feedback ----------
function renderFeedback(){
  const sel = $("#feedbackEventSelect");
  if (!sel) return;

  sel.innerHTML = "";

  const events = State.events.map(normalizeEvent);
  if (events.length === 0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay eventos todavía";
    sel.appendChild(opt);
    return;
  }

  for (const ev of events){
    const opt = document.createElement("option");
    opt.value = ev.id;
    opt.textContent = `${ev.name} (${ev.date})`;
    sel.appendChild(opt);
  }

  const current = State.selectedEventId ?? events[0].id;
  sel.value = current;
  State.selectedEventId = current;

  renderFeedbackTable(current);
}

function renderFeedbackTable(eventId){
  const tbody = $("#feedbackTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rows = State.feedbacks
    .filter(fb => fb.eventId === eventId)
    .sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  for (const fb of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="muted">${(fb.createdAt ?? "").slice(0,10)}</td>
      <td>${fb.clientName ? `<b>${fb.clientName}</b>` : `<span class="muted">—</span>`}</td>
      <td class="right"><b>${fb.rating}</b></td>
      <td>${fb.comment}</td>
      <td class="right">
        <div class="actions-cell">
          <button class="ghost danger" data-del-fb="${fb.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-del-fb]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delFb;
      if (!confirm("¿Eliminar esta opinión?")) return;
      State.feedbacks = State.feedbacks.filter(x => x.id !== id);
      renderFeedbackTable(eventId);
    });
  });
}

on("#btnLoadFeedback", "click", () => {
  const eventId = $("#feedbackEventSelect")?.value;
  if (!eventId) return;
  State.selectedEventId = eventId;
  renderFeedbackTable(eventId);
});

on("#btnClearFeedbackForm", "click", () => {
  $("#fbClientName").value = "";
  $("#fbRating").value = 5;
  $("#fbComment").value = "";
});

on("#feedbackForm", "submit", (e) => {
  e.preventDefault();

  const eventId = $("#feedbackEventSelect")?.value || State.selectedEventId;
  if (!eventId) return alert("Selecciona un evento.");

  const clientName = $("#fbClientName")?.value?.trim() ?? "";
  const rating = Number($("#fbRating")?.value);
  const comment = $("#fbComment")?.value?.trim() ?? "";

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return alert("Rating inválido (1 a 5).");
  if (!comment) return alert("Escribe un comentario.");

  const feedbacks = State.feedbacks.slice();
  feedbacks.unshift({
    id: crypto.randomUUID(),
    eventId,
    clientName,
    rating,
    comment,
    createdAt: new Date().toISOString()
  });

  State.feedbacks = feedbacks;

  $("#fbClientName").value = "";
  $("#fbRating").value = 5;
  $("#fbComment").value = "";

  renderFeedbackTable(eventId);
});

// ---------- Calendar ----------
let calCursor = new Date(); // mes actual visible
let calSelected = isoToday();

function getEventsByDate(dateStr){
  return State.events.map(normalizeEvent).filter(e => e.date === dateStr);
}

function renderCalendar(){
  // label
  const label = calCursor.toLocaleDateString("es-ES", { month:"long", year:"numeric" });
  $("#calMonthLabel").textContent = label;

  const grid = $("#calendarGrid");
  if (!grid) return;

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();

  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const events = State.events.map(normalizeEvent);
  const eventDates = new Set(events.map(e => e.date));

  const weekday = ["L","M","X","J","V","S","D"];

  grid.innerHTML = "";
  // header
  const header = document.createElement("div");
  header.className = "cal-row cal-head";
  header.innerHTML = weekday.map(d => `<div class="cal-cell cal-week">${d}</div>`).join("");
  grid.appendChild(header);

  let day = 1;
  for (let r=0; r<6; r++){
    const row = document.createElement("div");
    row.className = "cal-row";
    for (let c=0; c<7; c++){
      const cell = document.createElement("div");
      cell.className = "cal-cell";
      const idx = r*7 + c;

      if (idx < startDay || day > daysInMonth){
        cell.classList.add("cal-empty");
        cell.innerHTML = `<div class="cal-num muted"> </div>`;
      } else {
        const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const hasEvents = eventDates.has(dateStr);
        const isSel = dateStr === calSelected;

        cell.classList.toggle("cal-selected", isSel);
        cell.innerHTML = `
          <div class="cal-num">${day}</div>
          ${hasEvents ? `<div class="cal-dot"></div>` : ``}
        `;

        cell.addEventListener("click", () => {
          calSelected = dateStr;
          renderCalendar();
        });

        day++;
      }

      row.appendChild(cell);
    }
    grid.appendChild(row);
    if (day > daysInMonth) break;
  }

  // right side: selected day events + month summary
  $("#calSelectedLabel").textContent = `Eventos del día: ${calSelected}`;
  renderCalDayTable(calSelected);
  renderCalMonthSummary(year, month);
}

function renderCalDayTable(dateStr){
  const tbody = $("#calEventsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const list = getEventsByDate(dateStr);
  if (list.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">No hay eventos en esta fecha.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const ev of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${ev.name}</b></td>
      <td>${ev.clientName ? `<b>${ev.clientName}</b>` : `<span class="muted">—</span>`}</td>
      <td><span class="badge">${ev.eventType || "Otro"}</span></td>
      <td class="right"><button class="ghost" data-go="${ev.id}">Ir</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.go;
      State.selectedEventId = id;
      showView("events");
      renderEvents();
      // (opcional) también podrías ir a planner directo:
      // showView("planner");
    });
  });
}

function renderCalMonthSummary(year, month){
  const tbody = $("#calMonthSummary tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const mStr = String(month+1).padStart(2,"0");
  const key = `${year}-${mStr}`;

  const list = State.events.map(normalizeEvent)
    .filter(e => monthKey(e.date) === key)
    .sort((a,b) => (a.date||"").localeCompare(b.date||""));

  if (list.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">No hay eventos en este mes.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const ev of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="muted">${ev.date}</td>
      <td>${ev.clientName ? `<b>${ev.clientName}</b>` : `<span class="muted">—</span>`}</td>
      <td><b>${ev.name}</b></td>
      <td><span class="badge">${ev.eventType || "Otro"}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

on("#btnCalPrev", "click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()-1, 1); renderCalendar(); });
on("#btnCalNext", "click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 1); renderCalendar(); });
on("#btnCalToday", "click", () => { calCursor = new Date(); calSelected = isoToday(); renderCalendar(); });

// ---------- Movements / Stats ----------
function renderMovements(){
  const now = new Date();
  const year = now.getFullYear();
  const thisKey = `${year}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const prevDate = new Date(year, now.getMonth()-1, 1);
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;

  const events = State.events.map(normalizeEvent);

  const thisCount = events.filter(e => monthKey(e.date) === thisKey).length;
  const prevCount = events.filter(e => monthKey(e.date) === prevKey).length;

  $("#statThisMonth").textContent = fmtInt(thisCount);
  $("#statPrevMonth").textContent = fmtInt(prevCount);

  const diff = thisCount - prevCount;
  const arrow = diff > 0 ? "⬆" : diff < 0 ? "⬇" : "→";
  $("#statChange").textContent = `${arrow} ${diff}`;

  // table by month (año actual)
  const months = Array.from({length:12}, (_,i)=>`${year}-${String(i+1).padStart(2,"0")}`);
  const counts = months.map(k => ({
    key: k,
    count: events.filter(e => monthKey(e.date) === k).length
  }));

  const best = counts.reduce((a,b)=> b.count>a.count?b:a, {key:months[0],count:0});
  $("#statBestMonth").textContent = monthLabelFromKey(best.key);
  $("#statBestMonthCount").textContent = `${best.count} eventos`;

  // fill stats month table
  const tbody = $("#statsByMonthTable tbody");
  tbody.innerHTML = "";
  for (const m of counts){
    const tr = document.createElement("tr");
    const isBest = m.key === best.key && best.count > 0;
    tr.innerHTML = `
      <td>${isBest ? `<b>${monthLabelFromKey(m.key)}</b>` : monthLabelFromKey(m.key)}</td>
      <td class="right">${fmtInt(m.count)}</td>
      <td class="right"><span class="badge">${rangeLabel(m.count)}</span></td>
    `;
    tbody.appendChild(tr);
  }

  // month selector
  const sel = $("#statsMonthSelect");
  sel.innerHTML = "";
  for (const m of months){
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = monthLabelFromKey(m);
    sel.appendChild(opt);
  }
  sel.value = thisKey;
  renderMonthEventsTable(thisKey);

  sel.onchange = () => renderMonthEventsTable(sel.value);
}

function renderMonthEventsTable(key){
  const tbody = $("#statsMonthEventsTable tbody");
  tbody.innerHTML = "";

  const list = State.events.map(normalizeEvent)
    .filter(e => monthKey(e.date) === key)
    .sort((a,b) => (a.date||"").localeCompare(b.date||""));

  if (list.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">No hay eventos en este mes.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const ev of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="muted">${ev.date}</td>
      <td>${ev.clientName ? `<b>${ev.clientName}</b>` : `<span class="muted">—</span>`}</td>
      <td><b>${ev.name}</b></td>
      <td><span class="badge">${ev.eventType || "Otro"}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

on("#btnRefreshStats", "click", () => renderMovements());

// ---------- Sidebar toggle ----------
(function setupSidebarToggle(){
  const btn = document.getElementById("btnToggleSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (!btn) return;

  function isMobile(){
    return window.matchMedia("(max-width: 720px)").matches;
  }
  function openMobileSidebar(){
    document.body.classList.add("sidebar-open");
    overlay?.classList.remove("hidden");
  }
  function closeMobileSidebar(){
    document.body.classList.remove("sidebar-open");
    overlay?.classList.add("hidden");
  }

  btn.addEventListener("click", () => {
    if (isMobile()){
      if (document.body.classList.contains("sidebar-open")) closeMobileSidebar();
      else openMobileSidebar();
    } else {
      document.body.classList.toggle("sidebar-hidden");
    }
  });

  overlay?.addEventListener("click", closeMobileSidebar);

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
    else {
      document.body.classList.remove("sidebar-hidden");
      closeMobileSidebar();
    }
  });

  if (isMobile()) closeMobileSidebar();
})();

// ---------- Wire nav ----------
function wireNav(){
  const navButtons = $$(".nav-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      showView(btn.dataset.view);

      if (window.matchMedia("(max-width: 720px)").matches) {
        document.body.classList.remove("sidebar-open");
        document.getElementById("sidebarOverlay")?.classList.add("hidden");
      }
    });
  });
}

// ---------- Login + Logout ----------
on("#loginForm","submit",(e)=>{
  e.preventDefault();
  const u = $("#loginUser").value.trim();
  const p = $("#loginPass").value.trim();
  const ok = (u === ADMIN_USER && p === ADMIN_PASS);

  const err = $("#loginError");
  if (!ok){
    err.style.display = "block";
    return;
  }
  err.style.display = "none";
  setAuthed(true);
  showApp();
  bootApp();
});

on("#btnLogout","click",()=>{
  setAuthed(false);
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
});

// ---------- Boot ----------
function bootApp(){
  wireNav();
  showView("dashboard");
  renderCocktails();
  renderEvents();
  renderPlannerSelect();
  renderFeedback();
  renderCalendar();
  renderMovements();
  renderDashboard();
}

// Init:
(function init(){
  // si ya está logueado
  if (isAuthed()){
    showApp();
    bootApp();
  } else {
    showLogin();
  }
})();
