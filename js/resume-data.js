"use strict";
/*
 * resume-data.js
 * Section/contact ordering, date formatting, and employment-type display —
 * shared by preview.js (live HTML) and docx-export.js (the exported file)
 * so the two never drift apart. Direct port of the shared helpers in
 * docx_engine.py.
 */

const ResumeData = (() => {
  const DEFAULT_SECTION_ORDER = [
    "summary", "skills", "experience", "education",
    "publications", "certificates", "additional",
  ];

  const DEFAULT_CONTACT_ORDER = ["location", "phone", "email", "visa"];

  function resolveSectionOrder(data) {
    const requested = (data && data.section_order) || [];
    const order = requested.filter((k) => DEFAULT_SECTION_ORDER.includes(k));
    DEFAULT_SECTION_ORDER.forEach((k) => { if (!order.includes(k)) order.push(k); });
    return order;
  }

  function resolveContactOrder(data) {
    // Contact fields are now individually addable/removable, so an empty
    // array is a real, intentional state (the user removed every field) —
    // only fall back to the full default set when contact_order is missing
    // entirely (fresh data / drafts saved before this field existed).
    const requested = data && data.contact_order;
    if (!Array.isArray(requested)) return [...DEFAULT_CONTACT_ORDER];
    const seen = new Set();
    return requested.filter((k) => {
      if (typeof k !== "string" || !k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function formatDateRange(startDate, endDate) {
    const start = (startDate || "").trim();
    const end = (endDate || "").trim();
    if (start && end) return `${start} – ${end}`;
    return start || end;
  }

  function formatEmploymentType(key, lang) {
    if (!key) return "";
    const lookupKey = `employment.${key}`;
    const display = I18N.t(lookupKey, { lang });
    return display !== lookupKey ? display : key;
  }

  const LEGACY_EMPLOYMENT_MAP = {
    "Full-time": "full_time", "Part-time": "part_time",
    Contract: "contract", Freelance: "freelance",
  };

  function normalizeEmploymentType(value) {
    return LEGACY_EMPLOYMENT_MAP[value] !== undefined ? LEGACY_EMPLOYMENT_MAP[value] : value;
  }

  function employmentTypeItems() {
    return [
      ["", ""],
      ["full_time", I18N.t("employment.full_time")],
      ["part_time", I18N.t("employment.part_time")],
      ["contract", I18N.t("employment.contract")],
      ["freelance", I18N.t("employment.freelance")],
    ];
  }

  return {
    DEFAULT_SECTION_ORDER, DEFAULT_CONTACT_ORDER,
    resolveSectionOrder, resolveContactOrder,
    formatDateRange, formatEmploymentType,
    normalizeEmploymentType, employmentTypeItems,
  };
})();
