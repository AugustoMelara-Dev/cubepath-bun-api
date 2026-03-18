function roleLabel(role) {
  switch (role) {
    case "user":
      return "Tu";
    case "assistant":
      return "Modelo";
    default:
      return "Sistema";
  }
}

export function renderModelOptions(select, options, preferredValue) {
  select.replaceChildren();

  const knownValues = new Set(options.map((option) => option.value));
  const mergedOptions = [...options];

  if (preferredValue && !knownValues.has(preferredValue)) {
    mergedOptions.unshift({
      value: preferredValue,
      label: `${preferredValue} (configurado)`,
    });
  }

  for (const option of mergedOptions) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }

  if (preferredValue) {
    select.value = preferredValue;
  }
}

export function appendMessage(container, message, options = {}) {
  const article = document.createElement("article");
  article.className = `message message--${message.role}`;
  article.dataset.streaming = options.streaming ? "true" : "false";

  if (options.error) {
    article.classList.add("message--error");
  }

  const role = document.createElement("span");
  role.className = "message__role";
  role.textContent = roleLabel(message.role);

  const content = document.createElement("div");
  content.className = "message__content";
  content.textContent = message.content;

  article.append(role, content);
  container.append(article);
  container.scrollTop = container.scrollHeight;

  return article;
}

export function updateMessage(node, content) {
  const contentNode = node.querySelector(".message__content");
  if (!contentNode) {
    return;
  }

  contentNode.textContent = content;
  node.parentElement?.scrollTo({
    top: node.parentElement.scrollHeight,
    behavior: "smooth",
  });
}

export function finalizeMessage(node, options = {}) {
  node.dataset.streaming = "false";

  if (options.error) {
    node.classList.add("message--error");
  }
}

export function removeNode(node) {
  node.remove();
}

export function setStreamStatus(element, text) {
  element.textContent = text;
}

export function setComposerState(elements, streaming) {
  elements.sendButton.disabled = streaming;
  elements.stopButton.disabled = !streaming;
  elements.modelSelect.disabled = streaming;
  elements.systemPrompt.disabled = streaming;
}

export function setHealthState(elements, health) {
  elements.healthBadge.className = "status-pill";

  if (health.apiKeyConfigured) {
    elements.healthBadge.classList.add("status-pill--ok");
    elements.healthBadge.textContent = "OpenRouter listo";
    elements.healthDetails.textContent = `Modelo por defecto: ${health.defaultModel}`;
    return;
  }

  elements.healthBadge.classList.add("status-pill--warning");
  elements.healthBadge.textContent = "Falta API key";
  elements.healthDetails.textContent =
    "Configura OPENROUTER_API_KEY para activar llamadas reales a OpenRouter.";
}

export function setHealthError(elements, message) {
  elements.healthBadge.className = "status-pill status-pill--error";
  elements.healthBadge.textContent = "Error de health";
  elements.healthDetails.textContent = message;
}
