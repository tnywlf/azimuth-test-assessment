import { openai } from "../config/openai";
import { Message, IssueDetectionResult, DashboardInsights } from "../types";
import { getConversationContext } from "./embedding.service";

/**
 * Format messages into a readable conversation transcript
 */
function formatConversation(messages: Message[]): string {
  return messages
    .map((m) => {
      const name = (m as any).sender?.full_name || "Unknown";
      const role = (m as any).sender?.role || "user";
      return `[${name} (${role})]: ${m.content}`;
    })
    .join("\n");
}

// ==============================
// CONVERSATION SUMMARIZATION
// ==============================
export async function summarizeConversation(
  messages: Message[],
  userId?: string
): Promise<string> {
  if (messages.length === 0) {
    return "No messages to summarize.";
  }

  const transcript = formatConversation(messages);

  // Fallback if OpenAI is not configured
  if (!openai) {
    const participants = [
      ...new Set(
        messages.map((m) => (m as any).sender?.full_name || "Unknown")
      ),
    ];
    return (
      `Conversation between ${participants.join(", ")} ` +
      `containing ${messages.length} message(s). ` +
      `Topics discussed include general property management matters. ` +
      `(Configure OPENAI_API_KEY for AI-powered summaries.)`
    );
  }

  // Get context from similar conversations via vector search
  let vectorContext = "";
  if (userId) {
    vectorContext = await getConversationContext(messages, userId);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a property management assistant for Azimuth, a real estate platform.
Summarize the following conversation between property management stakeholders.
Your summary should:
- Highlight key discussion points
- Note any action items or decisions made
- Flag any concerns or issues raised
- Be concise but thorough (2-4 paragraphs)
${vectorContext ? "\nUse the following context from similar past conversations to provide more informed insights:" + vectorContext : ""}`,
      },
      {
        role: "user",
        content: `Summarize this conversation:\n\n${transcript}`,
      },
    ],
    max_tokens: 600,
    temperature: 0.3,
  });

  return response.choices[0].message.content || "Unable to generate summary.";
}

// ==============================
// SMART REPLY SUGGESTIONS
// ==============================
export async function generateSmartReplies(
  messages: Message[],
  currentUserName: string,
  currentUserRole: string,
  userId?: string
): Promise<string[]> {
  if (messages.length === 0) {
    return [
      "Hello! How can I help you today?",
      "Hi there, I'd like to discuss something regarding the property.",
      "Good day! Let me know if you need anything.",
    ];
  }

  const transcript = formatConversation(messages.slice(-15));

  if (!openai) {
    // Provide role-based fallback suggestions
    const fallbacks: Record<string, string[]> = {
      tenant: [
        "Thank you for the update. I'll take note of that.",
        "Could you please provide more details about this?",
        "I appreciate your prompt response. Let me know the next steps.",
      ],
      landlord: [
        "Thank you for letting me know. I'll look into this right away.",
        "I've noted your concern and will arrange for it to be addressed.",
        "Let me check on this and get back to you shortly.",
      ],
      agent: [
        "I'll coordinate between both parties and keep you updated.",
        "Let me review the details and prepare the necessary documentation.",
        "Thank you for the information. I'll follow up on this promptly.",
      ],
    };
    return fallbacks[currentUserRole] || fallbacks.tenant;
  }

  // Get context from similar conversations via vector search
  let vectorContext = "";
  if (userId) {
    vectorContext = await getConversationContext(messages, userId);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a property management assistant. Generate exactly 3 contextual reply suggestions 
for ${currentUserName}, who is a ${currentUserRole} in a property management platform.
The replies should be professional, helpful, and contextually appropriate.
Return ONLY a JSON array of 3 strings, no other text.
Example: ["Reply 1", "Reply 2", "Reply 3"]
${vectorContext ? "\nUse this context from past conversations to make suggestions more relevant:" + vectorContext : ""}`,
      },
      {
        role: "user",
        content: `Recent conversation:\n\n${transcript}\n\nGenerate 3 reply suggestions for the ${currentUserRole}.`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  try {
    const content = response.choices[0].message.content || "[]";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3);
    }
  } catch {
    // If parsing fails, return defaults
  }

  return [
    "Thank you for the update.",
    "I'll look into this and get back to you.",
    "Could you please provide more details?",
  ];
}

// ==============================
// ISSUE DETECTION
// ==============================
export async function detectIssues(
  messages: Message[]
): Promise<IssueDetectionResult> {
  if (messages.length === 0) {
    return { issues: [], overall_sentiment: "neutral" };
  }

  const transcript = formatConversation(messages);

  if (!openai) {
    // Basic keyword-based issue detection as fallback
    const issues: IssueDetectionResult["issues"] = [];
    const content = transcript.toLowerCase();

    if (content.includes("late") && (content.includes("pay") || content.includes("rent"))) {
      issues.push({ type: "Late Payment", severity: "high", description: "Potential late payment issue detected in conversation." });
    }
    if (content.includes("broken") || content.includes("repair") || content.includes("fix") || content.includes("maintenance")) {
      issues.push({ type: "Maintenance Request", severity: "medium", description: "Maintenance or repair request detected." });
    }
    if (content.includes("complaint") || content.includes("unhappy") || content.includes("frustrated") || content.includes("problem")) {
      issues.push({ type: "Complaint", severity: "medium", description: "Tenant complaint or dissatisfaction detected." });
    }
    if (content.includes("leak") || content.includes("mold") || content.includes("safety") || content.includes("hazard")) {
      issues.push({ type: "Safety Concern", severity: "high", description: "Potential safety or health concern detected." });
    }
    if (content.includes("lease") && (content.includes("end") || content.includes("terminate") || content.includes("break"))) {
      issues.push({ type: "Lease Concern", severity: "medium", description: "Lease termination or renewal discussion detected." });
    }

    const negativeWords = ["problem", "issue", "complaint", "broken", "late", "frustrated", "unhappy", "damage"];
    const negCount = negativeWords.filter((w) => content.includes(w)).length;
    const sentiment = negCount >= 3 ? "negative" : negCount >= 1 ? "neutral" : "positive";

    return { issues, overall_sentiment: sentiment };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a property management AI analyst. Analyze the conversation and detect potential issues.
Categories: Late Payment, Maintenance Request, Complaint, Safety Concern, Lease Concern, Communication Issue, Other.
Severity levels: low, medium, high.

Return ONLY valid JSON in this exact format:
{
  "issues": [{ "type": "string", "severity": "low|medium|high", "description": "string" }],
  "overall_sentiment": "positive|neutral|negative"
}`,
      },
      {
        role: "user",
        content: `Analyze this property management conversation for issues:\n\n${transcript}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  try {
    const content = response.choices[0].message.content || "{}";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { issues: [], overall_sentiment: "neutral" };
  }
}

// ==============================
// DASHBOARD INSIGHTS
// ==============================
export async function generateDashboardInsights(
  allMessages: Message[][]
): Promise<DashboardInsights> {
  if (allMessages.length === 0 || allMessages.every((m) => m.length === 0)) {
    return {
      total_issues: 0,
      high_priority: 0,
      overall_sentiment: "neutral",
      key_findings: ["No conversations to analyze yet."],
      recommendations: ["Start communicating with tenants and landlords to generate insights."],
    };
  }

  // Run issue detection on each conversation
  const allIssues: IssueDetectionResult[] = [];
  for (const messages of allMessages) {
    if (messages.length > 0) {
      const result = await detectIssues(messages);
      allIssues.push(result);
    }
  }

  const flatIssues = allIssues.flatMap((r) => r.issues);
  const highPriority = flatIssues.filter((i) => i.severity === "high").length;
  const sentiments = allIssues.map((r) => r.overall_sentiment);
  const negativeCount = sentiments.filter((s) => s === "negative").length;
  const overallSentiment =
    negativeCount > sentiments.length / 2
      ? "negative"
      : negativeCount > 0
      ? "neutral"
      : "positive";

  const issueTypes = [...new Set(flatIssues.map((i) => i.type))];
  const keyFindings = flatIssues
    .filter((i) => i.severity === "high" || i.severity === "medium")
    .slice(0, 5)
    .map((i) => `${i.type}: ${i.description}`);

  const recommendations: string[] = [];
  if (highPriority > 0)
    recommendations.push(`Address ${highPriority} high-priority issue(s) immediately.`);
  if (issueTypes.includes("Maintenance Request"))
    recommendations.push("Schedule maintenance inspections for reported issues.");
  if (issueTypes.includes("Late Payment"))
    recommendations.push("Follow up on pending payments and consider payment reminders.");
  if (issueTypes.includes("Complaint"))
    recommendations.push("Review and respond to tenant complaints promptly.");
  if (recommendations.length === 0)
    recommendations.push("All conversations appear healthy. Keep up the good communication!");

  return {
    total_issues: flatIssues.length,
    high_priority: highPriority,
    overall_sentiment: overallSentiment,
    key_findings: keyFindings.length > 0 ? keyFindings : ["No significant issues detected."],
    recommendations,
  };
}
