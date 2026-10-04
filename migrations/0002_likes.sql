-- The compound key makes repeated likes idempotent. Triggers keep totals
-- consistent for concurrent requests, cancellations and retries.
CREATE TABLE likes (
  path TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (path, visitor_hash)
) WITHOUT ROWID;

CREATE TABLE like_counts (
  path TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);

CREATE TRIGGER likes_insert AFTER INSERT ON likes BEGIN
  INSERT INTO like_counts (path, count) VALUES (NEW.path, 1)
  ON CONFLICT(path) DO UPDATE SET count = count + 1;
END;

CREATE TRIGGER likes_delete AFTER DELETE ON likes BEGIN
  UPDATE like_counts SET count = count - 1 WHERE path = OLD.path;
END;
