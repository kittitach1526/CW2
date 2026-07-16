import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "database.db"


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
            type TEXT,
            editReason TEXT,
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
            approverDiscord TEXT NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'รอลง',
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS disband_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangId INTEGER NOT NULL UNIQUE,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            reviewedAt TEXT,
            reviewer TEXT,
            FOREIGN KEY (gangId) REFERENCES gangs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS welfare_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gangName TEXT,
            gangAbbreviation TEXT,
            requestName TEXT NOT NULL,
            discordId TEXT NOT NULL,
            welfareItem TEXT NOT NULL,
            status TEXT DEFAULT 'รอรับ',
            createdAt TEXT
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
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
