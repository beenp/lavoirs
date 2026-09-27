import { useState, type FormEvent } from "react";

export type AuthMode = "sign-in" | "sign-up";

export type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
  description: string;
};

type AuthFormProps = {
  busy: boolean;
  error: string;
  message: string;
  onSubmit: (mode: AuthMode, values: AuthFormValues) => Promise<void>;
};

export default function AuthForm({ busy, error, message, onSubmit }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState("");
  const isSignUp = mode === "sign-up";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSignUp && !displayName.trim()) {
      setValidationError("Enter the name you want your group to see.");
      return;
    }
    setValidationError("");
    void onSubmit(mode, {
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      description: description.trim(),
    });
  }

  return (
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/20 sm:p-9">
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your next good conversation</p>
        <h2 className="text-2xl font-semibold text-white">{isSignUp ? "Create your profile" : "Welcome back"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {isSignUp ? "Set up your account before meeting people who share your interests." : "Sign in to continue to your profile."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        {isSignUp && (
          <>
            <label className="block space-y-2 text-sm text-slate-200">
              <span>Name shown to your group</span>
              <input autoComplete="name" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300" maxLength={80} minLength={1} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label className="block space-y-2 text-sm text-slate-200">
              <span>A little about you</span>
              <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300" maxLength={600} onChange={(event) => setDescription(event.target.value)} placeholder="What have you been enjoying lately?" value={description} />
            </label>
          </>
        )}

        <label className="block space-y-2 text-sm text-slate-200">
          <span>Email</span>
          <input autoComplete="email" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        </label>
        <label className="block space-y-2 text-sm text-slate-200">
          <span>Password</span>
          <input autoComplete={isSignUp ? "new-password" : "current-password"} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300" minLength={isSignUp ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          {isSignUp && <span className="block text-xs text-slate-400">Use at least 8 characters.</span>}
        </label>

        {(validationError || error) && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">{validationError || error}</p>}
        {message && <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100" role="status">{message}</p>}

        <button className="w-full rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
          {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <button className="mt-5 text-sm text-slate-300 underline decoration-white/30 underline-offset-4 hover:text-white disabled:opacity-50" disabled={busy} onClick={() => { setValidationError(""); setMode(isSignUp ? "sign-in" : "sign-up"); }} type="button">
        {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </section>
  );
}
