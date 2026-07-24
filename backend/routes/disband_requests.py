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

bp = Blueprint("disband_requests", __name__)

# ---------------------------------------------------------------------------
# Disband Requests
# ---------------------------------------------------------------------------
@bp.route("/api/gangs/disband", methods=["POST"])
def request_disband_gang():
    data = request.get_json(silent=True) or {}
    abbreviation = data.get("abbreviation", "").strip()
    reason = data.get("reason")
    approver = data.get("approver")
    if not abbreviation:
        return jsonify({"success": False, "message": "❌ ไม่พบข้อมูลชื่อย่อแก๊ง"}), 400

    db = get_db()
    try:
        gang = db.execute("SELECT * FROM gangs WHERE abbreviation = ?", (abbreviation,)).fetchone()
        if not gang:
            return jsonify({"success": False, "message": "❌ ไม่พบแก๊งในระบบ"}), 404

        existing = db.execute(
            "SELECT * FROM disband_requests WHERE gangId = ?", (gang["id"],)
        ).fetchone()
        if existing and existing["status"] == "pending":
            return jsonify({"success": False, "message": "⏳ คำขอยุบแก๊งนี้กำลังรอการอนุมัติจากสภากลางอยู่แล้ว"}), 409

        if existing:
            db.execute(
                "UPDATE disband_requests SET status = 'pending', reason = ?, approver = ?, createdAt = ?, reviewedAt = NULL, reviewer = NULL WHERE gangId = ?",
                (reason or None, approver or None, now_thai(), gang["id"]),
            )
        else:
            db.execute(
                "INSERT INTO disband_requests (gangId, reason, approver, status, createdAt) VALUES (?, ?, ?, 'pending', ?)",
                (gang["id"], reason or None, approver or None, now_thai()),
            )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "⚠️ ส่งเรื่องขอยุบแก๊งไปยังระบบสภากลางเรียบร้อยแล้ว กรุณารอสภาพิจารณา"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล"}), 500
    finally:
        db.close()


@bp.route("/api/disband-requests", methods=["GET"])
def get_pending_disband_requests():
    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT d.*, g.id as gang_id, g.fullName as gang_fullName,
                   g.abbreviation as gang_abbreviation, g.leader as gang_leader
            FROM disband_requests d
            JOIN gangs g ON g.id = d.gangId
            WHERE d.status = 'pending'
            ORDER BY d.createdAt DESC
            """
        ).fetchall()
        result = []
        for r in rows:
            d = row_to_dict(r)
            d["gang"] = {
                "id": r["gang_id"],
                "fullName": r["gang_fullName"],
                "abbreviation": r["gang_abbreviation"],
                "leader": r["gang_leader"],
            }
            del d["gang_id"]
            del d["gang_fullName"]
            del d["gang_abbreviation"]
            del d["gang_leader"]
            result.append(d)
        return jsonify({"success": True, "requests": result})
    except Exception as e:
        return jsonify({"success": False, "requests": []}), 500
    finally:
        db.close()


@bp.route("/api/gangs/<int:gang_id>/disband-request", methods=["GET"])
def get_disband_request_by_gang(gang_id):
    db = get_db()
    try:
        row = db.execute(
            "SELECT * FROM disband_requests WHERE gangId = ?", (gang_id,)
        ).fetchone()
        return jsonify({"success": True, "request": row_to_dict(row)})
    except Exception as e:
        return jsonify({"success": False, "request": None}), 500
    finally:
        db.close()


@bp.route("/api/disband-requests/<int:id>/approve", methods=["POST"])
def approve_disband_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM disband_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        db.execute("UPDATE gangs SET status = 'รอยุบ' WHERE id = ?", (req["gangId"],))
        db.execute(
            "UPDATE disband_requests SET status = 'approved', reviewer = ?, reviewedAt = ? WHERE id = ?",
            (reviewer, now_thai(), id),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ อนุมัติคำขอยุบแก๊งแล้ว สถานะแก๊งเปลี่ยนเป็น 'รอยุบ'"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอยุบแก๊ง"}), 500
    finally:
        db.close()


@bp.route("/api/disband-requests/<int:id>/reject", methods=["POST"])
def reject_disband_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM disband_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        db.execute(
            "UPDATE disband_requests SET status = 'rejected', reviewer = ?, reviewedAt = ? WHERE id = ?",
            (reviewer, now_thai(), id),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอยุบแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


