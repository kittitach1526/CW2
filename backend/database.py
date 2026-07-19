import os
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "database.db"


def now_thai():
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.now(ZoneInfo("Asia/Bangkok"))
    except Exception:
        dt = datetime.utcnow()
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    if not DB_PATH.parent.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS gangs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            abbreviation TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            colorTheme TEXT DEFAULT '#3b82f6',
            leader TEXT NOT NULL,
            leaderDiscord TEXT NOT NULL,
            coLeader1 TEXT,
            coLeader1Discord TEXT,
            coLeader2 TEXT,
            coLeader2Discord TEXT,
            leaderPhone TEXT,
            coLeader1Phone TEXT,
            coLeader2Phone TEXT,
            approver TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            logoUrl TEXT,
            editReason TEXT,
            type TEXT DEFAULT 'Gang'
        );

        CREATE TABLE IF NOT EXISTS gang_edit_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangId INTEGER NOT NULL,
            fullName TEXT NOT NULL,
            abbreviation TEXT NOT NULL,
            colorTheme TEXT,
            leader TEXT NOT NULL,
            leaderDiscord TEXT NOT NULL,
            coLeader1 TEXT,
            coLeader1Discord TEXT,
            coLeader2 TEXT,
            coLeader2Discord TEXT,
            leaderPhone TEXT,
            coLeader1Phone TEXT,
            coLeader2Phone TEXT,
            type TEXT,
            logoUrl TEXT,
            editReason TEXT,
            approver TEXT,
            newPassword TEXT,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            reviewedAt TEXT,
            reviewer TEXT,
            FOREIGN KEY (gangId) REFERENCES gangs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS uniform_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangName TEXT NOT NULL,
            uniformType TEXT NOT NULL,
            fileUrl TEXT NOT NULL,
            approver TEXT NOT NULL,
            approverDiscord TEXT DEFAULT '',
            reason TEXT,
            status TEXT DEFAULT 'รอลง',
            createdAt TEXT,
            details TEXT
        );

        CREATE TABLE IF NOT EXISTS disband_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangId INTEGER NOT NULL UNIQUE,
            reason TEXT,
            approver TEXT,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            reviewedAt TEXT,
            reviewer TEXT,
            FOREIGN KEY (gangId) REFERENCES gangs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pause_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangId INTEGER NOT NULL,
            reason TEXT,
            approver TEXT,
            durationDays INTEGER,
            startDate TEXT,
            endDate TEXT,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            reviewedAt TEXT,
            reviewer TEXT,
            reportedAt TEXT,
            FOREIGN KEY (gangId) REFERENCES gangs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS welfare_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangName TEXT,
            gangAbbreviation TEXT,
            requestName TEXT NOT NULL,
            discordId TEXT NOT NULL,
            welfareItem TEXT NOT NULL,
            requestType TEXT DEFAULT 'receive',
            status TEXT DEFAULT 'รอรับ',
            approver TEXT,
            createdAt TEXT,
            details TEXT
        );

        CREATE TABLE IF NOT EXISTS welfare_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            gang_limit INTEGER,
            female_gang_limit INTEGER,
            family_limit INTEGER,
            active INTEGER DEFAULT 1,
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS welfare_seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kind TEXT DEFAULT 'regular',
            startDate TEXT,
            endDate TEXT,
            active INTEGER DEFAULT 1,
            allowedTypes TEXT,
            gangSelection TEXT DEFAULT 'all',
            selectedGangs TEXT,
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS welfare_season_weapons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seasonId INTEGER NOT NULL,
            type TEXT NOT NULL,
            weapon TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY (seasonId) REFERENCES welfare_seasons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS council_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            status TEXT DEFAULT 'รอรับ',
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            status TEXT DEFAULT 'รอรับ',
            createdAt TEXT
        );
        """
    )

    conn.commit()

    # Run lightweight migrations to add any columns added after the DB was first created
    migrate_db(conn)

    # Seed default root users for testing
    seed_root_users(conn)
    seed_council_users(conn)
    seed_welfare_items(conn)

    conn.close()


def migrate_db(conn):
    """Add columns introduced in newer schema versions without destroying existing data."""
    def add_column(table, column, definition):
        try:
            existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
            if column not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                conn.commit()
                print(f"[migrate] Added {column} to {table}")
        except Exception as e:
            print(f"[migrate] Skipping {table}.{column}: {e}")

    add_column("uniform_files", "details", "TEXT")
    add_column("welfare_requests", "details", "TEXT")
    add_column("welfare_requests", "requestType", "TEXT DEFAULT 'receive'")
    add_column("welfare_requests", "approver", "TEXT")
    add_column("disband_requests", "approver", "TEXT")
    add_column("gangs", "leaderPhone", "TEXT")
    add_column("gangs", "coLeader1Phone", "TEXT")
    add_column("gangs", "coLeader2Phone", "TEXT")
    add_column("gang_edit_requests", "leaderPhone", "TEXT")
    add_column("gang_edit_requests", "coLeader1Phone", "TEXT")
    add_column("gang_edit_requests", "coLeader2Phone", "TEXT")
    add_column("gang_edit_requests", "approver", "TEXT")
    add_column("gang_edit_requests", "logoUrl", "TEXT")
    add_column("welfare_season_weapons", "quantity", "INTEGER DEFAULT 1")
    add_column("welfare_items", "gang_limit", "INTEGER")
    add_column("welfare_items", "female_gang_limit", "INTEGER")
    add_column("welfare_items", "family_limit", "INTEGER")

    # If an older schema made approverDiscord NOT NULL, normalize it so new forms can leave it empty
    try:
        cursor = conn.execute("PRAGMA table_info(uniform_files)")
        approver_discord = next((row for row in cursor if row[1] == "approverDiscord"), None)
        if approver_discord and approver_discord[3]:  # notnull == 1
            conn.execute("ALTER TABLE uniform_files ADD COLUMN approverDiscordNew TEXT DEFAULT ''")
            conn.execute("UPDATE uniform_files SET approverDiscordNew = approverDiscord")
            conn.execute("ALTER TABLE uniform_files DROP COLUMN approverDiscord")
            conn.execute("ALTER TABLE uniform_files RENAME COLUMN approverDiscordNew TO approverDiscord")
            conn.commit()
            print("[migrate] Normalized approverDiscord in uniform_files")
    except Exception as e:
        print(f"[migrate] approverDiscord normalization skipped: {e}")


COUNCIL_USER_NAMES = [
    "Kacie Svia",
    "Vee Mahattanpattamakorn",
    "Matoko Kennedy",
    "Aunyong Howcanmydaybebad",
    "Mapao Yakdonjoobbabdoublll",
    "Haru Haruka",
    "Jaoayla Aowtaejai",
    "Perz Teryakdaiaraitertellmedai",
    "Mudu Blackcouncil",
    "Ryuga Xenia",
    "Nongfxryou YGz",
    "Frost Dekmairakde",
    "Naomi Katagaki",
    "Beam Ilovesaran",
    "Nongalin Aowtaejai",
]


def _slug(text):
    return "".join(c for c in text.lower() if c.isalnum())


def seed_council_users(conn):
    default_password = "council"
    created_at = now_thai()
    try:
        for name in COUNCIL_USER_NAMES:
            username = _slug(name) or f"council{hash(name) & 0xFFFFFFFF}"
            conn.execute(
                "INSERT OR IGNORE INTO council_users (name, username, password, status, createdAt) VALUES (?, ?, ?, ?, ?)",
                (name, username, default_password, "อนุมัติ", created_at),
            )
        conn.commit()
        print("Seeded council users:", len(COUNCIL_USER_NAMES))
    except Exception as e:
        print("Seed council users failed:", e)


def seed_welfare_items(conn):
    try:
        count = conn.execute("SELECT COUNT(*) FROM welfare_items").fetchone()[0]
        if count == 0:
            created_at = now_thai()
            conn.execute(
                "INSERT INTO welfare_items (name, type, active, createdAt) VALUES (?, ?, 1, ?)",
                ("สวัสดิการอาวุธ", "weapon", created_at),
            )
            conn.execute(
                "INSERT INTO welfare_items (name, type, active, createdAt) VALUES (?, ?, 1, ?)",
                ("สวัสดิการรถ", "car", created_at),
            )
            conn.commit()
            print("Seeded welfare items")
    except Exception as e:
        print(f"Seed welfare items failed: {e}")


def seed_root_users(conn):
    root_password = "p@ssw0rd"
    created_at = now_thai()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO council_users (name, username, password, status, createdAt) VALUES (?, ?, ?, ?, ?)",
            ("Root Council", "root", root_password, "อนุมัติ", created_at),
        )
        conn.execute(
            "INSERT OR REPLACE INTO admin_users (name, username, password, status, createdAt) VALUES (?, ?, ?, ?, ?)",
            ("Root Admin", "root", root_password, "อนุมัติ", created_at),
        )
        conn.commit()
    except Exception as e:
        print("Seed root users failed:", e)


if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
