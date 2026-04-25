import { useMemo, useState } from "react";

const defaultHeaders = {
  "content-type": "application/json",
  "x-role": "editor",
  "x-user-id": "demo-user",
  "x-tenant-id": "demo-tenant",
  "x-cwd": "/",
};

const examplePrompts = [
  "What year did Apollo 11 land on the Moon?",
  "Give me a short summary of major space missions.",
  "Which moon is the largest in the solar system?",
  "What are the key differences between Mars and Earth?",
  "Explain what an event horizon is in simple terms.",
];

function App() {
  const [messages, setMessages] = useState<
    Array<
      | { id: string; role: "user"; text: string }
      | { id: string; role: "assistant"; answer: string; thinking: string }
    >
  >([]);
  const [prompt, setPrompt] = useState(examplePrompts[0]);
  const [isSending, setIsSending] = useState(false);

  const headers = useMemo(() => defaultHeaders, []);

  function appendAssistantThinking(messageId: string, text: string) {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.role !== "assistant" || message.id !== messageId) return message;
        const nextThinking = message.thinking ? `${message.thinking}\n${text}` : text;
        return { ...message, thinking: nextThinking };
      }),
    );
  }

  function setAssistantAnswer(messageId: string, answer: string) {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.role !== "assistant" || message.id !== messageId) return message;
        return { ...message, answer };
      }),
    );
  }

  async function runAgent(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || isSending) return;
    const userMessage = prompt.trim();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: userMessage },
    ]);
    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        thinking: "Starting...",
        answer: "",
      },
    ]);
    setIsSending(true);
    try {
      const res = await fetch("/chat/agent/stream", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: userMessage }),
      });
      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setAssistantAnswer(assistantMessageId, payload.error ?? "Streaming request failed.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const chunk = JSON.parse(trimmed) as {
            event: string;
            data?: {
              state?: string;
              toolName?: string;
              input?: unknown;
              output?: unknown;
              error?: string;
              answer?: string;
              message?: string;
            };
          };
          if (chunk.event === "status" && chunk.data?.state) {
            appendAssistantThinking(assistantMessageId, `Status: ${chunk.data.state}`);
          } else if (chunk.event === "tool-start") {
            appendAssistantThinking(
              assistantMessageId,
              `Tool start: ${chunk.data?.toolName} ${JSON.stringify(chunk.data?.input ?? {})}`,
            );
          } else if (chunk.event === "tool-result") {
            appendAssistantThinking(
              assistantMessageId,
              `Tool result: ${chunk.data?.toolName} ${JSON.stringify(chunk.data?.output ?? {})}`,
            );
          } else if (chunk.event === "tool-error") {
            appendAssistantThinking(
              assistantMessageId,
              `Tool error: ${chunk.data?.toolName} ${chunk.data?.error ?? "unknown error"}`,
            );
          } else if (chunk.event === "final") {
            setAssistantAnswer(assistantMessageId, chunk.data?.answer ?? "No response.");
          } else if (chunk.event === "error") {
            setAssistantAnswer(assistantMessageId, chunk.data?.message ?? "Stream error.");
          }
        }
      }
    } catch (error) {
      setAssistantAnswer(assistantMessageId, String(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card chat-card">
        <div className="prompt-row">
          {examplePrompts.map((item) => (
            <button type="button" key={item} onClick={() => setPrompt(item)} className="prompt-chip">
              {item}
            </button>
          ))}
        </div>

        <div className="chat-thread">
          {messages.length === 0 ? (
            <div className="empty-chat">Send a message to start chatting.</div>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="message message-user">
                  <div className="message-text">{message.text}</div>
                </div>
              ) : (
                <div key={message.id} className="message message-assistant">
                  <div className="message-title">Thinking</div>
                  <div className="message-text">{message.thinking}</div>
                  <div className="message-title">Response</div>
                  <div className="message-text">{message.answer}</div>
                </div>
              ),
            )
          )}
        </div>

        <form onSubmit={(event) => void runAgent(event)} className="chat-input-form">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Type your message"
          />
          <button type="submit" disabled={isSending}>
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
