USE golapp;

-- Passwords hash se insertarán desde Node si corrés seeds por script,
-- pero dejamos algunos datos de ejemplo mínimos.

INSERT INTO users (name, email, password_hash, role, team_id)
VALUES ('Admin Demo', 'admin@golapp.com', '$2a$10$37KG0wvcmPZAIq9VlUbAv.2C.aJvN6R0VEeyMNrswzTu6/ZBbjpUG', 'admin', NULL);

INSERT INTO tournaments (name, season, status, admin_id, total_rounds, start_date, match_time, location)
VALUES ('Torneo Apertura', 2025, 'active', 1, 3, '2025-01-10', '16:00:00', 'Cancha Central');

INSERT INTO teams (name, emoji, tournament_id) VALUES 
('Los Tigres FC', '🐯', 1),
('Leones FC', '🦁', 1),
('Águilas United', '🦅', 1),
('Pumas Dorados', '🦒', 1);

-- Jugadores base
INSERT INTO players (team_id, number, name, position, email) VALUES
(1, 10, 'Diego Pérez', 'Delantero', 'diego.perez@example.com'),
(1, 7, 'Manuel Rodríguez', 'Mediocampista', 'manuel.rodriguez@example.com'),
(1, 1, 'Andrés García', 'Arquero', 'andres.garcia@example.com');

