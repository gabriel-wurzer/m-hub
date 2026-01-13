-- ===============================================
--  Documents Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ensure unique emails
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);


-- ===============================================
--  INITIAL DATA INSERTS
-- password for hash: mypassword
-- ===============================================
INSERT INTO users (id, username, email, password_hash)
VALUES
('c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid,
 'Alice',
 'alice@example.com',
 '$2b$10$UipS95ZNAQbAEojJbhjfGOb7S45HEUObzC/7rxrU1HJZvAM28aMTi'
),

('79e7432d-f1a0-4f31-9469-1e27b8d8c6cd'::uuid,
 'Bob',
 'bob@example.com',
 '$2b$10$UipS95ZNAQbAEojJbhjfGOb7S45HEUObzC/7rxrU1HJZvAM28aMTi'
),

('e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid,
 'David',
 'david@example.com',
 '$2b$10$1GPdyeu5PX0gKflrj.JH.OzilF3o.QM3I/A4h78J5nFdr3vPrRvBG'
);

-- ===============================================
--  UPDATE TRIGGER LOGIC
-- ===============================================
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (
    NEW IS DISTINCT FROM OLD
)
EXECUTE FUNCTION update_users_updated_at();
