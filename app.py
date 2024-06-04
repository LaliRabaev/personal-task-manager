from flask import Flask, render_template, request, jsonify
from models import db, Notes, Quotes, Tasks, TaskStatuses, TaskUrgency, TaskEffort, TaskGroups, TaskUpdates, TaskTags, TaskDependencies, TaskSteps
from dotenv import load_dotenv
import os
import random
from datetime import datetime
from werkzeug.utils import secure_filename
import json

load_dotenv()

app = Flask(__name__)
db_user = os.getenv('DATABASE_USER')
db_password = os.getenv('DATABASE_PASSWORD')
db_host = os.getenv('DATABASE_HOST')
db_port = os.getenv('DATABASE_PORT')
db_dbs = os.getenv('DATABASE_DBS')
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_dbs}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['UPLOAD_FOLDER'] = 'static/uploads'

db.init_app(app)

@app.route('/')
def index():
    notes = Notes.query.filter_by(status='active').order_by(Notes.note_order).all()
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
    note_content = request.form.get('note')
    file = request.files.get('file')
    tags = request.form.get('tags')
    tag_names = json.loads(tags)
    tag_objects = TaskTags.query.filter(TaskTags.name.in_(tag_names)).all()

    if note_content or file:
        new_note = Notes(note_content=note_content if note_content else '')
        new_note.tags = tag_objects

        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                file.save(file_path)
                new_note.image_path = file_path.replace('\\', '/')
            except Exception as e:
                return jsonify(success=False, message="Error saving file."), 500

        db.session.add(new_note)
        db.session.commit()

        return jsonify(
            success=True, 
            note_id=new_note.id, 
            note_content=new_note.note_content, 
            created_at=new_note.created_at.strftime('%Y-%m-%d %H:%M:%S'), 
            image_path=new_note.image_path,
            tags=[{'name': tag.name, 'color_hex': tag.color_hex} for tag in new_note.tags]
        )

    return jsonify(success=False, message="Note content or file must be provided."), 400

@app.route('/edit/<int:note_id>', methods=['POST'])
def edit_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        note_content = request.json.get('note_content')
        tags = request.json.get('tags')
        tag_names = tags if tags else []
        tag_objects = TaskTags.query.filter(TaskTags.name.in_(tag_names)).all()
        note.note_content = note_content
        note.tags = tag_objects
        note.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False, message="Note not found")

@app.route('/tags')
def get_tags():
    query = request.args.get('query', '')
    tags = TaskTags.query.filter(TaskTags.name.like(f'%{query}%')).all()
    return jsonify([{'name': tag.name, 'color_hex': tag.color_hex} for tag in tags])

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
    data = request.json
    try:
        for item in data['order']:
            note = Notes.query.get(item['id'])
            if note:
                note.note_order = item['order']
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        print(f"Error updating order: {e}")
        return jsonify(success=False), 500

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
        return jsonify({'success': True, 'task_id': new_task.id})
    except Exception as e:
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

@app.route('/get_task/<int:task_id>', methods=['GET'])
def get_task(task_id):
    task = Tasks.query.get(task_id)
    if task:
        return jsonify({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'deadline': task.deadline.isoformat(),
            'urgency_id': task.urgency_id,
            'effort_id': task.effort_id,
            'status': {
                'id': task.status.id,
                'name': task.status.name,
                'color_hex': task.status.color_hex
            }
        })
    return jsonify({'error': 'Task not found'}), 404

@app.route('/edit_task/<int:task_id>', methods=['POST'])
def edit_task(task_id):
    task = Tasks.query.get_or_404(task_id)
    data = request.json
    task.title = data['title']
    task.description = data['description']
    task.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d')
    task.urgency_id = data['urgency_id']
    task.effort_id = data['effort_id']
    task.status_id = data['status_id']
    db.session.commit()
    return jsonify(success=True)

@app.route('/urgencies', methods=['GET'])
def get_urgencies():
    urgencies = TaskUrgency.query.all()
    urgency_list = [{'id': urgency.id, 'name': urgency.name} for urgency in urgencies]
    return jsonify(urgency_list)

@app.route('/efforts', methods=['GET'])
def get_efforts():
    efforts = TaskEffort.query.all()
    effort_list = [{'id': effort.id, 'name': effort.name} for effort in efforts]
    return jsonify(effort_list)

@app.route('/statuses', methods=['GET'])
def get_statuses():
    statuses = TaskStatuses.query.all()
    status_list = [{'id': status.id, 'name': status.name} for status in statuses]
    return jsonify(status_list)

@app.route('/delete_task/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Tasks.query.get(task_id)
    if task:
        db.session.delete(task)
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False, error="Task not found"), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)