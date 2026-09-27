import ProfileForm from "./ProfileForm";

type ProfilePageProps = {
  busy: boolean;
  email: string;
  error: string;
  initialDisplayName: string;
  initialDescription: string;
  message: string;
  onSave: (displayName: string, description: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export default function ProfilePage({
  busy,
  email,
  error,
  initialDisplayName,
  initialDescription,
  message,
  onSave,
  onSignOut,
}: ProfilePageProps) {
  return (
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/20 sm:p-9">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="mt-1 break-all text-sm font-medium text-white">{email}</p>
          <h2 className="mt-5 text-2xl font-semibold text-white">Finish your profile</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Your name and description help your group get to know you.</p>
        </div>
        <button className="shrink-0 text-sm text-slate-300 underline decoration-white/30 underline-offset-4 hover:text-white" onClick={() => void onSignOut()} type="button">Sign out</button>
      </div>

      {error && <p className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
      {message && <p className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100" role="status">{message}</p>}
      <ProfileForm
        busy={busy}
        initialDescription={initialDescription}
        initialDisplayName={initialDisplayName}
        onSave={onSave}
      />
    </section>
  );
}
