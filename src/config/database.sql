-- Create database (run this separately)
-- CREATE DATABASE movie_reservation;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS reserved_seats CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS showtimes CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS theaters CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS reservation_status CASCADE;

-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE reservation_status AS ENUM ('active', 'cancelled');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Genres table
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Movies table
CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    poster_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Movie_Genres table
CREATE TABLE movie_genres (
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

-- Theaters table
CREATE TABLE theaters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL
);

-- Seats table
CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    row_number VARCHAR(2) NOT NULL,
    seat_number INTEGER NOT NULL,
    UNIQUE (theater_id, row_number, seat_number)
);

-- Showtimes table
CREATE TABLE showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL
);

-- Reservations table
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
    seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
    status reservation_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (showtime_id, seat_id)
);

-- Insert default genres
INSERT INTO genres (name) VALUES
    ('Action'),
    ('Comedy'),
    ('Drama'),
    ('Horror'),
    ('Science Fiction'),
    ('Romance'),
    ('Documentary'),
    ('Animation'),
    ('Thriller'),
    ('Adventure')
ON CONFLICT (name) DO NOTHING;

-- Create initial admin user (password: admin123)
INSERT INTO users (username, email, password, role) VALUES
    ('admin', 'admin@example.com', '$2a$10$XgXB8pDEjS8EL1rv6Gg5/.Y2pnYS0VJsyE9z1.9ZUGlTyP9jC0Tz2', 'admin')
ON CONFLICT (email) DO NOTHING; 