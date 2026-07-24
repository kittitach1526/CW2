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

bp = Blueprint("welfare_season_management", __name__)

# ---------------------------------------------------------------------------
# Welfare Season Management
# ---------------------------------------------------------------------------
@bp.route("/api/welfare-seasons", methods=["GET"])
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


@bp.route("/api/welfare-seasons", methods=["POST"])
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


@bp.route("/api/welfare-seasons/<int:season_id>", methods=["PATCH"])
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


@bp.route("/api/welfare-seasons/<int:season_id>", methods=["DELETE"])
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


@bp.route("/api/welfare-seasons/<int:season_id>/weapons", methods=["POST"])
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


@bp.route("/api/welfare-remaining/<gang_abbreviation>", methods=["GET"])
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


