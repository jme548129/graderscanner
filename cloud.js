(function(){
  const C = window.GRADER_CONFIG || {};
  const configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/YOUR_|PASTE_/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY));
  const hasSdk = !!(window.supabase && window.supabase.createClient);
  const on = configured && hasSdk;
  const Cloud = window.Cloud = { on, saveResult: async () => ({ error: "Cloud is not configured." }), loadResults: async () => [] };
  if (!on) {
    if (configured && !hasSdk) console.warn("Supabase SDK failed to load. Grader will keep working locally.");
    return;
  }

  let sb;
  try { sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY); }
  catch (error) {
    Cloud.on = false;
    console.warn("Supabase could not start. Grader will keep working locally.", error);
    return;
  }
  const $ = id => document.getElementById(id);
  const style = document.createElement("style");
  style.textContent = '#auth{position:fixed;inset:0;z-index:50;background:var(--bg);overflow:auto;padding:24px 16px}#auth .card{max-width:420px;margin:8vh auto 0}#auth .sw{background:none;border:0;color:var(--pri);font-weight:700;text-decoration:underline;width:100%;padding:12px 0 0}#auth input{margin-bottom:10px}#auth .warn{overflow-wrap:anywhere}';
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "auth";
  box.hidden = false;
  box.innerHTML = `<div class="card"><h1 id="aT">Log in</h1><p class="mut">Log in to use Grader.</p>
    <div id="aS" hidden><input id="aN" placeholder="Full name" autocomplete="name"><input id="aSc" placeholder="School" autocomplete="organization"></div>
    <input id="aE" type="email" placeholder="Email" autocomplete="email">
    <input id="aP" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">
    <p id="aM" class="warn" role="status" aria-live="polite"></p>
    <button class="btn" id="aB" style="width:100%">Log in</button>
    <button class="sw" id="aW">No account yet? Sign up</button></div>`;
  document.body.appendChild(box);
  $("aM").textContent = "Checking your session…";

  let up = false, busy = false;
  function mode() {
    $("aT").textContent = up ? "Create an account" : "Log in";
    $("aS").hidden = !up;
    $("aP").autocomplete = up ? "new-password" : "current-password";
    $("aB").textContent = busy ? "Please wait…" : (up ? "Sign up" : "Log in");
    $("aB").disabled = busy;
    $("aW").disabled = busy;
    $("aW").textContent = up ? "Already have an account? Log in" : "No account yet? Sign up";
  }
  $("aW").onclick = () => { if (busy) return; up = !up; mode(); };
  function friendlyError(message) {
    const m = String(message || "");
    if (/error sending confirmation email|email address not authorized|email rate limit exceeded|over_email_send_rate_limit/i.test(m))
      return "Supabase could not send the confirmation email. The built-in email service only sends to project team addresses and allows 2 emails per hour. Set up custom SMTP or turn off Confirm email in Supabase.";
    if (/email not confirmed/i.test(m))
      return "Your email is not confirmed yet. Check your inbox and spam for the confirmation link. If it never arrives, fix the SMTP/email limit settings first.";
    if (/invalid login credentials/i.test(m))
      return "The email or password is incorrect, or you do not have an account yet. Check your details or sign up.";
    if (/user already registered/i.test(m))
      return "An account already exists for this email. Choose Log in.";
    if (/password should be at least/i.test(m))
      return "Use a password with at least 6 characters.";
    if (/failed to fetch|network/i.test(m))
      return "Could not connect to Supabase. Check your internet and the Supabase URL/key in config.js.";
    if (/timeout/i.test(m)) return m;
    return m || "The request did not complete. Please try again later.";
  }
  $("aB").onclick = async () => {
    if (busy) return;
    const email = $("aE").value.trim();
    const password = $("aP").value;
    $("aM").textContent = "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $("aM").textContent = "Enter a valid email address."; return;
    }
    if (password.length < 6) {
      $("aM").textContent = "Enter a password with at least 6 characters."; return;
    }
    busy = true; mode();
    $("aM").textContent = "Checking your account…";
    try {
      const request = up
        ? sb.auth.signUp({ email, password, options: { data: { full_name: $("aN").value.trim(), school: $("aSc").value.trim() }, emailRedirectTo: location.href.split("#")[0] } })
        : sb.auth.signInWithPassword({ email, password });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("The Supabase connection timed out. Refresh the page and try again.")), 15000));
      const result = await Promise.race([request, timeout]);
      if (result.error) { $("aM").textContent = friendlyError(result.error.message); return; }
      if (up && !result.data.session) {
        up = false; mode();
        $("aM").textContent = "Sign-up request sent. Check your inbox and spam for the confirmation email before logging in. If no email arrives, do not sign up repeatedly; fix SMTP/rate limits first.";
      } else if (result.data.session) {
        $("aM").textContent = "Logged in successfully.";
        await gate(result.data.session);
      }
    } catch (error) {
      $("aM").textContent = friendlyError(error && error.message);
    } finally {
      busy = false; mode();
    }
  };

  let sessionResolved = false;
  const sessionTimer = setTimeout(() => {
    if (!sessionResolved) { box.hidden = false; $("aM").textContent = ""; }
  }, 8000);
  async function gate(session) {
    sessionResolved = true; clearTimeout(sessionTimer);
    box.hidden = !!session;
    if (!session && $("aM").textContent === "Checking your session…") $("aM").textContent = "";
    if (session) {
      try { await sb.rpc("touch"); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("grader-auth-ready", { detail: { signedIn: !!session } }));
  }
  sb.auth.getSession().then(({ data, error }) => {
    if (error) $("aM").textContent = friendlyError(error.message);
    if (!sessionResolved) gate(data && data.session);
  }).catch(error => {
    sessionResolved = true; clearTimeout(sessionTimer);
    box.hidden = false;
    $("aM").textContent = friendlyError(error && error.message);
    window.dispatchEvent(new CustomEvent("grader-auth-ready", { detail: { signedIn: false } }));
  });
  sb.auth.onAuthStateChange((_event, session) => { gate(session); });

  const header = document.querySelector(".top>div");
  if (header) {
    const logout = document.createElement("button");
    logout.textContent = "Logout";
    logout.style.cssText = "margin-left:auto;background:none;border:1px solid currentColor;color:inherit;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer";
    logout.onclick = async () => { logout.disabled = true; const { error } = await sb.auth.signOut(); if (error) { logout.disabled = false; alert("Could not log out: " + error.message); } else { $("aM").textContent = ""; } };
    header.appendChild(logout);
  }

  Cloud.saveResult = async r => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return { error: "Log in before saving to the cloud." };
      const payload = {
        user_id: session.user.id,
        client_id: r.client_id,
        answer_key: r.key || [],
        exam_type: r.ex || "",
        exam_title: r.ti || "",
        student_id: r.id || "",
        student_name: r.name || "",
        score: Number(r.s) || 0,
        total: Number(r.t) || 0,
        answers: r.a || []
      };
      const { data: existing, error: lookupError } = await sb.from("results")
        .select("id,client_id")
        .eq("user_id", payload.user_id)
        .eq("client_id", payload.client_id)
        .maybeSingle();
      if (lookupError) return { error: lookupError.message };
      if (existing) return { data: existing, alreadySaved: true };
      const { data, error } = await sb.from("results").insert(payload)
        .select("id,client_id,answer_key,exam_type,exam_title,student_id,student_name,score,total,answers,created_at").single();
      if (error) return { error: error.message };
      return { data };
    } catch (error) {
      return { error: error && error.message ? error.message : "Cloud sync failed." };
    }
  };

  Cloud.loadResults = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return [];
    const { data, error } = await sb.from("results")
      .select("id,client_id,answer_key,exam_type,exam_title,student_id,student_name,score,total,answers,created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return (data || []).map(row => ({
      cloud_id: row.id,
      client_id: row.client_id || undefined,
      name: row.student_name || "Student",
      id: row.student_id || "",
      s: Number(row.score) || 0,
      t: Number(row.total) || 0,
      a: Array.isArray(row.answers) ? row.answers : [],
      key: Array.isArray(row.answer_key) ? row.answer_key : [],
      ex: row.exam_type || "",
      ti: row.exam_title || "",
      created_at: row.created_at
    }));
  };
})();