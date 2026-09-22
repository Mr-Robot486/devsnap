# DevSnap

A code snippet manager: save, search, and tag code snippets with syntax
highlighting. Flask REST API + PostgreSQL, single-page vanilla-JS frontend
(no build step).

## Stack

- **Backend:** Flask, Flask-SQLAlchemy, psycopg2
- **Database:** PostgreSQL
- **Frontend:** Vanilla JS (fetch API), highlight.js for syntax highlighting — no bundler needed

## Project layout

```
devsnap/
├── app.py              # Flask app + REST API routes
├── models.py           # SQLAlchemy models (Snippet, Tag)
├── config.py           # Config from environment variables
├── schema.sql          # Reference SQL schema (auto-applied by app.py too)
├── requirements.txt
├── .env.example
├── static/
│   ├── css/style.css
│   └── js/app.js        # All frontend logic
└── templates/
    └── index.html
```

## Setup

### 1. Install PostgreSQL and create a database

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql
```

Create the database and user:

```bash
psql postgres -c "CREATE USER devsnap WITH PASSWORD 'devsnap';"
psql postgres -c "CREATE DATABASE devsnap OWNER devsnap;"
```

### 2. Set up the Python environment

```bash
cd devsnap
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
# edit .env if your DB credentials differ from the defaults
```

### 4. Run it

```bash
python app.py
```
## ✨ Key Features

* **Instant Search:** Search through titles, code contents, and notes in real time[cite: 4].
* **Language Categorization:** Filter snippets by programming languages (e.g., HTML, JavaScript, Python) with clear visual indicators[cite: 4].
* **Tag System:** Organize code chunks using custom tags like `#classes` and `#division` for effortless filtering[cite: 4].
* **Flexible Sorting:** Sort your library by newest first or custom parameters to keep your workflow efficient[cite: 4].
* **Responsive Dark Mode:** A sleek, eye-friendly dark interface optimized seamlessly for both desktop and mobile devices[cite: 4].

---

## 🚀 Quick Start

To run DevSnap locally on your machine, follow these simple steps:

```bash
# Clone the repository
git clone [https://github.com/your-username/devsnap.git](https://github.com/your-username/devsnap.git)

# Navigate into the project folder
cd devsnap

# Open index.html in your favorite browser or run a live server

🛠️ Built With

    .HTML5 / CSS3 – For structure and modern UI styling.

    .JavaScript (Vanilla) – For dynamic filtering, state handling, and local storage management.

📄 License

This project is open-source and available under the MIT License.
