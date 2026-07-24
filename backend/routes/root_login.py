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

bp = Blueprint("root_login", __name__)

# ---------------------------------------------------------------------------
# Root login (stateless - kept here for completeness)
# ---------------------------------------------------------------------------
@bp.route("/api/root/login", methods=["POST"])
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

@bp.route("/", methods=["GET"])
def get_root():
    return jsonify({"success":"API START !"})

