import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ContentItem, ContentItemOutput } from "@/api/client";
import { productApi, Product, MockFacebookPostRecord } from "@/api/productApi";
import { FacebookPostCard } from "@/components/FacebookPostCard";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft, ChevronRight, FileText, ExternalLink,
  Activity, Sparkles, User
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

  // Fetch Facebook posts linked to this product
  useEffect(() => {
    if (!product?.id) { setFacebookPosts([]); return; }
    productApi.getFacebookPosts(product.id)
      .then((posts) => setFacebookPosts(posts))
      .catch(() => setFacebookPosts([]));
  }, [product?.id]);

  const visibleOutputs = outputs.filter((o) => !String(o.output_type || "").startsWith("product_"));

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

  return (
    <div className="max-w-4xl mx-auto">
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
          {/* Facebook Posts Section */}
          {product && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                Facebook Posts {facebookPosts.length > 0 && `(${facebookPosts.length})`}
              </h3>
              {facebookPosts.length > 0 ? (
                <div className="space-y-3">
                  {facebookPosts.map((post) => (
                    <FacebookPostCard
                      key={post.id}
                      content={post.content}
                      image={post.image}
                      likes={post.likes}
                      comments={post.comments}
                      shares={post.shares}
                      approvalStatus={post.approval_status}
                      createdAt={post.created_at}
                      pageName={post.page_name || "Page"}
                      profilePicture={post.page_profile_picture || undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--th-text-muted))]">No linked Facebook posts.</p>
              )}
            </div>
          )}

          {visibleOutputs.length === 0 && !product && <p className="text-sm text-[hsl(var(--th-text-muted))]">No outputs yet.</p>}
          {visibleOutputs.map((o) => {
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
