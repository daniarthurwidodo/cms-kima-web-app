import { z } from "zod";
import { SCRIPTURE_BOOKS } from "@/src/features/renungan/business/scripture-books";

const BOOK_NAMES = SCRIPTURE_BOOKS.map((b) => b.name) as [string, ...string[]];

const positiveIntFromString = z
  .string()
  .min(1, "Required")
  .refine((v) => /^\d+$/.test(v), "Must be a whole number")
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n) && n >= 1, "Must be ≥ 1");

export const renunganFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    content: z.string().trim().min(1, "Content is required"),
    bookName: z.enum(BOOK_NAMES),
    chapter: positiveIntFromString,
    verseStart: positiveIntFromString,
    verseEnd: positiveIntFromString,
  })
  .refine((v) => v.verseEnd >= v.verseStart, {
    message: "End verse must be ≥ start verse",
    path: ["verseEnd"],
  });

export type RenunganFormInput = z.input<typeof renunganFormSchema>;
export type RenunganFormOutput = z.output<typeof renunganFormSchema>;

export type FieldErrors = Partial<Record<keyof RenunganFormInput, string>>;

export function flattenIssues(error: z.ZodError<RenunganFormOutput>): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in out)) {
      out[field as keyof RenunganFormInput] = issue.message;
    }
  }
  return out;
}
