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

CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    rating VARCHAR(10),
    poster_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movies_title ON movies(title);

CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE movie_genres (
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

CREATE INDEX idx_movie_genres_movie ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre ON movie_genres(genre_id);

CREATE TABLE theaters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    type theater_type NOT NULL DEFAULT 'Standard',
    base_price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_theaters_type ON theaters(type);

CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    row_number CHAR(1) NOT NULL,
    seat_number INTEGER NOT NULL,
    premium_factor DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(theater_id, row_number, seat_number)
);

CREATE INDEX idx_seats_theater ON seats(theater_id);
CREATE INDEX idx_seats_location ON seats(theater_id, row_number, seat_number);

CREATE TABLE showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    price_multiplier DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_showtimes_movie ON showtimes(movie_id);
CREATE INDEX idx_showtimes_theater ON showtimes(theater_id);
CREATE INDEX idx_showtimes_start_time ON showtimes(start_time);
CREATE INDEX idx_showtimes_upcoming ON showtimes(start_time) WHERE start_time > CURRENT_TIMESTAMP;

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
    seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    status reservation_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    UNIQUE(showtime_id, seat_id)
);

CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_showtime ON reservations(showtime_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_active_user ON reservations(user_id, status) WHERE status = 'active';
CREATE INDEX idx_reservations_active_showtime ON reservations(showtime_id, status) WHERE status = 'active';

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_movies_updated_at
    BEFORE UPDATE ON movies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_theaters_updated_at
    BEFORE UPDATE ON theaters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_showtimes_updated_at
    BEFORE UPDATE ON showtimes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for upcoming showtimes with availability
CREATE OR REPLACE VIEW upcoming_showtimes_availability AS
SELECT 
    s.id,
    s.start_time,
    s.price,
    m.title as movie_title,
    t.name as theater_name,
    t.capacity,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active') as booked_seats,
    t.capacity - COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active') as available_seats,
    CASE 
        WHEN t.capacity - COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active') = 0 THEN true 
        ELSE false 
    END as is_sold_out
FROM showtimes s
JOIN movies m ON s.movie_id = m.id
JOIN theaters t ON s.theater_id = t.id
LEFT JOIN reservations r ON s.id = r.showtime_id
WHERE s.start_time > CURRENT_TIMESTAMP
GROUP BY s.id, m.title, t.name, t.capacity; 