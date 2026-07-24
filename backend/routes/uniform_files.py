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

bp = Blueprint("uniform_files", __name__)

# ---------------------------------------------------------------------------
# Uniform Files
# ---------------------------------------------------------------------------
@bp.route("/api/uniform-files", methods=["POST"])
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


@bp.route("/api/uniform-files", methods=["GET"])
def get_all_uniform_files():
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM uniform_files ORDER BY id DESC").fetchall()
        return jsonify({"success": True, "files": [row_to_dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "message": "❌ ไม่สามารถดึงข้อมูลไฟล์ชุดได้"}), 500
    finally:
        db.close()


@bp.route("/api/uniform-files/<int:id>/link", methods=["PATCH"])
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


@bp.route("/api/uniform-files/<int:id>/status", methods=["PATCH"])
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


