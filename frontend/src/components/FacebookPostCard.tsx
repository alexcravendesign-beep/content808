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
}: FacebookPostCardProps) {
  const formattedDate = (() => {
    try {
      return format(new Date(createdAt), "MMM d 'at' h:mm a");
    } catch {
      return createdAt;
    }
  })();

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header: Profile + Page Name + Timestamp */}
      <div className="flex items-center gap-3 p-3 pb-2">
        {profilePicture ? (
          <img
            src={profilePicture}
            alt={pageName}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {pageName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{pageName}</div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>{formattedDate}</span>
            <span>·</span>
            <Globe className="h-3 w-3" />
          </div>
        </div>
        {approvalStatus === "approved" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Approved
          </span>
        )}
      </div>

      {/* Post Content */}
      {content && (
        <div className="px-3 pb-2 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
          {renderContentWithHashtags(content)}
        </div>
      )}

      {/* Post Image */}
      {image && (
        <div className="w-full">
          <img
            src={image}
            alt="Post image"
            className="w-full max-h-[600px] object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-3 py-2 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500">
            <ThumbsUp className="h-2.5 w-2.5 text-white" />
          </span>
          <span>{likes}</span>
        </div>
        <div className="flex items-center gap-3">
          {comments > 0 && <span>{comments} comment{comments !== 1 ? "s" : ""}</span>}
          {shares > 0 && <span>{shares} share{shares !== 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex border-t border-gray-200">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <ThumbsUp className="h-4 w-4" /> Like
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <MessageCircle className="h-4 w-4" /> Comment
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </div>
  );
}
