"use strict";
/*
 * style-dialog.js
 * The "Resume Style" panel — font, sizes, colors (one per distinct text role
 * in the resume, not just two shared "accent" tones), page background.
 * Unlike the original design, changes are staged: adjusting a control only
 * updates the dialog's own form, not the live resume, until "Apply" is
 * clicked. "Close" (footer button, header ✕, or clicking the backdrop)
 * discards the staged edits and reverts the form to whatever style is
 * actually applied — mirroring FormatDialog's Apply/Close convention.
 * "Reset to Default" is the one exception: it stays instant, exactly as
 * before, applying immediately without needing a separate Apply click.
 * Draggable via its header and always reopens centered — see
 * DomUtils.makeDraggable/resetDraggedPosition.
 */

function sizeFields() {
  return [
    ["size_name", I18N.t("style.size_name")],
    ["size_title", I18N.t("style.size_title")],
    ["size_heading", I18N.t("style.size_heading")],
    ["size_body", I18N.t("style.size_body")],
    ["size_meta", I18N.t("style.size_meta")],
  ];
}

// Grouped so the now-10-color palette stays scannable instead of one long
// undifferentiated list — each group is one visual region of the resume.
function colorGroups() {
  return [
    {
      label: I18N.t("style.group_header"),
      fields: [
        ["accent_color", I18N.t("style.color_accent")],
        ["heading_color", I18N.t("style.color_heading")],
        ["accent_soft_color", I18N.t("style.color_accent_soft")],
      ],
    },
    {
      label: I18N.t("style.group_entries"),
      fields: [
        ["company_color", I18N.t("style.color_company")],
        ["job_title_color", I18N.t("style.color_job_title")],
      ],
    },
    {
      label: I18N.t("style.group_links"),
      fields: [
        ["link_color", I18N.t("style.color_link")],
        ["bullet_color", I18N.t("style.color_bullet")],
        ["highlight_color", I18N.t("style.color_highlight")],
      ],
    },
    {
      label: I18N.t("style.group_body"),
      fields: [
        ["text_color", I18N.t("style.color_text")],
        ["muted_color", I18N.t("style.color_muted")],
        ["background_color", I18N.t("style.color_background")],
      ],
    },
  ];
}

class StyleDialog {
  constructor(style, onChange) {
    this.onChange = onChange;
    this._updating = false;
    this.sizeInputs = {};
    this.colorInputs = {};
    this._build();
    this.setStyle(style);
  }

  _build() {
    this.backdrop = DomUtils.el("div", { className: "style-dialog-backdrop" });
    this.backdrop.addEventListener("mousedown", (ev) => {
      if (ev.target === this.backdrop) this._cancel();
    });

    const panel = DomUtils.el("div", { className: "style-dialog" });
    this.panel = panel;

    const header = DomUtils.el("div", { className: "style-dialog-header" });
    header.appendChild(DomUtils.el("h3", { className: "style-dialog-title", text: I18N.t("style.title") }));
    const actions = DomUtils.addWindowControls(panel, header, this.backdrop);
    const closeX = DomUtils.el("button", { className: "style-dialog-close-x", text: "✕" });
    closeX.type = "button";
    closeX.addEventListener("click", () => this._cancel());
    actions.appendChild(closeX);
    header.appendChild(actions);
    panel.appendChild(header);
    DomUtils.makeDraggable(panel, header);
    DomUtils.makeResizable(panel);

    panel.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("style.hint") }));
    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));

    panel.appendChild(DomUtils.microLabel(I18N.t("style.presets")));
    panel.appendChild(DomUtils.el("div", { className: "spacer-6" }));
    this.presetSelect = DomUtils.el("select", { className: "field-input field-select" });
    const chooseOpt = DomUtils.el("option", { text: I18N.t("style.choose_preset") });
    chooseOpt.value = "";
    this.presetSelect.appendChild(chooseOpt);
    Object.keys(ResumeStyle.STYLE_PRESETS).forEach((name) => {
      const opt = DomUtils.el("option", { text: name });
      opt.value = name;
      this.presetSelect.appendChild(opt);
    });
    panel.appendChild(this.presetSelect);
    panel.appendChild(DomUtils.el("div", { className: "spacer-18" }));
    panel.appendChild(DomUtils.hairline());
    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));

    panel.appendChild(DomUtils.microLabel(I18N.t("style.font")));
    panel.appendChild(DomUtils.el("div", { className: "spacer-6" }));
    this.fontSelect = DomUtils.el("select", { className: "field-input field-select" });
    ResumeStyle.FONT_CHOICES.forEach((font) => {
      const opt = DomUtils.el("option", { text: font });
      opt.value = font;
      this.fontSelect.appendChild(opt);
    });
    panel.appendChild(this.fontSelect);
    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));

    panel.appendChild(DomUtils.microLabel(I18N.t("style.font_sizes")));
    panel.appendChild(DomUtils.el("div", { className: "spacer-6" }));
    const sizeForm = DomUtils.el("div", { className: "style-form" });
    sizeFields().forEach(([key, label]) => {
      const [lo, hi] = ResumeStyle.SIZE_BOUNDS[key];
      const row = DomUtils.el("div", { className: "style-form-row" });
      row.appendChild(DomUtils.el("label", { className: "style-form-label", text: label }));
      const input = DomUtils.el("input", { className: "style-size-input" });
      input.type = "number";
      input.min = lo;
      input.max = hi;
      row.appendChild(input);
      row.appendChild(DomUtils.el("span", { className: "style-form-suffix", text: "pt" }));
      sizeForm.appendChild(row);
      this.sizeInputs[key] = input;
    });
    panel.appendChild(sizeForm);

    panel.appendChild(DomUtils.el("div", { className: "spacer-18" }));
    panel.appendChild(DomUtils.hairline());
    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));

    panel.appendChild(DomUtils.microLabel(I18N.t("style.colors")));
    panel.appendChild(DomUtils.el("div", { className: "spacer-6" }));
    colorGroups().forEach((group, gi) => {
      if (gi > 0) panel.appendChild(DomUtils.el("div", { className: "spacer-10" }));
      panel.appendChild(DomUtils.el("div", { className: "style-color-group-label", text: group.label }));
      const colorForm = DomUtils.el("div", { className: "style-form" });
      group.fields.forEach(([key, label]) => {
        const row = DomUtils.el("div", { className: "style-form-row" });
        row.appendChild(DomUtils.el("label", { className: "style-form-label", text: label }));
        const input = DomUtils.el("input", { className: "style-color-input" });
        input.type = "color";
        input.title = I18N.t("style.choose_color");
        row.appendChild(input);
        colorForm.appendChild(row);
        this.colorInputs[key] = input;
      });
      panel.appendChild(colorForm);
    });

    panel.appendChild(DomUtils.el("div", { className: "spacer-10" }));
    panel.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("style.bg_note") }));

    panel.appendChild(DomUtils.el("div", { className: "spacer-16" }));
    panel.appendChild(DomUtils.hairline());
    panel.appendChild(DomUtils.el("div", { className: "spacer-14" }));

    const footer = DomUtils.el("div", { className: "style-dialog-footer" });
    const resetBtn = DomUtils.button(I18N.t("style.reset_default"), "secondary");
    resetBtn.addEventListener("click", () => this._resetToDefault());
    const closeBtn = DomUtils.button(I18N.t("style.close"), "secondary");
    closeBtn.addEventListener("click", () => this._cancel());
    const applyBtn = DomUtils.button(I18N.t("style.apply"), "primary");
    applyBtn.addEventListener("click", () => this._apply());
    footer.appendChild(resetBtn);
    footer.appendChild(DomUtils.el("div", { className: "spacer-flex" }));
    footer.appendChild(closeBtn);
    footer.appendChild(applyBtn);
    panel.appendChild(footer);

    this.backdrop.appendChild(panel);
    document.body.appendChild(this.backdrop);

    // These only update the form itself now — nothing reaches the live
    // resume until _apply() runs.
    this.presetSelect.addEventListener("change", () => this._onPresetPicked());
    this.fontSelect.addEventListener("change", () => {});
    Object.values(this.sizeInputs).forEach((input) => input.addEventListener("input", () => {}));
    Object.values(this.colorInputs).forEach((input) => input.addEventListener("input", () => {}));
  }

  show() {
    DomUtils.resetDraggedPosition(this.panel);
    this.panel._resetWindowState();
    this.backdrop.classList.add("visible");
  }

  hide() {
    this.backdrop.classList.remove("visible");
  }

  // Sets both the applied and the on-screen form — used whenever the style
  // actually changes for real (dialog opening, a format's default style
  // being applied elsewhere) so the form never shows stale values.
  setStyle(style) {
    this._appliedStyle = Object.assign({}, ResumeStyle.DEFAULT_STYLE, style);
    this._fillForm(this._appliedStyle);
  }

  _fillForm(style) {
    this._updating = true;
    this.fontSelect.value = style.font_family || ResumeStyle.DEFAULT_STYLE.font_family;
    Object.entries(this.sizeInputs).forEach(([key, input]) => {
      input.value = style[key] !== undefined ? style[key] : ResumeStyle.DEFAULT_STYLE[key];
    });
    Object.entries(this.colorInputs).forEach(([key, input]) => {
      input.value = style[key] || ResumeStyle.DEFAULT_STYLE[key];
    });
    this.presetSelect.value = "";
    this._updating = false;
  }

  _currentStyle() {
    const style = { font_family: this.fontSelect.value };
    Object.entries(this.sizeInputs).forEach(([key, input]) => { style[key] = Number(input.value); });
    Object.entries(this.colorInputs).forEach(([key, input]) => { style[key] = input.value.toUpperCase(); });
    return style;
  }

  _onPresetPicked() {
    if (this._updating) return;
    const name = this.presetSelect.value;
    if (!name) return;
    const preset = ResumeStyle.STYLE_PRESETS[name];
    if (!preset) return;
    this._fillForm(Object.assign({}, ResumeStyle.DEFAULT_STYLE, preset));
  }

  _cancel() {
    this._fillForm(this._appliedStyle);
    this.hide();
  }

  _apply() {
    const style = this._currentStyle();
    this._appliedStyle = style;
    this.onChange(style);
    this.hide();
  }

  // Deliberately NOT staged, per explicit product decision — resets and
  // applies immediately, same as it always has.
  _resetToDefault() {
    this.setStyle(ResumeStyle.DEFAULT_STYLE);
    this.onChange(Object.assign({}, ResumeStyle.DEFAULT_STYLE));
  }

  retranslate() {
    const wasVisible = this.backdrop.classList.contains("visible");
    const applied = this._appliedStyle;
    this.backdrop.remove();
    this._build();
    this.setStyle(applied);
    if (wasVisible) this.show();
  }
}
