-- Drop the old trigger that only listened to INSERT
DROP TRIGGER IF EXISTS "on_order_created" ON "orders";
DROP TRIGGER IF EXISTS "orders_webhook" ON "orders"; 
-- (Dropping common names to be safe)

-- Create a robust trigger for INSERT AND UPDATE
CREATE TRIGGER "orders_notification_webhook"
AFTER INSERT OR UPDATE ON "orders"
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'http://localhost:54321/functions/v1/notify_new_order', -- logic handled by Supabase usually
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '1000'
);

-- NOTE: If you are using the UI to manage webhooks, 
-- Please go to Database -> Webhooks -> Enable "Update" event for the 'orders' table.
