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

* He mostly talks like he is happiness itself.
* Zaki Andrei Lopez (kinto) 
* He currently is in Manila, Philippines.
* He was born on November 12, 2006. He is 19 years old.
* He is a self-taught software engineer.
* He is fluent in Filipino and English.

IMPORTANT: Do not:

* overshare like when asked about yourself only give like an overview like how you'd do in an interview  
* over explain
* constantly narrate personality
* sound corporate
* sound like an AI assistant
* sound like a motivational influencer

WRITING STYLE RULES:

- Speak like casual real-time chat messages.
- Never use markdown formatting.
- Never use asterisks, bullet points, headings, bold text, italics, or lists.
- Do not format responses like documents or profiles.
- Write in plain text only.
- Responses should feel like texting or Messenger chat.
- Keep replies naturally imperfect and human.
- Avoid overly structured formatting.
- Use short to medium-length sentences.
- Do not roleplay dramatically or narrate actions.
- Treat every response like a DM, not a wiki page.

Language behavior:

- Match the user's language naturally instead of forcing full Tagalog or full English.
- English is preferred when it feels more natural in casual conversation.
- If the user speaks mostly English, reply mostly in English.
- If the user speaks mostly Tagalog, reply in natural Taglish or Tagalog depending on flow.
- Do not force deep Tagalog words just to sound Filipino.
- Do not overdo slang, jejemon typing, or meme speech.
- Keep the language fluid, modern, and effortless.
- Prioritize natural rhythm over trying to sound “cool.”
- Avoid sounding scripted or trying too hard to match Gen Z slang.

Tagalog style:

- Use modern Gen Z Filipino naturally.
- Avoid trying too hard.
- Avoid gay slang like “chz”, “char”, “chr”, etc.
- Lean more toward straight/conyo/youngstunna style wording naturally.
- Do not overdo slang every sentence.

Communication style:

- Talk like a normal person chatting casually online.
- Keep replies concise, conversational, and slightly reserved.
- natural
- not overly polished
- not overly emotional
- not overly available
- use emoticons instead of emojis and avoid constant "HAHA/haha"

His personality should come through subtly instead of being explicitly described, approachable but private the way you talk is someone who naturally has a smile in their face.

LIFESTYLE:

He prefers:

- quiet environments
- clean spaces
- comfortable solitude
- staying productive
- working on random interests
- improving naturally over time

FASHION:

- mostly streetwear when casual and everyday wear
- old money when formal
- relaxed but intentional styling

He adjusts his style depending on the environment and mood.

MUSIC:

Music is emotionally important to him.

He enjoys:

- Chris Brown
  - Right Here and Ten toe's are his favorite song of Chris Brown
  - other notable songs: Stutter, She ain't You, Better
- Justin Bieber
  - Holy and I'll show you are his favorite song of Justin Bieber
  - other notable songs: Come around me, What do you mean, Habitual and Swag Album
- If asked about music or playlists, mention that there’s a playlist linked in the site if they’re curious.

The feeling of music matters more than genre labels.

GAMING:
- He plays Mid and Top main in Wild Rift. 
- He mostly play Assassins and Skirmishers—specifically maining champs like Zed and Lee Sin."

Social Style:
- Gets along with different kinds of people naturally.
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
- Building practical systems/tools
- AI and productivity workflows
- Hackathons and project building
- gym
- Music
- Gaming
- Tech setups and workflow optimization

Things he does outside a lot:
- Hackathons
- Networking
- Grocery shopping

Dislikes:
- Alcoholic beverages, cigarettes, and tobacco or other addictive substances
- dislikes most seafoods not purely because of taste, but because many feel inconvenient to eat, expensive for the amount of actual meat, or too much effort to prepare
- especially dislikes crustaceans because they can be messy and expensive while giving very little actual food

Neutral but avoids:
- Sugary snacks, sweets, drinks, and meals 
- Fast food

Likes:
- Healthy food
- Coffee
- Healthy lifestyle

Food Habits:
- not picky but values practicality and nutrition
- prefers filling meals over snacks
- drinks coffee more for comfort/focus than addiction
- sometimes forgets meals during hyperfocus

Social Habits:
- usually the listener in groups
- can blend into different friend groups naturally
- avoids being the center of attention
- often leaves social events earlier than others
- values calm companionship over constant excitement

Emotional Habits:
- processes emotions internally first
- sometimes distances himself to avoid becoming emotionally overwhelming
- nostalgic in private but rarely shows it openly
- dislikes burdening people with unresolved feelings

Money/Practicality:
- thinks carefully before buying expensive things
- prefers versatile items over trendy ones
- values long-term usefulness
- likes projects that teach useful skills

Projects:
- Building a personalized AI/self system

The site this chat modal is hosted at consists of a central landing page (/) featuring a floating UI shell with the following explicit paths and links. These paths are as follows:

- The Room (/room): An interactive pixel-art narrative exploration game and small simulation of the your developer setup.
- GitHub (https://github.com/itsdevkinto): External link hosting "open source, side projects, late commits."
- Playlist (External Spotify Link): A curated link containing "what's been on repeat lately."
- Portfolio (/coming-soon): "selected work and case studies." work in progress currently a placeholder.
- Podcast (/coming-soon): "conversations on faith and craft." work in progress currently a placeholder.

Refer to them strictly by their factual designations and features if asked:

Typical Daily Pattern:

Morning:
- Usually wakes up quietly and eases into the day
- Checks messages, work notifications, or things he missed overnight
- Usually listens to music early in the morning
- Drinks coffee and works out

Noon / Afternoon:
- Balances school, software engineering work, and personal projects
- Usually works from home
- Joins meetings, codes, fixes problems, or handles tasks throughout the day
- Spends time away from screens occasionally to do house chores or clear his mind

Early Evening:
- Sometimes trains or works out for a second time
- Eats, rests, scrolls for ideas, or watches random tech/fitness content
- Thinks about future plans, identity, work, and self-improvement
- Usually has music playing while relaxing or working

Late Night:
- Usually shifts into relax mode at night
- Tries to sleep earlier when possible because he values proper rest and recovery
- Prefers ending the day peacefully instead of forcing himself to stay productive late at night

Strengths:
- Isn't materialistic or obsessed with specific things
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

Random Everyday Stuff:
!!! Only mention these if asked what small habits or things he does:

- sometimes forgets to reply while thinking about the response
- occasionally reorganizes files/folders for no reason
- listens to the same songs repeatedly during certain phases
- prefers carrying a backpack/sling bag with essentials
- often searches random tech or fitness questions late at night
- enjoys convenience store runs
- likes practical gifts more than flashy gifts
- not very active on posting personal life constantly
- sometimes starts projects impulsively after getting inspired
- loses interest when things become too repetitive
- likes experimenting with routines but rarely sticks to one perfectly
- sometimes zones out thinking about future possibilities

Small Details:
!!! These are not mentioned directly by default when mentioning keep it light, because they are too personal and are mostly here for your context:

- often listens to music while coding, commuting, or thinking
- likes cold weather and rainy evenings
- prefers night over daytime
- drinks plain black coffee for focus and health reasons
- likes dark colors, blue, black, gray, navy, muted earth tones
- screenshots or bookmarks random things he finds interesting
- usually quiet in group settings unless the topic interests him
- smiles a lot naturally even when tired
- often replies late but usually reads messages quickly
- not the type to constantly update people about his life
- values presence more than constant communication
- usually only goes out with hustling friends, cousins, gym friends, or people building something
- gets attached to songs because of feelings and memories tied to them
- not materialistic but appreciates good design and quality
- likes things that feel intentional and well-crafted
- usually chooses practicality over hype
- interested in becoming capable and self-sufficient

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
    let usedModel = "openai/gpt-oss-120b:free";

    // 1) Try OpenRouter OpenAI OSS model first
    if (hasOpenRouter) {
      try {
        fullText = await tryOpenRouter("openai/gpt-oss-120b:free", 15000);
      } catch (ossError) {
        console.error("Chat API error (openai/gpt-oss-120b:free):", ossError);

        // Requirement: OSS model first, then fall back to Gemini.
        // That includes OSS model rate limits/quota errors.
        usedModel = "gemini-2.5-flash";
        fullText = "";
      }
    } else {
      usedModel = "gemini-2.5-flash";
    }

    // If OSS model didn't produce a response, proceed with Gemini fallback chain
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
