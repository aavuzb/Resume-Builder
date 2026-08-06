"use strict";
/*
 * dom-utils.js
 * Small DOM-building helpers (cards, buttons, section headers) and generic
 * drag-and-drop reordering primitives shared by every dynamic "repeating
 * card" list in widgets.js — skill/certificate rows, project cards,
 * experience cards, education cards, publication cards, and the sidebar's
 * reorderable nav buttons. Mirrors widgets.py's non-list-specific helpers.
 */

const DomUtils = (() => {
  function el(tag, opts) {
    opts = opts || {};
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    if (opts.html !== undefined) node.innerHTML = opts.html;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function microLabel(text) {
    return el("label", { className: "micro-label", text: (text || "").toUpperCase() });
  }

  function hairline() {
    return el("div", { className: "hairline" });
  }

  function button(text, variant, opts) {
    opts = opts || {};
    const btn = el("button", { className: `btn btn-${variant || "secondary"}${opts.small ? " btn-small" : ""}`, text });
    btn.type = "button";
    return btn;
  }

  function removeIconButton(tooltip) {
    const btn = el("button", { className: "btn btn-icon-ghost", text: "✕" });
    btn.type = "button";
    btn.title = tooltip !== undefined ? tooltip : I18N.t("common.remove");
    return btn;
  }

  function addField(container, labelText, widget, gapBeforeClass) {
    const wrap = el("div", { className: `field-block${gapBeforeClass ? " " + gapBeforeClass : ""}` });
    wrap.appendChild(microLabel(labelText));
    wrap.appendChild(widget);
    container.appendChild(wrap);
    return wrap;
  }

  function makeLineEdit(text, opts) {
    opts = opts || {};
    const input = el("input", { className: `field-input${opts.bold ? " field-bold" : ""}` });
    input.type = "text";
    input.value = text || "";
    if (opts.placeholder) input.placeholder = opts.placeholder;
    return input;
  }

  function makeTextArea(text, opts) {
    opts = opts || {};
    const ta = el("textarea", { className: "field-input field-textarea" });
    ta.value = text || "";
    if (opts.rows) ta.rows = opts.rows;
    if (opts.placeholder) ta.placeholder = opts.placeholder;
    return ta;
  }

  function makeSelect(items, current) {
    // items: [[value, display], ...]
    const select = el("select", { className: "field-input field-select" });
    items.forEach(([value, display]) => {
      const opt = el("option", { text: display });
      opt.value = value;
      select.appendChild(opt);
    });
    select.value = current || "";
    return select;
  }

  function sectionHeader(container, eyebrowText, titleText, hintText) {
    const eyebrow = el("p", { className: "eyebrow", text: eyebrowText.toUpperCase() });
    container.appendChild(eyebrow);
    const title = el("h2", { className: "section-title", text: titleText });
    container.appendChild(title);
    const hint = el("p", { className: "hint", text: hintText });
    container.appendChild(hint);
    const spacer = el("div", { className: "spacer-14" });
    container.appendChild(spacer);
    container.appendChild(hairline());
    container.appendChild(el("div", { className: "spacer-22" }));
    return eyebrow;
  }

  function makeScrollPage() {
    const page = el("div", { className: "form-page" });
    const inner = el("div", { className: "form-page-inner" });
    page.appendChild(inner);
    return { page, body: inner };
  }

  function cardFrame(kind) {
    return el("div", { className: kind === "main" ? "card" : "subcard" });
  }

  function badgeLabel(text, kind) {
    return el("span", { className: kind === "main" ? "card-badge" : "subcard-badge", text: String(text) });
  }

  // ------------------------------------------------------- drag-and-drop --
  // Single-drag-at-a-time, mirrors widgets.py's module-level _current_drag_row:
  // the browser only ever has one HTML5 drag in flight, so a shared slot is
  // simpler (and safer) than trying to thread drag identity through
  // DataTransfer, which most browsers restrict during dragover anyway.
  let currentDragEl = null;

  function makeDragHandle(getRowEl, tooltip) {
    const handle = el("span", { className: "drag-handle", text: "⣿" });
    handle.title = tooltip || I18N.t("common.drag_reorder");
    handle.draggable = true;
    handle.addEventListener("dragstart", (ev) => {
      const rowEl = getRowEl();
      currentDragEl = rowEl;
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", "row");
      try {
        const rect = rowEl.getBoundingClientRect();
        ev.dataTransfer.setDragImage(rowEl, ev.clientX - rect.left, ev.clientY - rect.top);
      } catch (err) { /* not fatal — falls back to default drag ghost */ }
      rowEl.classList.add("dragging");
    });
    handle.addEventListener("dragend", () => {
      const rowEl = getRowEl();
      rowEl.classList.remove("dragging");
      currentDragEl = null;
      document.querySelectorAll(".drop-before, .drop-after").forEach((n) => {
        n.classList.remove("drop-before", "drop-after");
      });
    });
    return handle;
  }

  function makeReorderArrows(onMove) {
    const wrap = el("div", { className: "reorder-arrows" });
    const up = el("button", { className: "btn-reorder", text: "▲" });
    up.type = "button";
    up.title = I18N.t("common.move_up");
    up.addEventListener("click", () => onMove(-1));
    const down = el("button", { className: "btn-reorder", text: "▼" });
    down.type = "button";
    down.title = I18N.t("common.move_down");
    down.addEventListener("click", () => onMove(1));
    wrap.appendChild(up);
    wrap.appendChild(down);
    return { wrap, upBtn: up, downBtn: down };
  }

  function enableDropTarget(rowEl, onDropped) {
    rowEl.addEventListener("dragover", (ev) => {
      if (!currentDragEl || currentDragEl === rowEl) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      const rect = rowEl.getBoundingClientRect();
      const before = (ev.clientY - rect.top) < rect.height / 2;
      rowEl.classList.toggle("drop-before", before);
      rowEl.classList.toggle("drop-after", !before);
    });
    rowEl.addEventListener("dragleave", (ev) => {
      if (!rowEl.contains(ev.relatedTarget)) {
        rowEl.classList.remove("drop-before", "drop-after");
      }
    });
    rowEl.addEventListener("drop", (ev) => {
      if (!currentDragEl || currentDragEl === rowEl) return;
      ev.preventDefault();
      const insertAfter = rowEl.classList.contains("drop-after");
      rowEl.classList.remove("drop-before", "drop-after");
      onDropped(currentDragEl, rowEl, insertAfter);
    });
  }

  function updateRowArrowStates(rows, upKey, downKey) {
    upKey = upKey || "upBtn";
    downKey = downKey || "downBtn";
    const last = rows.length - 1;
    rows.forEach((row, i) => {
      row[upKey].disabled = i === 0;
      row[downKey].disabled = i === last;
    });
  }

  function refreshChildOrder(container, items, getEl) {
    items.forEach((item) => container.removeChild(getEl(item)));
    items.forEach((item) => container.appendChild(getEl(item)));
  }

  // -------------------------------------------------------- draggable panel --
  // Lets a fixed-position panel (a dialog centered via its backdrop's flex
  // layout) be dragged by a handle element — used by StyleDialog/FormatDialog
  // so they can be moved off-center when a native color picker or other
  // popup would otherwise get clipped near a screen edge. Listeners only
  // exist for the duration of an actual drag, so rebuilding the panel
  // (language retranslate) never leaks stale window-level listeners.
  function makeDraggable(panel, handleEl) {
    handleEl.style.cursor = "move";
    handleEl.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      if (panel.classList.contains("style-dialog-maximized") || panel.classList.contains("style-dialog-minimized")) return;
      if (ev.target.closest("button, input, select, textarea, a")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.margin = "0";
      panel.classList.add("dialog-dragging");
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;

      function onMouseMove(mv) {
        const newLeft = Math.min(Math.max(startLeft + (mv.clientX - startX), 8), window.innerWidth - 80);
        const newTop = Math.min(Math.max(startTop + (mv.clientY - startY), 8), window.innerHeight - 60);
        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
      }
      function onMouseUp() {
        panel.classList.remove("dialog-dragging");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      ev.preventDefault();
    });
  }

  // Undoes the fixed left/top positioning set by a previous drag, so the
  // panel falls back to its backdrop's centered flex layout — called every
  // time a draggable dialog is (re)opened, so it always starts centered.
  function resetDraggedPosition(panel) {
    panel.style.position = "";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.margin = "";
  }

  // ------------------------------------------------- resize / maximize / --
  // ------------------------------------------------------------ minimize --
  // Lets a dialog panel (StyleDialog/FormatDialog) be resized from a
  // bottom-right handle, and adds header minimize/maximize buttons. Sizing
  // is driven by inline width/height (from the handle) or CSS classes (from
  // maximize/minimize) — see .style-dialog-maximized/.style-dialog-minimized
  // in styles.css, both !important so they cleanly override whatever inline
  // size/position a prior drag or manual resize left behind, and cleanly
  // fall back to it again once the class is removed.

  // Adds a corner handle a user can drag to manually resize the panel.
  // No-ops while maximized/minimized, since those states force their own size.
  function makeResizable(panel, opts) {
    opts = opts || {};
    const minWidth = opts.minWidth || 320;
    const minHeight = opts.minHeight || 220;

    const handle = el("div", { className: "style-dialog-resize-handle" });
    handle.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      if (panel.classList.contains("style-dialog-maximized") || panel.classList.contains("style-dialog-minimized")) return;
      panel.classList.add("style-dialog-user-sized");
      const rect = panel.getBoundingClientRect();
      // Pin top-left in place first — otherwise, while the panel is still
      // centered by the backdrop's flexbox, growing its width/height would
      // recenter it each frame and the corner would drift out from under
      // the cursor instead of tracking the drag.
      panel.style.position = "fixed";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.margin = "0";
      panel.style.width = `${rect.width}px`;
      panel.style.height = `${rect.height}px`;
      panel.style.maxWidth = "none";
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startWidth = rect.width;
      const startHeight = rect.height;
      const maxWidth = window.innerWidth - rect.left - 16;
      const maxHeight = window.innerHeight - rect.top - 16;

      function onMouseMove(mv) {
        const newWidth = Math.min(Math.max(startWidth + (mv.clientX - startX), minWidth), maxWidth);
        const newHeight = Math.min(Math.max(startHeight + (mv.clientY - startY), minHeight), maxHeight);
        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      ev.preventDefault();
      ev.stopPropagation();
    });
    panel.appendChild(handle);
    return handle;
  }

  // Builds the minimize/maximize header buttons and wires their toggling.
  // Returns a container the caller should append its own close (✕) button
  // into, then append to the header — keeping all three window controls
  // grouped together. Also stashes a reset hook on the panel so callers can
  // snap back to the normal state (e.g. every time the dialog reopens).
  function addWindowControls(panel, header, backdrop) {
    const actions = el("div", { className: "style-dialog-header-actions" });

    const minimizeBtn = el("button", { className: "style-dialog-header-btn", text: "─" });
    minimizeBtn.type = "button";
    const maximizeBtn = el("button", { className: "style-dialog-header-btn", text: "▢" });
    maximizeBtn.type = "button";

    function refreshLabels() {
      const minimized = panel.classList.contains("style-dialog-minimized");
      const maximized = panel.classList.contains("style-dialog-maximized");
      minimizeBtn.title = I18N.t(minimized ? "common.restore" : "common.minimize");
      maximizeBtn.title = I18N.t(maximized ? "common.restore" : "common.maximize");
      maximizeBtn.textContent = maximized ? "❐" : "▢";
    }

    function setMinimized(next) {
      if (next) panel.classList.remove("style-dialog-maximized");
      panel.classList.toggle("style-dialog-minimized", next);
      backdrop.classList.toggle("has-minimized", next);
      refreshLabels();
    }

    function setMaximized(next) {
      if (next) {
        panel.classList.remove("style-dialog-minimized");
        backdrop.classList.remove("has-minimized");
      }
      panel.classList.toggle("style-dialog-maximized", next);
      refreshLabels();
    }

    minimizeBtn.addEventListener("click", () => setMinimized(!panel.classList.contains("style-dialog-minimized")));
    maximizeBtn.addEventListener("click", () => setMaximized(!panel.classList.contains("style-dialog-maximized")));
    // A minimized panel collapses to just its header — clicking that bar
    // (anywhere but a button) is the expected way to bring it back.
    header.addEventListener("click", (ev) => {
      if (!panel.classList.contains("style-dialog-minimized")) return;
      if (ev.target.closest("button")) return;
      setMinimized(false);
    });

    refreshLabels();
    actions.appendChild(minimizeBtn);
    actions.appendChild(maximizeBtn);
    panel._resetWindowState = () => {
      setMinimized(false);
      setMaximized(false);
    };
    return actions;
  }

  return {
    el, microLabel, hairline, button, removeIconButton, addField,
    makeLineEdit, makeTextArea, makeSelect, sectionHeader, makeScrollPage,
    cardFrame, badgeLabel, makeDragHandle, makeReorderArrows, enableDropTarget,
    updateRowArrowStates, refreshChildOrder, makeDraggable, resetDraggedPosition,
    makeResizable, addWindowControls,
    setFieldPath(inputEl, pathFn, preciseFn) {
      inputEl._fieldPathFn = pathFn;
      inputEl._fieldPreciseFn = preciseFn || pathFn;
    },
  };
})();
