import { format } from "date-fns";
import { ThumbsUp, MessageCircle, Share2, Globe } from "lucide-react";

interface FacebookPostCardProps {
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  approvalStatus: string;
  createdAt: string;
  pageName: string;
  profilePicture?: string;
  /** Compact mode for 3-column grid – smaller text, clamped content, shorter image */
  compact?: boolean;
}

function renderContentWithHashtags(text: string) {
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="text-blue-500 font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function FacebookPostCard({
  content,
  image,
  likes,
  comments,
  shares,
  approvalStatus,
  createdAt,
  pageName,
  profilePicture,
  compact = false,
}: FacebookPostCardProps) {
  const formattedDate = (() => {
    try {
      return format(new Date(createdAt), "MMM d 'at' h:mm a");
    } catch {
      return createdAt;
    }
  })();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${compact ? "text-xs" : ""}`}>
      {/* Header: Profile + Page Name + Timestamp */}
      <div className={`flex items-center ${compact ? "gap-2 p-2 pb-1.5" : "gap-3 p-3 pb-2"}`}>
        {profilePicture ? (
          <img
            src={profilePicture}
            alt={pageName}
            className={`rounded-full object-cover border border-gray-200 ${compact ? "h-7 w-7" : "h-10 w-10"}`}
          />
        ) : (
          <div className={`rounded-full bg-blue-600 flex items-center justify-center text-white font-bold ${compact ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-sm"}`}>
            {pageName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-gray-900 truncate ${compact ? "text-[11px]" : "text-sm"}`}>{pageName}</div>
          <div className={`flex items-center gap-1 text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}>
            <span>{formattedDate}</span>
            <span>·</span>
            <Globe className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </div>
        </div>
        {approvalStatus === "approved" && (
          <span className={`rounded-full bg-green-100 text-green-700 font-medium ${compact ? "text-[8px] px-1.5 py-px" : "text-[10px] px-2 py-0.5"}`}>
            Approved
          </span>
        )}
      </div>

      {/* Post Content */}
      {content && (
        <div className={`text-gray-900 whitespace-pre-wrap leading-relaxed ${compact ? "px-2 pb-1.5 text-[11px] line-clamp-3" : "px-3 pb-2 text-sm"}`}>
          {renderContentWithHashtags(content)}
        </div>
      )}

      {/* Post Image */}
      {image && (
        <div className="w-full">
          <img
            src={image}
            alt="Post image"
            className={`w-full object-cover ${compact ? "max-h-[180px]" : "max-h-[600px]"}`}
            loading="lazy"
          />
        </div>
      )}

      {/* Engagement Stats */}
      <div className={`flex items-center justify-between text-gray-500 border-t border-gray-100 ${compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`}>
        <div className="flex items-center gap-1">
          <span className={`inline-flex items-center justify-center rounded-full bg-blue-500 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}>
            <ThumbsUp className={compact ? "h-2 w-2 text-white" : "h-2.5 w-2.5 text-white"} />
          </span>
          <span>{likes}</span>
        </div>
        <div className="flex items-center gap-2">
          {comments > 0 && <span>{comments} comment{comments !== 1 ? "s" : ""}</span>}
          {shares > 0 && <span>{shares} share{shares !== 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex border-t border-gray-200">
        <button className={`flex-1 flex items-center justify-center gap-1 font-medium text-gray-600 hover:bg-gray-50 transition-colors ${compact ? "py-1.5 text-[10px]" : "py-2 text-xs gap-1.5"}`}>
          <ThumbsUp className={compact ? "h-3 w-3" : "h-4 w-4"} /> Like
        </button>
        <button className={`flex-1 flex items-center justify-center gap-1 font-medium text-gray-600 hover:bg-gray-50 transition-colors ${compact ? "py-1.5 text-[10px]" : "py-2 text-xs gap-1.5"}`}>
          <MessageCircle className={compact ? "h-3 w-3" : "h-4 w-4"} /> Comment
        </button>
        <button className={`flex-1 flex items-center justify-center gap-1 font-medium text-gray-600 hover:bg-gray-50 transition-colors ${compact ? "py-1.5 text-[10px]" : "py-2 text-xs gap-1.5"}`}>
          <Share2 className={compact ? "h-3 w-3" : "h-4 w-4"} /> Share
        </button>
      </div>
    </div>
  );
}
