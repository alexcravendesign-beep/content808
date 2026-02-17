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
  Package, Sparkles, Wrench, ChevronDown
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

  if (loading) return <div className="flex items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">Loading...</div>;
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
            {item.campaign_goal && <p className="text-sm text-[hsl(var(--th-text-secondary))] mb-3">{item.campaign_goal}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {item.direction && (
          <div className="mb-3">
            <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Direction</label>
            <p className="text-sm text-[hsl(var(--th-text-secondary))]">{item.direction}</p>
          </div>
        )}
        {item.pivot_notes && (
          <div className="mb-3">
            <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-1 block">Pivot Notes</label>
            <p className="text-sm text-[hsl(var(--th-text-secondary))]">{item.pivot_notes}</p>
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
              {outputs.map((o) => (
                <div key={o.id} className="bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{o.output_type}</Badge>
                    <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{format(new Date(o.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <pre className="text-xs text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap overflow-hidden">{JSON.stringify(o.output_data, null, 2)}</pre>
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

/* ── Product Details Panel ── */

function ProductPanel({ product }: { product: Product }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    features: true, marketing: false, specs: false,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
      <h2 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" /> Product Details
      </h2>

      <div className="flex items-start gap-4 mb-4">
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

      {/* Collapsible sections */}
      {(product.features || []).length > 0 && (
        <CollapsibleSection
          title="Features"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          open={openSections.features}
          onToggle={() => toggle("features")}
        >
          <ul className="space-y-1">
            {(product.features || []).map((f, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {(product.marketing_angles || []).length > 0 && (
        <CollapsibleSection
          title="Marketing Angles"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          open={openSections.marketing}
          onToggle={() => toggle("marketing")}
        >
          <ul className="space-y-1">
            {(product.marketing_angles || []).map((a, i) => (
              <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {(product.technical_specs || []).length > 0 && (
        <CollapsibleSection
          title="Technical Specs"
          icon={<Wrench className="h-3.5 w-3.5" />}
          open={openSections.specs}
          onToggle={() => toggle("specs")}
        >
          <div className="space-y-3">
            {(product.technical_specs || []).map((spec, i) => (
              <div key={i}>
                <div className="text-sm font-medium text-[hsl(var(--th-text))] mb-1">{spec.name}</div>
                <ul className="space-y-0.5 pl-3">
                  {(spec.terms || []).map((term, j) => (
                    <li key={j} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {term}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function CollapsibleSection({
  title, icon, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[hsl(var(--th-border)/0.5)] pt-3 mt-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-xs font-semibold text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] transition-colors"
      >
        {icon}
        <span className="uppercase tracking-wider">{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
