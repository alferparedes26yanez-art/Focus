-- Material from saved web pages (.html) and plain text (.txt, .md), which
-- teachers often share. Links to documents become pdf/docx/pptx material, so
-- they need no new kind.

alter table public.materials drop constraint materials_kind_check;
alter table public.materials add constraint materials_kind_check
  check (kind in ('pdf', 'docx', 'pptx', 'images', 'web', 'youtube', 'html', 'text'));

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/html',
  'text/plain',
  'text/markdown'
]
where id = 'materials';
