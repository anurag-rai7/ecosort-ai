
"use strict";

(() => {
  const STORAGE_KEY = "ecosort_ai_scan_history_v1";
  const MAX_HISTORY_ITEMS = 100;
  const MAX_STORED_IMAGE_NAME = 120;

  const CATEGORY_ICONS = {
    plastic_bottle: "♻",
    paper_cardboard: "📄",
    glass: "🥛",
    metal_can: "🥫",
    organic_waste: "🍃",
    electronic_waste: "🔋",
    textile: "👕",
    hazardous: "⚠️",
    general_waste: "🔎"
  };

  function readHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => {
          return (
            item &&
            typeof item.id === "string" &&
            typeof item.itemName === "string" &&
            typeof item.category === "string" &&
            typeof item.categoryLabel === "string" &&
            typeof item.confidence === "number" &&
            typeof item.needsReview === "boolean" &&
            typeof item.timestamp === "string" &&
            Number.isFinite(Date.parse(item.timestamp))
          );
        })
        .slice(0, MAX_HISTORY_ITEMS);
    } catch {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS))
      );

      return true;
    } catch {
      return false;
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function getHistory() {
    return readHistory();
  }

  function getStats(history = readHistory()) {
    return {
      scans: history.length,
      recyclable: history.filter((item) => {
        return [
          "plastic_bottle",
          "paper_cardboard",
          "glass",
          "metal_can"
        ].includes(item.category);
      }).length,
      needsReview: history.filter((item) => item.needsReview).length
    };
  }

  function renderStats() {
    const history = readHistory();
    const stats = getStats(history);

    const scansElement = document.getElementById("stat-scans");
    const recyclableElement = document.getElementById("stat-recyclable");
    const reviewElement = document.getElementById("stat-review");

    if (scansElement) {
      scansElement.textContent = String(stats.scans);
    }

    if (recyclableElement) {
      recyclableElement.textContent = String(stats.recyclable);
    }

    if (reviewElement) {
      reviewElement.textContent = String(stats.needsReview);
    }
  }

  function renderHistory() {
    const container = document.getElementById("scan-history");

    if (!container) {
      return;
    }

    const history = readHistory();

    container.replaceChildren();

    if (history.length === 0) {
      container.appendChild(
        createElement(
          "p",
          "empty-history",
          "No scans recorded yet. Your successful scans will appear here."
        )
      );

      renderStats();
      return;
    }

    history.slice(0, 10).forEach((item) => {
      const row = createElement("article", "history-row");

      const icon = createElement(
        "div",
        "history-icon",
        CATEGORY_ICONS[item.category] || "♻"
      );
      icon.setAttribute("aria-hidden", "true");

      const details = createElement("div", "history-details");
      details.appendChild(
        createElement("strong", "", item.itemName)
      );
      details.appendChild(
        createElement(
          "span",
          "",
          `${item.categoryLabel} · AI confidence ${Math.round(
            item.confidence * 100
          )}%${item.needsReview ? " · Needs review" : ""}`
        )
      );

      const time = createElement(
        "time",
        "history-time",
        formatDate(item.timestamp)
      );
      time.dateTime = item.timestamp;

      row.append(icon, details, time);
      container.appendChild(row);
    });

    renderStats();
  }

  function recordSuccessfulScan(result, fileName = "Uploaded image") {
    if (
      !result ||
      result.success !== true ||
      typeof result.item_name !== "string" ||
      typeof result.category !== "string" ||
      typeof result.category_label !== "string" ||
      typeof result.confidence !== "number" ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0 ||
      result.confidence > 1 ||
      typeof result.needs_review !== "boolean"
    ) {
      throw new Error(
        "Cannot save this scan because the classification result is invalid."
      );
    }

    const history = readHistory();

    const record = {
      id:
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemName: result.item_name.slice(0, MAX_STORED_IMAGE_NAME),
      fileName:
        typeof fileName === "string"
          ? fileName.slice(0, MAX_STORED_IMAGE_NAME)
          : "Uploaded image",
      category: result.category,
      categoryLabel: result.category_label,
      confidence: result.confidence,
      needsReview: result.needs_review,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [record, ...history].slice(
      0,
      MAX_HISTORY_ITEMS
    );

    const saved = writeHistory(updatedHistory);

    renderHistory();

    return {
      record,
      saved
    };
  }

  function clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The current screen will still be reset below.
    }

    renderHistory();
  }

  function initDashboard() {
    const clearButton = document.getElementById("clear-history-button");

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        const confirmed = window.confirm(
          "Clear all saved EcoSort AI scan history from this browser?"
        );

        if (confirmed) {
          clearHistory();
        }
      });
    }

    renderHistory();
  }

  window.EcoSortDashboard = Object.freeze({
    initDashboard,
    initialize: initDashboard,
    getHistory,
    getStats,
    renderHistory,
    recordSuccessfulScan,
    clearHistory
  });
})();
