-- Each service owns its own database (several services ship tables with the
-- same name, e.g. "deleted_files" in auth and exam, so they can't share one).
-- Runs only on first start of an empty data volume.
CREATE DATABASE auth_db;
CREATE DATABASE authorization_db;
CREATE DATABASE exam_db;
CREATE DATABASE achievement_db;
CREATE DATABASE resource_db;
CREATE DATABASE file_db;
CREATE DATABASE live_db;
CREATE DATABASE notification_db;
