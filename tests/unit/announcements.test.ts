import { expect, it } from "vitest";
import { sanitizeHtml } from "@/server/html/sanitize";
it("removes scripts, handler attributes and unsafe URLs, keeping formatting", () => {
  const html = sanitizeHtml(
    '<p><strong>Notice</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="bad()">Link</a></p>',
  );
  expect(html).toContain("<strong>Notice</strong>");
  expect(html).not.toMatch(/<script|onclick|onerror|javascript:/);
});
it("keeps authored inline styles (D15) but drops positioning and url() declarations", () => {
  const html = sanitizeHtml(
    '<span style="font-size:10px;background-color:#a3f28c;position:fixed;z-index:9;background-image:url(https://evil.example)">Notice</span>',
  );
  expect(html).toContain("font-size:10px");
  expect(html).toContain("background-color:#a3f28c");
  expect(html).not.toMatch(/position|z-index|url\(/);
  expect(sanitizeHtml('<span style="top:0">x</span>')).not.toContain("style=");
});
it("keeps tables and CKEditor classes, drops <style> and form controls", () => {
  const html = sanitizeHtml(
    '<style>body{display:none}</style><table><tr><td><span class="text-tiny"><mark class="marker-green">Cell</mark></span></td></tr></table><form><input value="x"><button>Go</button></form>',
  );
  expect(html).toContain("<table>");
  expect(html).toContain('class="text-tiny"');
  expect(html).toContain('class="marker-green"');
  expect(html).not.toMatch(/<style|<form|<input|<button/);
});
it("opens links in a new tab and refuses protocol-relative URLs", () => {
  const html = sanitizeHtml(
    '<a href="https://example.org">Read</a><a href="//evil.example">Bad</a><a href="/proposals">In app</a>',
  );
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('target="_blank"');
  expect(html).not.toContain("//evil.example");
  expect(html).toContain('href="/proposals"');
});
it("normalises the backend's literal \\r\\n sequences as legacy renderAsHTML does", () => {
  expect(sanitizeHtml("<p>a\\r\\nb</p>")).toBe("<p>ab</p>");
});
