import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api, ContentItem } from "@/api/client";
import { Product } from "@/api/productApi";
import { ProductPicker, SelectedProduct } from "@/components/ProductPicker";
import { useToast } from "@/components/ui/toast";
import { X, ChevronDown } from "lucide-react";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: ContentItem | null;
}

interface CampaignGoalValue {
  title: string;
  content: string;
}

interface DirectionValue {
  benefits: string[];
  pain_points: string[];
}

const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin", "email", "blog"];

export function ItemFormModal({ open, onClose, onSaved, item }: ItemFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    product_url: "",
    product_title: "",
    product_image_url: "",
    product_id: null as string | null,
    campaign_goal: null as CampaignGoalValue | null,
    direction: null as DirectionValue | null,
    target_audience: [] as string[],
    pivot_notes: "",
    platform: "",
    due_date: "",
    publish_date: "",
    assignee: "",
  });

  /** Full product data for populating marketing fields */
  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);

  /** Try to parse a value that may be a JSON string, an object, or a plain string */
  const tryParseJson = (value: unknown): unknown => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
      }
    }
    return value;
  };

  useEffect(() => {
    if (item) {
      // Parse campaign_goal: handle old string, JSON string, and object formats
      let campaignGoal: CampaignGoalValue | null = null;
      if (item.campaign_goal) {
        const parsed = tryParseJson(item.campaign_goal);
        if (typeof parsed === "object" && parsed !== null) {
          const cg = parsed as Record<string, unknown>;
          if (cg.title && cg.content) {
            campaignGoal = { title: String(cg.title), content: String(cg.content) };
          }
        }
        // Old plain text strings or "[object Object]" → leave as null
      }

      // Parse direction: handle old string, JSON string, and object formats
      let direction: DirectionValue | null = null;
      if (item.direction) {
        const parsed = tryParseJson(item.direction);
        if (typeof parsed === "object" && parsed !== null) {
          const dir = parsed as Record<string, unknown>;
          direction = {
            benefits: Array.isArray(dir.benefits) ? (dir.benefits as string[]) : [],
            pain_points: Array.isArray(dir.pain_points) ? (dir.pain_points as string[]) : [],
          };
        }
        // Old plain text strings or "[object Object]" → leave as null
      }

      // Parse target_audience (may also be a JSON string in TEXT columns)
      let targetAudience: string[] = [];
      if (item.target_audience) {
        const parsed = tryParseJson(item.target_audience);
        targetAudience = Array.isArray(parsed) ? parsed : [];
      }

      setForm({
        brand: item.brand || "",
        product_url: item.product_url || "",
        product_title: item.product_title || "",
        product_image_url: item.product_image_url || "",
        product_id: item.product_id || null,
        campaign_goal: campaignGoal,
        direction: direction,
        target_audience: targetAudience,
        pivot_notes: item.pivot_notes || "",
        platform: item.platform || "",
        due_date: item.due_date ? item.due_date.slice(0, 16) : "",
        publish_date: item.publish_date ? item.publish_date.slice(0, 16) : "",
        assignee: item.assignee || "",
      });
    } else {
      setForm({
        brand: "", product_url: "", product_title: "", product_image_url: "",
        product_id: null, campaign_goal: null, direction: null, target_audience: [],
        pivot_notes: "", platform: "", due_date: "", publish_date: "", assignee: "",
      });
      setSelectedProductData(null);
    }
  }, [item, open]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  /** When a product is selected from the picker */
  const handleProductSelect = (product: Product | null) => {
    if (product) {
      setSelectedProductData(product);
      setForm((prev) => ({
        ...prev,
        product_id: product.id,
        product_title: product.name,
        product_image_url: product.thumbnail || "",
        product_url: product.source_url || "",
        brand: product.brand || prev.brand,
        // Reset marketing fields when product changes
        campaign_goal: null,
        direction: { benefits: [], pain_points: [] },
        target_audience: [],
      }));
    } else {
      setSelectedProductData(null);
      setForm((prev) => ({
        ...prev,
        product_id: null,
        product_title: "",
        product_image_url: "",
        product_url: "",
        campaign_goal: null,
        direction: null,
        target_audience: [],
      }));
    }
  };

  /** Build the selected-product preview from current form state */
  const selectedProduct: SelectedProduct | null = form.product_id
    ? {
      product_id: form.product_id,
      product_title: form.product_title,
      product_image_url: form.product_image_url,
      product_url: form.product_url,
      brand: form.brand,
    }
    : null;

  /** Get marketing angles from the selected product */
  const marketingAngles: CampaignGoalValue[] = (selectedProductData?.marketing_angles || []).map((a) => {
    if (typeof a === "string") {
      return { title: a, content: a };
    }
    return { title: a.title, content: a.content };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      toast("Brand is required", "error");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        due_date: form.due_date || null,
        publish_date: form.publish_date || null,
        assignee: form.assignee || null,
      };
      // Only include migration-dependent fields when they have values so
      // the request works both before and after migration 005.
      if (form.target_audience.length > 0) {
        payload.target_audience = form.target_audience;
      } else {
        delete payload.target_audience;
      }
      if (!form.product_id) {
        delete payload.product_id;
      }
      if (item) {
        await api.updateItem(item.id, payload as Partial<ContentItem>);
        toast("Item updated", "success");
      } else {
        await api.createItem(payload as Partial<ContentItem>);
        toast("Item created", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  };

  /** Handle campaign goal selection */
  const handleCampaignGoalChange = (index: string) => {
    if (index === "") {
      set("campaign_goal", null);
      return;
    }
    const idx = parseInt(index, 10);
    const angle = marketingAngles[idx];
    if (angle) {
      set("campaign_goal", { title: angle.title, content: angle.content });
    }
  };

  /** Handle direction checkbox toggle */
  const toggleDirectionItem = (type: "benefits" | "pain_points", value: string) => {
    setForm((prev) => {
      const current = prev.direction || { benefits: [], pain_points: [] };
      const list = current[type];
      const updated = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return {
        ...prev,
        direction: { ...current, [type]: updated },
      };
    });
  };

  /** Handle target audience tag toggle */
  const toggleTargetAudience = (value: string) => {
    setForm((prev) => {
      const list = prev.target_audience;
      const updated = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, target_audience: updated };
    });
  };

  const removeTargetAudience = (value: string) => {
    setForm((prev) => ({
      ...prev,
      target_audience: prev.target_audience.filter((v) => v !== value),
    }));
  };

  /** Find the index of the currently selected campaign goal */
  const selectedCampaignGoalIndex = form.campaign_goal
    ? marketingAngles.findIndex(
        (a) => a.title === form.campaign_goal?.title && a.content === form.campaign_goal?.content
      )
    : -1;

  const hasProductData = !!selectedProductData;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Create New Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Product Picker — replaces manual product fields */}
          <ProductPicker selected={selectedProduct} onSelect={handleProductSelect} />

          {/* Brand — editable, but auto-filled by product selection */}
          <Field
            label={form.product_id ? "Brand (from product)" : "Brand *"}
            value={form.brand}
            onChange={(v) => set("brand", v)}
            placeholder="Brand name"
          />

          {/* Campaign Goal — dropdown of marketing angles when product selected */}
          {hasProductData && marketingAngles.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Campaign Goal</label>
              <div className="relative">
                <select
                  value={selectedCampaignGoalIndex >= 0 ? String(selectedCampaignGoalIndex) : ""}
                  onChange={(e) => handleCampaignGoalChange(e.target.value)}
                  className="w-full h-9 px-3 pr-8 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))] appearance-none"
                >
                  <option value="">Select a marketing angle...</option>
                  {marketingAngles.map((angle, i) => (
                    <option key={i} value={String(i)}>{angle.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--th-text-muted))] pointer-events-none" />
              </div>
              {form.campaign_goal && (
                <p className="mt-1.5 text-xs text-[hsl(var(--th-text-muted))] bg-[hsl(var(--th-input)/0.5)] rounded-md p-2">
                  {form.campaign_goal.content}
                </p>
              )}
            </div>
          ) : !hasProductData ? (
            <Field label="Campaign Goal" value="" onChange={() => {}} placeholder="Select a product to choose marketing angles" multiline />
          ) : null}

          {/* Direction — benefits + pain points checkboxes when product selected */}
          {hasProductData && ((selectedProductData?.benefits || []).length > 0 || (selectedProductData?.pain_points || []).length > 0) ? (
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-2">Direction</label>
              <div className="space-y-3 bg-[hsl(var(--th-input)/0.3)] rounded-lg p-3 border border-[hsl(var(--th-border)/0.3)]">
                {/* Benefits */}
                {(selectedProductData?.benefits || []).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1.5 block">Benefits</span>
                    <div className="space-y-1">
                      {(selectedProductData?.benefits || []).map((benefit, i) => {
                        const checked = form.direction?.benefits.includes(benefit) || false;
                        return (
                          <label key={i} className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDirectionItem("benefits", benefit)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-[hsl(var(--th-border))] bg-[hsl(var(--th-input))] text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                            />
                            <span className={`text-sm ${checked ? "text-[hsl(var(--th-text))]" : "text-[hsl(var(--th-text-secondary))]"} group-hover:text-[hsl(var(--th-text))]`}>
                              {benefit}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pain Points */}
                {(selectedProductData?.pain_points || []).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-1.5 block">Pain Points</span>
                    <div className="space-y-1">
                      {(selectedProductData?.pain_points || []).map((point, i) => {
                        const checked = form.direction?.pain_points.includes(point) || false;
                        return (
                          <label key={i} className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDirectionItem("pain_points", point)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-[hsl(var(--th-border))] bg-[hsl(var(--th-input))] text-amber-500 focus:ring-amber-500/30 cursor-pointer"
                            />
                            <span className={`text-sm ${checked ? "text-[hsl(var(--th-text))]" : "text-[hsl(var(--th-text-secondary))]"} group-hover:text-[hsl(var(--th-text))]`}>
                              {point}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : !hasProductData ? (
            <Field label="Direction" value="" onChange={() => {}} placeholder="Select a product to choose benefits & pain points" multiline />
          ) : null}

          {/* Target Audience — multi-select tags when product selected */}
          {hasProductData && (selectedProductData?.target_audience || []).length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Target Audience</label>
              {/* Selected tags */}
              {form.target_audience.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.target_audience.map((audience) => (
                    <span
                      key={audience}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium"
                    >
                      {audience}
                      <button
                        type="button"
                        onClick={() => removeTargetAudience(audience)}
                        className="hover:text-cyan-200 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Available options */}
              <div className="flex flex-wrap gap-1.5">
                {(selectedProductData?.target_audience || [])
                  .filter((a) => !form.target_audience.includes(a))
                  .map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => toggleTargetAudience(audience)}
                      className="text-xs px-2 py-1 rounded-full border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-muted))] hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
                    >
                      + {audience}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <Field label="Pivot Notes" value={form.pivot_notes} onChange={(v) => set("pivot_notes", v)} placeholder="Any pivot notes" multiline />

          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => set("platform", e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
            >
              <option value="">Select platform</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Due Date</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Publish Date</label>
              <input
                type="datetime-local"
                value={form.publish_date}
                onChange={(e) => set("publish_date", e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
          </div>

          <Field label="Assignee" value={form.assignee} onChange={(v) => set("assignee", v)} placeholder="Assigned to..." />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {loading ? "Saving..." : item ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const cls = "w-full px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]";
  return (
    <div>
      <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${cls} py-2`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} h-9`} />
      )}
    </div>
  );
}
