-- ==============================================================================
-- PROJECT RAGNAROCK — AZURE SECONDARY POSTGRESQL SUBSCRIBER BOOTSTRAP SCRIPT
-- ==============================================================================
-- Execute on Azure PostgreSQL Flexible Server Standby Database

-- 1. Verify Extension Readiness
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing subscription if re-initializing
DROP SUBSCRIPTION IF EXISTS ragnarock_sub;

-- 3. Create Logical Subscription over Cross-Cloud IPsec VPN Tunnel
-- Note: Replace 10.100.30.50 with actual AWS RDS Private IP or DNS Endpoint
CREATE SUBSCRIPTION ragnarock_sub 
CONNECTION 'host=10.100.30.50 port=5432 dbname=ragnarock_db user=repl_user password=RagnarockSecureReplPass2026! sslmode=prefer' 
PUBLICATION ragnarock_pub 
WITH (
    copy_data = true,
    create_slot = true,
    enabled = true,
    connect = true,
    synchronous_commit = 'off'
);

-- 4. Verify Subscription Status
SELECT subid, subname, subenabled, subconninfo, subpublications 
FROM pg_subscription 
WHERE subname = 'ragnarock_sub';

-- 5. Monitor Subscription Worker Process State
SELECT subname, pid, relid, received_lsn, last_msg_send_time, last_msg_receipt_time, latest_end_lsn, latest_end_time 
FROM pg_stat_subscription;
