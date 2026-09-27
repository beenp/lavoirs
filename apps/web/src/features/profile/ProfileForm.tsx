import { useState, type FormEvent } from "react";

type ProfileFormProps = {
  busy: boolean;
  initialDisplayName: string;
  initialDescription: string;
  onSave: (displayName: string, description: string) => Promise<void>;
};

export default function ProfileForm({ busy, initialDisplayName, initialDescription, onSave }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [description, setDescription] = useState(initialDescription);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(displayName.trim(), description.trim());
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>Name shown to your group</span>
        <input autoComplete="name" className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-amber-300" maxLength={80} minLength={1} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>A little about you</span>
        <textarea className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-amber-300" maxLength={600} onChange={(event) => setDescription(event.target.value)} placeholder="Share a few interests or conversation starters." value={description} />
      </label>
      <p className="text-xs leading-5 text-slate-400">Keep it short and share something you would enjoy talking about.</p>
      <button className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
