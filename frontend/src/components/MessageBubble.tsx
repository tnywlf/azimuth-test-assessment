import { Message } from "../types";
import { format } from "date-fns";

interface Props {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: Props) {
  return (
    <div className={`message-bubble ${isOwn ? "own" : "other"}`}>
      {!isOwn && (
        <div className="message-sender">
          <span className="message-sender-name">
            {message.sender?.full_name}
          </span>
          <span className="message-sender-role">
            {message.sender?.role}
          </span>
        </div>
      )}
      <div className="message-content">{message.content}</div>
      <div className="message-time">
        {format(new Date(message.created_at), "h:mm a")}
      </div>
    </div>
  );
}
