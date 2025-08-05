/* script.js — cleaned and debugged version */

(() => {
  'use strict';

  // ----- State -----
  let words = [];
  let currentWordIndex = 0;

  // local fallback suggestions (used if Datamuse fails / offline)
  const FALLBACK_SYNONYMS = ["large", "huge", "massive", "gigantic", "immense", "colossal"];
  const FALLBACK_ANTONYMS  = ["small", "tiny", "little", "miniature", "petite", "minute"];

  // ----- Cached DOM refs (guard with null checks) -----
  const get = id => document.getElementById(id) || null;

  const wordTitle    = get("wordTitle");
  const wordPOS      = get("wordPOS");
  const wordDefinition = get("wordDefinition");

  const synonymInput = get("synonymInput");
  const antonymInput = get("antonymInput");
  const sentenceInput= get("sentenceInput");

  const synonymChips = get("synonymChips");
  const antonymChips = get("antonymChips");

  const feedback     = get("feedback");
  const playBtn      = get("playAudioBtn");
  const audioIcon    = get("audioIcon");
  const newWordBtn   = get("newWordBtn");

  const navbarToggle = get("toggleBtn");
  const navbarLinks  = get("navbarLinks");

  // ----- Utilities -----
  function showFeedback(message, type = "info", ms = 3000) {
    if (!feedback) return;
    feedback.className = `alert alert-${type} text-center w-75 mt-3`;
    feedback.textContent = message;
    feedback.classList.remove("d-none");
    if (ms > 0) {
      clearTimeout(showFeedback._t);
      showFeedback._t = setTimeout(() => feedback.classList.add("d-none"), ms);
    }
  }

  function safeParseJSON(raw, fallback = []) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      console.warn("safeParseJSON error:", e);
      return fallback;
    }
  }

  // Simple debounce
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ----- Word UI -----
  function updateWordUI() {
    const w = words[currentWordIndex];
    if (!w) return;
    if (wordTitle) wordTitle.textContent = w.word || "";
    if (wordPOS) wordPOS.textContent = w.partOfSpeech || w.pos || "";
    if (wordDefinition) wordDefinition.textContent = w.definition || "";
    if (synonymInput) synonymInput.value = "";
    if (antonymInput) antonymInput.value = "";
    if (sentenceInput) sentenceInput.value = "";
    if (feedback) feedback.classList.add("d-none");
  }

  // ----- Load words.json -----
  async function loadWords(url = "words.json") {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response not ok");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("words.json must be an array");
      words = data;
      currentWordIndex = 0;
      updateWordUI();
    } catch (err) {
      console.error("Failed to load words:", err);
      showFeedback("Failed to load vocabulary.", "danger");
    }
  }

  // ----- Next word -----
  function nextWord() {
    if (!words || words.length === 0) return;
    currentWordIndex = (currentWordIndex + 1) % words.length;
    updateWordUI();
    showFeedback("🔁 New word loaded!", "info", 1500);
  }

  // ----- Speech synthesis -----
  function playWord() {
    if (!wordTitle) return;
    const text = wordTitle.textContent?.trim();
    if (!text) return;

    if (!('speechSynthesis' in window)) {
      showFeedback("Speech synthesis not supported in this browser.", "warning");
      return;
    }

    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      if (audioIcon) {
        audioIcon.textContent = "🎵";
        audioIcon.classList.add("spin");
      }
      u.onend = () => {
        if (audioIcon) {
          audioIcon.textContent = "🔊";
          audioIcon.classList.remove("spin");
        }
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (err) {
      console.error("Speech error:", err);
      showFeedback("Speech synthesis error.", "danger");
    }
  }

  // ----- Datamuse helpers with fallback -----
  async function fetchDatamuse(query) {
    const url = `https://api.datamuse.com/words?${query}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Datamuse network error");
      const arr = await res.json();
      return Array.isArray(arr) ? arr.map(o => (o.word || "").toLowerCase()) : [];
    } catch (err) {
      console.warn("Datamuse fallback:", err);
      return null; // indicate fallback should be used
    }
  }

  async function checkRelation(word, relation) {
    // relation is like "rel_syn=word" or "rel_ant=word"
    const q = `${relation}=${encodeURIComponent(word)}`;
    const result = await fetchDatamuse(q);
    return result; // either array or null
  }

  // ----- Form & answer validation -----
  async function validateAnswerOnline(word, relationType, userInput, fallbackList) {
    // relationType: "syn" or "ant"
    if (!userInput) return { ok: false, message: "Please enter an answer." };
    const lower = userInput.toLowerCase().trim();

    const datamuseKey = relationType === "syn" ? "rel_syn" : "rel_ant";
    const fetched = await checkRelation(word, datamuseKey);

    if (Array.isArray(fetched)) {
      const ok = fetched.includes(lower);
      return { ok, source: "datamuse", fetched };
    } else {
      // fallback: simple check in fallbackList
      const ok = fallbackList.includes(lower);
      return { ok, source: "fallback", fetched: fallbackList };
    }
  }

  // ----- Sentence submission -----
  function submitSentence() {
    if (!sentenceInput || !wordTitle) return;
    const sentence = sentenceInput.value.trim();
    const word = (wordTitle.textContent || "").trim().toLowerCase();

    if (!sentence) return showFeedback("❗ Please write a sentence.", "warning");
    if (!sentence.toLowerCase().includes(word)) {
      return showFeedback(`❌ Your sentence must include the word: "${word}"`, "danger");
    }

    // safe localStorage handling
    const raw = localStorage.getItem("sentences");
    const arr = safeParseJSON(raw, []);
    arr.push({ word, sentence, createdAt: new Date().toISOString() });
    localStorage.setItem("sentences", JSON.stringify(arr));
    sentenceInput.value = "";
    showFeedback("✅ Sentence submitted successfully!", "success");
  }

  // ----- Chip suggestion helpers -----
  function createChipElement(text, inputEl, chipsContainer) {
    const chip = document.createElement("span");
    chip.className = "badge rounded-pill px-3 py-2";
    chip.style.cursor = "pointer";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      if (inputEl) inputEl.value = text;
      if (chipsContainer) chipsContainer.innerHTML = "";
    });
    return chip;
  }

  function updateChips(inputEl, chipsContainer, suggestions) {
    if (!inputEl || !chipsContainer) return;
    const v = inputEl.value.toLowerCase().trim();
    chipsContainer.innerHTML = "";
    if (!v) return;
    // match startsWith for responsive suggestions
    const matches = suggestions.filter(s => s.startsWith(v));
    if (matches.length === 0) {
      const span = document.createElement("span");
      span.className = "text-muted";
      span.textContent = "No suggestions found";
      chipsContainer.appendChild(span);
      return;
    }
    matches.forEach(s => chipsContainer.appendChild(createChipElement(s, inputEl, chipsContainer)));
  }

  // Debounced versions
  const debouncedSynonymChips = debounce(() => updateChips(synonymInput, synonymChips, FALLBACK_SYNONYMS), 200);
  const debouncedAntonymChips  = debounce(() => updateChips(antonymInput, antonymChips, FALLBACK_ANTONYMS), 200);

  // ----- Initialization & Event binding -----
  function bindEvents() {
    // play audio
    if (playBtn) playBtn.addEventListener("click", playWord);

    // next word
    if (newWordBtn) newWordBtn.addEventListener("click", nextWord);

    // sentence submit
    const sentenceForm = document.getElementById("sentenceForm");
    if (sentenceForm && sentenceInput) {
      sentenceForm.addEventListener("submit", (e) => {
        e.preventDefault();
        submitSentence();
      });
    }

    // synonym check (button or form)
    const synonymForm = document.getElementById("synonymForm");
    if (synonymForm && synonymInput) {
      synonymForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const word = (wordTitle?.textContent || "").trim().toLowerCase();
        const input = (synonymInput.value || "").trim();
        if (!input) return showFeedback("❗ Please enter a synonym.", "warning");
        const res = await validateAnswerOnline(word, "syn", input, FALLBACK_SYNONYMS);
        showFeedback(res.ok ? "✅ Correct Synonym!" : "❌ Try again.", res.ok ? "success" : "danger");
      });
    } else {
      // also support direct button handlers if user used checkSynonym() style
      const checkSynBtn = document.querySelector("[onclick='checkSynonym()']");
      if (checkSynBtn) {
        checkSynBtn.addEventListener("click", async (e) => {
          const word = (wordTitle?.textContent || "").trim().toLowerCase();
          const input = (synonymInput?.value || "").trim();
          if (!input) return showFeedback("❗ Please enter a synonym.", "warning");
          const res = await validateAnswerOnline(word, "syn", input, FALLBACK_SYNONYMS);
          showFeedback(res.ok ? "✅ Correct Synonym!" : "❌ Try again.", res.ok ? "success" : "danger");
        });
      }
    }

    // antonym check
    const antonymForm = document.getElementById("antonymForm");
    if (antonymForm && antonymInput) {
      antonymForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const word = (wordTitle?.textContent || "").trim().toLowerCase();
        const input = (antonymInput.value || "").trim();
        if (!input) return showFeedback("❗ Please enter an antonym.", "warning");
        const res = await validateAnswerOnline(word, "ant", input, FALLBACK_ANTONYMS);
        showFeedback(res.ok ? "✅ Correct Antonym!" : "❌ Try again.", res.ok ? "success" : "danger");
      });
    } else {
      const checkAntBtn = document.querySelector("[onclick='checkAntonym()']");
      if (checkAntBtn) {
        checkAntBtn.addEventListener("click", async () => {
          const word = (wordTitle?.textContent || "").trim().toLowerCase();
          const input = (antonymInput?.value || "").trim();
          if (!input) return showFeedback("❗ Please enter an antonym.", "warning");
          const res = await validateAnswerOnline(word, "ant", input, FALLBACK_ANTONYMS);
          showFeedback(res.ok ? "✅ Correct Antonym!" : "❌ Try again.", res.ok ? "success" : "danger");
        });
      }
    }

    // chips suggestions (debounced)
    if (synonymInput && synonymChips) synonymInput.addEventListener("input", debouncedSynonymChips);
    if (antonymInput && antonymChips) antonymInput.addEventListener("input", debouncedAntonymChips);

    // single delegated chip-click handler (for dynamic chips)
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (!el) return;
      if (el.matches && el.matches(".badge")) {
        // find the nearest input in the same section (safe)
        const section = el.closest("section");
        if (!section) return;
        const input = section.querySelector("input, textarea");
        if (input) input.value = el.textContent.trim();
      }
    });

    // navbar toggle (single implementation)
    if (navbarToggle && navbarLinks) {
      navbarToggle.addEventListener("click", () => {
        const expanded = navbarToggle.getAttribute("aria-expanded") === "true";
        navbarToggle.setAttribute("aria-expanded", String(!expanded));
        navbarLinks.classList.toggle("show");
      });

      // auto-close nav when clicking outside (mobile)
      document.addEventListener("click", (ev) => {
        if (!navbarLinks.classList.contains("show")) return;
        const target = ev.target;
        if (target === navbarToggle || navbarLinks.contains(target)) return;
        navbarLinks.classList.remove("show");
        navbarToggle.setAttribute("aria-expanded", "false");
      });
    }
  }

  // ----- Boot -----
  function boot() {
    bindEvents();
    loadWords(); // attempts to fetch words.json
  }

  // Auto-run
  document.addEventListener("DOMContentLoaded", boot);

  // Export small helpers (optional for console debugging)
  window.VocabApp = {
    nextWord,
    playWord,
    loadWords,
    updateWordUI
  };

})();
