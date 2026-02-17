import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ContentItem, ContentComment, AuditEntry, ContentItemOutput } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { ItemFormModal } from "@/components/ItemFormModal";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft, Edit, Trash2, ExternalLink, User, Calendar, Send,
  ChevronRight, Clock, FileText, MessageSquare, Activity, Zap
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-indigo-500", draft: "bg-violet-500", review: "bg-amber-500",
  approved: "bg-emerald-500", blocked: "bg-red-500", scheduled: "bg-blue-500", published: "bg-cyan-500",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  create: FileText, update: Edit, transition: ChevronRight,
  approve: Zap, block: Trash2, comment: MessageSquare,
};

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<(ContentItem & { valid_transitions?: string[] }) | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [outputs, setOutputs] = useState<ContentItemOutput[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<"comments" | "history" | "outputs">("comments");
  const [transitionModal, setTransitionModal] = useState<{ open: boolean; to: string }>({ open: false, to: "" });
  const [transitionReason, setTransitionReason] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      const [itemData, commentsData, historyData, outputsData] = await Promise.all([
        api.getItem(id),
        api.getComments(id),
        api.getHistory(id),
        api.getOutputs(id),
      ]);
      setItem(itemData);
      setComments(commentsData.comments);
      setHistory(historyData.history);
      setOutputs(outputsData.outputs);
    } catch {
      toast("Failed to load item", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  const handleTransition = async () => {
    if (!item || !transitionModal.to) return;
    try {
      await api.transitionItem(item.id, transitionModal.to, transitionReason);
      toast(`Transitioned to ${transitionModal.to}`, "success");
      setTransitionModal({ open: false, to: "" });
      setTransitionReason("");
      fetchItem();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Transition failed", "error");
    }
  };

  const handleAddComment = async () => {
    if (!item || !newComment.trim()) return;
    try {
      await api.addComment(item.id, newComment);
      setNewComment("");
      toast("Comment added", "success");
      fetchItem();
    } catch {
      toast("Failed to add comment", "error");
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm("Delete this item permanently?")) return;
    try {
      await api.deleteItem(item.id);
      toast("Item deleted", "success");
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>;
  if (!item) return <div className="flex items-center justify-center h-64 text-zinc-500">Item not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-zinc-100">{item.brand}</h1>
              <span className={`${STATUS_COLORS[item.status] || "bg-zinc-600"} text-white text-xs px-2.5 py-0.5 rounded-full font-medium`}>
                {item.status}
              </span>
              {item.platform && <Badge variant="secondary">{item.platform}</Badge>}
            </div>
            {item.campaign_goal && <p className="text-sm text-zinc-400 mb-3">{item.campaign_goal}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
              <Edit className="h-4 w-4" />
            </button>
            <button onClick={handleDelete} className="p-2 rounded-md bg-zinc-800 text-red-400 hover:text-red-300 hover:bg-zinc-700 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <InfoField icon={User} label="Assignee" value={item.assignee || "Unassigned"} />
          <InfoField icon={Calendar} label="Due Date" value={item.due_date ? format(new Date(item.due_date), "MMM d, yyyy") : "Not set"} />
          <InfoField icon={Calendar} label="Publish Date" value={item.publish_date ? format(new Date(item.publish_date), "MMM d, yyyy h:mm a") : "Not set"} />
          <InfoField icon={Clock} label="Updated" value={format(new Date(item.updated_at), "MMM d, h:mm a")} />
        </div>

        {item.direction && (
          <div className="mb-3">
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Direction</label>
            <p className="text-sm text-zinc-300">{item.direction}</p>
          </div>
        )}
        {item.pivot_notes && (
          <div className="mb-3">
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Pivot Notes</label>
            <p className="text-sm text-zinc-300">{item.pivot_notes}</p>
          </div>
        )}
        {item.product_url && (
          <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
            <ExternalLink className="h-3.5 w-3.5" />Product Link
          </a>
        )}

        {item.valid_transitions && item.valid_transitions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <label className="text-xs font-medium text-zinc-500 mb-2 block">Transition to</label>
            <div className="flex flex-wrap gap-2">
              {item.valid_transitions.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTransitionModal({ open: true, to: t }); setTransitionReason(""); }}
                  className={`${STATUS_COLORS[t] || "bg-zinc-600"} text-white text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80 transition-opacity capitalize`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg">
        <div className="flex border-b border-zinc-800">
          {(["comments", "history", "outputs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-zinc-100 border-b-2 border-indigo-500" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {t === "comments" && <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />}
              {t === "history" && <Activity className="h-3.5 w-3.5 inline mr-1.5" />}
              {t === "outputs" && <FileText className="h-3.5 w-3.5 inline mr-1.5" />}
              {t} ({t === "comments" ? comments.length : t === "history" ? history.length : outputs.length})
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "comments" && (
            <div>
              {comments.length === 0 && <p className="text-sm text-zinc-500 mb-4">No comments yet.</p>}
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-zinc-300">{c.user_name || c.user_id}</span>
                      <span className="text-[11px] text-zinc-600">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  className="flex-1 h-9 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
                <button onClick={handleAddComment} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {history.length === 0 && <p className="text-sm text-zinc-500">No activity yet.</p>}
              {history.map((h) => {
                const Icon = ACTION_ICONS[h.action] || Activity;
                return (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <Icon className="h-3 w-3 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300">{h.actor}</span>
                        <span className="text-xs text-zinc-500">{h.action}</span>
                        {h.details && (h.details as Record<string, unknown>).from ? (
                          <span className="text-xs text-zinc-500">
                            {String((h.details as Record<string, unknown>).from)} → {String((h.details as Record<string, unknown>).to)}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-zinc-600">{format(new Date(h.created_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "outputs" && (
            <div className="space-y-3">
              {outputs.length === 0 && <p className="text-sm text-zinc-500">No outputs yet.</p>}
              {outputs.map((o) => (
                <div key={o.id} className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{o.output_type}</Badge>
                    <span className="text-[11px] text-zinc-600">{format(new Date(o.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap overflow-hidden">{JSON.stringify(o.output_data, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ItemFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={fetchItem} item={item} />

      <Dialog open={transitionModal.open} onOpenChange={(o) => !o && setTransitionModal({ open: false, to: "" })}>
        <DialogContent>
          <DialogClose onClick={() => setTransitionModal({ open: false, to: "" })} />
          <DialogHeader>
            <DialogTitle>Transition to {transitionModal.to}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Reason (optional)</label>
              <textarea
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                placeholder="Why are you making this transition?"
                rows={2}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTransitionModal({ open: false, to: "" })} className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={handleTransition} className={`px-4 py-2 text-sm rounded-md text-white hover:opacity-80 ${STATUS_COLORS[transitionModal.to] || "bg-indigo-600"}`}>
                Confirm
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-zinc-500 mb-0.5">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="text-sm text-zinc-300">{value}</div>
    </div>
  );
}
