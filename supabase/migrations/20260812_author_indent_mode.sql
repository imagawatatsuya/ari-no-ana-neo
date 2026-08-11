-- 投稿者の字下げ意図を本文と分離して保存する。
-- 既存投稿は原文保持を優先し、未指定値を raw として扱う。
alter table public.novels
  add column if not exists author_indent_mode text not null default 'raw';

update public.novels
set author_indent_mode = 'raw'
where author_indent_mode is null
   or author_indent_mode not in ('none', 'jisage', 'raw');

alter table public.novels
  alter column author_indent_mode set default 'raw',
  alter column author_indent_mode set not null;

alter table public.novels
  drop constraint if exists novels_author_indent_mode,
  drop constraint if exists novels_author_indent_mode_check;

alter table public.novels
  add constraint novels_author_indent_mode
  check (author_indent_mode in ('none', 'jisage', 'raw'));
