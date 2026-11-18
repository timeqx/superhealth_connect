import { describe, expect, it } from "vitest";
import { inquiryReadThrough } from "./read-state";

const initial = "2026-11-18T08:00:00.123456+00:00";
const later = "2026-11-18T09:00:00.234567+00:00";
const message = { author_id: "staff", is_draft: false, created_at: initial, updated_at: initial, published_at: initial };

describe("the rendered inquiry read boundary", () => {
  it("does not count the patient's own messages or private drafts", () => {
    expect(inquiryReadThrough([{ ...message, author_id: "patient" }, { ...message, is_draft: true }], "patient")).toBeUndefined();
  });

  it("staff read only incoming patient messages, not another staff member's reply", () => {
    expect(inquiryReadThrough([message, { ...message, author_id: "patient" }, { ...message, author_id: "other-staff", updated_at: later }], "patient", true)).toBe(initial);
  });

  it("recognizes a draft published after the original creation time", () => {
    expect(inquiryReadThrough([{ ...message, published_at: later, updated_at: later }], "patient")).toBe(later);
  });

  it("keeps the exact PostgreSQL timestamp even for updates within the same millisecond", () => {
    const newest = "2026-11-18T08:00:00.123999+00:00";
    expect(inquiryReadThrough([{ ...message, updated_at: newest }, message], "patient")).toBe(newest);
  });

  it("handles missing publication dates and compares timestamp offsets by instant", () => {
    const local = "2026-11-18T16:00:00.123456+08:00";
    expect(inquiryReadThrough([{ ...message, published_at: null, updated_at: local }, { ...message, updated_at: later }], "patient")).toBe(later);
  });
});
