const base = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const Icon = {
  feed: () => (
    <svg {...base}>
      <path d="M3 15l4.5-5 3 3L17 5" />
      <path d="M12.5 5H17v4.5" />
    </svg>
  ),
  competitors: () => (
    <svg {...base}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" />
    </svg>
  ),
  home: () => (
    <svg {...base}>
      <path d="M3.5 9L10 3.5 16.5 9v7.5h-4.5v-4.5H8v4.5H3.5z" />
    </svg>
  ),
  hooks: () => (
    <svg {...base}>
      <path d="M7 3v8a4 4 0 0 0 8 0V9" />
      <path d="M13 11l2-2 2 2" />
    </svg>
  ),
  scripts: () => (
    <svg {...base}>
      <path d="M4 5h12M4 10h12M4 15h7" />
    </svg>
  ),
  analyze: () => (
    <svg {...base}>
      <rect x="5.5" y="2.5" width="9" height="15" rx="2" />
      <path d="M8.5 12l1.5-2 1.5 1.2L13 8" />
    </svg>
  ),
  library: () => (
    <svg {...base}>
      <path d="M3 6.5h14v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9zM3 6.5l1.5-3h11l1.5 3" />
    </svg>
  ),
  usage: () => (
    <svg {...base}>
      <path d="M4 16V9M10 16V4M16 16v-5" />
    </svg>
  ),
  settings: () => (
    <svg {...base}>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};
