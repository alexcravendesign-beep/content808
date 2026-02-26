import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, ContentItem } from "@/api/client";
import { campaignGoalLabel } from "@/lib/formatHelpers";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CheckCircle, XCircle, Clock, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ListSkeleton } from "@/components/Skeletons";

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockModal, setBlockModal] = useState<{ open: boolean; item: ContentItem | null }>({ open: false, item: null });
  const [blockReason, setBlockReason] = useState("");

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await api.getApprovals();
      setItems(data.items);
    } catch {
      toast("Failed to load approvals", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveItem(id);
      toast("Item approved", "success");
      fetchApprovals();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Approval failed", "error");
    }
  };

  const handleBlock = async () => {
    if (!blockModal.item || !blockReason.trim()) {
      toast("Reason is required", "error");
      return;
    }
    try {
      await api.blockItem(blockModal.item.id, blockReason);
      toast("Item blocked", "success");
      setBlockModal({ open: false, item: null });
      setBlockReason("");
      fetchApprovals();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Block failed", "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Approvals Queue</h1>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">{items.length} items awaiting review</p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">
          <CheckCircle className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm">No items awaiting approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-4 hover:border-[hsl(var(--th-text-muted)/0.5)] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/item/${item.id}`)}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="text-sm font-semibold text-[hsl(var(--th-text))]">{item.brand}</h3>
                    {item.platform && <Badge variant="secondary" className="text-[10px]">{item.platform}</Badge>}
                  </div>
                  {item.product_title && (
                    <p className="text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">
                      Product: <span className="text-[hsl(var(--th-text))]">{item.product_title}</span>
                    </p>
                  )}
                  {item.campaign_goal && <p className="text-xs text-[hsl(var(--th-text-secondary))] mb-2">{campaignGoalLabel(item.campaign_goal)}</p>}
                  <div className="flex items-center gap-4 text-[11px] text-[hsl(var(--th-text-muted))]">
                    {item.assignee && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{item.assignee}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Updated {format(new Date(item.updated_at), "MMM d, h:mm a")}
                    </span>
                    {item.product_url && (
                      <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[hsl(var(--th-text-secondary))]" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />Link
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => { setBlockModal({ open: true, item }); setBlockReason(""); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Block
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={blockModal.open} onOpenChange={(o) => !o && setBlockModal({ open: false, item: null })}>
        <DialogContent>
          <DialogClose onClick={() => setBlockModal({ open: false, item: null })} />
          <DialogHeader>
            <DialogTitle>Block: {blockModal.item?.brand}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Reason *</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Why is this being blocked?"
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBlockModal({ open: false, item: null })} className="px-4 py-2 text-sm rounded-md bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]">Cancel</button>
              <button onClick={handleBlock} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500">Block Item</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
