import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api, ContentItem } from "@/api/client";
import { Product } from "@/api/productApi";
import { ProductPicker, SelectedProduct } from "@/components/ProductPicker";
import { useToast } from "@/components/ui/toast";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: ContentItem | null;
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
    campaign_goal: "",
    direction: "",
    pivot_notes: "",
    platform: "",
    due_date: "",
    publish_date: "",
    assignee: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        brand: item.brand || "",
        product_url: item.product_url || "",
        product_title: item.product_title || "",
        product_image_url: item.product_image_url || "",
        product_id: item.product_id || null,
        campaign_goal: item.campaign_goal || "",
        direction: item.direction || "",
        pivot_notes: item.pivot_notes || "",
        platform: item.platform || "",
        due_date: item.due_date ? item.due_date.slice(0, 16) : "",
        publish_date: item.publish_date ? item.publish_date.slice(0, 16) : "",
        assignee: item.assignee || "",
      });
    } else {
      setForm({
        brand: "", product_url: "", product_title: "", product_image_url: "",
        product_id: null, campaign_goal: "", direction: "", pivot_notes: "",
        platform: "", due_date: "", publish_date: "", assignee: "",
      });
    }
  }, [item, open]);

  const set = (key: string, value: string | null) => setForm((prev) => ({ ...prev, [key]: value }));

  /** When a product is selected from the picker */
  const handleProductSelect = (product: Product | null) => {
    if (product) {
      setForm((prev) => ({
        ...prev,
        product_id: product.id,
        product_title: product.name,
        product_image_url: product.thumbnail || "",
        product_url: product.source_url || "",
        brand: product.brand || prev.brand,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        product_id: null,
        product_title: "",
        product_image_url: "",
        product_url: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      toast("Brand is required", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        due_date: form.due_date || null,
        publish_date: form.publish_date || null,
        assignee: form.assignee || null,
      };
      if (item) {
        await api.updateItem(item.id, payload);
        toast("Item updated", "success");
      } else {
        await api.createItem(payload);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Create New Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Picker — replaces manual product fields */}
          <ProductPicker selected={selectedProduct} onSelect={handleProductSelect} />

          {/* Brand — editable, but auto-filled by product selection */}
          <Field
            label={form.product_id ? "Brand (from product)" : "Brand *"}
            value={form.brand}
            onChange={(v) => set("brand", v)}
            placeholder="Brand name"
          />

          <Field label="Campaign Goal" value={form.campaign_goal} onChange={(v) => set("campaign_goal", v)} placeholder="What's the goal?" multiline />
          <Field label="Direction" value={form.direction} onChange={(v) => set("direction", v)} placeholder="Creative direction" multiline />
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
