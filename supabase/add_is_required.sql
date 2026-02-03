ALTER TABLE product_steps 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT TRUE;

-- While we are at it, let's ensure other 'Pro' columns exist just in case
-- (The error specifically mentioned is_required, so that's the blocker)
