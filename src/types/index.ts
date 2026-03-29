// ===========================================
// Database types (mirrors Supabase schema)
// ===========================================

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  subscription_status: "free" | "pro" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  category: PantryCategory;
  quantity: string | null;
  expiry_date: string | null;
  created_at: string;
}

export type PantryCategory =
  | "protein"
  | "dairy"
  | "vegetable"
  | "fruit"
  | "grain"
  | "spice"
  | "condiment"
  | "frozen"
  | "beverage"
  | "other";

export interface MealPlan {
  id: string;
  user_id: string;
  title: string;
  week_start: string;
  preferences: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  meal_plan_id: string;
  user_id: string;
  day_of_week: number; // 0=Mon, 6=Sun
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  title: string;
  description: string | null;
  recipe: Recipe | null;
  created_at: string;
}

export interface Recipe {
  ingredients: RecipeIngredient[];
  steps: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  from_pantry: boolean; // true if user already has it
}

export interface GroceryItem {
  id: string;
  meal_plan_id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  budget_cents: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  user_id: string;
  day_number: number;
  date: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  activities?: TripActivity[];
}

export interface TripActivity {
  id: string;
  trip_day_id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  cost_cents: number | null;
  booking_url: string | null;
  sort_order: number;
  created_at: string;
}

export type ActivityCategory =
  | "flight"
  | "hotel"
  | "restaurant"
  | "activity"
  | "transport"
  | "shopping"
  | "rest"
  | "other";

// ===========================================
// API request/response types
// ===========================================

export interface GenerateMealPlanRequest {
  pantry_items: Pick<PantryItem, "name" | "category" | "quantity">[];
  preferences?: string; // dietary preferences, allergies, etc.
  days?: number; // how many days to plan (default 7)
}

export interface GenerateTripRequest {
  destination: string;
  start_date: string;
  end_date: string;
  interests?: string; // what they like to do
  budget?: string; // rough budget
  notes?: string;
}
