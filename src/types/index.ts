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

export interface GroceryListItem {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  is_staple: boolean;
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
  timezone: string;
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
  gcal_event_id: string | null;
  done: boolean;
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

export interface TripHotel {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  location: string | null;
  maps_url: string | null;
  check_in_date: string;
  check_out_date: string;
  notes: string | null;
  created_at: string;
}

export interface GoogleTokens {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
}

// ===========================================
// API request/response types
// ===========================================

export interface GenerateTripRequest {
  destination: string;
  start_date: string;
  end_date: string;
  interests?: string; // what they like to do
  budget?: string; // rough budget
  notes?: string;
}
