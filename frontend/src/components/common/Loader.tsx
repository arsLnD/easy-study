export function Loader({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-textSecondary">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
