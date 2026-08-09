-- Loutris profile-settings hardening
-- Apply AFTER supabase/schema.sql and the production hardening migrations.
-- This migration keeps profile writes server-owned while bounding user-controlled
-- profile metadata and settings payloads to prevent storage/abuse attacks.

begin;

create or replace function public.save_profile_settings(
  p_username text,
  p_display_name text,
  p_avatar text,
  p_country text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_username text := nullif(upper(trim(p_username)), '');
  v_display_name text := nullif(trim(p_display_name), '');
  v_avatar text := nullif(trim(p_avatar), '');
  v_country text := nullif(upper(trim(p_country)), '');
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_profile public.profiles;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if v_username is not null
     and (char_length(v_username) > 14 or v_username !~ '^[A-Z0-9_]+$') then
    raise exception using errcode = '22023', message = 'INVALID_USERNAME';
  end if;

  if v_display_name is not null and char_length(v_display_name) > 64 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;

  if v_avatar is not null and char_length(v_avatar) > 512 then
    raise exception using errcode = '22023', message = 'INVALID_AVATAR';
  end if;

  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'INVALID_COUNTRY';
  end if;

  if jsonb_typeof(v_settings) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_SETTINGS';
  end if;

  if octet_length(v_settings::text) > 16384 then
    raise exception using errcode = '22023', message = 'SETTINGS_TOO_LARGE';
  end if;

  update public.profiles
     set username = v_username,
         display_name = v_display_name,
         avatar = coalesce(v_avatar, avatar),
         country = v_country,
         team = coalesce(
           team,
           case
             when mod(get_byte(decode(md5(coalesce(v_username, v_user::text)), 'hex'), 0), 2) = 0
               then 'blue'
             else 'red'
           end
         ),
         settings = v_settings,
         last_online = now()
   where id = v_user
   returning * into v_profile;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar', v_profile.avatar,
    'country', v_profile.country,
    'settings', v_profile.settings
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'USERNAME_TAKEN';
end;
$$;

revoke execute on function public.save_profile_settings(text, text, text, text, jsonb) from public;
grant execute on function public.save_profile_settings(text, text, text, text, jsonb) to authenticated;

commit;
