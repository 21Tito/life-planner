"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { PantryItem, PantryCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const CATEGORIES: PantryCategory[] = [
  "protein", "dairy", "vegetable", "fruit", "grain",
  "spice", "condiment", "frozen", "beverage", "other",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

const selectClass = cn(
  "flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-sm h-8",
  "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "transition-colors"
);

interface Props {
  initialPantryItems: PantryItem[];
}

export function MealsClient({ initialPantryItems }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantryItems);
  const [newItem, setNewItem] = useState({ name: "", category: "other" as PantryCategory, quantity: "" });
  const [preferences, setPreferences] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mealPlan, setMealPlan] = useState<Record<string, { title: string; description: string }>>({});
  const [groceryList, setGroceryList] = useState<{ name: string; quantity: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"pantry" | "plan" | "grocery">("pantry");

  async function addItem() {
    if (!newItem.name.trim()) return;

    const { data } = await supabase
      .from("pantry_items")
      .insert({ ...newItem, user_id: ownerId })
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

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Meal Planner
      </h1>
      <p className="text-sm text-muted-foreground mb-6 lg:mb-8">
        Add what&apos;s in your fridge, then let AI plan your week.
      </p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList variant="line" className="mb-6 w-full justify-start h-auto rounded-none border-b border-border bg-transparent pb-0 gap-0">
          <TabsTrigger value="pantry" className="rounded-none px-4 pb-2.5 after:bottom-0">My Fridge</TabsTrigger>
          <TabsTrigger value="plan" className="rounded-none px-4 pb-2.5 after:bottom-0">Meal Plan</TabsTrigger>
          <TabsTrigger value="grocery" className="rounded-none px-4 pb-2.5 after:bottom-0">Grocery List</TabsTrigger>
        </TabsList>

        {/* Pantry Tab */}
        <TabsContent value="pantry">
          {/* Add item form */}
          <div className="flex flex-col gap-2 mb-6 sm:flex-row sm:gap-3">
            <Input
              placeholder="Item name (e.g. chicken breast)"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="h-10 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value as PantryCategory })}
                className={cn(selectClass, "h-10")}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Qty"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-20 h-10 text-sm"
              />
              <Button onClick={addItem} className="h-10 gap-1.5 whitespace-nowrap">
                <span>{Icons.plus}</span>
                Add
              </Button>
            </div>
          </div>

          {pantryItems.length === 0 ? (
            <EmptyState
              icon={Icons.clipboard}
              title="Your fridge is empty"
              description="Add some items to get started."
            />
          ) : (
            <div className="space-y-2">
              {pantryItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-ring/40 transition-colors"
                >
                  <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                    <Badge variant="secondary">{item.category}</Badge>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {item.quantity && (
                      <span className="text-sm text-muted-foreground hidden sm:inline">· {item.quantity}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2"
                    aria-label="Remove item"
                  >
                    {Icons.close}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {pantryItems.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <Textarea
                placeholder="Any dietary preferences? (e.g. vegetarian, low-carb, no shellfish)"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                rows={2}
                className="mb-4 resize-none"
              />
              <Button
                onClick={generatePlan}
                disabled={generating}
                className="w-full sm:w-auto rounded-full px-8 h-11 gap-2"
              >
                <span>{Icons.sparkle}</span>
                {generating ? "Generating meal plan..." : "Generate Meal Plan"}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Meal Plan Tab */}
        <TabsContent value="plan">
          {Object.keys(mealPlan).length === 0 ? (
            <EmptyState
              icon={Icons.clipboard}
              title="No meal plan yet"
              description="Add items to your fridge and generate one."
            />
          ) : (
            <div className="-mx-4 lg:mx-0 overflow-x-auto">
              <div className="min-w-[600px] px-4 lg:px-0">
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Meal
                        </th>
                        {DAY_NAMES.map((day) => (
                          <th key={day} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MEAL_TYPES.map((type, i) => (
                        <tr key={type} className={cn("border-b border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                          <td className="py-3 px-4 font-semibold capitalize text-xs text-primary">
                            {type}
                          </td>
                          {DAY_NAMES.map((_, dayIdx) => {
                            const meal = mealPlan[`${dayIdx}-${type}`];
                            return (
                              <td key={dayIdx} className="py-3 px-3">
                                {meal ? (
                                  <div>
                                    <p className="font-medium text-xs">{meal.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meal.description}</p>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Grocery List Tab */}
        <TabsContent value="grocery">
          {groceryList.length === 0 ? (
            <EmptyState
              icon={Icons.download}
              title="No grocery list yet"
              description="Generate a meal plan first to see what you need to buy."
            />
          ) : (
            <div className="space-y-2">
              {groceryList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-ring/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.quantity && (
                    <span className="text-sm text-muted-foreground">· {item.quantity}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
