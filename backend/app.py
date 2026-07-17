import json
import os
import sqlite3
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db, init_db

app = Flask(__name__)
CORS(app)

ROOT_USERNAME = os.environ.get("ROOT_USERNAME", "root")
ROOT_PASSWORD = os.environ.get("ROOT_PASSWORD", "p@ssw0rd")


def now_thai():
    """Return current Thai time as 'YYYY-MM-DD HH:MM:SS' (same locale as sv-SE)."""
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.now(ZoneInfo("Asia/Bangkok"))
    except Exception:
        dt = datetime.utcnow()
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def row_to_dict(row):
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Gangs
# ---------------------------------------------------------------------------
@app.route("/api/gangs/register", methods=["POST"])
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
             coLeader1, coLeader1Discord, coLeader2, coLeader2Discord, approver, logoUrl, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                data["approver"].strip(),
                data.get("logoUrl") or None,
                "pending",
                now_thai(),
            ),
        )
        db.commit()
        return jsonify({"success": True, "message": "🎉 ลงทะเบียนแก๊งสำเร็จเรียบร้อยแล้วครับ!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลลงระบบ"}), 500
    finally:
        db.close()


@app.route("/api/gangs/login", methods=["POST"])
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


@app.route("/api/gangs", methods=["GET"])
def get_all_gangs():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM gangs ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "gangs": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "gangs": [], "message": "❌ ไม่สามารถดึงข้อมูลรายชื่อแก๊งได้"}), 500
    finally:
        db.close()


@app.route("/api/gangs/<int:id>/status", methods=["PATCH"])
def update_gang_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"success": False, "message": "❌ ข้อมูลไม่ครบถ้วนสำหรับการเปลี่ยนสถานะ"}), 400

    db = get_db()
    try:
        db.execute("UPDATE gangs SET status = ? WHERE id = ?", (status, id))
        db.commit()
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


# ---------------------------------------------------------------------------
# Gang Edit Requests
# ---------------------------------------------------------------------------
@app.route("/api/gangs/<int:gang_id>/edit-requests", methods=["POST"])
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


@app.route("/api/gangs/<int:gang_id>/edit-requests", methods=["GET"])
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


@app.route("/api/edit-requests/pending", methods=["GET"])
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


@app.route("/api/edit-requests/<int:id>/approve", methods=["POST"])
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
        return jsonify({"success": True, "message": "✅ อนุมัติการแก้ไขข้อมูลแก๊งสำเร็จแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอ"}), 500
    finally:
        db.close()


@app.route("/api/edit-requests/<int:id>/reject", methods=["POST"])
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
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอแก้ไขข้อมูลแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Disband Requests
# ---------------------------------------------------------------------------
@app.route("/api/gangs/disband", methods=["POST"])
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
        return jsonify({"success": True, "message": "⚠️ ส่งเรื่องขอยุบแก๊งไปยังระบบสภากลางเรียบร้อยแล้ว กรุณารอสภาพิจารณา"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล"}), 500
    finally:
        db.close()


@app.route("/api/disband-requests", methods=["GET"])
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


@app.route("/api/gangs/<int:gang_id>/disband-request", methods=["GET"])
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


@app.route("/api/disband-requests/<int:id>/approve", methods=["POST"])
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
        return jsonify({"success": True, "message": "✅ อนุมัติคำขอยุบแก๊งแล้ว สถานะแก๊งเปลี่ยนเป็น 'รอยุบ'"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอยุบแก๊ง"}), 500
    finally:
        db.close()


@app.route("/api/disband-requests/<int:id>/reject", methods=["POST"])
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
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอยุบแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pause Requests
# ---------------------------------------------------------------------------
@app.route("/api/gangs/pause", methods=["POST"])
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
        return jsonify({"success": True, "message": "⏸️ ส่งคำขอพักแก๊งไปยังสภากลางแล้ว กรุณารออนุมัติ"})
    except Exception as e:
        print("[pause request error]", e)
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล"}), 500
    finally:
        db.close()


@app.route("/api/gangs/<int:gang_id>/pause-request", methods=["GET"])
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


@app.route("/api/pause-requests", methods=["GET"])
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


@app.route("/api/pause-requests/<int:id>/approve", methods=["POST"])
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
        return jsonify({"success": True, "message": "✅ อนุมัติคำขอพักแก๊งแล้ว สถานะแก๊งเปลี่ยนเป็น 'พัก'"})
    except Exception as e:
        print("[pause approve error]", e)
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอพักแก๊ง"}), 500
    finally:
        db.close()


@app.route("/api/pause-requests/<int:id>/reject", methods=["POST"])
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
        return jsonify({"success": True, "message": "✕ ปฏิเสธคำขอพักแก๊งแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ"}), 500
    finally:
        db.close()


@app.route("/api/pause-requests/<int:id>/report", methods=["POST"])
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
        return jsonify({"success": True, "message": "✅ รายงานตัวแล้ว สถานะแก๊งกลับเป็นอนุมัติ"})
    except Exception as e:
        print("[pause report error]", e)
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการรายงานตัว"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Uniform Files
# ---------------------------------------------------------------------------
@app.route("/api/uniform-files", methods=["POST"])
def create_uniform_file():
    data = request.get_json(silent=True) or {}
    required = ["gangName", "uniformType", "fileUrl", "approver"]
    if not all(data.get(k) for k in required):
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลไฟล์ชุดให้ครบถ้วน"}), 400

    details = data.get("details") or {}
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except Exception:
            details = {}

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO uniform_files
            (gangName, uniformType, fileUrl, approver, approverDiscord, reason, status, createdAt, details)
            VALUES (?, ?, ?, ?, ?, ?, 'รอลง', ?, ?)
            """,
            (
                data["gangName"].strip(),
                data["uniformType"].strip(),
                data["fileUrl"].strip(),
                data["approver"].strip(),
                (data.get("approverDiscord") or "").strip(),
                data.get("reason") or None,
                now_thai(),
                json.dumps(details, ensure_ascii=False) if details else None,
            ),
        )
        db.commit()
        return jsonify({"success": True, "message": "🎉 เพิ่มไฟล์ชุดเรียบร้อยแล้ว!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในการบันทึกไฟล์ชุด"}), 500
    finally:
        db.close()


@app.route("/api/uniform-files", methods=["GET"])
def get_all_uniform_files():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM uniform_files ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "files": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถดึงข้อมูลไฟล์ชุดได้"}), 500
    finally:
        db.close()


@app.route("/api/uniform-files/<int:id>/link", methods=["PATCH"])
def update_uniform_file_link(id):
    data = request.get_json(silent=True) or {}
    new_file_url = data.get("newFileUrl", "").strip()
    reason = data.get("reason", "").strip()
    if not new_file_url:
        return jsonify({"success": False, "message": "❌ กรุณากรอกลิงก์ไฟล์ใหม่"}), 400
    if not reason:
        return jsonify({"success": False, "message": "❌ กรุณากรอกเหตุผลการเปลี่ยนลิงก์ไฟล์ชุด"}), 400

    db = get_db()
    try:
        db.execute(
            "UPDATE uniform_files SET fileUrl = ?, reason = ?, status = 'รอลง' WHERE id = ?",
            (new_file_url, reason, id),
        )
        db.commit()
        return jsonify({"success": True, "message": "🔄 อัปเดตลิงก์ไฟล์ชุดใหม่ พร้อมเหตุผลเรียบร้อย ส่งเรื่องให้แอดมินตรวจสอบแล้ว!"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตไฟล์ชุดได้"}), 500
    finally:
        db.close()


@app.route("/api/uniform-files/<int:id>/status", methods=["PATCH"])
def update_uniform_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"success": False, "message": "❌ ไม่พบรหัสไฟล์ชุดเสื้อผ้า"}), 400

    db = get_db()
    try:
        db.execute("UPDATE uniform_files SET status = ? WHERE id = ?", (status, id))
        db.commit()
        msg = (
            "👕 อัปเดตสถานะ: โมเดลชุดถูกติดตั้งเข้าเซิร์ฟเวอร์หลักเรียบร้อย!"
            if status == "ลงแล้ว"
            else "❌ ปฏิเสธไฟล์ชุดทรัพยากรดังกล่าว"
        )
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตไฟล์ชุดในฐานข้อมูลได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Welfare Requests
# ---------------------------------------------------------------------------
@app.route("/api/welfare", methods=["POST"])
def create_welfare_request():
    data = request.get_json(silent=True) or {}
    required = ["requestName", "discordId", "welfareItem"]
    if not all(data.get(k) for k in required):
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    details = data.get("details") or {}
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except Exception:
            details = {}

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO welfare_requests
            (gangName, gangAbbreviation, requestName, discordId, welfareItem, requestType, status, approver, createdAt, details)
            VALUES (?, ?, ?, ?, ?, ?, 'รอรับ', ?, ?, ?)
            """,
            (
                data.get("gangName") or None,
                data.get("gangAbbreviation") or None,
                data["requestName"].strip(),
                data["discordId"].strip(),
                data["welfareItem"].strip(),
                (data.get("requestType") or "receive").strip(),
                data.get("approver") or None,
                now_thai(),
                json.dumps(details, ensure_ascii=False) if details else None,
            ),
        )
        db.commit()
        return jsonify({"success": True, "message": "📦 ส่งคำขอรับสวัสดิการไปยังระบบสภากลางเรียบร้อยแล้ว!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล"}), 500
    finally:
        db.close()


@app.route("/api/welfare", methods=["GET"])
def get_all_welfare_requests():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM welfare_requests ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "requests": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "requests": [], "message": "❌ ไม่สามารถดึงข้อมูลคำขอสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare/gang/<gang_abbreviation>", methods=["GET"])
def get_welfare_requests_by_gang(gang_abbreviation):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT * FROM welfare_requests WHERE gangAbbreviation = ? ORDER BY createdAt DESC",
            (gang_abbreviation,),
        ).fetchall()
        return jsonify({"success": True, "requests": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "requests": [], "message": "❌ ไม่สามารถโหลดข้อมูลสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare/<int:id>/status", methods=["PATCH"])
def update_welfare_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"success": False, "message": "❌ ข้อมูลไม่ครบถ้วน"}), 400

    db = get_db()
    try:
        db.execute("UPDATE welfare_requests SET status = ? WHERE id = ?", (status, id))
        db.commit()
        msg = (
            "✅ อนุมัติการแจกจ่ายพัสดุและทำเครื่องหมายส่งมอบแล้ว"
            if status == "รับไปแล้ว"
            else "❌ ยกเลิก/นำคำขอสวัสดิการนี้ออกจากระบบแล้ว"
        )
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตสถานะสวัสดิการได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Welfare Items
# ---------------------------------------------------------------------------
@app.route("/api/welfare-items", methods=["GET"])
def get_welfare_items():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM welfare_items WHERE active = 1 ORDER BY id ASC").fetchall()
        return jsonify({"success": True, "items": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "items": [], "message": "❌ ไม่สามารถดึงข้อมูลสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-items", methods=["POST"])
def create_welfare_item():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    item_type = (data.get("type") or "").strip()
    if not name or not item_type:
        return jsonify({"success": False, "message": "❌ กรุณากรอกชื่อและประเภทสวัสดิการ"}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO welfare_items (name, type, active, createdAt) VALUES (?, ?, 1, ?)",
            (name, item_type, now_thai()),
        )
        db.commit()
        return jsonify({"success": True, "message": "✅ เพิ่มรายการสวัสดิการสำเร็จ"})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "⚠️ ชื่อสวัสดิการซ้ำในระบบ"}), 409
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถเพิ่มรายการสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-items/<int:item_id>", methods=["PATCH"])
def update_welfare_item(item_id):
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    item_type = (data.get("type") or "").strip()
    active = data.get("active")
    if not name and not item_type and active is None:
        return jsonify({"success": False, "message": "❌ ไม่มีข้อมูลที่ต้องการแก้ไข"}), 400
    updates = []
    params = []
    if name:
        updates.append("name = ?")
        params.append(name)
    if item_type:
        updates.append("type = ?")
        params.append(item_type)
    if active is not None:
        updates.append("active = ?")
        params.append(1 if active else 0)
    params.append(item_id)
    db = get_db()
    try:
        db.execute(f"UPDATE welfare_items SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()
        return jsonify({"success": True, "message": "✅ แก้ไขรายการสวัสดิการสำเร็จ"})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "⚠️ ชื่อสวัสดิการซ้ำในระบบ"}), 409
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถแก้ไขรายการสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-items/<int:item_id>", methods=["DELETE"])
def delete_welfare_item(item_id):
    db = get_db()
    try:
        db.execute("DELETE FROM welfare_items WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"success": True, "message": "🗑️ ลบรายการสวัสดิการสำเร็จ"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบรายการสวัสดิการได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Council Users
# ---------------------------------------------------------------------------
@app.route("/api/council/login", methods=["POST"])
def login_council():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    try:
        user = db.execute(
            "SELECT * FROM council_users WHERE username = ?", (username,)
        ).fetchone()
        if not user:
            return jsonify({"success": False, "message": "❌ ไม่พบชื่อผู้ใช้ในระบบ"}), 404
        if user["password"] != password:
            return jsonify({"success": False, "message": "❌ รหัสผ่านไม่ถูกต้อง"}), 401
        if user["status"] == "ระงับใช้งาน":
            return jsonify({"success": False, "message": "🔒 บัญชีนี้ถูกสภากลางระงับการใช้งานแล้ว"}), 403

        return jsonify({
            "success": True,
            "message": "🎉 เข้าสู่ระบบสภากลางสำเร็จ!",
            "council": row_to_dict(user),
        })
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ฐานข้อมูลระบบสภาขัดข้อง (ดู Terminal)"}), 500
    finally:
        db.close()


@app.route("/api/council", methods=["GET"])
def get_all_council_users():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM council_users ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "users": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "users": [], "message": "❌ ไม่สามารถดึงข้อมูลบัญชีสภาได้"}), 500
    finally:
        db.close()


@app.route("/api/council/names", methods=["GET"])
def get_approved_council_names():
    db = get_db()
    try:
        rows = db.execute(
            "SELECT name FROM council_users WHERE status = 'อนุมัติ' ORDER BY name"
        ).fetchall()
        return jsonify({"success": True, "names": [r["name"] for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "names": [], "message": "❌ ไม่สามารถดึงรายชื่อสภาได้"}), 500
    finally:
        db.close()


@app.route("/api/council", methods=["POST"])
def create_council_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    if not name or not username or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    try:
        existing = db.execute(
            "SELECT id FROM council_users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            return jsonify({"success": False, "message": "❌ ชื่อผู้ใช้นี้มีอยู่ในระบบสภาแล้ว"}), 409

        db.execute(
            "INSERT INTO council_users (name, username, password, status, createdAt) VALUES (?, ?, ?, 'อนุมัติ', ?)",
            (name, username, password, now_thai()),
        )
        db.commit()
        return jsonify({"success": True, "message": "✅ เพิ่มบัญชีสภากลางเรียบร้อยแล้ว"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถเพิ่มบัญชีสภากลางได้"}), 500
    finally:
        db.close()


@app.route("/api/council/<int:id>/status", methods=["PATCH"])
def update_council_user_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    db = get_db()
    try:
        db.execute("UPDATE council_users SET status = ? WHERE id = ?", (status, id))
        db.commit()
        msg = "✅ เปิดใช้งานบัญชีสภาแล้ว" if status == "อนุมัติ" else "🔒 ระงับการใช้งานบัญชีสภาแล้ว"
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตสถานะบัญชีสภาได้"}), 500
    finally:
        db.close()


@app.route("/api/council/<int:id>", methods=["DELETE"])
def delete_council_user(id):
    db = get_db()
    try:
        db.execute("DELETE FROM council_users WHERE id = ?", (id,))
        db.commit()
        return jsonify({"success": True, "message": "🗑️ ลบบัญชีสภาเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบบัญชีสภาได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Admin Users
# ---------------------------------------------------------------------------
@app.route("/api/admin/login", methods=["POST"])
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


@app.route("/api/admin", methods=["GET"])
def get_all_admin_users():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM admin_users ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "users": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "users": [], "message": "❌ ไม่สามารถดึงข้อมูลบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@app.route("/api/admin", methods=["POST"])
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
        return jsonify({"success": True, "message": "✅ เพิ่มบัญชีแอดมินเรียบร้อยแล้ว"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถเพิ่มบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@app.route("/api/admin/<int:id>/status", methods=["PATCH"])
def update_admin_user_status(id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    db = get_db()
    try:
        db.execute("UPDATE admin_users SET status = ? WHERE id = ?", (status, id))
        db.commit()
        msg = "✅ เปิดใช้งานบัญชีแอดมินแล้ว" if status == "อนุมัติ" else "🔒 ระงับการใช้งานบัญชีแอดมินแล้ว"
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตสถานะบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@app.route("/api/admin/<int:id>", methods=["DELETE"])
def delete_admin_user(id):
    db = get_db()
    try:
        db.execute("DELETE FROM admin_users WHERE id = ?", (id,))
        db.commit()
        return jsonify({"success": True, "message": "🗑️ ลบบัญชีแอดมินเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบบัญชีแอดมินได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Welfare Season Management
# ---------------------------------------------------------------------------
@app.route("/api/welfare-seasons", methods=["GET"])
def get_welfare_seasons():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM welfare_seasons ORDER BY createdAt DESC").fetchall()
        seasons = []
        for r in rows:
            s = row_to_dict(r)
            weapons = db.execute(
                "SELECT * FROM welfare_season_weapons WHERE seasonId = ? ORDER BY id ASC",
                (r["id"],),
            ).fetchall()
            s["weapons"] = [row_to_dict(w) for w in weapons]
            s["allowedTypes"] = json.loads(s["allowedTypes"] or "[]")
            s["selectedGangs"] = json.loads(s["selectedGangs"] or "[]")
            seasons.append(s)
        return jsonify({"success": True, "seasons": seasons})
    except Exception as e:
        return jsonify({"success": False, "seasons": [], "message": "❌ ไม่สามารถดึงข้อมูลซีซันได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-seasons", methods=["POST"])
def create_welfare_season():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "❌ กรุณากรอกชื่อซีซัน"}), 400
    db = get_db()
    try:
        kind = data.get("kind") or "regular"
        start = data.get("startDate") or None
        end = data.get("endDate") or None
        active = 1 if data.get("active", True) else 0
        allowed = json.dumps(data.get("allowedTypes") or [])
        gang_sel = data.get("gangSelection") or "all"
        selected = json.dumps(data.get("selectedGangs") or [])
        cur = db.execute(
            """
            INSERT INTO welfare_seasons (name, kind, startDate, endDate, active, allowedTypes, gangSelection, selectedGangs, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, kind, start, end, active, allowed, gang_sel, selected, now_thai()),
        )
        db.commit()
        season_id = cur.lastrowid
        created = db.execute("SELECT * FROM welfare_seasons WHERE id = ?", (season_id,)).fetchone()
        return jsonify({"success": True, "message": "✅ เพิ่มซีซันสำเร็จ", "season": row_to_dict(created)})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถเพิ่มซีซันได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-seasons/<int:season_id>", methods=["PATCH"])
def update_welfare_season(season_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        season = db.execute("SELECT * FROM welfare_seasons WHERE id = ?", (season_id,)).fetchone()
        if not season:
            return jsonify({"success": False, "message": "❌ ไม่พบซีซัน"}), 404
        updates = []
        params = []
        if "name" in data:
            updates.append("name = ?")
            params.append((data["name"] or "").strip())
        if "kind" in data:
            updates.append("kind = ?")
            params.append(data["kind"])
        if "startDate" in data:
            updates.append("startDate = ?")
            params.append(data["startDate"] or None)
        if "endDate" in data:
            updates.append("endDate = ?")
            params.append(data["endDate"] or None)
        if "active" in data:
            updates.append("active = ?")
            params.append(1 if data["active"] else 0)
        if "allowedTypes" in data:
            updates.append("allowedTypes = ?")
            params.append(json.dumps(data["allowedTypes"] or []))
        if "gangSelection" in data:
            updates.append("gangSelection = ?")
            params.append(data["gangSelection"] or "all")
        if "selectedGangs" in data:
            updates.append("selectedGangs = ?")
            params.append(json.dumps(data["selectedGangs"] or []))
        if not updates:
            return jsonify({"success": False, "message": "❌ ไม่มีข้อมูลที่ต้องการแก้ไข"}), 400
        params.append(season_id)
        db.execute(f"UPDATE welfare_seasons SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()
        return jsonify({"success": True, "message": "✅ แก้ไขซีซันสำเร็จ"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถแก้ไขซีซันได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-seasons/<int:season_id>", methods=["DELETE"])
def delete_welfare_season(season_id):
    db = get_db()
    try:
        db.execute("DELETE FROM welfare_seasons WHERE id = ?", (season_id,))
        db.commit()
        return jsonify({"success": True, "message": "🗑️ ลบซีซันเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบซีซันได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-seasons/<int:season_id>/weapons", methods=["POST"])
def set_welfare_season_weapons(season_id):
    data = request.get_json(silent=True) or {}
    weapons = data.get("weapons") or []
    if not isinstance(weapons, list):
        return jsonify({"success": False, "message": "❌ ข้อมูลอาวุธไม่ถูกต้อง"}), 400
    db = get_db()
    try:
        season = db.execute("SELECT id FROM welfare_seasons WHERE id = ?", (season_id,)).fetchone()
        if not season:
            return jsonify({"success": False, "message": "❌ ไม่พบซีซัน"}), 404
        # Normalize and deduplicate
        seen = set()
        inserts = []
        for w in weapons:
            t = (w.get("type") or "").strip()
            name = (w.get("weapon") or "").strip()
            if not t or not name:
                continue
            key = (t, name)
            if key in seen:
                continue
            seen.add(key)
            inserts.append((t, name))
        # Replace all weapons for this season
        db.execute("DELETE FROM welfare_season_weapons WHERE seasonId = ?", (season_id,))
        for t, name in inserts:
            db.execute(
                "INSERT INTO welfare_season_weapons (seasonId, type, weapon) VALUES (?, ?, ?)",
                (season_id, t, name),
            )
        db.commit()
        return jsonify({"success": True, "message": "✅ บันทึกรายการอาวุธสำเร็จ"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถบันทึกอาวุธได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Root login (stateless - kept here for completeness)
# ---------------------------------------------------------------------------
@app.route("/api/root/login", methods=["POST"])
def login_root():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"success": False, "message": "❌ กรุณากรอกข้อมูลให้ครบถ้วน"}), 400
    if username != ROOT_USERNAME or password != ROOT_PASSWORD:
        return jsonify({"success": False, "message": "❌ ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลสูงสุดไม่ถูกต้อง"}), 401
    return jsonify({
        "success": True,
        "message": "🎉 เข้าสู่ระบบผู้ดูแลสูงสุดสำเร็จ!",
        "root": {"username": ROOT_USERNAME},
    })

@app.route("/", methods=["GET"])
def get_root():
    return jsonify({"success":"API START !"})

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 4000))
    app.run(host="0.0.0.0", port=port, debug=True)
