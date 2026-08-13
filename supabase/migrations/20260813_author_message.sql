-- Add a separate author message while preserving the existing description field as the subtitle.
alter table public.novels
  add column if not exists author_message text;

alter table public.novels
  drop constraint if exists novels_author_message_length;

alter table public.novels
  add constraint novels_author_message_length
  check (author_message is null or length(author_message) <= 500);

