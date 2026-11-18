-- Mark every unread notification belonging to the current account, across pages.
create function public.mark_all_notifications_read() returns bigint
language plpgsql security definer set search_path='' as $$
declare
  viewer uuid;
  marked bigint;
begin
  viewer := private.require_actor();
  update public.notifications set read_at=now()
    where recipient_id=viewer and read_at is null;
  get diagnostics marked = row_count;
  return marked;
end $$;
revoke all on function public.mark_all_notifications_read() from public,anon,authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
