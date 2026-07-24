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

bp = Blueprint("welfare_requests", __name__)

# ---------------------------------------------------------------------------
# Welfare Requests
# ---------------------------------------------------------------------------
@bp.route("/api/welfare", methods=["POST"])
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
                "SELECT id, type, fullName FROM gangs WHERE abbreviation = ?", (gang_abbreviation,)
            ).fetchone() if gang_abbreviation else None
            if item and gang:
                # Prefer per-gang limit; fall back to legacy type-based default if not configured
                gwi = db.execute(
                    """
                    SELECT item_limit FROM gang_welfare_items
                    WHERE gangId = ? AND welfareItemId = ? AND active = 1
                    """,
                    (gang["id"], item["id"]),
                ).fetchone()
                if gwi and gwi["item_limit"] is not None:
                    limit = gwi["item_limit"]
                else:
                    limit_column = {
                        "Gang": "gang_limit",
                        "Gangs-LD": "female_gang_limit",
                        "Family": "family_limit",
                    }.get(gang["type"])
                    limit = item[limit_column] if limit_column else None
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
                            "message": f"❌ แก๊ง {gang['fullName']} ครอบครอง {welfare_item} ได้ไม่เกิน {limit} อัน"
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


@bp.route("/api/welfare", methods=["GET"])
def get_all_welfare_requests():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM welfare_requests ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "requests": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "requests": [], "message": "❌ ไม่สามารถดึงข้อมูลคำขอสวัสดิการได้"}), 500
    finally:
        db.close()


@bp.route("/api/welfare/gang/<gang_abbreviation>", methods=["GET"])
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


@bp.route("/api/welfare/<int:id>/status", methods=["PATCH"])
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


@bp.route("/api/welfare/leave", methods=["GET"])
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


