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

@app.route('/tags', methods=['GET'])
def get_tags():
    query = request.args.get('query', '')
    tags = TaskTags.query.filter(TaskTags.name.ilike(f"%{query}%")).all()
    return jsonify([{'id': tag.id, 'name': tag.name, 'color_hex': tag.color_hex} for tag in tags])

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
    try:
        tasks = Tasks.query.all()
        task_list = []
        for task in tasks:
            urgency = TaskUrgency.query.get(task.urgency_id)
            effort = TaskEffort.query.get(task.effort_id)
            status = TaskStatuses.query.get(task.status_id)
            tags = task.tags
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
                'tags': [{'id': tag.id, 'name': tag.name, 'color_hex': tag.color_hex} for tag in tags],
                'deadline': task.deadline.isoformat() if task.deadline else None,
                'statuses': [{'id': s.id, 'name': s.name, 'color_hex': s.color_hex} for s in TaskStatuses.query.all()]
            })
        return jsonify(task_list)
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        return jsonify({'error': 'Error fetching tasks'}), 500

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
    data = request.json
    title = data.get('title')
    description = data.get('description')
    deadline = data.get('deadline')
    urgency_id = data.get('urgency_id')
    effort_id = data.get('effort_id')
    status_id = data.get('status_id', 1)
    group_id = data.get('group_id', 1)  # Ensure group_id is always set to 1
    selected_tags = data.get('tags', [])
    new_tags = data.get('new_tags', [])

    # Create task
    task = Tasks(
        title=title,
        description=description,
        deadline=deadline,
        urgency_id=urgency_id,
        effort_id=effort_id,
        status_id=status_id,
        group_id=group_id
    )
    db.session.add(task)
    db.session.commit()

    # Add selected tags to task
    for tag_id in selected_tags:
        tag = TaskTags.query.get(tag_id)
        if tag:
            task.tags.append(tag)

    # Add new tags to task
    for tag_name in new_tags:
        existing_tag = TaskTags.query.filter_by(name=tag_name).first()
        if not existing_tag:
            new_tag = TaskTags(name=tag_name)
            db.session.add(new_tag)
            task.tags.append(new_tag)
        else:
            task.tags.append(existing_tag)

    db.session.commit()

    return jsonify({'success': True, 'task_id': task.id})


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
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'deadline': task.deadline.isoformat(),  # Ensure deadline is in ISO format
            'urgency_id': task.urgency_id,
            'effort_id': task.effort_id,
            'status': {'id': task.status.id, 'name': task.status.name, 'color_hex': task.status.color_hex},
            'tags': [{'id': tag.id, 'name': tag.name, 'color_hex': tag.color_hex} for tag in task.tags]
        }
        return jsonify(task_data)
    else:
        return jsonify({'error': 'Task not found'}), 404

@app.route('/edit_task/<int:task_id>', methods=['POST'])
def edit_task(task_id):
    data = request.json
    task = Tasks.query.get_or_404(task_id)

    task.title = data.get('title')
    task.description = data.get('description')
    task.deadline = data.get('deadline')
    task.urgency_id = data.get('urgency_id')
    task.effort_id = data.get('effort_id')
    task.status_id = data.get('status_id')

    # Update tags
    task.tags = []
    selected_tags = data.get('tags', [])
    new_tags = data.get('new_tags', [])

    for tag_id in selected_tags:
        tag = TaskTags.query.get(tag_id)
        if tag:
            task.tags.append(tag)

    for tag_name in new_tags:
        new_tag = TaskTags(name=tag_name)
        db.session.add(new_tag)
        task.tags.append(new_tag)

    db.session.commit()

    return jsonify({'success': True})

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