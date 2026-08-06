"use strict";
/*
 * format-dialog.js
 * A non-modal "Resume Format" panel — a gallery of the 10 layouts defined in
 * resume-formats.js. Unlike style-dialog.js (which applies every control
 * instantly), picking a card here only stages it — the live preview isn't
 * touched until "Apply" is clicked. "Close" (the footer button, the header
 * ✕, or clicking the backdrop) discards the staged pick and reverts the
 * card selection to whatever format is actually applied. Reuses the same
 * backdrop/panel/header/footer chrome as StyleDialog (via an additive width
 * modifier) and exposes a retranslate() hook for language switches.
 */

function buildFormatMock(formatDef, style) {
  const mock = DomUtils.el("div", { className: "format-card-mock" });
  mock.style.setProperty("--mock-accent", style.accent_color);
  mock.style.setProperty("--mock-gold", style.highlight_color);

  if (formatDef.layout === "sidebar") {
    const sidebar = formatDef.sidebar;
    const row = DomUtils.el("div", { className: "format-mock-row" });
    const col = DomUtils.el("div", { className: `format-mock-col${sidebar.shaded ? " shaded" : ""}` });
    col.style.flex = `0 0 ${sidebar.widthPct}%`;
    const main = DomUtils.el("div", { className: "format-mock-main" });
    for (let i = 0; i < 4; i++) main.appendChild(DomUtils.el("div", { className: "format-mock-line" }));
    if (sidebar.side === "left") {
      row.appendChild(col);
      row.appendChild(main);
    } else {
      row.appendChild(main);
      row.appendChild(col);
    }
    mock.appendChild(row);
  } else {
    const header = DomUtils.el("div", { className: `format-mock-header format-mock-header-${formatDef.header}` });
    mock.appendChild(header);
    for (let i = 0; i < 5; i++) mock.appendChild(DomUtils.el("div", { className: "format-mock-line" }));
  }
  return mock;
}

class FormatDialog {
  constructor(currentFormatId, onChange) {
    this.onChange = onChange;
    this.cards = {};
    this._build();
    this.setFormat(currentFormatId);
  }

  _build() {
    this.backdrop = DomUtils.el("div", { className: "style-dialog-backdrop" });
    this.backdrop.addEventListener("mousedown", (ev) => {
      if (ev.target === this.backdrop) this._cancel();
    });

    const panel = DomUtils.el("div", { className: "style-dialog style-dialog-wide" });
    this.panel = panel;

    const header = DomUtils.el("div", { className: "style-dialog-header" });
    header.appendChild(DomUtils.el("h3", { className: "style-dialog-title", text: I18N.t("format.title") }));
    const actions = DomUtils.addWindowControls(panel, header, this.backdrop);
    const closeX = DomUtils.el("button", { className: "style-dialog-close-x", text: "✕" });
    closeX.type = "button";
    closeX.addEventListener("click", () => this._cancel());
    actions.appendChild(closeX);
    header.appendChild(actions);
    panel.appendChild(header);
    DomUtils.makeDraggable(panel, header);
    DomUtils.makeResizable(panel, { minWidth: 480, minHeight: 360 });

    panel.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("format.hint") }));
    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));

    this.grid = DomUtils.el("div", { className: "format-grid" });
    ResumeFormats.FORMAT_DEFS.forEach((formatDef) => {
      this.grid.appendChild(this._buildCard(formatDef));
    });
    panel.appendChild(this.grid);

    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));
    panel.appendChild(DomUtils.hairline());
    panel.appendChild(DomUtils.el("div", { className: "spacer-14" }));

    const footer = DomUtils.el("div", { className: "style-dialog-footer" });
    const closeBtn = DomUtils.button(I18N.t("format.close"), "secondary");
    closeBtn.addEventListener("click", () => this._cancel());
    const applyBtn = DomUtils.button(I18N.t("format.apply"), "primary");
    applyBtn.addEventListener("click", () => this._apply());
    footer.appendChild(closeBtn);
    footer.appendChild(DomUtils.el("div", { className: "spacer-flex" }));
    footer.appendChild(applyBtn);
    panel.appendChild(footer);

    this.backdrop.appendChild(panel);
    document.body.appendChild(this.backdrop);
  }

  _buildCard(formatDef) {
    const card = DomUtils.el("button", { className: "format-card" });
    card.type = "button";
    card.appendChild(buildFormatMock(formatDef, ResumeFormats.resolveDefaultStyle(formatDef.id)));
    card.appendChild(DomUtils.el("div", { className: "format-card-name", text: I18N.t(`format.${formatDef.id}.name`) }));
    card.appendChild(DomUtils.el("div", { className: "format-card-desc", text: I18N.t(`format.${formatDef.id}.description`) }));
    card.addEventListener("click", () => {
      this.pendingFormatId = formatDef.id;
      this._updateSelection();
    });
    this.cards[formatDef.id] = card;
    return card;
  }

  show() {
    DomUtils.resetDraggedPosition(this.panel);
    this.panel._resetWindowState();
    this.backdrop.classList.add("visible");
  }

  hide() {
    this.backdrop.classList.remove("visible");
  }

  // Sets both the applied and staged selection — used when the dialog opens
  // (or reopens) so it always starts in sync with the resume's actual format.
  setFormat(id) {
    this.appliedFormatId = id;
    this.pendingFormatId = id;
    this._updateSelection();
  }

  _updateSelection() {
    Object.entries(this.cards).forEach(([cardId, card]) => {
      card.classList.toggle("selected", cardId === this.pendingFormatId);
    });
  }

  _cancel() {
    this.pendingFormatId = this.appliedFormatId;
    this._updateSelection();
    this.hide();
  }

  _apply() {
    this.appliedFormatId = this.pendingFormatId;
    this.onChange(this.pendingFormatId);
    this.hide();
  }

  retranslate() {
    const wasVisible = this.backdrop.classList.contains("visible");
    const applied = this.appliedFormatId;
    this.backdrop.remove();
    this._build();
    this.setFormat(applied);
    if (wasVisible) this.show();
  }
}
