"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { PantryCategory, PantryItem } from "@/types";
import {
  EXPIRY_CATEGORIES,
  PANTRY_CATEGORIES,
  expiryDate,
  expiryStatus,
  formatExpiry,
  guessCategory,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ErrorText, FieldLabel, Modal, nativeSelectClass } from "./modal";

interface Props {
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  reviewAge: number | null;
  onReviewed: (reviewedAt: string) => void;
  now: Date | null;
}

const tracksExpiry = (category: PantryCategory) => EXPIRY_CATEGORIES.includes(category);

export function KitchenView({ pantry, setPantry, reviewAge, onReviewed, now }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PantryCategory>("other");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  async function markReviewed() {
    const reviewed_at = new Date().toISOString();
    const { error } = await supabase
      .from("pantry_status")
      .upsert({ user_id: ownerId, reviewed_at }, { onConflict: "user_id" });
    if (error) setError(`Couldn't mark the kitchen as reviewed: ${error.message}`);
    else onReviewed(reviewed_at);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(null);

    const { data, error } = await supabase
      .from("pantry_items")
      .insert({
        user_id: ownerId,
        name: trimmed,
        category,
        expiry_date: tracksExpiry(category) ? expiry : null,
      })
      .select()
      .single();

    setAdding(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn't add that item.");
      return;
    }
    setPantry((prev) => [...prev, data as PantryItem]);
    setName("");
    setCategory("other");
    setCategoryTouched(false);
    setExpiry(null);
    setFormKey((k) => k + 1);
    nameRef.current?.focus();
    markReviewed();
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("pantry_items").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setPantry((prev) => prev.filter((p) => p.id !== id));
    markReviewed();
  }

  async function saveItem(updated: PantryItem) {
    const { error } = await supabase
      .from("pantry_items")
      .update({ name: updated.name, category: updated.category, expiry_date: updated.expiry_date })
      .eq("id", updated.id);
    if (error) return error.message;
    setPantry((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    markReviewed();
    return null;
  }

  const groups = PANTRY_CATEGORIES.map((c) => ({
    ...c,
    items: pantry
      .filter((p) => p.category === c.value)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm">
          <p className="font-medium">What&apos;s in your fridge and pantry</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {reviewAge === null
              ? "Not reviewed yet"
              : reviewAge === 0
                ? "Reviewed today"
                : `Last reviewed ${reviewAge} day${reviewAge === 1 ? "" : "s"} ago`}
          </p>
        </div>
        {pantry.length > 0 && reviewAge !== 0 && (
          <Button variant="outline" size="sm" onClick={markReviewed} className="gap-1.5">
            {Icons.check}
            Mark as up to date
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardContent>
          <form onSubmit={addItem} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={nameRef}
                placeholder="Add an item, e.g. chicken breast"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!categoryTouched) setCategory(guessCategory(e.target.value));
                }}
                className="h-10 text-sm flex-1"
              />
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as PantryCategory);
                  setCategoryTouched(true);
                }}
                className={`${nativeSelectClass} sm:w-40`}
                aria-label="Category"
              >
                {PANTRY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Button type="submit" disabled={!name.trim() || adding} className="h-10 px-4 gap-1.5">
                {Icons.plus}
                Add
              </Button>
            </div>
            {tracksExpiry(category) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground flex-shrink-0">Expires</span>
                <MonthYearPicker key={formKey} value={expiry} onChange={setExpiry} now={now} />
              </div>
            )}
          </form>
          {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
        </CardContent>
      </Card>

      {pantry.length === 0 ? (
        <EmptyState
          icon={Icons.utensils}
          title="Your kitchen is empty"
          description="Add what's in your fridge and pantry: proteins, produce, staples like rice or panko."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.value}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h2>
              <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 pl-4 pr-2 py-1.5">
                    <button
                      onClick={() => setEditing(item)}
                      className="flex-1 min-w-0 text-left py-1.5 text-sm flex flex-wrap items-baseline gap-x-2"
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.expiry_date && <ExpiryLabel expiry={item.expiry_date} now={now} />}
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                      title="Used up — remove"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {Icons.close}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <EditItemModal
          item={editing}
          now={now}
          onClose={() => setEditing(null)}
          onSave={saveItem}
          onDelete={async () => {
            await removeItem(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExpiryLabel({ expiry, now }: { expiry: string; now: Date | null }) {
  const status = now ? expiryStatus(expiry, now) : "ok";
  return (
    <span
      className={cn(
        "text-xs",
        status === "expired" && "text-red-600 font-medium",
        status === "soon" && "text-amber-700 font-medium",
        status === "ok" && "text-muted-foreground"
      )}
    >
      {status === "expired" ? "Expired" : status === "soon" ? "Expires" : "Exp."} {formatExpiry(expiry)}
    </span>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" })
);

/** Month + year selects; reports a value only once both are chosen. */
function MonthYearPicker({
  value,
  onChange,
  now,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  now: Date | null;
}) {
  const [initialYear, initialMonth] = value ? value.split("-").map(Number) : [0, 0];
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const thisYear = (now ?? new Date()).getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => thisYear - 2 + i);
  if (year && !years.includes(year)) years.unshift(year);

  function update(nextMonth: number, nextYear: number) {
    setMonth(nextMonth);
    setYear(nextYear);
    onChange(nextMonth && nextYear ? expiryDate(nextYear, nextMonth) : null);
  }

  return (
    <div className="flex gap-2">
      <select
        value={month}
        onChange={(e) => update(Number(e.target.value), year || thisYear)}
        className={`${nativeSelectClass} w-24`}
        aria-label="Expiration month"
      >
        <option value={0}>Month</option>
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>{label}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => update(month, Number(e.target.value))}
        className={`${nativeSelectClass} w-24`}
        aria-label="Expiration year"
      >
        <option value={0}>Year</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      {(month || year) > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => update(0, 0)} className="h-10">
          Clear
        </Button>
      )}
    </div>
  );
}

function EditItemModal({
  item,
  now,
  onClose,
  onSave,
  onDelete,
}: {
  item: PantryItem;
  now: Date | null;
  onClose: () => void;
  onSave: (item: PantryItem) => Promise<string | null>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<PantryCategory>(item.category);
  const [expiry, setExpiry] = useState<string | null>(item.expiry_date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const err = await onSave({
      ...item,
      name: name.trim(),
      category,
      expiry_date: tracksExpiry(category) ? expiry : null,
    });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal
      title="Edit item"
      onClose={onClose}
      footer={
        <>
          <Button variant="destructive" onClick={onDelete} className="mr-auto">
            Remove
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-sm" />
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PantryCategory)}
            className={nativeSelectClass}
          >
            {PANTRY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        {tracksExpiry(category) && (
          <div>
            <FieldLabel optional>Expires</FieldLabel>
            <MonthYearPicker value={expiry} onChange={setExpiry} now={now} />
          </div>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
