/*
  # Add email notifications for new memories

  1. Functions
    - Create function to send email notifications when memories are added
    - Create trigger to automatically call the notification function

  2. Security
    - Function uses SECURITY DEFINER for proper access to user data
    - Only triggers for memories with valid board associations
*/

-- Function to send email notifications for new memories
CREATE OR REPLACE FUNCTION notify_board_members_new_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record RECORD;
  creator_profile RECORD;
  notification_payload JSON;
BEGIN
  -- Only proceed if this is a new memory (INSERT)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get the board information
  SELECT b.id, b.name, b.member_ids, b.owner_id, b.access_code
  INTO board_record
  FROM boards b
  WHERE b.access_code = NEW.access_code;

  -- If no board found, skip notification
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get creator profile information
  SELECT up.name
  INTO creator_profile
  FROM user_profiles up
  WHERE up.id = NEW.created_by;

  -- If no creator profile found, use default
  IF NOT FOUND THEN
    creator_profile.name := 'Someone';
  END IF;

  -- Only send notifications if there are other members besides the creator
  IF array_length(board_record.member_ids, 1) > 1 THEN
    -- Prepare the notification payload
    notification_payload := json_build_object(
      'memory_id', NEW.id,
      'board_id', board_record.id,
      'creator_name', creator_profile.name,
      'memory_caption', COALESCE(NEW.caption, ''),
      'board_name', board_record.name
    );

    -- Call the edge function asynchronously (fire and forget)
    -- Note: This uses pg_net extension if available, otherwise we'll use a simpler approach
    BEGIN
      PERFORM
        net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-memory-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
          ),
          body := notification_payload::jsonb
        );
    EXCEPTION
      WHEN OTHERS THEN
        -- If pg_net is not available or fails, log the error but don't fail the memory creation
        RAISE WARNING 'Failed to send notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to send notifications when new memories are added
DROP TRIGGER IF EXISTS trigger_notify_new_memory ON memories;
CREATE TRIGGER trigger_notify_new_memory
  AFTER INSERT ON memories
  FOR EACH ROW
  EXECUTE FUNCTION notify_board_members_new_memory();

-- Create a manual function to send notifications (for testing or manual triggers)
CREATE OR REPLACE FUNCTION send_memory_notification_manual(
  memory_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  memory_record RECORD;
  board_record RECORD;
  creator_profile RECORD;
  notification_payload JSON;
  result JSON;
BEGIN
  -- Get the memory information
  SELECT *
  INTO memory_record
  FROM memories
  WHERE id = memory_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Memory not found');
  END IF;

  -- Get the board information
  SELECT b.id, b.name, b.member_ids, b.owner_id
  INTO board_record
  FROM boards b
  WHERE b.access_code = memory_record.access_code;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Board not found');
  END IF;

  -- Get creator profile information
  SELECT up.name
  INTO creator_profile
  FROM user_profiles up
  WHERE up.id = memory_record.created_by;

  IF NOT FOUND THEN
    creator_profile.name := 'Someone';
  END IF;

  -- Prepare the notification payload
  notification_payload := json_build_object(
    'memory_id', memory_record.id,
    'board_id', board_record.id,
    'creator_name', creator_profile.name,
    'memory_caption', COALESCE(memory_record.caption, ''),
    'board_name', board_record.name
  );

  -- Call the edge function
  BEGIN
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-memory-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := notification_payload::jsonb
      );
    
    result := json_build_object('success', true, 'message', 'Notification sent successfully');
  EXCEPTION
    WHEN OTHERS THEN
      result := json_build_object('success', false, 'message', 'Failed to send notification: ' || SQLERRM);
  END;

  RETURN result;
END;
$$;