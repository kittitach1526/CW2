import http.client
import json
import random
import sys
import time

HOST = "127.0.0.1"
PORT = 5000


def request(method, path, body=None):
    conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
    headers = {"Content-Type": "application/json"}
    payload = json.dumps(body) if body is not None else None
    try:
        conn.request(method, path, body=payload, headers=headers)
        res = conn.getresponse()
        data = res.read().decode("utf-8")
        try:
            parsed = json.loads(data) if data else {}
        except json.JSONDecodeError:
            parsed = {"raw": data}
        return res.status, parsed
    except Exception as e:
        return None, {"error": str(e)}
    finally:
        conn.close()


def expect(status, body, expected_status, predicate=None, label=""):
    ok = status == expected_status and (predicate is None or predicate(body))
    prefix = "PASS" if ok else "FAIL"
    print(f"{prefix}: {label} (status={status}, body={body})")
    if not ok:
        return False
    return True


def run():
    all_ok = True

    # health
    s, b = request("GET", "/api/health")
    all_ok &= expect(s, b, 200, lambda x: x.get("ok"), "health")

    # generate unique test data
    suffix = str(int(time.time() * 1000) + random.randint(0, 1000))
    abbr = f"TG{suffix}"
    new_abbr = f"TG{suffix}N"

    # register gang
    gang_payload = {
        "fullName": "Test Gang",
        "abbreviation": abbr,
        "password": "pass",
        "type": "Gang",
        "leader": "Leader",
        "leaderDiscord": "123",
        "approver": "Approver",
        "colorTheme": "#3b82f6",
    }
    s, b = request("POST", "/api/gangs/register", gang_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success"), "register gang")

    # duplicate abbreviation
    s, b = request("POST", "/api/gangs/register", gang_payload)
    all_ok &= expect(s, b, 409, lambda x: not x.get("success"), "register gang duplicate")

    # login gang
    s, b = request("POST", "/api/gangs/login", {"abbreviation": abbr, "password": "pass"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success") and x.get("gang"), "login gang")
    gang_id = b["gang"]["id"]

    # login wrong password
    s, b = request("POST", "/api/gangs/login", {"abbreviation": abbr, "password": "wrong"})
    all_ok &= expect(s, b, 401, lambda x: not x.get("success"), "login wrong password")

    # get all gangs
    s, b = request("GET", "/api/gangs")
    all_ok &= expect(s, b, 200, lambda x: abbr in [g["abbreviation"] for g in x.get("gangs", [])], "get all gangs")

    # update gang status approved
    s, b = request("PATCH", f"/api/gangs/{gang_id}/status", {"status": "approved"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "update gang status approved")

    # create gang edit request
    edit_payload = {
        "id": gang_id,
        "fullName": "Updated Gang",
        "abbreviation": new_abbr,
        "colorTheme": "#ff0000",
        "leader": "Leader2",
        "leaderDiscord": "456",
        "type": "Gang",
        "newPassword": "newpass",
        "editReason": "change name",
    }
    s, b = request("POST", f"/api/gangs/{gang_id}/edit-requests", edit_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success") and x.get("editRequest"), "create gang edit request")
    edit_id = b["editRequest"]["id"]

    # get pending edit requests
    s, b = request("GET", "/api/edit-requests/pending")
    all_ok &= expect(s, b, 200, lambda x: any(r["id"] == edit_id for r in x.get("requests", [])), "get pending edit requests")

    # get edit request by gang
    s, b = request("GET", f"/api/gangs/{gang_id}/edit-requests")
    all_ok &= expect(s, b, 200, lambda x: x.get("request") and x["request"]["id"] == edit_id, "get edit request by gang")

    # approve edit request
    s, b = request("POST", f"/api/edit-requests/{edit_id}/approve", {"reviewer": "Tester"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "approve gang edit request")

    # login with new abbreviation and password
    s, b = request("POST", "/api/gangs/login", {"abbreviation": new_abbr, "password": "newpass"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success") and x["gang"]["abbreviation"] == new_abbr, "login with new credentials after edit")

    # create uniform file
    uniform_payload = {
        "gangName": "Updated Gang",
        "uniformType": "Work",
        "fileUrl": "https://example.com/uniform.png",
        "approver": "Admin",
        "approverDiscord": "789",
        "reason": "new uniform",
    }
    s, b = request("POST", "/api/uniform-files", uniform_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success"), "create uniform file")

    # get all uniform files
    s, b = request("GET", "/api/uniform-files")
    all_ok &= expect(s, b, 200, lambda x: len(x.get("files", [])) > 0, "get all uniform files")
    uniform_id = b["files"][0]["id"]

    # update uniform file link
    s, b = request("PATCH", f"/api/uniform-files/{uniform_id}/link", {"newFileUrl": "https://example.com/new.png", "reason": "update"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "update uniform file link")

    # update uniform status
    s, b = request("PATCH", f"/api/uniform-files/{uniform_id}/status", {"status": "ลงแล้ว"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "update uniform status")

    # create welfare request
    welfare_payload = {
        "gangName": "Updated Gang",
        "gangAbbreviation": new_abbr,
        "requestName": "John",
        "discordId": "111",
        "welfareItem": "money",
    }
    s, b = request("POST", "/api/welfare", welfare_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success"), "create welfare request")

    # get welfare by gang
    s, b = request("GET", f"/api/welfare/gang/{new_abbr}")
    all_ok &= expect(s, b, 200, lambda x: len(x.get("requests", [])) > 0, "get welfare by gang")
    welfare_id = b["requests"][0]["id"]

    # update welfare status
    s, b = request("PATCH", f"/api/welfare/{welfare_id}/status", {"status": "รับไปแล้ว"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "update welfare status")

    # request disband
    s, b = request("POST", "/api/gangs/disband", {"abbreviation": new_abbr, "reason": "disband test"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "request disband")

    # duplicate disband request
    s, b = request("POST", "/api/gangs/disband", {"abbreviation": new_abbr, "reason": "again"})
    all_ok &= expect(s, b, 409, lambda x: not x.get("success"), "duplicate disband request")

    # get pending disband requests
    s, b = request("GET", "/api/disband-requests")
    all_ok &= expect(s, b, 200, lambda x: any(r.get("gang", {}).get("abbreviation") == new_abbr for r in x.get("requests", [])), "get pending disband requests")
    disband_id = next((r["id"] for r in b["requests"] if r.get("gang", {}).get("abbreviation") == new_abbr), None)

    # get disband by gang
    s, b = request("GET", f"/api/gangs/{gang_id}/disband-request")
    all_ok &= expect(s, b, 200, lambda x: x.get("request") is not None, "get disband request by gang")

    # approve disband
    s, b = request("POST", f"/api/disband-requests/{disband_id}/approve", {"reviewer": "Tester"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "approve disband request")

    # login disbanded gang blocked
    s, b = request("POST", "/api/gangs/login", {"abbreviation": new_abbr, "password": "newpass"})
    all_ok &= expect(s, b, 403, lambda x: not x.get("success"), "login disbanded gang blocked")

    # council user flow
    council_payload = {"name": "Council One", "username": f"council{suffix}", "password": "cpass"}
    s, b = request("POST", "/api/council", council_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success"), "create council user")

    s, b = request("POST", "/api/council/login", {"username": council_payload["username"], "password": "cpass"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success") and x.get("council"), "login council")

    s, b = request("GET", "/api/council")
    all_ok &= expect(s, b, 200, lambda x: any(u["username"] == council_payload["username"] for u in x.get("users", [])), "get all council users")
    council_id = next(u["id"] for u in b["users"] if u["username"] == council_payload["username"])

    s, b = request("PATCH", f"/api/council/{council_id}/status", {"status": "ระงับใช้งาน"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "update council status")

    s, b = request("POST", "/api/council/login", {"username": council_payload["username"], "password": "cpass"})
    all_ok &= expect(s, b, 403, lambda x: not x.get("success"), "login suspended council blocked")

    s, b = request("DELETE", f"/api/council/{council_id}")
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "delete council user")

    # admin user flow
    admin_payload = {"name": "Admin One", "username": f"admin{suffix}", "password": "apass"}
    s, b = request("POST", "/api/admin", admin_payload)
    all_ok &= expect(s, b, 201, lambda x: x.get("success"), "create admin user")

    s, b = request("POST", "/api/admin/login", {"username": admin_payload["username"], "password": "apass"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success") and x.get("admin"), "login admin")

    s, b = request("GET", "/api/admin")
    all_ok &= expect(s, b, 200, lambda x: any(u["username"] == admin_payload["username"] for u in x.get("users", [])), "get all admin users")
    admin_id = next(u["id"] for u in b["users"] if u["username"] == admin_payload["username"])

    s, b = request("DELETE", f"/api/admin/{admin_id}")
    all_ok &= expect(s, b, 200, lambda x: x.get("success"), "delete admin user")

    # root login
    s, b = request("POST", "/api/root/login", {"username": "root", "password": "changeme123"})
    all_ok &= expect(s, b, 200, lambda x: x.get("success") and x.get("root"), "root login")

    s, b = request("POST", "/api/root/login", {"username": "root", "password": "wrong"})
    all_ok &= expect(s, b, 401, lambda x: not x.get("success"), "root login wrong password")

    if all_ok:
        print("\n✅ ทดสอบ API ทั้งหมดผ่าน")
        return 0
    else:
        print("\n❌ มีบางส่วนล้มเหลว")
        return 1


if __name__ == "__main__":
    sys.exit(run())
