from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Notes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    note_order = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    note_content = db.Column(db.Text, nullable=False)
    is_starred = db.Column(db.Boolean, default=False)
    tag = db.Column(db.String(255))
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Quotes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quote = db.Column(db.Text, nullable=False)
    author = db.Column(db.String(255))
    status = db.Column(db.Enum('active', 'inactive'), default='active')

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order = db.Column(db.Integer)
    group_id = db.Column(db.Integer, db.ForeignKey('task_group.id'))
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tag_id = db.Column(db.Integer, db.ForeignKey('task_tag.id'))
    urgency_id = db.Column(db.Integer, db.ForeignKey('task_urgency.id'))
    effort_id = db.Column(db.Integer, db.ForeignKey('task_effort.id'))
    status_id = db.Column(db.Integer, db.ForeignKey('task_status.id'))
    deadline = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    steps = db.relationship('TaskStep', backref='task', lazy=True)

class TaskStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    is_closing = db.Column(db.Boolean, default=False)
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    group_id = db.Column(db.Integer, db.ForeignKey('task_group.id'))

class TaskUrgency(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskEffort(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    order = db.Column(db.Integer)
    color_hex = db.Column(db.String(7))
    status = db.Column(db.Enum('opened', 'collapsed'), default='opened')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tasks = db.relationship('Task', backref='group', lazy=True)

class TaskUpdate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    content = db.Column(db.Text)
    status = db.Column(db.Enum('active', 'inactive'), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TaskTag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskDependency(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    depends_on_task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TaskStep(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    status = db.Column(db.Enum('pending', 'in_progress', 'completed'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
