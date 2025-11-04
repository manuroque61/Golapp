-- Golapp - inicialización completa de la base de datos
DROP DATABASE IF EXISTS golapp;
CREATE DATABASE IF NOT EXISTS golapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE golapp;

-- Tabla de usuarios
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','captain') NOT NULL DEFAULT 'admin',
  team_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de torneos
CREATE TABLE tournaments (
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
  CONSTRAINT fk_tournaments_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de equipos
CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  emoji VARCHAR(10) DEFAULT '⚽',
  tournament_id INT,
  captain_user_id INT NULL,
  CONSTRAINT fk_teams_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  CONSTRAINT fk_teams_captain FOREIGN KEY (captain_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabla de jugadores
CREATE TABLE players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  number INT NULL,
  name VARCHAR(120) NOT NULL,
  position VARCHAR(40) NULL,
  CONSTRAINT fk_players_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Tabla de partidos
CREATE TABLE matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  round INT NOT NULL,
  match_date DATE,
  match_time TIME,
  location VARCHAR(60),
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  home_goals INT NULL,
  away_goals INT NULL,
  status ENUM('scheduled','played') DEFAULT 'scheduled',
  CONSTRAINT fk_matches_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_home FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_away FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Índices adicionales
CREATE INDEX idx_players_team_number ON players(team_id, number);
CREATE INDEX idx_matches_tournament_round ON matches(tournament_id, round);

-- Datos base opcionales
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin Demo', 'admin@golapp.com', '$2a$10$37KG0wvcmPZAIq9VlUbAv.2C.aJvN6R0VEeyMNrswzTu6/ZBbjpUG', 'admin');

INSERT INTO tournaments (name, season, status, admin_id, total_rounds, start_date, match_time, location) VALUES
('Torneo Apertura', 2025, 'active', 1, 3, '2025-01-10', '16:00:00', 'Cancha Central');

INSERT INTO teams (name, emoji, tournament_id) VALUES
('Los Tigres FC', '🐯', 1),
('Leones FC', '🦁', 1),
('Águilas United', '🦅', 1),
('Pumas Dorados', '🦒', 1);

INSERT INTO players (team_id, number, name, position) VALUES
(1, 10, 'Diego Pérez', 'Delantero'),
(1, 7, 'Manuel Rodríguez', 'Mediocampista'),
(1, 1, 'Andrés García', 'Arquero');
