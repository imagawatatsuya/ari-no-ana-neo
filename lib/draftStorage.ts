import { AuthorIndentMode, normalizeAuthorIndentMode } from '../types';

const DRAFT_KEY = 'ari_post_draft_v1';

export type PostDraft = {
  title: string;
  description: string;
  authorMessage: string;
  name: string;
  body: string;
  authorIndentMode: AuthorIndentMode;
};

export function readPostDraft(): PostDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostDraft;
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null;
    return {
      title: parsed.title,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      authorMessage: typeof parsed.authorMessage === 'string' ? parsed.authorMessage : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      body: parsed.body,
      // A draft is a new author's choice, so its missing value follows the
      // site's no-automatic-indentation convention rather than legacy posts.
      authorIndentMode: normalizeAuthorIndentMode(parsed.authorIndentMode, 'none'),
    };
  } catch {
    return null;
  }
}

export function writePostDraft(draft: PostDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearPostDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
