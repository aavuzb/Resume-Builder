"use strict";
/*
 * sample-data.js
 * Two datasets:
 *  - SAMPLE_DATA: the form's starting state — every field empty. Each input
 *    carries its own gray placeholder text (an "e.g. ..." example) that
 *    disappears the moment you start typing, same as the URL fields.
 *  - EXAMPLE_RESUME_DATA: used only by the live preview (preview.js) to fill
 *    in whichever fields/sections are still empty, so the preview always
 *    shows a complete, correctly-formatted resume structure — dimmed to
 *    make clear it's a placeholder — instead of a blank page. Each piece is
 *    replaced by your real content field-by-field as you type it.
 */

const SAMPLE_DATA = {
  personal: {
    name: "",
    title: "",
    location: "",
    phone: "",
    email: "",
    visa: "",
  },
  links: [
    { label: "LinkedIn", value: "" },
    { label: "GitHub", value: "" },
    { label: "Portfolio", value: "" },
  ],
  summary: "",
  skills: [
    { label: "", value: "" },
  ],
  experience: [
    {
      title: "",
      company: "",
      company_url: "",
      employment_type: "",
      start_date: "",
      end_date: "",
      projects: [],
    },
  ],
  personal_projects: [
    { name: "", url: "", bullets: [] },
  ],
  education: [
    { degree: "", school: "", school_url: "", meta: "", thesis: "" },
  ],
  publications: [
    { title: "", detail: "" },
  ],
  certificates: [
    { label: "", value: "" },
  ],
  additional: [
    { label: "", value: "" },
  ],
};

const EXAMPLE_RESUME_DATA = {
  personal: {
    name: "Abdurakhmon Abduraimjonov",
    title: "AI / Machine Learning Engineer  •  Software Developer",
    location: "Seoul, South Korea",
    phone: "+82 10-0000-0000",
    email: "aavuzb@gmail.com",
    visa: "Visa: F-5 (Permanent Residency)",
  },
  summary:
    "AI Engineer and Software Developer with 6+ years of experience in Artificial " +
    "Intelligence, Machine Learning, Deep Learning, Computer Vision, and full-stack " +
    "application development. Skilled across the modern LLM stack, model fine-tuning, " +
    "and AI coding agents. Proficient in Python, C#, C++, Java, and JavaScript/Node.js, " +
    "with experience in web development and REST API design.",
  skills: [
    { label: "AI / ML / DL", value: "Artificial Intelligence, Machine Learning, Deep Learning, Computer Vision" },
    { label: "LLM & GenAI", value: "Hugging Face, Unsloth, vLLM, Ollama, LM Studio, LLaMA, Gemma, Qwen, DeepSeek" },
    { label: "AI Coding Agents", value: "Cline, Aider, Cursor, Codex, Claude Code" },
    { label: "Web Development", value: "HTML, CSS, JavaScript, Node.js" },
    { label: "Programming", value: "Python, C#, C++, Java, JavaScript" },
  ],
  experience: [
    {
      title: "Software Developer",
      company: "Linetron",
      company_url: "https://www.linetron.co.kr",
      employment_type: "full_time",
      start_date: "Mar 2025",
      end_date: "Present",
      projects: [
        {
          name: "Auto Test — LLM-powered test generation tool",
          url: "",
          bullets: [
            "Designed Auto Test, generating test reports and code directly from written test specifications.",
            "Served open-source models (LLaMA, Gemma) locally via vLLM for high-speed inference.",
            "Fine-tuned models (Full, LoRA, QLoRA) with Hugging Face and Unsloth for domain-specific tasks.",
          ],
        },
        {
          name: "Sensor Dashboard",
          url: "",
          bullets: [
            "Built a real-time dashboard integrating PLC devices via TCP/IP socket communication.",
          ],
        },
        {
          name: "Air Cleaner Android App",
          url: "",
          bullets: [
            "Built an Android application to control and monitor an air purification device.",
          ],
        },
      ],
    },
  ],
  personal_projects: [
    {
      name: "Resume Builder — Web-based resume creation tool",
      url: "",
      bullets: [
        "Built a client-side resume builder with a live preview, DOCX/PDF export, and multi-language support.",
        "Implemented drag-and-drop section reordering and a dozen swappable resume layout templates.",
      ],
    },
    {
      name: "Auto Test — LLM-powered test generation tool (open-source)",
      url: "",
      bullets: [
        "Open-sourced a CLI that turns written test specifications into runnable test code using local LLMs.",
      ],
    },
  ],
  education: [
    {
      degree: "Master's Degree in Computer Engineering",
      school: "Kumoh National Institute of Technology, Gumi, Korea",
      school_url: "https://www.kumoh.ac.kr",
      meta: "2017 – 2019  |  GPA: 4.1 / 4.5",
      thesis: "Multi-Scale Template Matching for Real-Time Object Detection in Manufacturing Systems",
    },
  ],
  publications: [
    {
      title: "Specific Object Detection Technology Through Convergence of Deep " +
             "Learning and a Novel Multi-Scale Template Matching Technique",
      detail: "Patent — Registered 2022",
    },
  ],
  certificates: [
    { label: "Korean Language", value: "TOPIK Level 4 — May 2026" },
    { label: "English Language", value: "IELTS Band 6 — November 2024" },
  ],
  additional: [
    { label: "Nationality", value: "Uzbekistan" },
  ],
};
