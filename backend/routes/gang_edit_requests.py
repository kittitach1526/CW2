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

bp = Blueprint("gang_edit_requests", __name__)

# ---------------------------------------------------------------------------
# Gang Edit Requests
# ---------------------------------------------------------------------------
@bp.route("/api/gangs/<int:gang_id>/edit-requests", methods=["POST"])
def create_gang_edit_request(gang_id):
    data = request.get_json(silent=True) or {}
    required = ["fullName", "abbreviation", "leader", "leaderDiscord", "type"]
    if not all(data.get(k) for k in required):
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"}), 400

    db = get_db()
    try:
        existing = db.execute("SELECT * FROM gangs WHERE id = ?", (gang_id,)).fetchone()
        if not existing:
            return jsonify({"success": False, "message": "❌ ไม่พบแก๊งในระบบ"}), 404

        new_abbr = data["abbreviation"].strip()
        if new_abbr != existing["abbreviation"]:
            taken = db.execute("SELECT id FROM gangs WHERE abbreviation = ?", (new_abbr,)).fetchone()
            if taken:
                return jsonify({"success": False, "message": "❌ ชื่อย่อแก๊งนี้ถูกใช้งานแล้ว"}), 409

        payload = {
            "fullName": data["fullName"].strip(),
            "abbreviation": new_abbr,
            "colorTheme": data.get("colorTheme", "#3b82f6"),
            "leader": data["leader"].strip(),
            "leaderDiscord": data["leaderDiscord"].strip(),
            "leaderPhone": data.get("leaderPhone") or None,
            "coLeader1": data.get("coLeader1") or None,
            "coLeader1Discord": data.get("coLeader1Discord") or None,
            "coLeader1Phone": data.get("coLeader1Phone") or None,
            "coLeader2": data.get("coLeader2") or None,
            "coLeader2Discord": data.get("coLeader2Discord") or None,
            "coLeader2Phone": data.get("coLeader2Phone") or None,
            "type": data.get("type", existing["type"]),
            "logoUrl": data.get("logoUrl") or None,
            "editReason": data.get("editReason") or None,
            "approver": data.get("approver") or None,
            "newPassword": data.get("newPassword") or None,
        }

        pending = db.execute(
            "SELECT id FROM gang_edit_requests WHERE gangId = ? AND status = 'pending'",
            (gang_id,),
        ).fetchone()

        if pending:
            db.execute(
                """
                UPDATE gang_edit_requests SET
                    fullName = ?, abbreviation = ?, colorTheme = ?, leader = ?, leaderDiscord = ?, leaderPhone = ?,
                    coLeader1 = ?, coLeader1Discord = ?, coLeader1Phone = ?, coLeader2 = ?, coLeader2Discord = ?, coLeader2Phone = ?,
                    type = ?, logoUrl = ?, editReason = ?, approver = ?, newPassword = ?, createdAt = ?
                WHERE id = ?
                """,
                (
                    payload["fullName"], payload["abbreviation"], payload["colorTheme"],
                    payload["leader"], payload["leaderDiscord"], payload["leaderPhone"],
                    payload["coLeader1"], payload["coLeader1Discord"], payload["coLeader1Phone"],
                    payload["coLeader2"], payload["coLeader2Discord"], payload["coLeader2Phone"],
                    payload["type"], payload["logoUrl"], payload["editReason"], payload["approver"], payload["newPassword"], now_thai(),
                    pending["id"],
                ),
            )
            db.commit()
            updated = db.execute(
                "SELECT * FROM gang_edit_requests WHERE id = ?", (pending["id"],)
            ).fetchone()
            return jsonify({
                "success": True,
                "message": "📝 อัปเดตคำขอแก้ไขข้อมูลที่รออนุมัติสำเร็จแล้ว",
                "editRequest": row_to_dict(updated),
            })

        db.execute(
            """
            INSERT INTO gang_edit_requests
            (gangId, fullName, abbreviation, colorTheme, leader, leaderDiscord, leaderPhone,
             coLeader1, coLeader1Discord, coLeader1Phone, coLeader2, coLeader2Discord, coLeader2Phone, type,
             logoUrl, editReason, approver, newPassword, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                gang_id, payload["fullName"], payload["abbreviation"], payload["colorTheme"],
                payload["leader"], payload["leaderDiscord"], payload["leaderPhone"],
                payload["coLeader1"], payload["coLeader1Discord"], payload["coLeader1Phone"],
                payload["coLeader2"], payload["coLeader2Discord"], payload["coLeader2Phone"],
                payload["type"], payload["logoUrl"], payload["editReason"], payload["approver"], payload["newPassword"], now_thai(),
            ),
        )
        db.commit()
        _log_action(db)
        created_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        created = db.execute(
            "SELECT * FROM gang_edit_requests WHERE id = ?", (created_id,)
        ).fetchone()
        return jsonify({
            "success": True,
            "message": "📝 ส่งคำขอแก้ไขข้อมูลแก๊งไปยังสภากลางแล้ว กรุณารออนุมัติ",
            "editRequest": row_to_dict(created),
        }), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการส่งคำขอแก้ไขข้อมูล"}), 500
    finally:
        db.close()


@bp.route("/api/gangs/<int:gang_id>/edit-requests", methods=["GET"])
def get_gang_edit_request_by_gang(gang_id):
    db = get_db()
    try:
        row = db.execute(
            """
            SELECT * FROM gang_edit_requests
            WHERE gangId = ? AND status = 'pending'
            ORDER BY createdAt DESC LIMIT 1
            """,
            (gang_id,),
        ).fetchone()
        return jsonify({"success": True, "request": row_to_dict(row)})
    except Exception as e:
        return jsonify({"success": False, "request": None}), 500
    finally:
        db.close()


@bp.route("/api/edit-requests/pending", methods=["GET"])
def get_pending_gang_edit_requests():
    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT r.*, g.id as gang_id, g.fullName as gang_fullName,
                   g.abbreviation as gang_abbreviation
            FROM gang_edit_requests r
            JOIN gangs g ON g.id = r.gangId
            WHERE r.status = 'pending'
            ORDER BY r.createdAt DESC
            """
        ).fetchall()
        result = []
        for r in rows:
            d = row_to_dict(r)
            d["gang"] = {
                "id": r["gang_id"],
                "fullName": r["gang_fullName"],
                "abbreviation": r["gang_abbreviation"],
            }
            del d["gang_id"]
            del d["gang_fullName"]
            del d["gang_abbreviation"]
            result.append(d)
        return jsonify({"success": True, "requests": result})
    except Exception as e:
        return jsonify({"success": False, "requests": []}), 500
    finally:
        db.close()


@bp.route("/api/edit-requests/<int:id>/approve", methods=["POST"])
def approve_gang_edit_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM gang_edit_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        if req["newPassword"]:
            db.execute(
                """
                UPDATE gangs SET
                    fullName = ?, abbreviation = ?, colorTheme = ?, leader = ?, leaderDiscord = ?, leaderPhone = ?,
                    coLeader1 = ?, coLeader1Discord = ?, coLeader1Phone = ?, coLeader2 = ?, coLeader2Discord = ?, coLeader2Phone = ?,
                    type = ?, logoUrl = ?, editReason = ?, password = ?
                WHERE id = ?
                """,
                (
                    req["fullName"], req["abbreviation"], req["colorTheme"], req["leader"],
                    req["leaderDiscord"], req["leaderPhone"], req["coLeader1"], req["coLeader1Discord"],
                    req["coLeader1Phone"], req["coLeader2"], req["coLeader2Discord"], req["coLeader2Phone"],
                    req["type"], req["logoUrl"], req["editReason"], req["newPassword"], req["gangId"],
                ),
            )
        else:
            db.execute(
                """
                UPDATE gangs SET
                    fullName = ?, abbreviation = ?, colorTheme = ?, leader = ?, leaderDiscord = ?, leaderPhone = ?,
                    coLeader1 = ?, coLeader1Discord = ?, coLeader1Phone = ?, coLeader2 = ?, coLeader2Discord = ?, coLeader2Phone = ?,
                    type = ?, logoUrl = ?, editReason = ?
                WHERE id = ?
                """,
                (
                    req["fullName"], req["abbreviation"], req["colorTheme"], req["leader"],
                    req["leaderDiscord"], req["leaderPhone"], req["coLeader1"], req["coLeader1Discord"],
                    req["coLeader1Phone"], req["coLeader2"], req["coLeader2Discord"], req["coLeader2Phone"],
                    req["type"], req["logoUrl"], req["editReason"], req["gangId"],
                ),
            )
        db.execute(
            "UPDATE gang_edit_requests SET status = 'approved', reviewer = ?, reviewedAt = ? WHERE id = ?",
            (reviewer, now_thai(), id),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ อนุมัติการแก้ไขข้อมูลแก๊งสำเร็จแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอ"}), 500
    finally:
        db.close()


@bp.route("/api/edit-requests/<int:id>/reject", methods=["POST"])
def reject_gang_edit_request(id):
    data = request.get_json(silent=True) or {}
    reviewer = data.get("reviewer", "สภากลาง")
    db = get_db()
    try:
        req = db.execute("SELECT * FROM gang_edit_requests WHERE id = ?", (id,)).fetchone()
        if not req or req["status"] != "pending":
            return jsonify({"success": False, "message": "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว"}), 404

        db.execute(
            "UPDATE gang_edit_requests SET status = 'rejected', reviewer = ?, reviewedAt = ? WHERE id = ?",
            (reviewer, now_thai(), id),
        )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอแก้ไขข้อมูลแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


