import { createClient } from "@/lib/supabase/server";
import { generateMealPlan } from "@/lib/claude";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pantry_items, preferences, days = 7 } = body;

    // Generate meal plan via Claude
    const plan = await generateMealPlan(pantry_items, preferences, days);

    // Calculate week start (next Monday)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    const weekStart = monday.toISOString().split("T")[0];

    // Save meal plan to database
    const { data: mealPlan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        title: `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        week_start: weekStart,
        preferences,
      })
      .select()
      .single();

    if (planError) throw planError;

    // Save individual meals
    const mealsToInsert = plan.meals.map(
      (meal: { day_of_week: number; meal_type: string; title: string; description: string; recipe: object }) => ({
        meal_plan_id: mealPlan.id,
        user_id: user.id,
        day_of_week: meal.day_of_week,
        meal_type: meal.meal_type,
        title: meal.title,
        description: meal.description,
        recipe: meal.recipe,
      })
    );

    const { error: mealsError } = await supabase
      .from("meals")
      .insert(mealsToInsert);

    if (mealsError) throw mealsError;

    // Save grocery list
    if (plan.grocery_list?.length > 0) {
      const groceryToInsert = plan.grocery_list.map(
        (item: { name: string; quantity: string; category: string }) => ({
          meal_plan_id: mealPlan.id,
          user_id: user.id,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
        })
      );

      await supabase.from("grocery_items").insert(groceryToInsert);
    }

    return NextResponse.json({ meal_plan: mealPlan, plan });
  } catch (error) {
    console.error("Meal plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate meal plan" },
      { status: 500 }
    );
  }
}
