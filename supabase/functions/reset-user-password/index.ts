import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const adminToken = req.headers.get("x-cron-secret");
  const expectedToken = Deno.env.get("CRON_SECRET");
  
  if (!adminToken || adminToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { email, password } = await req.json();
  
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find user by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), { status: 500 });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  // Update password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, userId: user.id }), { status: 200 });
});
