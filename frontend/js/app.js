"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const api = () => window.EcoSortAPI;

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function showMessage(message, type = "") {
    const element = $("ai-settings-message");
    if (!element) return;

    element.textContent = message;
    element.className = type ? `ai-settings-message ${type}` : "ai-settings-message";
  }

  function setButtonLoading(button, loading, loadingText, defaultText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : defaultText;
  }

  function initializeThemeToggle() {
    const button = $("theme-toggle");
    const icon = $("theme-toggle-icon");
    const label = $("theme-toggle-label");

    if (!button) return;

    function applyTheme(theme) {
      const selected = theme === "light" ? "light" : "dark";

      document.documentElement.dataset.theme = selected;
      document.body.dataset.theme = selected;

      button.setAttribute("aria-pressed", String(selected === "light"));
      button.setAttribute(
        "aria-label",
        selected === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );

      if (icon) icon.textContent = selected === "dark" ? "☼" : "☾";
      if (label) label.textContent = selected === "dark" ? "Light mode" : "Dark mode";
    }

    let savedTheme = "dark";

    try {
      savedTheme = localStorage.getItem("ecosort-theme") || "dark";
    } catch {
      // Continue with default theme when storage is restricted
    }

    applyTheme(savedTheme);

    button.addEventListener("click", () => {
      const nextTheme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";

      applyTheme(nextTheme);

      try {
        localStorage.setItem("ecosort-theme", nextTheme);
      } catch {
        // Theme remains active for the session
      }
    });
  }

  function initializeNavigation() {
    const sidebar = $("sidebar");
    const menuButton = $("mobile-menu");

    if (menuButton && sidebar) {
      menuButton.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
      });
    }

    document.querySelectorAll("[data-scroll-target]").forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("data-scroll-target");
        const target = targetId && $(targetId);

        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });

        if (sidebar) sidebar.classList.remove("is-open");
        if (menuButton) menuButton.setAttribute("aria-expanded", "false");

        document.querySelectorAll(".nav-link").forEach((navLink) => {
          navLink.classList.toggle("active", navLink === link);
        });
      });
    });
  }

  async function checkBackend() {
    const dot = $("connection-dot");
    const status = $("connection-status");

    try {
      const checkMethod = api()?.checkHealth || api()?.healthCheck;
      if (typeof checkMethod !== "function") {
        throw new Error("API health method unavailable");
      }

      await checkMethod();

      if (dot) {
        dot.classList.remove("is-offline");
        dot.classList.add("is-online");
      }

      if (status) status.textContent = "Backend connected";
      return true;
    } catch {
      if (dot) {
        dot.classList.remove("is-online");
        dot.classList.add("is-offline");
      }

      if (status) status.textContent = "Backend offline";
      return false;
    }
  }

  function initializeChatSuggestions() {
    document.querySelectorAll("[data-chat-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $("chat-input");
        const form = $("chat-form");

        if (!input) return;

        input.value = button.getAttribute("data-chat-prompt") || "";
        input.focus();
        input.dispatchEvent(new Event("input", { bubbles: true }));

        if (form) {
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  function initializeAISettings() {
    const modal = $("ai-settings-modal");
    const openBtn = $("open-settings-button");
    const openNavBtn = $("open-settings-nav");
    const closeBtn = $("ai-settings-close");
    const form = $("ai-settings-form");
    const modelSelect = $("ai-model");
    const keyInput = $("ai-api-key");
    const keyStatus = $("ai-key-status");
    const testButton = $("ai-test-button");
    const saveButton = $("ai-save-button");

    if (!form || !modelSelect || !keyInput) return;

    let keyConfigured = false;

    function openModal() {
      if (modal) {
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        loadSettings();
      }
    }

    function closeModal() {
      if (modal) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        showMessage("");
      }
    }

    openBtn?.addEventListener("click", openModal);
    openNavBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal && !modal.hidden) {
        closeModal();
      }
    });

    function getSelectedSettings() {
      return {
        model: modelSelect.value,
        api_key: keyInput.value.trim()
      };
    }

    async function loadSettings() {
      if (typeof api()?.getAISettings !== "function") {
        showMessage("AI settings API is unavailable.", "error");
        return;
      }

      modelSelect.disabled = true;
      showMessage("Loading engine settings...");

      try {
        const response = await api().getAISettings();
        const settings = response?.data || response;
        const models = settings.available_models || [];

        if (Array.isArray(models) && models.length > 0) {
          modelSelect.replaceChildren();

          models.forEach((model) => {
            const option = document.createElement("option");
            option.value = typeof model === "string" ? model : model.id;
            option.textContent =
              typeof model === "string" ? model : model.name || model.id;

            modelSelect.appendChild(option);
          });
        }

        if (settings.model) {
          modelSelect.value = settings.model;
        }

        keyConfigured = Boolean(settings.api_key_configured);

        if (keyStatus) {
          keyStatus.textContent = keyConfigured
            ? "✓ API key configured in backend. Enter a new key only to replace it."
            : "No API key configured. Enter your Gemini API key above.";
          keyStatus.className = keyConfigured ? "form-hint is-configured" : "form-hint";
        }

        showMessage("");
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "Could not load AI settings.",
          "error"
        );
      } finally {
        modelSelect.disabled = false;
      }
    }

    testButton?.addEventListener("click", async () => {
      if (typeof api()?.testAIConnection !== "function") {
        showMessage("Connection test API is unavailable.", "error");
        return;
      }

      const settings = getSelectedSettings();

      if (!settings.model) {
        showMessage("Please select a Gemini model.", "error");
        return;
      }

      setButtonLoading(testButton, true, "Testing...", "Test connection");
      showMessage("Testing Gemini AI connection...");

      try {
        const response = await api().testAIConnection(settings);
        const result = response?.data || response;

        if (result?.success === false) {
          throw new Error(result.message || "Connection test failed.");
        }

        showMessage(
          result?.message || "✓ Gemini connection successful!",
          "success"
        );
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "Connection test failed.",
          "error"
        );
      } finally {
        setButtonLoading(testButton, false, "Testing...", "Test connection");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (typeof api()?.saveAISettings !== "function") {
        showMessage("Save settings API is unavailable.", "error");
        return;
      }

      const settings = getSelectedSettings();

      if (!settings.model) {
        showMessage("Please select a Gemini model.", "error");
        return;
      }

      setButtonLoading(saveButton, true, "Saving...", "Save settings");
      showMessage("Saving AI settings...");

      try {
        const response = await api().saveAISettings(settings);
        const result = response?.data || response;

        if (result?.success === false) {
          throw new Error(result.message || "Could not save AI settings.");
        }

        if (settings.api_key) {
          keyConfigured = true;
          keyInput.value = "";
        }

        if (keyStatus) {
          keyStatus.textContent = keyConfigured
            ? "✓ API key configured in backend."
            : "No API key configured.";
          keyStatus.className = keyConfigured ? "form-hint is-configured" : "form-hint";
        }

        showMessage(
          `✓ Settings saved. Active model: ${settings.model}`,
          "success"
        );
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "Could not save AI settings.",
          "error"
        );
      } finally {
        setButtonLoading(saveButton, false, "Saving...", "Save settings");
      }
    });

    loadSettings();
  }

  function initialize() {
    initializeThemeToggle();
    initializeNavigation();
    initializeChatSuggestions();
    initializeAISettings();

    setText("current-year", String(new Date().getFullYear()));

    checkBackend();
    window.setInterval(checkBackend, 30000);

    // Initialize all components reliably
    if (typeof window.EcoSortScanner?.initScanner === "function") {
      window.EcoSortScanner.initScanner();
    } else if (typeof window.EcoSortScanner?.initialize === "function") {
      window.EcoSortScanner.initialize();
    }

    if (typeof window.EcoSortDashboard?.initDashboard === "function") {
      window.EcoSortDashboard.initDashboard();
    } else if (typeof window.EcoSortDashboard?.initialize === "function") {
      window.EcoSortDashboard.initialize();
    }

    if (typeof window.EcoSortMatrix?.initMatrix === "function") {
      window.EcoSortMatrix.initMatrix();
    } else if (typeof window.EcoSortMatrix?.initialize === "function") {
      window.EcoSortMatrix.initialize();
    }

    if (typeof window.EcoSortChatbot?.initChatbot === "function") {
      window.EcoSortChatbot.initChatbot();
    } else if (typeof window.EcoSortChatbot?.initialize === "function") {
      window.EcoSortChatbot.initialize();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.EcoSortApp = Object.freeze({
    checkBackend,
    initializeThemeToggle
  });
})();
