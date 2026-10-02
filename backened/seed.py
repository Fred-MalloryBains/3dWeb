import os 
import requests
from app import app, db
from models import Actor, Movie, Cast
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
BASE_URL = os.getenv("BASE_URL")
ALLOWED_LANGUAGES = {"en"}
MIN_VOTE_COUNT = 50
MAX_CAST_PER_MOVIE = 10


def fetch_popular_actors(page=1):
    params = {
        "api_key": TMDB_API_KEY,
        "language": "en-US",
        "page": page,
    }
    response = requests.get(
        f"{BASE_URL}/person/popular",
        params=params,
        timeout=20
    )
    response.raise_for_status()
    data = response.json()
    return [
        person for person in data.get("results", [])
        if person.get("known_for_department") == "Acting"
        and not person.get("adult", False)
    ]

def is_valid_movie(movie_data):
    """
    Validates movie criteria:
    - Excludes adult content
    - Enforces language constraint (e.g., English)
    - Drops zero-vote or obscure shorts/student projects
    """
    if movie_data.get("adult", False):
        return False

    # Filter by original language (e.g., filters out 'hi', 'es', etc.)
    if movie_data.get("original_language") not in ALLOWED_LANGUAGES:
        return False

    # Ensure it's a recognized theatrical/streaming release, not an obscure short
    # TMDB movie_credits returns 'vote_count'
    vote_count = movie_data.get("vote_count", 0)
    if vote_count < MIN_VOTE_COUNT:
        return False
    genre_ids = movie_data.get("genre_ids", [])
    # Exclude documentaries, shorts, and adult genres (if any)
    # For simplicity, we can filter out genre_ids that correspond to documentaries (99) and shorts (10770)
    if 99 in genre_ids or 10770 in genre_ids:
        return False

    return True


def fetch_actor_movies(actor_id):
    params = {"api_key": TMDB_API_KEY}
    url = f"{BASE_URL}/person/{actor_id}/movie_credits"
    res = requests.get(url, params=params, timeout=20)
    res.raise_for_status()
    data = res.json()
    
    raw_cast = data.get("cast", [])
    # Apply movie-level filters immediately
    return [m for m in raw_cast if is_valid_movie(m)]


def fetch_movie_cast(movie_id):
    params = {"api_key": TMDB_API_KEY}
    url = f"{BASE_URL}/movie/{movie_id}/credits"
    res = requests.get(url, params=params, timeout=20)
    res.raise_for_status()
    data = res.json()

    cast = data.get("cast", [])
    
    # TMDB sorts cast by 'order' (billing rank: 0 is lead actor).
    # Filter out adult actors and take only the top billed cast.
    filtered_cast = [
        c for c in cast
        if not c.get("adult", False)
        and c.get("known_for_department", "Acting") == "Acting"
    ]
    filtered_cast.sort(key=lambda x: x.get("order", 999))
    return filtered_cast[:MAX_CAST_PER_MOVIE]


def populate_db(num_pages=5):
    with app.app_context():
        for page in range(1, num_pages + 1):
            print(f"Fetching popular actors page {page}...")
            actors = fetch_popular_actors(page)
            print (len(actors), "actors fetched.")

            for actor_data in actors:
                actor = Actor.query.get(actor_data["id"])
                if not actor:
                    actor = Actor(
                        id=actor_data["id"],
                        name=actor_data["name"],
                        profile_path=actor_data.get("profile_path"),
                        popularity=actor_data.get("popularity", 0.0),
                    )
                    db.session.add(actor)

                # Fetch and filter actor's movies
                valid_movies = fetch_actor_movies(actor.id)

                for movie_data in valid_movies:
                    movie = Movie.query.get(movie_data["id"])
                    if not movie:
                        movie = Movie(
                            id=movie_data["id"],
                            title=movie_data.get("title") or "Unknown",
                            poster_path=movie_data.get("poster_path"),
                            release_date=movie_data.get("release_date") or None,
                            popularity=movie_data.get("popularity", 0.0),
                        )
                        db.session.add(movie)

                    # Ingest top cast members for this movie
                    top_cast = fetch_movie_cast(movie.id)
                    for cast_member in top_cast:
                        cast_actor = Actor.query.get(cast_member["id"])
                        if not cast_actor:
                            cast_actor = Actor(
                                id=cast_member["id"],
                                name=cast_member.get("name"),
                                profile_path=cast_member.get("profile_path"),
                                popularity=cast_member.get("popularity", 0.0),
                            )
                            db.session.add(cast_actor)

                        existing_cast = Cast.query.filter_by(
                            actor_id=cast_member["id"],
                            movie_id=movie.id
                        ).first()

                        if not existing_cast:
                            db.session.add(Cast(
                                actor_id=cast_member["id"],
                                movie_id=movie.id
                            ))

                # Commit per primary actor iteration to persist in batches
                db.session.commit()

        print("Database populated successfully with filtered catalog!")

def clear_db():
    with app.app_context():
        # Order matters if foreign keys are enforced
        Cast.query.delete()
        Movie.query.delete()
        Actor.query.delete()
        db.session.commit()
        print("Database wiped successfully.")