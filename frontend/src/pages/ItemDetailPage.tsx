import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ContentItem, ContentComment, AuditEntry, ContentItemOutput } from "@/api/client";
import { productApi, Product } from "@/api/productApi";
import { PriceTag } from "@/components/PriceTag";
import { Badge } from "@/components/ui/badge";
import { ItemFormModal } from "@/components/ItemFormModal";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft, Edit, Trash2, ExternalLink, User, Calendar, Send,
  ChevronRight, Clock, FileText, MessageSquare, Activity, Zap,
  Package, Sparkles, Wrench
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { STATUS_BG_SOLID as STATUS_COLORS } from "@/lib/statusConfig";
import { DetailSkeleton } from "@/components/Skeletons";

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
  const [product, setProduct] = useState<Product | null>(null);

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

  // Fetch product details from product API when item has a product title
  useEffect(() => {
    if (!item?.product_title) { setProduct(null); return; }
    productApi.searchProducts({ q: item.product_title, limit: 1 })
      .then((res) => setProduct(res.items[0] || null))
      .catch(() => setProduct(null));
  }, [item?.product_title]);

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

  const handleAgentFill = async () => {
    if (!item) return;
    try {
      await api.agentFill(item.id);
      toast("Agent draft queued — refresh in a moment", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Agent fill failed", "error");
    }
  };

  const handleSyncAssets = async () => {
    if (!item) return;
    try {
      const res = await api.syncProductAssets(item.id);
      toast(`Synced ${res.created} assets from product`, "success");
      fetchItem();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Asset sync failed", "error");
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!item) return <div className="flex items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">Item not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-[hsl(var(--th-text))]">{item.brand}</h1>
              <span className={`${STATUS_COLORS[item.status] || "bg-zinc-600"} text-white text-xs px-2.5 py-0.5 rounded-full font-medium`}>
                {item.status}
              </span>
              {item.platform && <Badge variant="secondary">{item.platform}</Badge>}
            </div>
            {item.campaign_goal && <CampaignGoalDisplay value={item.campaign_goal} />}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.status === "idea" && (
              <button onClick={handleAgentFill} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-gradient-to-r from-indigo-600/20 to-violet-600/20 text-indigo-400 text-xs font-medium hover:from-indigo-600/30 hover:to-violet-600/30 transition-all" title="Generate draft via AI agent">
                <Sparkles className="h-3.5 w-3.5" />Generate Draft
              </button>
            )}
            <button onClick={handleSyncAssets} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-300 text-xs font-medium hover:from-cyan-600/30 hover:to-blue-600/30 transition-all" title="Pull infographic/product images into outputs">
              <Package className="h-3.5 w-3.5" />Sync Product Assets
            </button>
            <button onClick={() => setEditOpen(true)} className="p-2 rounded-md bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors">
              <Edit className="h-4 w-4" />
            </button>
            <button onClick={handleDelete} className="p-2 rounded-md bg-[hsl(var(--th-input))] text-red-400 hover:text-red-300 hover:bg-[hsl(var(--th-surface-hover))] transition-colors">
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

        {item.direction && <DirectionDisplay value={item.direction} />}
        {item.target_audience && (() => {
          const parsed = tryParseJson(item.target_audience);
          const audiences = Array.isArray(parsed) ? parsed : [];
          if (audiences.length === 0) return null;
          return (
            <div className="mb-3">
              <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Target Audience</label>
              <div className="flex flex-wrap gap-1.5">
                {audiences.map((a: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {item.pivot_notes && (
          <div className="mb-3">
            <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Pivot Notes</label>
            <p className="text-sm text-[hsl(var(--th-text-secondary))]">{item.pivot_notes}</p>
          </div>
        )}
        {item.final_copy && (
          <div className="mb-3">
            <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Draft Copy</label>
            <p className="text-sm text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">{item.final_copy}</p>
          </div>
        )}
        {item.product_url && (
          <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
            <ExternalLink className="h-3.5 w-3.5" />Product Link
          </a>
        )}

        {item.valid_transitions && item.valid_transitions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[hsl(var(--th-border))]">
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

      {/* Product Details Panel */}
      {product && <ProductPanel product={product} />}

      <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg">
        <div className="flex border-b border-[hsl(var(--th-border))]">
          {(["comments", "history", "outputs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-[hsl(var(--th-text))] border-b-2 border-indigo-500" : "text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))]"}`}
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
              {comments.length === 0 && <p className="text-sm text-[hsl(var(--th-text-muted))] mb-4">No comments yet.</p>}
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[hsl(var(--th-text-secondary))]">{c.user_name || c.user_id}</span>
                      <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-[hsl(var(--th-text-secondary))]">{c.body}</p>
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
                  className="flex-1 h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
                />
                <button onClick={handleAddComment} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {history.length === 0 && <p className="text-sm text-[hsl(var(--th-text-muted))]">No activity yet.</p>}
              {history.map((h) => {
                const Icon = ACTION_ICONS[h.action] || Activity;
                return (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-[hsl(var(--th-input))] flex items-center justify-center shrink-0">
                      <Icon className="h-3 w-3 text-[hsl(var(--th-text-secondary))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[hsl(var(--th-text-secondary))]">{h.actor}</span>
                        <span className="text-xs text-[hsl(var(--th-text-muted))]">{h.action}</span>
                        {h.details && (h.details as Record<string, unknown>).from ? (
                          <span className="text-xs text-[hsl(var(--th-text-muted))]">
                            {String((h.details as Record<string, unknown>).from)} → {String((h.details as Record<string, unknown>).to)}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{format(new Date(h.created_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "outputs" && (
            <div className="space-y-3">
              {outputs.length === 0 && <p className="text-sm text-[hsl(var(--th-text-muted))]">No outputs yet.</p>}
              {outputs.map((o) => {
                const outputUrl = typeof o.output_data?.url === 'string'
                  ? o.output_data.url
                  : (typeof o.output_data?.image_url === 'string' ? o.output_data.image_url : null);

                return (
                  <div key={o.id} className="bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{o.output_type}</Badge>
                      {o.created_by && <span className="text-[11px] text-[hsl(var(--th-text-muted))] italic">{o.created_by}</span>}
                      <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{format(new Date(o.created_at), "MMM d, h:mm a")}</span>
                    </div>

                    {outputUrl ? (
                      <div className="space-y-2">
                        <a href={outputUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 break-all">
                          {outputUrl}
                        </a>
                        <img
                          src={outputUrl}
                          alt={`${o.output_type} preview`}
                          className="w-full max-w-sm rounded-md border border-[hsl(var(--th-border))] object-cover"
                          loading="lazy"
                        />
                        {typeof o.output_data?.prompt === 'string' && (
                          <details className="text-xs text-[hsl(var(--th-text-muted))]">
                            <summary className="cursor-pointer">Show prompt</summary>
                            <pre className="mt-2 whitespace-pre-wrap">{o.output_data.prompt}</pre>
                          </details>
                        )}
                      </div>
                    ) : o.output_type === "draft_copy" && typeof o.output_data.text === "string" ? (
                      <p className="text-sm text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap">{o.output_data.text}</p>
                    ) : o.output_type === "metadata" && Array.isArray(o.output_data.hashtags) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(o.output_data.hashtags as string[]).map((tag, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">{tag}</span>
                        ))}
                      </div>
                    ) : o.output_type === "asset_prompt_suggestions" && Array.isArray(o.output_data.prompts) ? (
                      <ul className="space-y-1.5 pl-1">
                        {(o.output_data.prompts as string[]).map((p, i) => (
                          <li key={i} className="text-xs text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />{p}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="text-xs text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap overflow-hidden">{JSON.stringify(o.output_data, null, 2)}</pre>
                    )}
                  </div>
                );
              })}
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
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Reason (optional)</label>
              <textarea
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                placeholder="Why are you making this transition?"
                rows={2}
                className="w-full px-3 py-2 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTransitionModal({ open: false, to: "" })} className="px-4 py-2 text-sm rounded-md bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]">Cancel</button>
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
      <div className="flex items-center gap-1 text-[11px] text-[hsl(var(--th-text-muted))] mb-0.5">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="text-sm text-[hsl(var(--th-text-secondary))]">{value}</div>
    </div>
  );
}

/** Try to parse a value that may be a JSON string, an object, or a plain string */
function tryParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
    }
  }
  return value;
}

/** Display campaign_goal — handles old string, JSON string, and object formats */
function CampaignGoalDisplay({ value }: { value: string | Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!value) return null;

  // Try to parse JSON strings into objects
  const parsed = tryParseJson(value);

  // Plain text string (old format or unparseable)
  if (typeof parsed === 'string') {
    // Skip displaying "[object Object]" — this is corrupted data
    if (parsed === '[object Object]') return null;
    return <p className="text-sm text-[hsl(var(--th-text-secondary))] mb-3">{parsed}</p>;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  // New format: { title, content } object
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title : "";
  const content = typeof obj.content === "string" ? obj.content : "";

  if (!title && !content) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] transition-colors flex items-center gap-1"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span className="font-medium">{title}</span>
      </button>
      {expanded && content && (
        <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1 ml-5">{content}</p>
      )}
    </div>
  );
}

/** Display direction — handles old string, JSON string, and object formats */
function DirectionDisplay({ value }: { value: string | Record<string, unknown> | null }) {
  if (!value) return null;

  // Try to parse JSON strings into objects
  const parsed = tryParseJson(value);

  // Plain text string (old format or unparseable)
  if (typeof parsed === 'string') {
    // Skip displaying "[object Object]" — this is corrupted data
    if (parsed === '[object Object]') return null;
    return (
      <div className="mb-3">
        <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Direction</label>
        <p className="text-sm text-[hsl(var(--th-text-secondary))]">{parsed}</p>
      </div>
    );
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  // New format: { benefits: string[], pain_points: string[] }
  const obj = parsed as Record<string, unknown>;
  const benefits = Array.isArray(obj.benefits) ? (obj.benefits as string[]) : [];
  const painPoints = Array.isArray(obj.pain_points) ? (obj.pain_points as string[]) : [];

  if (benefits.length === 0 && painPoints.length === 0) return null;

  return (
    <div className="mb-3">
      <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Direction</label>
      <div className="space-y-2">
        {benefits.length > 0 && (
          <div>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Benefits</span>
            <ul className="mt-1 space-y-0.5">
              {benefits.map((b, i) => (
                <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
        {painPoints.length > 0 && (
          <div>
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Pain Points</span>
            <ul className="mt-1 space-y-0.5">
              {painPoints.map((p, i) => (
                <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Product Details Panel ── */

function ProductPanel({ product }: { product: Product }) {
  return (
    <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
      <h2 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" /> Product Details
      </h2>

      <div className="flex items-start gap-4 mb-6">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-20 w-20 rounded-xl object-cover border border-[hsl(var(--th-border))]"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-indigo-600/30 to-violet-600/30 flex items-center justify-center border border-indigo-500/20">
            <Package className="h-8 w-8 text-indigo-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-1">{product.name}</h3>
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--th-text-secondary))] mb-2">
            <span>{product.brand}</span>
            {product.category && (
              <>
                <span className="text-[hsl(var(--th-text-muted))]">·</span>
                <span>{product.category}</span>
              </>
            )}
          </div>
          <PriceTag product={product} size="md" />
        </div>
        {product.source_url && (
          <a
            href={product.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Source
          </a>
        )}
      </div>

      {/* USP */}
      {product.usp && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Unique Selling Point
          </h3>
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{product.usp}</p>
        </div>
      )}

      {/* Description */}
      {product.description && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Description
          </h3>
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{product.description}</p>
        </div>
      )}

      {/* Visual Style */}
      {product.visual_style && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Visual Style
          </h3>
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{product.visual_style}</p>
        </div>
      )}

      {/* Features */}
      {(product.features || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Features
          </h3>
          <ul className="space-y-1">
            {(product.features || []).map((f, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Benefits */}
      {(product.benefits || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Benefits
          </h3>
          <ul className="space-y-1">
            {(product.benefits || []).map((b, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pain Points */}
      {(product.pain_points || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Pain Points
          </h3>
          <ul className="space-y-1">
            {(product.pain_points || []).map((p, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Target Audience */}
      {(product.target_audience || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Target Audience
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(product.target_audience || []).map((a, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Competitors */}
      {(product.competitors || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Competitors
          </h3>
          <ul className="space-y-1">
            {(product.competitors || []).map((c, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annual Energy Consumption */}
      {product.annual_energy_consumption && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Annual Energy Consumption
          </h3>
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{product.annual_energy_consumption} kWh</p>
        </div>
      )}

      {/* Marketing Angles */}
      {(product.marketing_angles || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Marketing Angles
          </h3>
          <ul className="space-y-3">
            {(product.marketing_angles || []).map((a, i) => {
              if (typeof a === "string") {
                return (
                  <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                    {a}
                  </li>
                );
              }
              return (
                <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  <span>
                    {a.title && <span className="font-medium text-[hsl(var(--th-text))]">{a.title}: </span>}
                    {a.content}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Technical Specs */}
      {(product.technical_specs || []).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Technical Specs
          </h3>
          <div className="space-y-4">
            {(product.technical_specs || []).map((spec, i) => {
              if (typeof spec === 'string') {
                return (
                  <div key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {spec}
                  </div>
                );
              }

              const items: string[] = Array.isArray(spec.terms) && spec.terms.length > 0
                ? spec.terms
                : spec.value
                  ? [spec.value]
                  : [];

              if (items.length === 0) return null;

              return (
                <div key={i}>
                  <div className="text-sm font-medium text-[hsl(var(--th-text))] mb-1">{spec.name}</div>
                  <ul className="space-y-0.5 pl-3">
                    {items.map((term, j) => (
                      <li key={j} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        {term}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
