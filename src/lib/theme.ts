export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_KEY = "outlier-studio-theme";
export const THEME_QUERY = "(prefers-color-scheme: dark)";
export const parseTheme = (value: unknown): Theme =>
  value === "light" || value === "dark" ? value : "system";

// Runs synchronously in <head>, before the body can paint. Storage can be blocked.
export const themeInitScript = `(function(){var t='system';try{var s=localStorage.getItem('${THEME_KEY}');if(s==='light'||s==='dark')t=s}catch(e){}var d=t==='dark'||(t==='system'&&(window.location?.pathname==='/'||window.matchMedia('${THEME_QUERY}').matches));document.documentElement.classList.toggle('dark',d)})();`;
