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

bp = Blueprint("pause_requests", __name__)

# ---------------------------------------------------------------------------
# Pause Requests
# ---------------------------------------------------------------------------
@bp.route("/api/gangs/pause", methods=["POST"])
def request_pause_gang():
    data = request.get_json(silent=True) or {}
    abbreviation = data.get("abbreviation", "").strip()
    reason = data.get("reason")
    approver = data.get("approver")
    duration_days = data.get("durationDays")

    if not abbreviation:
        return jsonify({"success": False, "message": "❌ ไม่พบข้อมูลชื่อย่อแก๊ง"}), 400
    if not reason or not approver or not duration_days:
        return jsonify({"success": False, "message": "❌ กรุณากรอกเหตุผล เลือกสภา และระบุจำนวนวันพัก"}), 400

    try:
        duration_days = int(duration_days)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "❌ จำนวนวันพักต้องเป็นตัวเลข"}), 400

    if duration_days < 1 or duration_days > 30:
        return jsonify({"success": False, "message": "❌ สามารถพักแก๊งได้สูงสุดไม่เกิน 30 วัน"}), 400

    db = get_db()
    try:
        gang = db.execute("SELECT * FROM gangs WHERE abbreviation = ?", (abbreviation,)).fetchone()
        if not gang:
            return jsonify({"success": False, "message": "❌ ไม่พบแก๊งในระบบ"}), 404

        existing = db.execute(
            "SELECT * FROM pause_requests WHERE gangId = ? AND status IN ('pending', 'approved')",
            (gang["id"],),
        ).fetchone()
        if existing:
            status_msg = "รอการอนุมัติ" if existing["status"] == "pending" else "กำลังพัก"
            return jsonify({"success": False, "message": f"⏳ คำขอพักแก๊งนี้{status_msg}อยู่แล้ว"}), 409

        db.execute(
            "INSERT INTO pause_requests (gangId, reason, approver, durationDays, status, createdAt) VALUES (?, ?, ?, ?, 'pending', ?)",
            (gang["id"], reason or None, approver or None, duration_days, now_thai()),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "⏸️ ส่งคำขอพักแก๊งไปยังสภากลางแล้ว กรุณารออนุมัติ"})
    except Exception as e:
        logger.error(f"❌ ส่งคำขอพักแก๊งล้มเหลว: {e}")
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล"}), 500
    finally:
        db.close()


@bp.route("/api/gangs/<int:gang_id>/pause-request", methods=["GET"])
def get_pause_request_by_gang(gang_id):
    db = get_db()
    try:
        row = db.execute(
            "SELECT * FROM pause_requests WHERE gangId = ? ORDER BY id DESC LIMIT 1",
            (gang_id,),
        ).fetchone()
        return jsonify({"success": True, "request": row_to_dict(row)})
    except Exception as e:
        return jsonify({"success": False, "request": None}), 500
    finally:
        db.close()


@bp.route("/api/pause-requests", methods=["GET"])
def get_pause_requests():
    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT p.*, g.id as gang_id, g.fullName as gang_fullName,
                   g.abbreviation as gang_abbreviation, g.leader as gang_leader
            FROM pause_requests p
            JOIN gangs g ON g.id = p.gangId
            WHERE p.status IN ('pending', 'approved')
            ORDER BY p.createdAt DESC
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


@bp.route("/api/pause-requests/<int:id>/approve", methods=["POST"])
def approve_pause_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM pause_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        start = now_thai()
        start_dt = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
        end_dt = start_dt + timedelta(days=int(req["durationDays"] or 0))
        end_date = end_dt.strftime("%Y-%m-%d %H:%M:%S")

        db.execute(
            "UPDATE pause_requests SET status = 'approved', reviewer = ?, reviewedAt = ?, startDate = ?, endDate = ? WHERE id = ?",
            (reviewer, start, start, end_date, id),
        )
        db.execute("UPDATE gangs SET status = 'พัก' WHERE id = ?", (req["gangId"],))
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ อนุมัติคำขอพักแก๊งแล้ว สถานะแก๊งเปลี่ยนเป็น 'พัก'"})
    except Exception as e:
        logger.error(f"❌ อนุมัติคำขอพักแก๊งล้มเหลว: {e}")
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอพักแก๊ง"}), 500
    finally:
        db.close()


@bp.route("/api/pause-requests/<int:id>/reject", methods=["POST"])
def reject_pause_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM pause_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        db.execute(
            "UPDATE pause_requests SET status = 'rejected', reviewer = ?, reviewedAt = ? WHERE id = ?",
            (reviewer, now_thai(), id),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอพักแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


@bp.route("/api/pause-requests/<int:id>/report", methods=["POST"])
def report_pause_request(id):
    db = get_db()
    try:
        req = db.execute("SELECT * FROM pause_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "approved":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ยังไม่ได้รับการอนุมัติ"}), 404

        db.execute(
            "UPDATE pause_requests SET status = 'reported', reportedAt = ? WHERE id = ?",
            (now_thai(), id),
        )
        db.execute("UPDATE gangs SET status = 'approved' WHERE id = ?", (req["gangId"],))
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ รายงานตัวแล้ว สถานะแก๊งกลับเป็นอนุมัติ"})
    except Exception as e:
        logger.error(f"❌ รายงานตัวหลังพักแก๊งล้มเหลว: {e}")
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการรายงานตัว"}), 500
    finally:
        db.close()


