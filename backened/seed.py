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
    
def fetch_top_english_movies(page=1):
    """
    Directly query TMDB's discover API for popular English-language feature films.
    Filters out adult, documentaries (99), and TV movies (10770).
    """
    params = {
        "api_key": TMDB_API_KEY,
        "language": "en-US",
        "with_original_language": "en",
        "sort_by": "popularity.desc",
        "vote_count.gte": MIN_VOTE_COUNT,
        "without_genres": "99,10770",
        "include_adult": "false",
        "page": page,
    }
    response = requests.get(f"{BASE_URL}/discover/movie", params=params, timeout=20)
    response.raise_for_status()
    return response.json().get("results", [])

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


def populate_db(num_pages=10):
    with app.app_context():
        for page in range(1, num_pages + 1):
            print(f"Fetching English discover movies page {page}...")
            movies_data = fetch_top_english_movies(page)

            for m_data in movies_data:
                # 1. Upsert Movie
                movie = db.session.get(Movie, m_data["id"])
                if not movie:
                    movie = Movie(
                        id=m_data["id"],
                        title=m_data.get("title") or "Unknown",
                        poster_path=m_data.get("poster_path"),
                        release_date=m_data.get("release_date") or None,
                        popularity=m_data.get("popularity", 0.0),
                    )
                    db.session.add(movie)
                    db.session.flush()  # Ensure movie ID is tracked in session

                # 2. Ingest Top Cast for this movie
                top_cast = fetch_movie_cast(movie.id)
                for cast_member in top_cast:
                    actor = db.session.get(Actor, cast_member["id"])
                    if not actor:
                        actor = Actor(
                            id=cast_member["id"],
                            name=cast_member.get("name"),
                            profile_path=cast_member.get("profile_path"),
                            popularity=cast_member.get("popularity", 0.0),
                        )
                        db.session.add(actor)
                        db.session.flush()

                    # 3. Create Cast Association
                    existing_cast = Cast.query.filter_by(
                        actor_id=actor.id,
                        movie_id=movie.id
                    ).first()

                    if not existing_cast:
                        db.session.add(Cast(
                            actor_id=actor.id,
                            movie_id=movie.id
                        ))

            # Commit once per discover page
            db.session.commit()
            print(f"Committed page {page} successfully.")

        print("Database populated successfully with English-focused catalog!")

def clear_db():
    with app.app_context():
        # Order matters if foreign keys are enforced
        Cast.query.delete()
        Movie.query.delete()
        Actor.query.delete()
        db.session.commit()
        print("Database wiped successfully.")
        
if __name__ == "__main__":
    #clear_db()  # Uncomment this line if you want to wipe the database before populating
    populate_db(num_pages=20)  #change pages to fetch more actors