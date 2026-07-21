create or replace function public.recalculate_project_obligations_for_snapshot(p_project_id uuid,p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_snapshot public.project_proposal_invoice_snapshots;v_deposit public.project_payment_records;v_final public.project_payment_records;v_has_receipt boolean;v_deposit_target numeric(12,2);v_final_target numeric(12,2);
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_snapshot from public.project_proposal_invoice_snapshots where project_proposal_invoice_snapshot_id=p_snapshot_id and project_id=p_project_id and is_active for update;
  if not found then raise exception 'An active proposal snapshot is required'; end if;
  select * into v_deposit from public.project_payment_records where project_id=p_project_id and payment_kind='deposit' and status<>'canceled' for update;
  select * into v_final from public.project_payment_records where project_id=p_project_id and payment_kind='final_payment' and status<>'canceled' for update;
  if v_deposit.project_payment_record_id is null or v_final.project_payment_record_id is null then raise exception 'Both project payment obligations are required'; end if;
  select exists(select 1 from public.payment_transaction_allocations a join public.payment_transactions t using(payment_transaction_id) where a.obligation_id in (v_deposit.project_payment_record_id,v_final.project_payment_record_id) and t.kind='receipt' and t.status='confirmed') into v_has_receipt;
  v_deposit_target:=case when v_has_receipt then v_deposit.target_amount else round(v_snapshot.total_amount*.30,2) end;
  v_final_target:=greatest(v_snapshot.total_amount-v_deposit_target,0);
  update public.project_payment_records set basis_snapshot_id=p_snapshot_id,basis_version=v_snapshot.version,basis_total=v_snapshot.total_amount,target_amount=case when payment_kind='deposit' then v_deposit_target else v_final_target end,amount_due=case when payment_kind='deposit' then v_deposit_target else v_final_target end,deposit_target_frozen_at=case when payment_kind='deposit' and v_has_receipt then coalesce(deposit_target_frozen_at,now()) else deposit_target_frozen_at end,updated_at=now() where project_id=p_project_id and project_payment_record_id in (v_deposit.project_payment_record_id,v_final.project_payment_record_id);
  perform public.recompute_project_payment_obligations(p_project_id);
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where project_id=p_project_id and status='active';
  update public.payment_checkout_attempts set status='canceled',canceled_at=now(),canceled_reason='proposal_revision' where project_id=p_project_id and status in ('creating','active','processing');
  perform public.create_payment_activity(p_project_id,'Payment obligations recalculated',case when v_has_receipt then 'The deposit target stayed frozen while the final balance was recalculated.' else 'Deposit and final targets were recalculated from the revised proposal.' end,'system',jsonb_build_object('snapshot_id',p_snapshot_id,'proposal_version',v_snapshot.version,'deposit_target',v_deposit_target,'final_target',v_final_target,'deposit_frozen',v_has_receipt),null);
  return jsonb_build_object('projectId',p_project_id,'snapshotId',p_snapshot_id,'depositTarget',v_deposit_target,'finalTarget',v_final_target,'depositFrozen',v_has_receipt);
end; $$;
revoke all on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) to service_role;
