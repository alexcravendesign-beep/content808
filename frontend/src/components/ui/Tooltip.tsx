import * as React from "react";
import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}

export function Tooltip({ content, children, side = "right", delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const offset = 8;
        let top = 0, left = 0;
        switch (side) {
          case "right":
            top = rect.top + rect.height / 2;
            left = rect.right + offset;
            break;
          case "left":
            top = rect.top + rect.height / 2;
            left = rect.left - offset;
            break;
          case "top":
            top = rect.top - offset;
            left = rect.left + rect.width / 2;
            break;
          case "bottom":
            top = rect.bottom + offset;
            left = rect.left + rect.width / 2;
            break;
        }
        setCoords({ top, left });
      }
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const transformOrigin =
    side === "right" ? "left center" :
    side === "left" ? "right center" :
    side === "top" ? "bottom center" : "top center";

  const translateClass =
    side === "right" || side === "left" ? "-translate-y-1/2" :
    "-translate-x-1/2";

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>
      {visible && (
        <div
          className={`fixed z-[100] px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg animate-scaleIn whitespace-nowrap ${translateClass}`}
          style={{ top: coords.top, left: coords.left, transformOrigin }}
        >
          {content}
        </div>
      )}
    </>
  );
}
