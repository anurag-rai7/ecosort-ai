"use strict";

(() => {
  const API_BASE_URL = window.location.origin;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  class ApiError extends Error {
    constructor(message, status = 0, details = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.details = details;
    }
  }

  async function request(path, options = {}) {
    let response;

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...options.headers
        }
      });
    } catch (networkError) {
      throw new ApiError(
        "Could not connect to the backend server. Ensure the EcoSort server is running.",
        0,
        networkError
      );
    }

    let data = null;

    try {
      data = await response.json();
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.message ||
            data?.message ||
            `Request failed (${response.status}).`;

      throw new ApiError(message, response.status, data);
    }

    return data;
  }

  async function checkHealth() {
    return request("/api/health");
  }

  async function classifyImage(file) {
    if (!(file instanceof File)) {
      throw new ApiError("Please select a valid image file.");
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError("Please select a JPEG, PNG, or WebP image.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new ApiError("Image must be smaller than 10 MB.");
    }

    const formData = new FormData();
    formData.append("file", file);

    return request("/api/classify", {
      method: "POST",
      body: formData
    });
  }

  async function getDisposalGuidance(category) {
    if (typeof category !== "string" || !category.trim()) {
      throw new ApiError("A valid waste category is required.");
    }

    return request(
      `/api/disposal/${encodeURIComponent(category.trim().toLowerCase())}`
    );
  }

  async function askChatbot(message, history = []) {
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1000
    ) {
      throw new ApiError(
        "Message must be between 1 and 1,000 characters."
      );
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            item =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
          )
          .slice(-20)
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 4000)
          }))
      : [];

    return request("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: message.trim(),
        history: safeHistory
      })
    });
  }

  async function getAISettings() {
    return request("/api/settings/ai");
  }

  async function saveAISettings(settings) {
    if (!settings || typeof settings !== "object") {
      throw new ApiError("Invalid AI settings payload.");
    }

    return request("/api/settings/ai", {
      method: "PUT",
      body: JSON.stringify({
        model: settings.model,
        api_key: settings.api_key || null
      })
    });
  }

  async function testAIConnection(settings = {}) {
    return request("/api/settings/ai/test", {
      method: "POST",
      body: JSON.stringify(settings)
    });
  }

  window.EcoSortAPI = Object.freeze({
    ApiError,
    checkHealth,
    healthCheck: checkHealth, // Support both method names
    classifyImage,
    getDisposalGuidance,
    getDisposalInfo: getDisposalGuidance,
    askChatbot,
    getAISettings,
    saveAISettings,
    testAIConnection
  });
})();