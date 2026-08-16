"use strict";
/*
 * widgets.js
 * The dynamic "repeating card" list widgets that make up the form: skill/
 * certificate/additional-info rows, project cards, experience cards,
 * education cards, and publication cards. Mirrors the classes in widgets.py
 * (LabelValueList, ProjectList, ExperienceList, EducationList,
 * PublicationList) and the data shapes used by docx-export.js.
 */

const D = DomUtils;

// ============================================================ label/value ==
class LabelValueList {
  constructor(addText, fieldPrefix, labelPlaceholder, valuePlaceholder) {
    this.rows = [];
    this.fieldPrefix = fieldPrefix || "";
    this.labelPlaceholder = labelPlaceholder !== undefined ? labelPlaceholder : I18N.t("common.label_placeholder");
    this.valuePlaceholder = valuePlaceholder !== undefined ? valuePlaceholder : I18N.t("common.details_placeholder");

    this.el = D.el("div", { className: "lv-list" });
    this.container = D.el("div", { className: "lv-rows" });
    this.el.appendChild(this.container);

    const addBtn = D.button(addText !== undefined ? addText : I18N.t("common.add_row"), "ghost");
    addBtn.addEventListener("click", () => this.addRow());
    const rowWrap = D.el("div", { className: "row-wrap" });
    rowWrap.appendChild(addBtn);
    this.el.appendChild(rowWrap);
  }

  addRow(label, value) {
    const frame = D.el("div", { className: "row reorderable-row" });
    frame.appendChild(D.makeDragHandle(() => frame));

    const labelEdit = D.makeLineEdit(label, { bold: true, placeholder: this.labelPlaceholder });
    labelEdit.classList.add("lv-label-input");
    const valueEdit = D.makeLineEdit(value, { placeholder: this.valuePlaceholder });
    valueEdit.classList.add("lv-value-input");

    frame.appendChild(labelEdit);
    frame.appendChild(valueEdit);

    const { wrap: arrows, upBtn, downBtn } = D.makeReorderArrows((delta) => this._moveRow(entry, delta));
    frame.appendChild(arrows);

    const removeBtn = D.removeIconButton(I18N.t("common.remove_row"));
    frame.appendChild(removeBtn);

    this.container.appendChild(frame);
    const entry = { frame, label: labelEdit, value: valueEdit, upBtn, downBtn };

    if (this.fieldPrefix) {
      const rowPath = () => {
        const idx = this.rows.indexOf(entry);
        return idx >= 0 ? `${this.fieldPrefix}.${idx}` : null;
      };
      const rowPrecisePath = (suffix) => () => {
        const idx = this.rows.indexOf(entry);
        return idx >= 0 ? `${this.fieldPrefix}.${idx}.${suffix}` : null;
      };
      D.setFieldPath(labelEdit, rowPath, rowPrecisePath("label"));
      D.setFieldPath(valueEdit, rowPath, rowPrecisePath("value"));
    }

    removeBtn.addEventListener("click", () => this.removeRow(entry));
    D.enableDropTarget(frame, (srcEl, tgtEl, insertAfter) => this._onRowDropped(srcEl, tgtEl, insertAfter));

    this.rows.push(entry);
    this._updateArrows();
    return entry;
  }

  removeRow(entry) {
    entry.frame.remove();
    this.rows = this.rows.filter((r) => r !== entry);
    this._updateArrows();
  }

  _moveRow(entry, delta) {
    const i = this.rows.indexOf(entry);
    const j = i + delta;
    if (j < 0 || j >= this.rows.length) return;
    [this.rows[i], this.rows[j]] = [this.rows[j], this.rows[i]];
    this._rebuildOrder();
  }

  _onRowDropped(srcEl, tgtEl, insertAfter) {
    const src = this.rows.find((r) => r.frame === srcEl);
    const tgt = this.rows.find((r) => r.frame === tgtEl);
    if (!src || !tgt || src === tgt) return;
    this.rows = this.rows.filter((r) => r !== src);
    const idx = this.rows.indexOf(tgt);
    this.rows.splice(insertAfter ? idx + 1 : idx, 0, src);
    this._rebuildOrder();
  }

  _rebuildOrder() {
    D.refreshChildOrder(this.container, this.rows, (r) => r.frame);
    this._updateArrows();
  }

  _updateArrows() {
    D.updateRowArrowStates(this.rows);
  }

  getData() {
    return this.rows.map((r) => ({ label: r.label.value.trim(), value: r.value.value.trim() }));
  }

  loadData(items) {
    [...this.rows].forEach((r) => this.removeRow(r));
    (items || []).forEach((item) => this.addRow(item.label || "", item.value || ""));
  }
}

// ================================================================ projects ==
class ProjectList {
  constructor() {
    this.cards = [];
    this.companyIndexFn = null;

    this.el = D.el("div", { className: "project-list" });
    this.container = D.el("div", { className: "project-cards" });
    this.el.appendChild(this.container);

    const addBtn = D.button(I18N.t("experience.add_project"), "ghost-small", { small: true });
    addBtn.addEventListener("click", () => this.addCard());
    const row = D.el("div", { className: "row-wrap" });
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  addCard(name, bullets, url) {
    const frame = D.el("div", { className: "subcard reorderable-row" });

    const topRow = D.el("div", { className: "card-top-row" });
    topRow.appendChild(D.makeDragHandle(() => frame));
    const spacer = D.el("div", { className: "spacer-flex" });
    topRow.appendChild(spacer);
    const { wrap: arrows, upBtn, downBtn } = D.makeReorderArrows((delta) => this._moveCard(entry, delta));
    topRow.appendChild(arrows);
    frame.appendChild(topRow);

    const nameEdit = D.makeLineEdit(name, { bold: true, placeholder: I18N.t("experience.project_name_placeholder") });
    D.addField(frame, I18N.t("experience.project_name"), nameEdit);

    const urlEdit = D.makeLineEdit(url, { placeholder: I18N.t("common.url_placeholder") });
    D.addField(frame, I18N.t("experience.project_link"), urlEdit);

    const bulletsEdit = D.makeTextArea(bullets, { rows: 4, placeholder: I18N.t("experience.bullets_placeholder") });
    bulletsEdit.classList.add("bullets-textarea");
    D.addField(frame, I18N.t("experience.bullets"), bulletsEdit);

    const removeBtn = D.button(I18N.t("experience.remove_project"), "danger", { small: true });
    const btnRow = D.el("div", { className: "btn-row-right" });
    btnRow.appendChild(removeBtn);
    frame.appendChild(btnRow);

    this.container.appendChild(frame);
    const entry = { frame, name: nameEdit, url: urlEdit, bullets: bulletsEdit, upBtn, downBtn };

    const projPath = (suffix) => () => {
      const companyIdx = this.companyIndexFn ? this.companyIndexFn() : null;
      if (companyIdx === null || companyIdx === undefined) return null;
      const projIdx = this.cards.indexOf(entry);
      if (projIdx < 0) return null;
      return `experience.${companyIdx}.projects.${projIdx}.${suffix}`;
    };
    D.setFieldPath(nameEdit, projPath("heading"));
    D.setFieldPath(urlEdit, projPath("heading"));
    D.setFieldPath(bulletsEdit, projPath("bullets"));

    removeBtn.addEventListener("click", () => this.removeCard(entry));
    D.enableDropTarget(frame, (srcEl, tgtEl, insertAfter) => this._onCardDropped(srcEl, tgtEl, insertAfter));

    this.cards.push(entry);
    this._updateArrows();
    return entry;
  }

  removeCard(entry) {
    entry.frame.remove();
    this.cards = this.cards.filter((c) => c !== entry);
    this._updateArrows();
  }

  _moveCard(entry, delta) {
    const i = this.cards.indexOf(entry);
    const j = i + delta;
    if (j < 0 || j >= this.cards.length) return;
    [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    this._rebuildOrder();
  }

  _onCardDropped(srcEl, tgtEl, insertAfter) {
    const src = this.cards.find((c) => c.frame === srcEl);
    const tgt = this.cards.find((c) => c.frame === tgtEl);
    if (!src || !tgt || src === tgt) return;
    this.cards = this.cards.filter((c) => c !== src);
    const idx = this.cards.indexOf(tgt);
    this.cards.splice(insertAfter ? idx + 1 : idx, 0, src);
    this._rebuildOrder();
  }

  _rebuildOrder() {
    D.refreshChildOrder(this.container, this.cards, (c) => c.frame);
    this._updateArrows();
  }

  _updateArrows() {
    D.updateRowArrowStates(this.cards);
  }

  getData() {
    return this.cards.map((c) => ({
      name: c.name.value.trim(),
      url: c.url.value.trim(),
      bullets: c.bullets.value.split("\n"),
    }));
  }

  loadData(items) {
    [...this.cards].forEach((c) => this.removeCard(c));
    (items || []).forEach((item) => this.addCard(item.name || "", (item.bullets || []).join("\n"), item.url || ""));
  }
}

// =============================================================== experience ==
class ExperienceList {
  constructor() {
    this.cards = [];

    this.el = D.el("div", { className: "experience-list" });
    this.container = D.el("div", { className: "experience-cards" });
    this.el.appendChild(this.container);

    const addBtn = D.button(I18N.t("experience.add_company"), "primary");
    addBtn.addEventListener("click", () => this.addCard());
    const row = D.el("div", { className: "row-wrap" });
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  addCard(company, title, startDate, endDate, projects, companyUrl, employmentType) {
    const frame = D.el("div", { className: "card" });

    const topRow = D.el("div", { className: "card-top-row" });
    const badge = D.badgeLabel(this.cards.length + 1, "main");
    topRow.appendChild(badge);
    topRow.appendChild(D.el("div", { className: "spacer-flex" }));
    const removeBtn = D.button(I18N.t("experience.remove_company"), "danger", { small: true });
    topRow.appendChild(removeBtn);
    frame.appendChild(topRow);

    const fieldsRow = D.el("div", { className: "fields-row" });
    const companyBox = D.el("div", { className: "field-col field-col-2" });
    companyBox.appendChild(D.microLabel(I18N.t("experience.company")));
    const companyEdit = D.makeLineEdit(company, { bold: true, placeholder: I18N.t("experience.company_placeholder") });
    companyBox.appendChild(companyEdit);

    const titleBox = D.el("div", { className: "field-col field-col-2" });
    titleBox.appendChild(D.microLabel(I18N.t("experience.job_title")));
    const titleEdit = D.makeLineEdit(title, { bold: true, placeholder: I18N.t("experience.job_title_placeholder") });
    titleBox.appendChild(titleEdit);

    const employmentBox = D.el("div", { className: "field-col field-col-1" });
    employmentBox.appendChild(D.microLabel(I18N.t("experience.employment_type")));
    const employmentEdit = D.makeSelect(ResumeData.employmentTypeItems(), ResumeData.normalizeEmploymentType(employmentType || ""));
    employmentBox.appendChild(employmentEdit);

    fieldsRow.appendChild(companyBox);
    fieldsRow.appendChild(titleBox);
    fieldsRow.appendChild(employmentBox);
    frame.appendChild(fieldsRow);

    const datesRow = D.el("div", { className: "fields-row" });
    const startBox = D.el("div", { className: "field-col field-col-1" });
    startBox.appendChild(D.microLabel(I18N.t("experience.start_date")));
    const startEdit = D.makeLineEdit(startDate, { placeholder: I18N.t("experience.start_date_placeholder") });
    startBox.appendChild(startEdit);

    const endBox = D.el("div", { className: "field-col field-col-1" });
    endBox.appendChild(D.microLabel(I18N.t("experience.end_date")));
    const endEdit = D.makeLineEdit(endDate, { placeholder: I18N.t("experience.end_date_placeholder") });
    endBox.appendChild(endEdit);

    datesRow.appendChild(startBox);
    datesRow.appendChild(endBox);
    frame.appendChild(datesRow);

    const companyUrlEdit = D.makeLineEdit(companyUrl, { placeholder: I18N.t("common.url_placeholder") });
    D.addField(frame, I18N.t("experience.company_link"), companyUrlEdit);

    frame.appendChild(D.el("div", { className: "spacer-14" }));
    frame.appendChild(D.hairline());
    frame.appendChild(D.el("div", { className: "spacer-12" }));
    frame.appendChild(D.microLabel(I18N.t("experience.projects_heading")));
    frame.appendChild(D.el("div", { className: "spacer-6" }));

    const projectsList = new ProjectList();
    frame.appendChild(projectsList.el);
    if (projects && projects.length) {
      projectsList.loadData(projects);
    } else {
      projectsList.addCard();
    }

    this.container.appendChild(frame);
    const entry = {
      frame, badge, company: companyEdit, title: titleEdit,
      start_date: startEdit, end_date: endEdit, employment_type: employmentEdit,
      company_url: companyUrlEdit, projects: projectsList,
    };

    const expPath = (suffix) => () => {
      const idx = this.cards.indexOf(entry);
      return idx >= 0 ? `experience.${idx}.${suffix}` : null;
    };
    D.setFieldPath(titleEdit, expPath("title"));
    D.setFieldPath(companyEdit, expPath("company"));
    D.setFieldPath(companyUrlEdit, expPath("company"));
    D.setFieldPath(startEdit, expPath("dates"), expPath("dates.start"));
    D.setFieldPath(endEdit, expPath("dates"), expPath("dates.end"));
    D.setFieldPath(employmentEdit, expPath("employment_type"), expPath("employment_type"));
    projectsList.companyIndexFn = () => {
      const idx = this.cards.indexOf(entry);
      return idx >= 0 ? idx : null;
    };

    removeBtn.addEventListener("click", () => this.removeCard(entry));
    this.cards.push(entry);
    return entry;
  }

  removeCard(entry) {
    entry.frame.remove();
    this.cards = this.cards.filter((c) => c !== entry);
    this._renumber();
  }

  _renumber() {
    this.cards.forEach((c, i) => { c.badge.textContent = String(i + 1); });
  }

  getData() {
    return this.cards.map((c) => ({
      company: c.company.value.trim(),
      title: c.title.value.trim(),
      company_url: c.company_url.value.trim(),
      start_date: c.start_date.value.trim(),
      end_date: c.end_date.value.trim(),
      employment_type: c.employment_type.value || "",
      projects: c.projects.getData(),
    }));
  }

  loadData(items) {
    [...this.cards].forEach((c) => this.removeCard(c));
    (items || []).forEach((item) => {
      let startDate = item.start_date || "";
      let endDate = item.end_date || "";
      if (!startDate && !endDate && item.dates) {
        const legacy = item.dates.trim();
        const seps = [" – ", " - ", "–", "-"];
        const sep = seps.find((s) => legacy.includes(s));
        if (sep) {
          const parts = legacy.split(sep);
          startDate = parts[0].trim();
          endDate = parts.slice(1).join(sep).trim();
        } else {
          startDate = legacy;
        }
      }
      this.addCard(item.company || "", item.title || "", startDate, endDate,
                   item.projects || [], item.company_url || "", item.employment_type || "");
    });
  }
}

// ======================================================= personal projects ==
class PersonalProjectList {
  constructor() {
    this.cards = [];

    this.el = D.el("div", { className: "personal-projects-list" });
    this.container = D.el("div", { className: "personal-projects-cards" });
    this.el.appendChild(this.container);

    const addBtn = D.button(I18N.t("personal_projects.add"), "primary");
    addBtn.addEventListener("click", () => this.addCard());
    const row = D.el("div", { className: "row-wrap" });
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  addCard(name, url, bullets) {
    const frame = D.el("div", { className: "card" });

    const topRow = D.el("div", { className: "card-top-row" });
    const badge = D.badgeLabel(this.cards.length + 1, "main");
    topRow.appendChild(badge);
    topRow.appendChild(D.el("div", { className: "spacer-flex" }));
    const removeBtn = D.button(I18N.t("personal_projects.remove"), "danger", { small: true });
    topRow.appendChild(removeBtn);
    frame.appendChild(topRow);

    const nameEdit = D.makeLineEdit(name, { bold: true, placeholder: I18N.t("personal_projects.project_name_placeholder") });
    D.addField(frame, I18N.t("personal_projects.project_name"), nameEdit, "field-gap-10");

    const urlEdit = D.makeLineEdit(url, { placeholder: I18N.t("common.url_placeholder") });
    D.addField(frame, I18N.t("personal_projects.project_link"), urlEdit);

    const bulletsEdit = D.makeTextArea(bullets, { rows: 4, placeholder: I18N.t("personal_projects.bullets_placeholder") });
    bulletsEdit.classList.add("bullets-textarea");
    D.addField(frame, I18N.t("personal_projects.bullets"), bulletsEdit);

    this.container.appendChild(frame);
    const entry = { frame, badge, name: nameEdit, url: urlEdit, bullets: bulletsEdit };

    const projPath = (suffix) => () => {
      const idx = this.cards.indexOf(entry);
      return idx >= 0 ? `personal_projects.${idx}.${suffix}` : null;
    };
    D.setFieldPath(nameEdit, projPath("heading"));
    D.setFieldPath(urlEdit, projPath("heading"));
    D.setFieldPath(bulletsEdit, projPath("bullets"));

    removeBtn.addEventListener("click", () => this.removeCard(entry));
    this.cards.push(entry);
    return entry;
  }

  removeCard(entry) {
    entry.frame.remove();
    this.cards = this.cards.filter((c) => c !== entry);
    this._renumber();
  }

  _renumber() {
    this.cards.forEach((c, i) => { c.badge.textContent = String(i + 1); });
  }

  getData() {
    return this.cards.map((c) => ({
      name: c.name.value.trim(),
      url: c.url.value.trim(),
      bullets: c.bullets.value.split("\n"),
    }));
  }

  loadData(items) {
    [...this.cards].forEach((c) => this.removeCard(c));
    (items || []).forEach((item) => this.addCard(item.name || "", item.url || "", (item.bullets || []).join("\n")));
  }
}

// ================================================================ education ==
class EducationList {
  constructor() {
    this.cards = [];

    this.el = D.el("div", { className: "education-list" });
    this.container = D.el("div", { className: "education-cards" });
    this.el.appendChild(this.container);

    const addBtn = D.button(I18N.t("education.add"), "primary");
    addBtn.addEventListener("click", () => this.addCard());
    const row = D.el("div", { className: "row-wrap" });
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  addCard(degree, school, meta, schoolUrl, thesis) {
    const frame = D.el("div", { className: "card" });

    const topRow = D.el("div", { className: "card-top-row" });
    const badge = D.badgeLabel(this.cards.length + 1, "main");
    topRow.appendChild(badge);
    topRow.appendChild(D.el("div", { className: "spacer-flex" }));
    const removeBtn = D.button(I18N.t("common.remove"), "danger", { small: true });
    topRow.appendChild(removeBtn);
    frame.appendChild(topRow);

    const degreeEdit = D.makeLineEdit(degree, { bold: true, placeholder: I18N.t("education.degree_placeholder") });
    D.addField(frame, I18N.t("education.degree"), degreeEdit, "field-gap-10");

    const schoolEdit = D.makeLineEdit(school, { placeholder: I18N.t("education.school_placeholder") });
    D.addField(frame, I18N.t("education.school"), schoolEdit);

    const schoolUrlEdit = D.makeLineEdit(schoolUrl, { placeholder: I18N.t("common.url_placeholder") });
    D.addField(frame, I18N.t("education.school_link"), schoolUrlEdit);

    const metaEdit = D.makeLineEdit(meta, { placeholder: I18N.t("education.meta_placeholder") });
    D.addField(frame, I18N.t("education.meta"), metaEdit);

    const thesisWrap = D.el("div", { className: "field-block" });
    frame.appendChild(thesisWrap);

    this.container.appendChild(frame);
    const entry = {
      frame, badge, degree: degreeEdit, school: schoolEdit, meta: metaEdit,
      school_url: schoolUrlEdit, thesis: null, thesisWrap,
    };

    const eduPath = (suffix) => () => {
      const idx = this.cards.indexOf(entry);
      return idx >= 0 ? `education.${idx}.${suffix}` : null;
    };
    entry.eduPath = eduPath;
    D.setFieldPath(degreeEdit, eduPath("line"), eduPath("degree"));
    D.setFieldPath(schoolEdit, eduPath("line"), eduPath("school"));
    D.setFieldPath(schoolUrlEdit, eduPath("line"), eduPath("school"));
    D.setFieldPath(metaEdit, eduPath("meta"));

    removeBtn.addEventListener("click", () => this.removeCard(entry));
    this.cards.push(entry);

    this._setThesisVisible(entry, !!(thesis || "").trim(), thesis || "", false);

    return entry;
  }

  // Thesis / dissertation title is optional per card: shown as a "+ Add"
  // ghost button until the user opts in, and can be removed again (clearing
  // its value) — not everyone writing a thesis/dissertation.
  _setThesisVisible(entry, visible, value, focus) {
    const wrap = entry.thesisWrap;
    wrap.innerHTML = "";
    if (visible) {
      const labelRow = D.el("div", { className: "field-label-row" });
      labelRow.appendChild(D.microLabel(I18N.t("education.thesis")));
      const removeBtn = D.removeIconButton(I18N.t("common.remove"));
      removeBtn.addEventListener("click", () => this._setThesisVisible(entry, false, "", false));
      labelRow.appendChild(removeBtn);
      wrap.appendChild(labelRow);

      const thesisEdit = D.makeLineEdit(value, { placeholder: I18N.t("education.thesis_placeholder") });
      D.setFieldPath(thesisEdit, entry.eduPath("thesis"));
      wrap.appendChild(thesisEdit);

      entry.thesis = thesisEdit;
      if (focus) thesisEdit.focus();
    } else {
      const addBtn = D.button(I18N.t("education.add_thesis"), "ghost-small", { small: true });
      addBtn.addEventListener("click", () => this._setThesisVisible(entry, true, "", true));
      wrap.appendChild(addBtn);
      entry.thesis = null;
    }
  }

  removeCard(entry) {
    entry.frame.remove();
    this.cards = this.cards.filter((c) => c !== entry);
    this._renumber();
  }

  _renumber() {
    this.cards.forEach((c, i) => { c.badge.textContent = String(i + 1); });
  }

  getData() {
    return this.cards.map((c) => ({
      degree: c.degree.value.trim(),
      school: c.school.value.trim(),
      school_url: c.school_url.value.trim(),
      meta: c.meta.value.trim(),
      thesis: c.thesis ? c.thesis.value.trim() : "",
    }));
  }

  loadData(items) {
    [...this.cards].forEach((c) => this.removeCard(c));
    (items || []).forEach((item) => this.addCard(
      item.degree || "", item.school || "", item.meta || "", item.school_url || "", item.thesis || "",
    ));
  }
}

// ============================================================= publications ==
class PublicationList {
  constructor() {
    this.cards = [];

    this.el = D.el("div", { className: "publications-list" });
    this.container = D.el("div", { className: "publications-cards" });
    this.el.appendChild(this.container);

    const addBtn = D.button(I18N.t("publications.add"), "primary");
    addBtn.addEventListener("click", () => this.addCard());
    const row = D.el("div", { className: "row-wrap" });
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  addCard(title, detail) {
    const frame = D.el("div", { className: "card" });

    const topRow = D.el("div", { className: "card-top-row" });
    const badge = D.badgeLabel(this.cards.length + 1, "main");
    topRow.appendChild(badge);
    topRow.appendChild(D.el("div", { className: "spacer-flex" }));
    const removeBtn = D.button(I18N.t("common.remove"), "danger", { small: true });
    topRow.appendChild(removeBtn);
    frame.appendChild(topRow);

    const titleEdit = D.makeLineEdit(title, { bold: true, placeholder: I18N.t("publications.title_placeholder") });
    D.addField(frame, I18N.t("publications.title"), titleEdit, "field-gap-10");

    const detailEdit = D.makeLineEdit(detail, { placeholder: I18N.t("publications.detail_placeholder") });
    D.addField(frame, I18N.t("publications.detail"), detailEdit);

    this.container.appendChild(frame);
    const entry = { frame, badge, title: titleEdit, detail: detailEdit };

    const pubPath = (suffix) => () => {
      const idx = this.cards.indexOf(entry);
      return idx >= 0 ? `publications.${idx}.${suffix}` : null;
    };
    D.setFieldPath(titleEdit, pubPath("title"));
    D.setFieldPath(detailEdit, pubPath("detail"));

    removeBtn.addEventListener("click", () => this.removeCard(entry));
    this.cards.push(entry);
    return entry;
  }

  removeCard(entry) {
    entry.frame.remove();
    this.cards = this.cards.filter((c) => c !== entry);
    this._renumber();
  }

  _renumber() {
    this.cards.forEach((c, i) => { c.badge.textContent = String(i + 1); });
  }

  getData() {
    return this.cards.map((c) => ({ title: c.title.value.trim(), detail: c.detail.value.trim() }));
  }

  loadData(items) {
    [...this.cards].forEach((c) => this.removeCard(c));
    (items || []).forEach((item) => {
      if (typeof item === "object" && item !== null) {
        this.addCard(item.title || "", item.detail || "");
      } else {
        this.addCard(String(item), "");
      }
    });
  }
}
