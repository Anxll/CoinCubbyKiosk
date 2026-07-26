-- ============================================================
-- Coin Cubby Kiosk — Supabase Schema
-- ============================================================

-- ------------------------------------------------------------
-- notifications
-- Stores system-generated alerts for the admin dashboard.
-- Priority levels: low | normal | high | urgent
-- ------------------------------------------------------------

create table if not exists public.notifications (
  notification_id  uuid                     not null default extensions.uuid_generate_v4(),
  type             character varying(50)    not null,
  title            character varying(255)   not null,
  message          text                     not null,
  related_id       uuid                     null,
  related_table    character varying(50)    null,
  is_read          boolean                  not null default false,
  priority         character varying(20)    not null default 'normal'::character varying,
  created_at       timestamp with time zone not null default now(),
  read_at          timestamp with time zone null,

  constraint notifications_pkey primary key (notification_id),
  constraint notifications_priority_check check (
    (priority)::text = any (
      array[
        'low'::character varying,
        'normal'::character varying,
        'high'::character varying,
        'urgent'::character varying
      ]::text[]
    )
  )
) tablespace pg_default;

-- Indexes for common query patterns
create index if not exists idx_notifications_is_read
  on public.notifications using btree (is_read) tablespace pg_default;

create index if not exists idx_notifications_created_at
  on public.notifications using btree (created_at desc) tablespace pg_default;

create index if not exists idx_notifications_type
  on public.notifications using btree (type) tablespace pg_default;

create index if not exists idx_notifications_priority
  on public.notifications using btree (priority) tablespace pg_default;
