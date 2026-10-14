import "server-only";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { homeAccess } from "./service";
import { oracle } from "@/server/api/transport";
import { publicError } from "@/lib/errors";
export function cleanAnnouncement(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "mark",
      "span",
      "ul",
      "ol",
      "li",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      "*": ["style"],
      span: ["class", "style"],
      mark: ["class", "style"],
    },
    allowedClasses: {
      span: ["text-tiny", "text-small", "text-big", "text-huge"],
      mark: [
        "marker-yellow",
        "marker-green",
        "marker-pink",
        "marker-blue",
        "pen-red",
        "pen-green",
      ],
    },
    // VBCS announcement formatting is authored rich text. Preserve only
    // bounded typography and literal colors, never layout or external assets.
    allowedStyles: {
      "*": {
        color: [
          /^#[0-9a-f]{3,8}$/i,
          /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
        ],
        "background-color": [
          /^#[0-9a-f]{3,8}$/i,
          /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
        ],
        "font-size": [/^(?:[89]|[12]\d|3[0-6])px$/],
        "font-weight": [/^(?:normal|bold|[4-8]00)$/],
        "text-align": [/^(?:left|center|right)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}
export async function loadAnnouncements() {
  const { session } = await homeAccess();
  try {
    const body = z
      .object({ items: z.array(z.object({ msg: z.string().max(100000) })) })
      .parse(
        await oracle("getSharedAnnouncements", {
          token: session.token,
          module_name: "DASHBOARD",
        }),
      );
    return { messages: body.items.map((r) => cleanAnnouncement(r.msg)) };
  } catch (e) {
    return { messages: [] as string[], error: publicError(e).message };
  }
}
