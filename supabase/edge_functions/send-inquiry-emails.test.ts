import { formatDate } from "./send-inquiry-emails.ts";

Deno.test("formatDate preserves date-only inquiry event dates", () => {
  const formatted = formatDate("2026-11-28");

  if (formatted !== "November 28, 2026") {
    throw new Error(`Expected November 28, 2026, received "${formatted}".`);
  }
});

Deno.test("formatDate preserves date-only values returned with timestamp text", () => {
  const formatted = formatDate("2026-10-13T00:00:00.000Z");

  if (formatted !== "October 13, 2026") {
    throw new Error(`Expected October 13, 2026, received "${formatted}".`);
  }
});
