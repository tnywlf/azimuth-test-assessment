import { useState } from "react";
import { aiApi } from "../services/api";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { IssueDetectionResult } from "../types";

interface Props {
  conversationId: string;
}

export default function AISummary({ conversationId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueDetectionResult | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "issues">("summary");

  const handleSummarize = async () => {
    setLoadingSummary(true);
    try {
      const res = await aiApi.summarize(conversationId);
      setSummary(res.data.data.summary);
    } catch {
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleDetectIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await aiApi.detectIssues(conversationId);
      setIssues(res.data.data);
    } catch {
      setIssues(null);
    } finally {
      setLoadingIssues(false);
    }
  };

  const severityColor = (s: string) =>
    s === "high" ? "var(--danger)" : s === "medium" ? "var(--warning)" : "var(--text-secondary)";

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <Sparkles size={18} />
        <h3>AI Analysis</h3>
      </div>

      <div className="ai-tabs">
        <button
          className={`ai-tab ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
        <button
          className={`ai-tab ${activeTab === "issues" ? "active" : ""}`}
          onClick={() => setActiveTab("issues")}
        >
          Issues
        </button>
      </div>

      {activeTab === "summary" && (
        <div className="ai-tab-content">
          {!summary && (
            <button
              className="btn btn-ai"
              onClick={handleSummarize}
              disabled={loadingSummary}
            >
              {loadingSummary ? (
                <>
                  <Loader2 size={16} className="spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Summarize Conversation
                </>
              )}
            </button>
          )}
          {summary && (
            <div className="ai-result">
              <p>{summary}</p>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleSummarize}
                disabled={loadingSummary}
              >
                {loadingSummary ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "issues" && (
        <div className="ai-tab-content">
          {!issues && (
            <button
              className="btn btn-ai"
              onClick={handleDetectIssues}
              disabled={loadingIssues}
            >
              {loadingIssues ? (
                <>
                  <Loader2 size={16} className="spin" /> Scanning...
                </>
              ) : (
                <>
                  <AlertTriangle size={16} /> Detect Issues
                </>
              )}
            </button>
          )}
          {issues && (
            <div className="ai-result">
              <div className="ai-sentiment">
                Sentiment:{" "}
                <span
                  className={`sentiment-${issues.overall_sentiment}`}
                >
                  {issues.overall_sentiment}
                </span>
              </div>
              {issues.issues.length === 0 ? (
                <p className="ai-no-issues">No issues detected.</p>
              ) : (
                <ul className="ai-issues-list">
                  {issues.issues.map((issue, i) => (
                    <li key={i} className="ai-issue-item">
                      <span
                        className="issue-severity"
                        style={{ color: severityColor(issue.severity) }}
                      >
                        ● {issue.severity.toUpperCase()}
                      </span>
                      <strong>{issue.type}</strong>
                      <p>{issue.description}</p>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleDetectIssues}
                disabled={loadingIssues}
              >
                {loadingIssues ? "Refreshing..." : "Re-scan"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
