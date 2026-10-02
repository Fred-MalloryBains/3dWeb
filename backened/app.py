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

import routes
admin = Admin(app, name="TMDB Admin", template_mode="bootstrap3")

# Add your models to the admin interface
admin.add_view(ModelView(Actor, db.session))
admin.add_view(ModelView(Movie, db.session))
admin.add_view(ModelView(Cast, db.session))



if __name__ == "__main__":
    app.run(debug=True)

