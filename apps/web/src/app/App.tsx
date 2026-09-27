import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthForm, { type AuthFormValues, type AuthMode } from "../features/profile/AuthForm";
import ProfilePage from "../features/profile/ProfilePage";
import { supabase } from "../lib/supabase-client";

type Profile = {
  id: string;
  display_name: string;
  description: string | null;
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setError("");
      setMessage("");
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!supabase || !session) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    let active = true;
    setProfileReady(false);

    void (async () => {
      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, description")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (active) setProfile(data);
      } catch (loadError) {
        if (active) setError(`Could not load your profile: ${messageFrom(loadError)}`);
      } finally {
        if (active) setProfileReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, session]);

  async function handleAuth(mode: AuthMode, values: AuthFormValues): Promise<void> {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { display_name: values.displayName, description: values.description },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Check your email to confirm your account, then return here to finish your profile or sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      setError(messageFrom(authError));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfile(displayName: string, description: string): Promise<void> {
    if (!supabase || !session) return;
    if (!displayName || displayName.length > 80 || description.length > 600) {
      setError("Use a name from 1 to 80 characters and a description up to 600 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: saveError } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          display_name: displayName,
          description: description || null,
        }, { onConflict: "id" })
        .select("id, display_name, description")
        .single();
      if (saveError) throw saveError;
      setProfile(data);
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(`Could not save your profile: ${messageFrom(saveError)}. Confirm migration 007 is applied.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  const metadata = session?.user.user_metadata ?? {};
  const initialDisplayName = profile?.display_name
    ?? (typeof metadata.display_name === "string" ? metadata.display_name : "");
  const initialDescription = profile
    ? profile.description ?? ""
    : (typeof metadata.description === "string" ? metadata.description : "");

  if (!supabase) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <section className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-8">
          <h1 className="text-2xl font-semibold text-white">Connect Supabase to start</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Copy <code>.env.example</code> to <code>.env</code>, then fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</p>
        </section>
      </main>
    );
  }

  if (!authReady || (session && !profileReady)) {
    return <main className="grid min-h-screen place-items-center text-slate-300">Loading your account…</main>;
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Lavoirs</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Good conversations start here.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">Meet a small group of people who are into the same things you are.</p>
        </header>

        {session ? (
          <ProfilePage
            busy={busy}
            email={session.user.email ?? ""}
            error={error}
            initialDescription={initialDescription}
            initialDisplayName={initialDisplayName}
            message={message}
            onSave={handleSaveProfile}
            onSignOut={handleSignOut}
          />
        ) : (
          <AuthForm busy={busy} error={error} message={message} onSubmit={handleAuth} />
        )}
      </div>
    </main>
  );
}
