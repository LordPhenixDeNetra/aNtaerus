/* ==========================================================
   aNtaerus · Guide utilisateur docs/script.js
   Vanilla JS · 0 dépendance · Sidebar toggle, search,
   tabs, accordion, toc active on scroll, smooth back-to-top,
   mobile sidebar close au click lien.
========================================================== */
(function () {
  "use strict";

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);

  function setupSidebarToggle() {
    const toggle = qs("#sidebarToggle");
    const sidebar = qs("#sidebar");
    const backdrop = qs("#sidebarBackdrop");
    if (!toggle || !sidebar || !backdrop) return;

    const show = () => {
      sidebar.classList.add("visible-mobile");
      sidebar.classList.remove("hidden-mobile");
      backdrop.classList.add("visible");
    };
    const hide = () => {
      sidebar.classList.remove("visible-mobile");
      sidebar.classList.add("hidden-mobile");
      backdrop.classList.remove("visible");
    };
    on(toggle, "click", () => {
      if (sidebar.classList.contains("visible-mobile")) hide();
      else show();
    });
    on(backdrop, "click", hide);

    // Ferme la sidebar mobile quand on clique un lien TOC
    qsa(".toc-link", sidebar).forEach((a) =>
      on(a, "click", () => {
        if (window.matchMedia("(max-width: 820px)").matches) hide();
      })
    );
  }

  function setupTabs() {
    qsa(".tabs").forEach((tabs) => {
      const btns = qsa(".tab-btn", tabs);
      const panels = qsa(".tab-panel", tabs);
      btns.forEach((btn) => {
        on(btn, "click", () => {
          const target = btn.getAttribute("data-tab");
          btns.forEach((b) => b.classList.toggle("active", b === btn));
          panels.forEach((p) => p.classList.toggle("active", p.id === target));
        });
      });
    });
  }

  function setupAccordions() {
    qsa(".accordion").forEach((acc) => {
      const btns = qsa(".acc-btn", acc);
      btns.forEach((btn) => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-acc");
          const panel = document.getElementById(id);
          if (!panel) return;
          const willOpen = !panel.classList.contains("active");
          // fermeture des autres dans le même accordeon (sauf FAQ si multiple souhaité → on garde multiple mais CSS prévoit)
          // Comportement: un seul ouvert par accordéon PREREQUIS (tabs-like), MULTIPLE pour FAQ/LLM: laisser user toggle freely
          // Ici toggle simple unique pour bouton courant (pas fermeture autre → user peut ouvrir plusieurs FAQ)
          btn.classList.toggle("active", willOpen);
          panel.classList.toggle("active", willOpen);
        });
      });
    });
  }

  function setupTocActiveOnScroll() {
    const links = qsa(".toc-link");
    if (!links.length) return;
    const idToLink = new Map();
    links.forEach((a) => {
      const id = (a.getAttribute("href") || "").replace(/^#/, "");
      if (id) idToLink.set(id, a);
    });
    const sections = qsa(".section, .sub-section").filter((s) => s.id && idToLink.has(s.id));
    if (!sections.length) return;

    let ticking = false;
    function update() {
      const y = window.scrollY || document.documentElement.scrollTop;
      const threshold = 120;
      let current = sections[0];
      for (let i = 0; i < sections.length; i++) {
        const top = sections[i].getBoundingClientRect().top + y - threshold;
        if (top <= y + 80) current = sections[i];
      }
      idToLink.forEach((link) => link.classList.remove("active"));
      if (current) {
        const a = idToLink.get(current.id);
        if (a) {
          a.classList.add("active");
          // scroll parent #toc vers lien visible si hors viewport sidebar seulement si nécessaire
          const toc = qs("#toc");
          if (toc) {
            const linkRect = a.getBoundingClientRect();
            const tocRect = toc.getBoundingClientRect();
            if (linkRect.top < tocRect.top + 16 || linkRect.bottom > tocRect.bottom - 16) {
              a.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          }
        }
      }
      ticking = false;
    }
    on(window, "scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  function setupSearch() {
    const input = qs("#searchInput");
    const main = qs("#main");
    if (!input || !main) return;

    // Sauvegarde contenu textuel ORIGINAL avant quelconque highlight, 1 fois
    const targets = qsa(".section, .sub-section", main);
    const originals = new WeakMap();
    targets.forEach((t) => originals.set(t, t.innerHTML));

    let debounce;
    on(input, "input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(runSearch, 180);
    });
    on(input, "keydown", (e) => {
      if (e.key === "Escape") { input.value = ""; runSearch(); }
    });

    function runSearch() {
      const raw = (input.value || "").trim().toLowerCase();
      // Restaurer originaux
      targets.forEach((t) => { t.innerHTML = originals.get(t); });

      if (!raw) {
        targets.forEach((t) => t.classList.remove("no-match"));
        return;
      }

      // Filtrer sections ET sous-sections
      const rootSections = qsa(".section", main);
      rootSections.forEach((root) => {
        const subs = qsa(".sub-section", root);
        let rootMatches = false;
        subs.forEach((sub) => {
          const ok = text(sub).includes(raw);
          sub.classList.toggle("no-match", !ok);
          if (ok) { rootMatches = true; highlight(sub, raw); }
        });
        // Si pas de sub, regarder root lui-même
        if (!subs.length) {
          const ok = text(root).includes(raw);
          root.classList.toggle("no-match", !ok);
          if (ok) highlight(root, raw);
          return;
        }
        // Si au moins 1 sub match ou root header match → on affiche root
        const headerOk = (qs(".section-header", root)?.textContent || "").toLowerCase().includes(raw);
        root.classList.toggle("no-match", !(rootMatches || headerOk));
        if (rootMatches || headerOk) {
          if (headerOk && !rootMatches) highlightHeader(root, raw);
          else highlight(root, raw, true /*skip subs déjà fait*/);
        }
      });
    }

    function text(el) { return (el.textContent || "").toLowerCase(); }

    function highlightHeader(root, q) {
      const head = qs(".section-header", root);
      if (!head) return;
      walkAndMark(head, q);
    }

    function highlight(root, q, skipSub) {
      // Sous-éléments: évite de toucher script/style/pre/code contenant balises déjà user verbeux → on marque toute partout SAUF dans .section-header ? NON tout
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (skipSub && p.closest && p.closest(".sub-section") && !p.closest(".section-header")) return NodeFilter.FILTER_REJECT;
          const tag = (p.tagName || "").toLowerCase();
          if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest(".search-wrap")) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains("search-hit"))) return NodeFilter.FILTER_REJECT;
          return node.nodeValue && node.nodeValue.toLowerCase().includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const toProcess = [];
      let n = walker.nextNode();
      while (n) { toProcess.push(n); n = walker.nextNode(); }
      toProcess.forEach((node) => wrapText(node, q));
    }

    function walkAndMark(rootEl, q) {
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = (p.tagName || "").toLowerCase();
          if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains("search-hit")) return NodeFilter.FILTER_REJECT;
          return node.nodeValue && node.nodeValue.toLowerCase().includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const toProcess = [];
      let n = walker.nextNode();
      while (n) { toProcess.push(n); n = walker.nextNode(); }
      toProcess.forEach((node) => wrapText(node, q));
    }

    function wrapText(textNode, q) {
      const v = textNode.nodeValue || "";
      const lower = v.toLowerCase();
      const frag = document.createDocumentFragment();
      let last = 0;
      let idx = lower.indexOf(q, 0);
      let safety = 0;
      while (idx !== -1 && safety++ < 200) {
        if (idx > last) frag.appendChild(document.createTextNode(v.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.appendChild(document.createTextNode(v.slice(idx, idx + q.length)));
        frag.appendChild(mark);
        last = idx + q.length;
        idx = lower.indexOf(q, last);
      }
      if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function setupBackToTopSmooth() {
    const link = qs("a.back-to-top");
    if (!link) return;
    on(link, "click", (e) => {
      e.preventDefault();
      if ("scroll" in window) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        location.hash = "";
        location.hash = "intro";
      }
    });
  }

  function setupAnchorSmoothOffsetForSidebar() {
    // Permet que l'ancre arrive ~24px au-dessus du header section (mobile sidebar toggle non superposé au content)
    if ("scrollBehavior" in document.documentElement.style) return;
    // Fallback pour navigateurs sans smooth natif: déjà ok via CSS html scroll-behavior
  }

  function setupExternalLinksRel() {
    // Défensif: s'assurer <a target=_blank> hors markdown originaux ont rel=noreferrer
    qsa('a[target="_blank"]').forEach((a) => {
      const r = a.getAttribute("rel") || "";
      if (!/(noreferrer|noopener)/.test(r)) a.setAttribute("rel", "noreferrer noopener");
    });
  }

  function setupCopyOnClickCmdBox() {
    // (Bonus) Double-click sur un bloc cmd-box → copie contenu (strippé prompts $ / PS) dans presse-papier
    qsa("pre.cmd-box").forEach((pre) => {
      pre.title = "Double-clic pour copier le contenu";
      pre.style.cursor = "copy";
      on(pre, "dblclick", async () => {
        const raw = (pre.innerText || pre.textContent || "").replace(/\r/g, "");
        // strip lignes prompts: enlever le prefixe "PS > " et "$ > " (ou juste "> ")
        const cleaned = raw.split("\n").map((line) => {
          return line.replace(/^\s*(PS|\$)\s*>\s*/, "").replace(/^\s*PS\s+/, "").replace(/^\s*\$\s+/, "");
        }).join("\n");
        try {
          await navigator.clipboard.writeText(cleaned);
          flash(pre, "Copie dans le presse-papier");
        } catch (e) {
          try {
            const ta = document.createElement("textarea");
            ta.value = cleaned;
            ta.style.position = "fixed"; ta.style.opacity = "0";
            document.body.appendChild(ta); ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            flash(pre, "Copie (fallback)");
          } catch (e2) { /* ignore */ }
        }
      });
    });

    function flash(el, msg) {
      const tip = document.createElement("div");
      tip.textContent = msg;
      tip.style.cssText = [
        "position:fixed",
        "z-index:9999",
        "padding:8px 14px",
        "border-radius:999px",
        "background:rgba(52,211,153,0.18)",
        "border:1px solid rgba(52,211,153,0.45)",
        "color:#a7f3d0",
        "font-size:13px",
        "font-weight:600",
        "font-family:ui-monospace,monospace",
        "pointer-events:none",
        "transform:translateY(-8px)",
        "opacity:0",
        "transition:opacity 180ms ease, transform 180ms ease",
        "box-shadow:0 6px 18px rgba(0,0,0,0.35)"
      ].join(";");
      const rect = el.getBoundingClientRect();
      tip.style.left = Math.round(rect.left + 16) + "px";
      tip.style.top = Math.max(8, Math.round(rect.top - 48)) + "px";
      document.body.appendChild(tip);
      requestAnimationFrame(() => { tip.style.opacity = "1"; tip.style.transform = "translateY(0)"; });
      setTimeout(() => {
        tip.style.opacity = "0"; tip.style.transform = "translateY(-8px)";
        setTimeout(() => tip.remove(), 260);
      }, 1500);
    }
  }

  // Boot
  function boot() {
    setupSidebarToggle();
    setupTabs();
    setupAccordions();
    setupTocActiveOnScroll();
    setupSearch();
    setupBackToTopSmooth();
    setupAnchorSmoothOffsetForSidebar();
    setupExternalLinksRel();
    setupCopyOnClickCmdBox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
