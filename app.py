from flask import Flask, render_template, request, jsonify
from models import db, Notes, Quotes, Tasks, TaskStatuses, TaskUrgency, TaskEffort, TaskGroups, TaskUpdates, TaskTags, TaskDependencies, TaskSteps
from dotenv import load_dotenv
import os
import random
from datetime import datetime

load_dotenv()

app = Flask(__name__)
db_user = os.getenv('DATABASE_USER')
db_password = os.getenv('DATABASE_PASSWORD')
db_host = os.getenv('DATABASE_HOST')
db_port = os.getenv('DATABASE_PORT')
db_dbs = os.getenv('DATABASE_DBS')
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_dbs}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

@app.route('/')
def index():
    notes = Notes.query.filter_by(status='active').all()
    groups = TaskGroups.query.all()
    statuses = TaskStatuses.query.all()
    urgencies = TaskUrgency.query.all()
    efforts = TaskEffort.query.all()
    tasks = Tasks.query.all()
    for task in tasks:
        task.urgency = TaskUrgency.query.get(task.urgency_id)
        task.effort = TaskEffort.query.get(task.effort_id)
        task.status = TaskStatuses.query.get(task.status_id)
    return render_template('index.html', notes=notes, groups=groups, tasks=tasks, statuses=statuses, urgencies=urgencies, efforts=efforts)

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
    return jsonify({'success': False}), 404

@app.route('/update_order', methods=['POST'])
def update_order():
    data = request.get_json()
    for item in data['order']:
        note = Notes.query.get(item['id'])
        if note:
            note.order = item['order']
    db.session.commit()
    return jsonify(success=True)

@app.route('/random_quote')
def random_quote():
    quotes = Quotes.query.filter_by(status="active").all()
    if quotes:
        quote = random.choice(quotes)
        return jsonify({
            'quote': quote.quote,
            'author': quote.author
        })
    return jsonify({'quote': '', 'author': ''})

@app.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Tasks.query.all()
    task_list = []
    for task in tasks:
        urgency = TaskUrgency.query.get(task.urgency_id)
        effort = TaskEffort.query.get(task.effort_id)
        status = TaskStatuses.query.get(task.status_id)
        task_list.append({
            'id': task.id,
            'order': task.order,
            'group_id': task.group_id,
            'title': task.title,
            'description': task.description,
            'urgency': {
                'id': urgency.id,
                'name': urgency.name,
                'color_hex': urgency.color_hex
            },
            'effort': {
                'id': effort.id,
                'name': effort.name,
                'color_hex': effort.color_hex
            },
            'status': {
                'id': status.id,
                'name': status.name,
                'color_hex': status.color_hex
            },
            'deadline': task.deadline.isoformat() if task.deadline else None,
            'statuses': [{'id': s.id, 'name': s.name, 'color_hex': s.color_hex} for s in TaskStatuses.query.all()]
        })
    return jsonify(task_list)

@app.route('/update_task_status/<int:task_id>', methods=['POST'])
def update_task_status(task_id):
    task = Tasks.query.get(task_id)
    if task:
        new_status_id = request.json.get('status_id')
        task.status_id = new_status_id
        new_group_id = TaskStatuses.query.get(new_status_id).group_id
        task.group_id = new_group_id
        db.session.commit()
        return jsonify(success=True, new_group_id=new_group_id)
    return jsonify(success=False)

@app.route('/update_group_status/<int:group_id>', methods=['POST'])
def update_group_status(group_id):
    group = TaskGroups.query.get(group_id)
    if group:
        new_status = request.json.get('status')
        group.status = new_status
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/add_task', methods=['POST'])
def add_task():
    try:
        data = request.get_json()
        print("Received data:", data)  # Log the received data

        # Check if data is None
        if data is None:
            raise ValueError("No data received")

        # Check for required fields
        required_fields = ['title', 'description', 'deadline', 'urgency_id', 'effort_id']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Set default values for fields that may not be provided
        order = data.get('order', 1)  # Default order to 1 if not provided
        group_id = data.get('group_id', 1)  # Default group_id to 1 if not provided
        tag_id = data.get('tag_id', 1)  # Default tag_id to 1 (Placeholder)

        # Convert deadline to datetime
        deadline = datetime.strptime(data['deadline'], '%Y-%m-%dT%H:%M')

        new_task = Tasks(
            order=order,
            group_id=group_id,
            title=data['title'],
            description=data['description'],
            tag_id=tag_id,
            urgency_id=data['urgency_id'],
            effort_id=data['effort_id'],
            status_id=1,  # Assuming 'backlog' status has id 1
            deadline=deadline,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        db.session.add(new_task)
        db.session.commit()
        print("Task added successfully")
        return jsonify({'success': True, 'task_id': new_task.id})
    except Exception as e:
        print(f"Error: {e}")  # Log the error for debugging
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/add_task_step', methods=['POST'])
def add_task_step():
    data = request.get_json()
    new_step = TaskSteps(
        task_id=data['task_id'],
        title=data['title'],
        description=data['description'],
        status=data['status']
    )
    db.session.add(new_step)
    db.session.commit()
    return jsonify({'success': True, 'step_id': new_step.id})

@app.route('/toggle_group_status/<int:group_id>', methods=['POST'])
def toggle_group_status(group_id):
    group = TaskGroups.query.get(group_id)
    if group:
        new_status = request.json.get('status')
        group.status = new_status
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)