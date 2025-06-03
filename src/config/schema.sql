-- Drop existing tables
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS showtimes CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS theaters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create custom types
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('admin', 'user');

DROP TYPE IF EXISTS reservation_status CASCADE;
CREATE TYPE reservation_status AS ENUM ('active', 'cancelled');

DROP TYPE IF EXISTS theater_type CASCADE;
CREATE TYPE theater_type AS ENUM ('Standard', 'VIP', 'IMAX');

-- Create tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    rating VARCHAR(10),
    poster_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE movie_genres (
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

CREATE TABLE theaters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    type theater_type NOT NULL DEFAULT 'Standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    row_number CHAR(1) NOT NULL,
    seat_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(theater_id, row_number, seat_number)
);

CREATE TABLE showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
    seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
    status reservation_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(showtime_id, seat_id)
);

-- Insert default admin user
INSERT INTO users (email, password, role) VALUES
('admin@example.com', '$2a$10$rYXvzUzgG1WxYX/RYpXyaOY6LqkNwJh3w5qPtAcRNJnEgZBF8YhyS', 'admin'); -- password: admin123

-- Insert sample genres
INSERT INTO genres (name) VALUES
('Action'),
('Adventure'),
('Comedy'),
('Drama'),
('Science Fiction'),
('Thriller'); 