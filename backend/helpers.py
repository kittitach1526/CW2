import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db, init_db


class _NoOpLogger:
    """No-op logger replacing loguru after log system removal."""
    def remove(self, *args, **kwargs):
        pass

    def add(self, *args, **kwargs):
        pass

    def info(self, *args, **kwargs):
        pass

    def error(self, *args, **kwargs):
        pass

    def warning(self, *args, **kwargs):
        pass


logger = _NoOpLogger()



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


def _safe_request_data():
    """Capture all request data for logging, masking sensitive fields."""
    from flask import request
    result = {
        "method": request.method,
        "path": request.path,
        "query": dict(request.args) if request.args else {},
        "remote_addr": request.remote_addr,
        "user_agent": request.user_agent.string if request.user_agent else None,
    }

    try:
        if request.is_json:
            data = request.get_json(silent=True) or {}
        else:
            data = request.form.to_dict() if request.form else {}
    except Exception:
        data = {}

    safe_data = {}
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(key, str) and any(p in key.lower() for p in ("password", "รหัสผ่าน")):
                safe_data[key] = "***"
            else:
                safe_data[key] = value
    result["data"] = safe_data
    return result


def _mask_passwords_in_dict(d):
    """Recursively mask password values in a dict."""
    if not isinstance(d, dict):
        return d
    masked = {}
    for key, value in d.items():
        if isinstance(key, str) and any(p in key.lower() for p in ("password", "รหัสผ่าน")):
            masked[key] = "***"
        elif isinstance(value, dict):
            masked[key] = _mask_passwords_in_dict(value)
        elif isinstance(value, list):
            masked[key] = [_mask_passwords_in_dict(v) if isinstance(v, dict) else v for v in value]
        else:
            masked[key] = value
    return masked


def _merge_request_details(existing_details):
    """Merge existing details with full request data."""
    if not isinstance(existing_details, dict):
        existing_details = {} if existing_details is None else {"value": existing_details}
    request_data = _safe_request_data()
    merged = {"request": request_data}
    if existing_details:
        merged.update(existing_details)
    return _mask_passwords_in_dict(merged)


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
    """Log system disabled: no system_logs writes or Discord notifications."""
    pass


