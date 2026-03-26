import { useState } from "react";
import { aiApi } from "../services/api";
import { Zap, Loader2 } from "lucide-react";

interface Props {
  conversationId: string;
  onSelect: (reply: string) => void;
}

export default function SmartReplies({ conversationId, onSelect }: Props) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await aiApi.smartReplies(conversationId);
      setReplies(res.data.data.replies);
    } catch {
      setReplies(["Sorry, I couldn't generate suggestions."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="smart-replies">
      {replies.length === 0 ? (
        <button
          className="btn btn-sm btn-ai"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="spin" /> Generating...
            </>
          ) : (
            <>
              <Zap size={14} /> Smart Replies
            </>
          )}
        </button>
      ) : (
        <div className="smart-replies-list">
          {replies.map((reply, i) => (
            <button
              key={i}
              className="smart-reply-chip"
              onClick={() => {
                onSelect(reply);
                setReplies([]);
              }}
            >
              {reply}
            </button>
          ))}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setReplies([])}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
