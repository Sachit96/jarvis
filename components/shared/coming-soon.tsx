export function ComingSoon({ module, page }: { module: string; page: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {module}
      </p>
      <h1 className="text-xl font-semibold">{page}</h1>
      <p className="mt-4 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground w-full">
        Coming soon — this module isn&apos;t built yet.
      </p>
    </div>
  );
}
