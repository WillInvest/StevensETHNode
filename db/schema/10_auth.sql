-- User authentication table
CREATE TABLE IF NOT EXISTS _users (
    id          SERIAL PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    hashed_pw   TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'viewer',  -- viewer | editor | admin
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed admin user (password: admin — change immediately in production)
-- Hash generated with passlib bcrypt
INSERT INTO _users (username, hashed_pw, role)
VALUES ('admin', '$2b$12$LJ3m4ys3Sz8XBHQFijVZ3u5FLiDe.2A0wjxHgOHDBq7rrKSf/2bFa', 'admin')
ON CONFLICT (username) DO NOTHING;
