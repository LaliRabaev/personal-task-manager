from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer
from dotenv import load_dotenv
import os
import random
from datetime import datetime
from werkzeug.utils import secure_filename
import json
import logging

from models import db, Notes, Quotes, Tasks, TaskStatuses, TaskUrgency, TaskEffort, TaskGroups, TaskUpdates, TaskTags, TaskDependencies, TaskSteps, Conversation, Message as ChatMessage, Users
from openai_integration.data_manager import DataManager
from openai_integration.openai_client import OpenAI_Client

load_dotenv()

app = Flask(__name__)
db_user = os.getenv('DATABASE_USER')
db_password = os.getenv('DATABASE_PASSWORD')
db_host = os.getenv('DATABASE_HOST')
db_port = os.getenv('DATABASE_PORT')
db_dbs = os.getenv('DATABASE_DBS')
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_dbs}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['UPLOAD_FOLDER'] = 'static/uploads'

# Mail configuration
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USERNAME'] = 'your_email@example.com'
app.config['MAIL_PASSWORD'] = 'your_email_password'
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False

db.init_app(app)
mail = Mail(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# Set up basic logging
logging.basicConfig(level=logging.DEBUG)

@login_manager.user_loader
def load_user(user_id):
    return Users.query.get(int(user_id))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', None)
        password = request.form.get('password', None)
        if not email or not password:
            flash('Please enter both email and password.')
            return redirect(url_for('login'))

        logging.debug(f"Attempting to log in with email: {email}")
        user = Users.query.filter_by(email=email).first()
        if user:
            logging.debug(f"User found: {user.email}")
            logging.debug(f"Stored hashed password: {user.password}")
            if check_password_hash(user.password, password):
                login_user(user)
                logging.debug(f"Login successful for user: {user.email}")
                return redirect(url_for('index'))
            else:
                logging.debug("Password does not match")
                flash('Invalid email or password')
        else:
            logging.debug("User not found")
            flash('Invalid email or password')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        email = request.form['email']
        user = Users.query.filter_by(email=email).first()
        if user:
            token = s.dumps(user.email, salt='password-reset-salt')
            msg = Message(
                'Password Reset Request',
                sender='noreply@demo.com',
                recipients=[user.email]
            )
            msg.body = f'Your password reset link is: {url_for("reset_password_token", token=token, _external=True)}'
            mail.send(msg)
            flash('A password reset email has been sent.', 'info')
        else:
            flash('Email not found', 'danger')
    return render_template('reset_password.html')

@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password_token(token):
    try:
        email = s.loads(token, salt='password-reset-salt', max_age=3600)
    except:
        flash('The reset link is invalid or has expired.', 'danger')
        return redirect(url_for('reset_password'))

    if request.method == 'POST':
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        if password == confirm_password:
            user = Users.query.filter_by(email=email).first()
            if user:
                user.password = generate_password_hash(password, method='pbkdf2:sha256')
                db.session.commit()
                flash('Your password has been updated!', 'success')
                return redirect(url_for('login'))
            else:
                flash('Invalid or expired token', 'danger')
    return render_template('reset_password_token.html', token=token)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', None)
        first_name = request.form.get('first_name', None)
        last_name = request.form.get('last_name', None)
        email = request.form.get('email', None)
        password = request.form.get('password', None)
        confirm_password = request.form.get('confirm_password', None)

        if not username or not first_name or not last_name or not email or not password or not confirm_password:
            flash('Please fill out all fields.')
            return redirect(url_for('register'))

        if password != confirm_password:
            flash('Passwords do not match')
            return redirect(url_for('register'))

        existing_user = Users.query.filter_by(email=email).first()
        if existing_user:
            flash('Email already registered')
            return redirect(url_for('register'))

        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        logging.debug(f"Registering user with hashed password: {hashed_password}")
        new_user = Users(
            username=username,
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=hashed_password
        )
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! You can now log in.')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/')
@login_required
def index():
    notes = Notes.query.filter_by(status='active').order_by(Notes.note_order).all()
    groups = TaskGroups.query.all()
    statuses = TaskStatuses.query.all()
    urgencies = TaskUrgency.query.all()
    efforts = TaskEffort.query.all()
    tasks = Tasks.query.all()
    for task in tasks:
        task.urgency = db.session.get(TaskUrgency, task.urgency_id)
        task.effort = db.session.get(TaskEffort, task.effort_id)
        task.status = db.session.get(TaskStatuses, task.status_id)
    return render_template('index.html', notes=notes, groups=groups, tasks=tasks, statuses=statuses, urgencies=urgencies, efforts=efforts)

@app.route('/add', methods=['POST'])
@login_required
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
@login_required
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
@login_required
def get_tags():
    query = request.args.get('query', '')
    tags = TaskTags.query.filter(TaskTags.name.ilike(f"%{query}%")).all()
    return jsonify([{'id': tag.id, 'name': tag.name, 'color_hex': tag.color_hex} for tag in tags])

@app.route('/delete/<int:note_id>', methods=['POST'])
@login_required
def delete_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        note.status = 'inactive'
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/star/<int:note_id>', methods=['POST'])
@login_required
def star_note(note_id):
    note = Notes.query.get(note_id)
    if note:
        data = request.get_json()
        note.is_starred = int(data['is_starred'])
        db.session.commit()
        return jsonify(success=True)
    return jsonify({'success': False}), 404

@app.route('/update_order', methods=['POST'])
@login_required
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
@login_required
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
@login_required
def get_tasks():
    try:
        tasks = Tasks.query.all()
        task_list = []
        for task in tasks:
            urgency = db.session.get(TaskUrgency, task.urgency_id)
            effort = db.session.get(TaskEffort, task.effort_id)
            status = db.session.get(TaskStatuses, task.status_id)
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
@login_required
def update_task_status(task_id):
    task = Tasks.query.get(task_id)
    if task:
        new_status_id = request.json.get('status_id')
        task.status_id = new_status_id
        new_group_id = db.session.get(TaskStatuses, new_status_id).group_id
        task.group_id = new_group_id
        db.session.commit()
        return jsonify(success=True, new_group_id=new_group_id)
    return jsonify(success=False)

@app.route('/update_group_status/<int:group_id>', methods=['POST'])
@login_required
def update_group_status(group_id):
    group = TaskGroups.query.get(group_id)
    if group:
        new_status = request.json.get('status')
        group.status = new_status
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False)

@app.route('/add_task', methods=['POST'])
@login_required
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
        tag = db.session.get(TaskTags, tag_id)
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
@login_required
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
@login_required
def toggle_group_status(group_id):
    group = TaskGroups.query.get(group_id)
    if group:
        new_status = request.json.get('status')
        group.status = new_status
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False), 404

@app.route('/get_task/<int:task_id>', methods=['GET'])
@login_required
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
@login_required
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
@login_required
def get_urgencies():
    urgencies = TaskUrgency.query.all()
    urgency_list = [{'id': urgency.id, 'name': urgency.name} for urgency in urgencies]
    return jsonify(urgency_list)

@app.route('/efforts', methods=['GET'])
@login_required
def get_efforts():
    efforts = TaskEffort.query.all()
    effort_list = [{'id': effort.id, 'name': effort.name} for effort in efforts]
    return jsonify(effort_list)

@app.route('/statuses', methods=['GET'])
@login_required
def get_statuses():
    statuses = TaskStatuses.query.all()
    status_list = [{'id': status.id, 'name': status.name} for status in statuses]
    return jsonify(status_list)

@app.route('/delete_task/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    task = Tasks.query.get(task_id)
    if task:
        db.session.delete(task)
        db.session.commit()
        return jsonify(success=True)
    return jsonify(success=False, error="Task not found"), 404

@app.route('/chat')
@login_required
def chat():
    return render_template('chat.html')

@app.route('/start_conversation', methods=['POST'])
@login_required
def start_conversation():
    user_id = request.form.get('user_id', 1)  # Assuming a default user ID for simplicity
    conversation = Conversation(created_by=user_id, status='active')
    db.session.add(conversation)
    db.session.commit()
    return jsonify(conversation_id=conversation.conversation_id)

@app.route('/ask', methods=['POST'])
@login_required
def ask():
    user_input = request.form['user_input']
    model = request.form['model']
    conversation_id = request.form['conversation_id']
    conversation = Conversation.query.get(conversation_id)
    
    if not conversation or conversation.status != 'active':
        return jsonify(error="Conversation not found or inactive"), 404
    
    user_message = ChatMessage(conversation_id=conversation_id, sender='User', content=user_input)
    db.session.add(user_message)
    db.session.commit()
    
    user_data = DataManager.get_user_data()
    preferences = user_data.get('preferences', {})
    
    conversation_history = [
        {"role": "system", "content": "You are a helpful assistant."}
    ] + [
        {"role": 'user' if message.sender == 'User' else 'assistant', "content": message.content}
        for message in conversation.messages
    ]
    
    response_text = OpenAI_Client.generate_response(user_input, user_data, preferences, model)
    
    bot_message = ChatMessage(conversation_id=conversation_id, sender='Bot', content=response_text)
    db.session.add(bot_message)
    db.session.commit()
    
    return jsonify(response=response_text)

@app.route('/conversations', methods=['GET'])
@login_required
def get_conversations():
    conversations = Conversation.query.filter_by(status='active').all()
    conversations_data = [{"conversation_id": conv.conversation_id} for conv in conversations]
    return jsonify(conversations=conversations_data)

@app.route('/conversation/<int:conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        return jsonify(error="Conversation not found"), 404
    
    messages = [
        {"sender": message.sender, "content": message.content, "timestamp": message.timestamp}
        for message in conversation.messages
    ]
    
    return jsonify(messages=messages)

@app.route('/delete_conversation/<int:conversation_id>', methods=['POST'])
@login_required
def delete_conversation(conversation_id):
    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        return jsonify(error="Conversation not found"), 404
    conversation.status = 'inactive'
    db.session.commit()
    return jsonify(success=True)

@app.route('/archive_conversation/<int:conversation_id>', methods=['POST'])
@login_required
def archive_conversation(conversation_id):
    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        return jsonify(error="Conversation not found"), 404
    conversation.status = 'archived'
    db.session.commit()
    return jsonify(success=True)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)