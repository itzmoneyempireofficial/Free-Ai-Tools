
import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const supaUrl = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

const admin = supaUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supaUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })
  : null;

const openai = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

app.get("/api/health", (_req, res) => {
  res.json({
    app: "Free AI Tools",
    status: "ok",
    configured: {
      supabase: !!(supaUrl && anon && admin),
      openai: !!process.env.OPENAI_API_KEY,
      paddle: !!(
        process.env.PADDLE_API_KEY &&
        process.env.PADDLE_WEBHOOK_SECRET &&
        process.env.PADDLE_PRICE_ID
      ),
      video: !!(
        process.env.VIDEO_PROVIDER_API_KEY &&
        process.env.VIDEO_PROVIDER_BASE_URL
      )
    }
  });
});

app.use("/api/paddle/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));

// Public website files are served from the repository root.
app.get(["/", "/index.html"], (_req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

app.get(
  ["/config.json", "/privacy.html", "/terms.html", "/refund.html"],
  (req, res) => {
    res.sendFile(path.join(root, req.path.slice(1)));
  }
);

async function auth(req, res, next) {
  try {
    if (!supaUrl || !anon) {
      return res.status(503).json({ error: "Supabase is not configured." });
    }

    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const client = createClient(supaUrl, anon, {
      auth: { persistSession: false }
    });

    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Session expired. Sign in again." });
    }

    req.user = data.user;
    next();
  } catch (_error) {
    res.status(500).json({ error: "Authentication check failed." });
  }
}

async function spend(userId, kind) {
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await admin.rpc("consume_credit", {
    p_user_id: userId,
    p_kind: kind
  });

  if (error) {
    throw new Error("Credit check failed. Run schema.sql.");
  }

  if (!data) {
    throw new Error("You have no remaining credits for this tool today.");
  }
}

app.get("/api/me", auth, async (req, res) => {
  try {
    if (!admin) {
      return res.status(503).json({ error: "Database is not configured." });
    }

    const { data, error } = await admin
      .from("profiles")
      .select("email,plan,text_credits,image_credits,video_credits,credits_reset_at")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    res.json({
      user: { id: req.user.id, email: req.user.email },
      profile: data
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not load account profile." });
  }
});

app.post("/api/generate/text", auth, async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    const tool = String(req.body.tool || "AI Writer").slice(0, 60);

    if (prompt.length < 3 || prompt.length > 6000) {
      return res.status(400).json({
        error: "Prompt must be 3–6,000 characters."
      });
    }

    await spend(req.user.id, "text");

    const model = process.env.OPENAI_TEXT_MODEL;
    if (!model) {
      throw new Error("Set OPENAI_TEXT_MODEL in server environment.");
    }

    const out = await openai().responses.create({
      model,
      instructions: `You are the ${tool} tool on Free AI Tools. Follow the user's request clearly.`,
      input: prompt
    });

    res.json({ output: out.output_text || "No text returned." });
  } catch (error) {
    console.error("text:", error.message);
    res.status(400).json({
      error: error.message || "Text generation failed."
    });
  }
});

app.post("/api/generate/image", auth, async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();

    if (prompt.length < 5 || prompt.length > 3000) {
      return res.status(400).json({
        error: "Prompt must be 5–3,000 characters."
      });
    }

    await spend(req.user.id, "image");

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const out = await openai().images.generate({
      model,
      prompt,
      size: "1024x1024"
    });

    const b64 = out.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Image provider returned no image.");
    }

    res.json({ imageDataUrl: `data:image/png;base64,${b64}` });
  } catch (error) {
    console.error("image:", error.message);
    res.status(400).json({
      error: error.message || "Image generation failed."
    });
  }
});

app.post("/api/generate/video", auth, async (_req, res) => {
  res.status(503).json({
    error: "Video generation is not activated. A video provider account, model selection, billing limits, task polling, moderation and storage adapter must be configured and tested first."
  });
});

app.get("/api/admin/summary", auth, async (req, res) => {
  if (
    !process.env.ADMIN_EMAIL ||
    req.user.email?.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()
  ) {
    return res.status(403).json({ error: "Admin only." });
  }

  if (!admin) {
    return res.status(503).json({ error: "Database is not configured." });
  }

  try {
    const [
      { count: users, error: u },
      { data: recent, error: p }
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles")
        .select("email,plan,created_at,text_credits,image_credits,video_credits")
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (u || p) throw u || p;

    res.json({
      registeredUsers: users || 0,
      recentUsers: recent || []
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not load admin data." });
  }
});

app.post("/api/paddle/webhook", async (req, res) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(503).send("Webhook not configured");
  }

  const sig = req.headers["paddle-signature"];

  if (!sig || !Buffer.isBuffer(req.body)) {
    return res.status(400).send("Missing signature");
  }

  const parts = Object.fromEntries(
    String(sig).split(";").map(x => x.split("="))
  );

  const ts = parts.ts;
  const v1 = parts.h1;

  if (!ts || !v1) {
    return res.status(400).send("Invalid signature header");
  }

  const signed = Buffer.concat([Buffer.from(`${ts}:`), req.body]);
  const expected = crypto.createHmac("sha256", secret)
    .update(signed)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("Bad JSON");
  }

  console.log("Verified Paddle event:", event.event_type);

  res.status(200).json({
    received: true,
    entitlementsUpdated: false,
    reason: "Configure approved price IDs and user mapping before enabling credit grants."
  });
});

// Express 5 compatible fallback route.
app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(root, "index.html"));
});

app.listen(port, () => {
  console.log(`Free AI Tools listening on ${port}`);
});
