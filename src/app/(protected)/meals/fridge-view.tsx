"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { PantryCategory, PantryItem } from "@/types";
import { PANTRY_CATEGORIES, guessCategory } from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ErrorText, FieldLabel, Modal, nativeSelectClass } from "./modal";

interface Props {
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  reviewAge: number | null;
  onReviewed: (reviewedAt: string) => void;
}

export function FridgeView({ pantry, setPantry, reviewAge, onReviewed }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<PantryCategory>("other");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  async function markReviewed() {
    const reviewed_at = new Date().toISOString();
    const { error } = await supabase
      .from("pantry_status")
      .upsert({ user_id: ownerId, reviewed_at }, { onConflict: "user_id" });
    if (!error) onReviewed(reviewed_at);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(null);

    const { data, error } = await supabase
      .from("pantry_items")
      .insert({ user_id: ownerId, name: trimmed, quantity: quantity.trim() || null, category })
      .select()
      .single();

    setAdding(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn't add that item.");
      return;
    }
    setPantry((prev) => [...prev, data as PantryItem]);
    setName("");
    setQuantity("");
    setCategory("other");
    setCategoryTouched(false);
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
      .update({ name: updated.name, quantity: updated.quantity, category: updated.category })
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
        <p className="text-sm text-muted-foreground">
          {reviewAge === null
            ? "Not reviewed yet"
            : reviewAge === 0
              ? "Reviewed today"
              : `Last reviewed ${reviewAge} day${reviewAge === 1 ? "" : "s"} ago`}
        </p>
        {pantry.length > 0 && reviewAge !== 0 && (
          <Button variant="outline" size="sm" onClick={markReviewed} className="gap-1.5">
            {Icons.check}
            Mark as up to date
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardContent>
          <form onSubmit={addItem} className="flex flex-col sm:flex-row gap-2">
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
            <Input
              placeholder="Amount (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10 text-sm sm:w-36"
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
          </form>
          {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
        </CardContent>
      </Card>

      {pantry.length === 0 ? (
        <EmptyState
          icon={Icons.utensils}
          title="Your fridge is empty"
          description="Add what you have on hand: proteins, produce, staples like rice or panko."
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
                      className="flex-1 min-w-0 text-left py-1.5 text-sm"
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.quantity && (
                        <span className="text-muted-foreground"> · {item.quantity}</span>
                      )}
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

function EditItemModal({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: PantryItem;
  onClose: () => void;
  onSave: (item: PantryItem) => Promise<string | null>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [category, setCategory] = useState<PantryCategory>(item.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const err = await onSave({ ...item, name: name.trim(), quantity: quantity.trim() || null, category });
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
          <FieldLabel optional>Amount</FieldLabel>
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 2 lbs"
            className="h-10 text-sm"
          />
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
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
