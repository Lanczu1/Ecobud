CREATE TABLE users (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'pending', 'suspended') NOT NULL DEFAULT 'pending',
  points INT NOT NULL DEFAULT 0,
  streak_count INT NOT NULL DEFAULT 0,
  last_action_date DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE challenge_submissions (
  id VARCHAR(191) PRIMARY KEY,
  userId VARCHAR(191) NOT NULL,
  challengeId VARCHAR(191) NOT NULL,
  proofText TEXT NULL,
  proofUrl VARCHAR(2048) NULL,
  status ENUM('pending', 'approved', 'rejected', 'flagged') NOT NULL DEFAULT 'pending',
  moderatorNotes TEXT NULL,
  flaggedReason VARCHAR(300) NULL,
  reviewed_by_id VARCHAR(191) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_challenge_submission_user UNIQUE (userId, challengeId),
  CONSTRAINT fk_challenge_submission_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_challenge_submission_reviewer FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE faqs (
  id VARCHAR(191) PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
  id VARCHAR(191) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT NULL,
  updated_by_id VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_setting_updater FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);
