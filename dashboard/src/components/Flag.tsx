import { countryCodeFor } from "@/lib/flags";

export default function Flag({ team, className = "" }: { team: string; className?: string }) {
  const code = countryCodeFor(team);
  if (!code) {
    return <span className={className}>⚽</span>;
  }
  return (
    <span
      className={`fi fi-${code} inline-block rounded-[3px] shadow-sm ${className}`}
      title={team}
    />
  );
}
