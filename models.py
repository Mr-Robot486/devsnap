import uuid
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID

db = SQLAlchemy()

snippet_tags = db.Table(
    "snippet_tags",
    db.Column("snippet_id", UUID(as_uuid=True), db.ForeignKey("snippets.id", ondelete="CASCADE"), primary_key=True),
    db.Column("tag_id", UUID(as_uuid=True), db.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


def _now():
    return datetime.now(timezone.utc)


class Snippet(db.Model):
    __tablename__ = "snippets"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    code = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(50), nullable=False, default="plaintext")
    created_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    tags = db.relationship(
        "Tag",
        secondary=snippet_tags,
        backref=db.backref("snippets", lazy="dynamic"),
        lazy="joined",
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description or "",
            "code": self.code,
            "language": self.language,
            "tags": sorted(t.name for t in self.tags),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def to_dict(self):
        return {"id": str(self.id), "name": self.name}
