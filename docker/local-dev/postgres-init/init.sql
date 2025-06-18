-- Initialize database for local development
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Database is already created by POSTGRES_DB environment variable
-- User is already created by POSTGRES_USER/POSTGRES_PASSWORD environment variables