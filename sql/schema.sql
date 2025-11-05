-- Crear base de datos
CREATE DATABASE IF NOT EXISTS golapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE golapp;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','captain') NOT NULL DEFAULT 'admin',
  team_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Torneos
CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  season YEAR NOT NULL,
  status ENUM('active','finished') DEFAULT 'active',
  admin_id INT NOT NULL,
  total_rounds INT NOT NULL DEFAULT 1,
  start_date DATE NULL,
  match_time TIME NULL,
  location VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Equipos
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  emoji VARCHAR(10) DEFAULT '⚽',
  tournament_id INT,
  captain_user_id INT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (captain_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Jugadores
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  number INT,
  name VARCHAR(120) NOT NULL,
  position VARCHAR(40),
  email VARCHAR(120),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Partidos
CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  round INT NOT NULL,
  match_date DATE,
  match_time TIME,
  location VARCHAR(60),
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  home_goals INT,
  away_goals INT,
  status ENUM('scheduled','played') DEFAULT 'scheduled',
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Índices útiles
CREATE INDEX idx_matches_tourn_round ON matches(tournament_id, round);
