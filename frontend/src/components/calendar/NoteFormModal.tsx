import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api, CalendarNote } from "@/api/client";
import { useToast } from "@/components/ui/toast";
import { StickyNote, Lock, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const NOTE_COLORS = [
  { value: null, label: "Default", class: "bg-[hsl(var(--th-surface))]" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500/20" },
  { value: "blue", label: "Blue", class: "bg-blue-500/20" },
  { value: "green", label: "Green", class: "bg-emerald-500/20" },
  { value: "pink", label: "Pink", class: "bg-pink-500/20" },
  { value: "purple", label: "Purple", class: "bg-purple-500/20" },
  { value: "orange", label: "Orange", class: "bg-orange-500/20" },
];

interface NoteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  note?: CalendarNote | null;
  defaultDate?: Date | null;
  onConvertToItem?: (note: CalendarNote) => void;
}

export function NoteFormModal({ open, onClose, onSaved, note, defaultDate, onConvertToItem }: NoteFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: "",
    note: "",
    color: null as string | null,
    visibility: "team" as "private" | "team",
  });

  useEffect(() => {
    if (note) {
      setForm({
        date: note.date,
        note: note.note,
        color: note.color,
        visibility: note.visibility,
      });
    } else {
      setForm({
        date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        note: "",
        color: null,
        visibility: "team",
      });
    }
  }, [note, defaultDate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.note.trim()) {
      toast("Note text is required", "error");
      return;
    }
    setLoading(true);
    try {
      if (note) {
        await api.updateCalendarNote(note.id, {
          note: form.note,
          color: form.color || "",
          visibility: form.visibility,
          date: form.date,
        });
        toast("Note updated", "success");
      } else {
        await api.createCalendarNote({
          date: form.date,
          note: form.note,
          color: form.color || undefined,
          visibility: form.visibility,
        });
        toast("Note created", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save note", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-400" />
              {note ? "Edit Note" : "New Note"}
            </span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
            />
          </div>

          {/* Note text */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Write your note..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow resize-none"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Color Tag</label>
            <div className="flex gap-2 flex-wrap">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value || "default"}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color: c.value }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${c.class} ${
                    form.color === c.value
                      ? "border-indigo-500 scale-110"
                      : "border-transparent hover:border-[hsl(var(--th-border))]"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, visibility: "team" }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  form.visibility === "team"
                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                    : "bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] border border-[hsl(var(--th-border))] hover:bg-[hsl(var(--th-surface-hover))]"
                }`}
              >
                <Users className="h-3 w-3" />
                Team
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, visibility: "private" }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  form.visibility === "private"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] border border-[hsl(var(--th-border))] hover:bg-[hsl(var(--th-surface-hover))]"
                }`}
              >
                <Lock className="h-3 w-3" />
                Only Me
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {/* Convert to item (only for existing notes) */}
            {note && onConvertToItem && (
              <button
                type="button"
                onClick={() => onConvertToItem(note)}
                className="flex items-center gap-1.5 text-xs text-[hsl(var(--th-text-muted))] hover:text-indigo-400 transition-colors"
              >
                <ArrowRight className="h-3 w-3" />
                Convert to Content Item
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-medium hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {loading ? "Saving..." : note ? "Update" : "Add Note"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Color utility to get the background class for a note color */
export function noteColorClass(color: string | null): string {
  switch (color) {
    case "yellow": return "bg-yellow-500/10 border-yellow-500/25";
    case "blue": return "bg-blue-500/10 border-blue-500/25";
    case "green": return "bg-emerald-500/10 border-emerald-500/25";
    case "pink": return "bg-pink-500/10 border-pink-500/25";
    case "purple": return "bg-purple-500/10 border-purple-500/25";
    case "orange": return "bg-orange-500/10 border-orange-500/25";
    default: return "bg-amber-500/[0.06] border-amber-500/20";
  }
}
