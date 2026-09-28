"use client";

import { FormEvent, useState } from "react";
import { AmazonMark, BirdMark } from "@/components/Marks";
import { Thread } from "@/components/customer/Thread";
import { useCase } from "@/lib/case";

const STARTERS = [
  "@AmazonHelp where is my package? Ordered last Tuesday.",
  "@AmazonHelp I was charged twice and need a refund.",
  "@AmazonHelp it says delivered. Nothing is at the door.",
];

const LIMIT = 280;

export function CustomerSupport() {
  const { posts, pending, error, postTweet } = useCase();
  const [input, setInput] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input;
    setInput("");
    void postTweet(text);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-black text-white">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
        <AmazonMark className="h-8 w-8" />
        <p className="text-[15px] font-semibold">Amazon Help</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {posts.length === 0 && (
          <div className="border-b border-white/10 px-5 py-8">
            <p className="text-[20px] font-bold">What do you need help with?</p>
            <p className="mt-2 max-w-lg text-[15px] leading-6 break-words text-[#71767b]">
              Tell us what happened. We’ll ask for the order id only when the reply depends on it.
            </p>
            <ul className="mt-5 space-y-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => void postTweet(starter)}
                    className="block w-full text-left text-[15px] break-words text-[#1d9bf0] hover:underline"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Thread posts={posts} pending={pending} />
      </div>
      <form onSubmit={onSubmit} className="shrink-0 border-t border-white/10 px-5 py-4">
        {posts.length > 0 && (
          <p className="mb-2 pl-[52px] text-[13px] text-[#71767b]">
            Replying to <span className="text-[#1d9bf0]">@you</span>
          </p>
        )}
        {error && <p className="mb-2 text-[14px] text-[#f4212e]">{error}</p>}
        <div className="flex gap-3">
          <BirdMark />
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="reply">
              Post your reply
            </label>
            <textarea
              id="reply"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, LIMIT))}
              placeholder="Post your reply"
              rows={2}
              className="w-full resize-none bg-transparent text-[17px] leading-6 text-white outline-none placeholder:text-[#71767b]"
            />
            <div className="mt-1 flex items-center justify-end gap-3">
              <span className="text-[13px] tabular-nums text-[#71767b]">{LIMIT - input.length}</span>
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="rounded-full bg-white px-4 py-1.5 text-[15px] font-bold text-black disabled:opacity-40"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
