/**
 * Email Unsubscribe Handler
 * Adds the email to denylist and confirms unsubscription.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email || !token) {
    return new Response(buildPage("Invalid Link", "This unsubscribe link is invalid or expired."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Basic token validation (base64 of email)
  try {
    const decoded = atob(token);
    if (decoded !== email) {
      return new Response(buildPage("Invalid Token", "This unsubscribe link could not be verified."), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } catch {
    return new Response(buildPage("Invalid Token", "This unsubscribe link is malformed."), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Add to denylist
  const { error } = await supabase.from("denylist").upsert(
    {
      type: "email",
      value: email.toLowerCase(),
      reason: "user_unsubscribed",
      blocked_by: "email-unsubscribe",
      active: true,
    },
    { onConflict: "type,value" },
  );

  if (error) {
    console.error("Denylist upsert error:", error);
  }

  // Also update any lead records
  await supabase
    .from("leads")
    .update({ status: "blacklisted" })
    .ilike("email", email)
    .catch(() => {});

  console.log(`✅ Unsubscribed: ${email}`);

  return new Response(
    buildPage("Unsubscribed", "You've been successfully removed from our mailing list. You won't receive any further emails from us."),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

function buildPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — TruthToken</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f0f23; color: #e0e0e0; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; backdrop-filter: blur(12px); }
    h1 { font-size: 24px; margin-bottom: 16px; color: #a5b4fc; }
    p { font-size: 16px; line-height: 1.6; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
