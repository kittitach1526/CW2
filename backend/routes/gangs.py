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

bp = Blueprint("gangs", __name__)

# ---------------------------------------------------------------------------
# Gangs
# ---------------------------------------------------------------------------
@bp.route("/api/gangs/register", methods=["POST"])
def register_gang():
    data = request.get_json(silent=True) or {}
    required = [
        "fullName", "abbreviation", "password", "type", "leader",
        "leaderDiscord", "approver",
    ]
    if not all(data.get(k) for k in required):
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"}), 400

    db = get_db()
    try:
        existing = db.execute(
            "SELECT id FROM gangs WHERE abbreviation = ?", (data["abbreviation"].strip(),)
        ).fetchone()
        if existing:
            return jsonify({"success": False, "message": f"⚠️ ชื่อย่อ \"{data['abbreviation']}\" มีผู้ใช้งานในระบบแล้ว"}), 409

        db.execute(
            """
            INSERT INTO gangs
            (fullName, abbreviation, password, colorTheme, type, leader, leaderDiscord,
             coLeader1, coLeader1Discord, coLeader2, coLeader2Discord,
             leaderPhone, coLeader1Phone, coLeader2Phone,
             approver, logoUrl, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["fullName"].strip(),
                data["abbreviation"].strip(),
                data["password"],
                data.get("colorTheme", "#3b82f6"),
                data.get("type", "Gang"),
                data["leader"].strip(),
                data["leaderDiscord"].strip(),
                data.get("coLeader1") or None,
                data.get("coLeader1Discord") or None,
                data.get("coLeader2") or None,
                data.get("coLeader2Discord") or None,
                (data.get("leaderPhone") or "").strip() or None,
                (data.get("coLeader1Phone") or "").strip() or None,
                (data.get("coLeader2Phone") or "").strip() or None,
                data["approver"].strip(),
                data.get("logoUrl") or None,
                "pending",
                now_thai(),
            ),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "🎉 ลงทะเบียนแก๊งสำเร็จเรียบร้อยแล้วครับ!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลลงระบบ"}), 500
    finally:
        db.close()


@bp.route("/api/gangs/login", methods=["POST"])
def login_gang():
    data = request.get_json(silent=True) or {}
    abbreviation = data.get("abbreviation", "").strip()
    password = data.get("password", "")
    if not abbreviation or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    try:
        gang = db.execute(
            "SELECT * FROM gangs WHERE abbreviation = ?", (abbreviation,)
        ).fetchone()
        if not gang or gang["password"] != password:
            return jsonify({"success": False, "message": "❌ ชื่อย่อหรือรหัสผ่านไม่ถูกต้อง"}), 401
        if gang["status"] == "รอยุบ":
            return jsonify({"success": False, "message": "🔒 แก๊งนี้อยู่ในสถานะ 'รอยุบ' ระบบแผงควบคุมถูกระงับการเข้าใช้งานชั่วคราว"}), 403

        return jsonify({"success": True, "message": "🎉 เข้าสู่ระบบสำเร็จ!", "gang": row_to_dict(gang)})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่พบข้อมูล"}), 500
    finally:
        db.close()


@bp.route("/api/gangs", methods=["GET"])
def get_all_gangs():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM gangs ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "gangs": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "gangs": [], "message": "❌ ไม่สามารถดึงข้อมูลรายชื่อแก๊งได้"}), 500
    finally:
        db.close()


@bp.route("/api/gangs/<int:id>/status", methods=["PATCH"])
def update_gang_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"success": False, "message": "❌ ข้อมูลไม่ครบถ้วนสำหรับการเปลี่ยนสถานะ"}), 400

    db = get_db()
    try:
        db.execute("UPDATE gangs SET status = ? WHERE id = ?", (status, id))
        db.commit()
        _log_action(db)
        msg = f"✨ เปลี่ยนสถานะแก๊งเป็น '{status}' เรียบร้อยแล้ว"
        if status == "approved":
            msg = "🎉 อนุมัติสิทธิ์ภาคีเครือข่ายแก๊งเข้าสู่ระบบสภากลางสำเร็จ!"
        if status == "disbanded":
            msg = "❌ ทำการระงับสิทธิ์/ยื่นเรื่องยุบกลุ่มแก๊งออกจากระบบถาวรแล้ว"
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูลสภา"}), 500
    finally:
        db.close()


