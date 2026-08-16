"use strict";
/*
 * preview.js
 * Renders the resume data as an HTML "sheet" — the same navy/brass palette
 * and type-scale as docx-export.js's .docx output — and shows it live in an
 * iframe, so editing the form updates a real, formatted preview of the
 * finished resume. Direct port of preview.py's render_resume_html() plus a
 * PreviewPanel class standing in for the Qt PreviewPanel widget.
 *
 * Layout ("format", see resume-formats.js) is orthogonal to color/font/size
 * ("style", see resume-style.js): every format below is a small config
 * object consumed by exactly two structural skeletons — buildSingleColumnHtml
 * and buildSidebarHtml — plus a handful of swappable header/heading builders.
 * A format is data, not a bespoke renderer.
 */

const ResumePreview = (() => {
  const CONTACT_ICONS = { location: "📍", phone: "☎", email: "✉", visa: "🛂" };
  function contactIcon(key) { return CONTACT_ICONS[key] || "▪"; }

  function buildPageCss(style, formatDef) {
    formatDef = formatDef || ResumeFormats.FORMAT_BY_ID[ResumeFormats.DEFAULT_FORMAT_ID];
    const accentHex = style.accent_color;
    const goldHex = style.highlight_color;
    const sidebarCfg = formatDef.sidebar;

    let css = `
:root {
    --accent: ${style.accent_color};
    --accent-soft: ${style.accent_soft_color};
    --heading: ${style.heading_color};
    --company: ${style.company_color};
    --job-title: ${style.job_title_color};
    --link: ${style.link_color};
    --bullet: ${style.bullet_color};
    --gold: ${style.highlight_color};
    --muted: ${style.muted_color};
    --text: ${style.text_color};
    --page-bg: ${style.background_color};
    --line: #C9D2D8;
    --size-name: ${style.size_name}pt;
    --size-title: ${style.size_title}pt;
    --size-heading: ${style.size_heading}pt;
    --size-body: ${style.size_body}pt;
    --size-meta: ${style.size_meta}pt;
}
* { box-sizing: border-box; }
html, body {
    margin: 0;
    background: #DDE2E7;
    font-family: ${ResumeStyle.cssFontStack(style.font_family)};
}
body {
    display: flex;
    justify-content: center;
    padding: 26px 18px 60px;
}
.sheet {
    width: 8.5in;
    min-height: 11in;
    padding: 0.65in;
    background: var(--page-bg);
    color: var(--text);
    font-size: var(--size-body);
    line-height: 1.38;
    box-shadow: 0 8px 30px rgba(15, 30, 45, 0.22);
    position: relative;
}
.sheet-empty {
    color: var(--muted);
    font-style: italic;
    text-align: center;
    margin-top: 2.2in;
    font-size: 12pt;
}
.sheet-name {
    text-align: center;
    font-size: var(--size-name);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin-bottom: 2pt;
}
.sheet-title {
    text-align: center;
    font-size: var(--size-title);
    font-style: italic;
    color: var(--accent-soft);
    margin-bottom: 7pt;
}
.sheet-contact {
    text-align: center;
    font-size: var(--size-meta);
    color: var(--muted);
}
.sheet-header-divider {
    padding-bottom: 8pt;
    margin-bottom: 12pt;
    border-bottom: 0.75pt solid var(--line);
}
.sheet-links {
    text-align: center;
    font-size: var(--size-meta);
    color: var(--muted);
    margin-top: 3pt;
}
.sheet-link-anchor, .sheet-links a {
    color: var(--link);
    font-weight: 600;
    text-decoration: none;
}
.sheet-contact-icon { margin-right: 3pt; }
.sheet-heading {
    font-size: var(--size-heading);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 16pt 0 6pt;
    page-break-after: avoid;
}
.heading-underline { color: var(--heading); border-bottom: 1.5pt solid var(--gold); padding-bottom: 5pt; }
.heading-bar { background: var(--heading); color: #FFFFFF; padding: 5pt 9pt; border-radius: 2pt; }
.heading-pill { color: var(--heading); border-bottom: 0.75pt solid var(--line); padding-bottom: 6pt; }
.heading-pill .sheet-heading-pill-inner {
    display: inline-block; background: var(--gold); color: var(--heading);
    padding: 3pt 11pt; border-radius: 999pt; letter-spacing: 0.06em;
}
.heading-left-border { color: var(--heading); border-left: 3pt solid var(--gold); padding-left: 8pt; }
.heading-boxed { color: var(--heading); border: 1pt solid var(--gold); padding: 5pt 9pt; }
.sheet-body { font-size: var(--size-body); margin-bottom: 4pt; white-space: pre-wrap; }
.sheet-label-value { font-size: var(--size-body); margin-bottom: 4pt; }
.sheet-lv-label { font-weight: 700; color: var(--accent-soft); }
.sheet-block { page-break-inside: avoid; margin-bottom: 2pt; }
.sheet-job-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 12pt;
}
.sheet-job-head-line { display: inline-flex; align-items: baseline; flex-wrap: wrap; }
.sheet-entry-company { font-size: var(--size-heading); font-weight: 700; color: var(--company); }
.sheet-job-type { font-size: var(--size-meta); font-style: italic; color: var(--muted); white-space: nowrap; }
.sheet-job-dates { font-size: var(--size-meta); font-style: italic; color: var(--muted); white-space: nowrap; padding-left: 10pt; }
.sheet-entry-role { margin: 1pt 0 3pt; font-size: var(--size-body); font-weight: 700; font-style: italic; color: var(--job-title); }
.sheet-entry-role a, .sheet-project-link, .sheet-edu-school a, .sheet-entry-company a {
    color: var(--link);
    text-decoration: none;
}
.sheet-edu-school-plain { color: var(--muted); }
.sheet-project-heading { font-size: var(--size-body); font-weight: 700; color: var(--text); margin: 8pt 0 2pt 0.10in; }
.sheet-bullet-mark { color: var(--bullet); font-weight: 700; }
.sheet-bullet { font-size: var(--size-body); margin: 0 0 3pt 0.20in; }
.sheet-bullet-indent { margin-left: 0.32in; }
.sheet-bullet-line { margin: 0 0 3pt 0; }
.sheet-bullet-line:last-child { margin-bottom: 0; }
.sheet-edu-line { font-size: var(--size-body); margin-top: 1pt; }
.sheet-edu-degree { font-weight: 700; }
.sheet-edu-sep { color: var(--muted); }
.sheet-meta { font-size: var(--size-meta); font-style: italic; color: var(--muted); margin: 1pt 0 8pt; }
.sheet-pub-title { font-weight: 700; }
.sheet-pub-detail { margin-left: 0.20in; }

/* ------------------------------------------------------------- photo --- */
.sheet-photo { object-fit: cover; display: block; }
.sheet-photo-circle { border-radius: 50%; }
.sheet-photo-rounded { border-radius: 14%; }
.sheet-photo-square { border-radius: 3pt; }
.sheet-photo-header { width: calc(0.95in * var(--photo-scale, 1)); height: calc(0.95in * var(--photo-scale, 1)); margin: 0 auto 8pt; }
.sheet-photo-banner { width: calc(1.05in * var(--photo-scale, 1)); height: calc(1.05in * var(--photo-scale, 1)); flex: 0 0 auto; border: 3pt solid rgba(255,255,255,0.85); }
.sheet-photo-split { width: calc(0.85in * var(--photo-scale, 1)); height: calc(0.85in * var(--photo-scale, 1)); flex: 0 0 auto; margin-left: 12pt; }
.sheet-photo-minimal { width: calc(0.85in * var(--photo-scale, 1)); height: calc(0.85in * var(--photo-scale, 1)); flex: 0 0 auto; margin-left: 14pt; }
.sheet-photo-sidebar { width: calc(1.1in * var(--photo-scale, 1)); height: calc(1.1in * var(--photo-scale, 1)); margin: 0 auto 10pt; }
.sheet-header-centered-row { display: flex; align-items: center; gap: 0.25in; }
.sheet-header-centered-row.photo-left { justify-content: center; }
.sheet-header-centered-row.photo-right { justify-content: center; flex-direction: row-reverse; }
.sheet-header-centered-row .sheet-header-centered-text { flex: 0 1 auto; min-width: 0; text-align: left; }
.sheet-header-centered-row .sheet-name, .sheet-header-centered-row .sheet-title,
.sheet-header-centered-row .sheet-contact, .sheet-header-centered-row .sheet-links { text-align: left; }
.sheet-photo-beside { margin: 0; flex: 0 0 auto; }

/* -------------------------------------------------------- header shapes - */
.sheet-header-centered { text-align: center; }
.sheet-header-banner { background: ${accentHex}; margin: -0.65in -0.65in 16pt; padding: 0.4in 0.65in 0.32in; }
.sheet-banner-row { display: flex; align-items: center; justify-content: center; gap: 0.28in; }
.sheet-banner-text { text-align: center; }
.sheet-name-banner { color: #FFFFFF !important; }
.sheet-title-banner { color: rgba(255,255,255,0.85) !important; }
.sheet-header-below-banner .sheet-contact, .sheet-header-below-banner .sheet-links { margin-top: 2pt; }
.sheet-header-split {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 0.2in;
    border-bottom: 0.75pt solid var(--line); padding-bottom: 10pt; margin-bottom: 14pt;
}
.sheet-header-split-right { display: flex; align-items: flex-start; gap: 0.1in; }
.sheet-name-split, .sheet-title-split { text-align: left; }
.sheet-contact-split, .sheet-links-split { text-align: right; }
.sheet-header-minimal { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12pt; margin-bottom: 16pt; }
.sheet-name-minimal, .sheet-title-minimal, .sheet-contact-minimal, .sheet-links-minimal { text-align: left; }
.sheet-contact-minimal, .sheet-links-minimal { margin-top: 4pt; }
.sheet-header-sidebar { text-align: center; margin-bottom: 14pt; }
.sheet-name-sidebar, .sheet-title-sidebar, .sheet-contact-sidebar, .sheet-links-sidebar { text-align: center; }
.sheet-contact-sidebar, .sheet-links-sidebar { line-height: 1.9; margin-top: 4pt; }
.sheet-header-above-grid { margin-bottom: 12pt; }

/* --------------------------------------------------------------- grid -- */
.sheet-grid { display: grid; column-gap: 0.32in; align-items: start; }
.sheet-sidebar-col, .sheet-main-col { min-width: 0; }
.sheet-sidebar-col .sheet-heading, .sheet-main-col .sheet-heading { margin-top: 12pt; }
.sheet-sidebar-col.shaded {
    background: ${accentHex};
    color: #FFFFFF;
    --accent: #FFFFFF;
    --accent-soft: ${goldHex};
    --heading: #FFFFFF;
    --company: #FFFFFF;
    --job-title: ${goldHex};
    --link: ${goldHex};
    --bullet: ${goldHex};
    --muted: rgba(255,255,255,0.78);
    --text: #FFFFFF;
    --line: rgba(255,255,255,0.35);
    margin: -0.65in 0 -0.65in ${sidebarCfg && sidebarCfg.side === "left" ? "-0.65in" : "0"};
    padding: 0.5in 0.28in 0.5in ${sidebarCfg && sidebarCfg.side === "left" ? "0.65in" : "0.28in"};
}
.sheet-main-col + .sheet-sidebar-col.shaded {
    margin: -0.65in -0.65in -0.65in 0;
    padding: 0.5in 0.65in 0.5in 0.28in;
}
.sheet-sidebar-col:not(.shaded) { border-right: 0.75pt solid var(--line); padding-right: 0.24in; }
.sheet-main-col:has(+ .sheet-sidebar-col:not(.shaded)) { padding-right: 0; }

/* ---------------------------------------------------------- timeline --- */
.sheet-timeline-item {
    position: relative;
    padding-left: 0.22in;
    border-left: 1.5pt solid var(--gold);
    margin-left: 0.04in;
}
.sheet-timeline-item::before {
    content: "";
    position: absolute;
    left: -4.5pt; top: 4pt;
    width: 7pt; height: 7pt;
    border-radius: 50%;
    background: var(--accent);
    border: 1.5pt solid var(--gold);
}

/* --------------------------------------------------------------- compact - */
.density-compact .sheet-heading { margin: 10pt 0 4pt; }
.density-compact .sheet-block { margin-bottom: 0; }
.density-compact .sheet-job-head { margin-top: 7pt; }
.density-compact .sheet-body, .density-compact .sheet-label-value { margin-bottom: 2pt; }
.density-compact .sheet-bullet, .density-compact .sheet-bullet-line { margin-bottom: 1pt; }

/* ---------------------------------------------------- active-field highlight - */
.hl {
    background: rgba(58, 150, 94, 0.20);
    box-shadow: 0 0 0 4px rgba(58, 150, 94, 0.20);
    border-radius: 4px;
    animation: hl-in 0.5s ease-out;
}
@keyframes hl-in {
    from { background: rgba(58, 150, 94, 0.50); box-shadow: 0 0 0 4px rgba(58, 150, 94, 0.50); }
    to   { background: rgba(58, 150, 94, 0.20); box-shadow: 0 0 0 4px rgba(58, 150, 94, 0.20); }
}
.hl-yellow {
    background: rgba(255, 196, 0, 0.60);
    border-radius: 3px;
    animation: hl-in-yellow 0.5s ease-out;
}
@keyframes hl-in-yellow {
    from { background: rgba(255, 196, 0, 0.90); }
    to   { background: rgba(255, 196, 0, 0.60); }
}

/* ---------------------------------------------------- example placeholder - */
/* Content borrowed from EXAMPLE_RESUME_DATA to fill in a field/section that
   has no real content yet — dimmed and italicized so it never reads as the
   user's actual resume text, and not selected/printed as if it were real. */
.is-example {
    opacity: 0.6;
    font-style: italic;
}
.is-example.hl { opacity: 1; }
@media print {
    .is-example { display: none; }
}
@media print {
    html, body { background: var(--page-bg); }
    body { padding: 0; display: block; }
    .sheet { box-shadow: none; margin: 0; width: auto; min-height: 0; }
    @page { size: 8.5in 11in; margin: 0; }
}
`;
    if (formatDef.density === "compact") css += `\n.sheet { line-height: 1.28; }\n`;
    return css;
  }

  function describeField(fieldId) {
    if (!fieldId) return null;
    const fieldLabels = {
      "personal.name": I18N.t("personal.full_name"),
      "personal.title": I18N.t("badge.professional_title"),
      "personal.contact": I18N.t("badge.contact_info"),
      summary: I18N.t("nav.summary"),
    };
    if (fieldLabels[fieldId] !== undefined) return fieldLabels[fieldId];
    const sectionLabels = {
      links: I18N.t("personal.links_title"),
      skills: I18N.t("nav.skills"),
      experience: I18N.t("nav.experience"),
      personal_projects: I18N.t("nav.personal_projects"),
      education: I18N.t("nav.education"),
      publications: I18N.t("nav.publications"),
      certificates: I18N.t("nav.certificates"),
      additional: I18N.t("nav.additional"),
    };
    return sectionLabels[fieldId.split(".", 1)[0]] || null;
  }

  function e(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  function attrEscape(text) {
    return e(text).replace(/"/g, "&quot;");
  }

  function linkOrText(text, url, cssClass) {
    const txt = e(text);
    url = (url || "").trim();
    if (url) return `<a class="${cssClass || ""}" href="${attrEscape(url)}">${txt}</a>`;
    return `<span>${txt}</span>`;
  }

  function fieldTag(tag, cssClass, fieldId, activeField, activeFieldPrecise, inner, preciseFieldId, extraAttrs) {
    preciseFieldId = preciseFieldId || fieldId;
    extraAttrs = extraAttrs || "";
    let classes = cssClass;
    let dataAttr = "";
    if (fieldId) {
      dataAttr = ` data-field="${attrEscape(fieldId)}"`;
      if (fieldId === activeField) classes = `${classes} hl`;
    }
    if (preciseFieldId) {
      dataAttr += ` data-field-precise="${attrEscape(preciseFieldId)}"`;
      if (preciseFieldId === activeFieldPrecise) classes = `${classes} hl-yellow`;
    }
    return `<${tag} class="${classes}"${dataAttr}${extraAttrs}>${inner}</${tag}>`;
  }

  // ------------------------------------------------------- heading styles --
  function headingHtml(headingStyle, cls, text, isExample) {
    const base = "sheet-heading";
    if (headingStyle === "pill") {
      return `<div class="${cls(base + " heading-pill", isExample)}"><span class="sheet-heading-pill-inner">${e(text)}</span></div>`;
    }
    const modifier = {
      bar: "heading-bar", "left-border": "heading-left-border", boxed: "heading-boxed",
    }[headingStyle] || "heading-underline";
    return `<div class="${cls(base + " " + modifier, isExample)}">${e(text)}</div>`;
  }

  // -------------------------------------------------------- render context --
  function buildRenderContext(data, formatDef, activeField, activeFieldPrecise) {
    const personal = data.personal || {};
    const lang = data.language || I18N.DEFAULT_LANGUAGE;
    const ex = (typeof EXAMPLE_RESUME_DATA !== "undefined") ? EXAMPLE_RESUME_DATA : null;
    const exPersonal = (ex && ex.personal) || {};

    function cls(base, isExample) {
      return isExample ? `${base} is-example` : base;
    }
    function ftag(tag, cssClass, fieldId, inner, preciseFieldId, extraAttrs) {
      return fieldTag(tag, cssClass, fieldId, activeField, activeFieldPrecise, inner, preciseFieldId, extraAttrs);
    }
    function heading(text, isExample) {
      return headingHtml(formatDef.heading, cls, text, isExample);
    }

    function fieldOrExample(realValue, exampleValue) {
      const v = (realValue || "").toString().trim();
      if (v) return { value: v, isExample: false };
      return { value: exampleValue || "", isExample: !!exampleValue };
    }

    // Pairs each REAL row (by position, blank ones included) with either its
    // own content or, if blank, the example row at that same position — this
    // is what keeps the preview's item count matching the form exactly.
    function alignedItems(realList, exampleList, isVisible) {
      const real = realList || [];
      const example = exampleList || [];
      const aligned = real
        .map((item, i) => {
          if (isVisible(item)) return { item, isExample: false, i };
          if (example[i]) return { item: example[i], isExample: true, i };
          return null;
        })
        .filter(Boolean);
      const allExample = aligned.length > 0 && aligned.every((a) => a.isExample);
      return { aligned, allExample };
    }

    function labelValueRow(prefix, i, row, isExample) {
      let labelHtml = "";
      if (row.label) {
        labelHtml = ftag("span", "sheet-lv-label", null, `${e(row.label)}:  `, `${prefix}.${i}.label`);
      }
      const valueHtml = ftag("span", "", null, e(row.value || ""), `${prefix}.${i}.value`);
      return ftag("div", cls("sheet-label-value", isExample), `${prefix}.${i}`, `${labelHtml}${valueHtml}`);
    }

    const nameF = fieldOrExample(personal.name, exPersonal.name);
    const titleF = fieldOrExample(personal.title, exPersonal.title);

    const contactKeys = ResumeData.resolveContactOrder(data);
    const hasAnyRealContact = contactKeys.some((k) => (personal[k] || "").toString().trim());
    let contactPairs;
    let contactIsExample;
    if (hasAnyRealContact) {
      contactPairs = contactKeys.map((k) => [k, personal[k]]).filter(([, v]) => !!(v && v.toString().trim()));
      contactIsExample = false;
    } else {
      contactPairs = contactKeys.map((k) => [k, exPersonal[k]]).filter(([, v]) => !!v);
      contactIsExample = true;
    }
    const linkRows = (data.links || []).filter((r) => r.label || r.value);

    const hasPhoto = formatDef.showPhoto !== false && !!(personal.photo || "").trim();
    const photoUrl = hasPhoto ? personal.photo : "";
    const rawPhotoSize = Number(personal.photo_size);
    const photoScale = Number.isFinite(rawPhotoSize) && rawPhotoSize > 0 ? Math.max(0.6, Math.min(1.8, rawPhotoSize)) : 1;
    const photoPosition = ["above", "left", "right"].includes(personal.photo_position) ? personal.photo_position : "above";
    function photoStyleAttr() {
      return ` style="--photo-scale:${photoScale}"`;
    }

    function jobDatesHtml(i, job) {
      const start = (job.start_date || "").trim();
      const end = (job.end_date || "").trim();
      let inner;
      if (start && end) {
        inner = ftag("span", "", null, e(start), `experience.${i}.dates.start`) +
                " &ndash; " +
                ftag("span", "", null, e(end), `experience.${i}.dates.end`);
      } else if (start) {
        inner = ftag("span", "", null, e(start), `experience.${i}.dates.start`);
      } else if (end) {
        inner = ftag("span", "", null, e(end), `experience.${i}.dates.end`);
      } else {
        inner = e(job.dates || "");
      }
      return ftag("span", "sheet-job-dates", `experience.${i}.dates`, inner);
    }

    function projectVisible(p) {
      const name_ = (p.name || "").trim();
      if (name_ || (p.url || "").trim()) return true;
      return (p.bullets || []).some((b) => b.trim());
    }

    const bulletEntity = { "•": "&bull;", "‣": "&#8227;", "▸": "&#9656;", "–": "&ndash;", "-": "-" }[formatDef.bulletChar] || "&bull;";

    function renderSummary(sink) {
      const summaryF = fieldOrExample(data.summary, ex && ex.summary);
      if (!summaryF.value) return;
      sink.push(heading(I18N.t("resume.summary", { lang }), summaryF.isExample));
      sink.push(ftag("div", cls("sheet-body", summaryF.isExample), "summary", e(summaryF.value)));
    }

    function renderSkills(sink) {
      const { aligned, allExample } = alignedItems(data.skills, ex && ex.skills, (r) => r.label || r.value);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.skills", { lang }), allExample));
      aligned.forEach(({ item, isExample, i }) => sink.push(labelValueRow("skills", i, item, isExample)));
    }

    function renderExperience(sink) {
      const { aligned, allExample } = alignedItems(data.experience, ex && ex.experience, (j) => j.title || j.company);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.experience", { lang }), allExample));
      aligned.forEach(({ item: job, isExample, i }) => {
        const blockClass = cls("sheet-block" + (formatDef.timelineExperience ? " sheet-timeline-item" : ""), isExample);
        sink.push(`<div class="${blockClass}">`);
        // Company is the primary heading-weight line (and can be a link);
        // job title renders as the secondary line beneath it.
        const companyInner = job.company ? linkOrText(job.company, job.company_url) : "";
        const companySpan = ftag("span", "sheet-entry-company", `experience.${i}.company`, companyInner);
        const employmentDisplay = ResumeData.formatEmploymentType((job.employment_type || "").trim(), lang);
        let headLineInner = companySpan;
        if (employmentDisplay) {
          headLineInner += ftag("span", "sheet-job-type", `experience.${i}.employment_type`,
                                 `&nbsp;&middot; ${e(employmentDisplay)}`);
        }
        const headLine = `<span class="sheet-job-head-line">${headLineInner}</span>`;
        const datesSpan = jobDatesHtml(i, job);
        sink.push(`<div class="sheet-job-head">${headLine}${datesSpan}</div>`);
        if (job.title) {
          sink.push(ftag("div", "sheet-entry-role", `experience.${i}.title`, e(job.title)));
        }

        const realProjects = ((data.experience || [])[i] || {}).projects || [];
        const exampleProjects = ((ex && ex.experience && ex.experience[i]) || {}).projects || [];
        const { aligned: alignedProjects } = alignedItems(realProjects, exampleProjects, projectVisible);
        alignedProjects.forEach(({ item: proj, isExample: projIsExample, i: j }) => {
          const name_ = (proj.name || "").trim();
          const headingField = `experience.${i}.projects.${j}.heading`;
          if (name_) {
            const headingInner =
              '<span class="sheet-bullet-mark">&#8227;  </span>' +
              linkOrText(name_, proj.url, "sheet-project-link");
            sink.push(ftag("div", cls("sheet-project-heading", projIsExample), headingField, headingInner));
          }
          const bulletClass = cls(name_ ? "sheet-bullet sheet-bullet-indent" : "sheet-bullet", projIsExample);
          const bulletsField = `experience.${i}.projects.${j}.bullets`;
          const bulletLines = (proj.bullets || []).filter((b) => b.trim());
          if (bulletLines.length) {
            const bulletsHtml = bulletLines.map((bullet) =>
              `<div class="sheet-bullet-line"><span class="sheet-bullet-mark">${bulletEntity}  </span>` +
              `<span>${e(bullet.trim())}</span></div>`).join("");
            sink.push(ftag("div", bulletClass, bulletsField, bulletsHtml));
          }
        });
        sink.push("</div>");
      });
    }

    function renderPersonalProjects(sink) {
      const { aligned, allExample } = alignedItems(data.personal_projects, ex && ex.personal_projects, projectVisible);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.personal_projects", { lang }), allExample));
      aligned.forEach(({ item: proj, isExample, i }) => {
        sink.push(`<div class="${cls("sheet-block", isExample)}">`);
        const name_ = (proj.name || "").trim();
        const headingField = `personal_projects.${i}.heading`;
        if (name_) {
          const headingInner =
            '<span class="sheet-bullet-mark">&#8227;  </span>' +
            linkOrText(name_, proj.url, "sheet-project-link");
          sink.push(ftag("div", cls("sheet-project-heading", isExample), headingField, headingInner));
        }
        const bulletClass = cls(name_ ? "sheet-bullet sheet-bullet-indent" : "sheet-bullet", isExample);
        const bulletsField = `personal_projects.${i}.bullets`;
        const bulletLines = (proj.bullets || []).filter((b) => b.trim());
        if (bulletLines.length) {
          const bulletsHtml = bulletLines.map((bullet) =>
            `<div class="sheet-bullet-line"><span class="sheet-bullet-mark">${bulletEntity}  </span>` +
            `<span>${e(bullet.trim())}</span></div>`).join("");
          sink.push(ftag("div", bulletClass, bulletsField, bulletsHtml));
        }
        sink.push("</div>");
      });
    }

    function renderEducation(sink) {
      const { aligned, allExample } = alignedItems(
        data.education, ex && ex.education,
        (edu) => edu.degree || edu.school || edu.meta || edu.thesis,
      );
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.education", { lang }), allExample));
      aligned.forEach(({ item: edu, isExample, i }) => {
        sink.push(`<div class="${cls("sheet-block", isExample)}">`);
        let line = ftag("span", "sheet-edu-degree", null, e(edu.degree || ""), `education.${i}.degree`);
        if (edu.school) {
          line += '<span class="sheet-edu-sep">  &mdash;  </span>';
          let schoolInner;
          if ((edu.school_url || "").trim()) {
            schoolInner = linkOrText(edu.school, edu.school_url, "sheet-edu-school");
          } else {
            schoolInner = `<span class="sheet-edu-school-plain">${e(edu.school)}</span>`;
          }
          line += ftag("span", "", null, schoolInner, `education.${i}.school`);
        }
        sink.push(ftag("div", "sheet-edu-line", `education.${i}.line`, line));
        if (edu.meta) sink.push(ftag("div", "sheet-meta", `education.${i}.meta`, e(edu.meta)));
        if (edu.thesis) {
          const thesisInner = e(I18N.t("resume.thesis_label", { lang })) + e(edu.thesis);
          sink.push(ftag("div", "sheet-meta", `education.${i}.thesis`, thesisInner));
        }
        sink.push("</div>");
      });
    }

    function renderPublications(sink) {
      const { aligned, allExample } = alignedItems(data.publications, ex && ex.publications, (p) => p.title || p.detail);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.publications", { lang }), allExample));
      aligned.forEach(({ item, isExample, i }) => {
        sink.push(`<div class="${cls("sheet-block", isExample)}">`);
        const titleInner =
          `<span class="sheet-bullet-mark">${bulletEntity}  </span>` +
          `<span class="sheet-pub-title">${e(item.title || "")}</span>`;
        sink.push(ftag("div", "sheet-bullet", `publications.${i}.title`, titleInner));
        if (item.detail) {
          sink.push(ftag("div", "sheet-meta sheet-pub-detail", `publications.${i}.detail`, e(item.detail)));
        }
        sink.push("</div>");
      });
    }

    function renderCertificates(sink) {
      const { aligned, allExample } = alignedItems(data.certificates, ex && ex.certificates, (r) => r.label || r.value);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.certificates", { lang }), allExample));
      aligned.forEach(({ item, isExample, i }) => sink.push(labelValueRow("certificates", i, item, isExample)));
    }

    function renderAdditional(sink) {
      const { aligned, allExample } = alignedItems(data.additional, ex && ex.additional, (r) => r.label || r.value);
      if (!aligned.length) return;
      sink.push(heading(I18N.t("resume.additional", { lang }), allExample));
      aligned.forEach(({ item, isExample, i }) => sink.push(labelValueRow("additional", i, item, isExample)));
    }

    const sectionRenderers = {
      summary: renderSummary, skills: renderSkills, experience: renderExperience,
      personal_projects: renderPersonalProjects,
      education: renderEducation, publications: renderPublications,
      certificates: renderCertificates, additional: renderAdditional,
    };

    function buildContactHtml(stacked) {
      if (!contactPairs.length) return "";
      const items = contactPairs.map(([k, v]) => {
        const icon = formatDef.iconContacts ? `<span class="sheet-contact-icon">${contactIcon(k)}</span>` : "";
        return ftag("span", "", null, icon + e(v), `personal.contact.${k}`);
      });
      return items.join(stacked ? "<br>" : "   &bull;   ");
    }

    function buildLinksHtml(stacked) {
      if (!linkRows.length) return "";
      const items = linkRows.map((row, i) => {
        const icon = formatDef.iconContacts ? '<span class="sheet-contact-icon">🔗</span>' : "";
        return ftag("span", "sheet-link-item", `links.${i}`,
                     icon + linkOrText(row.label || "", row.value || "", "sheet-link-anchor"));
      });
      return items.join(stacked ? "<br>" : "   &bull;   ");
    }

    return {
      data, formatDef, personal, lang, e, cls, ftag, heading,
      nameF, titleF, contactPairs, contactIsExample, linkRows,
      hasPhoto, photoUrl, photoScale, photoPosition, photoStyleAttr,
      sectionRenderers, buildContactHtml, buildLinksHtml,
    };
  }

  // ------------------------------------------------------------- headers ---
  function buildCenteredHeaderHtml(ctx) {
    const { ftag, cls, e, nameF, titleF, hasPhoto, photoUrl, formatDef, contactIsExample, photoPosition, photoStyleAttr } = ctx;
    const textParts = [];
    textParts.push(ftag("div", cls("sheet-name", nameF.isExample), "personal.name", e(nameF.value.toUpperCase())));
    if (titleF.value) textParts.push(ftag("div", cls("sheet-title", titleF.isExample), "personal.title", e(titleF.value)));

    const contactHtml = ctx.buildContactHtml();
    const linksHtml = ctx.buildLinksHtml();
    if (contactHtml) {
      const contactClass = cls(linksHtml ? "sheet-contact" : "sheet-contact sheet-header-divider", contactIsExample);
      textParts.push(ftag("div", contactClass, "personal.contact", contactHtml));
    }
    if (linksHtml) textParts.push(`<div class="sheet-links sheet-header-divider">${linksHtml}</div>`);
    const textBlock = `<div class="sheet-header-centered-text">${textParts.join("")}</div>`;

    if (!hasPhoto) return `<div class="sheet-header-centered">${textBlock}</div>`;

    const photoHtml = `<img class="sheet-photo sheet-photo-${formatDef.photoShape} ${photoPosition === "above" ? "sheet-photo-header" : "sheet-photo-beside sheet-photo-header"}"${photoStyleAttr()} src="${attrEscape(photoUrl)}" alt="">`;

    if (photoPosition === "left" || photoPosition === "right") {
      return `<div class="sheet-header-centered has-photo"><div class="sheet-header-centered-row photo-${photoPosition}">${photoHtml}${textBlock}</div></div>`;
    }
    return `<div class="sheet-header-centered has-photo">${photoHtml}${textBlock}</div>`;
  }

  function buildBannerHeaderHtml(ctx) {
    const { ftag, cls, e, nameF, titleF, hasPhoto, photoUrl, formatDef, contactIsExample } = ctx;
    const textParts = [];
    textParts.push(ftag("div", cls("sheet-name sheet-name-banner", nameF.isExample), "personal.name", e(nameF.value.toUpperCase())));
    if (titleF.value) textParts.push(ftag("div", cls("sheet-title sheet-title-banner", titleF.isExample), "personal.title", e(titleF.value)));
    const textBlock = `<div class="sheet-banner-text">${textParts.join("")}</div>`;
    const photoHtml = hasPhoto ? `<img class="sheet-photo sheet-photo-${formatDef.photoShape} sheet-photo-banner"${ctx.photoStyleAttr()} src="${attrEscape(photoUrl)}" alt="">` : "";
    const banner = `<div class="sheet-header-banner"><div class="sheet-banner-row">${textBlock}${photoHtml}</div></div>`;

    const contactHtml = ctx.buildContactHtml();
    const linksHtml = ctx.buildLinksHtml();
    let below = "";
    if (contactHtml) below += ftag("div", cls(linksHtml ? "sheet-contact" : "sheet-contact sheet-header-divider", contactIsExample), "personal.contact", contactHtml);
    if (linksHtml) below += `<div class="sheet-links sheet-header-divider">${linksHtml}</div>`;
    return banner + (below ? `<div class="sheet-header-below-banner">${below}</div>` : "");
  }

  function buildSplitHeaderHtml(ctx) {
    const { ftag, cls, e, nameF, titleF, hasPhoto, photoUrl, formatDef, contactIsExample } = ctx;
    const left = [];
    left.push(ftag("div", cls("sheet-name sheet-name-split", nameF.isExample), "personal.name", e(nameF.value.toUpperCase())));
    if (titleF.value) left.push(ftag("div", cls("sheet-title sheet-title-split", titleF.isExample), "personal.title", e(titleF.value)));

    const contactHtml = ctx.buildContactHtml();
    const linksHtml = ctx.buildLinksHtml();
    const right = [];
    if (contactHtml) right.push(ftag("div", cls("sheet-contact sheet-contact-split", contactIsExample), "personal.contact", contactHtml));
    if (linksHtml) right.push(`<div class="sheet-links sheet-links-split">${linksHtml}</div>`);
    const photoHtml = hasPhoto ? `<img class="sheet-photo sheet-photo-${formatDef.photoShape} sheet-photo-split"${ctx.photoStyleAttr()} src="${attrEscape(photoUrl)}" alt="">` : "";

    return `<div class="sheet-header-split">` +
      `<div class="sheet-header-split-left">${left.join("")}</div>` +
      `<div class="sheet-header-split-right"><div>${right.join("")}</div>${photoHtml}</div>` +
      `</div>`;
  }

  function buildMinimalHeaderHtml(ctx) {
    const { ftag, cls, e, nameF, titleF, hasPhoto, photoUrl, formatDef, contactIsExample } = ctx;
    const textParts = [];
    textParts.push(ftag("div", cls("sheet-name sheet-name-minimal", nameF.isExample), "personal.name", e(nameF.value.toUpperCase())));
    if (titleF.value) textParts.push(ftag("div", cls("sheet-title sheet-title-minimal", titleF.isExample), "personal.title", e(titleF.value)));
    const contactHtml = ctx.buildContactHtml();
    const linksHtml = ctx.buildLinksHtml();
    if (contactHtml) textParts.push(ftag("div", cls("sheet-contact sheet-contact-minimal", contactIsExample), "personal.contact", contactHtml));
    if (linksHtml) textParts.push(`<div class="sheet-links sheet-links-minimal">${linksHtml}</div>`);
    const textBlock = `<div class="sheet-header-minimal-text">${textParts.join("")}</div>`;
    const photoHtml = hasPhoto ? `<img class="sheet-photo sheet-photo-${formatDef.photoShape} sheet-photo-minimal"${ctx.photoStyleAttr()} src="${attrEscape(photoUrl)}" alt="">` : "";
    return `<div class="sheet-header-minimal">${textBlock}${photoHtml}</div>`;
  }

  function buildSidebarHeaderHtml(ctx) {
    const { ftag, cls, e, nameF, titleF, hasPhoto, photoUrl, formatDef, contactIsExample } = ctx;
    const parts = [];
    if (hasPhoto) parts.push(`<img class="sheet-photo sheet-photo-${formatDef.photoShape} sheet-photo-sidebar"${ctx.photoStyleAttr()} src="${attrEscape(photoUrl)}" alt="">`);
    parts.push(ftag("div", cls("sheet-name sheet-name-sidebar", nameF.isExample), "personal.name", e(nameF.value.toUpperCase())));
    if (titleF.value) parts.push(ftag("div", cls("sheet-title sheet-title-sidebar", titleF.isExample), "personal.title", e(titleF.value)));
    const contactHtml = ctx.buildContactHtml(true);
    const linksHtml = ctx.buildLinksHtml(true);
    if (contactHtml) parts.push(ftag("div", cls("sheet-contact sheet-contact-sidebar", contactIsExample), "personal.contact", contactHtml));
    if (linksHtml) parts.push(`<div class="sheet-links sheet-links-sidebar">${linksHtml}</div>`);
    return `<div class="sheet-header-sidebar">${parts.join("")}</div>`;
  }

  const HEADER_BUILDERS = {
    centered: buildCenteredHeaderHtml,
    banner: buildBannerHeaderHtml,
    split: buildSplitHeaderHtml,
    "minimal-left": buildMinimalHeaderHtml,
  };

  // ------------------------------------------------------------ skeletons --
  function buildSingleColumnHtml(ctx) {
    const parts = [];
    parts.push((HEADER_BUILDERS[ctx.formatDef.header] || buildCenteredHeaderHtml)(ctx));
    ResumeData.resolveSectionOrder(ctx.data).forEach((key) => ctx.sectionRenderers[key](parts));
    return parts.join("");
  }

  function buildSidebarHtml(ctx) {
    const { formatDef, data, sectionRenderers } = ctx;
    const sidebarCfg = formatDef.sidebar;
    const allSections = ResumeData.resolveSectionOrder(data);
    const sidebarKeys = allSections.filter((k) => sidebarCfg.sectionKeys.includes(k));
    const mainKeys = allSections.filter((k) => !sidebarCfg.sectionKeys.includes(k));

    const sidebarParts = [];
    const mainParts = [];
    let aboveGrid = "";

    if (sidebarCfg.headerInSidebar) {
      sidebarParts.push(buildSidebarHeaderHtml(ctx));
    } else {
      aboveGrid = `<div class="sheet-header-above-grid">${buildCenteredHeaderHtml(ctx)}</div>`;
    }

    sidebarKeys.forEach((k) => sectionRenderers[k](sidebarParts));
    mainKeys.forEach((k) => sectionRenderers[k](mainParts));

    const sideHtml = `<div class="sheet-sidebar-col${sidebarCfg.shaded ? " shaded" : ""}">${sidebarParts.join("")}</div>`;
    const mainHtml = `<div class="sheet-main-col">${mainParts.join("")}</div>`;
    const cols = sidebarCfg.side === "left" ? sideHtml + mainHtml : mainHtml + sideHtml;

    const leftPct = sidebarCfg.side === "left" ? sidebarCfg.widthPct : (100 - sidebarCfg.widthPct);
    const gridStyle = `grid-template-columns: ${leftPct}% ${100 - leftPct}%;`;

    return `${aboveGrid}<div class="sheet-grid" style="${gridStyle}">${cols}</div>`;
  }

  function renderResumeHtml(data, activeField, activeFieldPrecise) {
    data = data || {};
    const formatDef = ResumeFormats.resolveFormat(data);
    const style = ResumeStyle.resolveStyle(data);
    const pageCss = buildPageCss(style, formatDef);
    const ctx = buildRenderContext(data, formatDef, activeField, activeFieldPrecise);

    const body = formatDef.layout === "sidebar" ? buildSidebarHtml(ctx) : buildSingleColumnHtml(ctx);
    const sheetClass = `sheet${formatDef.density === "compact" ? " density-compact" : ""}`;

    return "<!doctype html><html><head><meta charset='utf-8'>" +
           `<style>${pageCss}</style></head>` +
           `<body><div class='${sheetClass}'>${body}</div></body></html>`;
  }

  // ------------------------------------------------------------ PreviewPanel --
  class PreviewPanel {
    constructor(root, opts) {
      this.root = root;
      this.onStyleRequested = (opts && opts.onStyleRequested) || (() => {});
      this.onFormatRequested = (opts && opts.onFormatRequested) || (() => {});
      this.zoom = 0.85;
      this._lastHtml = null;
      this._activeField = null;
      this._pendingScroll = null;
      this._build();
    }

    _build() {
      this.root.innerHTML = "";
      this.root.classList.add("preview-panel");

      const bar = document.createElement("div");
      bar.className = "preview-bar";

      const titleBox = document.createElement("div");
      titleBox.className = "preview-title-box";
      const title = document.createElement("div");
      title.className = "preview-title";
      title.textContent = I18N.t("generate.live_preview");
      const hint = document.createElement("div");
      hint.className = "preview-hint";
      hint.textContent = I18N.t("preview.updates_automatically");
      titleBox.appendChild(title);
      titleBox.appendChild(hint);
      bar.appendChild(titleBox);

      this.editingBadge = document.createElement("span");
      this.editingBadge.className = "preview-editing-badge";
      this.editingBadge.style.display = "none";
      bar.appendChild(this.editingBadge);

      const spacer = document.createElement("div");
      spacer.className = "preview-spacer";
      bar.appendChild(spacer);

      const styleBtn = document.createElement("button");
      styleBtn.type = "button";
      styleBtn.className = "btn btn-ghost-small";
      styleBtn.textContent = I18N.t("common.style_settings");
      styleBtn.addEventListener("click", () => this.onStyleRequested());
      bar.appendChild(styleBtn);

      const formatBtn = document.createElement("button");
      formatBtn.type = "button";
      formatBtn.className = "btn btn-ghost-small";
      formatBtn.textContent = I18N.t("common.resume_format");
      formatBtn.addEventListener("click", () => this.onFormatRequested());
      bar.appendChild(formatBtn);

      const zoomOut = document.createElement("button");
      zoomOut.type = "button";
      zoomOut.className = "btn btn-ghost-small btn-zoom";
      zoomOut.textContent = "−";
      zoomOut.addEventListener("click", () => this._nudgeZoom(-0.08));

      this.zoomInput = document.createElement("input");
      this.zoomInput.type = "text";
      this.zoomInput.className = "zoom-input";
      this.zoomInput.addEventListener("change", () => {
        const v = parseInt(this.zoomInput.value, 10);
        if (!Number.isNaN(v)) this._setZoom(v / 100);
        else this._updateZoomLabel();
      });

      const zoomIn = document.createElement("button");
      zoomIn.type = "button";
      zoomIn.className = "btn btn-ghost-small btn-zoom";
      zoomIn.textContent = "+";
      zoomIn.addEventListener("click", () => this._nudgeZoom(0.08));

      bar.appendChild(zoomOut);
      bar.appendChild(this.zoomInput);
      bar.appendChild(zoomIn);
      this.root.appendChild(bar);

      const host = document.createElement("div");
      host.className = "preview-host";
      this.iframe = document.createElement("iframe");
      this.iframe.className = "preview-iframe";
      this.iframe.setAttribute("title", "Resume preview");
      host.appendChild(this.iframe);
      this.root.appendChild(host);

      this.iframe.addEventListener("load", () => this._onLoadFinished());
      this.iframe.srcdoc = renderResumeHtml({});
      this._updateZoomLabel();
    }

    _nudgeZoom(delta) {
      this._setZoom(this.zoom + delta);
    }

    _setZoom(zoom) {
      this.zoom = Math.max(0.4, Math.min(1.6, Math.round(zoom * 100) / 100));
      this._applyZoom();
      this._updateZoomLabel();
    }

    _applyZoom() {
      const doc = this.iframe.contentDocument;
      if (doc && doc.body) doc.body.style.zoom = String(this.zoom);
    }

    _updateZoomLabel() {
      this.zoomInput.value = `${Math.round(this.zoom * 100)}%`;
    }

    updateData(data, activeField, activeFieldPrecise, force) {
      const htmlStr = renderResumeHtml(data, activeField, activeFieldPrecise);
      const fieldChanged = activeField !== this._activeField;
      if (force || htmlStr !== this._lastHtml || fieldChanged) {
        const doc = this.iframe.contentDocument;
        const scrollPos = doc ? { x: doc.defaultView.scrollX, y: doc.defaultView.scrollY } : { x: 0, y: 0 };
        this._pendingScroll = { activeField, fieldChanged, scrollPos };
        this._lastHtml = htmlStr;
        this._activeField = activeField;
        this.iframe.srcdoc = htmlStr;
      }
      const label = describeField(activeField);
      this.editingBadge.textContent = label ? `●  Editing: ${label}` : "";
      this.editingBadge.style.display = label ? "" : "none";
    }

    _onLoadFinished() {
      this._applyZoom();
      const pending = this._pendingScroll;
      this._pendingScroll = null;
      if (!pending) return;
      const { activeField, fieldChanged, scrollPos } = pending;
      const doc = this.iframe.contentDocument;
      if (!doc) return;
      if (activeField && fieldChanged) {
        const el = doc.querySelector(`[data-field="${cssEscape(activeField)}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          const viewHeight = doc.defaultView.innerHeight;
          if (r.top < 0 || r.bottom > viewHeight) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      } else if (scrollPos && (scrollPos.x || scrollPos.y)) {
        doc.defaultView.scrollTo(scrollPos.x, scrollPos.y);
      }
    }
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  return { buildPageCss, describeField, renderResumeHtml, PreviewPanel };
})();
