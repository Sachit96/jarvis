import { signOutAction } from "@/actions/auth-actions";

export function Topbar({ email }: { email: string | undefined }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4">
      <span className="font-mono text-sm text-muted-foreground">
        {email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
