(() => {
  "use strict";

  // ---------------------------------------------------------------- state
  const state = {
    snippets: [],
    tags: [],
    languages: [],
    query: "",
    activeLanguage: "",
    activeTag: "",
    sort: "newest",
    editingId: null,
    searchDebounce: null,
  };

  // Deterministic color per language so the badge means something,
  // not just decoration.
  const LANG_COLORS = {
    javascript: "#E3A83C", typescript: "#4C8DF6", python: "#5FC9A8",
    go: "#4FD1C5", rust: "#E1665B", java: "#D97757", c: "#8A8D9E",
    cpp: "#8A8D9E", csharp: "#8E7CE8", ruby: "#E1665B", php: "#7C9CE8",
    swift: "#E3A83C", kotlin: "#8E7CE8", sql: "#5FC9A8", bash: "#8A8D9E",
    html: "#E3A83C", css: "#4C8DF6", json: "#8A8D9E", yaml: "#8A8D9E",
    markdown: "#8A8D9E", plaintext: "#5C5F72",
  };

  function langColor(lang) {
    return LANG_COLORS[lang] || "#5FC9A8";
  }

  // ------------------------------------------------------------ dom refs
  const $ = (sel) => document.querySelector(sel);

  const grid = $("#snippet-grid");
  const emptyState = $("#empty-state");
  const resultsHeading = $("#results-heading");
  const resultsCount = $("#results-count");
  const languageListEl = $("#language-list");
  const tagListEl = $("#tag-list");
  const activeFiltersEl = $("#active-filters");
  const searchInput = $("#search-input");
  const sortSelect = $("#sort-select");

  const overlay = $("#overlay");
  const panel = $("#panel");
  const viewMode = $("#view-mode");
  const editForm = $("#edit-form");

  // ------------------------------------------------------------------ api
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body.error) message = body.error;
      } catch (_) { /* no body */ }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadAll() {
    const [snippets, tags, languages] = await Promise.all([
      fetchSnippets(),
      api("/api/tags"),
      api("/api/languages"),
    ]);
    state.tags = tags;
    state.languages = languages;
    renderLanguages();
    renderTags();
    renderGrid(snippets);
  }

  async function fetchSnippets() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.activeLanguage) params.set("language", state.activeLanguage);
    if (state.activeTag) params.set("tag", state.activeTag);
    params.set("sort", state.sort);
    const snippets = await api(`/api/snippets?${params.toString()}`);
    state.snippets = snippets;
    return snippets;
  }

  async function refreshList() {
    const snippets = await fetchSnippets();
    renderGrid(snippets);
  }

  async function refreshFilters() {
    const [tags, languages] = await Promise.all([api("/api/tags"), api("/api/languages")]);
    state.tags = tags;
    state.languages = languages;
    renderLanguages();
    renderTags();
  }

  // --------------------------------------------------------------- render

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderLanguages() {
    languageListEl.innerHTML = "";
    state.languages.forEach((lang) => {
      const count = state.snippets.filter((s) => s.language === lang).length;
      const btn = document.createElement("button");
      btn.className = "filter-item" + (state.activeLanguage === lang ? " active" : "");
      btn.innerHTML = `
        <span class="dot" style="background:${langColor(lang)}"></span>
        <span class="name">${escapeHtml(lang)}</span>
      `;
      btn.addEventListener("click", () => {
        state.activeLanguage = state.activeLanguage === lang ? "" : lang;
        onFiltersChanged();
      });
      languageListEl.appendChild(btn);
    });
    if (!state.languages.length) {
      languageListEl.innerHTML = `<div class="rail-section-title" style="margin:0;opacity:.6">No languages yet</div>`;
    }
  }

  function renderTags() {
    tagListEl.innerHTML = "";
    state.tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.className = "filter-item" + (state.activeTag === tag.name ? " active" : "");
      btn.innerHTML = `
        <span class="name">#${escapeHtml(tag.name)}</span>
        <span class="count">${tag.count}</span>
      `;
      btn.addEventListener("click", () => {
        state.activeTag = state.activeTag === tag.name ? "" : tag.name;
        onFiltersChanged();
      });
      tagListEl.appendChild(btn);
    });
    if (!state.tags.length) {
      tagListEl.innerHTML = `<div class="rail-section-title" style="margin:0;opacity:.6">No tags yet</div>`;
    }
  }

  function renderActiveFilters() {
    const chips = [];
    if (state.activeLanguage) chips.push(state.activeLanguage);
    if (state.activeTag) chips.push(`#${state.activeTag}`);
    if (!chips.length) {
      activeFiltersEl.innerHTML = "";
      return;
    }
    activeFiltersEl.innerHTML = `<button class="clear-filters">Clear filters (${escapeHtml(chips.join(", "))})</button>`;
    activeFiltersEl.querySelector(".clear-filters").addEventListener("click", () => {
      state.activeLanguage = "";
      state.activeTag = "";
      onFiltersChanged();
    });
  }

  function renderGrid(snippets) {
    grid.innerHTML = "";
    emptyState.hidden = snippets.length > 0;
    grid.hidden = snippets.length === 0;

    resultsCount.textContent = snippets.length
      ? `${snippets.length} snippet${snippets.length === 1 ? "" : "s"}`
      : "";

    const hasFilters = state.query || state.activeLanguage || state.activeTag;
    resultsHeading.textContent = hasFilters ? "Results" : "All snippets";

    snippets.forEach((snippet) => {
      const card = document.createElement("div");
      card.className = "snippet-card";

      const codePreview = escapeHtml(snippet.code.split("\n").slice(0, 4).join("\n"));

      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">${escapeHtml(snippet.title)}</div>
          <span class="lang-badge" style="background:${langColor(snippet.language)}22;color:${langColor(snippet.language)}">${escapeHtml(snippet.language)}</span>
        </div>
        ${snippet.description ? `<div class="card-description">${escapeHtml(snippet.description)}</div>` : ""}
        <pre class="card-code-preview"><code class="language-${escapeHtml(snippet.language)}">${codePreview}</code></pre>
        <div class="card-bottom">
          <div class="card-tags">${snippet.tags.slice(0, 3).map((t) => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join("")}</div>
          <span class="card-date">${formatDate(snippet.created_at)}</span>
        </div>
      `;

      card.addEventListener("click", () => openView(snippet.id));
      grid.appendChild(card);

      const codeEl = card.querySelector("code");
      if (window.hljs) window.hljs.highlightElement(codeEl);
    });

    renderActiveFilters();
  }

  function populateLanguageSelect() {
    const select = $("#f-language");
    const all = Array.from(new Set([...state.languages, ...Object.keys(LANG_COLORS)]));
    select.innerHTML = all.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");
  }

  // -------------------------------------------------------------- events

  function onFiltersChanged() {
    renderLanguages();
    renderTags();
    refreshList();
  }

  searchInput.addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(refreshList, 250);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  sortSelect.addEventListener("change", (e) => {
    state.sort = e.target.value;
    refreshList();
  });

  // ---------------------------------------------------------------- panel

  function openPanel() {
    overlay.hidden = false;
    panel.hidden = false;
  }

  function closePanel() {
    overlay.hidden = true;
    panel.hidden = true;
    state.editingId = null;
  }

  overlay.addEventListener("click", closePanel);
  $("#close-view-btn").addEventListener("click", closePanel);
  $("#close-edit-btn").addEventListener("click", closePanel);
  $("#cancel-edit-btn").addEventListener("click", () => {
    if (state.editingId) {
      openView(state.editingId);
    } else {
      closePanel();
    }
  });

  function openView(id) {
    const snippet = state.snippets.find((s) => s.id === id);
    if (!snippet) return;

    viewMode.hidden = false;
    editForm.hidden = true;
    state.editingId = id;

    $("#view-language").textContent = snippet.language;
    $("#view-language").style.background = langColor(snippet.language) + "22";
    $("#view-language").style.color = langColor(snippet.language);

    $("#view-title").textContent = snippet.title;
    $("#view-description").textContent = snippet.description || "";
    $("#view-description").hidden = !snippet.description;

    $("#view-tags").innerHTML = snippet.tags.map((t) => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join("");

    const codeEl = $("#view-code");
    codeEl.className = `language-${snippet.language}`;
    codeEl.textContent = snippet.code;
    if (window.hljs) window.hljs.highlightElement(codeEl);

    const updated = snippet.updated_at !== snippet.created_at ? ` · updated ${formatDate(snippet.updated_at)}` : "";
    $("#view-meta").textContent = `Created ${formatDate(snippet.created_at)}${updated}`;

    openPanel();
  }

  function openEditor(id = null) {
    populateLanguageSelect();
    viewMode.hidden = true;
    editForm.hidden = false;
    state.editingId = id;
    $("#form-error").hidden = true;

    if (id) {
      const snippet = state.snippets.find((s) => s.id === id);
      $("#edit-heading").textContent = "Edit snippet";
      $("#f-title").value = snippet.title;
      $("#f-language").value = snippet.language;
      $("#f-tags").value = snippet.tags.join(", ");
      $("#f-description").value = snippet.description;
      $("#f-code").value = snippet.code;
    } else {
      $("#edit-heading").textContent = "New snippet";
      editForm.reset();
      $("#f-language").value = "javascript";
    }

    openPanel();
    $("#f-title").focus();
  }

  $("#new-snippet-btn").addEventListener("click", () => openEditor());
  $("#empty-new-btn").addEventListener("click", () => openEditor());
  $("#edit-btn").addEventListener("click", () => openEditor(state.editingId));

  $("#delete-btn").addEventListener("click", async () => {
    if (!state.editingId) return;
    if (!confirm("Delete this snippet? This can't be undone.")) return;
    try {
      await api(`/api/snippets/${state.editingId}`, { method: "DELETE" });
      closePanel();
      showToast("Snippet deleted");
      await refreshList();
      await refreshFilters();
    } catch (err) {
      showToast(err.message);
    }
  });

  $("#copy-btn").addEventListener("click", async () => {
    const snippet = state.snippets.find((s) => s.id === state.editingId);
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet.code);
      showToast("Copied to clipboard");
    } catch (_) {
      showToast("Couldn't copy — select the code manually");
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: $("#f-title").value.trim(),
      language: $("#f-language").value,
      description: $("#f-description").value.trim(),
      code: $("#f-code").value,
      tags: $("#f-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const errorBox = $("#form-error");
    errorBox.hidden = true;

    try {
      let saved;
      if (state.editingId) {
        saved = await api(`/api/snippets/${state.editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        saved = await api("/api/snippets", { method: "POST", body: JSON.stringify(payload) });
      }
      showToast(state.editingId ? "Snippet updated" : "Snippet saved");
      await refreshList();
      await refreshFilters();
      openView(saved.id);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  });

  // ---------------------------------------------------------------- toast

  let toastTimer = null;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
  }

  // ----------------------------------------------------------------- init

  loadAll().catch((err) => showToast(`Failed to load: ${err.message}`));
})();
