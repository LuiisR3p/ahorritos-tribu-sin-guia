(function () {
  const API = "https://eqxwlopoimdswtffiudj.supabase.co/rest/v1";
  const KEY = "sb_publishable_0ycEYaQH2fpLmqhknvWUww_CDbr4z5m";
  const LOCAL = "ahorritos-tsg-live";
  const HIKER = document.getElementById("hiker").getAttribute("href");
  const fmt = (n) => "$ " + Math.round(n).toLocaleString("es-CO");
  const parseMoney = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
  const newToken = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
          ).toString(16),
        );
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  // per-device memory: which traveller is selected and the undo tokens of abonos made here
  let local = { selected: null, tokens: {} };
  try {
    local = Object.assign(local, JSON.parse(localStorage.getItem(LOCAL)) || {});
  } catch (e) {}
  const saveLocal = () => {
    try {
      localStorage.setItem(LOCAL, JSON.stringify(local));
    } catch (e) {}
  };

  // admin key lives only for this browser tab
  let adminKey = null;
  try {
    adminKey = sessionStorage.getItem("ahorritos-admin");
  } catch (e) {}
  const setAdmin = (k) => {
    adminKey = k;
    try {
      k
        ? sessionStorage.setItem("ahorritos-admin", k)
        : sessionStorage.removeItem("ahorritos-admin");
    } catch (e) {}
  };
  const rpc = (fn, args) =>
    api("/rpc/" + fn, { method: "POST", body: JSON.stringify(args) });
  const badKey = (err) =>
    String(err && err.message).includes("clave_incorrecta");

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        apikey: KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    return res.status === 204 ? null : res.json();
  }

  let people = [],
    deposits = [],
    loaded = false;
  async function load() {
    try {
      const [p, d] = await Promise.all([
        api("/ahorro_viajeros?select=id,nombre,meta,creado&order=creado.asc"),
        api(
          "/ahorro_abonos?select=id,viajero_id,monto,nota,creado&order=creado.desc",
        ),
      ]);
      const changed =
        !loaded ||
        JSON.stringify([p, d]) !== JSON.stringify([people, deposits]);
      people = p;
      deposits = d;
      loaded = true;
      setStatus("");
      if (changed) render(!rendered);
    } catch (e) {
      setStatus(
        "No pudimos conectar con la alcancía. Revisa tu internet; reintentamos solos en unos segundos.",
      );
    }
  }
  function setStatus(t) {
    const el = $("status");
    el.hidden = !t;
    el.textContent = t;
  }

  const $ = (id) => document.getElementById(id);
  const trail = $("trail"),
    done = $("trailDone"),
    hiker = $("hiker"),
    scene = $("scene");
  const L = trail.getTotalLength();
  done.style.strokeDasharray = L;
  done.style.strokeDashoffset = L;

  [0.25, 0.5, 0.75].forEach((f, i) => {
    const p = trail.getPointAtLength(L * f);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = `<path d="M${p.x - 11} ${p.y} L${p.x} ${p.y - 16} L${p.x + 11} ${p.y}Z" fill="#f6ebd4" stroke="#012e29" stroke-width="1.5"/>
      <path d="M${p.x} ${p.y} L${p.x} ${p.y - 16}" stroke="#012e29" stroke-width="1.2"/>
      <text x="${p.x + 14}" y="${p.y + 4}" font-family="Jost, sans-serif" font-size="13" font-weight="600" fill="#f6ebd4">${Math.round(f * 100)}%</text>`;
    g.setAttribute("aria-label", "Campamento " + (i + 1));
    $("camps").appendChild(g);
  });

  const total = (pid) =>
    deposits
      .filter((d) => d.viajero_id === pid)
      .reduce((s, d) => s + d.monto, 0);
  const person = (pid) => people.find((p) => p.id === pid);
  const frac = (p) => (p ? Math.min(1, total(p.id) / (p.meta || 1)) : 0);

  let shown = 0,
    anim = null,
    rendered = false;
  function placeHiker(f) {
    const pt = trail.getPointAtLength(L * f);
    const ahead = trail.getPointAtLength(Math.min(L, L * f + 2));
    const behind = trail.getPointAtLength(Math.max(0, L * f - 2));
    const flip = ahead.x < behind.x;
    hiker.setAttribute("x", pt.x - 37);
    hiker.setAttribute("y", pt.y - 80);
    hiker.setAttribute(
      "transform",
      flip ? `translate(${2 * pt.x} 0) scale(-1 1)` : "",
    );
    done.style.strokeDashoffset = L * (1 - f);
    $("pct").textContent = Math.round(f * 100) + "%";
  }
  function walkTo(f, instant) {
    cancelAnimationFrame(anim);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduce || Math.abs(f - shown) < 0.001) {
      shown = f;
      placeHiker(f);
      scene.classList.remove("walking");
      return;
    }
    const from = shown,
      dur = Math.min(2200, 600 + Math.abs(f - from) * 3000),
      t0 = performance.now();
    scene.classList.add("walking");
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur),
        e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      shown = from + (f - from) * e;
      placeHiker(shown);
      if (t < 1) anim = requestAnimationFrame(step);
      else scene.classList.remove("walking");
    };
    anim = requestAnimationFrame(step);
  }

  function select(pid, instant) {
    local.selected = pid;
    saveLocal();
    render(instant);
  }

  function render(instant) {
    rendered = true;
    if (!person(local.selected)) local.selected = people[0] && people[0].id;
    const sel = person(local.selected);

    const chips = $("chips");
    chips.textContent = "";
    people.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = p.nombre;
      b.setAttribute("aria-pressed", String(p.id === local.selected));
      b.onclick = () => select(p.id, true);
      chips.appendChild(b);
    });
    if (adminKey) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "chip add";
      add.textContent = "+ Agregar viajero";
      add.onclick = openPerson;
      chips.appendChild(add);
    }
    $("adminBtn").textContent = adminKey
      ? "Salir del modo administrador"
      : "Entrar como administrador";
    $("adminTag").hidden = !adminKey;

    const t = sel ? total(sel.id) : 0,
      goal = sel ? sel.meta : 1000000,
      f = frac(sel);
    $("who").textContent = sel
      ? sel.nombre
      : loaded
        ? "La tribu está vacía"
        : "Cargando…";
    $("amt").textContent = fmt(t);
    $("of").textContent = "de " + fmt(goal);
    $("falta").textContent = sel
      ? t >= goal
        ? "Meta cumplida"
        : "Faltan " + fmt(goal - t)
      : "";
    $("goalLabel").textContent = fmt(goal);
    $("summit").hidden = f < 1;
    walkTo(f, instant);

    const s = $("abonoPersona");
    s.textContent = "";
    if (!people.length) s.add(new Option("Aún no hay viajeros", ""));
    people.forEach((p) =>
      s.add(new Option(p.nombre, p.id, false, p.id === local.selected)),
    );

    const tribe = $("tribe");
    tribe.textContent = "";
    if (loaded && !people.length)
      tribe.innerHTML = adminKey
        ? '<p class="empty">Todavía no hay viajeros. Toca "+ Agregar viajero" para sumar al primero.</p>'
        : '<p class="empty">El administrador todavía no ha agregado viajeros.</p>';
    people.forEach((p) => {
      const pf = frac(p),
        pt = total(p.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "member";
      card.setAttribute("aria-current", String(p.id === local.selected));
      card.innerHTML = `<div class="row"><span class="name"></span><span class="p num">${Math.round(pf * 100)}%</span></div>
        <div class="track"><i style="width:${pf * 100}%"></i><img src="${HIKER}" alt="" style="left:${Math.max(4, pf * 100)}%"></div>
        <small class="num">${fmt(pt)} de ${fmt(p.meta)}</small>`;
      card.querySelector(".name").textContent = p.nombre;
      card.onclick = () => {
        select(p.id, false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      tribe.appendChild(card);
    });

    $("histWho").textContent = sel ? sel.nombre : "—";
    const rm = $("removePerson");
    rm.hidden = !(adminKey && sel);
    rm.textContent = sel ? "Quitar a " + sel.nombre + " de la tribu" : "";
    rm.onclick = () => {
      rm.hidden = true;
      const c = $("removeConfirm");
      c.hidden = false;
      $("removeText").textContent =
        "Se borran " + sel.nombre + " y todos sus abonos. ¿Seguro?";
      $("removeNo").onclick = () => {
        c.hidden = true;
        render(true);
      };
      $("removeYes").onclick = async () => {
        try {
          await rpc("ahorro_admin_borrar_viajero", {
            p_clave: adminKey,
            p_id: sel.id,
          });
          c.hidden = true;
          await load();
        } catch (e) {
          if (badKey(e)) {
            setAdmin(null);
            render(true);
          }
          setStatus("No se pudo quitar al viajero. Intenta de nuevo.");
        }
      };
    };
    const hist = $("hist");
    hist.textContent = "";
    const list = sel ? deposits.filter((d) => d.viajero_id === sel.id) : [];
    if (!list.length)
      hist.innerHTML =
        '<li class="empty" style="display:block">Aún no hay abonos. El primero pone a caminar al viajero.</li>';
    list.forEach((d) => {
      const li = document.createElement("li");
      const mine = local.tokens[d.id];
      li.innerHTML = `<span class="date">${fmtDate(d.creado)}</span><span class="note"></span><span class="val num">+ ${fmt(d.monto)}</span><span class="act">${adminKey ? '<button class="del" type="button">Borrar</button>' : mine ? '<button class="del" type="button">Deshacer</button>' : ""}</span>`;
      li.querySelector(".note").textContent = d.nota || "Abono";
      if (mine || adminKey)
        li.querySelector(".del").onclick = () => {
          const act = li.querySelector(".act");
          act.innerHTML =
            '<span class="confirm"><button class="yes" type="button">Sí, borrar</button><button class="no" type="button">No</button></span>';
          act.querySelector(".no").onclick = () => render(true);
          act.querySelector(".yes").onclick = async () => {
            try {
              const ok = adminKey
                ? await rpc("ahorro_admin_borrar_abono", {
                    p_clave: adminKey,
                    p_id: d.id,
                  })
                : await rpc("ahorro_borrar_abono", {
                    p_id: d.id,
                    p_token: mine,
                  });
              delete local.tokens[d.id];
              saveLocal();
              if (!ok)
                setStatus("Ese abono ya no se puede deshacer desde aquí.");
              await load();
            } catch (e) {
              setStatus("No se pudo borrar. Intenta de nuevo en un momento.");
            }
          };
        };
      hist.appendChild(li);
    });
  }

  function moneyInput(el) {
    el.addEventListener("input", () => {
      const n = parseMoney(el.value);
      el.value = n ? n.toLocaleString("es-CO") : "";
    });
  }
  moneyInput($("abonoMonto"));
  moneyInput($("pMeta"));
  document.querySelectorAll("[data-q]").forEach(
    (b) =>
      (b.onclick = () => {
        $("abonoMonto").value = Number(b.dataset.q).toLocaleString("es-CO");
        $("abonoMonto").focus();
      }),
  );
  $("abonoPersona").onchange = (e) => {
    if (e.target.value) select(e.target.value, true);
  };

  let busy = false;
  $("abonoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const msg = $("abonoMsg"),
      amount = parseMoney($("abonoMonto").value),
      pid = $("abonoPersona").value;
    msg.className = "msg";
    if (!pid) {
      msg.className = "msg err";
      msg.textContent = "El administrador tiene que agregar viajeros primero.";
      return;
    }
    if (amount < 1000) {
      msg.className = "msg err";
      msg.textContent = "Escribe un monto de al menos $ 1.000.";
      return;
    }
    if (amount > 20000000) {
      msg.className = "msg err";
      msg.textContent = "El monto máximo por abono es $ 20.000.000.";
      return;
    }
    busy = true;
    msg.textContent = "Guardando…";
    const before = frac(person(pid)),
      token = newToken();
    try {
      const rows = await api("/ahorro_abonos?select=id", {
        method: "POST",
        body: JSON.stringify({
          viajero_id: pid,
          monto: amount,
          nota: $("abonoNota").value.trim() || null,
          token,
        }),
      });
      local.tokens[rows[0].id] = token;
      local.selected = pid;
      saveLocal();
      $("abonoMonto").value = "";
      $("abonoNota").value = "";
      await load();
      const after = frac(person(pid));
      const camps = [0.25, 0.5, 0.75, 1].filter(
        (c) => before < c && after >= c,
      );
      msg.textContent =
        after >= 1 && before < 1
          ? "¡Cima alcanzada! " + fmt(amount) + " abonados."
          : camps.length
            ? fmt(amount) +
              " abonados. ¡Llegaste al " +
              Math.round(camps[camps.length - 1] * 100) +
              "%!"
            : fmt(amount) + " abonados. El viajero avanzó.";
    } catch (err) {
      msg.className = "msg err";
      msg.textContent =
        "No se guardó el abono. Revisa tu conexión e intenta otra vez.";
    } finally {
      busy = false;
    }
  });

  const dlg = $("personDlg");
  function openPerson() {
    $("pNombre").value = "";
    $("pMeta").value = "1.000.000";
    $("pMsg").textContent = "";
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute("open", "");
    $("pNombre").focus();
  }
  $("pCancel").onclick = () => dlg.close();
  $("personForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("pNombre").value.trim(),
      goal = parseMoney($("pMeta").value);
    if (!name) {
      $("pMsg").textContent = "Escribe el nombre del viajero.";
      return;
    }
    if (people.some((p) => p.nombre.toLowerCase() === name.toLowerCase())) {
      $("pMsg").textContent =
        "Ya hay alguien con ese nombre en la tribu. Búscalo arriba o agrega tu apellido.";
      return;
    }
    if (goal < 10000) {
      $("pMsg").textContent = "La meta debe ser de al menos $ 10.000.";
      return;
    }
    try {
      const id = await rpc("ahorro_admin_agregar_viajero", {
        p_clave: adminKey,
        p_nombre: name,
        p_meta: goal,
      });
      local.selected = id;
      saveLocal();
      dlg.close();
      await load();
      render(true);
    } catch (err) {
      if (badKey(err)) {
        setAdmin(null);
        dlg.close();
        render(true);
        setStatus(
          "La clave de administrador ya no es válida. Vuelve a entrar.",
        );
      } else
        $("pMsg").textContent =
          "No se pudo guardar. Revisa tu conexión e intenta otra vez.";
    }
  });

  const adlg = $("adminDlg");
  $("adminBtn").onclick = () => {
    if (adminKey) {
      setAdmin(null);
      render(true);
      return;
    }
    $("aClave").value = "";
    $("aMsg").textContent = "";
    if (adlg.showModal) adlg.showModal();
    else adlg.setAttribute("open", "");
    $("aClave").focus();
  };
  $("aCancel").onclick = () => adlg.close();
  $("adminForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = $("aClave").value;
    if (!k) {
      $("aMsg").textContent = "Escribe la clave.";
      return;
    }
    $("aMsg").textContent = "Revisando…";
    try {
      if (await rpc("ahorro_es_admin", { p_clave: k })) {
        setAdmin(k);
        adlg.close();
        render(true);
      } else $("aMsg").textContent = "Clave incorrecta.";
    } catch (err) {
      $("aMsg").textContent =
        "No se pudo revisar la clave. Revisa tu conexión.";
    }
  });

  render(true);
  load();
  setInterval(() => {
    if (!document.hidden) load();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) load();
  });
})();
