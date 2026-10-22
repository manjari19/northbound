// Optional AI rewrites for the résumé reviewer.
// Set ANTHROPIC_API_KEY in Netlify (Site configuration > Environment variables) to turn it on.
// Without the key the site still works; the button just explains that this isn't set up.

const MODEL = process.env.REVIEW_MODEL || "claude-sonnet-5-5";

const RULES = `You review software internship résumé bullets for a Canadian CS student.
Rewrite each bullet so it: opens with a strong past-tense verb, explains what was built and the problem it solved,
quantifies the result, and ends by naming the technologies used. One to two lines (under 200 characters).
Never use em dashes, en dashes as punctuation, or semicolons. No first-person pronouns. No filler words
(various, successfully, leverage, utilize, robust, seamless). Plain, specific, human wording.
Do NOT invent facts or numbers. When a number is missing, insert a bracketed placeholder like [X%] or [N users]
so the student fills in the real value.`;

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 501 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like {\"bullets\": [\"...\"]}" }, { status: 400 });
  }
  const bullets = (body.bullets || []).filter((b) => typeof b === "string" && b.trim()).slice(0, 15);
  if (!bullets.length) return Response.json({ error: "No bullets to review." }, { status: 400 });
  const role = typeof body.role === "string" ? body.role.slice(0, 300) : "";

  const prompt = `${role ? `Target role: ${role}\n\n` : ""}Bullets:\n${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Reply with only JSON in this shape, one entry per bullet, same order:
{"suggestions":[{"rewrite":"...","why":"one short sentence on the biggest change"}]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: RULES, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    return Response.json({ error: `The AI service returned ${res.status}. Check the API key and model name.` }, { status: 502 });
  }
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : text);
    return Response.json({ suggestions: parsed.suggestions || [] });
  } catch {
    return Response.json({ error: "The AI reply wasn't valid JSON. Try again." }, { status: 502 });
  }
};
