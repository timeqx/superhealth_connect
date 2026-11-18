import { z } from "zod";
import { credentialsSchema, registrationSchema } from "./validation";

export const staffRoleSchema = z.enum(["staff", "admin"]);

export const createStaffAccountSchema = z.object({
  first: z.string().trim().min(1, "Enter a first name.").max(80),
  last: z.string().trim().min(1, "Enter a last name.").max(80),
  email: z.string().trim().toLowerCase().pipe(credentialsSchema.shape.email),
  password: registrationSchema.shape.password,
  employeeId: z.string().trim().max(80).default(""),
  role: staffRoleSchema,
});

export const changeStaffRoleSchema = z.object({
  id: z.uuid(),
  role: staffRoleSchema,
  expected: z.iso.datetime({ offset: true }),
});

export type StaffAccount = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  employee_id: string | null;
  role: "staff" | "admin";
  disabled_at: string | null;
  provisioned_at: string;
};

export type StaffAccountList = { accounts: StaffAccount[]; count: number };
