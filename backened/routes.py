import requests
from app import app, db
from models import Actor, Movie, Cast
import os 
from dotenv import load_dotenv
from seed import populate_db, clear_db
from flask import jsonify, request 


load_dotenv()  # Load environment variables from .env file
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
BASE_URL = os.getenv("BASE_URL")

@app.route("/api/actors/search", methods=["GET"])
def search_actors():
    print ("log: search_actors called")
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
    print (results)
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
    actor1_id = request.args.get("actor1")
    actor2_id = request.args.get("actor2")
    
    if not actor1_id or not actor2_id:
        return jsonify({"error": "Invalid actor IDs"}), 400

    # Fetch linking movies from the database
    linking_movies = (
        db.session.query(Movie)
        .join(Cast)
        .filter(Cast.actor_id.in_([actor1_id, actor2_id]))
        .group_by(Movie.id)
        .having(func.count(Cast.actor_id.distinct()) == 2)  # both actors must be present
        .all()
    )
    
    return jsonify([{"id": m.id, "title": m.title, "poster_path": m.poster_path} for m in linking_movies])
        
if __name__ == "__main__":
    #clear_db()  # Uncomment this line if you want to wipe the database before populating
    populate_db(num_pages=5)  # change pages to fetch more actors