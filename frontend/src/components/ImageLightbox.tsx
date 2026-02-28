import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  /** Optional label shown below the image */
  label?: string;
}

export function ImageLightbox({ src, alt = "Image preview", open, onClose, label }: ImageLightboxProps) {
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Reset state when lightbox opens/closes
  useEffect(() => {
    if (open) {
      resetView();
      setCopied(false);
    }
  }, [open, resetView]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      if (e.key === "0") resetView();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, resetView]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create a temporary input
      const input = document.createElement("input");
      input.value = src;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src, { mode: "cors" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from URL or use a default
      const urlParts = src.split("/");
      const filename = urlParts[urlParts.length - 1]?.split("?")[0] || "image.png";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab for manual save
      window.open(src, "_blank");
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom in (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-xs text-white/60 px-1.5 min-w-[3rem] text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button
          onClick={resetView}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Reset zoom (0)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button
          onClick={handleCopyUrl}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Copy image URL"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Download image"
        >
          <Download className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image container — no onContextMenu prevention so right-click works natively */}
      <div
        className="relative z-[101] flex items-center justify-center w-full h-full p-16 pt-20"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => { if (e.target === e.currentTarget && !dragging) onClose(); }}
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none rounded-lg shadow-2xl transition-transform duration-150"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>

      {/* Label */}
      {label && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[101] px-4 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
          <p className="text-sm text-white/80 text-center">{label}</p>
        </div>
      )}
    </div>
  );
}
