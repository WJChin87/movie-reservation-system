-- Insert sample movies
INSERT INTO movies (title, description, duration, rating, poster_url) VALUES
    ('The Dark Knight', 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', 152, 'PG-13', 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg'),
    ('Inception', 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', 148, 'PG-13', 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg'),
    ('Interstellar', 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity''s survival.', 169, 'PG-13', 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'),
    ('The Matrix', 'A computer programmer discovers that reality as he knows it is a simulation created by machines, and joins a rebellion to break free.', 136, 'R', 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'),
    ('Pulp Fiction', 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.', 154, 'R', 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg');

-- Assign genres to movies
INSERT INTO movie_genres (movie_id, genre_id) VALUES
    (1, 1), -- Dark Knight - Action
    (1, 4), -- Dark Knight - Drama
    (1, 6), -- Dark Knight - Thriller
    (2, 1), -- Inception - Action
    (2, 5), -- Inception - Science Fiction
    (2, 6), -- Inception - Thriller
    (3, 2), -- Interstellar - Adventure
    (3, 4), -- Interstellar - Drama
    (3, 5), -- Interstellar - Science Fiction
    (4, 1), -- Matrix - Action
    (4, 5), -- Matrix - Science Fiction
    (5, 4), -- Pulp Fiction - Drama
    (5, 6); -- Pulp Fiction - Thriller

-- Insert sample theaters with types
INSERT INTO theaters (name, capacity, type) VALUES
    ('Main Hall', 100, 'Standard'),
    ('VIP Theater', 50, 'VIP'),
    ('IMAX Experience', 150, 'IMAX');

-- Insert sample showtimes for each movie (next 5 days, multiple times per day)
INSERT INTO showtimes (movie_id, theater_id, start_time, price)
SELECT 
    m.id as movie_id,
    t.id as theater_id,
    (CURRENT_DATE + (d || ' days')::INTERVAL + (h || ' hours')::INTERVAL)::TIMESTAMP as start_time,
    CASE 
        WHEN t.type = 'VIP' THEN 20.00
        WHEN t.type = 'IMAX' THEN 18.00
        ELSE 15.00
    END as price
FROM 
    movies m
    CROSS JOIN theaters t
    CROSS JOIN generate_series(1, 5) d -- next 5 days
    CROSS JOIN generate_series(12, 22, 3) h -- showtimes at 12:00, 15:00, 18:00, 21:00
WHERE 
    -- Assign specific movies to specific theaters
    (m.title = 'The Dark Knight' AND t.type IN ('IMAX', 'Standard')) OR
    (m.title = 'Inception' AND t.type IN ('IMAX', 'VIP')) OR
    (m.title = 'Interstellar' AND t.type = 'IMAX') OR
    (m.title = 'The Matrix' AND t.type IN ('Standard', 'VIP')) OR
    (m.title = 'Pulp Fiction' AND t.type IN ('Standard', 'VIP'))
ORDER BY start_time;

-- Insert sample seats for each theater
INSERT INTO seats (theater_id, row_number, seat_number)
SELECT 
    t.id as theater_id,
    chr(64 + row_num) as row_number,
    seat_num as seat_number
FROM 
    theaters t
    CROSS JOIN generate_series(1, 10) row_num -- 10 rows
    CROSS JOIN generate_series(1, 15) seat_num -- 15 seats per row
ORDER BY t.id, row_number, seat_number; 