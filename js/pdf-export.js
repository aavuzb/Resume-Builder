"use strict";
/*
 * pdf-export.js
 * The browser stand-in for docx_engine.py's build_resume_pdf(), which
 * shelled out to LibreOffice/Word. There's no such conversion engine
 * available client-side, but there's something better than rasterizing a
 * screenshot: the browser's own print pipeline. This renders the exact same
 * HTML/CSS the live preview already knows how to draw into a hidden iframe
 * (with an 8.5x11in @page rule — see preview.js's @media print block) and
 * calls window.print() on it, so "Save as PDF" in the print dialog produces
 * a real, vector, selectable-text PDF — not a screenshot.
 */

const ResumePdf = (() => {
  function downloadPdf(data, suggestedTitle) {
    return new Promise((resolve) => {
      let html = ResumePreview.renderResumeHtml(data);
      const titleTag = `<title>${(suggestedTitle || "Resume").replace(/[<>&]/g, "")}</title>`;
      html = html.replace("<meta charset='utf-8'>", `<meta charset='utf-8'>${titleTag}`);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 500);
        resolve();
      };

      iframe.addEventListener("load", () => {
        const win = iframe.contentWindow;
        try {
          win.addEventListener("afterprint", cleanup);
        } catch (err) { /* not fatal */ }
        setTimeout(() => {
          win.focus();
          win.print();
          // Not every browser fires afterprint reliably inside an iframe —
          // fall back to a generous timeout so the hidden iframe never lingers.
          setTimeout(cleanup, 60000);
        }, 150);
      });

      iframe.srcdoc = html;
    });
  }

  return { downloadPdf };
})();
