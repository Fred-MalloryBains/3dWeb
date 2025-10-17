import requests
from app import app, db
from models import Actor, Movie, Cast


TMDB_API_KEY = "1e63f63886eeec27cacf04aa4928da5a"
BASE_URL = "https://api.themoviedb.org/3"

def fetch_popular_actors(page=1):
    url = f"{BASE_URL}/person/popular?api_key={TMDB_API_KEY}&language=en-US&page={page}"
    res = requests.get(url)
    data = res.json()
    return data.get('results', [])


def fetch_actor_by_name(name):
    """
    Try DB first (exact or partial match). If not found, query TMDB and return first result.
    Returns dict similar to TMDB person result or None.
    """
    # exact match
    actor = Actor.query.filter(Actor.name == name).first()
    if not actor:
        # partial/ilike match
        actor = Actor.query.filter(Actor.name.ilike(f"%{name}%")).first()
    if actor:
        return {
            "id": actor.id,
            "name": actor.name,
            "profile_path": actor.profile_path,
            "popularity": actor.popularity
        }

    # Fallback to TMDB
    url = f"{BASE_URL}/search/person?api_key={TMDB_API_KEY}&query={requests.utils.quote(name)}"
    res = requests.get(url)
    data = res.json()
    results = data.get('results', [])
    if results:
        return results[0]
    return None


def fetch_actor_movies(actor_id):
    """
    Try DB first: return movies linked through Cast table.
    If none found in DB, fallback to TMDB movie credits.
    Return a list of movie dicts with at least id, title, poster_path.
    """
    # Query DB
    movies = (db.session.query(Movie)
              .join(Cast, Movie.id == Cast.movie_id)
              .filter(Cast.actor_id == actor_id)
              .distinct()
              .all())
    if movies and len(movies) > 0:
        result = []
        for m in movies:
            result.append({
                "id": m.id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
                "popularity": m.popularity
            })
        return result

    # Fallback to TMDB
    url = f"{BASE_URL}/person/{actor_id}/movie_credits?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    data = res.json()
    return data.get('cast', [])


def fetch_movie_cast(movie_id):
    """
    Try DB first: return cast entries (actors) for the movie.
    If none found in DB, fallback to TMDB movie credits.
    Return a list of cast dicts with id, name, profile_path, and character if available.
    """
    cast_entries = (db.session.query(Actor)
                    .join(Cast, Actor.id == Cast.actor_id)
                    .filter(Cast.movie_id == movie_id)
                    .all())
    if cast_entries and len(cast_entries) > 0:
        result = []
        for a in cast_entries:
            result.append({
                "id": a.id,
                "name": a.name,
                "profile_path": a.profile_path,
                "popularity": a.popularity
            })
        return result
    # Fallback to TMDB
    url = f"{BASE_URL}/movie/{movie_id}/credits?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    data = res.json()
    return data.get('cast', [])


def populate_db(num_pages=1):
    with app.app_context():
        for page in range(1, num_pages+1):
            actors = fetch_popular_actors(page)
            for actor_data in actors:
                # Add actor if not exists
                actor = Actor.query.get(actor_data['id'])
                if not actor:
                    actor = Actor(
                        id=actor_data['id'],
                        name=actor_data['name'],
                        profile_path=actor_data.get('profile_path'),
                        popularity=actor_data.get('popularity')
                    )
                    db.session.add(actor)
                    db.session.commit()

                # Fetch actor's movies
                movies = fetch_actor_movies(actor.id)
                for movie_data in movies:
                    # Add movie if not exists
                    movie = Movie.query.get(movie_data['id'])
                    if not movie:
                        movie = Movie(
                            id=movie_data['id'],
                            title=movie_data.get('title') or movie_data.get('name') or "Unknown",
                            poster_path=movie_data.get('poster_path'),
                            release_date=movie_data.get('release_date'),
                            popularity=movie_data.get('popularity')
                        )
                        db.session.add(movie)
                        db.session.commit()

                    # Fetch cast for this movie
                    cast_list = fetch_movie_cast(movie.id)
                    for cast_member in cast_list:
                        # Add cast entry if not exists
                        existing = Cast.query.filter_by(actor_id=cast_member['id'], movie_id=movie.id).first()
                        if not existing:
                            # Add actor in database if missing
                            cast_actor = Actor.query.get(cast_member['id'])
                            if not cast_actor:
                                cast_actor = Actor(
                                    id=cast_member['id'],
                                    name=cast_member.get('name'),
                                    profile_path=cast_member.get('profile_path'),
                                    popularity=cast_member.get('popularity')
                                )
                                db.session.add(cast_actor)
                                db.session.commit()

                            # Add cast entry
                            cast_entry = Cast(
                                actor_id=cast_member['id'],
                                movie_id=movie.id
                            )
                            db.session.add(cast_entry)
                            db.session.commit()

        print("Database populated successfully!")

if __name__ == "__main__":
    populate_db(num_pages=5)  # change pages to fetch more actors