import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ContentItem, ContentItemOutput } from "@/api/client";
import { productApi, Product, MockFacebookPostRecord, PostComment } from "@/api/productApi";
// FacebookPostCard replaced by inline review panel
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft, ChevronRight, FileText, ExternalLink,
  Activity, Sparkles, User, Trash2, Copy, Check,
  ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle,
  MessageSquare, Send, RotateCcw, Image, ChevronDown, ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { STATUS_BG_SOLID as STATUS_COLORS } from "@/lib/statusConfig";
import { DetailSkeleton } from "@/components/Skeletons";

/** Try to parse a value that may be a JSON string, an object, or a plain string */
function tryParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
    }
  }
  return value;
}

export function ContentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [outputs, setOutputs] = useState<ContentItemOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [facebookPosts, setFacebookPosts] = useState<MockFacebookPostRecord[]>([]);
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [itemData, outputsData] = await Promise.all([
        api.getItem(id),
        api.getOutputs(id),
      ]);
      setItem(itemData);
      setOutputs(outputsData.outputs);
    } catch {
      toast("Failed to load content", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch product details
  useEffect(() => {
    if (!item?.product_title) { setProduct(null); return; }
    productApi.searchProducts({ q: item.product_title, limit: 1 })
      .then((res) => setProduct(res.items[0] || null))
      .catch(() => setProduct(null));
  }, [item?.product_title]);

  const [approvingPostId, setApprovingPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Fetch ALL posts linked to this product (pending, approved, rejected)
  const fetchPosts = useCallback(() => {
    if (!product?.id) { setFacebookPosts([]); return; }
    productApi.getAllPostsForProduct(product.id)
      .then((posts) => setFacebookPosts(posts))
      .catch(() => setFacebookPosts([]));
  }, [product?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleApproval = async (postId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      setApprovingPostId(postId);
      await productApi.updatePostApproval(postId, status);
      toast(`Post ${status === 'pending' ? 'sent back to queue' : status}`, 'success');
      fetchPosts();
    } catch (err) {
      toast(err instanceof Error ? err.message : `Failed to update post`, 'error');
    } finally {
      setApprovingPostId(null);
    }
  };

  const toggleComments = async (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      // Fetch comments if not already loaded
      if (!postComments[postId]) {
        try {
          const comments = await productApi.getPostComments(postId);
          setPostComments((prev) => ({ ...prev, [postId]: comments }));
        } catch {
          setPostComments((prev) => ({ ...prev, [postId]: [] }));
        }
      }
    }
    setExpandedComments(next);
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      setSubmittingComment(postId);
      const newComment = await productApi.addPostComment(postId, text);
      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add comment', 'error');
    } finally {
      setSubmittingComment(null);
    }
  };

  const visibleOutputs = outputs.filter((o) => !String(o.output_type || "").startsWith("product_"));

  const handleDeleteOutput = async (outputId: string) => {
    if (!item) return;
    if (!confirm('Delete this output?')) return;
    try {
      setDeletingOutputId(outputId);
      await api.deleteOutput(item.id, outputId);
      toast('Output deleted', 'success');
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete output', 'error');
    } finally {
      setDeletingOutputId(null);
    }
  };

  const handleCopyUrl = async (outputId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrlId(outputId);
      setTimeout(() => setCopiedUrlId((prev) => (prev === outputId ? null : prev)), 1200);
    } catch {
      toast('Failed to copy URL', 'error');
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!item) return <div className="flex items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">Item not found</div>;

  // Parse content fields
  const campaignGoalRaw = tryParseJson(item.campaign_goal);
  const directionRaw = tryParseJson(item.direction);
  const audiences = (() => {
    const parsed = tryParseJson(item.target_audience);
    return Array.isArray(parsed) ? parsed : [];
  })();

  // Campaign goal: extract title/content if object
  const campaignGoalObj = typeof campaignGoalRaw === "object" && campaignGoalRaw !== null ? campaignGoalRaw as Record<string, unknown> : null;
  const campaignGoalTitle = campaignGoalObj && typeof campaignGoalObj.title === "string" ? campaignGoalObj.title : "";
  const campaignGoalContent = campaignGoalObj && typeof campaignGoalObj.content === "string" ? campaignGoalObj.content : "";
  const campaignGoalStr = typeof campaignGoalRaw === "string" && campaignGoalRaw !== "[object Object]" ? campaignGoalRaw : "";

  // Direction: extract benefits/pain_points if object
  const directionObj = typeof directionRaw === "object" && directionRaw !== null ? directionRaw as Record<string, unknown> : null;
  const benefits = directionObj && Array.isArray(directionObj.benefits) ? (directionObj.benefits as string[]) : [];
  const painPoints = directionObj && Array.isArray(directionObj.pain_points) ? (directionObj.pain_points as string[]) : [];
  const directionStr = typeof directionRaw === "string" && directionRaw !== "[object Object]" ? directionRaw : "";

  // Separate image outputs from other outputs
  const imageOutputs = visibleOutputs.filter(
    (o) => ["hero_image", "infographic_image", "post_image", "product_image"].includes(o.output_type) && (o.output_data?.url || o.output_data?.image_url)
  );
  const otherOutputs = visibleOutputs.filter(
    (o) => !imageOutputs.includes(o)
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--th-text-secondary))] mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-[hsl(var(--th-text))] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link to={`/item/${item.id}`} className="hover:text-[hsl(var(--th-text))] transition-colors">
          {item.brand}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--th-text-muted))]" />
        <span className="text-[hsl(var(--th-text))] font-medium">Content</span>
      </div>

      {/* Header */}
      <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-bold text-[hsl(var(--th-text))]">{item.brand} &mdash; Content</h1>
          <span className={`${STATUS_COLORS[item.status] || "bg-zinc-600"} text-white text-xs px-2.5 py-0.5 rounded-full font-medium`}>
            {item.status}
          </span>
          {item.platform && <Badge variant="secondary">{item.platform}</Badge>}
        </div>
        {item.product_url && (
          <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mt-1">
            <ExternalLink className="h-3.5 w-3.5" />Product Link
          </a>
        )}
      </div>

      {/* Campaign Goal (object format) */}
      {(campaignGoalTitle || campaignGoalContent) && (
        <ContentSection title="Campaign Goal" icon={Sparkles} color="indigo">
          <div>
            {campaignGoalTitle && <p className="text-sm font-medium text-[hsl(var(--th-text))] mb-1">{campaignGoalTitle}</p>}
            {campaignGoalContent && <p className="text-sm text-[hsl(var(--th-text-secondary))]">{campaignGoalContent}</p>}
          </div>
        </ContentSection>
      )}
      {/* Campaign Goal (plain string format) */}
      {campaignGoalStr && !campaignGoalTitle && !campaignGoalContent && (
        <ContentSection title="Campaign Goal" icon={Sparkles} color="indigo">
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{campaignGoalStr}</p>
        </ContentSection>
      )}

      {/* Direction (plain string) */}
      {directionStr && (
        <ContentSection title="Direction" icon={Activity} color="emerald">
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{directionStr}</p>
        </ContentSection>
      )}
      {(benefits.length > 0 || painPoints.length > 0) && (
        <ContentSection title="Direction" icon={Activity} color="emerald">
          <div className="space-y-3">
            {benefits.length > 0 && (
              <div>
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Benefits</span>
                <ul className="mt-1 space-y-0.5">
                  {benefits.map((b, i) => (
                    <li key={i} className="text-sm text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />{b}
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
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ContentSection>
      )}

      {/* Target Audience */}
      {audiences.length > 0 && (
        <ContentSection title="Target Audience" icon={User} color="cyan">
          <div className="flex flex-wrap gap-1.5">
            {audiences.map((a: string, i: number) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">{a}</span>
            ))}
          </div>
        </ContentSection>
      )}

      {/* Pivot Notes */}
      {item.pivot_notes && (
        <ContentSection title="Pivot Notes" icon={FileText} color="amber">
          <p className="text-sm text-[hsl(var(--th-text-secondary))]">{item.pivot_notes}</p>
        </ContentSection>
      )}

      {/* Draft Copy */}
      {item.final_copy && (
        <ContentSection title="Draft Copy" icon={FileText} color="violet">
          <p className="text-sm text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">
            {item.final_copy}
          </p>
        </ContentSection>
      )}

      {/* Outputs */}
      <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg mb-4">
        <div className="px-6 py-4 border-b border-[hsl(var(--th-border))]">
          <h2 className="text-xs font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Outputs ({visibleOutputs.length})
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {/* Post Review Section — 3-column compact grid */}
          {product && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Post Review {facebookPosts.length > 0 && `(${facebookPosts.length})`}
              </h3>
              {facebookPosts.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {facebookPosts.map((post) => {
                      const isPending = post.approval_status === 'pending';
                      const isApproved = post.approval_status === 'approved';
                      const isRejected = post.approval_status === 'rejected';
                      const isExpanded = expandedPostId === post.id;
                      return (
                        <div key={post.id} className="bg-[hsl(var(--th-input)/0.5)] rounded-lg border border-[hsl(var(--th-border))] flex flex-col overflow-hidden">
                          {/* Thumbnail */}
                          {post.image ? (
                            <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--th-surface))]">
                              <img
                                src={post.image}
                                alt="Post image"
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              {/* Status badge overlay */}
                              <div className="absolute top-2 right-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm ${
                                  isApproved ? 'bg-emerald-500/30 text-emerald-200' :
                                  isRejected ? 'bg-red-500/30 text-red-200' :
                                  'bg-amber-500/30 text-amber-200'
                                }`}>
                                  {isApproved ? <CheckCircle className="h-2.5 w-2.5" /> :
                                   isRejected ? <XCircle className="h-2.5 w-2.5" /> :
                                   <Clock className="h-2.5 w-2.5" />}
                                  {post.approval_status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--th-surface))] flex items-center justify-center">
                              <FileText className="h-8 w-8 text-[hsl(var(--th-text-muted))]" />
                              <div className="absolute top-2 right-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm ${
                                  isApproved ? 'bg-emerald-500/30 text-emerald-200' :
                                  isRejected ? 'bg-red-500/30 text-red-200' :
                                  'bg-amber-500/30 text-amber-200'
                                }`}>
                                  {isApproved ? <CheckCircle className="h-2.5 w-2.5" /> :
                                   isRejected ? <XCircle className="h-2.5 w-2.5" /> :
                                   <Clock className="h-2.5 w-2.5" />}
                                  {post.approval_status}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Card body */}
                          <div className="p-3 flex flex-col flex-1">
                            <span className="text-[10px] text-[hsl(var(--th-text-muted))] mb-1">
                              {format(new Date(post.created_at), "MMM d, h:mm a")}
                            </span>
                            <p className={`text-xs text-[hsl(var(--th-text-secondary))] mb-2 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                              {post.content}
                            </p>
                            {post.content.length > 150 && (
                              <button
                                onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mb-2 self-start"
                              >
                                {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                              </button>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-auto mb-2">
                              {!isApproved && (
                                <button
                                  onClick={() => handleApproval(post.id, 'approved')}
                                  disabled={approvingPostId === post.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                                >
                                  <ThumbsUp className="h-3 w-3" /> Approve
                                </button>
                              )}
                              {!isRejected && (
                                <button
                                  onClick={() => handleApproval(post.id, 'rejected')}
                                  disabled={approvingPostId === post.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                                >
                                  <ThumbsDown className="h-3 w-3" /> Reject
                                </button>
                              )}
                              {!isPending && (
                                <button
                                  onClick={() => handleApproval(post.id, 'pending')}
                                  disabled={approvingPostId === post.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" /> Queue
                                </button>
                              )}
                            </div>

                            {/* Comments toggle */}
                            <div className="border-t border-[hsl(var(--th-border))] pt-2">
                              <button
                                onClick={() => toggleComments(post.id)}
                                className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] transition-colors"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {post.comments > 0 ? `${post.comments} comment${post.comments !== 1 ? 's' : ''}` : 'Comment'}
                              </button>

                              {expandedComments.has(post.id) && (
                                <div className="mt-2 space-y-1.5">
                                  {(postComments[post.id] || []).map((comment) => (
                                    <div key={comment.id} className="bg-[hsl(var(--th-surface)/0.5)] rounded-md p-2 text-[10px]">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="font-medium text-[hsl(var(--th-text))]">{comment.author_name}</span>
                                        <span className="text-[hsl(var(--th-text-muted))]">{format(new Date(comment.created_at), "MMM d, h:mm a")}</span>
                                      </div>
                                      <p className="text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={commentInputs[post.id] || ''}
                                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                                      placeholder="Write a comment..."
                                      className="flex-1 bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] rounded-md px-2 py-1 text-[10px] text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    />
                                    <button
                                      onClick={() => handleAddComment(post.id)}
                                      disabled={submittingComment === post.id || !commentInputs[post.id]?.trim()}
                                      className="inline-flex items-center p-1 text-[10px] font-medium rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                                    >
                                      <Send className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[hsl(var(--th-text-muted))]">No posts submitted for review.</p>
              )}
            </div>
          )}

          {/* Image outputs — media library-style grid */}
          {imageOutputs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" /> Media ({imageOutputs.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {imageOutputs.map((o) => {
                  const url = String(o.output_data?.url || o.output_data?.image_url || "");
                  const outputType = o.output_type.replace(/_/g, " ");
                  return (
                    <div key={o.id} className="group relative aspect-square rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] overflow-hidden">
                      <img src={url} alt={outputType} className="h-full w-full object-cover" loading="lazy" />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <p className="text-[10px] text-white/80 truncate">{outputType}</p>
                          <span className="text-[10px] text-white/60">{format(new Date(o.created_at), "MMM d, h:mm a")}</span>
                        </div>
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <button
                            onClick={() => handleCopyUrl(o.id, url)}
                            className="p-1 rounded-md bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all"
                            title="Copy URL"
                          >
                            {copiedUrlId === o.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => handleDeleteOutput(o.id)}
                            disabled={deletingOutputId === o.id}
                            className="p-1 rounded-md bg-black/40 backdrop-blur-sm text-red-300 hover:text-red-200 hover:bg-black/60 transition-all disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {/* Type badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm ${
                          o.output_type === "hero_image" ? "bg-fuchsia-500/30 text-fuchsia-200"
                          : o.output_type === "infographic_image" ? "bg-emerald-500/30 text-emerald-200"
                          : "bg-indigo-500/30 text-indigo-200"
                        }`}>
                          {outputType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other outputs (copy, metadata, etc.) */}
          {otherOutputs.length === 0 && imageOutputs.length === 0 && !product && <p className="text-sm text-[hsl(var(--th-text-muted))]">No outputs yet.</p>}
          {otherOutputs.map((o) => {
            const outputUrl = typeof o.output_data?.url === "string"
              ? o.output_data.url
              : (typeof o.output_data?.image_url === "string" ? o.output_data.image_url : null);
            const cleanOutputData = Object.fromEntries(
              Object.entries((o.output_data || {}) as Record<string, unknown>)
                .filter(([k]) => !k.startsWith("product_") && k !== "brand" && k !== "productName")
            );

            return (
              <div key={o.id} className="bg-[hsl(var(--th-input)/0.5)] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{o.output_type}</Badge>
                  {o.created_by && <span className="text-[11px] text-[hsl(var(--th-text-muted))] italic">{o.created_by}</span>}
                  <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{format(new Date(o.created_at), "MMM d, h:mm a")}</span>
                  <div className="ml-auto flex items-center gap-1">
                    {outputUrl && (
                      <button
                        onClick={() => handleCopyUrl(o.id, outputUrl)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))]"
                      >
                        {copiedUrlId === o.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedUrlId === o.id ? 'Copied' : 'Copy URL'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOutput(o.id)}
                      disabled={deletingOutputId === o.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingOutputId === o.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {outputUrl ? (
                  <div className="space-y-2">
                    <img
                      src={outputUrl}
                      alt={`${o.output_type} preview`}
                      className="w-full max-w-sm rounded-md border border-[hsl(var(--th-border))] object-cover"
                      loading="lazy"
                    />
                    {typeof cleanOutputData?.prompt === "string" && (
                      <details className="text-xs text-[hsl(var(--th-text-muted))]">
                        <summary className="cursor-pointer">Show prompt</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{String(cleanOutputData.prompt)}</pre>
                      </details>
                    )}
                  </div>
                ) : o.output_type === "draft_copy" && typeof cleanOutputData.text === "string" ? (
                  <p className="text-sm text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap">{String(cleanOutputData.text)}</p>
                ) : o.output_type === "metadata" && Array.isArray(cleanOutputData.hashtags) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(cleanOutputData.hashtags as string[]).map((tag, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">{tag}</span>
                    ))}
                  </div>
                ) : o.output_type === "asset_prompt_suggestions" && Array.isArray(cleanOutputData.prompts) ? (
                  <ul className="space-y-1.5 pl-1">
                    {(cleanOutputData.prompts as string[]).map((p, i) => (
                      <li key={i} className="text-xs text-[hsl(var(--th-text-secondary))] flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />{p}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <pre className="text-xs text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap overflow-hidden">{JSON.stringify(cleanOutputData, null, 2)}</pre>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Back to item link */}
      <div className="mb-8">
        <Link
          to={`/item/${item.id}`}
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Item Details
        </Link>
      </div>
    </div>
  );
}

/* ── Reusable content section card ── */

const SECTION_COLORS: Record<string, string> = {
  indigo: "text-indigo-400",
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  violet: "text-violet-400",
};

function ContentSection({ title, icon: Icon, color, children }: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
      <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${SECTION_COLORS[color] || "text-[hsl(var(--th-text-muted))]"}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </h2>
      {children}
    </div>
  );
}
