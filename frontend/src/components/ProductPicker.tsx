import { useState, useEffect, useRef, useCallback } from "react";
import { productApi, Product } from "@/api/productApi";
import { PriceTag } from "@/components/PriceTag";
import { Search, X, Package, Loader2 } from "lucide-react";

interface ProductPickerProps {
    /** Currently-selected product (restored from content item fields) */
    selected: SelectedProduct | null;
    onSelect: (product: Product | null) => void;
}

export interface SelectedProduct {
    product_id: string;
    product_title: string;
    product_image_url: string;
    product_url: string;
    brand: string;
}

export function ProductPicker({ selected, onSelect }: ProductPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await productApi.searchProducts({ q, limit: 20 });
            setResults(res.items);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (value: string) => {
        setQuery(value);
        setOpen(true);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(value), 300);
    };

    const handleSelect = (product: Product) => {
        onSelect(product);
        setQuery("");
        setResults([]);
        setOpen(false);
    };

    const handleClear = () => {
        onSelect(null);
    };

    // Show selected product preview
    if (selected) {
        return (
            <div className="p-3 rounded-lg bg-[hsl(var(--th-input)/0.4)] border border-[hsl(var(--th-border)/0.4)] space-y-2">
                <div className="text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider">
                    Linked Product
                </div>
                <div className="flex items-center gap-3">
                    {selected.product_image_url ? (
                        <img
                            src={selected.product_image_url}
                            alt={selected.product_title}
                            className="h-12 w-12 rounded-lg object-cover border border-[hsl(var(--th-border))]"
                            onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                        />
                    ) : (
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-600/30 to-violet-600/30 flex items-center justify-center border border-indigo-500/20">
                            <Package className="h-5 w-5 text-indigo-300" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--th-text))] truncate">
                            {selected.product_title}
                        </p>
                        <p className="text-xs text-[hsl(var(--th-text-muted))]">{selected.brand}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1.5 rounded-md text-[hsl(var(--th-text-muted))] hover:text-red-400 hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
                        title="Remove product"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Show search input + dropdown
    return (
        <div ref={containerRef} className="relative">
            <div className="p-3 rounded-lg bg-[hsl(var(--th-input)/0.4)] border border-[hsl(var(--th-border)/0.4)] space-y-2">
                <div className="text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider">
                    Product Search
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--th-text-muted))]" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleChange(e.target.value)}
                        onFocus={() => query.trim() && setOpen(true)}
                        placeholder="Search products by name, brand, or category…"
                        className="w-full h-9 pl-8 pr-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                    {loading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--th-text-muted))] animate-spin" />
                    )}
                </div>
            </div>

            {/* Dropdown results */}
            {open && (query.trim() || results.length > 0) && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] shadow-xl">
                    {loading && results.length === 0 && (
                        <div className="flex items-center justify-center gap-2 p-4 text-sm text-[hsl(var(--th-text-muted))]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching…
                        </div>
                    )}

                    {!loading && results.length === 0 && query.trim() && (
                        <div className="p-4 text-center text-sm text-[hsl(var(--th-text-muted))]">
                            No products found for "{query}"
                        </div>
                    )}

                    {results.map((product) => (
                        <button
                            key={product.id}
                            type="button"
                            onClick={() => handleSelect(product)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(var(--th-surface-hover))] transition-colors text-left border-b border-[hsl(var(--th-border)/0.3)] last:border-b-0"
                        >
                            {product.thumbnail ? (
                                <img
                                    src={product.thumbnail}
                                    alt={product.name}
                                    className="h-10 w-10 rounded-md object-cover shrink-0 border border-[hsl(var(--th-border))]"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-md bg-gradient-to-br from-indigo-600/20 to-violet-600/20 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                    <Package className="h-4 w-4 text-indigo-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[hsl(var(--th-text))] truncate">
                                    {product.name}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[hsl(var(--th-text-muted))]">{product.brand}</span>
                                    {product.category && (
                                        <>
                                            <span className="text-[hsl(var(--th-text-muted))]">·</span>
                                            <span className="text-xs text-[hsl(var(--th-text-muted))]">{product.category}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {product.selling_price && (
                                <PriceTag product={product} size="sm" className="shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
