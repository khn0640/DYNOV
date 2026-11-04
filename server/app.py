"""Private admin WSGI API. Run behind HTTPS; never expose the database as static files."""
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie, CookieError
from pathlib import Path
from urllib.parse import unquote

STATUSES = {'', 'new', 'review', 'quote', 'hold', 'done'}


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()


def connect(path):
    db = sqlite3.connect(path)
    db.execute('CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT "", note TEXT NOT NULL DEFAULT "", version INTEGER NOT NULL DEFAULT 0)')
    db.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, at REAL NOT NULL)')
    return db


@contextmanager
def database(path):
    db = connect(path)
    try:
        with db:
            db.execute('BEGIN IMMEDIATE')
            yield db
    finally:
        db.close()


def import_rows(path, rows):
    """Explicit offline import only. Existing records and administrator edits are never overwritten."""
    if not isinstance(rows, list):
        raise ValueError('Expected JSON array')
    with database(path) as db:
        for row in rows:
            key = str(row.get('id') or row.get('timestamp') or '')
            if not key:
                raise ValueError('Every record needs an id or original timestamp')
            db.execute('INSERT OR IGNORE INTO inquiries(id,payload) VALUES (?,?)', (key, json.dumps(row, ensure_ascii=False)))


def import_legacy_state(path, states):
    if not isinstance(states, dict):
        raise ValueError('Expected legacy state object')
    with database(path) as db:
        for key, state in states.items():
            status, note = state.get('status', ''), state.get('note', '')
            if not isinstance(status, str) or status not in STATUSES or not isinstance(note, str) or len(note) > 4000:
                raise ValueError('Invalid legacy state')
            # Fail atomically on missing IDs or conflicts; operator resolves using backups.
            changed = db.execute('UPDATE inquiries SET status=?,note=?,version=1 WHERE id=? AND version=0 AND status="" AND note=""', (status,note,str(key)))
            if changed.rowcount != 1:
                raise ValueError('Missing or already edited legacy id: ' + str(key))


def create_app(db_path=None, origin=None, username=None, encoded_password=None):
    path = db_path or os.environ['ADMIN_DB_PATH']
    origin = origin or os.environ['ADMIN_ORIGIN']
    username = username or os.environ['ADMIN_USERNAME']
    encoded_password = encoded_password or os.environ['ADMIN_PASSWORD_HASH']
    if not origin.startswith('https://') or '/' in origin[8:]:
        raise ValueError('ADMIN_ORIGIN must be an HTTPS origin without trailing slash')
    salt, expected = encoded_password.split(':')
    if len(expected) != 128 or len(salt) < 16:
        raise ValueError('Invalid scrypt password hash')
    connect(path).close()

    def app(env, start):
        headers = [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')]
        def reply(code, data):
            start(f'{code} ' + {200:'OK',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',409:'Conflict',413:'Payload Too Large',429:'Too Many Requests',500:'Internal Server Error'}[code], headers)
            return [json.dumps(data, ensure_ascii=False).encode()]
        method, route = env['REQUEST_METHOD'], env['PATH_INFO']
        if not route.startswith('/api/admin/'):
            return reply(404, {'error':'Not found'})
        body = {}
        if method in ('POST', 'PATCH'):
            if env.get('HTTP_ORIGIN') != origin:
                return reply(403, {'error':'Origin rejected'})
            if env.get('CONTENT_TYPE', '').split(';')[0] != 'application/json':
                return reply(400, {'error':'JSON required'})
            try:
                size = int(env.get('CONTENT_LENGTH') or 0)
                if size < 0 or size > 16384:
                    return reply(413, {'error':'Request too large'})
                body = json.loads(env['wsgi.input'].read(size))
                if not isinstance(body, dict):
                    raise ValueError()
            except (ValueError, TypeError):
                return reply(400, {'error':'Invalid JSON'})
        with database(path) as db:
            now = time.time()
            db.execute('DELETE FROM sessions WHERE expires < ?', (now,))
            db.execute('DELETE FROM attempts WHERE at < ?', (now - 300,))
            if route == '/api/admin/login' and method == 'POST':
                # Shared database limit survives restarts and applies across workers. Add edge IP limits too.
                if db.execute('SELECT count(*) FROM attempts').fetchone()[0] >= 10:
                    return reply(429, {'error':'잠시 후 다시 시도하세요.'})
                password = body.get('password')
                if not isinstance(password, str) or len(password) > 1024:
                    return reply(400, {'error':'Invalid password'})
                valid = hmac.compare_digest(password_hash(password, salt).split(':')[1], expected)
                if not (valid and hmac.compare_digest(str(body.get('username','')), username)):
                    db.execute('INSERT INTO attempts(at) VALUES (?)', (now,))
                    return reply(401, {'error':'로그인 정보를 확인하세요.'})
                token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                db.execute('INSERT INTO sessions VALUES (?,?,?)', (hashlib.sha256((encoded_password + ':' + username + ':' + token).encode()).hexdigest(), csrf, now+3600))
                headers.append(('Set-Cookie', f'__Host-dynov_admin={token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600'))
                return reply(200, {'csrf':csrf})
            cookie = SimpleCookie()
            try:
                cookie.load(env.get('HTTP_COOKIE', ''))
                token = cookie['__Host-dynov_admin'].value
            except (KeyError, ValueError, CookieError):
                return reply(401, {'error':'로그인이 필요합니다.'})
            digest = hashlib.sha256((encoded_password + ':' + username + ':' + token).encode()).hexdigest()
            session = db.execute('SELECT csrf FROM sessions WHERE token=? AND expires>?', (digest, now)).fetchone()
            if session is None:
                return reply(401, {'error':'로그인이 필요합니다.'})
            # All issued sessions belong to the sole configured administrator; no client role is trusted.
            if method in ('POST', 'PATCH') and not hmac.compare_digest(env.get('HTTP_X_CSRF_TOKEN',''), session[0]):
                return reply(403, {'error':'CSRF rejected'})
            if route == '/api/admin/session' and method == 'GET':
                return reply(200, {'csrf':session[0]})
            if route == '/api/admin/logout' and method == 'POST':
                db.execute('DELETE FROM sessions WHERE token=?', (digest,))
                headers.append(('Set-Cookie','__Host-dynov_admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'))
                return reply(200, {'ok':True})
            if route == '/api/admin/inquiries' and method == 'GET':
                data = []
                for key, payload, state, note, version in db.execute('SELECT * FROM inquiries ORDER BY rowid DESC'):
                    data.append(dict(json.loads(payload), id=key, status=state, note=note, version=version))
                return reply(200, {'data':data})
            prefix = '/api/admin/inquiries/'
            if route.startswith(prefix) and method == 'PATCH':
                key = unquote(route[len(prefix):])
                state, note, version = body.get('status'), body.get('note'), body.get('version')
                if not isinstance(state,str) or state not in STATUSES or not isinstance(note,str) or len(note)>4000 or type(version) is not int:
                    return reply(400, {'error':'Invalid state, note or version'})
                result = db.execute('UPDATE inquiries SET status=?,note=?,version=version+1 WHERE id=? AND version=?', (state,note,key,version))
                if result.rowcount != 1:
                    return reply(409, {'error':'다른 변경이 있거나 문의가 없습니다. 새로고침 후 확인하세요.'})
                return reply(200, {'version':version+1})
            return reply(404, {'error':'Not found'})
    return app


if __name__ == '__main__':
    import argparse
    import getpass
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['hash-password','import','import-state'])
    parser.add_argument('file', nargs='?')
    args = parser.parse_args()
    if args.command == 'hash-password':
        password = getpass.getpass('New admin password (16+ characters): ')
        if len(password) < 16:
            raise SystemExit('Use at least 16 characters')
        print(password_hash(password))
    else:
        (import_rows if args.command == 'import' else import_legacy_state)(os.environ['ADMIN_DB_PATH'], json.loads(Path(args.file).read_text()))
