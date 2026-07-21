create or replace function public.revoke_payment_request(p_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Reason is required'; end if;
 update public.payment_requests set status='revoked',revoked_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=p_request_id and status='active' returning * into r;
 if not found then raise exception 'Request is not active'; end if;
 update public.payment_checkout_attempts set status='canceled',canceled_at=now(),canceled_by=auth.uid(),canceled_reason=p_reason where payment_request_id=p_request_id and status in ('creating','active','processing');
 update public.payment_message_deliveries set status='canceled',suppression_reason=p_reason where payment_request_id=p_request_id and status in ('queued','claimed');
 perform public.create_payment_activity(r.project_id,'Payment request revoked',p_reason,'florist',jsonb_build_object('payment_request_id',p_request_id),auth.uid()); return to_jsonb(r);
end; $$;
revoke all on function public.revoke_payment_request(uuid,text) from public,anon;
grant execute on function public.revoke_payment_request(uuid,text) to authenticated;
