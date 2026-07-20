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


def _parse_details(details):
    """Parse a JSON details string/dict into a dict."""
    if isinstance(details, dict):
        return details
    if not details:
        return {}
    try:
        return json.loads(details)
    except Exception:
        return {}


def _normalize(value):
    """Normalize a string value for loose comparison."""
    if value is None:
        return ""
    return str(value).strip().lower()


def _active_welfare_for_person(db, gang_abbreviation, name, discord, phone=None):
    """Return active receive welfare items held by a person, matched by name/discord/phone."""
    if not gang_abbreviation:
        return []

    name_norm = _normalize(name)
    discord_norm = _normalize(discord)
    phone_norm = _normalize(phone)

    rows = db.execute(
        """
        SELECT * FROM welfare_requests
        WHERE gangAbbreviation = ? AND requestType = 'receive' AND status = 'รับไปแล้ว'
        """,
        (gang_abbreviation,),
    ).fetchall()

    items = []
    for row in rows:
        d = _parse_details(row["details"])
        receiver_name = _normalize(d.get("receiverName"))
        receiver_discord = _normalize(d.get("receiverDiscord"))
        receiver_phone = _normalize(d.get("receiverPhone"))

        matched = False
        if discord_norm and receiver_discord and discord_norm == receiver_discord:
            matched = True
        elif name_norm and receiver_name and name_norm == receiver_name:
            matched = True
        elif phone_norm and receiver_phone and phone_norm == receiver_phone:
            matched = True

        if matched:
            items.append({"id": row["id"], "welfareItem": row["welfareItem"], "details": d})

    return items


def _actor_from_data(data, default_actor='system', default_role='system'):
    """Extract actor name and role from request data."""
    actor = data.get('actor')
    actor_role = data.get('actorRole')
    if not actor:
        actor = data.get('reporter') or data.get('reviewer') or data.get('requestName') or data.get('username') or data.get('abbreviation') or data.get('gangName') or data.get('approver') or data.get('name') or default_actor
    if not actor_role:
        actor_role = default_role
    return actor, actor_role


def _target_name_from_locals(locals_):
    """Find a human-readable target name from caller local variables."""
    name_keys = ('fullName', 'name', 'gangName', 'abbreviation', 'uniformType', 'welfareItem')
    for value in locals_.values():
        if not hasattr(value, 'keys'):
            continue
        for key in name_keys:
            try:
                if key in value and value[key]:
                    return value[key]
            except Exception:
                continue
    return None


def _build_log_description(action, actor, actor_role, target_type, target_id, target_name, details, created_at):
    """Build a human-readable Thai sentence describing the action."""
    actor = actor or "system"
    actor_role = actor_role or "system"

    d = details if isinstance(details, dict) else {}
    status = d.get("status")
    reason = d.get("reason")
    request_type = d.get("requestType")
    approver = d.get("approver")
    reviewer = d.get("reviewer")
    duration = d.get("durationDays")
    leave_name = d.get("leaveName")
    welfare_item = d.get("welfareItem") or d.get("welfareItemName")
    uniform_type = d.get("uniformType")
    weapon_type = d.get("weaponType")
    car_type = d.get("carType")
    license_plate = d.get("licensePlate")

    action_labels = {
        "register_gang": "ลงทะเบียนแก๊ง",
        "login_gang": "เข้าสู่ระบบแก๊ง",
        "update_gang_status": "อัปเดตสถานะแก๊ง",
        "create_gang_edit_request": "ส่งคำขอแก้ไขข้อมูลแก๊ง",
        "approve_gang_edit_request": "อนุมัติคำขอแก้ไขข้อมูลแก๊ง",
        "reject_gang_edit_request": "ปฏิเสธคำขอแก้ไขข้อมูลแก๊ง",
        "request_disband_gang": "ส่งคำขอยุบแก๊ง",
        "approve_disband_request": "อนุมัติคำขอยุบแก๊ง",
        "reject_disband_request": "ปฏิเสธคำขอยุบแก๊ง",
        "request_pause_gang": "ส่งคำขอพักแก๊ง",
        "approve_pause_request": "อนุมัติคำขอพักแก๊ง",
        "reject_pause_request": "ปฏิเสธคำขอพักแก๊ง",
        "report_pause_request": "รายงานตัวหลังพักแก๊ง",
        "create_uniform_file": "ส่งไฟล์ชุด",
        "update_uniform_file_link": "อัปเดตลิงก์ไฟล์ชุด",
        "update_uniform_status": "อัปเดตสถานะไฟล์ชุด",
        "create_welfare_request": "ส่งคำขอสวัสดิการ",
        "update_welfare_status": "อัปเดตสถานะสวัสดิการ",
        "create_welfare_item": "สร้างรายการสวัสดิการ",
        "update_welfare_item": "แก้ไขรายการสวัสดิการ",
        "delete_welfare_item": "ลบรายการสวัสดิการ",
        "create_council_user": "สร้างบัญชีสภา",
        "update_council_user_status": "อัปเดตสถานะบัญชีสภา",
        "delete_council_user": "ลบบัญชีสภา",
        "create_admin_user": "สร้างบัญชีแอดมิน",
        "update_admin_user_status": "อัปเดตสถานะบัญชีแอดมิน",
        "delete_admin_user": "ลบบัญชีแอดมิน",
        "create_welfare_season": "สร้าง Season สวัสดิการ",
        "update_welfare_season": "แก้ไข Season สวัสดิการ",
        "delete_welfare_season": "ลบ Season สวัสดิการ",
        "set_welfare_season_weapons": "ตั้งค่าอาวุธประจำ Season สวัสดิการ",
    }
    action_label = action_labels.get(action, action or "ทำรายการ")

    target_str = ""
    if target_id and target_name:
        target_str = f"#{target_id} ({target_name})"
    elif target_id:
        target_str = f"#{target_id}"
    elif target_name:
        target_str = target_name

    extra = []
    if request_type:
        extra.append(f"ประเภท {request_type}")
    if welfare_item:
        extra.append(f"สิ่งของ {welfare_item}")
    if uniform_type:
        extra.append(f"ชุด {uniform_type}")
    if weapon_type:
        extra.append(f"อาวุธ {weapon_type}")
    if car_type:
        extra.append(f"รถ {car_type}")
    if license_plate:
        extra.append(f"ป้าย {license_plate}")
    if leave_name:
        extra.append(f"ผู้ออกลอย {leave_name}")
    if approver:
        extra.append(f"ผู้อนุมัติ/ส่งเรื่อง {approver}")
    if reviewer:
        extra.append(f"ผู้พิจารณา {reviewer}")
    if duration:
        extra.append(f"ระยะเวลา {duration} วัน")
    if status:
        extra.append(f"→ สถานะ {status}")
    if reason:
        extra.append(f"เหตุผล {reason}")
    extra_str = " | ".join(extra)

    parts = [f"{actor} ({actor_role})", action_label]
    if target_str:
        parts.append(target_str)
    if extra_str:
        parts.append(extra_str)
    parts.append(f"เมื่อ {created_at}")
    return " ".join(parts)


def _log_action(db, action=None, target_type=None, target_id=None, target_name=None, details=None, default_actor='system', default_role='system'):
    """Insert a system log row. Try to derive context from the caller when not provided."""
    try:
        import inspect
        frame = inspect.currentframe()
        caller = frame.f_back if frame else None
        if not caller:
            return

        locals_ = caller.f_locals
        data = locals_.get('data') or {}
        if action is None:
            action = caller.f_code.co_name

        # Resolve actor
        actor, actor_role = _actor_from_data(data, default_actor, default_role)

        # Resolve target type from caller name if not supplied
        if target_type is None:
            func_name = caller.f_code.co_name
            if 'gang_edit' in func_name:
                target_type = 'gang_edit_request'
            elif 'disband' in func_name:
                target_type = 'disband_request'
            elif 'pause' in func_name:
                target_type = 'pause_request'
            elif 'uniform' in func_name:
                target_type = 'uniform_file'
            elif 'welfare' in func_name:
                if 'item' in func_name:
                    target_type = 'welfare_item'
                else:
                    target_type = 'welfare_request'
            elif 'council' in func_name:
                target_type = 'council_user'
            elif 'admin' in func_name:
                target_type = 'admin_user'
            elif 'season' in func_name:
                target_type = 'welfare_season'
            elif 'gang' in func_name:
                target_type = 'gang'
            else:
                target_type = 'system'

        # Resolve target id from caller locals or last row id
        if target_id is None:
            for key in ('id', 'item_id', 'season_id', 'gang_id'):
                if key in locals_ and locals_[key] is not None:
                    target_id = locals_[key]
                    break
        if target_id is None:
            for key in ('created', 'updated', 'pending', 'existing', 'req'):
                value = locals_.get(key)
                if value and hasattr(value, 'keys') and 'id' in value and value['id'] is not None:
                    target_id = value['id']
                    break
        if target_id is None or target_id == 0:
            try:
                target_id = db.lastrowid
            except Exception:
                target_id = None
        if target_id is None or target_id == 0:
            try:
                row = db.execute("SELECT last_insert_rowid()").fetchone()
                target_id = row[0] if row else None
            except Exception:
                target_id = None

        # Resolve target name
        if target_name is None:
            if isinstance(data, dict):
                target_name = data.get('fullName') or data.get('name') or data.get('gangName') or data.get('abbreviation') or data.get('uniformType') or data.get('welfareItem')
        if not target_name:
            target_name = _target_name_from_locals(locals_)

        # Build details from request data when not provided (exclude sensitive fields)
        if details is None:
            details = {}
            if isinstance(data, dict):
                for key, value in data.items():
                    if key in ('password', 'newPassword', 'passwordConfirm'):
                        continue
                    if value is not None:
                        details[key] = value

        created_at = now_thai()
        description = _build_log_description(action, actor, actor_role, target_type, target_id, target_name, details, created_at)

        db.execute(
            """
            INSERT INTO system_logs (actor, actorRole, action, targetType, targetId, targetName, details, description, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                actor,
                actor_role,
                action,
                target_type,
                target_id,
                target_name,
                json.dumps(details, ensure_ascii=False) if details else None,
                description,
                created_at,
            ),
        )
        db.commit()
    except Exception as e:
        print("[log_action error]", e)


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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        request_type = (data.get("requestType") or "receive").strip()
        gang_abbreviation = data.get("gangAbbreviation") or ""
        welfare_item = data["welfareItem"].strip()

        if request_type == "receive":
            item = db.execute(
                "SELECT * FROM welfare_items WHERE name = ? AND active = 1", (welfare_item,)
            ).fetchone()
            gang = db.execute(
                "SELECT type FROM gangs WHERE abbreviation = ?", (gang_abbreviation,)
            ).fetchone() if gang_abbreviation else None
            if item and gang:
                limit_column = {
                    "Gang": "gang_limit",
                    "Gangs-LD": "female_gang_limit",
                    "Family": "family_limit",
                }.get(gang["type"])
                if limit_column:
                    limit = item[limit_column]
                    if limit is not None:
                        current = db.execute(
                            """
                            SELECT COUNT(*) FROM welfare_requests
                            WHERE gangAbbreviation = ? AND welfareItem = ? AND requestType = 'receive'
                            AND status NOT IN ('เอาออกแล้ว', 'เอาสวัสดิการออกแล้ว')
                            """,
                            (gang_abbreviation, welfare_item),
                        ).fetchone()[0]
                        if current >= limit:
                            return jsonify({
                                "success": False,
                                "message": f"❌ แก๊งประเภท {gang['type']} ครอบครอง {welfare_item} ได้ไม่เกิน {limit} อัน"
                            }), 409

        db.execute(
            """
            INSERT INTO welfare_requests
            (gangName, gangAbbreviation, requestName, discordId, welfareItem, requestType, status, approver, createdAt, details)
            VALUES (?, ?, ?, ?, ?, ?, 'รอรับ', ?, ?, ?)
            """,
            (
                data.get("gangName") or None,
                gang_abbreviation or None,
                data["requestName"].strip(),
                data["discordId"].strip(),
                welfare_item,
                request_type,
                data.get("approver") or None,
                now_thai(),
                json.dumps(details, ensure_ascii=False) if details else None,
            ),
        )
        db.commit()
        _log_action(db)

        # สำหรับคำขอออก-ออกลอย ให้ตรวจสอบว่าคนออกยังมีสวัสดิการค้างอยู่หรือไม่
        if request_type == "leave":
            active_items = _active_welfare_for_person(
                db,
                gang_abbreviation,
                details.get("leaveName"),
                details.get("leaveDiscord"),
                details.get("leavePhone"),
            )
            if active_items:
                item_names = ", ".join({i["welfareItem"] for i in active_items})
                return jsonify({
                    "success": True,
                    "message": f"📦 ส่งคำขอออก-ออกลอยแล้ว แต่ {details.get('leaveName')} ยังมีสวัสดิการ {item_names} ต้องเอาออกก่อนจึงจะอนุมัติได้",
                    "hasWelfare": True,
                    "activeWelfareItems": active_items,
                }), 201
            return jsonify({
                "success": True,
                "message": "📦 ส่งคำขอออก-ออกลอยไปยังระบบสภากลางเรียบร้อยแล้ว!",
                "hasWelfare": False,
            }), 201

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
        _log_action(db)
        if status == "รับไปแล้ว":
            msg = "✅ อนุมัติการแจกจ่ายพัสดุและทำเครื่องหมายส่งมอบแล้ว"
        elif status == "เอาสวัสดิการออกแล้ว":
            msg = "✅ อัปเดตสถานะเป็นเอาสวัสดิการออกแล้ว"
        else:
            msg = "❌ ยกเลิก/นำคำขอสวัสดิการนี้ออกจากระบบแล้ว"
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตสถานะสวัสดิการได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare/leave", methods=["GET"])
def get_leave_requests():
    """Return all leave requests enriched with active welfare held by the leaving person."""
    db = get_db()
    try:
        rows = db.execute(
            "SELECT * FROM welfare_requests WHERE requestType = 'leave' ORDER BY id DESC"
        ).fetchall()
        result = []
        for row in rows:
            req = row_to_dict(row)
            details = _parse_details(req.get("details"))
            active = _active_welfare_for_person(
                db,
                req.get("gangAbbreviation"),
                details.get("leaveName"),
                details.get("leaveDiscord"),
                details.get("leavePhone"),
            )
            req["details"] = details
            req["activeWelfareItems"] = active
            req["hasWelfare"] = bool(active)
            result.append(req)
        return jsonify({"success": True, "requests": result})
    except Exception as e:
        return jsonify({"success": False, "requests": [], "message": "❌ ไม่สามารถดึงข้อมูลคำขอออกลอยได้"}), 500
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


def parse_optional_int(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


@app.route("/api/welfare-items", methods=["POST"])
def create_welfare_item():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    item_type = (data.get("type") or "").strip()
    if not name or not item_type:
        return jsonify({"success": False, "message": "❌ กรุณากรอกชื่อและประเภทสวัสดิการ"}), 400
    gang_limit = parse_optional_int(data.get("gang_limit"))
    female_gang_limit = parse_optional_int(data.get("female_gang_limit"))
    family_limit = parse_optional_int(data.get("family_limit"))
    db = get_db()
    try:
        db.execute(
            "INSERT INTO welfare_items (name, type, gang_limit, female_gang_limit, family_limit, active, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)",
            (name, item_type, gang_limit, female_gang_limit, family_limit, now_thai()),
        )
        db.commit()
        _log_action(db)
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
    has_limit_update = any(k in data for k in ["gang_limit", "female_gang_limit", "family_limit"])
    if not name and not item_type and active is None and not has_limit_update:
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
    if "gang_limit" in data:
        updates.append("gang_limit = ?")
        params.append(parse_optional_int(data.get("gang_limit")))
    if "female_gang_limit" in data:
        updates.append("female_gang_limit = ?")
        params.append(parse_optional_int(data.get("female_gang_limit")))
    if "family_limit" in data:
        updates.append("family_limit = ?")
        params.append(parse_optional_int(data.get("family_limit")))
    params.append(item_id)
    db = get_db()
    try:
        db.execute(f"UPDATE welfare_items SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
        return jsonify({"success": True, "message": "🗑️ ลบบัญชีสภาเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบบัญชีสภาได้"}), 500
    finally:
        db.close()


@app.route("/api/council/<int:id>", methods=["PATCH"])
def update_council_user(id):
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    status = data.get("status")
    db = get_db()
    try:
        existing = db.execute("SELECT * FROM council_users WHERE id = ?", (id,)).fetchone()
        if not existing:
            return jsonify({"success": False, "message": "❌ ไม่พบบัญชีสภา"}), 404
        if username and username != existing["username"]:
            dup = db.execute("SELECT id FROM council_users WHERE username = ? AND id != ?", (username, id)).fetchone()
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
        db.execute(f"UPDATE council_users SET {', '.join(fields)} WHERE id = ?", values)
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ อัปเดตบัญชีสภาเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถอัปเดตบัญชีสภาได้"}), 500
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
        return jsonify({"success": True, "message": "🗑️ ลบบัญชีแอดมินเรียบร้อยแล้ว"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถลบบัญชีแอดมินได้"}), 500
    finally:
        db.close()


@app.route("/api/admin/<int:id>", methods=["PATCH"])
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
        _log_action(db)
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
        _log_action(db)
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
        _log_action(db)
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
            quantity = w.get("quantity")
            try:
                quantity = int(quantity) if quantity is not None else 1
            except (TypeError, ValueError):
                quantity = 1
            if not t or not name:
                continue
            key = (t, name)
            if key in seen:
                continue
            seen.add(key)
            inserts.append((t, name, quantity))
        # Replace all weapons for this season
        db.execute("DELETE FROM welfare_season_weapons WHERE seasonId = ?", (season_id,))
        for t, name, quantity in inserts:
            db.execute(
                "INSERT INTO welfare_season_weapons (seasonId, type, weapon, quantity) VALUES (?, ?, ?, ?)",
                (season_id, t, name, quantity),
            )
        db.commit()
        _log_action(db)
        return jsonify({"success": True, "message": "✅ บันทึกรายการอาวุธสำเร็จ"})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถบันทึกอาวุธได้"}), 500
    finally:
        db.close()


@app.route("/api/welfare-remaining/<gang_abbreviation>", methods=["GET"])
def get_welfare_remaining(gang_abbreviation):
    db = get_db()
    try:
        gang = db.execute("SELECT * FROM gangs WHERE abbreviation = ?", (gang_abbreviation,)).fetchone()
        if not gang:
            return jsonify({"success": False, "message": "❌ ไม่พบแก๊ง"}), 404
        gang = row_to_dict(gang)
        gang_type = gang.get("type") or "Gang"

        # Find active season(s) that apply to this gang type
        # For now support regular active season; event seasons match allowedTypes too
        season_rows = db.execute(
            "SELECT * FROM welfare_seasons WHERE active = 1 ORDER BY kind ASC, id DESC"
        ).fetchall()
        active_season_id = None
        active_season_name = None
        for s in season_rows:
            if s["kind"] == "regular" and (not s["allowedTypes"] or gang_type in json.loads(s["allowedTypes"] or "[]")):
                active_season_id = s["id"]
                active_season_name = s["name"]
                break
            if s["kind"] == "event":
                allowed = json.loads(s["allowedTypes"] or "[]")
                selected = json.loads(s["selectedGangs"] or "[]")
                if (not allowed or gang_type in allowed) and (s["gangSelection"] == "all" or gang_abbreviation in selected):
                    active_season_id = s["id"]
                    active_season_name = s["name"]
                    break

        if not active_season_id:
            return jsonify({"success": True, "season": None, "weapons": []})

        weapons = db.execute(
            "SELECT weapon, type, quantity FROM welfare_season_weapons WHERE seasonId = ? AND type = ? ORDER BY weapon ASC",
            (active_season_id, gang_type),
        ).fetchall()

        all_requests = db.execute(
            "SELECT status, details FROM welfare_requests WHERE gangAbbreviation = ? AND requestType = 'receive' AND welfareItem = ?",
            (gang_abbreviation, "สวัสดิการอาวุธ"),
        ).fetchall()

        result = []
        for w in weapons:
            name = w["weapon"]
            limit = w["quantity"]
            used = 0
            for req in all_requests:
                if req["status"] in ("เอาออกแล้ว", "เอาสวัสดิการออกแล้ว"):
                    continue
                details = req["details"]
                if isinstance(details, str):
                    try:
                        details = json.loads(details)
                    except Exception:
                        details = {}
                if not isinstance(details, dict):
                    details = {}
                if details.get("category") == "weapon" and details.get("weaponType") == name:
                    used += 1
            remaining = None if limit is None or limit <= 0 else max(0, limit - used)
            result.append({
                "weapon": name,
                "limit": limit,
                "used": used,
                "remaining": remaining,
            })

        return jsonify({"success": True, "season": active_season_name, "weapons": result})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถดึงข้อมูลคงเหลือได้"}), 500
    finally:
        db.close()


# ---------------------------------------------------------------------------
# System Logs
# ---------------------------------------------------------------------------
@app.route("/api/logs", methods=["GET"])
def get_system_logs():
    """Return system action logs, optionally filtered and limited."""
    actor = request.args.get("actor")
    action = request.args.get("action")
    target_type = request.args.get("targetType")
    limit = request.args.get("limit", type=int) or 500

    db = get_db()
    try:
        where = []
        params = []
        if actor:
            where.append("actor = ?")
            params.append(actor)
        if action:
            where.append("action = ?")
            params.append(action)
        if target_type:
            where.append("targetType = ?")
            params.append(target_type)

        sql = "SELECT * FROM system_logs"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        rows = db.execute(sql, params).fetchall()
        result = []
        for row in rows:
            log = row_to_dict(row)
            log["details"] = _parse_details(log.get("details"))
            result.append(log)
        return jsonify({"success": True, "logs": result})
    except Exception as e:
        return jsonify({"success": False, "logs": [], "message": "❌ ไม่สามารถดึงข้อมูล log ได้"}), 500
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
