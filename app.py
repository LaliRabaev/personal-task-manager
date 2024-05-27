from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
db_user = os.getenv('DATABASE_USER')
db_password = os.getenv('DATABASE_PASSWORD')
db_host = os.getenv('DATABASE_HOST')
db_port = os.getenv('DATQABASE_PORT')
db_dbs = os.getenv('DATABASE_DBS')
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_dbs}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Notes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    note_order = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    note_content = db.Column(db.Text, nullable=False)
    is_starred = db.Column(db.Boolean, default=False)
    tag = db.Column(db.String(255))
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

@app.route('/')
def index():
    notes = Notes.query.filter_by(status='active').all()
    return render_template('index.html', notes=notes)

@app.route('/add', methods=['POST'])
def add_note():
    note_content = request.form['note']
    if note_content:
        new_note = Notes(note_content=note_content)
        db.session.add(new_note)
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/edit/<int:note_id>', methods=['POST'])
def edit_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        note_content = request.json.get('note_content')
        note.note_content = note_content
        note.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/delete/<int:note_id>', methods=['POST'])
def delete_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        note.status = 'inactive'
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/star/<int:note_id>', methods=['POST'])
def star_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        data = request.get_json()
        note.is_starred = int(data['is_starred'])
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False), 404

@app.route('/update_order', methods=['POST'])
def update_order():
    data = request.get_json()
    for item in data['order']:
        note = Notes.query.get(item['id'])
        if note:
            note.order = item['order']
    db.session.commit()
    return jsonify(success=True)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)