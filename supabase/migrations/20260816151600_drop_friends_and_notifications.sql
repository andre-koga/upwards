-- Remove friends, notification inbox, and unused social identity columns.

DROP TABLE IF EXISTS public.friend_activity_completions CASCADE;
DROP TABLE IF EXISTS public.friend_daily_summaries CASCADE;
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.notification_dismissals CASCADE;

DROP FUNCTION IF EXISTS public.accept_friend_request(UUID);
DROP FUNCTION IF EXISTS public.lookup_user_by_username(TEXT);

ALTER TABLE public.activities
  DROP COLUMN IF EXISTS share_completions_with_friends;

DROP INDEX IF EXISTS public.uq_user_profiles_username_lower;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS display_name;
