create or replace function public.set_payment_obligation_state(p_obligation_id uuid,p_state text,p_reason text,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.project_payment_records; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if p_state not in ('waived','canceled') or nullif(btrim(p_reason),'') is null then raise exception 'A valid state and reason are required'; end if;
 update public.project_payment_records set status=p_state,fulfillment_state=p_state,waived_at=case when p_state='waived' then now() end,canceled_at=case when p_state='canceled' then now() end,updated_at=now()
 where project_payment_record_id=p_obligation_id and status not in ('paid','waived','canceled') returning * into v_row;
 if not found then raise exception 'Obligation cannot be changed'; end if;
 update public.payment_requests r set status='canceled',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where r.status='active' and exists(select 1 from public.payment_request_obligations ro where ro.payment_request_id=r.payment_request_id and ro.obligation_id=p_obligation_id);
 update public.payment_checkout_attempts a set status='canceled',canceled_at=now(),canceled_by=auth.uid(),canceled_reason=p_reason where a.status in ('creating','active','processing') and exists(select 1 from public.payment_request_obligations ro where ro.payment_request_id=a.payment_request_id and ro.obligation_id=p_obligation_id);
 update public.payment_message_deliveries set status='canceled',suppression_reason=p_reason where obligation_id=p_obligation_id and status in ('queued','claimed');
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,updated_at=now() where p.project_id=v_row.project_id and p.status not in ('completed','canceled');
 perform public.create_payment_activity(v_row.project_id,'Payment obligation '||p_state,p_reason,'florist',jsonb_build_object('obligation_id',p_obligation_id,'command_key',p_command_key),auth.uid());
 return to_jsonb(v_row);
end; $$;
revoke all on function public.set_payment_obligation_state(uuid,text,text,uuid) from public,anon;
grant execute on function public.set_payment_obligation_state(uuid,text,text,uuid) to authenticated;
