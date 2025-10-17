from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Actor table
class Actor(db.Model):
    __tablename__ = "actors"
    id = db.Column(db.Integer, primary_key=True)  # TMDB actor ID
    name = db.Column(db.String(200), nullable=False)
    profile_path = db.Column(db.String(300))
    popularity = db.Column(db.Float)
    # Relationship to movies through the Cast table
    movies = db.relationship("Cast", back_populates="actor")

# Movie table
class Movie(db.Model):
    __tablename__ = "movies"
    id = db.Column(db.Integer, primary_key=True)  # TMDB movie ID
    title = db.Column(db.String(200), nullable=False)
    poster_path = db.Column(db.String(300))
    release_date = db.Column(db.String(50))
    popularity = db.Column(db.Float)
    # Relationship to actors through the Cast table
    cast = db.relationship("Cast", back_populates="movie")

# Cast table (junction table for many-to-many)
class Cast(db.Model):
    __tablename__ = "cast"
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("actors.id"), nullable=False)
    movie_id = db.Column(db.Integer, db.ForeignKey("movies.id"), nullable=False)
    # Relationships
    actor = db.relationship("Actor", back_populates="movies")
    movie = db.relationship("Movie", back_populates="cast")