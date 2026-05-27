-- Enable Row Level Security for all user-owned tables
-- Role app_user does NOT have BYPASSRLS

-- Users table (self-only access)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (id = current_setting('app.user_id', true)::uuid);

-- Privacy settings
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_settings_tenant ON privacy_settings
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Connected services
ALTER TABLE connected_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY connected_services_tenant ON connected_services
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Playlists
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY playlists_tenant ON playlists
  USING (owner_user_id = current_setting('app.user_id', true)::uuid);

-- Likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY likes_tenant ON likes
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Playback sessions
ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY playback_sessions_tenant ON playback_sessions
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Device sessions
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_sessions_tenant ON device_sessions
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Listening events
ALTER TABLE listening_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY listening_events_tenant ON listening_events
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Sync jobs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_jobs_tenant ON sync_jobs
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant ON notifications
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Refresh tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY refresh_tokens_tenant ON refresh_tokens
  USING (user_id = current_setting('app.user_id', true)::uuid);

-- Create app_user role without BYPASSRLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
