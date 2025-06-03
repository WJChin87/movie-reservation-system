-- Drop existing tables if they exist
DROP TABLE IF EXISTS reserved_seats CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS showtimes CASCADE;
DROP TABLE IF EXISTS theaters CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    genre VARCHAR(50) NOT NULL,
    rating VARCHAR(10),
    poster_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS theaters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seats (
    id SERIAL PRIMARY KEY,
    theater_id INTEGER REFERENCES theaters(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(theater_id, row_number, seat_number)
);

CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reserved_seats (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
    seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reservation_id, seat_id)
);

-- Insert sample data
INSERT INTO movies (title, description, duration, genre, rating, poster_url) VALUES
('The Dark Knight', 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', 152, 'Action', 'PG-13', 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg'),
('Inception', 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', 148, 'Sci-Fi', 'PG-13', 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg'),
('Interstellar', 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity''s survival.', 169, 'Sci-Fi', 'PG-13', 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'),
('The Matrix', 'A computer programmer discovers that reality as he knows it is a simulation created by machines, and joins a rebellion to break free.', 136, 'Sci-Fi', 'R', 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'),
('Pulp Fiction', 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.', 154, 'Crime', 'R', 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg');

INSERT INTO theaters (name, capacity, type) VALUES
('Main Hall', 200, 'Standard'),
('VIP Theater', 50, 'VIP'),
('IMAX Experience', 150, 'IMAX');

-- Insert showtimes for the next 7 days
INSERT INTO showtimes (movie_id, theater_id, start_time, price)
SELECT 
    m.id,
    t.id,
    CURRENT_DATE + (n || ' days')::INTERVAL + (hour || ' hours')::INTERVAL,
    CASE 
        WHEN t.type = 'VIP' THEN 20.00
        WHEN t.type = 'IMAX' THEN 18.00
        ELSE 15.00
    END
FROM generate_series(0, 6) n
CROSS JOIN generate_series(12, 22, 3) hour
CROSS JOIN movies m
CROSS JOIN theaters t;

-- Generate seats for each theater
INSERT INTO seats (theater_id, row_number, seat_number)
SELECT 
    t.id,
    row_number,
    seat_number
FROM theaters t
CROSS JOIN generate_series(1, CASE 
    WHEN t.type = 'VIP' THEN 5
    ELSE 10
END) row_number
CROSS JOIN generate_series(1, CASE 
    WHEN t.type = 'VIP' THEN 10
    WHEN t.type = 'IMAX' THEN 15
    ELSE 20
END) seat_number; 