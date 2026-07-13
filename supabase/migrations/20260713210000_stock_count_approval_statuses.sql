-- S12: Stock count approval workflow statuses (Phase 4)
-- Confirmed remote enum was only: in_progress | completed
ALTER TYPE public.stock_count_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.stock_count_status ADD VALUE IF NOT EXISTS 'approved';
