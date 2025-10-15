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

def fetch_actor_movies(actor_id):
    url = f"{BASE_URL}/person/{actor_id}/movie_credits?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    return res.json().get('cast', [])

def fetch_movie_cast(movie_id):
    url = f"{BASE_URL}/movie/{movie_id}/credits?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    return res.json().get('cast', [])

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
                        profile_path=actor_data.get('profile_path')
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
                            title=movie_data['title'],
                            poster_path=movie_data.get('poster_path'),
                            release_date=movie_data.get('release_date')
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
                                    name=cast_member['name'],
                                )
                                db.session.add(cast_actor)
                                db.session.commit()

                            # Add cast entry
                            cast_entry = Cast(
                                actor_id=cast_member['id'],
                                movie_id=movie.id,
                                role=cast_member.get('character')
                            )
                            db.session.add(cast_entry)
                            db.session.commit()

        print("Database populated successfully!")

if __name__ == "__main__":
    populate_db(num_pages=1)  # change pages to fetch more actors