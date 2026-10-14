
"use strict";

(() => {
  const MAX_MESSAGE_LENGTH = 1000;
  const MAX_HISTORY_MESSAGES = 10;

  let initialized = false;
  let sending = false;
  let conversationHistory = [];

  const elements = {};

  function getElements() {
    for (const id of [
      "chat-form",
      "chat-input",
      "chat-send-button",
      "chat-messages",
      "chat-status"
    ]) {
      const element = document.getElementById(id);

      if (!element) {
        console.error(`EcoSort chatbot: missing #${id}`);
        return false;
      }

      elements[id] = element;
    }

    return true;
  }

  function addMessage(role, content, options = {}) {
    const message = document.createElement("div");
    message.className = role === "user"
      ? "chat-message chat-message-user"
      : "chat-message chat-message-assistant";

    if (options.loading) {
      message.classList.add("chat-message-loading");
    }

    const label = document.createElement("span");
    label.className = "chat-message-label";
    label.textContent = role === "user" ? "You" : "EcoSort AI";

    const text = document.createElement("p");
    text.className = "chat-message-text";
    text.textContent = content;

    message.append(label, text);
    elements["chat-messages"].appendChild(message);
    elements["chat-messages"].scrollTop =
      elements["chat-messages"].scrollHeight;

    return message;
  }

  function setStatus(message, type = "neutral") {
    const status = elements["chat-status"];
    status.textContent = message;
    status.classList.remove("is-error", "is-success");

    if (type === "error") status.classList.add("is-error");
    if (type === "success") status.classList.add("is-success");
  }

  function setSending(value) {
    sending = value;

    elements["chat-input"].disabled = value;
    elements["chat-send-button"].disabled = value;
    elements["chat-send-button"].classList.toggle("is-sending", value);
    elements["chat-send-button"].setAttribute("aria-busy", String(value));

    // Keep the arrow; never replace it with "Send" or "Sending…".
    elements["chat-send-button"].textContent = value ? "…" : "↑";
    elements["chat-send-button"].setAttribute(
      "aria-label",
      value ? "Sending message" : "Send message"
    );
  }

  function rememberMessage(role, content) {
    conversationHistory.push({ role, content });
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  }

  function isValidReply(data) {
    return data &&
      data.success === true &&
      typeof data.reply === "string" &&
      data.reply.trim().length > 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (sending) return;

    const message = elements["chat-input"].value.trim();

    if (!message) {
      setStatus("Type a question about waste or recycling.", "error");
      elements["chat-input"].focus();
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      setStatus("Your message must be 1,000 characters or fewer.", "error");
      return;
    }

    if (typeof window.EcoSortAPI?.askChatbot !== "function") {
      setStatus("The chatbot API did not load. Refresh the page.", "error");
      return;
    }

    // Send previous turns only. The current question is sent separately.
    const previousHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);

    addMessage("user", message);
    rememberMessage("user", message);
    elements["chat-input"].value = "";
    setSending(true);
    setStatus("EcoSort AI is thinking…");

    const loadingMessage = addMessage(
      "assistant",
      "Preparing your answer…",
      { loading: true }
    );

    try {
      const data = await window.EcoSortAPI.askChatbot(
        message,
        previousHistory
      );

      if (!isValidReply(data)) {
        throw new Error("The server response did not contain a valid reply.");
      }

      const reply = data.reply.trim();
      loadingMessage.remove();
      addMessage("assistant", reply);
      rememberMessage("assistant", reply);
      setStatus("Response received", "success");
    } catch (error) {
      loadingMessage.remove();

      // Show the server's useful message when available.
      const detail = error instanceof Error
        ? error.message
        : "Please try again in a moment.";

      addMessage(
        "assistant",
        `I couldn't answer that just now. ${detail}`
      );
      setStatus("Message failed. Check the backend terminal.", "error");

      console.error("EcoSort chatbot request failed:", error);
    } finally {
      setSending(false);
      elements["chat-input"].focus();
    }
  }

  function handleInput() {
    const remaining =
      MAX_MESSAGE_LENGTH - elements["chat-input"].value.length;

    if (remaining < 0) {
      setStatus(
        `Remove ${Math.abs(remaining)} character(s) before sending.`,
        "error"
      );
    } else if (!sending) {
      setStatus("Ask about recycling, sorting, or disposal.");
    }
  }

  function initChatbot() {
    if (initialized || !getElements()) return;

    elements["chat-form"].addEventListener("submit", handleSubmit);
    elements["chat-input"].addEventListener("input", handleInput);

    elements["chat-input"].addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        elements["chat-form"].requestSubmit();
      }
    });

    setStatus("Ask about recycling, sorting, or disposal.");

    if (!elements["chat-messages"].children.length) {
      addMessage(
        "assistant",
        "Hi! I'm EcoSort AI. Ask me about waste sorting, recycling, composting, or safe disposal. Local rules vary, so verify important disposal decisions with your local waste service."
      );
    }

    initialized = true;
  }

  window.EcoSortChatbot = Object.freeze({
    initChatbot,
    initialize: initChatbot
  });
})();
