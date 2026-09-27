"use client";

import { AmazonMark, BirdMark } from "@/components/Marks";
import { useCase, type Post } from "@/lib/case";

export function Thread({ posts, pending = false }: { posts: Post[]; pending?: boolean }) {
  const { selectedId, selectRun } = useCase();

  return (
    <div>
      {posts.map((post, index) => {
        const last = index === posts.length - 1 && !pending;
        const customer = post.kind === "customer";
        const selected = !customer && post.id === selectedId;
        return (
          <article key={post.id} className="flex gap-3 px-5 pt-4">
            <div className="flex w-10 shrink-0 flex-col items-center">
              {customer ? <BirdMark /> : <AmazonMark />}
              {!last && <div className="mt-1 w-0.5 flex-1 bg-[#2f3336]" />}
            </div>
            <div className={`min-w-0 flex-1 ${last ? "pb-5" : "pb-2"}`}>
              <p className="text-[15px] leading-5">
                <span className="font-bold">{post.name}</span>
                <span className="ml-1 text-[#71767b]">
                  {post.handle} · {post.minutes}
                </span>
              </p>
              {!customer && posts[index - 1] && (
                <p className="mt-0.5 text-[13px] text-[#71767b]">
                  Replying to <span className="text-[#1d9bf0]">{posts[index - 1].handle}</span>
                </p>
              )}
              {customer ? (
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6">{post.text}</p>
              ) : (
                <div
                  className={`mt-1 rounded-xl px-2 py-1 ${
                    selected ? "bg-white/10 ring-1 ring-[#1d9bf0]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectRun(post.id)}
                    className="w-full text-left whitespace-pre-wrap text-[15px] leading-6 hover:bg-white/5"
                  >
                    {post.text}
                  </button>
                  {post.kind === "ticket" && post.ticketId && (
                    <div className="mt-3 rounded-2xl border border-[#2f3336] px-4 py-3">
                      <p className="text-[13px] text-[#71767b]">Support ticket</p>
                      <p className="mt-1 font-mono text-[18px]">{post.ticketId}</p>
                      {post.phone && (
                        <a
                          className="mt-2 block text-[15px] text-[#1d9bf0]"
                          href={`tel:${post.phone}`}
                        >
                          {post.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
      {pending && <p className="px-5 py-3 text-[15px] text-[#71767b]">Reading the tweet…</p>}
    </div>
  );
}
