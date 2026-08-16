"use strict";
/*
 * app.js
 * The main application: a sidebar wizard on the left, the active form
 * section in the middle, and a live resume preview on the right. Direct
 * port of main_window.py's MainWindow class to plain DOM/JS.
 */

const SECTION_KEYS = [
  "personal", "summary", "skills", "experience", "personal_projects", "education",
  "publications", "certificates", "additional", "generate",
];

function sectionLabels() {
  return {
    personal: I18N.t("nav.personal"), summary: I18N.t("nav.summary"),
    skills: I18N.t("nav.skills"), experience: I18N.t("nav.experience"),
    personal_projects: I18N.t("nav.personal_projects"),
    education: I18N.t("nav.education"), publications: I18N.t("nav.publications"),
    certificates: I18N.t("nav.certificates"), additional: I18N.t("nav.additional"),
    generate: I18N.t("nav.generate"),
  };
}

// ------------------------------------------------------------------ modal --
// opts.cancelText turns this into a two-button confirm dialog — resolves
// true for the primary (OK) button, false for cancel *or* a backdrop click
// (dismissing without committing is always the safe/non-destructive choice).
function showModal(title, message, kind, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const backdrop = DomUtils.el("div", { className: "app-modal-backdrop visible" });
    const panel = DomUtils.el("div", { className: `app-modal app-modal-${kind || "info"}` });
    panel.appendChild(DomUtils.el("h3", { className: "app-modal-title", text: title }));
    const msg = DomUtils.el("p", { className: "app-modal-message" });
    msg.textContent = message;
    panel.appendChild(msg);
    const footer = DomUtils.el("div", { className: "app-modal-footer" });
    if (opts.cancelText) {
      const cancelBtn = DomUtils.button(opts.cancelText, "secondary");
      cancelBtn.addEventListener("click", () => { backdrop.remove(); resolve(false); });
      footer.appendChild(cancelBtn);
    }
    const okBtn = DomUtils.button(opts.okText || I18N.t("dialog.ok"), "primary");
    okBtn.addEventListener("click", () => { backdrop.remove(); resolve(true); });
    footer.appendChild(okBtn);
    panel.appendChild(footer);
    backdrop.appendChild(panel);
    backdrop.addEventListener("mousedown", (ev) => {
      if (ev.target === backdrop) { backdrop.remove(); resolve(false); }
    });
    document.body.appendChild(backdrop);
    okBtn.focus();
  });
}

class ResumeBuilderApp {
  constructor(root) {
    this.root = root;
    this.navButtons = {};
    this.pages = {};
    this.eyebrowLabels = {};
    this.activeField = null;
    this.activeFieldPrecise = null;
    this.language = I18N.DEFAULT_LANGUAGE;
    I18N.setLanguage(this.language);
    this.sectionOrder = [...ResumeData.DEFAULT_SECTION_ORDER];
    this.contactOrder = [...ResumeData.DEFAULT_CONTACT_ORDER];
    this.contactLabels = {};
    this.style = Object.assign({}, ResumeStyle.DEFAULT_STYLE);
    this.styleDialog = null;
    this.format = ResumeFormats.DEFAULT_FORMAT_ID;
    this.formatDialog = null;
    this.photoDataUrl = "";
    this.photoSize = 1;
    this.photoPosition = "above";
    this.currentSectionKey = "personal";
    this._previewToggleButtons = [];

    this._buildLayout();
    this._applyData(SAMPLE_DATA);
    this._selectSection("personal");

    // Both listeners funnel into the same recompute-and-highlight path:
    // focusin catches "which field am I now in" (including the moment a
    // field goes from empty to having a resolvable position), and input
    // catches "the content just changed" so typing into a still-blank
    // field (which has no field path until it has *some* content) picks
    // up its highlight immediately rather than waiting for the next
    // 700ms sync tick.
    document.addEventListener("focusin", (ev) => this._onFocusChanged(ev.target));
    document.addEventListener("input", (ev) => this._onInputChanged(ev.target));

    this._syncTimer = setInterval(() => this._onSyncTick(), 700);
    this._statusTimeout = null;
  }

  // ---------------------------------------------------------------- layout --
  _buildLayout() {
    document.title = I18N.t("app.window_title");
    this.root.innerHTML = "";

    const rootBg = DomUtils.el("div", { className: "root-bg" });
    rootBg.appendChild(this._buildSidebar());

    const splitContainer = DomUtils.el("div", { className: "split-container" });
    const stackArea = DomUtils.el("div", { className: "stack-area" });
    this.stack = DomUtils.el("div", { className: "form-stack" });
    stackArea.appendChild(this.stack);
    this._buildPages();
    splitContainer.appendChild(stackArea);

    const gutter = DomUtils.el("div", { className: "split-gutter" });
    splitContainer.appendChild(gutter);

    const previewArea = DomUtils.el("div", { className: "preview-area" });
    this.previewPanel = new ResumePreview.PreviewPanel(previewArea, {
      onStyleRequested: () => this._openStyleDialog(),
      onFormatRequested: () => this._openFormatDialog(),
    });
    splitContainer.appendChild(previewArea);
    this._wireSplitter(gutter, stackArea, previewArea);

    rootBg.appendChild(splitContainer);
    this.root.appendChild(rootBg);

    this.statusBar = DomUtils.el("div", { className: "status-bar" });
    this.statusLabel = DomUtils.el("span", { className: "status-label", text: I18N.t("status.ready") });
    this.statusBar.appendChild(this.statusLabel);
    this.root.appendChild(this.statusBar);
  }

  _wireSplitter(gutter, stackArea, previewArea) {
    let dragging = false;
    gutter.addEventListener("mousedown", (ev) => {
      dragging = true;
      document.body.classList.add("resizing-h");
      ev.preventDefault();
    });
    window.addEventListener("mousemove", (ev) => {
      if (!dragging) return;
      const containerRect = stackArea.parentElement.getBoundingClientRect();
      const pct = Math.max(0.25, Math.min(0.75, (ev.clientX - containerRect.left) / containerRect.width));
      stackArea.style.flexBasis = `${pct * 100}%`;
      previewArea.style.flexBasis = `${(1 - pct) * 100}%`;
    });
    window.addEventListener("mouseup", () => {
      if (dragging) { dragging = false; document.body.classList.remove("resizing-h"); }
    });
  }

  _buildSidebar() {
    const sidebar = DomUtils.el("div", { className: "sidebar" });

    const brandRow = DomUtils.el("div", { className: "brand-row" });
    const badge = DomUtils.el("div", { className: "brand-badge", text: "R" });
    brandRow.appendChild(badge);
    const brandText = DomUtils.el("div", { className: "brand-text" });
    brandText.appendChild(DomUtils.el("div", { className: "brand-title", text: I18N.t("app.brand_title") }));
    brandText.appendChild(DomUtils.el("div", { className: "brand-tag", text: I18N.t("app.brand_tag") }));
    brandRow.appendChild(brandText);
    sidebar.appendChild(brandRow);

    const langRow = DomUtils.el("div", { className: "lang-row" });
    this.languageSelect = DomUtils.el("select", { className: "sidebar-language-select" });
    Object.entries(I18N.LANGUAGES).forEach(([code, display]) => {
      const opt = DomUtils.el("option", { text: `🌐  ${display}` });
      opt.value = code;
      this.languageSelect.appendChild(opt);
    });
    this.languageSelect.value = this.language;
    this.languageSelect.addEventListener("change", () => this._onLanguageChanged());
    langRow.appendChild(this.languageSelect);
    sidebar.appendChild(langRow);

    sidebar.appendChild(DomUtils.el("div", { className: "sidebar-hairline" }));

    const labels = sectionLabels();
    const totalSteps = SECTION_KEYS.length;

    const personalBtn = this._createNavButton("01", labels.personal, "personal", false);
    sidebar.appendChild(personalBtn.button);
    this.navButtons.personal = personalBtn;

    this.sidebarMovableContainer = DomUtils.el("div", { className: "sidebar-movable-section" });
    sidebar.appendChild(this.sidebarMovableContainer);

    this.sectionOrder.forEach((key, i) => {
      const btn = this._createNavButton(String(i + 2).padStart(2, "0"), labels[key], key, true);
      this.sidebarMovableContainer.appendChild(btn.button);
      this.navButtons[key] = btn;
    });

    const resetRow = DomUtils.el("div", { className: "reset-row" });
    this.resetOrderBtn = DomUtils.el("button", { className: "reset-order-btn", text: I18N.t("common.reset_order") });
    this.resetOrderBtn.type = "button";
    this.resetOrderBtn.addEventListener("click", () => this._resetSectionOrder());
    resetRow.appendChild(this.resetOrderBtn);
    sidebar.appendChild(resetRow);

    const generateBtn = this._createNavButton(String(totalSteps).padStart(2, "0"), labels.generate, "generate", false);
    generateBtn.dotLabel.style.display = "none";
    sidebar.appendChild(generateBtn.button);
    this.navButtons.generate = generateBtn;

    this._updateArrowStates();
    this._updateResetVisibility();

    sidebar.appendChild(DomUtils.el("div", { className: "sidebar-spacer" }));
    sidebar.appendChild(DomUtils.el("div", { className: "sidebar-hairline" }));

    const footerRow = DomUtils.el("div", { className: "footer-row" });
    this.togglePreviewBtn = DomUtils.el("button", { className: "sidebar-ghost-btn", text: I18N.t("common.hide_preview") });
    this.togglePreviewBtn.type = "button";
    this.togglePreviewBtn.addEventListener("click", () => this._togglePreview());
    this._previewToggleButtons = [this.togglePreviewBtn];
    footerRow.appendChild(this.togglePreviewBtn);
    sidebar.appendChild(footerRow);

    sidebar.appendChild(DomUtils.el("div", { className: "sidebar-footer-note", text: I18N.t("app.footer_note") }));

    return sidebar;
  }

  _createNavButton(stepNo, text, key, movable) {
    const button = DomUtils.el("div", { className: `nav-button${movable ? " nav-button-movable" : ""}` });
    button.tabIndex = 0;

    const stepLabel = DomUtils.el("span", { className: "nav-step", text: stepNo });
    const textLabel = DomUtils.el("span", { className: "nav-text", text });
    const dotLabel = DomUtils.el("span", { className: "nav-dot", text: "●" });

    button.appendChild(stepLabel);
    button.appendChild(textLabel);
    button.appendChild(dotLabel);

    let upBtn = null;
    let downBtn = null;
    if (movable) {
      const handle = DomUtils.makeDragHandle(() => button, I18N.t("common.drag_reorder_section"));
      handle.classList.add("nav-drag-handle");
      button.appendChild(handle);

      const arrows = DomUtils.el("div", { className: "nav-reorder-arrows" });
      upBtn = DomUtils.el("button", { className: "nav-reorder-btn", text: "▲" });
      upBtn.type = "button";
      upBtn.title = I18N.t("common.move_section_up");
      upBtn.addEventListener("click", (ev) => { ev.stopPropagation(); this._moveSection(key, -1); });
      downBtn = DomUtils.el("button", { className: "nav-reorder-btn", text: "▼" });
      downBtn.type = "button";
      downBtn.title = I18N.t("common.move_section_down");
      downBtn.addEventListener("click", (ev) => { ev.stopPropagation(); this._moveSection(key, 1); });
      arrows.appendChild(upBtn);
      arrows.appendChild(downBtn);
      button.appendChild(arrows);

      DomUtils.enableDropTarget(button, (srcEl, tgtEl, insertAfter) => {
        const srcKey = Object.keys(this.navButtons).find((k) => this.navButtons[k].button === srcEl);
        if (srcKey) this._onSectionDropped(srcKey, key, insertAfter);
      });
    }

    button.addEventListener("click", (ev) => {
      if (ev.target.closest(".nav-drag-handle, .nav-reorder-btn")) return;
      this._selectSection(key);
    });
    button.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this._selectSection(key); }
    });

    return { button, stepLabel, textLabel, dotLabel, upBtn, downBtn, key };
  }

  _togglePreview() {
    const previewArea = this.root.querySelector(".preview-area");
    const showing = previewArea.style.display !== "none";
    previewArea.style.display = showing ? "none" : "";
    const gutter = this.root.querySelector(".split-gutter");
    if (gutter) gutter.style.display = showing ? "none" : "";
    const text = showing ? I18N.t("common.show_preview") : I18N.t("common.hide_preview");
    this._previewToggleButtons.forEach((btn) => { btn.textContent = text; });
  }

  // ------------------------------------------------------------ language --
  _onLanguageChanged() {
    const code = this.languageSelect.value;
    if (!code || code === this.language) return;
    const data = this._collectData();
    data.language = code;
    this._applyData(data);
  }

  // --------------------------------------------------------- resume style --
  _openStyleDialog() {
    if (this.formatDialog) this.formatDialog.hide();
    if (!this.styleDialog) {
      this.styleDialog = new StyleDialog(this.style, (newStyle) => this._onStyleChanged(newStyle));
    } else {
      this.styleDialog.setStyle(this.style);
    }
    this.styleDialog.show();
  }

  _onStyleChanged(newStyle) {
    this.style = newStyle;
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(I18N.t("status.resume_style_updated"), "ok");
  }

  // -------------------------------------------------------- resume format --
  _openFormatDialog() {
    if (this.styleDialog) this.styleDialog.hide();
    if (!this.formatDialog) {
      this.formatDialog = new FormatDialog(this.format, (id) => this._onFormatChanged(id));
    } else {
      this.formatDialog.setFormat(this.format);
    }
    this.formatDialog.show();
  }

  _onFormatChanged(id) {
    this.format = id;
    // Applying a format also applies its curated font/color pairing, so
    // every layout looks like a finished template out of the box — not
    // every format wearing the same colors. Style Settings still works
    // afterward to customize further on top of it.
    this.style = ResumeFormats.resolveDefaultStyle(id);
    if (this.styleDialog) this.styleDialog.setStyle(this.style);
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(I18N.t("status.resume_format_updated"), "ok");
  }

  // ----------------------------------------------------------------- pages --
  _addPage(key, pageEl) {
    pageEl.classList.add("form-page-item");
    this.stack.appendChild(pageEl);
    this.pages[key] = pageEl;
  }

  _buildPages() {
    this._buildPersonalPage();
    this._buildSummaryPage();
    this._buildSkillsPage();
    this._buildExperiencePage();
    this._buildPersonalProjectsPage();
    this._buildEducationPage();
    this._buildPublicationsPage();
    this._buildCertificatesPage();
    this._buildAdditionalPage();
    this._buildGeneratePage();
  }

  _buildPersonalPage() {
    const { page, body } = DomUtils.makeScrollPage();
    DomUtils.sectionHeader(body, `${I18N.t("app.step")} 1`, I18N.t("personal.step_title"), I18N.t("personal.step_hint"));

    this._buildPhotoUpload(body);
    body.appendChild(DomUtils.el("div", { className: "spacer-22" }));

    this.personalFields = {};
    const fixedFields = [
      ["name", I18N.t("personal.full_name"), "personal.name", I18N.t("personal.name_placeholder")],
      ["title", I18N.t("personal.professional_title"), "personal.title", I18N.t("personal.title_placeholder")],
    ];
    fixedFields.forEach(([key, label, path, placeholder], i) => {
      const edit = DomUtils.makeLineEdit("", { placeholder });
      DomUtils.setFieldPath(edit, () => path);
      DomUtils.addField(body, label, edit, i === 0 ? "" : "field-gap-14");
      this.personalFields[key] = edit;
    });

    body.appendChild(DomUtils.el("div", { className: "spacer-22" }));
    body.appendChild(DomUtils.microLabel(I18N.t("personal.contact_details")));
    body.appendChild(DomUtils.el("div", { className: "spacer-4" }));
    body.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("personal.contact_hint") }));
    body.appendChild(DomUtils.el("div", { className: "spacer-10" }));

    this.contactRowsContainer = DomUtils.el("div", { className: "contact-rows" });
    body.appendChild(this.contactRowsContainer);

    const addContactWrap = DomUtils.el("div", { className: "row-wrap" });
    this.addContactSelect = DomUtils.el("select", { className: "contact-add-select" });
    this.addContactSelect.addEventListener("change", () => {
      const val = this.addContactSelect.value;
      if (!val) return;
      this._addContactField(val === "__custom__" ? null : val);
    });
    addContactWrap.appendChild(this.addContactSelect);
    body.appendChild(addContactWrap);

    this.contactFieldRows = {};
    this._syncContactRows();

    body.appendChild(DomUtils.el("div", { className: "spacer-22" }));
    body.appendChild(DomUtils.hairline());
    body.appendChild(DomUtils.el("div", { className: "spacer-18" }));
    body.appendChild(DomUtils.microLabel(I18N.t("personal.links_title")));
    body.appendChild(DomUtils.el("div", { className: "spacer-4" }));
    body.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("personal.links_hint") }));
    body.appendChild(DomUtils.el("div", { className: "spacer-10" }));
    this.linksList = new LabelValueList(
      I18N.t("personal.add_link"), "links",
      I18N.t("personal.link_label_placeholder"), I18N.t("common.url_placeholder"),
    );
    body.appendChild(this.linksList.el);

    this._addPage("personal", page);
  }

  _contactTypeMeta() {
    return {
      location: { label: I18N.t("personal.location"), placeholder: I18N.t("personal.location_placeholder") },
      phone: { label: I18N.t("personal.phone"), placeholder: I18N.t("personal.phone_placeholder") },
      email: { label: I18N.t("personal.email"), placeholder: I18N.t("personal.email_placeholder") },
      visa: { label: I18N.t("personal.visa"), placeholder: I18N.t("personal.visa_placeholder") },
    };
  }

  _buildContactFieldRow(key) {
    const isCustom = !ResumeData.DEFAULT_CONTACT_ORDER.includes(key);
    const meta = this._contactTypeMeta()[key];

    const row = DomUtils.el("div", { className: "row reorderable-row" });
    row.appendChild(DomUtils.makeDragHandle(() => row));

    const content = DomUtils.el("div", { className: "contact-row-content" });
    let labelEdit = null;
    if (isCustom) {
      labelEdit = DomUtils.makeLineEdit(this.contactLabels[key] || "", {
        bold: true, placeholder: I18N.t("personal.contact_label_placeholder"),
      });
      labelEdit.classList.add("contact-custom-label-input");
      labelEdit.addEventListener("input", () => { this.contactLabels[key] = labelEdit.value; });
      content.appendChild(labelEdit);
    } else {
      content.appendChild(DomUtils.microLabel(meta.label));
    }
    const placeholder = isCustom ? I18N.t("personal.contact_value_placeholder") : meta.placeholder;
    const edit = DomUtils.makeLineEdit("", { placeholder });
    DomUtils.setFieldPath(edit, () => "personal.contact", () => `personal.contact.${key}`);
    content.appendChild(edit);
    row.appendChild(content);

    const { wrap: arrows, upBtn, downBtn } = DomUtils.makeReorderArrows((delta) => this._moveContactField(key, delta));
    row.appendChild(arrows);

    const removeBtn = DomUtils.removeIconButton(I18N.t("common.remove"));
    removeBtn.addEventListener("click", () => this._removeContactField(key));
    row.appendChild(removeBtn);

    this.contactRowsContainer.appendChild(row);
    this.personalFields[key] = edit;
    this.contactFieldRows[key] = { row, edit, labelEdit, upBtn, downBtn };

    DomUtils.enableDropTarget(row, (srcEl, tgtEl, insertAfter) => {
      const srcKey = Object.keys(this.contactFieldRows).find((k) => this.contactFieldRows[k].row === srcEl);
      if (srcKey) this._onContactFieldDropped(srcKey, key, insertAfter);
    });

    return this.contactFieldRows[key];
  }

  _moveContactField(key, delta) {
    const order = this.contactOrder;
    const i = order.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this._afterContactOrderChanged();
  }

  _onContactFieldDropped(sourceKey, targetKey, insertAfter) {
    if (sourceKey === targetKey) return;
    const order = this.contactOrder;
    const filtered = order.filter((k) => k !== sourceKey);
    const idx = filtered.indexOf(targetKey);
    filtered.splice(insertAfter ? idx + 1 : idx, 0, sourceKey);
    this.contactOrder = filtered;
    this._afterContactOrderChanged();
  }

  _addContactField(key) {
    let newKey = key;
    if (!newKey) {
      this._contactCustomSeq = (this._contactCustomSeq || 0) + 1;
      newKey = `custom_${Date.now()}_${this._contactCustomSeq}`;
      this.contactLabels[newKey] = "";
    }
    if (this.contactOrder.includes(newKey)) return;
    this.contactOrder.push(newKey);
    this._syncContactRows();
    const entry = this.contactFieldRows[newKey];
    if (entry) (entry.labelEdit || entry.edit).focus();
  }

  _removeContactField(key) {
    if (!this.contactFieldRows[key]) return;
    this.contactOrder = this.contactOrder.filter((k) => k !== key);
    delete this.contactLabels[key];
    this._syncContactRows();
  }

  _afterContactOrderChanged() {
    this._syncContactRows();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(I18N.t("status.contact_order_updated"), "ok");
  }

  // Reconciles the contact-rows DOM with this.contactOrder/this.contactLabels:
  // removes rows for keys no longer present, builds rows for new keys, then
  // reorders — used for reordering, add/remove, and full data loads alike.
  _syncContactRows() {
    Object.keys(this.contactFieldRows).forEach((key) => {
      if (!this.contactOrder.includes(key)) {
        this.contactFieldRows[key].row.remove();
        delete this.contactFieldRows[key];
        delete this.personalFields[key];
      }
    });
    this.contactOrder.forEach((key) => {
      if (!this.contactFieldRows[key]) this._buildContactFieldRow(key);
    });
    DomUtils.refreshChildOrder(this.contactRowsContainer, this.contactOrder, (k) => this.contactFieldRows[k].row);
    this._updateContactArrows();
    this._updateAddContactOptions();
  }

  _updateAddContactOptions() {
    const select = this.addContactSelect;
    select.innerHTML = "";
    const placeholderOpt = DomUtils.el("option", { text: I18N.t("personal.add_contact_field") });
    placeholderOpt.value = "";
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    select.appendChild(placeholderOpt);

    const meta = this._contactTypeMeta();
    ResumeData.DEFAULT_CONTACT_ORDER.forEach((key) => {
      if (this.contactOrder.includes(key)) return;
      const opt = DomUtils.el("option", { text: meta[key].label });
      opt.value = key;
      select.appendChild(opt);
    });

    const customOpt = DomUtils.el("option", { text: I18N.t("personal.custom_contact_field") });
    customOpt.value = "__custom__";
    select.appendChild(customOpt);
  }

  _updateContactArrows() {
    DomUtils.updateRowArrowStates(this.contactOrder.map((k) => this.contactFieldRows[k]));
  }

  // ------------------------------------------------------------- photo ----
  _buildPhotoUpload(body) {
    const row = DomUtils.el("div", { className: "photo-upload-row" });

    this.photoPreview = DomUtils.el("div", { className: "photo-preview" });
    this.photoPreviewImg = DomUtils.el("img", { className: "photo-preview-img" });
    this.photoPreview.appendChild(this.photoPreviewImg);
    this.photoPreview.addEventListener("click", () => this.photoFileInput.click());
    row.appendChild(this.photoPreview);

    const controls = DomUtils.el("div", { className: "photo-upload-controls" });
    this.uploadPhotoBtn = DomUtils.button(I18N.t("personal.upload_photo"), "secondary", { small: true });
    this.uploadPhotoBtn.addEventListener("click", () => this.photoFileInput.click());
    this.removePhotoBtn = DomUtils.button(I18N.t("personal.remove_photo"), "ghost", { small: true });
    this.removePhotoBtn.style.display = "none";
    this.removePhotoBtn.addEventListener("click", () => this._removePhoto());
    const btnRow = DomUtils.el("div", { className: "photo-upload-btn-row" });
    btnRow.appendChild(this.uploadPhotoBtn);
    btnRow.appendChild(this.removePhotoBtn);
    controls.appendChild(btnRow);
    controls.appendChild(DomUtils.el("p", { className: "hint photo-upload-hint", text: I18N.t("personal.photo_hint") }));
    row.appendChild(controls);

    this.photoFileInput = DomUtils.el("input");
    this.photoFileInput.type = "file";
    this.photoFileInput.accept = "image/*";
    this.photoFileInput.className = "photo-file-input";
    this.photoFileInput.style.display = "none";
    this.photoFileInput.addEventListener("change", (ev) => this._onPhotoFileChosen(ev));
    row.appendChild(this.photoFileInput);

    body.appendChild(row);

    this.photoAdjustRow = DomUtils.el("div", { className: "photo-adjust-row" });

    const sizeBlock = DomUtils.el("div", { className: "photo-adjust-block" });
    const sizeLabelRow = DomUtils.el("div", { className: "photo-adjust-label-row" });
    sizeLabelRow.appendChild(DomUtils.microLabel(I18N.t("personal.photo_size")));
    this.photoSizeValueLabel = DomUtils.el("span", { className: "photo-adjust-value", text: "100%" });
    sizeLabelRow.appendChild(this.photoSizeValueLabel);
    sizeBlock.appendChild(sizeLabelRow);
    this.photoSizeInput = DomUtils.el("input");
    this.photoSizeInput.type = "range";
    this.photoSizeInput.min = "60";
    this.photoSizeInput.max = "180";
    this.photoSizeInput.step = "5";
    this.photoSizeInput.value = "100";
    this.photoSizeInput.className = "photo-size-slider";
    this.photoSizeInput.addEventListener("input", () => this._onPhotoSizeChanged());
    sizeBlock.appendChild(this.photoSizeInput);
    this.photoAdjustRow.appendChild(sizeBlock);

    const posBlock = DomUtils.el("div", { className: "photo-adjust-block" });
    posBlock.appendChild(DomUtils.microLabel(I18N.t("personal.photo_position")));
    const posBtnRow = DomUtils.el("div", { className: "photo-position-btn-row" });
    this.photoPositionBtns = {};
    [["above", I18N.t("personal.photo_position_above")],
     ["left", I18N.t("personal.photo_position_left")],
     ["right", I18N.t("personal.photo_position_right")]].forEach(([value, label]) => {
      const btn = DomUtils.button(label, "secondary", { small: true });
      btn.addEventListener("click", () => this._onPhotoPositionChanged(value));
      posBtnRow.appendChild(btn);
      this.photoPositionBtns[value] = btn;
    });
    posBlock.appendChild(posBtnRow);
    posBlock.appendChild(DomUtils.el("p", { className: "hint photo-position-hint", text: I18N.t("personal.photo_position_hint") }));
    this.photoAdjustRow.appendChild(posBlock);

    body.appendChild(this.photoAdjustRow);

    this._renderPhotoPreview();
  }

  _onPhotoFileChosen(ev) {
    const file = ev.target.files && ev.target.files[0];
    this.photoFileInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this._setPhoto(this._normalizePhoto(img));
      };
      img.onerror = () => {
        showModal(I18N.t("dialog.error_loading_photo_title"), I18N.t("dialog.error_loading_photo_msg"), "error");
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      showModal(I18N.t("dialog.error_loading_photo_title"), I18N.t("dialog.error_loading_photo_msg"), "error");
    };
    reader.readAsDataURL(file);
  }

  _normalizePhoto(img) {
    const SIZE = 480;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(SIZE / img.width, SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    // White matte first: a transparent-PNG source would otherwise composite
    // onto black in some browsers once toDataURL flattens it to JPEG.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  _setPhoto(dataUrl) {
    this.photoDataUrl = dataUrl;
    this._renderPhotoPreview();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(I18N.t("status.photo_updated"), "ok");
  }

  _removePhoto() {
    this.photoDataUrl = "";
    this._renderPhotoPreview();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(I18N.t("status.photo_removed"), "ok");
  }

  _renderPhotoPreview() {
    const hasPhoto = !!this.photoDataUrl;
    this.photoPreview.classList.toggle("has-photo", hasPhoto);
    this.photoPreviewImg.src = hasPhoto ? this.photoDataUrl : "";
    this.uploadPhotoBtn.textContent = hasPhoto ? I18N.t("personal.change_photo") : I18N.t("personal.upload_photo");
    this.removePhotoBtn.style.display = hasPhoto ? "" : "none";
    this.photoAdjustRow.style.display = hasPhoto ? "" : "none";
    this.photoSizeInput.value = String(Math.round(this.photoSize * 100));
    this.photoSizeValueLabel.textContent = `${Math.round(this.photoSize * 100)}%`;
    Object.entries(this.photoPositionBtns).forEach(([value, btn]) => {
      btn.classList.toggle("btn-photo-position-active", value === this.photoPosition);
    });
  }

  _onPhotoSizeChanged() {
    this.photoSize = Number(this.photoSizeInput.value) / 100;
    this.photoSizeValueLabel.textContent = `${Math.round(this.photoSize * 100)}%`;
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
  }

  _onPhotoPositionChanged(value) {
    this.photoPosition = value;
    this._renderPhotoPreview();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
  }

  _buildSummaryPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.summary = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 2`, I18N.t("summary.step_title"), I18N.t("summary.step_hint"));
    this.summaryEdit = DomUtils.makeTextArea("", { rows: 12, placeholder: I18N.t("summary.placeholder") });
    this.summaryEdit.classList.add("summary-textarea");
    DomUtils.setFieldPath(this.summaryEdit, () => "summary");
    body.appendChild(this.summaryEdit);
    this._addPage("summary", page);
  }

  _buildSkillsPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.skills = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 3`, I18N.t("skills.step_title"), I18N.t("skills.step_hint"));
    this.skillsList = new LabelValueList(
      I18N.t("skills.add_row"), "skills",
      I18N.t("skills.label_placeholder"), I18N.t("skills.value_placeholder"),
    );
    body.appendChild(this.skillsList.el);
    this._addPage("skills", page);
  }

  _buildExperiencePage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.experience = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 4`, I18N.t("experience.step_title"), I18N.t("experience.step_hint"));
    this.experienceList = new ExperienceList();
    body.appendChild(this.experienceList.el);
    this._addPage("experience", page);
  }

  _buildPersonalProjectsPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.personal_projects = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 5`, I18N.t("personal_projects.step_title"), I18N.t("personal_projects.step_hint"));
    this.personalProjectsList = new PersonalProjectList();
    body.appendChild(this.personalProjectsList.el);
    this._addPage("personal_projects", page);
  }

  _buildEducationPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.education = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 6`, I18N.t("education.step_title"), I18N.t("education.step_hint"));
    this.educationList = new EducationList();
    body.appendChild(this.educationList.el);
    this._addPage("education", page);
  }

  _buildPublicationsPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.publications = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 7`, I18N.t("publications.step_title"), I18N.t("publications.step_hint"));
    this.publicationsList = new PublicationList();
    body.appendChild(this.publicationsList.el);
    this._addPage("publications", page);
  }

  _buildCertificatesPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.certificates = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 8`, I18N.t("certificates.step_title"), I18N.t("certificates.step_hint"));
    this.certificatesList = new LabelValueList(
      I18N.t("certificates.add_row"), "certificates",
      I18N.t("certificates.label_placeholder"), I18N.t("certificates.value_placeholder"),
    );
    body.appendChild(this.certificatesList.el);
    this._addPage("certificates", page);
  }

  _buildAdditionalPage() {
    const { page, body } = DomUtils.makeScrollPage();
    this.eyebrowLabels.additional = DomUtils.sectionHeader(
      body, `${I18N.t("app.step")} 9`, I18N.t("additional.step_title"), I18N.t("additional.step_hint"));
    this.additionalList = new LabelValueList(
      I18N.t("additional.add_row"), "additional",
      I18N.t("additional.label_placeholder"), I18N.t("additional.value_placeholder"),
    );
    body.appendChild(this.additionalList.el);
    this._addPage("additional", page);
  }

  _buildGeneratePage() {
    const { page, body } = DomUtils.makeScrollPage();
    DomUtils.sectionHeader(body, `${I18N.t("app.step")} 10`, I18N.t("generate.step_title"), I18N.t("generate.step_hint"));

    body.appendChild(DomUtils.microLabel(I18N.t("generate.live_preview")));
    body.appendChild(DomUtils.el("div", { className: "spacer-8" }));
    body.appendChild(DomUtils.el("p", { className: "hint", text: I18N.t("generate.preview_hint") }));
    body.appendChild(DomUtils.el("div", { className: "spacer-8" }));
    const previewRow = DomUtils.el("div", { className: "button-row" });
    const showPreviewBtn = DomUtils.button(I18N.t("common.hide_preview"), "secondary");
    showPreviewBtn.addEventListener("click", () => this._togglePreview());
    this._previewToggleButtons.push(showPreviewBtn);
    previewRow.appendChild(showPreviewBtn);
    body.appendChild(previewRow);

    body.appendChild(DomUtils.el("div", { className: "spacer-26" }));
    body.appendChild(DomUtils.hairline());
    body.appendChild(DomUtils.el("div", { className: "spacer-22" }));

    body.appendChild(DomUtils.microLabel(I18N.t("generate.draft")));
    body.appendChild(DomUtils.el("div", { className: "spacer-8" }));
    const draftRow = DomUtils.el("div", { className: "button-row" });
    const saveBtn = DomUtils.button(I18N.t("generate.save_draft"), "secondary");
    const loadBtn = DomUtils.button(I18N.t("generate.load_draft"), "secondary");
    saveBtn.addEventListener("click", () => this.saveDraft());
    loadBtn.addEventListener("click", () => this.loadDraft());
    draftRow.appendChild(saveBtn);
    draftRow.appendChild(loadBtn);
    body.appendChild(draftRow);

    this.loadDraftInput = DomUtils.el("input");
    this.loadDraftInput.type = "file";
    this.loadDraftInput.accept = "application/json,.json";
    this.loadDraftInput.style.display = "none";
    this.loadDraftInput.addEventListener("change", (ev) => this._onDraftFileChosen(ev));
    body.appendChild(this.loadDraftInput);

    body.appendChild(DomUtils.el("div", { className: "spacer-26" }));
    body.appendChild(DomUtils.hairline());
    body.appendChild(DomUtils.el("div", { className: "spacer-22" }));

    body.appendChild(DomUtils.microLabel(I18N.t("generate.export")));
    body.appendChild(DomUtils.el("div", { className: "spacer-8" }));
    const exportRow = DomUtils.el("div", { className: "button-row" });
    const docxBtn = DomUtils.button(I18N.t("generate.generate_docx"), "primary");
    const pdfBtn = DomUtils.button(I18N.t("generate.generate_pdf"), "gold");
    docxBtn.addEventListener("click", () => this.generateDocx());
    pdfBtn.addEventListener("click", () => this.generatePdf());
    this.genDocxBtn = docxBtn;
    this.genPdfBtn = pdfBtn;
    exportRow.appendChild(docxBtn);
    exportRow.appendChild(pdfBtn);
    body.appendChild(exportRow);

    this._addPage("generate", page);
  }

  // --------------------------------------------------------------- nav ----
  _selectSection(key) {
    this.currentSectionKey = key;
    Object.entries(this.navButtons).forEach(([k, nb]) => {
      nb.button.classList.toggle("active", k === key);
    });
    Object.entries(this.pages).forEach(([k, pageEl]) => {
      pageEl.classList.toggle("active", k === key);
    });
    this._refreshNavDots();
  }

  // Shared by the sidebar's "filled" dots and the incomplete-resume warning
  // shown before generating — one definition of "this section has real
  // user content" so the two never drift apart.
  _computeSectionFilled(data) {
    // getData() no longer strips blank rows (the live preview needs their
    // position to align example placeholders 1:1 with real rows — see
    // preview.js), so "has content" here means "some row is actually
    // filled in", not just "the array is non-empty".
    return {
      // photo_size/photo_position always carry a non-empty default (e.g.
      // photo_size defaults to 1), so they'd read as "filled" even with
      // nothing entered — excluded so this only goes true on real content.
      // A link only counts once it has an actual value: the label alone
      // ("LinkedIn") ships pre-filled on empty rows as a suggested type,
      // not something the user typed.
      personal: Object.entries(data.personal).some(([k, v]) => k !== "photo_size" && k !== "photo_position" && v)
        || data.links.some((r) => r.value),
      summary: !!data.summary,
      skills: data.skills.some((r) => r.label || r.value),
      experience: data.experience.some((j) => j.title || j.company),
      personal_projects: data.personal_projects.some((p) => p.name || p.url || (p.bullets || []).some((b) => b.trim())),
      education: data.education.some((e) => e.degree || e.school || e.meta || e.thesis),
      publications: data.publications.some((p) => p.title || p.detail),
      certificates: data.certificates.some((r) => r.label || r.value),
      additional: data.additional.some((r) => r.label || r.value),
    };
  }

  _refreshNavDots(data) {
    data = data || this._collectData();
    const filled = this._computeSectionFilled(data);
    Object.entries(filled).forEach(([key, isFilled]) => {
      this.navButtons[key].dotLabel.classList.toggle("filled", isFilled);
    });
  }

  // Personal info beyond the (already-required) name: professional title,
  // any contact detail (location/phone/email/visa/custom), or a link. Kept
  // separate from _computeSectionFilled's "personal" flag, which goes true
  // the moment name is filled and so can't tell the generate-time warning
  // apart from "title and contact info are still blank placeholders".
  _personalDetailsFilled(data) {
    const skip = new Set(["name", "photo_size", "photo_position"]);
    return Object.entries(data.personal).some(([k, v]) => !skip.has(k) && v)
      || data.links.some((r) => r.value);
  }

  // Returns the translated labels of every section that's still empty (and
  // therefore only showing example placeholder text in the preview) —
  // used to warn before generating so placeholder text doesn't surprise
  // someone by silently vanishing from their downloaded file.
  _incompleteSections(data) {
    const filled = this._computeSectionFilled(data);
    const labels = sectionLabels();
    const missing = [];
    if (!this._personalDetailsFilled(data)) missing.push(I18N.t("dialog.missing_contact_label"));
    SECTION_KEYS.forEach((key) => {
      if (key === "personal" || key === "generate") return;
      if (!filled[key]) missing.push(labels[key]);
    });
    return missing;
  }

  // ----------------------------------------------------- section order ----
  _moveSection(key, delta) {
    const order = this.sectionOrder;
    const i = order.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this._afterOrderChanged(I18N.t("status.section_order_updated"));
  }

  _onSectionDropped(srcKey, targetKey, insertAfter) {
    const order = this.sectionOrder;
    if (srcKey === targetKey || !order.includes(srcKey) || !order.includes(targetKey)) return;
    const filtered = order.filter((k) => k !== srcKey);
    const idx = filtered.indexOf(targetKey);
    filtered.splice(insertAfter ? idx + 1 : idx, 0, srcKey);
    this.sectionOrder = filtered;
    this._afterOrderChanged(I18N.t("status.section_order_updated"));
  }

  _resetSectionOrder() {
    this.sectionOrder = [...ResumeData.DEFAULT_SECTION_ORDER];
    this._afterOrderChanged(I18N.t("status.section_order_reset"));
  }

  _afterOrderChanged(statusMessage) {
    this._rebuildSidebarOrder();
    this._renumberSteps();
    this._updateArrowStates();
    this._updateResetVisibility();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
    this._setStatus(statusMessage, "ok");
  }

  _rebuildSidebarOrder() {
    DomUtils.refreshChildOrder(this.sidebarMovableContainer, this.sectionOrder, (k) => this.navButtons[k].button);
  }

  _renumberSteps() {
    this.sectionOrder.forEach((key, i) => {
      const stepNo = i + 2;
      this.navButtons[key].stepLabel.textContent = String(stepNo).padStart(2, "0");
      const eyebrow = this.eyebrowLabels[key];
      if (eyebrow) eyebrow.textContent = `${I18N.t("app.step")} ${stepNo}`.toUpperCase();
    });
  }

  _updateArrowStates() {
    const last = this.sectionOrder.length - 1;
    this.sectionOrder.forEach((key, i) => {
      const nb = this.navButtons[key];
      if (nb.upBtn) nb.upBtn.disabled = i === 0;
      if (nb.downBtn) nb.downBtn.disabled = i === last;
    });
  }

  _updateResetVisibility() {
    const isDefault = this.sectionOrder.length === ResumeData.DEFAULT_SECTION_ORDER.length
      && this.sectionOrder.every((k, i) => k === ResumeData.DEFAULT_SECTION_ORDER[i]);
    this.resetOrderBtn.style.display = isDefault ? "none" : "";
  }

  _onSyncTick() {
    const data = this._collectData();
    this._refreshNavDots(data);
    this.previewPanel.updateData(data, this.activeField, this.activeFieldPrecise);
  }

  _resolveFieldPath(target) {
    const pathFn = target && target._fieldPathFn;
    const path = pathFn ? pathFn() : null;
    const preciseFn = target && target._fieldPreciseFn;
    const precise = preciseFn ? preciseFn() : path;
    return { path, precise };
  }

  _applyActiveField(path, precise) {
    this.activeField = path;
    this.activeFieldPrecise = precise;
    const data = this._collectData();
    this._refreshNavDots(data);
    this.previewPanel.updateData(data, path, precise);
  }

  _onFocusChanged(target) {
    const { path, precise } = this._resolveFieldPath(target);
    if (path === this.activeField && precise === this.activeFieldPrecise) return;
    this._applyActiveField(path, precise);
  }

  _onInputChanged(target) {
    // Unlike _onFocusChanged, this must NOT skip when the field path is
    // unchanged: field paths are positional ("skills.0.label"), so typing
    // into an already-focused field never changes its path — only its
    // content — and the preview still needs to re-render to show it.
    const { path, precise } = this._resolveFieldPath(target);
    this._applyActiveField(path, precise);
  }

  // --------------------------------------------------------- data i/o -----
  _collectData() {
    const personal = {};
    Object.entries(this.personalFields).forEach(([k, input]) => { personal[k] = input.value.trim(); });
    personal.photo = this.photoDataUrl || "";
    personal.photo_size = this.photoSize;
    personal.photo_position = this.photoPosition;
    return {
      personal,
      links: this.linksList.getData(),
      section_order: [...this.sectionOrder],
      contact_order: [...this.contactOrder],
      contact_labels: Object.assign({}, this.contactLabels),
      language: this.language,
      style: Object.assign({}, this.style),
      format: this.format,
      summary: this.summaryEdit.value.trim(),
      skills: this.skillsList.getData(),
      experience: this.experienceList.getData(),
      personal_projects: this.personalProjectsList.getData(),
      education: this.educationList.getData(),
      publications: this.publicationsList.getData(),
      certificates: this.certificatesList.getData(),
      additional: this.additionalList.getData(),
    };
  }

  _applyData(data) {
    this.sectionOrder = ResumeData.resolveSectionOrder(data);
    this.contactOrder = ResumeData.resolveContactOrder(data);
    this.contactLabels = Object.assign({}, data.contact_labels || {});
    this.format = ResumeFormats.resolveFormatId(data);
    this.photoDataUrl = (data.personal && data.personal.photo) || "";
    const rawPhotoSize = Number(data.personal && data.personal.photo_size);
    this.photoSize = Number.isFinite(rawPhotoSize) && rawPhotoSize > 0 ? Math.max(0.6, Math.min(1.8, rawPhotoSize)) : 1;
    const rawPhotoPosition = data.personal && data.personal.photo_position;
    this.photoPosition = ["above", "left", "right"].includes(rawPhotoPosition) ? rawPhotoPosition : "above";

    let lang = data.language || I18N.DEFAULT_LANGUAGE;
    if (!I18N.LANGUAGES[lang]) lang = I18N.DEFAULT_LANGUAGE;
    if (lang !== this.language) {
      this.language = lang;
      I18N.setLanguage(lang);
      const currentKey = this.currentSectionKey || "personal";
      this._buildLayout();
      this._selectSection(currentKey);
      if (this.styleDialog) this.styleDialog.retranslate();
      if (this.formatDialog) this.formatDialog.retranslate();
    } else {
      this.languageSelect.value = this.language;
    }

    this._rebuildSidebarOrder();
    this._renumberSteps();
    this._updateArrowStates();
    this._updateResetVisibility();
    this._syncContactRows();

    this.style = ResumeStyle.resolveStyle(data);
    if (this.styleDialog) this.styleDialog.setStyle(this.style);
    if (this.formatDialog) this.formatDialog.setFormat(this.format);
    this._renderPhotoPreview();

    const personal = data.personal || {};
    Object.entries(this.personalFields).forEach(([k, input]) => { input.value = personal[k] || ""; });
    this.linksList.loadData(data.links || []);
    this.summaryEdit.value = data.summary || "";
    this.skillsList.loadData(data.skills || []);
    this.experienceList.loadData(data.experience || []);
    this.personalProjectsList.loadData(data.personal_projects || []);
    this.educationList.loadData(data.education || []);
    this.publicationsList.loadData(data.publications || []);
    this.certificatesList.loadData(data.certificates || []);
    this.additionalList.loadData(data.additional || []);
    this._refreshNavDots();
    this.previewPanel.updateData(this._collectData(), this.activeField, this.activeFieldPrecise, true);
  }

  _setStatus(text, kind) {
    this.statusLabel.className = `status-label${kind ? ` status-${kind}` : ""}`;
    this.statusLabel.textContent = text;
    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    if (kind) {
      this._statusTimeout = setTimeout(() => this._setStatus(I18N.t("status.ready"), ""), 6000);
    }
  }

  saveDraft() {
    const data = this._collectData();
    const filename = `${(data.personal.name || "resume").trim().replace(/\s+/g, "_")}_draft.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this._setStatus(I18N.t("status.draft_saved", { path: filename }), "ok");
  }

  loadDraft() {
    this.loadDraftInput.value = "";
    this.loadDraftInput.click();
  }

  _onDraftFileChosen(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        showModal(I18N.t("dialog.error_loading_draft"), String(err && err.message ? err.message : err), "error");
        return;
      }
      this._applyData(data);
      this._selectSection("personal");
      this._setStatus(I18N.t("status.draft_loaded", { path: file.name }), "ok");
    };
    reader.onerror = () => {
      showModal(I18N.t("dialog.error_loading_draft"), String(reader.error), "error");
    };
    reader.readAsText(file);
  }

  async _validateName(data) {
    if (!data.personal.name) {
      await showModal(I18N.t("dialog.missing_name_title"), I18N.t("dialog.missing_name_msg"), "warning");
      this._selectSection("personal");
      return false;
    }
    return true;
  }

  _firstIncompleteSectionKey(data) {
    if (!this._personalDetailsFilled(data)) return "personal";
    const filled = this._computeSectionFilled(data);
    return SECTION_KEYS.find((k) => k !== "personal" && k !== "generate" && !filled[k]) || "personal";
  }

  // Called right after _validateName (name alone is required to generate at
  // all) — this is the softer warning: generating is still allowed with
  // just a name, but placeholder text in every other still-empty section
  // silently won't appear in the download, and that's easy to miss since
  // the live preview shows the placeholders as if they were real content.
  async _confirmIncompleteFields(data) {
    const missing = this._incompleteSections(data);
    if (missing.length === 0) return true;
    const list = missing.map((label) => `•  ${label}`).join("\n");
    const proceed = await showModal(
      I18N.t("dialog.incomplete_title"),
      I18N.t("dialog.incomplete_msg", { missing: list }),
      "warning",
      { cancelText: I18N.t("dialog.go_back_fill"), okText: I18N.t("dialog.save_anyway") },
    );
    if (!proceed) this._selectSection(this._firstIncompleteSectionKey(data));
    return proceed;
  }

  async generateDocx() {
    const data = this._collectData();
    if (!(await this._validateName(data))) return;
    if (!(await this._confirmIncompleteFields(data))) return;
    const filename = `${data.personal.name.trim().replace(/\s+/g, "_")}_Resume.docx`;
    this.genDocxBtn.disabled = true;
    this._setStatus(I18N.t("status.generating_docx"));
    try {
      await ResumeDocx.downloadDocx(data, filename);
      this._setStatus(I18N.t("status.resume_generated", { path: filename }), "ok");
      await showModal(I18N.t("dialog.success_title"), I18N.t("dialog.success_msg", { path: filename }), "success");
    } catch (err) {
      this._setStatus(I18N.t("status.docx_failed"), "err");
      await showModal(I18N.t("dialog.error_generating_resume"), String(err && err.message ? err.message : err), "error");
    } finally {
      this.genDocxBtn.disabled = false;
    }
  }

  async generatePdf() {
    const data = this._collectData();
    if (!(await this._validateName(data))) return;
    if (!(await this._confirmIncompleteFields(data))) return;
    const filename = `${data.personal.name.trim().replace(/\s+/g, "_")}_Resume`;
    this.genPdfBtn.disabled = true;
    this._setStatus(I18N.t("status.generating_pdf"));
    try {
      await ResumePdf.downloadPdf(data, filename);
      this._setStatus(I18N.t("status.ready"));
    } catch (err) {
      this._setStatus(I18N.t("status.pdf_failed"), "err");
      await showModal(I18N.t("dialog.error_generating_pdf"), String(err && err.message ? err.message : err), "error");
    } finally {
      this.genPdfBtn.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.resumeApp = new ResumeBuilderApp(document.getElementById("app"));
});
