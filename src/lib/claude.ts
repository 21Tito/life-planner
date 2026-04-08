import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
