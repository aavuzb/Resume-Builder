"use strict";
/*
 * docx-export.js
 * Builds a resume .docx from the same plain data object the form collects —
 * the browser equivalent of docx_engine.py's build_resume(). Uses the "docx"
 * library (window.docx, loaded via CDN in index.html).
 *
 * Mirrors preview.js's architecture: every format in resume-formats.js is a
 * config object consumed by one of two structural body builders
 * (buildSingleColumnBody / buildSidebarBody), not a bespoke document per
 * format. Word's rendering model can't do everything the HTML/PDF version
 * can (no circular image clipping, no content-hugging "pill" chips) — those
 * cases fall back to the closest achievable Word equivalent, noted inline.
 */

const ResumeDocx = (() => {
  const {
    Document, Paragraph, TextRun, ExternalHyperlink, ImageRun, Table, TableRow, TableCell,
    Packer, AlignmentType, BorderStyle, TabStopType, UnderlineType, WidthType, VerticalAlign,
    convertInchesToTwip,
  } = docx;

  const LINE = "C9D2D8";
  const PAGE_MARGIN_IN = 0.65;

  const NO_BORDERS = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  function hex(color) {
    return (color || "").replace("#", "").toUpperCase();
  }

  function run(text, opts) {
    opts = opts || {};
    return new TextRun({
      text,
      font: opts.font,
      size: opts.size,
      bold: !!opts.bold,
      italics: !!opts.italic,
      color: opts.color,
      characterSpacing: opts.spacing,
      underline: opts.underline ? { type: UnderlineType.SINGLE } : { type: UnderlineType.NONE },
    });
  }

  // linkColor is used only when the text actually turns into a hyperlink —
  // otherwise opts.color (the "plain" color for that text role) applies.
  function textOrLink(text, url, opts, linkColor) {
    opts = opts || {};
    const trimmed = (url || "").trim();
    if (trimmed) {
      return new ExternalHyperlink({
        link: trimmed,
        children: [run(text, Object.assign({}, opts, { color: linkColor || opts.color }))],
      });
    }
    return run(text, opts);
  }

  // ------------------------------------------------------------- photo ----
  function decodePhotoBytes(dataUrl) {
    const base64 = (dataUrl || "").split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Word/the docx library can't clip an image to a circle or rounded rect —
  // the .docx photo is always a plain rectangle (with a thin accent frame),
  // regardless of the format's photoShape (which only affects HTML/PDF).
  function buildPhotoImageRun(photoDataUrl, sizePx, accentHex) {
    if (!photoDataUrl) return null;
    return new ImageRun({
      type: "jpg",
      data: decodePhotoBytes(photoDataUrl),
      transformation: { width: sizePx, height: sizePx },
      outline: { color: accentHex, width: 9525 },
    });
  }

  function wrapWithPhoto(paragraphs, photoRun, usableWidthTwip, photoFirst) {
    if (!photoRun) return paragraphs;
    const textCell = new TableCell({
      children: paragraphs,
      verticalAlign: VerticalAlign.CENTER,
      width: { size: Math.round(usableWidthTwip * 0.78), type: WidthType.DXA },
    });
    const photoCell = new TableCell({
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [photoRun] })],
      verticalAlign: VerticalAlign.CENTER,
      width: { size: Math.round(usableWidthTwip * 0.22), type: WidthType.DXA },
    });
    const cells = photoFirst ? [photoCell, textCell] : [textCell, photoCell];
    return [new Table({
      width: { size: usableWidthTwip, type: WidthType.DXA },
      borders: NO_BORDERS,
      rows: [new TableRow({ children: cells })],
    })];
  }

  function buildDocument(data) {
    const formatDef = ResumeFormats.resolveFormat(data);
    const style = ResumeStyle.resolveStyle(data);
    const lang = data.language || I18N.DEFAULT_LANGUAGE;
    const font = style.font_family;
    const sizeName = style.size_name * 2;
    const sizeTitle = style.size_title * 2;
    const sizeHeading = style.size_heading * 2;
    const sizeBody = style.size_body * 2;
    const sizeMeta = style.size_meta * 2;
    const accent = hex(style.accent_color);
    const accentSoft = hex(style.accent_soft_color);
    const headingColor = hex(style.heading_color);
    const company = hex(style.company_color);
    const jobTitle = hex(style.job_title_color);
    const link = hex(style.link_color);
    const bulletColor = hex(style.bullet_color);
    const highlight = hex(style.highlight_color);
    const textColor = hex(style.text_color);
    const muted = hex(style.muted_color);
    const usableWidth = 8.5 - 2 * PAGE_MARGIN_IN;
    const usableWidthTwip = convertInchesToTwip(usableWidth);

    const palette = { accent, accentSoft, heading: headingColor, company, jobTitle, link, bulletColor, highlight, textColor, muted };
    // Used inside shaded sidebar columns — light-on-dark, computed explicitly
    // rather than derived, since Word has no scoped custom-property override
    // the way the CSS/HTML side does.
    const lightPalette = {
      accent: "FFFFFF", accentSoft: highlight,
      heading: "FFFFFF", company: "FFFFFF", jobTitle: highlight, link: highlight, bulletColor: highlight,
      highlight, textColor: "FFFFFF", muted: "E4E4E4",
    };

    const scale = formatDef.density === "compact" ? 0.6 : 1;
    const sp = (n) => Math.round(n * scale);

    const bulletChar = formatDef.bulletChar || "•";

    // ---- heading builders, keyed by formatDef.heading ----
    function headingUnderline(text, pal) {
      return new Paragraph({
        spacing: { before: sp(320), after: sp(120) },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: pal.highlight, space: 5 } },
        children: [run(text.toUpperCase(), { font, size: sizeHeading, bold: true, color: pal.heading, spacing: 24 })],
      });
    }
    function headingBar(text, pal) {
      return new Paragraph({
        spacing: { before: sp(320), after: sp(120) },
        shading: { fill: pal.heading === "FFFFFF" ? pal.highlight : pal.heading },
        children: [run(text.toUpperCase(), { font, size: sizeHeading, bold: true, color: "FFFFFF", spacing: 24 })],
      });
    }
    function headingLeftBorder(text, pal) {
      return new Paragraph({
        spacing: { before: sp(320), after: sp(120) },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: pal.highlight, space: 8 } },
        children: [run(text.toUpperCase(), { font, size: sizeHeading, bold: true, color: pal.heading, spacing: 24 })],
      });
    }
    function headingBoxed(text, pal) {
      const b = { style: BorderStyle.SINGLE, size: 6, color: pal.highlight, space: 6 };
      return new Paragraph({
        spacing: { before: sp(320), after: sp(120) },
        border: { top: b, bottom: b, left: b, right: b },
        children: [run(text.toUpperCase(), { font, size: sizeHeading, bold: true, color: pal.heading, spacing: 24 })],
      });
    }
    const HEADING_BUILDERS = {
      underline: headingUnderline,
      bar: headingBar,
      pill: headingBar, // no content-hugging "chip" in Word — falls back to a filled band
      "left-border": headingLeftBorder,
      boxed: headingBoxed,
    };
    function heading(text, pal) {
      return (HEADING_BUILDERS[formatDef.heading] || headingUnderline)(text, pal || palette);
    }

    function bullet(text, indentIn, pal) {
      pal = pal || palette;
      return new Paragraph({
        spacing: { after: sp(60) },
        indent: { left: convertInchesToTwip(indentIn !== undefined ? indentIn : 0.20) },
        children: [
          run(bulletChar + "  ", { font, size: sizeBody, color: pal.bulletColor }),
          run(text, { font, size: sizeBody, color: pal.textColor }),
        ],
      });
    }

    function projectHeading(name, url, pal) {
      pal = pal || palette;
      return new Paragraph({
        spacing: { before: sp(160), after: sp(40) },
        indent: { left: convertInchesToTwip(0.10) },
        children: [
          run("‣  ", { font, size: sizeBody, bold: true, color: pal.bulletColor }),
          textOrLink(name, url, { font, size: sizeBody, bold: true, color: pal.textColor }, pal.link),
        ],
      });
    }

    function labelValue(label, value, pal) {
      pal = pal || palette;
      return new Paragraph({
        spacing: { after: sp(80) },
        children: [
          run(label + ":  ", { font, size: sizeBody, bold: true, color: pal.accentSoft }),
          run(value, { font, size: sizeBody, color: pal.textColor }),
        ],
      });
    }

    // Company is the primary heading-weight line (and can be a link); job
    // title renders as the secondary line beneath it — mirrors preview.js.
    function jobHeader(company, title, dates, companyUrl, employmentDisplay, pal) {
      pal = pal || palette;
      const headRuns = [textOrLink(company, companyUrl, { font, size: sizeHeading, bold: true, color: pal.company }, pal.link)];
      if (employmentDisplay) {
        headRuns.push(run(`   (${employmentDisplay})`, { font, size: sizeMeta, italic: true, color: pal.muted }));
      }
      headRuns.push(run("\t" + dates, { font, size: sizeMeta, italic: true, color: pal.muted }));
      const paras = [
        new Paragraph({
          spacing: { before: sp(240), after: sp(20) },
          tabStops: [{ type: TabStopType.RIGHT, position: convertInchesToTwip(usableWidth) }],
          children: headRuns,
        }),
      ];
      if (title) {
        paras.push(new Paragraph({
          spacing: { after: sp(60) },
          children: [run(title, { font, size: sizeBody, bold: true, italic: true, color: pal.jobTitle })],
        }));
      }
      return paras;
    }

    function publicationEntry(item, pal) {
      pal = pal || palette;
      const title = (item && item.title || "").trim();
      const detail = (item && item.detail || "").trim();
      if (!title && !detail) return [];
      const paras = [
        new Paragraph({
          spacing: { after: detail ? sp(20) : sp(80) },
          indent: { left: convertInchesToTwip(0.20) },
          children: [
            run(bulletChar + "  ", { font, size: sizeBody, color: pal.bulletColor }),
            run(title, { font, size: sizeBody, bold: true, color: pal.textColor }),
          ],
        }),
      ];
      if (detail) {
        paras.push(new Paragraph({
          spacing: { after: sp(120) },
          indent: { left: convertInchesToTwip(0.20) },
          children: [run(detail, { font, size: sizeMeta, italic: true, color: pal.muted })],
        }));
      }
      return paras;
    }

    // ---- section renderers, factory so sidebar columns get their own palette --
    function makeSectionRenderers(pal) {
      return {
        summary(sink) {
          if (!data.summary) return;
          sink.push(heading(I18N.t("resume.summary", { lang }), pal));
          sink.push(new Paragraph({
            spacing: { after: sp(80) },
            children: [run(data.summary, { font, size: sizeBody, color: pal.textColor })],
          }));
        },
        skills(sink) {
          const rows = (data.skills || []).filter((r) => r.label || r.value);
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.skills", { lang }), pal));
          rows.forEach((row) => sink.push(labelValue(row.label || "", row.value || "", pal)));
        },
        experience(sink) {
          const jobs = (data.experience || []).filter((j) => j.title || j.company);
          if (!jobs.length) return;
          sink.push(heading(I18N.t("resume.experience", { lang }), pal));
          jobs.forEach((job) => {
            const datesDisplay = ResumeData.formatDateRange(job.start_date || "", job.end_date || "") || job.dates || "";
            const employmentDisplay = ResumeData.formatEmploymentType(job.employment_type || "", lang);
            jobHeader(job.company || "", job.title || "", datesDisplay, job.company_url || "", employmentDisplay, pal)
              .forEach((p) => sink.push(p));
            (job.projects || []).forEach((proj) => {
              const name = (proj.name || "").trim();
              if (name) sink.push(projectHeading(name, proj.url || "", pal));
              (proj.bullets || []).forEach((b) => {
                if (b.trim()) sink.push(bullet(b.trim(), name ? 0.32 : 0.20, pal));
              });
            });
          });
        },
        personal_projects(sink) {
          const rows = (data.personal_projects || []).filter((p) =>
            (p.name || "").trim() || (p.url || "").trim() || (p.bullets || []).some((b) => b.trim()));
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.personal_projects", { lang }), pal));
          rows.forEach((proj) => {
            const name = (proj.name || "").trim();
            if (name) sink.push(projectHeading(name, proj.url || "", pal));
            (proj.bullets || []).forEach((b) => {
              if (b.trim()) sink.push(bullet(b.trim(), name ? 0.32 : 0.20, pal));
            });
          });
        },
        education(sink) {
          const rows = (data.education || []).filter((edu) => edu.degree || edu.school || edu.meta || edu.thesis);
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.education", { lang }), pal));
          rows.forEach((edu) => {
            const runs = [run(edu.degree || "", { font, size: sizeBody, bold: true, color: pal.textColor })];
            if (edu.school) {
              runs.push(run("  —  ", { font, size: sizeBody, color: pal.muted }));
              runs.push(textOrLink(edu.school, edu.school_url || "", { font, size: sizeBody, color: pal.muted }, pal.link));
            }
            sink.push(new Paragraph({ spacing: { after: sp(20) }, children: runs }));
            if (edu.meta) {
              sink.push(new Paragraph({
                spacing: { after: edu.thesis ? sp(20) : sp(160) },
                children: [run(edu.meta, { font, size: sizeMeta, italic: true, color: pal.muted })],
              }));
            }
            if (edu.thesis) {
              sink.push(new Paragraph({
                spacing: { after: sp(160) },
                children: [run(I18N.t("resume.thesis_label", { lang }) + edu.thesis, { font, size: sizeMeta, italic: true, color: pal.muted })],
              }));
            }
          });
        },
        publications(sink) {
          const rows = (data.publications || []).filter((p) => (p.title || "").trim() || (p.detail || "").trim());
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.publications", { lang }), pal));
          rows.forEach((item) => publicationEntry(item, pal).forEach((p) => sink.push(p)));
        },
        certificates(sink) {
          const rows = (data.certificates || []).filter((r) => r.label || r.value);
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.certificates", { lang }), pal));
          rows.forEach((row) => sink.push(labelValue(row.label || "", row.value || "", pal)));
        },
        additional(sink) {
          const rows = (data.additional || []).filter((r) => r.label || r.value);
          if (!rows.length) return;
          sink.push(heading(I18N.t("resume.additional", { lang }), pal));
          rows.forEach((row) => sink.push(labelValue(row.label || "", row.value || "", pal)));
        },
      };
    }

    // -------------------------------------------------------------- header --
    const personal = data.personal || {};
    const contactBits = ResumeData.resolveContactOrder(data).map((k) => personal[k]).filter(Boolean);
    const linkRows = (data.links || []).filter((r) => r.label || r.value);
    const hasPhoto = formatDef.showPhoto !== false && !!(personal.photo || "").trim();
    const rawPhotoScale = Number(personal.photo_size);
    const photoScale = Number.isFinite(rawPhotoScale) && rawPhotoScale > 0 ? Math.max(0.6, Math.min(1.8, rawPhotoScale)) : 1;
    const photoPx = (base) => Math.round(base * photoScale);
    const photoPosition = ["above", "left", "right"].includes(personal.photo_position) ? personal.photo_position : "above";

    function contactParagraph(pal, alignment) {
      if (!contactBits.length) return null;
      return new Paragraph({
        alignment: alignment !== undefined ? alignment : AlignmentType.CENTER,
        spacing: { after: linkRows.length ? sp(40) : sp(240) },
        border: linkRows.length ? undefined : { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
        children: [run(contactBits.join("   •   "), { font, size: sizeMeta, color: pal.muted })],
      });
    }

    function linksParagraph(pal, alignment) {
      if (!linkRows.length) return null;
      const linkChildren = [];
      linkRows.forEach((row, i) => {
        if (i > 0) linkChildren.push(run("   •   ", { font, size: sizeMeta, color: pal.muted }));
        linkChildren.push(textOrLink(row.label || "", row.value || "", { font, size: sizeMeta, color: pal.link }, pal.link));
      });
      return new Paragraph({
        alignment: alignment !== undefined ? alignment : AlignmentType.CENTER,
        spacing: { after: sp(240) },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
        children: linkChildren,
      });
    }

    function buildCenteredHeader(pal) {
      const paras = [];
      paras.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: sp(40) },
        children: [run((personal.name || "").toUpperCase(), { font, size: sizeName, bold: true, color: pal.accent, spacing: 14 })],
      }));
      if (personal.title) {
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: sp(140) },
          children: [run(personal.title, { font, size: sizeTitle, italic: true, color: pal.accentSoft })],
        }));
      }
      const cp = contactParagraph(pal);
      if (cp) paras.push(cp);
      const lp = linksParagraph(pal);
      if (lp) paras.push(lp);
      if (!hasPhoto) return paras;
      const photoRun = buildPhotoImageRun(personal.photo, photoPx(92), pal.accent);
      if (photoPosition === "above") {
        return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: sp(120) }, children: [photoRun] })].concat(paras);
      }
      return wrapWithPhoto(paras, photoRun, usableWidthTwip, photoPosition === "left");
    }

    function buildBannerHeader(pal) {
      const bannerFill = hex(style.accent_color);
      const nameRun = run((personal.name || "").toUpperCase(), { font, size: sizeName, bold: true, color: "FFFFFF", spacing: 14 });
      const titleRun = personal.title ? run(personal.title, { font, size: sizeTitle, italic: true, color: "FFFFFF" }) : null;
      const photoRun = hasPhoto ? buildPhotoImageRun(personal.photo, photoPx(96), "FFFFFF") : null;

      let bannerChildren;
      if (photoRun) {
        const textCell = new TableCell({
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [nameRun], shading: { fill: bannerFill } }),
            titleRun ? new Paragraph({ alignment: AlignmentType.CENTER, children: [titleRun], shading: { fill: bannerFill } })
                     : new Paragraph({ shading: { fill: bannerFill }, children: [] }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: bannerFill },
          width: { size: Math.round(usableWidthTwip * 0.78), type: WidthType.DXA },
        });
        const photoCell = new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [photoRun], shading: { fill: bannerFill } })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: bannerFill },
          width: { size: Math.round(usableWidthTwip * 0.22), type: WidthType.DXA },
        });
        bannerChildren = [new Table({
          width: { size: usableWidthTwip, type: WidthType.DXA },
          borders: NO_BORDERS,
          rows: [new TableRow({ children: [textCell, photoCell] })],
        })];
      } else {
        bannerChildren = [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, shading: { fill: bannerFill }, children: [nameRun] }),
        ];
        bannerChildren.push(titleRun
          ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: sp(160) }, shading: { fill: bannerFill }, children: [titleRun] })
          : new Paragraph({ spacing: { after: sp(80) }, shading: { fill: bannerFill }, children: [] }));
      }

      const below = [];
      const cp = contactParagraph(pal);
      if (cp) below.push(cp);
      const lp = linksParagraph(pal);
      if (lp) below.push(lp);
      return bannerChildren.concat(below);
    }

    function buildSplitHeader(pal) {
      const leftChildren = [
        new Paragraph({ children: [run((personal.name || "").toUpperCase(), { font, size: sizeName, bold: true, color: pal.accent, spacing: 14 })] }),
      ];
      if (personal.title) {
        leftChildren.push(new Paragraph({ children: [run(personal.title, { font, size: sizeTitle, italic: true, color: pal.accentSoft })] }));
      }
      const rightChildren = [];
      const cp = contactParagraph(pal, AlignmentType.RIGHT);
      if (cp) rightChildren.push(cp);
      const lp = linksParagraph(pal, AlignmentType.RIGHT);
      if (lp) rightChildren.push(lp);
      if (!rightChildren.length) rightChildren.push(new Paragraph({ children: [] }));

      const photoRun = hasPhoto ? buildPhotoImageRun(personal.photo, photoPx(82), pal.accent) : null;
      const cellPct = photoRun ? [0.4, 0.42, 0.18] : [0.5, 0.5];
      const leftCell = new TableCell({ children: leftChildren, verticalAlign: VerticalAlign.CENTER, width: { size: Math.round(usableWidthTwip * cellPct[0]), type: WidthType.DXA } });
      const rightCell = new TableCell({ children: rightChildren, verticalAlign: VerticalAlign.CENTER, width: { size: Math.round(usableWidthTwip * cellPct[1]), type: WidthType.DXA } });
      const rowCells = [leftCell, rightCell];
      if (photoRun) {
        rowCells.push(new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [photoRun] })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: Math.round(usableWidthTwip * cellPct[2]), type: WidthType.DXA },
        }));
      }
      return [
        new Table({ width: { size: usableWidthTwip, type: WidthType.DXA }, borders: NO_BORDERS, rows: [new TableRow({ children: rowCells })] }),
        new Paragraph({ spacing: { after: sp(200) }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } }, children: [] }),
      ];
    }

    function buildMinimalHeader(pal) {
      const paras = [
        new Paragraph({ spacing: { after: sp(40) }, children: [run((personal.name || "").toUpperCase(), { font, size: sizeName, bold: true, color: pal.accent, spacing: 14 })] }),
      ];
      if (personal.title) {
        paras.push(new Paragraph({ spacing: { after: sp(140) }, children: [run(personal.title, { font, size: sizeTitle, italic: true, color: pal.accentSoft })] }));
      }
      const cp = contactParagraph(pal, AlignmentType.LEFT);
      if (cp) paras.push(cp);
      const lp = linksParagraph(pal, AlignmentType.LEFT);
      if (lp) paras.push(lp);
      const photoRun = hasPhoto ? buildPhotoImageRun(personal.photo, photoPx(82), pal.accent) : null;
      return wrapWithPhoto(paras, photoRun, usableWidthTwip, false);
    }

    const HEADER_BUILDERS = {
      centered: buildCenteredHeader,
      banner: buildBannerHeader,
      split: buildSplitHeader,
      "minimal-left": buildMinimalHeader,
    };
    function buildHeader(pal) {
      return (HEADER_BUILDERS[formatDef.header] || buildCenteredHeader)(pal || palette);
    }

    function buildStackedSidebarHeader(pal) {
      const paras = [];
      const photoRun = hasPhoto ? buildPhotoImageRun(personal.photo, photoPx(100), pal.accent) : null;
      if (photoRun) paras.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: sp(120) }, children: [photoRun] }));
      paras.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: sp(40) },
        children: [run((personal.name || "").toUpperCase(), { font, size: sizeName - 4, bold: true, color: pal.accent, spacing: 10 })],
      }));
      if (personal.title) {
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: sp(140) },
          children: [run(personal.title, { font, size: sizeTitle, italic: true, color: pal.accentSoft })],
        }));
      }
      contactBits.forEach((bit) => {
        paras.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: sp(40) }, children: [run(bit, { font, size: sizeMeta, color: pal.muted })] }));
      });
      linkRows.forEach((row) => {
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: sp(40) },
          children: [textOrLink(row.label || "", row.value || "", { font, size: sizeMeta, color: pal.link }, pal.link)],
        }));
      });
      return paras;
    }

    // ------------------------------------------------------------ bodies ---
    function buildSingleColumnBody() {
      const children = [];
      buildHeader(palette).forEach((p) => children.push(p));
      const renderers = makeSectionRenderers(palette);
      ResumeData.resolveSectionOrder(data).forEach((key) => renderers[key](children));
      return children;
    }

    function buildSidebarBody() {
      const sidebarCfg = formatDef.sidebar;
      const allSections = ResumeData.resolveSectionOrder(data);
      const sidebarKeys = allSections.filter((k) => sidebarCfg.sectionKeys.includes(k));
      const mainKeys = allSections.filter((k) => !sidebarCfg.sectionKeys.includes(k));

      const sidebarPal = sidebarCfg.shaded ? lightPalette : palette;
      const sidebarRenderers = makeSectionRenderers(sidebarPal);
      const mainRenderers = makeSectionRenderers(palette);

      const sidebarChildren = [];
      const mainChildren = [];
      const topChildren = [];

      if (sidebarCfg.headerInSidebar) {
        sidebarChildren.push(...buildStackedSidebarHeader(sidebarPal));
      } else {
        buildHeader(palette).forEach((p) => topChildren.push(p));
      }

      sidebarKeys.forEach((k) => sidebarRenderers[k](sidebarChildren));
      mainKeys.forEach((k) => mainRenderers[k](mainChildren));
      if (!sidebarChildren.length) sidebarChildren.push(new Paragraph({ children: [] }));
      if (!mainChildren.length) mainChildren.push(new Paragraph({ children: [] }));

      const sidebarTwips = Math.round(usableWidthTwip * sidebarCfg.widthPct / 100);
      const mainTwips = usableWidthTwip - sidebarTwips;
      const margins = { top: 160, bottom: 160, left: 180, right: 180 };

      const sidebarCellOpts = { children: sidebarChildren, width: { size: sidebarTwips, type: WidthType.DXA }, margins };
      if (sidebarCfg.shaded) sidebarCellOpts.shading = { fill: accent };
      const mainCellOpts = { children: mainChildren, width: { size: mainTwips, type: WidthType.DXA }, margins };
      if (!sidebarCfg.shaded) {
        mainCellOpts.borders = Object.assign({}, NO_BORDERS,
          sidebarCfg.side === "left" ? { left: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }
                                      : { right: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } });
      }

      const sideCell = new TableCell(sidebarCellOpts);
      const mainCell = new TableCell(mainCellOpts);
      const rowCells = sidebarCfg.side === "left" ? [sideCell, mainCell] : [mainCell, sideCell];
      const columnWidths = sidebarCfg.side === "left" ? [sidebarTwips, mainTwips] : [mainTwips, sidebarTwips];

      const table = new Table({
        width: { size: usableWidthTwip, type: WidthType.DXA },
        columnWidths,
        borders: NO_BORDERS,
        rows: [new TableRow({ children: rowCells })],
      });

      return topChildren.concat([table]);
    }

    const children = formatDef.layout === "sidebar" ? buildSidebarBody() : buildSingleColumnBody();

    const docOptions = {
      styles: { default: { document: { run: { font, size: sizeBody } } } },
      sections: [{
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: {
              top: convertInchesToTwip(PAGE_MARGIN_IN),
              bottom: convertInchesToTwip(PAGE_MARGIN_IN),
              left: convertInchesToTwip(PAGE_MARGIN_IN),
              right: convertInchesToTwip(PAGE_MARGIN_IN),
            },
          },
        },
        children,
      }],
    };
    if (hex(style.background_color) !== "FFFFFF") {
      docOptions.background = { color: hex(style.background_color) };
    }
    return new Document(docOptions);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadDocx(data, filename) {
    const doc = buildDocument(data);
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, filename);
  }

  return { downloadDocx, buildDocument };
})();
