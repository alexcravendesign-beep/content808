import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useSearchParams } from "react-router-dom";
import { api, ContentItemOutput, ProductAsset } from "@/api/client";
import { productApi, Product, MockFacebookPostRecord } from "@/api/productApi";
import { FacebookPostCard } from "@/components/FacebookPostCard";
import { useToast } from "@/components/ui/toast";
import {
  Image, Search, Upload, Copy, Check, Hash, FileText,
  ChevronDown, X, Loader2
} from "lucide-react";
import { format } from "date-fns";

export function MediaLibraryPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Product search state
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Output data
  const [outputs, setOutputs] = useState<ContentItemOutput[]>([]);
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [facebookPosts, setFacebookPosts] = useState<MockFacebookPostRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState<string | undefined>(undefined);

  // Load product from URL query param on mount
  useEffect(() => {
    const productId = searchParams.get("product");
    const productName = searchParams.get("product_name");
    if (productId) {
      // Direct lookup by ID
      productApi.getProduct(productId)
        .then((product) => {
          setSelectedProduct(product);
          setProductQuery(product.name);
        })
        .catch(() => { /* product not found or invalid ID */ });
    } else if (productName) {
      // Direct lookup by exact name (avoids proxy timeout on search endpoint)
      productApi.getProductByName(productName)
        .then((product) => {
          setSelectedProduct(product);
          setProductQuery(product.name);
          setSearchParams({ product: product.id });
        })
        .catch(() => { /* product not found */ });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search products as user types
  useEffect(() => {
    if (!productQuery.trim() || !searchOpen) {
      setProductResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      productApi.searchProducts({ q: productQuery, limit: 10 })
        .then((res) => setProductResults(res.items))
        .catch(() => setProductResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [productQuery, searchOpen]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch outputs when product is selected
  const fetchProductData = useCallback(async (product: Product) => {
    setLoading(true);
    try {
      const [outputsRes, fbPosts] = await Promise.all([
        api.getProductOutputs(product.id),
        productApi.getFacebookPosts(product.id).catch(() => [] as MockFacebookPostRecord[]),
      ]);
      setOutputs(outputsRes.outputs);
      setAssets(outputsRes.assets);
      setFacebookPosts(fbPosts);
    } catch {
      toast("Failed to load product outputs", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedProduct) {
      fetchProductData(selectedProduct);
    } else {
      setOutputs([]);
      setAssets([]);
      setFacebookPosts([]);
    }
  }, [selectedProduct, fetchProductData]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductQuery(product.name);
    setSearchOpen(false);
    setSearchParams({ product: product.id });
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductQuery("");
    setSearchParams({});
  };

  // Upload handlers
  const handleFiles = async (files: FileList | File[]) => {
    if (!selectedProduct) {
      toast("Select a product first", "error");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadProductAsset(selectedProduct.id, file);
      }
      toast(`Uploaded ${files.length} file(s)`, "success");
      fetchProductData(selectedProduct);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast("Copied to clipboard", "success");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Categorize outputs
  const imageOutputs = outputs.filter(
    (o) => ["hero_image", "infographic_image", "post_image", "product_image"].includes(o.output_type) && (o.output_data?.status !== "failed")
  );
  const copyOutputs = outputs.filter(
    (o) => ["draft_copy", "final_copy", "copy"].includes(o.output_type)
  );
  const hashtagOutputs = outputs.filter(
    (o) => o.output_type === "hashtags"
  );

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
            Product Outputs
          </h1>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">
            All images, copy, and assets organized by product
          </p>
        </div>
      </div>

      {/* Product Search/Picker */}
      <div className="glass-panel rounded-xl p-4 mb-6" ref={searchRef}>
        <label className="text-xs font-medium text-[hsl(var(--th-text-muted))] mb-2 block">
          Select Product
        </label>
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--th-text-muted))]" />
              <input
                type="text"
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setSearchOpen(true);
                  if (!e.target.value.trim()) setSelectedProduct(null);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search for a product..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--th-text-muted))] animate-spin" />
              )}
            </div>
            {selectedProduct && (
              <button
                onClick={handleClearProduct}
                className="p-2 rounded-lg text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {searchOpen && productResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] shadow-xl max-h-64 overflow-y-auto">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[hsl(var(--th-surface-hover))] transition-colors border-b border-[hsl(var(--th-border))] last:border-b-0"
                >
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-[hsl(var(--th-input))] flex items-center justify-center">
                      <Image className="h-4 w-4 text-[hsl(var(--th-text-muted))]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--th-text))] truncate">{p.name}</p>
                    <p className="text-[11px] text-[hsl(var(--th-text-muted))]">{p.brand} {p.category ? `\u00B7 ${p.category}` : ""}</p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-[hsl(var(--th-text-muted))] -rotate-90" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Product Info Bar */}
      {selectedProduct && (
        <div className="glass-panel rounded-xl p-4 mb-6 flex items-center gap-4">
          {selectedProduct.thumbnail ? (
            <img src={selectedProduct.thumbnail} alt={selectedProduct.name} className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-[hsl(var(--th-input))] flex items-center justify-center">
              <Image className="h-6 w-6 text-[hsl(var(--th-text-muted))]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[hsl(var(--th-text))] truncate">{selectedProduct.name}</h2>
            <p className="text-xs text-[hsl(var(--th-text-muted))]">
              {selectedProduct.brand}
              {selectedProduct.category ? ` \u00B7 ${selectedProduct.category}` : ""}
              {selectedProduct.selling_price ? ` \u00B7 ${selectedProduct.selling_price}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--th-text-muted))]">
            <span className="px-2 py-1 rounded bg-[hsl(var(--th-input))]">{imageOutputs.length} images</span>
            <span className="px-2 py-1 rounded bg-[hsl(var(--th-input))]">{facebookPosts.length} FB posts</span>
            <span className="px-2 py-1 rounded bg-[hsl(var(--th-input))]">{assets.length} uploads</span>
          </div>
        </div>
      )}

      {/* No product selected */}
      {!selectedProduct && (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-2">Select a product</h3>
          <p className="text-sm text-[hsl(var(--th-text-muted))]">Search for a product above to view its outputs, copy, and assets.</p>
        </div>
      )}

      {/* Loading state */}
      {selectedProduct && loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Product outputs content */}
      {selectedProduct && !loading && (
        <div className="space-y-8">
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-[hsl(var(--th-border))] hover:border-[hsl(var(--th-text-muted))] hover:bg-[hsl(var(--th-surface-hover))]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                <span className="text-sm text-[hsl(var(--th-text-secondary))]">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-[hsl(var(--th-text-muted))] mx-auto mb-2" />
                <p className="text-sm font-medium text-[hsl(var(--th-text-secondary))]">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-[hsl(var(--th-text-muted))] mt-1">
                  Images and videos up to 20MB
                </p>
              </>
            )}
          </div>

          {/* Uploaded Assets */}
          {assets.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" />
                Uploaded Assets ({assets.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group relative aspect-square rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] overflow-hidden cursor-pointer"
                    onClick={() => { setLightboxSrc(asset.url); setLightboxLabel(asset.label); }}
                  >
                    <img src={asset.url} alt={asset.label} className="h-full w-full object-cover hover:scale-105 transition-transform duration-200" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[10px] text-white/80 truncate">{asset.label}</p>
                        <span className="text-[10px] text-white/60">{format(new Date(asset.created_at), "MMM d")}</span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm bg-indigo-500/30 text-indigo-200">
                        {asset.asset_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Images Grid */}
          {imageOutputs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] mb-3 flex items-center gap-2">
                <Image className="h-4 w-4 text-fuchsia-400" />
                Images ({imageOutputs.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {imageOutputs.map((output) => {
                  const url = String(output.output_data?.url || "");
                  const outputType = output.output_type.replace(/_/g, " ");
                  return (
                    <div
                      key={output.id}
                      className="group relative aspect-square rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] overflow-hidden cursor-pointer"
                      onClick={() => { if (url) { setLightboxSrc(url); setLightboxLabel(outputType); } }}
                    >
                      {url ? (
                        <img src={url} alt={outputType} className="h-full w-full object-cover hover:scale-105 transition-transform duration-200" loading="lazy" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[hsl(var(--th-input))]">
                          <Image className="h-8 w-8 text-[hsl(var(--th-text-muted))]" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-[10px] text-white/80 truncate">{String(output.output_data?.product_name || outputType)}</p>
                          <span className="text-[10px] text-white/60">{format(new Date(output.created_at), "MMM d")}</span>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm ${
                          output.output_type === "hero_image" ? "bg-fuchsia-500/30 text-fuchsia-200"
                          : output.output_type === "infographic_image" ? "bg-emerald-500/30 text-emerald-200"
                          : "bg-indigo-500/30 text-indigo-200"
                        }`}>
                          {outputType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Facebook Posts */}
          {facebookPosts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                Facebook Posts ({facebookPosts.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {facebookPosts.map((post) => (
                  <div key={post.id} className="relative">
                    <FacebookPostCard
                      content={post.content}
                      image={post.image}
                      likes={post.likes}
                      comments={post.comments}
                      shares={post.shares}
                      approvalStatus={post.approval_status}
                      createdAt={post.created_at}
                      pageName={post.page_name || "Facebook Page"}
                      profilePicture={post.page_profile_picture || undefined}
                      onImageClick={(src) => { setLightboxSrc(src); setLightboxLabel("Facebook Post"); }}
                    />
                    {/* Quick copy button for post content */}
                    <button
                      onClick={() => copyToClipboard(post.content, `fb-${post.id}`)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all"
                      title="Copy post text"
                    >
                      {copiedId === `fb-${post.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Copy Blocks */}
          {copyOutputs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                Copy Blocks ({copyOutputs.length})
              </h3>
              <div className="space-y-3">
                {copyOutputs.map((output) => {
                  const text = String(output.output_data?.text || output.output_data?.content || output.output_data?.copy || JSON.stringify(output.output_data));
                  return (
                    <div key={output.id} className="relative glass-panel rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--th-text-muted))] font-medium">{output.output_type.replace(/_/g, " ")}</span>
                          <p className="text-sm text-[hsl(var(--th-text-secondary))] mt-1 whitespace-pre-wrap">{text}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(text, output.id)}
                          className="shrink-0 p-2 rounded-lg text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === output.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Hashtags */}
          {hashtagOutputs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-cyan-400" />
                Hashtags
              </h3>
              <div className="space-y-3">
                {hashtagOutputs.map((output) => {
                  const tags = String(output.output_data?.tags || output.output_data?.hashtags || output.output_data?.text || JSON.stringify(output.output_data));
                  return (
                    <div key={output.id} className="relative glass-panel rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex-1 text-sm text-[hsl(var(--th-text-secondary))] whitespace-pre-wrap">{tags}</p>
                        <button
                          onClick={() => copyToClipboard(tags, `hash-${output.id}`)}
                          className="shrink-0 p-2 rounded-lg text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
                          title="Copy hashtags"
                        >
                          {copiedId === `hash-${output.id}` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Image Lightbox */}
          <ImageLightbox
            src={lightboxSrc || ""}
            open={!!lightboxSrc}
            onClose={() => setLightboxSrc(null)}
            label={lightboxLabel}
          />

          {/* Empty state when product has no outputs */}
          {imageOutputs.length === 0 && facebookPosts.length === 0 && copyOutputs.length === 0 && hashtagOutputs.length === 0 && assets.length === 0 && (
            <div className="text-center py-12">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
                <Image className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-[hsl(var(--th-text))] mb-2">No outputs yet</h3>
              <p className="text-sm text-[hsl(var(--th-text-muted))]">
                Generate images and copy for this product, or drag & drop files above to upload assets.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
