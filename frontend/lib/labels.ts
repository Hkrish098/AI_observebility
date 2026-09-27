const INTENTS: Record<string, string> = {
  shipping_inquiry: "Shipping",
  delivery_failed: "Delivery",
  return_refund: "Returns",
  cancel_modify: "Changing an order",
  account_prime: "Account",
  product_quality: "The item itself",
  other: "Something else",
  faq: "A written answer",
  tool: "Needs a lookup",
  escalate: "Needs a person",
};

const STEPS: Record<string, string> = {
  router: "Query understanding",
  embed: "Embed the tweet",
  retriever: "Retrieve relevant knowledge",
  rerank: "Rank sources",
  llm: "Draft response",
  judge: "Check the draft",
  tool: "Tool call",
};

export function intentLabel(intent?: string | null) {
  if (!intent) return null;
  return INTENTS[intent] ?? intent.replaceAll("_", " ");
}

export function routeLabel(route?: string) {
  if (route === "escalate") return "Needs a person";
  return "Drafted here";
}

export function stepLabel(spanType: string) {
  return STEPS[spanType] ?? spanType;
}

export function emotionLabel(emotion?: string | null) {
  if (!emotion) return "Calm";
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

export function criticalityLabel(level?: string | null) {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}
