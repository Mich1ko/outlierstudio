export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`logo-mark ${className}`.trim()}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="10" fill="var(--color-ink)" />
      <path d="M18 44 22 29h8l-4 15Z" fill="var(--color-paper)" />
      <path d="m30 44 6-23h8l-6 23Z" fill="var(--color-paper)" />
      <path d="m42 44 9-34h8l-9 34Z" fill="var(--color-lime-accent)" />
    </svg>
  );
}
