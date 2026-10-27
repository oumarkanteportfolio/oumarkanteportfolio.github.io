(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Theme colors, re-read once per frame so canvases follow the theme toggle.
  let palette = {};
  function readPalette() {
    const cs = getComputedStyle(root);
    for (const k of ["bg", "bg-sunken", "ink", "muted", "faint", "line", "line-strong", "accent", "accent-ink", "room", "blood"])
      palette[k] = cs.getPropertyValue(`--${k}`).trim();
  }
  readPalette();

  // Seeded RNG so specimens look the same on every visit.
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  document.getElementById("year").textContent = new Date().getFullYear();

  // ── Atmosphere: battle-worn Dragonslayer (scratches + hilt wrap), parallax, embers.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const sword = document.querySelector(".dragonslayer");
  const eclipse = document.querySelector(".eclipse");
  {
    const rnd = mulberry32(1989);
    const scratches = sword.querySelector(".ds-scratches");
    for (let i = 0; i < 46; i++) {
      const x = 66 + rnd() * 108, y = 110 + rnd() * 950;
      const len = 8 + rnd() * 46, a = (-35 + rnd() * 70) * (Math.PI / 180);
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", `M${x} ${y} l${Math.cos(a) * len} ${Math.sin(a) * len}`);
      scratches.appendChild(p);
    }
    // A few fresh, blood-red cuts near the tip.
    for (let i = 0; i < 5; i++) {
      const x = 74 + rnd() * 90, y = 70 + rnd() * 260, len = 14 + rnd() * 34;
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("class", "blood");
      p.setAttribute("d", `M${x} ${y} q${len * 0.4} ${len * 0.15} ${len} ${len * 0.5}`);
      scratches.appendChild(p);
    }
    const wraps = sword.querySelector(".ds-wraps");
    for (let y = 1126; y < 1374; y += 13) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", `M104 ${y} L136 ${y + 9}`);
      wraps.appendChild(p);
    }
  }

  function parallax(scrollY) {
    sword.style.transform = `translateY(${-scrollY * 0.05}px) rotate(${16 - Math.min(scrollY, 3000) * 0.0008}deg)`;
    eclipse.style.transform = `translateY(${-scrollY * 0.6}px)`;
  }

  const emberCanvas = document.querySelector(".embers");
  const ectx = emberCanvas.getContext("2d");
  let embers = [];
  let emberSize = { w: 0, h: 0 };
  function spawnEmber(atBottom) {
    const { w, h } = emberSize;
    return {
      x: Math.random() * w,
      y: atBottom ? h + Math.random() * 40 : Math.random() * h,
      vy: 12 + Math.random() * 38,
      sway: 6 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      size: Math.random() < 0.8 ? 1.5 : 2.5,
      hot: Math.random() < 0.35,
      base: 0.35 + Math.random() * 0.5,
    };
  }
  function resizeEmbers() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    emberSize = { w: window.innerWidth, h: window.innerHeight };
    emberCanvas.width = emberSize.w * dpr;
    emberCanvas.height = emberSize.h * dpr;
    ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(70, Math.round(emberSize.w / 24));
    embers = Array.from({ length: count }, () => spawnEmber(false));
  }
  function drawEmbers(t, dt) {
    const { w, h } = emberSize;
    ectx.clearRect(0, 0, w, h);
    const dark = root.dataset.theme === "dark";
    ectx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const e of embers) {
      e.y -= e.vy * dt;
      const x = e.x + Math.sin(t * 0.8 + e.phase) * e.sway;
      if (e.y < -10) Object.assign(e, spawnEmber(true));
      // Fade in from the bottom, die out towards the top, flicker throughout.
      const life = clamp(e.y / h, 0, 1);
      const flicker = 0.6 + 0.4 * Math.sin(t * 9 + e.phase * 3);
      ectx.globalAlpha = e.base * flicker * Math.min(1, life * 1.6) * (dark ? 1 : 0.7);
      ectx.fillStyle = e.hot ? "#ff6a1f" : palette.blood;
      ectx.fillRect(x, e.y, e.size, e.size * (e.vy > 36 ? 2.2 : 1));
    }
    ectx.globalAlpha = 1;
    ectx.globalCompositeOperation = "source-over";
  }
  window.addEventListener("resize", resizeEmbers);
  resizeEmbers();

  // ── Intro: stagger the wordmark letters in, then reveal the rest of the hero.
  const letters = [...document.querySelectorAll(".wm-letter")];
  letters.forEach((el, i) => (el.style.transitionDelay = `${reduceMotion ? 0 : 80 + i * 55}ms`));
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-intro")));
  setTimeout(() => letters.forEach((el) => (el.style.transitionDelay = "")), 1600);

  // ── Theme toggle (tweens registered color properties, then cleans up).
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    setTimeout(() => root.classList.remove("theme-anim"), 450);
  });

  // ── Mobile menu.
  const menuBtn = document.getElementById("menu-toggle");
  const drawer = document.getElementById("nav-drawer");
  menuBtn.addEventListener("click", () => {
    const open = drawer.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  drawer.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      drawer.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    })
  );

  // ── Reveal on scroll (card contents, not cells, so hairlines never flash).
  const revealTargets = document.querySelectorAll(".section-intro, .grid > * > *, .timeline .row, .cta > *");
  revealTargets.forEach((el) => el.classList.add("reveal"));
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const cell = el.parentElement.closest(".grid > *") || el;
        const siblings = [...cell.parentElement.children];
        el.style.transitionDelay = `${Math.min(siblings.indexOf(cell), 6) * 70}ms`;
        el.classList.add("shown");
        revealObserver.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));

  // ── Slash: when a divider is well into view, a strike cuts it open, throws sparks, then seals.
  const SLASH_MS = 460;
  const SLASH_EASE = "cubic-bezier(.75, 0, .15, 1)";
  const span = (cls) => {
    const el = document.createElement("span");
    el.className = cls;
    return el;
  };

  function slash(section) {
    const w = section.clientWidth;
    const fx = document.createElement("div");
    fx.className = "slash-fx";
    fx.setAttribute("aria-hidden", "true");
    const trail = span("slash-trail");
    const up = span("slash-split");
    const down = span("slash-split");
    const blade = span("slash-blade");
    fx.append(trail, up, down, blade);
    section.appendChild(fx);

    blade.animate(
      [
        { transform: "translateX(-60px) rotate(62deg)", opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { transform: `translateX(${w + 60}px) rotate(62deg)`, opacity: 1 },
      ],
      { duration: SLASH_MS, easing: SLASH_EASE, fill: "forwards" }
    );
    trail.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: SLASH_MS, easing: SLASH_EASE, fill: "forwards" }
    ).finished.then(() => {
      // The cut splits apart, then seals back into the plain divider.
      trail.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: "ease-out", fill: "forwards" });
      [[up, -5], [down, 5]].forEach(([line, dy]) =>
        line.animate(
          [
            { transform: "translateY(0)", opacity: 0.9 },
            { transform: `translateY(${dy}px)`, opacity: 0.6, offset: 0.35 },
            { transform: "translateY(0)", opacity: 0 },
          ],
          { duration: 750, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" }
        )
      );
    });

    // Sparks thrown off the blade wherever it actually is (the strike accelerates).
    [0.3, 0.45, 0.6, 0.75].forEach((at) => {
      setTimeout(() => {
        const x = new DOMMatrix(getComputedStyle(blade).transform).m41;
        if (x < 0 || x > w) return;
        for (let i = 0; i < 5; i++) {
          const s = span(`slash-spark${Math.random() < 0.4 ? " ember" : ""}`);
          fx.appendChild(s);
          const dx = 20 + Math.random() * 70;
          const dy = (Math.random() - 0.6) * 60;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          s.animate(
            [
              { transform: `translate(${x}px, 0) rotate(${angle}deg)`, opacity: 1 },
              { transform: `translate(${x + dx}px, ${dy}px) rotate(${angle}deg) scaleX(.3)`, opacity: 0 },
            ],
            { duration: 420 + Math.random() * 380, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }
          );
        }
      }, SLASH_MS * at);
    });

    // The section label takes the hit.
    setTimeout(() => {
      section.querySelectorAll(".section-bar p").forEach((p) =>
        p.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(5px)", color: palette.blood, offset: 0.25 },
            { transform: "translateX(-2px)", offset: 0.6 },
            { transform: "translateX(0)" },
          ],
          { duration: 320, easing: "ease-out" }
        )
      );
    }, SLASH_MS * 0.5);

    setTimeout(() => fx.remove(), 2200);
  }

  const sectionObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in-view");
        if (!reduceMotion) slash(e.target);
        sectionObserver.unobserve(e.target);
      }),
    { rootMargin: "0px 0px -30% 0px" }
  );
  document.querySelectorAll(".section").forEach((s) => sectionObserver.observe(s));

  // ── Vitals: count up when they come into view.
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const step = (now) => {
        const p = reduceMotion ? 1 : clamp((now - start) / 1400, 0, 1);
        el.textContent = Math.round(target * easeOut(p)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

  // ── Section index (bottom-right) + nav active state.
  const sections = [...document.querySelectorAll("[data-index]")];
  const indexNav = document.querySelector(".section-index");
  const indexLinks = sections.map((s) => {
    const a = document.createElement("a");
    a.href = `#${s.id}`;
    a.textContent = s.dataset.index;
    indexNav.appendChild(a);
    return a;
  });
  const navLinks = [...document.querySelectorAll(".nav-link")];

  function setActive(id) {
    indexLinks.forEach((a) => a.classList.toggle("active", a.hash === `#${id}`));
    navLinks.forEach((a) => {
      if (a.hash === `#${id}`) a.dataset.active = "true";
      else delete a.dataset.active;
    });
  }

  // ── Scroll ruler with rolling-digit percentage readout.
  const ticks = document.querySelector(".ruler-ticks");
  const cursor = document.querySelector(".ruler-cursor");
  const digitsEl = document.querySelector(".ruler-digits");
  const digitCols = [0, 1, 2].map(() => {
    const col = document.createElement("span");
    col.className = "ruler-digit-col";
    for (let d = 0; d <= 9; d++) {
      const s = document.createElement("span");
      s.textContent = d;
      col.appendChild(s);
    }
    digitsEl.appendChild(col);
    return col;
  });

  function buildTicks() {
    ticks.replaceChildren();
    const h = ticks.clientHeight;
    for (let i = 0, y = 10; y < h; i++, y += 60) {
      const t = document.createElement("span");
      t.className = "ruler-tick" + (i % 5 === 0 ? " major" : "");
      t.style.top = `${y}px`;
      ticks.appendChild(t);
      if (i % 5 === 0) {
        const label = document.createElement("span");
        label.className = "ruler-tick-label";
        label.style.top = `${y}px`;
        label.textContent = i;
        ticks.appendChild(label);
      }
    }
  }

  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    cursor.style.transform = `translateY(${p * (ticks.clientHeight - 16)}px)`;
    parallax(window.scrollY);

    const value = Math.round(p * 100);
    const pct = String(value).padStart(3, "0");
    const visibleFrom = 3 - String(value).length;
    digitCols.forEach((col, i) => {
      col.style.transform = `translateY(-${pct[i]}em)`;
      col.style.display = i < visibleFrom ? "none" : "";
    });

    const probe = window.innerHeight * 0.35;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= probe) current = s;
    setActive(current.id);
  }
  window.addEventListener("scroll", () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  window.addEventListener("resize", () => {
    buildTicks();
    onScroll();
  });
  buildTicks();
  onScroll();

  // ════════════════════════════════════════════════════════════════════
  //  HERO — ROOM + Shambles (Ope Ope no Mi)
  // ════════════════════════════════════════════════════════════════════
  const hero = document.getElementById("room");
  const heroCanvas = hero.querySelector(".hero-canvas");
  const hctx = heroCanvas.getContext("2d");
  const toast = hero.querySelector(".shambles-toast");
  const restoreBtn = document.getElementById("restore");
  const wordmark = hero.querySelector(".wordmark");
  const originalOrder = [...wordmark.children];
  const mouse = { x: -9999, y: -9999 };
  const room = { open: false, x: 0, y: 0, r: 0, target: 0, spin: 0 };
  let dots = [];
  let heroSize = { w: 0, h: 0 };
  let picked = null;

  function resizeHero() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = hero.getBoundingClientRect();
    heroSize = { w: width, h: height };
    heroCanvas.width = width * dpr;
    heroCanvas.height = height * dpr;
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    const gap = 28;
    for (let y = gap / 2; y < height; y += gap)
      for (let x = gap / 2; x < width; x += gap) dots.push({ x, y, r: 0.6 });
    if (room.open) room.target = roomRadius();
  }
  const roomRadius = () => Math.max(170, Math.min(heroSize.w, heroSize.h) * 0.5);

  function openRoom(x, y) {
    room.open = true;
    room.x = x;
    room.y = y;
    room.target = roomRadius();
    hero.classList.add("room-open");
  }
  function closeRoom() {
    room.open = false;
    room.target = 0;
    hero.classList.remove("room-open");
    clearPick();
  }
  function clearPick() {
    if (picked) picked.classList.remove("picked");
    picked = null;
  }

  // Letters inside the dome become operable.
  function markLettersInRoom() {
    const hr = hero.getBoundingClientRect();
    for (const el of letters) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - hr.left;
      const cy = r.top + r.height / 2 - hr.top;
      el.classList.toggle("in-room", room.open && Math.hypot(cx - room.x, cy - room.y) < room.r * 0.96);
    }
  }

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  hero.addEventListener("pointerleave", () => (mouse.x = mouse.y = -9999));

  hero.addEventListener("click", (e) => {
    if (e.target.closest("a, button, .wm-letter")) return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (room.open && Math.hypot(x - room.x, y - room.y) > room.r) closeRoom();
    else if (!room.open) openRoom(x, y);
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "Escape" && room.open) closeRoom();
    if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
      if (room.open) closeRoom();
      else {
        const wr = wordmark.getBoundingClientRect();
        const hr = hero.getBoundingClientRect();
        openRoom(wr.left + wr.width / 2 - hr.left, wr.top + wr.height / 2 - hr.top);
      }
    }
  });

  letters.forEach((el) =>
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!room.open || !el.classList.contains("in-room")) return;
      if (!picked) {
        picked = el;
        el.classList.add("picked");
      } else if (picked === el) {
        clearPick();
      } else {
        const a = picked;
        clearPick();
        shambles(a, el);
      }
    })
  );

  // FLIP: snapshot positions, reorder DOM, animate from old to new along an arc.
  function flip(nodes, mutate, lift = 0.6) {
    const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
    mutate();
    nodes.forEach((n) => {
      const a = before.get(n);
      const b = n.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      n.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2}px, ${dy / 2 - lift * b.height}px) scale(1.12)`, offset: 0.5 },
          { transform: "translate(0, 0)" },
        ],
        { duration: reduceMotion ? 1 : 650, easing: "cubic-bezier(.2,.9,.2,1)" }
      );
    });
  }

  function shambles(a, b) {
    flip(letters, () => {
      const marker = document.createElement("span");
      a.before(marker);
      b.before(a);
      marker.replaceWith(b);
    });
    toast.querySelector("small").textContent = `${a.textContent} ⇄ ${b.textContent}`;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(shambles.t);
    shambles.t = setTimeout(() => toast.classList.remove("show"), 1400);
    const scrambled = [...wordmark.children].some((n, i) => n !== originalOrder[i]);
    restoreBtn.hidden = !scrambled;
  }

  restoreBtn.addEventListener("click", () => {
    flip(letters, () => wordmark.replaceChildren(...originalOrder), 0.3);
    restoreBtn.hidden = true;
  });

  function drawHero(time) {
    const { w, h } = heroSize;
    const c = palette;
    hctx.clearRect(0, 0, w, h);

    room.r = lerp(room.r, room.target, room.open ? 0.12 : 0.18);
    if (room.r < 0.5 && !room.open) room.r = 0;
    room.spin = time * 0.0004;

    // Dot field: swells near the cursor, turns ROOM blue inside the dome.
    for (const d of dots) {
      const dm = Math.hypot(d.x - mouse.x, d.y - mouse.y);
      const inRoom = room.r > 0 && Math.hypot(d.x - room.x, d.y - room.y) < room.r;
      let target = dm < 160 ? 2.2 * (1 - dm / 160) + 0.6 : 0.6;
      if (inRoom) target += 0.5;
      d.r += (target - d.r) * 0.12;
      hctx.globalAlpha = inRoom ? 0.55 : 0.16 + (d.r - 0.6) * 0.2;
      hctx.fillStyle = inRoom ? c.room : c.ink;
      hctx.beginPath();
      hctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      hctx.fill();
    }
    hctx.globalAlpha = 1;

    if (room.r > 1) {
      const { x, y, r } = room;
      // Dome fill + rim.
      const g = hctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, c.room);
      hctx.globalAlpha = 0.16;
      hctx.fillStyle = g;
      hctx.beginPath();
      hctx.arc(x, y, r, 0, Math.PI * 2);
      hctx.fill();
      hctx.globalAlpha = 0.85;
      hctx.strokeStyle = c.room;
      hctx.lineWidth = 1.5;
      hctx.stroke();

      // Rotating dashed ring + crosshair.
      hctx.globalAlpha = 0.45;
      hctx.lineWidth = 1;
      hctx.setLineDash([2, 10]);
      hctx.beginPath();
      hctx.arc(x, y, r * 0.86, room.spin, room.spin + Math.PI * 2);
      hctx.stroke();
      hctx.setLineDash([]);
      hctx.globalAlpha = 0.25;
      hctx.beginPath();
      hctx.moveTo(x - r, y); hctx.lineTo(x + r, y);
      hctx.moveTo(x, y - r); hctx.lineTo(x, y + r);
      hctx.stroke();

      // Labels.
      hctx.globalAlpha = 0.95;
      hctx.fillStyle = c.room;
      hctx.font = "600 11px 'Geist Mono', monospace";
      hctx.textAlign = "center";
      hctx.fillText("R O O M", x, y - r - 10);
      hctx.globalAlpha = 0.6;
      hctx.font = "500 9px 'Geist Mono', monospace";
      hctx.fillText(`SCAN  x ${String(Math.round(x)).padStart(4, "0")}  y ${String(Math.round(y)).padStart(4, "0")}  r ${Math.round(r)}`, x, y + r + 18);
      hctx.globalAlpha = 1;
    }
    markLettersInRoom();
  }

  window.addEventListener("resize", resizeHero);
  resizeHero();

  // ════════════════════════════════════════════════════════════════════
  //  SPECIMENS — each project drawn live by the algorithm it's about
  // ════════════════════════════════════════════════════════════════════
  const specimens = {
    // Tilawa Studio: word-by-word alignment of a recitation.
    waveform(ctx, s, t, c) {
      const { w, h } = s;
      const words = [
        { ar: "بِسْمِ", tr: "bismi", a: 0.06, b: 0.24 },
        { ar: "ٱللَّهِ", tr: "llāhi", a: 0.29, b: 0.47 },
        { ar: "ٱلرَّحْمَٰنِ", tr: "r-raḥmāni", a: 0.52, b: 0.73 },
        { ar: "ٱلرَّحِيمِ", tr: "r-raḥīm", a: 0.78, b: 0.95 },
      ];
      const head = (t * 0.11) % 1.08;
      const px = head * w;
      const active = words.findIndex((wd) => head >= wd.a && head <= wd.b);
      const mid = h * 0.5;
      const bars = Math.floor(w / 5);

      words.forEach((wd, i) => {
        if (i !== active) return;
        ctx.fillStyle = c.accent;
        ctx.globalAlpha = 0.14;
        ctx.fillRect(wd.a * w, mid - h * 0.2, (wd.b - wd.a) * w, h * 0.4);
        ctx.globalAlpha = 1;
      });
      for (let i = 0; i < bars; i++) {
        const f = i / bars;
        const wd = words.find((x) => f >= x.a && f <= x.b);
        const env = wd ? Math.sin(((f - wd.a) / (wd.b - wd.a)) * Math.PI) : 0.04;
        const amp = (0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1.3))) * env;
        const bh = Math.max(1, amp * h * 0.17);
        ctx.fillStyle = f * w < px ? c.ink : c.faint;
        ctx.fillRect(i * 5, mid - bh, 3, bh * 2);
      }
      ctx.fillStyle = c.accent;
      ctx.fillRect(px, mid - h * 0.24, 1.5, h * 0.48);

      // Arabic line (right-to-left), active word on yellow.
      ctx.font = `${Math.round(h * 0.11)}px "Geeza Pro", "Noto Naskh Arabic", "Amiri", serif`;
      ctx.textBaseline = "middle";
      const gap = h * 0.06;
      const widths = words.map((wd) => ctx.measureText(wd.ar).width);
      let x = w / 2 + (widths.reduce((a, b) => a + b, 0) + gap * 3) / 2;
      words.forEach((wd, i) => {
        x -= widths[i];
        if (i === active) {
          ctx.fillStyle = c.accent;
          ctx.fillRect(x - 6, h * 0.18 - h * 0.08, widths[i] + 12, h * 0.16);
        }
        ctx.fillStyle = i === active ? "#101014" : head > wd.b ? c.ink : c.faint;
        ctx.textAlign = "left";
        ctx.fillText(wd.ar, x, h * 0.18);
        x -= gap;
      });

      // Transliteration under each aligned span.
      ctx.font = `500 ${Math.max(9, Math.round(h * 0.045))}px 'Geist Mono', monospace`;
      ctx.textAlign = "center";
      words.forEach((wd, i) => {
        ctx.fillStyle = i === active ? c["accent-ink"] : c.faint;
        ctx.fillText(wd.tr, ((wd.a + wd.b) / 2) * w, h * 0.8);
      });
      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = c.muted;
      ctx.fillText(`t ${(head * 6.4).toFixed(2)}s`, 14, h - 14);
      ctx.textAlign = "right";
      ctx.fillText("FORCED ALIGNMENT · CTC", w - 14, h - 14);
    },

    // XeroForm: SLS layer outline filled with a serpentine laser hatch, rotated 67° per layer.
    slicer(ctx, s, t, c) {
      const { w, h } = s;
      const cx = w * 0.5, cy = h * 0.47;
      const R = Math.min(w, h) * 0.36;
      const speed = 0.3;
      const layer = Math.floor(t * speed);
      const p = (t * speed) % 1;
      const angle = ((layer * 67) % 180) * (Math.PI / 180);

      const shape = new Path2D();
      for (let i = 0; i <= 120; i++) {
        const th = (i / 120) * Math.PI * 2;
        const r = R * (1 + 0.1 * Math.sin(6 * th + layer * 0.15));
        const px = cx + Math.cos(th) * r * 1.25, py = cy + Math.sin(th) * r;
        i ? shape.lineTo(px, py) : shape.moveTo(px, py);
      }
      shape.closePath();
      const hx = cx + R * 0.25, hy = cy - R * 0.05, hr = R * 0.3;
      shape.moveTo(hx + hr, hy);
      shape.arc(hx, hy, hr, 0, Math.PI * 2);

      ctx.save();
      ctx.clip(shape, "evenodd");
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const span = R * 1.5, step = 6;
      const n = Math.floor((span * 2) / step);
      const done = p * n;
      ctx.lineWidth = 1;
      for (let i = 0; i < n && i <= done; i++) {
        const y = -span + i * step;
        const frac = i < Math.floor(done) ? 1 : done - Math.floor(done);
        const dir = i % 2 ? -1 : 1;
        const x0 = -span * dir, x1 = x0 + 2 * span * dir * frac;
        ctx.strokeStyle = c.ink;
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        if (frac < 1) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = c.accent;
          ctx.shadowColor = c.accent;
          ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(x1, y, 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke(shape);

      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.fillStyle = c.muted;
      ctx.textAlign = "left";
      ctx.fillText(`LAYER ${String((layer % 180) + 1).padStart(3, "0")} / 180`, 14, h - 14);
      ctx.textAlign = "right";
      ctx.fillText(`HATCH ${(layer * 67) % 180}°  ·  0.1 MM`, w - 14, h - 14);
    },

    // Ope Ope no Mi: a tracked hand casts ROOM, then two cubes swap — Shambles.
    hand(ctx, s, t, c) {
      const { w, h } = s;
      const P = [
        [0.5, 0.95], [0.38, 0.88], [0.3, 0.78], [0.24, 0.7], [0.19, 0.63],
        [0.4, 0.6], [0.38, 0.45], [0.37, 0.36], [0.36, 0.28],
        [0.5, 0.58], [0.5, 0.42], [0.5, 0.32], [0.5, 0.23],
        [0.59, 0.6], [0.61, 0.45], [0.62, 0.36], [0.63, 0.29],
        [0.68, 0.65], [0.72, 0.54], [0.74, 0.47], [0.76, 0.41],
      ];
      const E = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
      const size = h * 0.78;
      const ox = w * 0.32 - size / 2 + Math.sin(t * 0.9) * 6;
      const oy = h * 0.1 + Math.cos(t * 1.3) * 4;
      const pts = P.map(([x, y], i) => [ox + x * size + Math.sin(t * 2 + i) * 1.2, oy + y * size + Math.cos(t * 2.3 + i) * 1.2]);

      const cycle = (t % 5) / 5;
      const grow = easeOut(clamp(cycle / 0.35, 0, 1));
      const fade = 1 - clamp((cycle - 0.88) / 0.12, 0, 1);
      const [rx, ry] = pts[9];
      const rr = Math.max(w, h) * 0.55 * grow;

      ctx.globalAlpha = 0.14 * fade;
      ctx.fillStyle = c.room;
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8 * fade;
      ctx.strokeStyle = c.room;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([2, 8]);
      ctx.globalAlpha = 0.4 * fade;
      ctx.beginPath(); ctx.arc(rx, ry, rr * 0.85, t * 0.6, t * 0.6 + Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      for (const [a, b] of E) {
        ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(...pts[b]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      pts.forEach(([x, y], i) => {
        ctx.fillStyle = i % 4 === 0 ? c.accent : c.room;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });

      // Two "hearts" (cubes) trade places mid-cycle.
      const A = [w * 0.68, h * 0.32], B = [w * 0.84, h * 0.66];
      const sw = easeOut(clamp((cycle - 0.45) / 0.2, 0, 1));
      const arc = Math.sin(sw * Math.PI) * h * 0.12;
      const cubeA = [lerp(A[0], B[0], sw), lerp(A[1], B[1], sw) - arc];
      const cubeB = [lerp(B[0], A[0], sw), lerp(B[1], A[1], sw) + arc];
      const sz = h * 0.1;
      [[cubeA, c.accent], [cubeB, c.ink]].forEach(([[x, y], col]) => {
        ctx.fillStyle = col;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        ctx.strokeStyle = c.room;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(x - sz / 2 - 4, y - sz / 2 - 4, sz + 8, sz + 8);
        ctx.globalAlpha = 1;
      });

      ctx.font = "600 10px 'Geist Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = c.room;
      ctx.fillText(grow < 1 ? "ROOM" : sw > 0 && sw < 1 ? "SHAMBLES" : "ROOM · LOCKED", 14, h - 14);
      ctx.textAlign = "right";
      ctx.fillStyle = c.muted;
      ctx.fillText("21 LANDMARKS · 30 FPS", w - 14, h - 14);
    },

    // Landmark: a query fans out through a concept graph; RRF ranks the hits.
    graph(ctx, s, t, c) {
      const { w, h } = s;
      if (!s.graph || s.graph.w !== w) {
        const rnd = mulberry32(7);
        const nodes = [{ x: w * 0.1, y: h * 0.5 }];
        for (let i = 0; i < 15; i++) nodes.push({ x: w * (0.2 + rnd() * 0.42), y: h * (0.12 + rnd() * 0.72) });
        const depth = nodes.map(() => Infinity);
        const parent = nodes.map(() => -1);
        depth[0] = 0;
        // Connect each node to its nearest shallower neighbour (sorted by x for a left-to-right spread).
        const order = nodes.map((n, i) => i).slice(1).sort((a, b) => nodes[a].x - nodes[b].x);
        for (const i of order) {
          let best = 0, bd = Infinity;
          for (let j = 0; j < nodes.length; j++) {
            if (j === i || depth[j] === Infinity) continue;
            const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
            if (d < bd) { bd = d; best = j; }
          }
          parent[i] = best;
          depth[i] = depth[best] + 1;
        }
        const maxDepth = Math.max(...depth);
        const hits = order.slice(-3);
        s.graph = { w, nodes, parent, depth, maxDepth, hits };
      }
      const { nodes, parent, depth, maxDepth, hits } = s.graph;
      const cycle = (t % 4.5) / 4.5;
      const front = cycle * (maxDepth + 1.5);

      ctx.lineWidth = 1;
      nodes.forEach((n, i) => {
        if (parent[i] < 0) return;
        const p = nodes[parent[i]];
        ctx.strokeStyle = c["line-strong"];
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke();
        // A pulse travels each edge while the BFS frontier is at the parent's depth.
        const local = clamp(front - (depth[i] - 1), 0, 1);
        if (local > 0 && local < 1) {
          ctx.fillStyle = c.accent;
          ctx.beginPath(); ctx.arc(lerp(p.x, n.x, local), lerp(p.y, n.y, local), 2.5, 0, Math.PI * 2); ctx.fill();
        }
      });
      nodes.forEach((n, i) => {
        const reached = front >= depth[i];
        const hit = hits.includes(i) && reached;
        ctx.fillStyle = i === 0 ? c.room : hit ? c.accent : reached ? c.ink : c.faint;
        const r = i === 0 ? 6 : hit ? 5 : 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
        if (hit) {
          ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
      ctx.font = "600 10px 'Geist Mono', monospace";
      ctx.fillStyle = c.room;
      ctx.textAlign = "left";
      ctx.fillText("QUERY", nodes[0].x - 14, nodes[0].y - 14);

      // Ranked results panel.
      const x0 = w * 0.68, x1 = w - 16;
      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.fillStyle = c.muted;
      ctx.fillText("RRF · TOP 3", x0, h * 0.24);
      const rows = [["AVL rotations", ".032"], ["Tree balancing", ".029"], ["Big-O of BSTs", ".027"]];
      const shown = front >= maxDepth ? 3 : 0;
      ctx.font = "500 11px 'Geist Mono', monospace";
      rows.forEach(([label, score], i) => {
        const y = h * 0.36 + i * 26;
        ctx.globalAlpha = i < shown ? 1 : 0.25;
        ctx.fillStyle = c.accent;
        ctx.fillRect(x0, y - 10, 3, 14);
        ctx.fillStyle = c.ink;
        ctx.textAlign = "left";
        ctx.fillText(`${i + 1} ${label}`, x0 + 10, y);
        ctx.fillStyle = c.muted;
        ctx.textAlign = "right";
        ctx.fillText(score, x1, y);
      });
      ctx.globalAlpha = 1;
      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.fillStyle = c.muted;
      ctx.textAlign = "right";
      ctx.fillText("SM-2 · NEXT REVIEW 6D", x1, h - 14);
    },

    // Crowd Canvas: a lit crowd of heads, Floyd–Steinberg dithered to 1-bit every frame.
    dither(ctx, s, t, c) {
      const { w, h } = s;
      const scale = 3;
      const W = Math.ceil(w / scale), H = Math.ceil(h / scale);
      if (!s.dither || s.dither.W !== W || s.dither.H !== H) {
        const rnd = mulberry32(11);
        const heads = [];
        [[0.52, 0.09, 9], [0.7, 0.12, 7], [0.9, 0.15, 6]].forEach(([yf, rf, count]) => {
          for (let i = 0; i < count; i++)
            heads.push({ x: ((i + 0.5 + (rnd() - 0.5) * 0.4) / count) * W, y: yf * H + (rnd() - 0.5) * H * 0.05, r: rf * H * (0.85 + rnd() * 0.3) });
        });
        const off = document.createElement("canvas");
        off.width = W; off.height = H;
        s.dither = { W, H, heads, off, octx: off.getContext("2d"), buf: new Float32Array(W * H), last: -1 };
      }
      const d = s.dither;
      const frame = Math.floor(t * 12);
      if (frame !== d.last) {
        d.last = frame;
        const lx0 = Math.cos(t * 0.5) * 0.7, ly0 = -0.5 + Math.sin(t * 0.7) * 0.3, lz0 = 0.6;
        const ll = Math.hypot(lx0, ly0, lz0);
        const lx = lx0 / ll, ly = ly0 / ll, lz = lz0 / ll;
        const buf = d.buf;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let v = 0.9 - 0.45 * (y / H) + 0.08 * Math.sin(x * 0.05 + t);
            for (const hd of d.heads) {
              const dx = (x - hd.x) / hd.r, dy = (y - hd.y) / hd.r;
              const body = dy > 0.7 && Math.abs(dx) < 1.6 - (dy - 0.7) * -0.25;
              if (dx * dx + dy * dy < 1) {
                const nz = Math.sqrt(1 - dx * dx - dy * dy);
                v = 0.06 + 0.8 * Math.max(0, dx * lx + dy * ly + nz * lz);
              } else if (body) {
                v = 0.08 + 0.35 * Math.max(0, dx * lx * 0.5 + lz * 0.6);
              }
            }
            buf[y * W + x] = v;
          }
        const img = d.octx.createImageData(W, H);
        const ink = toRgb(c.ink), paper = toRgb(c["bg-sunken"]);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const old = buf[i];
            const nv = old > 0.5 ? 1 : 0;
            const err = old - nv;
            if (x + 1 < W) buf[i + 1] += (err * 7) / 16;
            if (y + 1 < H) {
              if (x > 0) buf[i + W - 1] += (err * 3) / 16;
              buf[i + W] += (err * 5) / 16;
              if (x + 1 < W) buf[i + W + 1] += err / 16;
            }
            const col = nv ? paper : ink;
            img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
          }
        d.octx.putImageData(img, 0, 0);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(d.off, 0, 0, W * scale, H * scale);
      ctx.fillStyle = c.accent;
      ctx.fillRect(10, h - 26, 156, 16);
      ctx.font = "600 10px 'Geist Mono', monospace";
      ctx.fillStyle = "#101014";
      ctx.textAlign = "left";
      ctx.fillText("FLOYD–STEINBERG · 1-BIT", 16, h - 14.5);
    },
  };

  // Resolve any CSS color (hex, rgb(), color-mix…) to [r, g, b] via a 1×1 canvas.
  const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgbCache = new Map();
  function toRgb(color) {
    if (!rgbCache.has(color)) {
      swatch.clearRect(0, 0, 1, 1);
      swatch.fillStyle = color;
      swatch.fillRect(0, 0, 1, 1);
      rgbCache.set(color, [...swatch.getImageData(0, 0, 1, 1).data.slice(0, 3)]);
    }
    return rgbCache.get(color);
  }

  const live = [];
  document.querySelectorAll("[data-specimen]").forEach((el) => {
    const draw = specimens[el.dataset.specimen];
    if (!draw) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    el.prepend(canvas);
    const s = { el, canvas, ctx: canvas.getContext("2d"), draw, w: 0, h: 0, visible: false };
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      s.w = r.width; s.h = r.height;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    new ResizeObserver(size).observe(el);
    new IntersectionObserver(([e]) => (s.visible = e.isIntersecting)).observe(el);
    size();
    live.push(s);
  });

  function renderOne(s, t) {
    s.ctx.clearRect(0, 0, s.w, s.h);
    s.ctx.save();
    s.draw(s.ctx, s, t, palette);
    s.ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPERATIONS — ROOM on hover, Amputate → Shambles on click, then go live
  // ════════════════════════════════════════════════════════════════════
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad4 = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");

  document.querySelectorAll(".op").forEach((card) => {
    const layer = document.createElement("span");
    layer.className = "op-room";
    layer.setAttribute("aria-hidden", "true");
    const lens = span("op-lens");
    const ring = span("op-ring");
    const scan = span("op-scan");
    layer.append(lens, ring, scan);
    card.append(layer);

    const aim = (x, y) => {
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      scan.textContent = `ROOM · SCAN  x ${pad4(x)}  y ${pad4(y)}`;
    };
    const aimAt = (e) => {
      const r = card.getBoundingClientRect();
      aim(e.clientX - r.left, e.clientY - r.top);
    };
    card.addEventListener("pointerenter", (e) => { aimAt(e); card.classList.add("in-room"); });
    card.addEventListener("pointermove", aimAt);
    card.addEventListener("pointerleave", () => card.classList.remove("in-room", "charging"));
    card.addEventListener("pointerdown", (e) => { if (e.button === 0) card.classList.add("charging"); });
    card.addEventListener("pointerup", () => card.classList.remove("charging"));
    card.addEventListener("focus", () => {
      aim(card.clientWidth / 2, card.clientHeight * 0.4);
      card.classList.add("in-room");
    });
    card.addEventListener("blur", () => card.classList.remove("in-room", "charging"));

    card.addEventListener("click", (e) => {
      // Let the browser handle new-tab / download gestures untouched.
      if (reduceMotion || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (card.dataset.busy) return;
      card.dataset.busy = "1";
      amputate(card).then(() => window.location.assign(card.href));
    });
  });

  async function amputate(card) {
    const r = card.getBoundingClientRect();
    const w = r.width, h = r.height;
    const stage = document.createElement("div");
    stage.className = "amputate";
    stage.setAttribute("aria-hidden", "true");
    Object.assign(stage.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${w}px`, height: `${h}px` });

    // Two diagonal cuts → three slices, each a clone of the card with its live canvas copied in.
    const tilt = h * 0.08;
    const cuts = [[h * 0.36 + tilt, h * 0.36 - tilt], [h * 0.68 - tilt, h * 0.68 + tilt]];
    const polys = [
      `0 0, ${w}px 0, ${w}px ${cuts[0][1]}px, 0 ${cuts[0][0]}px`,
      `0 ${cuts[0][0]}px, ${w}px ${cuts[0][1]}px, ${w}px ${cuts[1][1]}px, 0 ${cuts[1][0]}px`,
      `0 ${cuts[1][0]}px, ${w}px ${cuts[1][1]}px, ${w}px ${h}px, 0 ${h}px`,
    ];
    const srcCanvases = card.querySelectorAll("canvas");
    const pieces = polys.map((poly) => {
      const piece = document.createElement("div");
      piece.className = "piece";
      piece.style.clipPath = `polygon(${poly})`;
      const clone = card.cloneNode(true);
      clone.classList.remove("in-room", "charging");
      clone.removeAttribute("href");
      clone.querySelector(".op-room")?.remove();
      clone.querySelectorAll("canvas").forEach((c, i) => c.getContext("2d").drawImage(srcCanvases[i], 0, 0));
      piece.appendChild(clone);
      stage.appendChild(piece);
      return piece;
    });

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", w + 60);
    svg.setAttribute("height", h);
    const lines = cuts.map(([yl, yr]) => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", 0); line.setAttribute("y1", yl);
      line.setAttribute("x2", w + 60); line.setAttribute("y2", yr);
      svg.appendChild(line);
      return line;
    });
    const flash = span("amputate-flash");
    const label = span("amputate-label");
    const word = span("serif");
    word.textContent = "Shambles";
    const dest = span("hud-label");
    dest.textContent = `→ ${card.dataset.dest || new URL(card.href).host}`;
    label.append(word, dest);
    stage.append(svg, flash, label);
    document.body.appendChild(stage);
    card.style.visibility = "hidden";
    card.classList.remove("in-room", "charging");

    // 1 · Amputate: two blue cuts slash across.
    const ease = "cubic-bezier(.75,0,.15,1)";
    lines.forEach((line, i) => {
      const len = Math.hypot(w + 60, line.y2.baseVal.value - line.y1.baseVal.value);
      line.style.strokeDasharray = `${len}`;
      line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 160, delay: i * 90, easing: ease, fill: "both" });
    });
    await sleep(230);

    // 2 · The pieces come apart.
    const apart = [
      "translate(-12px, -16px) rotate(-1.4deg)",
      "translate(18px, 0) rotate(.4deg)",
      "translate(-9px, 15px) rotate(1.1deg)",
    ];
    pieces.forEach((pc, i) =>
      pc.animate([{ transform: "none" }, { transform: apart[i] }], { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" })
    );
    lines.forEach((line) => line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 120, fill: "forwards" }));
    await sleep(300);

    // 3 · Shambles: snap back together with a flash, name the destination.
    label.animate(
      [{ opacity: 0, scale: ".85" }, { opacity: 1, scale: "1" }],
      { duration: 220, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" }
    );
    pieces.forEach((pc, i) =>
      pc.animate([{ transform: apart[i] }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" })
    );
    await sleep(190);
    flash.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 380, easing: "ease-out" });
    await sleep(320);
  }

  // Coming back with the Back button (bfcache): put the cards back the way they were.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    document.querySelectorAll(".amputate").forEach((n) => n.remove());
    document.querySelectorAll(".op").forEach((card) => {
      card.style.visibility = "";
      delete card.dataset.busy;
    });
  });

  // ── ECG heart monitor in the contact section.
  const ecgBase = document.querySelector(".ecg-base");
  const ecgPulse = document.querySelector(".ecg-pulse");
  if (ecgBase) {
    let d = "M0 45";
    for (let x = 0; x < 1200; x += 200) {
      d += ` L${x + 60} 45 Q${x + 70} 36 ${x + 80} 45 L${x + 92} 45 L${x + 98} 52 L${x + 106} 8 L${x + 114} 80 L${x + 120} 45 L${x + 136} 45 Q${x + 152} 30 ${x + 168} 45 L${x + 200} 45`;
    }
    ecgBase.setAttribute("d", d);
    ecgPulse.setAttribute("d", d);
    const len = ecgPulse.getTotalLength();
    ecgPulse.style.strokeDasharray = `${len * 0.12} ${len}`;
    if (!reduceMotion) {
      ecgPulse.animate([{ strokeDashoffset: len * 0.12 }, { strokeDashoffset: -len }], { duration: 5000, iterations: Infinity });
    }
    const bpm = document.querySelector(".bpm");
    setInterval(() => (bpm.textContent = 70 + Math.round(Math.random() * 5)), 2500);
  }

  // ── One loop drives the hero and every visible specimen (frozen frames under reduced motion).
  let lastNow = performance.now();
  function frame(now) {
    readPalette();
    drawHero(now);
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    if (!reduceMotion) drawEmbers(now / 1000, dt);
    const t = reduceMotion ? 2 : now / 1000;
    for (const s of live) if (s.visible) renderOne(s, t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  console.log(
    "%cROOM.%c  You opened the console — you're my kind of person.\nOumar Kante · KNT D. CODE · github.com/oumarknt31",
    "font: 900 20px Archivo, sans-serif; color: #ffc400; background: #121316; padding: 4px 8px;",
    "font: 12px monospace; color: inherit;"
  );
})();
