# Movie Reservation System

A Node.js-based movie reservation system with PostgreSQL database.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL 14
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up PostgreSQL:

```bash
# Start PostgreSQL service
brew services start postgresql@14

# Create database
createdb movie_reservation

# Initialize database schema
psql -d movie_reservation -a -f src/config/database.sql
```

3. Configure environment variables:
   Create a `.env` file in the root directory with the following content:

```
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=movie_reservation
JWT_SECRET=your_jwt_secret_key_here
PORT=3000
```

4. Start the application:

```bash
npm start
```

## Features

- User authentication with JWT
- Movie management (CRUD operations)
- Theater and showtime management
- Seat reservation system
- Admin functionality

## API Endpoints

### Authentication

- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user

### Movies

- GET /api/movies - Get all movies
- GET /api/movies/:id - Get movie by ID
- POST /api/movies - Create new movie (Admin only)
- PUT /api/movies/:id - Update movie (Admin only)
- DELETE /api/movies/:id - Delete movie (Admin only)

### Showtimes

- GET /api/showtimes - Get all showtimes
- GET /api/showtimes/:id - Get showtime by ID
- POST /api/showtimes - Create new showtime (Admin only)
- PUT /api/showtimes/:id - Update showtime (Admin only)
- DELETE /api/showtimes/:id - Delete showtime (Admin only)

### Reservations

- GET /api/reservations - Get user's reservations
- POST /api/reservations - Create new reservation
- PUT /api/reservations/:id - Update reservation status
- DELETE /api/reservations/:id - Cancel reservation

## Default Admin Account

- Email: admin@example.com
- Password: admin123

## License

MIT
