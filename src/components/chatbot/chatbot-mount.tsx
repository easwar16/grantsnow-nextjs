import "server-only";
import { chatbotEnabled } from "@/server/modules/chatbot/service";
import { resources } from "@/server/platform/configuration/resources";
import { authenticate } from "@/server/identity/session/service";
import { Chatbot } from "./chatbot";
import { serverFunctions } from "@/server/functions";

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
      title={serverFunctions.resources.label(
        labels,
        "dashboard",
        "dialog-titles",
        "grants-now-chatbot",
        "GrantsNow Chatbot",
      )}
      placeholder={serverFunctions.resources.label(
        labels,
        "dashboard",
        "placeholders",
        "type-your-message-chatbot",
        "Type your message",
      )}
    />
  );
}
