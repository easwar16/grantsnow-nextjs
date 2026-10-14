import { expect, it } from "vitest";
import { cleanAnnouncement } from "@/server/home/announcements";
it("preserves formatting while removing scripts, handler attributes and unsafe URLs", () => {
  const html = cleanAnnouncement(
    '<p><strong>Notice</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="bad()">Link</a></p>',
  );
  expect(html).toContain("<strong>Notice</strong>");
  expect(html).not.toMatch(/script|onclick|onerror|<img|javascript:/);
});
it("retains bounded VBCS text colors/sizes without layout or asset injection", () => {
  const html = cleanAnnouncement(
    '<span style="font-size:10px;background-color:#a3f28c;position:fixed;background-image:url(https://evil.example);width:9999px">Notice</span>',
  );
  expect(html).toContain("font-size:10px");
  expect(html).toContain("background-color:#a3f28c");
  expect(html).not.toMatch(/position|url|width/);
  expect(
    cleanAnnouncement('<span style="font-size:999px">Huge</span>'),
  ).not.toContain("style=");
});
it("restricts external links and removes uncontrolled styles and protocol-relative URLs", () => {
  const html = cleanAnnouncement(
    '<a href="https://example.org">Read</a><a href="//evil.example">Bad</a><span style="background:url(https://evil.example)">Text</span>',
  );
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("//evil.example");
  expect(html).not.toContain("style=");
});
it("preserves only verified CKEditor typography/highlight classes", () => {
  const html = cleanAnnouncement(
    '<span class="text-tiny navigation-drawer"><mark class="marker-green untrusted">Notice</mark></span>',
  );
  expect(html).toContain('class="text-tiny"');
  expect(html).toContain('class="marker-green"');
  expect(html).not.toMatch(/navigation-drawer|untrusted/);
});
