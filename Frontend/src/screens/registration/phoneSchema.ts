import { z } from "zod";

// Real validation, not just a length check buried in a click handler.
// Strips formatting characters first so "555-123 4567" and "5551234567"
// validate identically, then enforces a sane digit-count range — loose
// enough to cover real international numbers (most national numbers run
// 6-14 digits), strict enough to catch obvious typos/garbage before it
// ever reaches handleVerify.
export const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, "Enter your phone number")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((digits) => digits.length >= 6, {
      message: "Enter at least 6 digits",
    })
    .refine((digits) => digits.length <= 15, {
      message: "That number looks too long — check the digits",
    }),
});

export type PhoneFormValues = z.infer<typeof phoneSchema>;
