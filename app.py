import os

from flask import Flask, jsonify, render_template, request
from sqlalchemy import or_

from config import Config
from models import Snippet, Tag, db

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

SUPPORTED_LANGUAGES = [
    "javascript", "typescript", "python", "go", "rust", "java", "c",
    "cpp", "csharp", "ruby", "php", "swift", "kotlin", "sql", "bash",
    "html", "css", "json", "yaml", "markdown", "plaintext",
]


# ---------------------------------------------------------------- helpers --

def get_or_create_tags(names):
    """Return Tag rows for the given names, creating any that don't exist."""
    clean = sorted({n.strip().lower() for n in names if n and n.strip()})
    if not clean:
        return []
    existing = {t.name: t for t in Tag.query.filter(Tag.name.in_(clean)).all()}
    tags = []
    for name in clean:
        tag = existing.get(name)
        if tag is None:
            tag = Tag(name=name)
            db.session.add(tag)
        tags.append(tag)
    return tags


def snippet_or_404(snippet_id):
    snippet = Snippet.query.get(snippet_id)
    if snippet is None:
        return None
    return snippet


# -------------------------------------------------------------------- ui --

@app.route("/")
def index():
    return render_template("index.html")


# --------------------------------------------------------------- api: ui --

@app.route("/api/languages")
def list_languages():
    used = {row[0] for row in db.session.query(Snippet.language).distinct().all()}
    ordered = [l for l in SUPPORTED_LANGUAGES if l in used]
    extra = sorted(used - set(SUPPORTED_LANGUAGES))
    return jsonify(ordered + extra)


@app.route("/api/tags")
def list_tags():
    tags = Tag.query.order_by(Tag.name).all()
    counts = {t.id: t.snippets.count() for t in tags}
    return jsonify([{**t.to_dict(), "count": counts[t.id]} for t in tags])


# ------------------------------------------------------------ api: crud --

@app.route("/api/snippets", methods=["GET"])
def list_snippets():
    query = Snippet.query

    q = request.args.get("q", "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(Snippet.title.ilike(like), Snippet.description.ilike(like), Snippet.code.ilike(like))
        )

    language = request.args.get("language", "").strip()
    if language:
        query = query.filter(Snippet.language == language)

    tag = request.args.get("tag", "").strip().lower()
    if tag:
        query = query.filter(Snippet.tags.any(Tag.name == tag))

    sort = request.args.get("sort", "newest")
    if sort == "oldest":
        query = query.order_by(Snippet.created_at.asc())
    elif sort == "title":
        query = query.order_by(Snippet.title.asc())
    else:
        query = query.order_by(Snippet.created_at.desc())

    snippets = query.all()
    return jsonify([s.to_dict() for s in snippets])


@app.route("/api/snippets/<uuid:snippet_id>", methods=["GET"])
def get_snippet(snippet_id):
    snippet = snippet_or_404(snippet_id)
    if snippet is None:
        return jsonify({"error": "Snippet not found"}), 404
    return jsonify(snippet.to_dict())


@app.route("/api/snippets", methods=["POST"])
def create_snippet():
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    code = data.get("code") or ""
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not code.strip():
        return jsonify({"error": "Code is required"}), 400

    snippet = Snippet(
        title=title,
        description=(data.get("description") or "").strip(),
        code=code,
        language=(data.get("language") or "plaintext").strip().lower(),
    )
    snippet.tags = get_or_create_tags(data.get("tags") or [])

    db.session.add(snippet)
    db.session.commit()
    return jsonify(snippet.to_dict()), 201


@app.route("/api/snippets/<uuid:snippet_id>", methods=["PUT"])
def update_snippet(snippet_id):
    snippet = snippet_or_404(snippet_id)
    if snippet is None:
        return jsonify({"error": "Snippet not found"}), 404

    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        snippet.title = title
    if "description" in data:
        snippet.description = (data.get("description") or "").strip()
    if "code" in data:
        code = data.get("code") or ""
        if not code.strip():
            return jsonify({"error": "Code cannot be empty"}), 400
        snippet.code = code
    if "language" in data:
        snippet.language = (data.get("language") or "plaintext").strip().lower()
    if "tags" in data:
        snippet.tags = get_or_create_tags(data.get("tags") or [])

    db.session.commit()
    return jsonify(snippet.to_dict())


@app.route("/api/snippets/<uuid:snippet_id>", methods=["DELETE"])
def delete_snippet(snippet_id):
    snippet = snippet_or_404(snippet_id)
    if snippet is None:
        return jsonify({"error": "Snippet not found"}), 404
    db.session.delete(snippet)
    db.session.commit()
    return "", 204


# --------------------------------------------------------------- errors --

@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return render_template("index.html")


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1", port=port)
