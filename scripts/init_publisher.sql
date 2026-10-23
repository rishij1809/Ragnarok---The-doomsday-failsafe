-- ==============================================================================
-- PROJECT RAGNAROCK — AWS PRIMARY POSTGRESQL PUBLISHER BOOTSTRAP SCRIPT
-- ==============================================================================
-- Execute on AWS RDS PostgreSQL Primary Master Database

-- 1. Create Dedicated Cross-Cloud Replication User Role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'repl_user') THEN
        CREATE ROLE repl_user WITH LOGIN REPLICATION PASSWORD 'RagnarockSecureReplPass2026!';
        RAISE NOTICE 'Role repl_user created successfully.';
    ELSE
        RAISE NOTICE 'Role repl_user already exists.';
    END IF;
END
$$;

-- 2. Grant Database & Schema Permissions
GRANT CONNECT ON DATABASE ragnarock_db TO repl_user;
GRANT USAGE ON SCHEMA public TO repl_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO repl_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO repl_user;

-- 3. Create PostgreSQL Logical Publication for All Application Tables
DROP PUBLICATION IF EXISTS ragnarock_pub;
CREATE PUBLICATION ragnarock_pub FOR ALL TABLES WITH (publish = 'insert, update, delete, truncate');

-- 4. Verify Publication State & Parameter Settings
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate 
FROM pg_publication 
WHERE pubname = 'ragnarock_pub';

SELECT name, setting 
FROM pg_settings 
WHERE name IN ('wal_level', 'max_wal_senders', 'max_replication_slots', 'track_commit_timestamp');
