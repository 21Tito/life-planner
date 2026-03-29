"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import type { PantryItem, PantryCategory } from "@/types";
import { Tag } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";

const CATEGORIES: PantryCategory[] = [
  "protein", "dairy", "vegetable", "fruit", "grain",
  "spice", "condiment", "frozen", "beverage", "other",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

interface Props {
  initialPantryItems: PantryItem[];
}

export function MealsClient({ initialPantryItems }: Props) {
  const supabase = createClient();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantryItems);
  const [newItem, setNewItem] = useState({ name: "", category: "other" as PantryCategory, quantity: "" });
  const [preferences, setPreferences] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mealPlan, setMealPlan] = useState<Record<string, { title: string; description: string }>>({});
  const [groceryList, setGroceryList] = useState<{ name: string; quantity: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"pantry" | "plan" | "grocery">("pantry");

  async function addItem() {
    if (!newItem.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("pantry_items")
      .insert({ ...newItem, user_id: user.id })
      .select()
      .single();

    if (data) {
      setPantryItems((prev) => [...prev, data]);
      setNewItem({ name: "", category: "other", quantity: "" });
    }
  }

  async function removeItem(id: string) {
    await supabase.from("pantry_items").delete().eq("id", id);
    setPantryItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function generatePlan() {
    setGenerating(true);
    try {
      const res = await fetch("/api/meals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry_items: pantryItems.map(({ name, category, quantity }) => ({
            name, category, quantity,
          })),
          preferences: preferences || undefined,
        }),
      });
      const data = await res.json();

      if (data.plan) {
        const planMap: Record<string, { title: string; description: string }> = {};
        for (const meal of data.plan.meals) {
          const key = `${meal.day_of_week}-${meal.meal_type}`;
          planMap[key] = { title: meal.title, description: meal.description };
        }
        setMealPlan(planMap);
        setGroceryList(data.plan.grocery_list || []);
        setActiveTab("plan");
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  const tabs = [
    { key: "pantry",  label: "My Fridge" },
    { key: "plan",    label: "Meal Plan" },
    { key: "grocery", label: "Grocery List" },
  ] as const;

  return (
    <div className="max-w-5xl">
      <h1
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Meal Planner
      </h1>
      <p className="text-[var(--color-text-muted)] mb-8">
        Add what&apos;s in your fridge, then let AI plan your week.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-[var(--color-brand-600)] text-[var(--color-brand-600)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pantry Tab */}
      {activeTab === "pantry" && (
        <div>
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Item name (e.g. chicken breast)"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)] bg-white"
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value as PantryCategory })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)] bg-white"
            />
            <button
              onClick={addItem}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-700)] transition-colors"
            >
              <span className="text-white">{Icons.plus}</span>
              Add
            </button>
          </div>

          {pantryItems.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] mx-auto mb-3">
                {Icons.clipboard}
              </div>
              <p className="font-medium">Your fridge is empty</p>
              <p className="text-sm mt-1">Add some items to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pantryItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-brand-200)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Tag>{item.category}</Tag>
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.quantity && (
                      <span className="text-sm text-[var(--color-text-muted)]">· {item.quantity}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors p-1 rounded"
                    aria-label="Remove item"
                  >
                    {Icons.close}
                  </button>
                </div>
              ))}
            </div>
          )}

          {pantryItems.length > 0 && (
            <div className="mt-8 border-t border-[var(--color-border)] pt-6">
              <textarea
                placeholder="Any dietary preferences? (e.g. vegetarian, low-carb, no shellfish, quick meals under 30 min)"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)] resize-none bg-white"
                rows={2}
              />
              <button
                onClick={generatePlan}
                disabled={generating}
                className="flex items-center gap-2 rounded-full bg-[var(--color-brand-600)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors disabled:opacity-50"
              >
                <span className="text-white">{Icons.sparkle}</span>
                {generating ? "Generating meal plan..." : "Generate Meal Plan"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Meal Plan Tab */}
      {activeTab === "plan" && (
        <div>
          {Object.keys(mealPlan).length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] mx-auto mb-3">
                {Icons.clipboard}
              </div>
              <p className="font-medium">No meal plan yet</p>
              <p className="text-sm mt-1">Add items to your fridge and generate one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                      Meal
                    </th>
                    {DAY_NAMES.map((day) => (
                      <th key={day} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((type, i) => (
                    <tr key={type} className={`border-b border-[var(--color-border)] ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface)]"}`}>
                      <td className="py-3 px-4 font-semibold capitalize text-xs text-[var(--color-brand-600)]">
                        {type}
                      </td>
                      {DAY_NAMES.map((_, dayIdx) => {
                        const meal = mealPlan[`${dayIdx}-${type}`];
                        return (
                          <td key={dayIdx} className="py-3 px-3">
                            {meal ? (
                              <div>
                                <p className="font-medium text-xs">{meal.title}</p>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{meal.description}</p>
                              </div>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grocery List Tab */}
      {activeTab === "grocery" && (
        <div>
          {groceryList.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] mx-auto mb-3">
                {Icons.download}
              </div>
              <p className="font-medium">No grocery list yet</p>
              <p className="text-sm mt-1">Generate a meal plan first to see what you need to buy.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groceryList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-brand-200)] transition-colors"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-brand-600)]"
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.quantity && (
                    <span className="text-sm text-[var(--color-text-muted)]">· {item.quantity}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
