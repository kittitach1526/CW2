from flask import Blueprint, request, jsonify
from database import get_db
from helpers import (
    logger,
    now_thai,
    row_to_dict,
    _parse_details,
    _normalize,
    _active_welfare_for_person,
    _actor_from_data,
    _target_name_from_locals,
    _build_log_description,
    _log_action,
    ROOT_USERNAME,
    ROOT_PASSWORD,
)

bp = Blueprint("admin_users", __name__)

# ---------------------------------------------------------------------------
# Admin Users
# ---------------------------------------------------------------------------
@bp.route("/api/admin/login", methods=["POST"])
def login_admin():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    try:
        user = db.execute("SELECT * FROM admin_users WHERE username = ?", (username,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "❌ ไม่พบชื่อผู้ดูแลระบบในสารบบ"}), 404
        if user["password"] != password:
            return jsonify({"success": False, "message": "❌ รหัสผ่านไม่ถูกต้อง"}), 401
        if user["status"] == "ระงับใช้งาน":
            return jsonify({"success": False, "message": "🔒 บัญชีผู้ดูแลระบบนี้ถูกระงับสิทธิ์การใช้งานแล้ว"}), 403
        if user["status"] == "รอรับ":
            return jsonify({"success": False, "message": "⏳ บัญชีผู้ดูแลระบบนี้อยู่ระหว่างรอเปิดใช้งาน"}), 403

        return jsonify({
            "success": True,
            "message": "🎉 เข้าสู่ระบบผู้ดูแลระบบสำเร็จ!",
            "admin": row_to_dict(user),
        })
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ฐานข้อมูลระบบแอดมินขัดข้อง (ดู Terminal)"}), 500
    finally:
        db.close()


@bp.route("/api/admin", methods=["GET"])
def get_all_admin_users():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM admin_users ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "users": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "users": [], "message": "❌ ไม่สามารถดึงข้อมูลบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@bp.route("/api/admin", methods=["POST"])
def create_admin_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    if not name or not username or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    try:
        existing = db.execute("SELECT id FROM admin_users WHERE username = ?", (username,)).fetchone()
        if existing:
            return jsonify({"success": False, "message": "❌ ชื่อผู้ใช้นี้มีอยู่ในระบบแอดมินแล้ว"}), 409

        db.execute(
            "INSERT INTO admin_users (name, username, password, status, createdAt) VALUES (?, ?, ?, 'อนุมัติ', ?)",
            (name, username, password, now_thai()),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ เพิ่มบัญชีแอดมินเรียบร้อยแล้ว"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถเพิ่มบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@bp.route("/api/admin/<int:id>/status", methods=["PATCH"])
def update_admin_user_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    db = get_db()
    try:
        db.execute("UPDATE admin_users SET status = ? WHERE id = ?", (status, id))
        db.commit()
        _log_action(db)
        msg = "✅ เปิดใช้งานบัญชีแอดมินแล้ว" if status == "อนุมัติ" else "🔒 ระงับการใช้งานบัญชีแอดมินแล้ว"
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตสถานะบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@bp.route("/api/admin/<int:id>", methods=["DELETE"])
def delete_admin_user(id):
    db = get_db()
    try:
        db.execute("DELETE FROM admin_users WHERE id = ?", (id,))
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "🗑️ ลบบัญชีแอดมินเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@bp.route("/api/admin/<int:id>", methods=["PATCH"])
def update_admin_user(id):
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    status = data.get("status")
    db = get_db()
    try:
        existing = db.execute("SELECT * FROM admin_users WHERE id = ?", (id,)).fetchone()
        if not existing:
            return jsonify({"success": False, "message": "❌ ไม่พบบัญชีแอดมิน"}), 404
        if username and username != existing["username"]:
            dup = db.execute("SELECT id FROM admin_users WHERE username = ? AND id != ?", (username, id)).fetchone()
            if dup:
                return jsonify({"success": False, "message": "❌ ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว"}), 409
        fields = []
        values = []
        if name:
            fields.append("name = ?")
            values.append(name)
        if username:
            fields.append("username = ?")
            values.append(username)
        if password:
            fields.append("password = ?")
            values.append(password)
        if status:
            fields.append("status = ?")
            values.append(status)
        if not fields:
            return jsonify({"success": False, "message": "❌ ไม่มีข้อมูลที่จะอัปเดต"}), 400
        values.append(id)
        db.execute(f"UPDATE admin_users SET {', '.join(fields)} WHERE id = ?", values)
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ อัปเดตบัญชีแอดมินเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตบัญชีแอดมินได้"}), 500
    finally:
        db.close()


