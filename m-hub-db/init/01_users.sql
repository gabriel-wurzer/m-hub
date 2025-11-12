-- ===============================================
--  Documents Table Initialization Script
-- ===============================================

-- ===============================================
--  TABLE DEFINITION
-- ===============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL,
    email TEXT NOT NULL
);

-- ===============================================
--  INITIAL DATA INSERTS
-- ===============================================
INSERT INTO users (id, username, email)
VALUES
('c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71'::uuid,
 'Alice',
 'alice@example.com'
),

('79e7432d-f1a0-4f31-9469-1e27b8d8c6cd'::uuid,
 'Bob',
 'bob@example.com'
),

('e2f64296-77ce-4cf9-9436-29f6d3a7d9ea'::uuid,
 'David',
 'david@example.com'
);