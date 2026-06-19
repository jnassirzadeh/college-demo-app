// This file lives on the SERVER (Vercel), never in the app itself.
// It is the only place that ever touches your secret API key.

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Allow requests from your app (CORS). For now this allows any origin —
  // once your app has a real domain, you can lock this down to just that domain.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const { messages, profile } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    const system = `You are an encouraging, honest college-guidance mentor inside an app called Pathfinder, built for a ${profile?.grade || "high school"} student named ${profile?.name || "the student"}.
They live in/near: ${profile?.city || "an unspecified location"}.
They attend: ${profile?.school || "an unspecified school"}.
Their interests: ${profile?.interests || "still exploring"}.
Dream schools (if any): ${profile?.dreamSchools || "not decided yet"}.

When the student asks about clubs, activities, volunteering, competitions, or local opportunities, USE THE WEB SEARCH TOOL to find real, current, specific options near their city and school — name actual organizations, programs, or competitions where you can find them, and mention if something should be double-checked (e.g. "check if your school's club list confirms this is still active").

Speak like a warm, grounded mentor — not a corporate chatbot. Keep answers concise and specific. Never write application essays for them — help them find their own story instead. If asked something outside college/school guidance, gently redirect but stay friendly.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // <-- the secret key, read from server settings, never from code
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: data.error?.message || "Anthropic API error" });
    }

    // Collect just the text parts (search results + tool calls happen behind the scenes)
    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return res.status(200).json({ reply: text || "I couldn't come up with a response — try asking again." });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Something went wrong on the server." });
  }
}
