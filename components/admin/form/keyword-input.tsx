"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A list of free-form tokens — search keywords, SEO terms.
 *
 * Deliberately **not** a `LocalizedField`. These are search terms a shopper
 * types, not prose: someone searching in Russian may well type "rtx 4090" in
 * Latin, and splitting the list per language would mean maintaining three
 * near-identical sets and losing cross-language matches.
 *
 * Each token gets its own remove button rather than one "clear all", and the
 * button carries the token in its accessible name — a row of identical "Remove"
 * buttons is useless when tabbing through.
 */
export function KeywordInput({
  label,
  hint,
  values,
  onChange,
  disabled = false,
  removeLabel,
  className,
}: {
  label: string;
  hint?: string;
  values: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Template containing `{value}` — supplied translated by the caller. */
  removeLabel: (value: string) => string;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim().toLowerCase();
    setDraft("");

    // Silently ignoring a duplicate is right here: the user's intent is "this
    // term should be in the list", and it already is.
    if (!value || values.includes(value)) return;

    onChange([...values, value]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>

      <Input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Otherwise Enter submits the surrounding form.
            event.preventDefault();
            commit();
          }
          if (event.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
      />

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value}>
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
                {value}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  aria-label={removeLabel(value)}
                  className="rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
