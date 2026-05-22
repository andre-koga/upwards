-- Promises / Accountability feature.
-- A Promise ties a habit commitment to specific named people.
-- Progress events are emitted on habit completion; reactions are private (no public counts).
-- No public feed, no likes, no follower graph.

-- User profiles (display name for promise cards and notifications)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can view any profile" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Promises
CREATE TABLE IF NOT EXISTS promises (
    id UUID PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('mutual', 'witness')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    creator_activity_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promises_creator_id ON promises(creator_id);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);

ALTER TABLE promises ENABLE ROW LEVEL SECURITY;

-- Policies that do not reference other promise tables yet (promise_members
-- must exist before we can CREATE POLICY that references it in the USING clause.)
DROP POLICY IF EXISTS "Promise members can view promise" ON promises;
DROP POLICY IF EXISTS "Creator can insert promise" ON promises;
DROP POLICY IF EXISTS "Creator can update promise" ON promises;
CREATE POLICY "Creator can insert promise" ON promises
    FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update promise" ON promises
    FOR UPDATE USING (auth.uid() = creator_id);

-- Promise members
CREATE TABLE IF NOT EXISTS promise_members (
    id UUID PRIMARY KEY,
    promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member', 'witness')),
    member_activity_id UUID,
    invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
    display_name TEXT,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(promise_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promise_members_promise_id ON promise_members(promise_id);
CREATE INDEX IF NOT EXISTS idx_promise_members_user_id ON promise_members(user_id);

ALTER TABLE promise_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view memberships in shared promises" ON promise_members;
DROP POLICY IF EXISTS "Creator can insert members" ON promise_members;
DROP POLICY IF EXISTS "Member can update own membership" ON promise_members;
CREATE POLICY "Members can view memberships in shared promises" ON promise_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM promise_members pm2
            WHERE pm2.promise_id = promise_members.promise_id
              AND pm2.user_id = auth.uid()
        )
    );
CREATE POLICY "Creator can insert members" ON promise_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM promises
            WHERE promises.id = promise_members.promise_id
              AND promises.creator_id = auth.uid()
        )
        OR auth.uid() = promise_members.user_id
    );
CREATE POLICY "Member can update own membership" ON promise_members
    FOR UPDATE USING (auth.uid() = user_id);

-- Select on promises: members only (requires promise_members to exist)
CREATE POLICY "Promise members can view promise" ON promises
    FOR SELECT USING (
        auth.uid() = creator_id
        OR EXISTS (
            SELECT 1 FROM promise_members
            WHERE promise_members.promise_id = promises.id
              AND promise_members.user_id = auth.uid()
        )
    );

-- Promise progress events (daily completion, streak milestones)
-- Never stores journal text, locations, video, or memo content.
CREATE TABLE IF NOT EXISTS promise_progress_events (
    id UUID PRIMARY KEY,
    promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    kind TEXT NOT NULL CHECK (kind IN ('daily_complete', 'streak_milestone')),
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ppe_promise_id ON promise_progress_events(promise_id);
CREATE INDEX IF NOT EXISTS idx_ppe_user_id ON promise_progress_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ppe_date ON promise_progress_events(date);

ALTER TABLE promise_progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promise members can view progress events" ON promise_progress_events;
DROP POLICY IF EXISTS "Members can insert own progress" ON promise_progress_events;
CREATE POLICY "Promise members can view progress events" ON promise_progress_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM promise_members
            WHERE promise_members.promise_id = promise_progress_events.promise_id
              AND promise_members.user_id = auth.uid()
        )
    );
CREATE POLICY "Members can insert own progress" ON promise_progress_events
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM promise_members
            WHERE promise_members.promise_id = promise_progress_events.promise_id
              AND promise_members.user_id = auth.uid()
              AND promise_members.invite_status = 'accepted'
        )
    );

-- Promise reactions (private motivate / congratulate; no public like counts)
CREATE TABLE IF NOT EXISTS promise_reactions (
    id UUID PRIMARY KEY,
    promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    progress_event_id UUID REFERENCES promise_progress_events(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('motivate', 'congratulate')),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_promise_id ON promise_reactions(promise_id);
CREATE INDEX IF NOT EXISTS idx_pr_from_user_id ON promise_reactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_pr_to_user_id ON promise_reactions(to_user_id);

ALTER TABLE promise_reactions ENABLE ROW LEVEL SECURITY;

-- Only sender and recipient can read; no public tally.
DROP POLICY IF EXISTS "Sender or recipient can view reaction" ON promise_reactions;
DROP POLICY IF EXISTS "Promise member can send reaction" ON promise_reactions;
CREATE POLICY "Sender or recipient can view reaction" ON promise_reactions
    FOR SELECT USING (
        auth.uid() = from_user_id
        OR auth.uid() = to_user_id
    );
CREATE POLICY "Promise member can send reaction" ON promise_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = from_user_id
        AND EXISTS (
            SELECT 1 FROM promise_members
            WHERE promise_members.promise_id = promise_reactions.promise_id
              AND promise_members.user_id = auth.uid()
              AND promise_members.invite_status = 'accepted'
        )
    );

-- Promise invites (token-based; email optional)
CREATE TABLE IF NOT EXISTS promise_invites (
    id UUID PRIMARY KEY,
    promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('mutual', 'witness')),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pi_promise_id ON promise_invites(promise_id);
CREATE INDEX IF NOT EXISTS idx_pi_token ON promise_invites(token);

ALTER TABLE promise_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promise creator can manage invites" ON promise_invites;
DROP POLICY IF EXISTS "Anyone can read invite by token" ON promise_invites;
CREATE POLICY "Promise creator can manage invites" ON promise_invites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM promises
            WHERE promises.id = promise_invites.promise_id
              AND promises.creator_id = auth.uid()
        )
    );
-- Public read so unauthenticated users can look up an invite token before signing in.
CREATE POLICY "Anyone can read invite by token" ON promise_invites
    FOR SELECT USING (true);
