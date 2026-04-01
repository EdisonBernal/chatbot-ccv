-- 06-broadcast-conversation-messages.sql
-- Adds a trigger that broadcasts conversation_messages changes to private topics
-- and a Realtime policy to allow authenticated clients to receive broadcasts.

-- 1) Create trigger function that broadcasts to two topics:
--    - topic:conversation:<conversation_id>  (per-conversation)
--    - topic:conversations                    (global preview updates)

create or replace function public.broadcast_conversation_messages()
returns trigger
security definer
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'topic:conversation:' || coalesce(NEW.conversation_id, OLD.conversation_id) ::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  perform realtime.broadcast_changes(
    'topic:conversations',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  return null;
end;
$$;

-- 2) Create trigger on conversation_messages
create trigger broadcast_conversation_messages
after insert or update or delete
on public.conversation_messages
for each row
execute function public.broadcast_conversation_messages();

-- Create the policy only if it does not exist. Postgres does not support
-- `CREATE POLICY IF NOT EXISTS`, so use a DO block to check and then create.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Authenticated users can receive broadcasts'
      AND schemaname = 'realtime'
      AND tablename = 'messages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can receive broadcasts"
      ON "realtime"."messages"
      FOR SELECT
      TO authenticated
      USING ( true );
    $policy$;
  END IF;
END;
$$;
