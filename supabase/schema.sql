create extension if not exists pgcrypto;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  vector_type text not null unique check (vector_type in ('vector-illustration','black-white','line-drawing')),
  prompt_name text not null,
  prompt_content text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  session_id text null,
  vector_type text not null check (vector_type in ('vector-illustration','black-white','line-drawing')),
  original_image_path text null,
  output_image_path text null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  model_name text null,
  prompt_version integer null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid references public.conversions(id) on delete set null,
  model_name text,
  input_units numeric,
  output_units numeric,
  estimated_cost numeric,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table public.prompts enable row level security;
alter table public.conversions enable row level security;
alter table public.usage_logs enable row level security;

-- No public policies: server-side service role accesses these tables.
insert into public.prompts (vector_type, prompt_name, prompt_content)
values
('vector-illustration','Vector Illustration','Recreate the uploaded image as polished professional flat vector-style illustration. Preserve subject, composition, silhouette, proportions, and meaningful details. Use clean shapes, crisp edges, and a restrained palette faithful to the source. Do not add, remove, or rearrange objects.'),
('black-white','Black & White','Convert the uploaded image into precise high-contrast black-and-white artwork. Preserve composition, subject, proportions, and details. Use only pure black and white, crisp edges, and no gray or gradients. Do not add or remove objects.'),
('line-drawing','Line Drawing','Convert the uploaded image into clean accurate line drawing artwork. Preserve subject, composition, proportions, contours, and important details. Use smooth consistent crisp lines on a plain white background. Do not add or remove objects.')
on conflict (vector_type) do nothing;

-- Create a private Storage bucket for generated files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vectorify-storage','vectorify-storage',false,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;