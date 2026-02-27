import { createContext, useContext, useEffect, useState } from "react";
import { Sun, Moon, Monitor, Heart } from "lucide-react";

type Theme = "light" | "dark" | "system" | "girly";

interface ThemeContextType {
    theme: Theme;
    resolved: "light" | "dark" | "girly";
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "dark",
    resolved: "dark",
    setTheme: () => { },
});

export function useTheme() {
    return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" | "girly" {
    return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem("theme") as Theme | null;
        return saved && ["light", "dark", "system", "girly"].includes(saved) ? saved : "system";
    });
    const [, forceUpdate] = useState(0);

    const resolved = resolveTheme(theme);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem("theme", t);
    };

    // Apply class to <html>
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("dark", "girly");
        if (resolved === "dark") root.classList.add("dark");
        if (resolved === "girly") root.classList.add("girly");
    }, [resolved]);

    // Listen for OS theme changes when in "system" mode
    useEffect(() => {
        if (theme !== "system") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => forceUpdate(n => n + 1);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

/* ── Toggle button for sidebar ── */
const CYCLE: Theme[] = ["dark", "light", "girly", "system"];
const ICONS: Record<Theme, React.ElementType> = { light: Sun, dark: Moon, girly: Heart, system: Monitor };
const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", girly: "Girly", system: "System" };

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
    const { theme, setTheme } = useTheme();
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    const Icon = ICONS[theme];

    return (
        <button
            onClick={() => setTheme(next)}
            className={`w-full flex items-center gap-2 rounded-md py-1.5 text-xs transition-colors
        text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-surface-hover))]
        ${collapsed ? "justify-center px-0" : "px-2"}`}
            title={`Theme: ${LABELS[theme]} → ${LABELS[next]}`}
        >
            <Icon className="h-4 w-4" />
            {!collapsed && <span className="animate-fadeIn">{LABELS[theme]} mode</span>}
        </button>
    );
}
