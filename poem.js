// Vercel serverless function: sends the prompt to Claude using a key kept on the server.
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   ANTHROPIC_API_KEY  (required)
//   ACCESS_CODE        (optional: if set, the site asks for this code before writing poems)
//   CLAUDE_MODEL       (optional: defaults to claude-sonnet-5-5)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "missing_api_key" });
    return;
  }
  const code = process.env.ACCESS_CODE;
  if (code && req.headers["x-access-code"] !== code) {
    res.status(401).json({ error: "bad_access_code" });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const prompt = body.prompt;
  if (typeof prompt !== "string" || prompt.length < 10 || prompt.length > 8000) {
    res.status(400).json({ error: "bad_prompt" });
    return;
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (r.status === 429) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    if (!r.ok) {
      res.status(502).json({ error: "upstream_" + r.status });
      return;
    }
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
};
