
"use strict";

(() => {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  const CATEGORY_ICONS = {
    plastic_bottle: "🧴",
    paper_cardboard: "📄",
    glass: "🥛",
    metal_can: "🥫",
    organic_waste: "🍃",
    electronic_waste: "🔋",
    textile: "👕",
    hazardous: "⚠️",
    general_waste: "🔎"
  };

  const CATEGORY_LABELS = {
    plastic_bottle: "Plastic bottle",
    paper_cardboard: "Paper & cardboard",
    glass: "Glass",
    metal_can: "Metal can",
    organic_waste: "Organic waste",
    electronic_waste: "Electronic waste",
    textile: "Textiles & clothing",
    hazardous: "Hazardous waste",
    general_waste: "General waste"
  };

  const state = {
    selectedFile: null,
    previewUrl: null,
    isScanning: false
  };

  let elements = null;

  function getElements() {
    const ids = [
      "image-input",
      "camera-input",
      "camera-button",
      "upload-zone",
      "image-preview-wrap",
      "image-preview",
      "remove-image",
      "scan-button",
      "scan-message",
      "result-state",
      "empty-result",
      "classification-result",
      "result-category-icon",
      "result-item-name",
      "result-category-label",
      "result-confidence",
      "result-review",
      "result-evidence",
      "result-disposal-category",
      "result-instructions",
      "result-caution-text"
    ];

    const found = {};

    for (const id of ids) {
      const element = document.getElementById(id);

      if (!element) {
        throw new Error(`Scanner: missing HTML element #${id}`);
      }

      found[id] = element;
    }

    return found;
  }

  function setMessage(message, type = "") {
    elements["scan-message"].textContent = message;
    elements["scan-message"].className = "scan-message";

    if (type === "error") {
      elements["scan-message"].classList.add("is-error");
    } else if (type === "success") {
      elements["scan-message"].classList.add("is-success");
    }
  }

  function setResultStatus(message) {
    // Never overwrite result-state.textContent:
    // it contains the entire classification UI.
    elements["result-state"].setAttribute("aria-label", message);
  }

  function setScanning(scanning) {
    state.isScanning = scanning;

    elements["scan-button"].disabled =
      scanning || !state.selectedFile;

    elements["scan-button"].textContent = scanning
      ? "Analyzing image…"
      : "✳ Analyze waste item ↗";

    for (const id of [
      "image-input",
      "camera-input",
      "camera-button",
      "remove-image"
    ]) {
      elements[id].disabled = scanning;
    }
  }

  function clearResult() {
    elements["classification-result"].hidden = true;
    elements["empty-result"].hidden = false;
    elements["result-review"].hidden = true;
    elements["result-instructions"].replaceChildren();

    setResultStatus("Waiting for image");
  }

  function releasePreviewUrl() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
  }

  function clearSelection() {
    if (state.isScanning) return;

    state.selectedFile = null;
    releasePreviewUrl();

    elements["image-input"].value = "";
    elements["camera-input"].value = "";
    elements["image-preview"].removeAttribute("src");
    elements["image-preview-wrap"].hidden = true;
    elements["upload-zone"].hidden = false;

    clearResult();
    setScanning(false);
    setMessage("Select an image to begin.");
  }

  function validateFile(file) {
    if (!(file instanceof File)) {
      return "Please select an image.";
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return "Choose a JPEG, PNG, or WebP image.";
    }

    if (!file.size) {
      return "The selected file is empty.";
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return "The image must be 10 MB or smaller.";
    }

    return "";
  }

  function selectFile(file) {
    if (state.isScanning) return;

    const error = validateFile(file);

    if (error) {
      setMessage(error, "error");
      return;
    }

    releasePreviewUrl();

    state.selectedFile = file;
    state.previewUrl = URL.createObjectURL(file);

    elements["image-preview"].src = state.previewUrl;
    elements["image-preview-wrap"].hidden = false;
    elements["upload-zone"].hidden = true;

    clearResult();
    setScanning(false);

    setMessage(`Image selected: ${file.name}`, "success");
  }

  function firstString(...values) {
    return values.find(
      value => typeof value === "string" && value.trim()
    )?.trim() || "";
  }

  function getInstructions(disposal) {
    const candidates = [
      disposal?.instructions,
      disposal?.steps,
      disposal?.guidance,
      disposal?.disposal_instructions
    ];

    const value = candidates.find(Array.isArray);

    if (value) {
      return value
        .map(item =>
          typeof item === "string" ? item : item?.instruction
        )
        .filter(item =>
          typeof item === "string" && item.trim()
        );
    }

    if (typeof disposal === "string" && disposal.trim()) {
      return [disposal.trim()];
    }

    return [];
  }

  function normalizeResult(raw) {
    const result =
      raw?.result && typeof raw.result === "object"
        ? { ...raw, ...raw.result }
        : raw;

    if (!result || typeof result !== "object") {
      throw new Error("The server returned no classification data.");
    }

    const category = firstString(
      result.category,
      result.waste_category,
      result.disposal_category
    );

    const itemName = firstString(
      result.item_name,
      result.item,
      result.name,
      result.prediction,
      result.label,
      CATEGORY_LABELS[category]
    );

    if (!itemName && !category) {
      throw new Error(
        "The server response did not contain an item name or category."
      );
    }

    let confidence = Number(
      result.confidence ?? result.confidence_score ?? 0
    );

    if (confidence > 1 && confidence <= 100) {
      confidence /= 100;
    }

    if (!Number.isFinite(confidence)) {
      confidence = 0;
    }

    confidence = Math.max(0, Math.min(1, confidence));

    const disposal =
      result.disposal && typeof result.disposal === "object"
        ? result.disposal
        : result.guidance && typeof result.guidance === "object"
          ? result.guidance
          : {};

    const instructions = getInstructions(disposal);

    return {
      category: category || "general_waste",
      itemName: itemName || "Waste item",

      categoryLabel: firstString(
        result.category_label,
        result.category_name,
        result.waste_type,
        CATEGORY_LABELS[category],
        category.replaceAll("_", " ")
      ),

      confidence,

      evidence: firstString(
        result.visual_evidence,
        result.evidence,
        result.description
      ) || "No visual explanation was provided.",

      needsReview: Boolean(
        result.needs_review ||
        result.material_uncertain ||
        result.review_required
      ),

      disposalCategory: firstString(
        disposal.category,
        disposal.category_label,
        result.disposal_category
      ),

      instructions: instructions.length
        ? instructions
        : Array.isArray(result.disposal_instructions)
          ? result.disposal_instructions.filter(
              item => typeof item === "string"
            )
          : [],

      caution: firstString(
        disposal.caution,
        disposal.warning,
        result.caution
      )
    };
  }

  async function loadDisposalIfMissing(result) {
    if (
      result.instructions.length ||
      typeof window.EcoSortAPI?.getDisposalGuidance !== "function"
    ) {
      return result;
    }

    try {
      const response =
        await window.EcoSortAPI.getDisposalGuidance(result.category);

      const data =
        response?.disposal ||
        response?.guidance ||
        response;

      result.disposalCategory =
        result.disposalCategory ||
        firstString(data?.category, data?.label) ||
        result.categoryLabel;

      result.instructions = getInstructions(data);

      result.caution =
        result.caution ||
        firstString(data?.caution, data?.warning);
    } catch (error) {
      console.warn("Could not load disposal guidance:", error);
    }

    return result;
  }

  async function renderResult(raw) {
    const result = normalizeResult(raw);

    await loadDisposalIfMissing(result);

    elements["result-category-icon"].textContent =
      CATEGORY_ICONS[result.category] || "🔎";

    elements["result-item-name"].textContent = result.itemName;

    elements["result-category-label"].textContent =
      result.categoryLabel;

    elements["result-confidence"].textContent =
      `${Math.round(result.confidence * 100)}%`;

    elements["result-evidence"].textContent = result.evidence;

    elements["result-disposal-category"].textContent =
      result.disposalCategory || result.categoryLabel;

    elements["result-caution-text"].textContent = result.caution;

    elements["result-instructions"].replaceChildren();

    if (result.instructions.length) {
      result.instructions.forEach(instruction => {
        const item = document.createElement("li");
        item.textContent = instruction;
        elements["result-instructions"].appendChild(item);
      });
    } else {
      const item = document.createElement("li");

      item.textContent =
        "Check your local waste service for the correct disposal method.";

      elements["result-instructions"].appendChild(item);
    }

    elements["result-review"].hidden = !result.needsReview;

    // Show the actual classification UI.
    elements["empty-result"].hidden = true;
    elements["classification-result"].hidden = false;

    setResultStatus(
      result.needsReview
        ? "Prediction needs review"
        : "AI prediction received"
    );

    return result;
  }

  async function runScan() {
    if (state.isScanning || !state.selectedFile) return;

    if (typeof window.EcoSortAPI?.classifyImage !== "function") {
      setMessage(
        "The API client did not load. Refresh the page.",
        "error"
      );
      return;
    }

    const file = state.selectedFile;

    setScanning(true);
    setMessage("Analyzing your image. Please wait…");
    setResultStatus("Analyzing");

    try {
      const raw = await window.EcoSortAPI.classifyImage(file);

      await renderResult(raw);

      if (
        typeof window.EcoSortDashboard?.recordSuccessfulScan === "function"
      ) {
        try {
          const record =
            window.EcoSortDashboard.recordSuccessfulScan(raw, file.name);

          if (record?.saved === false) {
            setMessage(
              "Analysis complete, but browser history could not be saved.",
              "error"
            );
          } else {
            setMessage("Analysis complete.", "success");
          }
        } catch (historyError) {
          console.warn("Could not save scan history:", historyError);
          setMessage(
            "Analysis complete. Scan history could not be updated.",
            "success"
          );
        }
      } else {
        setMessage("Analysis complete.", "success");
      }
    } catch (error) {
      console.error("EcoSort classification failed:", error);

      clearResult();

      setMessage(
        error instanceof Error
          ? error.message
          : "The image could not be analyzed. Please try again.",
        "error"
      );

      setResultStatus("Analysis failed");
    } finally {
      setScanning(false);
    }
  }

  function initScanner() {
    if (elements) return;

    elements = getElements();

    elements["image-input"].addEventListener("change", event => {
      if (event.target.files?.[0]) {
        selectFile(event.target.files[0]);
      }

      event.target.value = "";
    });

    elements["camera-input"].addEventListener("change", event => {
      if (event.target.files?.[0]) {
        selectFile(event.target.files[0]);
      }

      event.target.value = "";
    });

    elements["camera-button"].addEventListener("click", () => {
      elements["camera-input"].click();
    });

    elements["remove-image"].addEventListener(
      "click",
      clearSelection
    );

    elements["scan-button"].addEventListener(
      "click",
      runScan
    );

    const zone = elements["upload-zone"];

    zone.addEventListener("dragover", event => {
      event.preventDefault();

      if (!state.isScanning) {
        zone.classList.add("is-dragging");
      }
    });

    zone.addEventListener("dragleave", event => {
      if (!event.relatedTarget || !zone.contains(event.relatedTarget)) {
        zone.classList.remove("is-dragging");
      }
    });

    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("is-dragging");

      if (state.isScanning) return;

      const files = event.dataTransfer?.files;

      if (!files?.length) return;

      if (files.length > 1) {
        setMessage("Please select one image at a time.", "error");
        return;
      }

      selectFile(files[0]);
    });

    window.addEventListener("beforeunload", releasePreviewUrl);

    clearResult();
    setScanning(false);
    setMessage("Select an image to begin.");
  }

  window.EcoSortScanner = Object.freeze({
    initScanner,
    initialize: initScanner,
    clearSelection
  });
})();
