import { create } from "zustand";
import type { ID, Post } from "../types";
import bus from "./bus";
import { demoPosts } from "./placeholders";

const injected =
  typeof window !== "undefined"
    ? ((window as any).__SN_POSTS__ as Post[] | undefined)
    : undefined;

const initialPosts = Array.isArray(injected) && injected.length
  ? injected
  : demoPosts;

interface FeedState {
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  vote: (postId: ID, optionIndex: number) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: initialPosts,
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((s) => ({ posts: [post, ...s.posts] })),
  vote: (postId, optionIndex) =>
    set((state) => ({
      posts: state.posts.map((p) => {
        if (String(p.id) !== String(postId)) return p;
        if (!p.poll) return p;
        const options = (p.poll.options as any[]).map((o: any) =>
          typeof o === "string" ? { text: o, votes: 0 } : { ...o, votes: Number(o.votes) || 0 },
        );
        const opt = options[optionIndex];
        if (opt) options[optionIndex] = { ...opt, votes: (opt.votes || 0) + 1 };
        return { ...p, poll: { ...p.poll, options } };
      }),
    })),
}));

bus.on?.("post:vote", ({ id, optionIndex }: { id: ID; optionIndex: number }) => {
  useFeedStore.getState().vote(id, optionIndex);
});

export function usePaginatedPosts(page: number, pageSize: number) {
  return useFeedStore((state) => {
    const p = Math.max(1, Math.floor(page));
    const size = Math.max(1, Math.floor(pageSize));
    const start = (p - 1) * size;
    if (start >= state.posts.length) return [];
    return state.posts.slice(start, start + size);
  });
}
