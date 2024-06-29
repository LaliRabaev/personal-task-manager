from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

notes_tags = db.Table('notes_tags',
    db.Column('note_id', db.Integer, db.ForeignKey('notes.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('task_tags.id'), primary_key=True)
)

tasks_tags = db.Table('tasks_tags',
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('task_tags.id'), primary_key=True)
)

class Notes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    note_order = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    note_content = db.Column(db.Text, nullable=False)
    is_starred = db.Column(db.Boolean, default=False)
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    tags = db.relationship('TaskTags', secondary=notes_tags, backref=db.backref('notes', lazy=True))

class Quotes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quote = db.Column(db.Text, nullable=False)
    author = db.Column(db.String(255))
    status = db.Column(db.Enum('active', 'inactive'), default='active')

class Tasks(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    order = db.Column(db.Integer)
    group_id = db.Column(db.Integer, db.ForeignKey('task_groups.id'), nullable=False)  # Correctly define foreign key
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    urgency_id = db.Column(db.Integer, db.ForeignKey('task_urgency.id'), nullable=False)
    effort_id = db.Column(db.Integer, db.ForeignKey('task_effort.id'), nullable=False)
    status_id = db.Column(db.Integer, db.ForeignKey('task_statuses.id'), nullable=False)
    deadline = db.Column(db.DateTime, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship('TaskGroups', back_populates='tasks')
    status = db.relationship('TaskStatuses', back_populates='tasks')
    urgency = db.relationship('TaskUrgency', back_populates='tasks')
    effort = db.relationship('TaskEffort', back_populates='tasks')
    tags = db.relationship('TaskTags', secondary=tasks_tags, backref=db.backref('tasks', lazy=True))

class TaskStatuses(db.Model):
    __tablename__ = 'task_statuses'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    is_closing = db.Column(db.Boolean, default=False)
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    group_id = db.Column(db.Integer, db.ForeignKey('task_groups.id'))

    tasks = db.relationship('Tasks', back_populates='status')

class TaskUrgency(db.Model):
    __tablename__ = 'task_urgency'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tasks = db.relationship('Tasks', back_populates='urgency')

class TaskEffort(db.Model):
    __tablename__ = 'task_effort'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tasks = db.relationship('Tasks', back_populates='effort')

class TaskGroups(db.Model):
    __tablename__ = 'task_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    order = db.Column(db.Integer)
    color_hex = db.Column(db.String(7))
    status = db.Column(db.Enum('opened', 'collapsed'), default='opened')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tasks = db.relationship('Tasks', back_populates='group')

class TaskTags(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    color_hex = db.Column(db.String(7), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskUpdates(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    content = db.Column(db.Text)
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TaskDependencies(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    depends_on_task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskSteps(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    status = db.Column(db.Enum('pending', 'in_progress', 'completed'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Conversation(db.Model):
    __tablename__ = 'conversations'
    conversation_id = db.Column(db.Integer, primary_key=True)
    conversation_title = db.Column(db.String(45))
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Enum('active', 'inactive', 'archived', name='status_enum'))
    messages = db.relationship('Message', backref='conversation', lazy=True)

class Message(db.Model):
    __tablename__ = 'messages'
    message_id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.conversation_id'), nullable=False)
    sender = db.Column(db.Enum('User', 'Bot', name='sender_enum'))
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)