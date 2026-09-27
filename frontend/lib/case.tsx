"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { sendChat, type ChatResponse } from "@/lib/api";

export type Post = {
  id: string;
  handle: string;
  name: string;
  text: string;
  kind: "customer" | "help" | "ticket";
  ticketId?: string | null;
  phone?: string | null;
  minutes: string;
};

type CaseContextValue = {
  sessionId: string;
  posts: Post[];
  latest: ChatResponse | null;
  pending: boolean;
  error: string | null;
  postTweet: (raw: string) => Promise<void>;
};

const CaseContext = createContext<CaseContextValue | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [latest, setLatest] = useState<ChatResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postTweet(raw: string) {
    const text = raw.trim();
    if (!text || pending || text.length > 280) return;
    setError(null);
    setPending(true);
    setPosts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        handle: "@you",
        name: "Customer",
        text,
        kind: "customer",
        minutes: "now",
      },
    ]);
    try {
      const result = await sendChat(text, sessionId);
      setLatest(result);
      setPosts((current) => [
        ...current,
        {
          id: result.trace_id,
          handle: "@AmazonHelp",
          name: "Amazon Help",
          text: result.answer,
          kind: result.route === "escalate" ? "ticket" : "help",
          ticketId: result.ticket_id,
          phone: result.support_phone,
          minutes: "now",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That tweet did not go through.");
    } finally {
      setPending(false);
    }
  }

  return (
    <CaseContext.Provider value={{ sessionId, posts, latest, pending, error, postTweet }}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const value = useContext(CaseContext);
  if (!value) throw new Error("useCase must be used inside CaseProvider");
  return value;
}
