import { describe, expect, it } from "vitest";
import { isStaffRole, isUserRole, staffPortalLinks } from "./roles";

describe("portal role access", () => {
  it("shows staff exactly the four permitted tabs in portal order", () => {
    expect(staffPortalLinks("staff").map(({ href, label }) => [href, label])).toEqual([
      ["/admin", "Requests"],
      ["/admin/queue", "Queue"],
      ["/admin/inquiries", "Inquiries"],
      ["/admin/reports", "Reports"],
    ]);
  });

  it("retains every existing navigation tab for administrators", () => {
    expect(staffPortalLinks("admin").map(link => link.label)).toEqual([
      "Requests", "Queue", "History", "Inquiries", "Accounts", "Staff", "Schedules", "Reports",
    ]);
  });

  it("keeps patient accounts outside the staff portal", () => {
    expect(staffPortalLinks("patient")).toEqual([]);
    expect(isStaffRole("patient")).toBe(false);
    expect(isUserRole("patient")).toBe(true);
  });

  it.each([null, undefined, "owner", "STAFF", "", {}])("denies unrecognized roles: %s", role => {
    expect(isStaffRole(role)).toBe(false);
    expect(isUserRole(role)).toBe(false);
  });
});
