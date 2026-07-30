const DRAFT_KEY = 'ari_post_draft_v1';

export type PostDraft = {
  title: string;
  description: string;
  name: string;
  body: string;
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
      name: typeof parsed.name === 'string' ? parsed.name : '',
      body: parsed.body,
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
