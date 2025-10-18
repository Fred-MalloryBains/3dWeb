# backend/app.py
from flask import Flask, jsonify, request
from models import db, Actor, Movie, Cast
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from sqlalchemy import func
from flask_migrate import Migrate
from flask_cors import CORS



app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'supersecretkey'  # required by Flask-Admin
CORS(app)

db.init_app(app)
migrate = Migrate(app, db)  

with app.app_context():
    db.create_all()  # creates tables
    
admin = Admin(app, name="TMDB Admin")

# Add your models to the admin interface
admin.add_view(ModelView(Actor, db.session))
admin.add_view(ModelView(Movie, db.session))
admin.add_view(ModelView(Cast, db.session))

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
    app.run(debug=True)

