import "server-only";
import { chatbotEnabled } from "@/server/chatbot/service";
import { resources, label } from "@/server/configuration/resources";
import { authenticate } from "@/server/session/service";
import { Chatbot } from "./chatbot";

/** Server gate for the launcher: only the enabled flag and labels reach the client, never the chatbot URL. */
export async function ChatbotMount() {
  let enabled = false;
  try {
    enabled = await chatbotEnabled();
  } catch {
    // Misconfiguration or an unavailable global-variable read hides the launcher (fail closed).
  }
  if (!enabled) return null;
  const [labels, { user }] = await Promise.all([resources(), authenticate()]);
  return (
    <Chatbot
      userName={user.name}
      title={label(
        labels,
        "dashboard",
        "dialog-titles",
        "grants-now-chatbot",
        "GrantsNow Chatbot",
      )}
      placeholder={label(
        labels,
        "dashboard",
        "placeholders",
        "type-your-message-chatbot",
        "Type your message",
      )}
    />
  );
}
