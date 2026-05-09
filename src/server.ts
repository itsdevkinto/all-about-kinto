import "./lib/error-capture";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

const OWNER_CONTEXT = `You are Zaki Andrei Lopez, also known as kinto.

FACTS:

* Zaki Andrei Lopez (kinto) is from Manila/Bulacan, Philippines.
* He was born on November 12, 2006. He is 19 years old.
* He is currently attending STI College San Jose del Monte.
* He is a self-taught software engineer.
* He enjoys lifting and skill-based training.
* He is fluent in Filipino and English.

IMPORTANT: Do not:

* over explain
* constantly narrate personality
* sound corporate
* sound like an AI assistant
* sound like a motivational influencer
* don't use markdown symbols like asterisk stuff when emphasizing words

Calm, observant, analytical, grounded, approachable but private the way you talk is someone who naturally has a smile in their face.

LIFESTYLE:

kinto enjoys:

* lifting weights
* skill-based training
* improving physical aesthetics
* guitar
* gaming
* thoughtful design
* experimenting with ideas

He prefers:

* quiet environments
* clean spaces
* comfortable solitude
* staying productive
* working on random interests
* improving naturally over time

He is not obsessed with hustle culture or motivational content.

FASHION:

His style blends:

* streetwear
* clean old money aesthetics
* relaxed but intentional styling

He adjusts his style depending on the environment and mood.

MUSIC:

Music is emotionally important to him.

He enjoys:

* Chris Brown
  - Right Here and Ten toe's are his favorite song of Chris Brown
  - other notable songs: Stutter, She ain't You, Better
* Justin Bieber
  - Holy and I'll show you are his favorite song of Justin Bieber
  - other notable songs: Come around me, What do you mean, Habitual and Swag Album
* If asked about music or playlists, mention that there’s a playlist linked in the site if they’re curious.

The feeling of music matters more than genre labels.

GAMING:

kinto enjoys games that reward mechanics, creativity, and expression.

He often prefers expressive or mechanically difficult characters instead of simply following the strongest meta.

He likes characters such as Yone because they feel fluid, stylish, and rewarding to master.

Gets along with different kinds of people naturally.

Communication style:

* concise
* conversational
* slightly reserved
* natural
* not overly polished
* not overly emotional
* not overly available
* use emoticons instead of emojis and avoid constant "HAHA/haha"

Social Style:
- Prefers peers over highly emotional friendships
- Likes people who understand space and silence
- Dislikes overly demanding social dynamics
- Values mutual understanding without constant communication
- Can disappear for periods to recharge

MINDSET:

Zaki is generally easygoing and emotionally steady.
He takes his responsibilities seriously, but he is not overly harsh on himself or obsessed with proving something constantly.
He believes people are shaped by different experiences and perspectives, so he rarely forces his beliefs or ideology onto others.
Compliments and insults do not affect him deeply because he already has a realistic understanding of himself and where he currently stands.
He tends to live by a quiet “mind my own life” mindset.
Even when he notices flaws, bad traits, or strange behavior in people, he usually stays calm, smiles, and keeps moving forward instead of becoming bitter or judgmental.
He avoids unnecessary drama and gossip, although he naturally ends up hearing about situations and problems happening around him. He prefers observing quietly rather than getting deeply involved in conflict that does not concern him directly.

Weaknesses/Insecurities:
- Feels replaceable sometimes
- Struggles with long-term attachment/sustainability
- Doubts whether he truly “belongs” somewhere
- Can emotionally distance himself from people
- Overthinks future stability and relationships
- Fear of wasting time on repetitive or meaningless things

Common Interests:
- Programming / web dev
- Hardware tinkering
- Linux
- Building practical systems/tools
- AI and productivity workflows
- Hackathons and project building
- Calisthenics / gym
- Chess
- Gaming
- Tech setups and workflow optimization

Projects:

- Building a personalized AI/self system

Typical Daily Pattern:
- Watches tutorials or explores tech topics
- Codes or experiments with setups/tools
- Thinks deeply about identity/future/work
- Random bursts of motivation and hyperfocus
- Sometimes trains/workouts multiple times a day
- Scrolls/searches for ideas more than entertainment
- Likes discovering shortcuts, extensions, workflows

Strengths:
- Learns systems quickly through repetition/exposure
- Strong pattern recognition
- Resourceful and adaptable
- Can self-teach effectively
- Good at connecting ideas together
- Good eye for workflow and efficiency improvements

Romance:
- Avoid romantic or sexual content
- Keep it light and friendly
- kinto acts emotionally detached sometimes but actually feels things deeply
- There is someone he still thinks about, but he rarely talks about it directly
- Part of him feels like timing, personal growth, and capability matter more than simply liking someone

Let personality appear naturally through conversation.`;

async function handleChatAPI(
  request: Request,
  env?: Record<string, string>,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/chat" || request.method !== "POST") {
    return null;
  }

  try {
    const body = await request.json();
    const rawMessages = (body as { messages?: unknown }).messages;
    const messages = Array.isArray(rawMessages)
      ? rawMessages
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const obj = m as Record<string, unknown>;
            const role = obj.role;
            const content = obj.content;
            if (role !== "user" && role !== "assistant") return null;
            if (typeof content !== "string") return null;
            return { role, content } as { role: "user" | "assistant"; content: string };
          })
          .filter((m): m is { role: "user" | "assistant"; content: string } => Boolean(m))
      : [];

    const MAX_MESSAGES = 10;
    const MAX_CHARS_PER_MESSAGE = 800;
    const cappedMessages = messages.slice(-MAX_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
    }));

    const geminiApiKey =
      env?.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!geminiApiKey || geminiApiKey === "your_api_key_here") {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openRouterApiKey = env?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

    const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });
    const hasOpenRouter = Boolean(openRouterApiKey);

    function isQuotaError(err: unknown): boolean {
      const errorObj = err as Record<string, unknown>;
      const statusCode = errorObj.statusCode ?? errorObj.status;
      if (statusCode === 429) return true;

      const dataObj = errorObj.data as Record<string, unknown> | undefined;
      const innerError = dataObj?.error as Record<string, unknown> | undefined;
      if (innerError?.code === 429) return true;

      const message = (errorObj.message ?? String(err)).toString().toLowerCase();
      return (
        message.includes("429") ||
        message.includes("quota") ||
        message.includes("resource_exhausted") ||
        message.includes("rate limit") ||
        message.includes("exceeded")
      );
    }

    function isRetryableProviderError(err: unknown): boolean {
      const errorObj = err as Record<string, unknown>;
      const statusCode = errorObj.statusCode ?? errorObj.status;
      if (typeof statusCode === "number" && statusCode >= 500) return true;

      const message = (errorObj.message ?? String(err)).toString().toLowerCase();
      return (
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("etimedout")
      );
    }

    function getRetryAfterMs(err: unknown): number | null {
      const errorObj = err as Record<string, unknown>;
      const dataObj = errorObj.data as Record<string, unknown> | undefined;
      const inner = dataObj?.error as Record<string, unknown> | undefined;
      const details = inner?.details;
      if (!Array.isArray(details)) return null;

      for (const item of details) {
        if (!item || typeof item !== "object") continue;
        const detail = item as Record<string, unknown>;
        if (detail["@type"] !== "type.googleapis.com/google.rpc.RetryInfo") continue;
        const retryDelay = detail.retryDelay;
        if (typeof retryDelay !== "string") continue;

        // Formats we see: "10s", "0.939s"
        const m = /^([0-9]+(?:\.[0-9]+)?)s$/.exec(retryDelay.trim());
        if (!m) continue;
        const seconds = Number(m[1]);
        if (!Number.isFinite(seconds)) continue;
        return Math.max(0, Math.round(seconds * 1000));
      }

      return null;
    }

    function getRetryAfterMsFromHeaders(headers: Headers): number | null {
      const retryAfter = headers.get("retry-after");
      if (!retryAfter) return null;
      const seconds = Number(retryAfter);
      if (!Number.isFinite(seconds)) return null;
      return Math.max(0, Math.round(seconds * 1000));
    }

    async function tryModel(modelName: string, timeoutMs: number): Promise<string> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await generateText({
          model: google(modelName),
          system: OWNER_CONTEXT,
          messages: cappedMessages,
          temperature: 0.8,
          maxRetries: 0,
          abortSignal: controller.signal,
        });
        return result.text;
      } finally {
        clearTimeout(timeout);
      }
    }

    async function tryOpenRouter(modelName: string, timeoutMs: number): Promise<string> {
      if (!openRouterApiKey) {
        throw new Error("OpenRouter API key not configured");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            temperature: 0.8,
            messages: [
              { role: "system", content: OWNER_CONTEXT },
              ...cappedMessages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const bodyText = await response.text();
          const err = new Error(bodyText || `OpenRouter error (${response.status})`);
          (err as unknown as { statusCode?: number }).statusCode = response.status;
          const retryAfterMs = getRetryAfterMsFromHeaders(response.headers);
          if (retryAfterMs !== null) {
            (err as unknown as { retryAfterMs?: number }).retryAfterMs = retryAfterMs;
          }
          throw err;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        return text;
      } finally {
        clearTimeout(timeout);
      }
    }

    let fullText = "";
    let usedModel = "deepseek/deepseek-chat";

    // 1) Try OpenRouter DeepSeek first
    if (hasOpenRouter) {
      try {
        fullText = await tryOpenRouter("deepseek/deepseek-chat", 15000);
      } catch (deepseekError) {
        console.error("Chat API error (deepseek):", deepseekError);

        // Requirement: DeepSeek first, then fall back to Gemini.
        // That includes DeepSeek rate limits/quota errors.
        usedModel = "gemini-2.5-flash";
        fullText = "";
      }
    } else {
      usedModel = "gemini-2.5-flash";
    }

    // If DeepSeek didn't produce a response, proceed with Gemini fallback chain
    if (!fullText.trim()) {
      usedModel = "gemini-2.5-flash";
      try {
        fullText = await tryModel("gemini-2.5-flash", 15000);
      } catch (flashError) {
        const isTimeout = flashError instanceof Error && flashError.name === "AbortError";

        if (isQuotaError(flashError) || isTimeout || isRetryableProviderError(flashError)) {
          usedModel = "gemini-3.1-flash-lite";
          try {
            fullText = await tryModel("gemini-3.1-flash-lite", 15000);
          } catch (liteError) {
            console.error("Chat API error (flash-lite):", liteError);
            if (isQuotaError(liteError)) {
              const retryAfterMs = getRetryAfterMs(liteError) ?? 10_000;
              return new Response(
                JSON.stringify({
                  error: `rate limited. try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
                  retryAfterMs,
                }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            return new Response(
              JSON.stringify({
                error: "AI service temporarily unavailable. Please try again in a moment.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }
        } else {
          console.error("Chat API error (flash):", flashError);
          return new Response(
            JSON.stringify({ error: "Something went wrong. Please try again." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (!fullText.trim()) {
      return new Response(JSON.stringify({ error: "Empty response from AI" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Response from ${usedModel}`);

    return new Response(JSON.stringify({ response: fullText, model: usedModel }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default {
  async fetch(request: Request, env?: Record<string, string>, ctx?: unknown) {
    try {
      // Handle API routes first
      const apiResponse = await handleChatAPI(request, env);
      if (apiResponse) return apiResponse;

      // Fall back to TanStack handler
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
