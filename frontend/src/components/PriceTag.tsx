import { Product } from "@/api/productApi";
import { AlertTriangle } from "lucide-react";

interface PriceTagProps {
    product: Product;
    size?: "sm" | "md";
    className?: string;
}

export function PriceTag({ product, size = "sm", className = "" }: PriceTagProps) {
    const { selling_price, rrp_price, price_source, dna_confidence } = product;

    if (!selling_price) return null;

    const hasRrp = rrp_price && rrp_price !== selling_price;
    const isUnverified = !price_source || (dna_confidence && parseFloat(dna_confidence) < 0.5);

    const mainSize = size === "md" ? "text-base" : "text-sm";
    const subSize = size === "md" ? "text-sm" : "text-xs";

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <span className={`font-semibold text-[hsl(var(--th-text))] ${mainSize}`}>{selling_price}</span>
            {hasRrp && (
                <span className={`line-through text-[hsl(var(--th-text-muted))] ${subSize}`}>{rrp_price}</span>
            )}
            {isUnverified && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 ${subSize}`}>
                    <AlertTriangle className="h-3 w-3" />
                    Unverified
                </span>
            )}
        </span>
    );
}
