import { fetchHealth, streamChat } from "./api.js";
import { DEFAULT_MODEL, MODEL_OPTIONS } from "./config.js";
import {
  appendMessage,
  finalizeMessage,
  removeNode,
  renderModelOptions,
  setComposerState,
  setHealthError,
  setHealthState,
  setStreamStatus,
  updateMessage,
} from "./ui.js";

const elements = {
  composerForm: document.querySelector("#composerForm"),
  promptInput: document.querySelector("#promptInput"),
  modelSelect: document.querySelector("#modelSelect"),
  systemPrompt: document.querySelector("#systemPrompt"),
  messages: document.querySelector("#messages"),
  emptyState: document.querySelector("#emptyState"),
  sendButton: document.querySelector("#sendButton"),
  stopButton: document.querySelector("#stopButton"),
  clearButton: document.querySelector("#clearButton"),
  streamStatus: document.querySelector("#streamStatus"),
  healthBadge: document.querySelector("#healthBadge"),
  healthDetails: document.querySelector("#healthDetails"),
};

const state = {
  messages: [],
  abortController: null,
};

function hideEmptyState() {
  if (elements.emptyState) {
    elements.emptyState.hidden = true;
  }
}

function showEmptyState() {
  if (elements.emptyState) {
    elements.emptyState.hidden = false;
  }
}

function commitAssistantMessage(assistantMessage, partialContent) {
  if (!partialContent.trim()) {
    return;
  }

  state.messages.push({
    ...assistantMessage,
    content: partialContent,
  });
}

async function loadHealth() {
  try {
    const health = await fetchHealth();
    setHealthState(elements, health);
    renderModelOptions(
      elements.modelSelect,
      MODEL_OPTIONS,
      health.defaultModel || DEFAULT_MODEL,
    );
  } catch (error) {
    renderModelOptions(elements.modelSelect, MODEL_OPTIONS, DEFAULT_MODEL);
    setHealthError(
      elements,
      error instanceof Error ? error.message : "No se pudo consultar /health.",
    );
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const prompt = elements.promptInput.value.trim();
  if (!prompt || state.abortController) {
    return;
  }

  hideEmptyState();

  const userMessage = {
    role: "user",
    content: prompt,
  };

  state.messages.push(userMessage);
  appendMessage(elements.messages, userMessage);
  elements.promptInput.value = "";

  const assistantMessage = {
    role: "assistant",
    content: "",
  };

  const assistantNode = appendMessage(elements.messages, assistantMessage, {
    streaming: true,
  });

  const abortController = new AbortController();
  state.abortController = abortController;
  setComposerState(elements, true);
  setStreamStatus(elements.streamStatus, "Esperando primeros tokens...");

  try {
    await streamChat(
      {
        model: elements.modelSelect.value || DEFAULT_MODEL,
        systemPrompt: elements.systemPrompt.value.trim(),
        messages: state.messages,
      },
      {
        signal: abortController.signal,
        onMeta(data) {
          setStreamStatus(
            elements.streamStatus,
            `Streaming activo con ${data.requestedModel}.`,
          );
        },
        onToken(data) {
          assistantMessage.content += data.text ?? "";
          updateMessage(assistantNode, assistantMessage.content);
        },
        onDone(data) {
          finalizeMessage(assistantNode);
          commitAssistantMessage(assistantMessage, assistantMessage.content);

          const modelLabel = data.actualModel ?? elements.modelSelect.value;
          setStreamStatus(
            elements.streamStatus,
            `Respuesta completada con ${modelLabel}.`,
          );
        },
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      finalizeMessage(assistantNode);

      if (assistantMessage.content.trim()) {
        commitAssistantMessage(assistantMessage, assistantMessage.content);
      } else {
        removeNode(assistantNode);
      }

      setStreamStatus(elements.streamStatus, "Streaming detenido por el usuario.");
      return;
    }

    const message =
      error instanceof Error ? error.message : "Ocurrio un error inesperado.";

    if (assistantMessage.content.trim()) {
      commitAssistantMessage(assistantMessage, assistantMessage.content);
      finalizeMessage(assistantNode, { error: true });
      updateMessage(
        assistantNode,
        `${assistantMessage.content}\n\n[Error durante el streaming] ${message}`,
      );
    } else {
      updateMessage(assistantNode, message);
      finalizeMessage(assistantNode, { error: true });
    }

    setStreamStatus(elements.streamStatus, `Error: ${message}`);
  } finally {
    state.abortController = null;
    setComposerState(elements, false);
  }
}

function stopStreaming() {
  state.abortController?.abort();
}

function clearConversation() {
  stopStreaming();
  state.messages = [];
  elements.messages.replaceChildren(elements.emptyState);
  showEmptyState();
  setStreamStatus(elements.streamStatus, "Conversacion limpiada.");
}

function bindEvents() {
  elements.composerForm.addEventListener("submit", handleSubmit);
  elements.stopButton.addEventListener("click", stopStreaming);
  elements.clearButton.addEventListener("click", clearConversation);
}

async function bootstrap() {
  renderModelOptions(elements.modelSelect, MODEL_OPTIONS, DEFAULT_MODEL);
  bindEvents();
  await loadHealth();
}

bootstrap();
