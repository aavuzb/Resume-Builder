"use strict";
/*
 * resume-style.js
 * The resume's own visual identity — font, sizes, colors, page background —
 * as distinct from the app's own navy/gold chrome (see styles.css). Shared,
 * framework-free source of truth for defaults/bounds/sanitization so
 * preview.js (live HTML) and docx-export.js (the exported file) never drift
 * apart. Direct port of resume_style.py, extended with independent colors
 * per text role (name/title/headings/company/job-title/links/bullets/body/
 * meta) so every distinct piece of the resume can be recolored on its own —
 * not just the two "accent" tones the original design bundled everything
 * into.
 */

const ResumeStyle = (() => {
  const DEFAULT_STYLE = {
    font_family: "Calibri",
    accent_color: "#173A56",       // Full name
    accent_soft_color: "#3E6382",  // Professional title
    heading_color: "#173A56",      // Section heading text
    company_color: "#173A56",      // Company / organization names
    job_title_color: "#3E6382",    // Job titles (the line under the company)
    link_color: "#3E6382",         // Links — LinkedIn, GitHub, hyperlinked names
    bullet_color: "#3E6382",       // Bullet markers
    highlight_color: "#C7A252",    // Section rule / accent (underline, pill fill, borders)
    text_color: "#212428",         // Body text
    muted_color: "#5B636B",        // Dates & meta text
    background_color: "#FFFFFF",   // Page background
    size_name: 20,
    size_title: 12,
    size_heading: 11,
    size_body: 10,
    size_meta: 9,
  };

  const COLOR_KEYS = Object.keys(DEFAULT_STYLE).filter((k) => k.endsWith("_color"));
  const SIZE_KEYS = Object.keys(DEFAULT_STYLE).filter((k) => k.startsWith("size_"));

  const SIZE_BOUNDS = {
    size_name: [14, 32],
    size_title: [9, 18],
    size_heading: [9, 16],
    size_body: [8, 13],
    size_meta: [7, 12],
  };

  const FONT_CHOICES = [
    "Calibri", "Arial", "Helvetica", "Verdana", "Tahoma",
    "Georgia", "Cambria", "Garamond", "Times New Roman",
  ];

  const SERIF_STACKS = {
    Georgia: 'Georgia, "Times New Roman", serif',
    Cambria: 'Cambria, Georgia, serif',
    Garamond: 'Garamond, "Times New Roman", serif',
    "Times New Roman": '"Times New Roman", Times, serif',
  };

  function cssFontStack(fontFamily) {
    if (SERIF_STACKS[fontFamily]) return SERIF_STACKS[fontFamily];
    if (fontFamily === "Calibri") return 'Calibri, "Segoe UI", Arial, sans-serif';
    return `"${fontFamily}", Arial, sans-serif`;
  }

  // Each preset mirrors DEFAULT_STYLE's relationships (heading/company follow
  // the "accent" tone, job-title/link/bullet follow the "accent-soft" tone)
  // so picking a preset still looks coherent — power users can then pull any
  // of the 8 colors apart independently afterward via Style Settings.
  const STYLE_PRESETS = {
    "Navy & Brass": {
      font_family: "Calibri",
      accent_color: "#173A56", accent_soft_color: "#3E6382",
      heading_color: "#173A56", company_color: "#173A56",
      job_title_color: "#3E6382", link_color: "#3E6382", bullet_color: "#3E6382",
      highlight_color: "#C7A252", text_color: "#212428", muted_color: "#5B636B", background_color: "#FFFFFF",
    },
    "Charcoal & Slate": {
      font_family: "Arial",
      accent_color: "#1F2937", accent_soft_color: "#4B5563",
      heading_color: "#1F2937", company_color: "#1F2937",
      job_title_color: "#4B5563", link_color: "#4B5563", bullet_color: "#4B5563",
      highlight_color: "#9CA3AF", text_color: "#111827", muted_color: "#6B7280", background_color: "#FFFFFF",
    },
    "Forest & Sand": {
      font_family: "Georgia",
      accent_color: "#1F3D2B", accent_soft_color: "#4B6B4F",
      heading_color: "#1F3D2B", company_color: "#1F3D2B",
      job_title_color: "#4B6B4F", link_color: "#4B6B4F", bullet_color: "#4B6B4F",
      highlight_color: "#C9A66B", text_color: "#242420", muted_color: "#6B6558", background_color: "#FFFFFF",
    },
    "Burgundy Classic": {
      font_family: "Cambria",
      accent_color: "#5C1A2B", accent_soft_color: "#8C4A5A",
      heading_color: "#5C1A2B", company_color: "#5C1A2B",
      job_title_color: "#8C4A5A", link_color: "#8C4A5A", bullet_color: "#8C4A5A",
      highlight_color: "#B08D57", text_color: "#2A2320", muted_color: "#75655F", background_color: "#FFFFFF",
    },
    "Modern Teal": {
      font_family: "Verdana",
      accent_color: "#0F4C4C", accent_soft_color: "#2E7D7D",
      heading_color: "#0F4C4C", company_color: "#0F4C4C",
      job_title_color: "#2E7D7D", link_color: "#2E7D7D", bullet_color: "#2E7D7D",
      highlight_color: "#D9A441", text_color: "#1C1F1F", muted_color: "#5F6B6B", background_color: "#FFFFFF",
    },
  };

  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

  function resolveStyle(data) {
    const style = Object.assign({}, DEFAULT_STYLE);
    const custom = (data && data.style) || {};
    if (typeof custom !== "object" || custom === null) return style;
    Object.keys(custom).forEach((key) => {
      if (!(key in DEFAULT_STYLE)) return;
      const value = custom[key];
      if (COLOR_KEYS.includes(key)) {
        if (typeof value === "string" && HEX_RE.test(value)) style[key] = value.toUpperCase();
      } else if (SIZE_KEYS.includes(key)) {
        const [lo, hi] = SIZE_BOUNDS[key];
        const n = Math.round(Number(value));
        if (!Number.isNaN(n)) style[key] = Math.max(lo, Math.min(hi, n));
      } else if (key === "font_family") {
        if (typeof value === "string" && value.trim()) style[key] = value.trim();
      }
    });
    return style;
  }

  return {
    DEFAULT_STYLE, COLOR_KEYS, SIZE_KEYS, SIZE_BOUNDS, FONT_CHOICES,
    STYLE_PRESETS, cssFontStack, resolveStyle,
  };
})();
