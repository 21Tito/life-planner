import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateMealPlan(
  pantryItems: { name: string; category: string; quantity: string | null }[],
  preferences?: string,
  days: number = 7
) {
  const pantryList = pantryItems
    .map((item) => `- ${item.name} (${item.category}${item.quantity ? `, ${item.quantity}` : ""})`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a helpful meal planning assistant. Create a ${days}-day meal plan based on what the user has available.

AVAILABLE INGREDIENTS:
${pantryList}

${preferences ? `DIETARY PREFERENCES: ${preferences}` : ""}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "meals": [
    {
      "day_of_week": 0,
      "meal_type": "breakfast",
      "title": "Meal Name",
      "description": "Brief description",
      "recipe": {
        "ingredients": [
          { "name": "ingredient", "amount": "1", "unit": "cup", "from_pantry": true }
        ],
        "steps": ["Step 1", "Step 2"],
        "prep_time_minutes": 10,
        "cook_time_minutes": 20,
        "servings": 2
      }
    }
  ],
  "grocery_list": [
    { "name": "item name", "quantity": "amount", "category": "produce" }
  ]
}

day_of_week: 0=Monday through 6=Sunday.
meal_type: one of "breakfast", "lunch", "dinner", "snack".
from_pantry: true if the ingredient is from the available ingredients list.
grocery_list: only items NOT already in the pantry that are needed for the recipes.
Include breakfast, lunch, and dinner for each day. Keep meals practical and tasty.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  return JSON.parse(text);
}

export async function generateTripItinerary(params: {
  destination: string;
  start_date: string;
  end_date: string;
  interests?: string;
  budget?: string;
  notes?: string;
}) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert travel planner. Create a detailed day-by-day itinerary.

DESTINATION: ${params.destination}
DATES: ${params.start_date} to ${params.end_date}
${params.interests ? `INTERESTS: ${params.interests}` : ""}
${params.budget ? `BUDGET: ${params.budget}` : ""}
${params.notes ? `NOTES: ${params.notes}` : ""}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Trip to Destination",
  "days": [
    {
      "day_number": 1,
      "date": "2025-04-01",
      "title": "Arrival & First Impressions",
      "notes": "General notes for the day",
      "activities": [
        {
          "title": "Activity name",
          "description": "What to do and why",
          "category": "activity",
          "start_time": "09:00",
          "end_time": "11:00",
          "location": "Place name, address",
          "cost_cents": 2500,
          "booking_url": null,
          "sort_order": 0
        }
      ]
    }
  ]
}

category: one of "flight", "hotel", "restaurant", "activity", "transport", "shopping", "rest", "other".
Include realistic timing. Mix popular spots with local gems. Include restaurant recommendations for meals.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  return JSON.parse(text);
}
