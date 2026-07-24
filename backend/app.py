import os
from flask import Flask, jsonify
from flask_cors import CORS
from database import init_db
from routes import register_routes

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


register_routes(app)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 4000))
    app.run(host="0.0.0.0", port=port, debug=True)
