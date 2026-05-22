-- Remove friend request rows once handled so they do not accumulate.

DROP POLICY IF EXISTS "Recipient can delete handled requests" ON friend_requests;
CREATE POLICY "Recipient can delete handled requests" ON friend_requests
    FOR DELETE USING (auth.uid() = to_user_id);

CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    req friend_requests;
    a UUID;
    b UUID;
BEGIN
    SELECT * INTO req FROM friend_requests
    WHERE id = request_id AND to_user_id = auth.uid() AND status = 'pending';

    IF req IS NULL THEN
        RAISE EXCEPTION 'Request not found or already handled';
    END IF;

    a := LEAST(req.from_user_id, req.to_user_id);
    b := GREATEST(req.from_user_id, req.to_user_id);

    INSERT INTO friendships (user_a, user_b, created_at)
    VALUES (a, b, NOW())
    ON CONFLICT DO NOTHING;

    DELETE FROM friend_requests WHERE id = request_id;
END;
$$;

-- Clean up previously handled rows.
DELETE FROM friend_requests WHERE status IN ('accepted', 'declined');
