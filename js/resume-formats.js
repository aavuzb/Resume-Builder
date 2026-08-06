"use strict";
/*
 * resume-formats.js
 * The resume's *layout* identity — header shape, section-heading decoration,
 * bullet glyph, single-column vs. sidebar body, optional photo — as distinct
 * from ResumeStyle (fonts/colors/sizes). Shared, framework-free source of
 * truth so preview.js (live HTML + PDF, since PDF prints the same HTML) and
 * docx-export.js (the exported .docx) never drift apart, mirroring the
 * resolveXxx(data) pattern already used by ResumeData/ResumeStyle.
 *
 * Every format is a small config object, not a bespoke renderer: there are
 * only two structural skeletons (single-column, sidebar), built once each in
 * preview.js/docx-export.js and parameterized by these configs. Adding an
 * 11th format later means adding one object here, not a new renderer.
 *
 * Each format also carries a curated `defaultStyle` — the font/color pairing
 * that makes it look like a finished, professional template out of the box
 * instead of every layout wearing the same Calibri-navy outfit. This is only
 * ever applied when the user explicitly clicks Apply in the format picker
 * (see FormatDialog / app.js's _onFormatChanged) — loading saved data always
 * respects whatever style was actually saved, never re-derives it from the
 * format. Style Settings remains fully available afterward to customize
 * further on top of a format's default.
 */

const ResumeFormats = (() => {
  const DEFAULT_FORMAT_ID = "classic-navy";

  // sidebar.sectionKeys only BUCKETS ResumeData.resolveSectionOrder(data)
  // into columns — it never reorders sections; the user's chosen relative
  // order is preserved within each bucket.
  const FORMAT_DEFS = [
    {
      id: "classic-navy",
      layout: "single",
      header: "centered",
      heading: "underline",
      density: "normal",
      bulletChar: "•",
      sidebar: null,
      timelineExperience: false,
      iconContacts: false,
      photoShape: "circle",
      showPhoto: true,
      // This is ResumeStyle.DEFAULT_STYLE itself — the original look.
      defaultStyle: {
        font_family: "Calibri",
        accent_color: "#173A56", accent_soft_color: "#3E6382",
        heading_color: "#173A56", company_color: "#173A56",
        job_title_color: "#3E6382", link_color: "#3E6382", bullet_color: "#3E6382",
        highlight_color: "#C7A252", text_color: "#212428", muted_color: "#5B636B", background_color: "#FFFFFF",
      },
    },
    {
      id: "modern-banner",
      layout: "single",
      header: "banner",
      heading: "bar",
      density: "normal",
      bulletChar: "•",
      sidebar: null,
      timelineExperience: false,
      iconContacts: false,
      photoShape: "rounded",
      showPhoto: true,
      defaultStyle: {
        font_family: "Arial",
        accent_color: "#1E3A5F", accent_soft_color: "#3D6D99",
        heading_color: "#1E3A5F", company_color: "#1E3A5F",
        job_title_color: "#3D6D99", link_color: "#3D6D99", bullet_color: "#3D6D99",
        highlight_color: "#E3A857", text_color: "#1B1F24", muted_color: "#5B6572", background_color: "#FFFFFF",
      },
    },
    {
      id: "executive-sidebar",
      layout: "sidebar",
      header: "centered",
      heading: "left-border",
      density: "normal",
      bulletChar: "•",
      sidebar: {
        side: "left", widthPct: 34, shaded: true, headerInSidebar: true,
        sectionKeys: ["skills", "education", "certificates"],
      },
      timelineExperience: false,
      iconContacts: false,
      photoShape: "circle",
      showPhoto: true,
      defaultStyle: {
        font_family: "Arial",
        accent_color: "#1F2937", accent_soft_color: "#4B5563",
        heading_color: "#1F2937", company_color: "#1F2937",
        job_title_color: "#4B5563", link_color: "#4B5563", bullet_color: "#4B5563",
        highlight_color: "#9CA3AF", text_color: "#111827", muted_color: "#6B7280", background_color: "#FFFFFF",
      },
    },
    {
      id: "creative-sidebar",
      layout: "sidebar",
      header: "centered",
      heading: "pill",
      density: "normal",
      bulletChar: "▸",
      sidebar: {
        side: "right", widthPct: 32, shaded: true, headerInSidebar: true,
        sectionKeys: ["skills", "certificates", "additional"],
      },
      timelineExperience: false,
      iconContacts: false,
      photoShape: "circle",
      showPhoto: true,
      defaultStyle: {
        font_family: "Verdana",
        accent_color: "#0F4C4C", accent_soft_color: "#2E7D7D",
        heading_color: "#0F4C4C", company_color: "#0F4C4C",
        job_title_color: "#2E7D7D", link_color: "#2E7D7D", bullet_color: "#2E7D7D",
        highlight_color: "#D9A441", text_color: "#1C1F1F", muted_color: "#5F6B6B", background_color: "#FFFFFF",
      },
    },
    {
      id: "two-column-grid",
      layout: "sidebar",
      header: "centered",
      heading: "underline",
      density: "normal",
      bulletChar: "•",
      sidebar: {
        side: "left", widthPct: 45, shaded: false, headerInSidebar: false,
        sectionKeys: ["summary", "skills", "education", "certificates"],
      },
      timelineExperience: false,
      iconContacts: false,
      photoShape: "rounded",
      showPhoto: true,
      defaultStyle: {
        font_family: "Helvetica",
        accent_color: "#2C3E50", accent_soft_color: "#5D7A94",
        heading_color: "#2C3E50", company_color: "#2C3E50",
        job_title_color: "#5D7A94", link_color: "#5D7A94", bullet_color: "#5D7A94",
        highlight_color: "#4FB0AE", text_color: "#22262B", muted_color: "#67707A", background_color: "#FFFFFF",
      },
    },
    {
      id: "minimalist",
      layout: "single",
      header: "minimal-left",
      heading: "left-border",
      density: "normal",
      bulletChar: "–",
      sidebar: null,
      timelineExperience: false,
      iconContacts: false,
      photoShape: "square",
      showPhoto: true,
      defaultStyle: {
        font_family: "Helvetica",
        accent_color: "#33383D", accent_soft_color: "#6B7178",
        heading_color: "#33383D", company_color: "#33383D",
        job_title_color: "#6B7178", link_color: "#6B7178", bullet_color: "#6B7178",
        highlight_color: "#B7A99A", text_color: "#24272B", muted_color: "#82888E", background_color: "#FFFFFF",
      },
    },
    {
      id: "compact-ats",
      layout: "single",
      header: "centered",
      heading: "left-border",
      density: "compact",
      bulletChar: "-",
      sidebar: null,
      timelineExperience: false,
      iconContacts: false,
      photoShape: "square",
      showPhoto: false,
      // Near-grayscale and ATS-safe: minimal color, small tight sizes.
      defaultStyle: {
        font_family: "Arial",
        accent_color: "#1A1A1A", accent_soft_color: "#444444",
        heading_color: "#1A1A1A", company_color: "#1A1A1A",
        job_title_color: "#444444", link_color: "#444444", bullet_color: "#444444",
        highlight_color: "#999999", text_color: "#101010", muted_color: "#5A5A5A", background_color: "#FFFFFF",
        size_name: 18, size_title: 11, size_heading: 10, size_body: 9, size_meta: 8,
      },
    },
    {
      id: "timeline",
      layout: "single",
      header: "centered",
      heading: "underline",
      density: "normal",
      bulletChar: "•",
      sidebar: null,
      timelineExperience: true,
      iconContacts: false,
      photoShape: "circle",
      showPhoto: true,
      defaultStyle: {
        font_family: "Calibri",
        accent_color: "#164B60", accent_soft_color: "#3E7C93",
        heading_color: "#164B60", company_color: "#164B60",
        job_title_color: "#3E7C93", link_color: "#3E7C93", bullet_color: "#3E7C93",
        highlight_color: "#E0793C", text_color: "#1D2226", muted_color: "#5D6B72", background_color: "#FFFFFF",
      },
    },
    {
      id: "academic-cv",
      layout: "single",
      header: "split",
      heading: "boxed",
      density: "normal",
      bulletChar: "•",
      sidebar: null,
      timelineExperience: false,
      iconContacts: false,
      photoShape: "square",
      showPhoto: true,
      defaultStyle: {
        font_family: "Cambria",
        accent_color: "#5C1A2B", accent_soft_color: "#8C4A5A",
        heading_color: "#5C1A2B", company_color: "#5C1A2B",
        job_title_color: "#8C4A5A", link_color: "#8C4A5A", bullet_color: "#8C4A5A",
        highlight_color: "#B08D57", text_color: "#2A2320", muted_color: "#75655F", background_color: "#FFFFFF",
      },
    },
    {
      id: "icon-modern",
      layout: "single",
      header: "centered",
      heading: "left-border",
      density: "normal",
      bulletChar: "▸",
      sidebar: null,
      timelineExperience: false,
      iconContacts: true,
      photoShape: "circle",
      showPhoto: true,
      defaultStyle: {
        font_family: "Tahoma",
        accent_color: "#3E5C76", accent_soft_color: "#748CAB",
        heading_color: "#3E5C76", company_color: "#3E5C76",
        job_title_color: "#748CAB", link_color: "#748CAB", bullet_color: "#748CAB",
        highlight_color: "#F0A868", text_color: "#1E2328", muted_color: "#6B7280", background_color: "#FFFFFF",
      },
    },
  ];

  const FORMAT_BY_ID = {};
  FORMAT_DEFS.forEach((f) => { FORMAT_BY_ID[f.id] = f; });

  function resolveFormatId(data) {
    const id = data && data.format;
    return (typeof id === "string" && FORMAT_BY_ID[id]) ? id : DEFAULT_FORMAT_ID;
  }

  function resolveFormat(data) {
    return FORMAT_BY_ID[resolveFormatId(data)];
  }

  // Fully resolved (all fields present, validated) style for a format's
  // curated default look — merges its defaultStyle over ResumeStyle's own
  // defaults via the same validation resolveStyle() already does for
  // user-saved styles, so a typo'd hex/size here can't produce bad CSS.
  function resolveDefaultStyle(formatId) {
    const def = FORMAT_BY_ID[formatId] || FORMAT_BY_ID[DEFAULT_FORMAT_ID];
    return ResumeStyle.resolveStyle({ style: def.defaultStyle || {} });
  }

  return {
    FORMAT_DEFS, FORMAT_BY_ID, DEFAULT_FORMAT_ID,
    resolveFormatId, resolveFormat, resolveDefaultStyle,
  };
})();
