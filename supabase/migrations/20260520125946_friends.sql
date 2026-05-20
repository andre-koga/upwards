-- Friends graph: requests + accepted pairs.
-- No open search — invites by exact username only.

-- Pending / declined requests
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Recipient can update status" ON friend_requests;

CREATE POLICY "Users can read their own requests" ON friend_requests
    FOR SELECT USING (
        auth.uid() = from_user_id OR auth.uid() = to_user_id
    );

CREATE POLICY "Users can send friend requests" ON friend_requests
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipient can update status" ON friend_requests
    FOR UPDATE USING (auth.uid() = to_user_id);


-- Accepted friendship pairs (one row per pair, user_a < user_b)
CREATE TABLE IF NOT EXISTS friendships (
    user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can insert friendships" ON friendships;
DROP POLICY IF EXISTS "Users can delete their own friendships" ON friendships;

CREATE POLICY "Users can view their own friendships" ON friendships
    FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can insert friendships" ON friendships
    FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can delete their own friendships" ON friendships
    FOR DELETE USING (auth.uid() = user_a OR auth.uid() = user_b);


-- Helper function: accept a friend request atomically
-- (updates status + inserts friendship row in one call)
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

    -- Mark accepted
    UPDATE friend_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = request_id;

    -- Insert ordered pair
    a := LEAST(req.from_user_id, req.to_user_id);
    b := GREATEST(req.from_user_id, req.to_user_id);

    INSERT INTO friendships (user_a, user_b, created_at)
    VALUES (a, b, NOW())
    ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_friend_request(UUID) TO authenticated;
