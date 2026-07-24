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

bp = Blueprint("welfare_items", __name__)

# ---------------------------------------------------------------------------
# Welfare Items
# ---------------------------------------------------------------------------
@bp.route("/api/welfare-items", methods=["GET"])
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


@bp.route("/api/welfare-items", methods=["POST"])
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
        cursor = db.execute(
            "INSERT INTO welfare_items (name, type, gang_limit, female_gang_limit, family_limit, active, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)",
            (name, item_type, gang_limit, female_gang_limit, family_limit, now_thai()),
        )
        item_id = cursor.lastrowid
        db.commit()

        # Seed per-gang entries for all existing gangs with no limit (active=1)
        created_at = now_thai()
        gangs = db.execute("SELECT id FROM gangs").fetchall()
        for gang in gangs:
            db.execute(
                "INSERT OR IGNORE INTO gang_welfare_items (gangId, welfareItemId, item_limit, active, createdAt) VALUES (?, ?, ?, 1, ?)",
                (gang["id"], item_id, None, created_at),
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


@bp.route("/api/welfare-items/<int:item_id>", methods=["PATCH"])
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


@bp.route("/api/welfare-items/<int:item_id>", methods=["DELETE"])
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


@bp.route("/api/welfare-items/<int:item_id>/gangs", methods=["GET"])
def get_welfare_item_gang_limits(item_id):
    """Return all approved gangs with their per-gang limit for a welfare item."""
    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT g.id, g.fullName, g.abbreviation, g.type, gwi.item_limit, gwi.active
            FROM gangs g
            LEFT JOIN gang_welfare_items gwi ON gwi.gangId = g.id AND gwi.welfareItemId = ?
            WHERE g.status = 'approved'
            ORDER BY g.fullName ASC
            """,
            (item_id,),
        ).fetchall()
        return jsonify({"success": True, "gangs": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "gangs": [], "message": "❌ ไม่สามารถดึงข้อมูลแก๊งได้"}), 500
    finally:
        db.close()


@bp.route("/api/welfare-items/<int:item_id>/gangs", methods=["POST"])
def update_welfare_item_gang_limits(item_id):
    """Update per-gang limits for a welfare item. Payload: { gangLimits: [{gangId, item_limit, active}] }"""
    data = request.get_json(silent=True) or {}
    gang_limits = data.get("gangLimits") or []
    db = get_db()
    try:
        created_at = now_thai()
        for entry in gang_limits:
            gang_id = entry.get("gangId")
            limit = entry.get("item_limit")
            active = entry.get("active", 1)
            if gang_id is None:
                continue
            # Normalize empty/invalid limits to NULL (unlimited)
            if limit is not None:
                try:
                    limit = int(limit)
                    if limit < 0:
                        limit = None
                except (ValueError, TypeError):
                    limit = None
            existing = db.execute(
                "SELECT id FROM gang_welfare_items WHERE gangId = ? AND welfareItemId = ?",
                (gang_id, item_id),
            ).fetchone()
            if existing:
                db.execute(
                    "UPDATE gang_welfare_items SET item_limit = ?, active = ?, createdAt = ? WHERE id = ?",
                    (limit, 1 if active else 0, created_at, existing["id"]),
                )
            else:
                db.execute(
                    "INSERT INTO gang_welfare_items (gangId, welfareItemId, item_limit, active, createdAt) VALUES (?, ?, ?, ?, ?)",
                    (gang_id, item_id, limit, 1 if active else 0, created_at),
                )
        db.commit()
        _log_action(db, action="update_welfare_item_gang_limits", target_type="welfare_item", target_id=item_id, details={"gangLimits": gang_limits})
        return jsonify({"success": True, "message": "✅ บันทึกการกำหนดสวัสดิการรายแก๊งสำเร็จ"})
    except Exception as e:
        logger.error(f"❌ บันทึกสวัสดิการรายแก๊งล้มเหลว: {e}")
        return jsonify({"success": False, "message": "❌ ไม่สามารถบันทึกสวัสดิการรายแก๊งได้"}), 500
    finally:
        db.close()


