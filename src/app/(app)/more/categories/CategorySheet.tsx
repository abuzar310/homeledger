"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Field, PrimaryButton, TextInput } from "@/components/ui";
import { CATALOG_NAME_MAX, CATEGORY_COLORS, catalogNameError, cleanCatalogName } from "@/lib/catalog-edit";

/** Name and colour for a household's own category, used to add one and to edit one. */
export function CategorySheet({
  open,
  title,
  saveLabel,
  initialName = "",
  initialColor = CATEGORY_COLORS[0].hex,
  existing,
  exceptId,
  onSave,
  onClose,
}: {
  open: boolean;
  title: string;
  saveLabel: string;
  initialName?: string;
  initialColor?: string;
  /** Every category in the pickers, so a name is not used twice. */
  existing: { id: string; name: string }[];
  exceptId?: string;
  /** Throws when the save fails; the sheet then stays open with an error. */
  onSave: (name: string, color: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Start from the given values each time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialName);
      setColor(initialColor);
      setError(null);
    }
  }

  async function save() {
    if (saving) return;
    const problem = catalogNameError(name, existing, exceptId);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(cleanCatalogName(name), color);
    } catch {
      setError("Could not save this category. Check your connection and try again.");
      return;
    } finally {
      setSaving(false);
    }
    onClose();
  }

  return (
    <BottomSheet open={open} title={title} onClose={() => !saving && onClose()}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CATALOG_NAME_MAX}
            placeholder="Pet care"
            autoComplete="off"
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-[15px] font-medium text-muted">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => setColor(swatch.hex)}
                aria-pressed={color === swatch.hex}
                aria-label={swatch.name}
                className={`press flex size-11 items-center justify-center rounded-full ${
                  color === swatch.hex ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
              >
                <span className="size-7 rounded-full" style={{ background: swatch.hex }} aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>
        {error ? (
          <p className="text-[15px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
