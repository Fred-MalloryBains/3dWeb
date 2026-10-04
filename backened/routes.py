import requests
from app import app, db
from models import Actor, Movie, Cast
import os 
from dotenv import load_dotenv
from seed import populate_db, clear_db
from flask import jsonify, request
from sqlalchemy import func
import random

load_dotenv()  # Load environment variables from .env file
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
BASE_URL = os.getenv("BASE_URL")

@app.route("/api/actors/search", methods=["GET"])
def search_actors():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name parameter is required"}), 400
    
    actor = Actor.query.filter(
        db.func.lower(Actor.name) == name.lower()
    ).first()
    
    if actor: 
        return jsonify({
            "id": actor.id,
            "name": actor.name,
            "profile_path": actor.profile_path,
            "source": "database"
        }) 
    if not TMDB_API_KEY or not BASE_URL:
        return jsonify({"error": "TMDB API key or Base URL not configured"}), 500
    
    response = requests.get(
        f"{BASE_URL}/search/person",
        params={
            "api_key": TMDB_API_KEY,
            "query": name,
            "language": "en-US",
            "page": 1,
            "include_adult": False
        },
        timeout=10
    )
    response.raise_for_status()
    
    results = response.json().get("results", [])
    actor_data = next(
        (
            person for person in results
            if person.get("known_for_department") == "Acting"
        ),
        None
    )
    if not actor_data:
        return jsonify({"error": "Actor not found"}), 404
    
    # Save the actor to the database if not already present
    actor = Actor(
        id=actor_data["id"],
        name=actor_data["name"],
        profile_path=actor_data.get("profile_path"),
        popularity=actor_data.get("popularity", 0.0),
    )
    db.session.add(actor)
    db.session.commit()
    
    return jsonify({
        "id": actor.id,
        "name": actor.name,
        "profile_path": actor.profile_path,
        "source": "tmdb"
    })

@app.route("/api/actors", methods=["GET"])
def get_actors():
    actors = Actor.query.all()
    data = [{"id": a.id, "name": a.name, "profile_path": a.profile_path} for a in actors]
    return jsonify(data)

@app.route("/api/movies", methods=["GET"])
def check_actors(actor_a, actor_b):
    # Check if two actors have worked together
    movies = db.session.query(Movie).join(Cast).filter(
        (Cast.actor_id == actor_a.id) | (Cast.actor_id == actor_b.id)
    ).group_by(Movie.id).having(db.func.count(Movie.id) > 1).all()
    return jsonify([{"id": m.id, "title": m.title} for m in movies])

@app.route("/api/get_linking_movies", methods=["GET"])
def get_linking_movies():
    raw_actor1 = request.args.get("actor1")
    raw_actor2 = request.args.get("actor2")
    
    if not raw_actor1 or not raw_actor2:
        return jsonify({"error": "actor1 and actor2 parameters are required"}), 400

    try:
        actor1_id = int(raw_actor1)
        actor2_id = int(raw_actor2)
    except ValueError:
        return jsonify({"error": "Actor IDs must be integers"}), 400

    # 1. Query Local DB First
    linking_movies = (
        db.session.query(Movie)
        .join(Cast, Movie.id == Cast.movie_id)
        .filter(Cast.actor_id.in_([actor1_id, actor2_id]))
        .group_by(Movie.id)
        .having(func.count(Cast.actor_id.distinct()) == 2)
        .all()
    )
    
    if linking_movies:
        return jsonify([
            {
                "id": m.id,
                "title": m.title,
                "poster_path": m.poster_path,
                "popularity": getattr(m, "popularity", 0.0)
            }
            for m in linking_movies
        ])
    
    print ("No linking movies found in local DB, querying TMDB...")
    # 2. TMDB Fallback
    if not TMDB_API_KEY or not BASE_URL:
        return jsonify({"error": "TMDB API key or Base URL not configured"}), 500

    try:
        # Discover movies with both actors (comma separated in with_people means AND)
        response = requests.get(
            f"{BASE_URL}/discover/movie",
            params={
                "api_key": TMDB_API_KEY,
                "with_people": f"{actor1_id},{actor2_id}",
                "language": "en-US",
                "sort_by": "popularity.desc",
                "include_adult": "false"
            },
            timeout=10
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        print (f"TMDB discover returned {len(results)} results for actors {actor1_id} and {actor2_id}.")
        # If discover returns results, verify both are in the cast or return them directly
        if results:
            # Cache discovered movie in DB so future lookups hit local DB
            for m in results:
                if not Movie.query.get(m["id"]):
                    db.session.add(Movie(
                        id=m["id"],
                        title=m.get("title") or "Unknown",
                        poster_path=m.get("poster_path"),
                        popularity=m.get("popularity", 0.0)
                    ))
                for a_id in (actor1_id, actor2_id):
                    if not Cast.query.filter_by(actor_id=a_id, movie_id=m["id"]).first():
                        db.session.add(Cast(actor_id=a_id, movie_id=m["id"]))
            db.session.commit()

            return jsonify([
                {
                    "id": m["id"],
                    "title": m.get("title"),
                    "poster_path": m.get("poster_path"),
                    "popularity": m.get("popularity", 0.0)
                }
                for m in results
            ])

        # Bulletproof fallback: If discover misses uncredited or special appearances,
        # intersect actor1 credits and actor2 credits directly
        credits1 = requests.get(
            f"{BASE_URL}/person/{actor1_id}/movie_credits",
            params={"api_key": TMDB_API_KEY},
            timeout=10
        ).json().get("cast", [])

        credits2 = requests.get(
            f"{BASE_URL}/person/{actor2_id}/movie_credits",
            params={"api_key": TMDB_API_KEY},
            timeout=10
        ).json().get("cast", [])

        ids2 = {m["id"] for m in credits2}
        common_movies = [m for m in credits1 if m["id"] in ids2]

        return jsonify([
            {
                "id": m["id"],
                "title": m.get("title"),
                "poster_path": m.get("poster_path"),
                "popularity": m.get("popularity", 0.0)
            }
            for m in common_movies
        ])

    except requests.exceptions.RequestException as e:
        print(f"TMDB request error: {e}")
        return jsonify({"error": "Failed to query TMDB"}), 502
    
@app.route("/api/fetch_actor_suggestions", methods=["GET"])
def fetch_actor_suggestions():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify([])

    # Search local DB first
    local_results = Actor.query.filter(Actor.name.ilike(f"%{query}%")).limit(10).all()
    if local_results:
        return jsonify([{"id": a.id, "name": a.name} for a in local_results])

    # If no local results, fallback to TMDB
    if not TMDB_API_KEY or not BASE_URL:
        return jsonify({"error": "TMDB API key or Base URL not configured"}), 500

    try:
        response = requests.get(
            f"{BASE_URL}/search/person",
            params={
                "api_key": TMDB_API_KEY,
                "query": query,
                "language": "en-US",
                "page": 1,
                "include_adult": False
            },
            timeout=10
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        
        normalised_query = query.strip().casefold()
        
        actor_suggestions = [
            {"id": person["id"], "name": person["name"]}
            for person in results
            if person.get("known_for_department") == "Acting"
        ][:10]  # Limit to top 10 suggestions

        if any(
            normalised_query == person["name"].strip().casefold()
            for person in actor_suggestions
        ): # Return empty if the query is already in suggestions
            return jsonify([])

    except requests.exceptions.RequestException as e:
        print(f"TMDB request error: {e}")
        return jsonify({"error": "Failed to query TMDB"}), 502


@app.route("/api/get_random_actor", methods=["GET"])
def get_random_actor():
    actors = Actor.query.order_by(Actor.popularity.desc())[:100]
    actor = actors[random.randint(0, 99)] if actors else None
    if actor:
        return jsonify({"id": actor.id, "name": actor.name, "profile_path": actor.profile_path})
    else:
        return jsonify({"error": "No actors found in the database"}), 404

@app.route("/api/get_actor_info", methods=["GET"])
def get_actor_info():
    actor_id = request.args.get("id")
    if not actor_id:
        return jsonify({"error": "No actor ID provided"}), 400

    actor = Actor.query.get(actor_id)
    if not actor:
        try: 
            response = requests.get(
                f"{BASE_URL}/person/{actor_id}",
                params={"api_key": TMDB_API_KEY, "language": "en-US"},
                timeout=10
            )
            response.raise_for_status()
            return jsonify(response.json())
        except requests.exceptions.RequestException as e:
            print(f"TMDB request error: {e}")
            return jsonify({"error": "Failed to query TMDB"}), 502

    return jsonify({
        "id": actor.id,
        "name": actor.name,
        "profile_path": actor.profile_path
    })

@app.route("/api/get_path", methods=["GET"])
def get_path():
    ## This endpoint is a placeholder for the pathfinding logic between two actors.
    pass
       
