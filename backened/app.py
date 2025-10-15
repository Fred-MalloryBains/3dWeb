# backend/app.py
from flask import Flask
from models import db, Actor, Movie, Cast
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'supersecretkey'  # required by Flask-Admin

db.init_app(app)

with app.app_context():
    db.create_all()  # creates tables
    
admin = Admin(app, name="TMDB Admin", template_mode="bootstrap3")

# Add your models to the admin interface
admin.add_view(ModelView(Actor, db.session))
admin.add_view(ModelView(Movie, db.session))
admin.add_view(ModelView(Cast, db.session))

if __name__ == "__main__":
    app.run(debug=True)
    