import "server-only";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
/**
 * Backend HTML (announcements, notifications, opportunity summaries, chatbot answers) through DOMPurify,
 * as legacy `renderAsHTML` does (D15): inline styles, tables and CKEditor classes survive.
 * Hardened beyond legacy: no <style>/form controls, no positioning or url() in style attributes,
 * links open in a new tab, and only http(s), mailto and same-origin relative URLs.
 */
const purify = DOMPurify(new JSDOM("").window);
// Declarations that let authored HTML escape its box or fetch assets.
const unsafeStyle =
  /^(?:position|z-index|inset|top|right|bottom|left|behavior|-moz-binding)$|url\(|expression\(|javascript:/i;
purify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  data.attrValue = data.attrValue
    .split(";")
    .map((d) => d.trim())
    .filter((d) => {
      const [property = "", ...value] = d.split(":");
      return (
        d !== "" &&
        value.length > 0 &&
        !unsafeStyle.test(property.trim()) &&
        !unsafeStyle.test(value.join(":"))
      );
    })
    .join("; ");
  if (data.attrValue === "") data.keepAttr = false;
});
purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});
/** Backend rich text as plain text (legacy `stripMarkup`): tags dropped, entities decoded. */
export function plainText(html: string) {
  if (!html.includes("<") && !html.includes("&")) return html;
  return (
    purify
      .sanitize(html, { ALLOWED_TAGS: [], RETURN_DOM: true })
      .textContent?.trim() ?? ""
  );
}
export function sanitizeHtml(html: string) {
  return purify.sanitize(html.replace(/\\r\\n/g, ""), {
    FORBID_TAGS: ["style", "form", "input", "button", "select", "textarea"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/(?![/\\])|\?)/i,
  });
}
