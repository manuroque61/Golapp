USE golapp;

-- Passwords hash se insertarán desde Node si corrés seeds por script,
-- pero dejamos algunos datos de ejemplo mínimos.

INSERT INTO tournaments (name, season) VALUES ('Torneo Apertura', 2025);

INSERT INTO teams (name, emoji, tournament_id) VALUES 
('Los Tigres FC', '🐯', 1),
('Leones FC', '🦁', 1),
('Águilas United', '🦅', 1),
('Pumas Dorados', '🦒', 1);

-- Jugadores base
INSERT INTO players (team_id, number, name, position) VALUES
(1, 10, 'Diego Pérez', 'Delantero'),
(1, 7, 'Manuel Rodríguez', 'Mediocampista'),
(1, 1, 'Andrés García', 'Arquero');

