import io
import json
import tempfile
import unittest
from server.app import create_app, import_rows, import_legacy_state, password_hash

class AdminTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = self.tmp.name + '/admin.sqlite'
        self.app = create_app(self.path, 'https://admin.example', 'owner', password_hash('a-long-test-password'))
        import_rows(self.path, [{'timestamp':'2025-01-01', 'name':'Original', 'scope':'<script>alert(1)</script>'}])
        self.cookie = ''
        self.csrf = ''

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, route, method='GET', data=None, origin='https://admin.example'):
        raw = json.dumps(data or {}).encode()
        env = {'REQUEST_METHOD':method, 'PATH_INFO':'/api/admin/'+route, 'CONTENT_TYPE':'application/json', 'CONTENT_LENGTH':str(len(raw)), 'wsgi.input':io.BytesIO(raw), 'HTTP_ORIGIN':origin, 'HTTP_COOKIE':self.cookie, 'HTTP_X_CSRF_TOKEN':self.csrf}
        result = {}
        def start(status, headers):
            result['status'] = int(status.split()[0]); result['headers'] = dict(headers)
        body = json.loads(b''.join(self.app(env,start)))
        return result, body

    def login(self):
        r,b = self.call('login','POST',{'username':'owner','password':'a-long-test-password'})
        self.assertEqual(r['status'],200)
        self.cookie = r['headers']['Set-Cookie'].split(';')[0]
        self.csrf = b['csrf']
        self.assertIn('HttpOnly',r['headers']['Set-Cookie'])
        self.assertIn('Secure',r['headers']['Set-Cookie'])

    def test_access_and_csrf(self):
        self.assertEqual(self.call('inquiries')[0]['status'],401)
        self.assertEqual(self.call('login','POST',{},'https://evil.example')[0]['status'],403)
        self.login()
        csrf,self.csrf = self.csrf,''
        self.assertEqual(self.call('logout','POST')[0]['status'],403)
        self.csrf = csrf
        self.assertEqual(self.call('logout','POST')[0]['status'],200)
        self.assertEqual(self.call('inquiries')[0]['status'],401)

    def test_persistence_conflict_and_import(self):
        self.login()
        r,b = self.call('inquiries'); self.assertEqual(len(b['data']),1)
        self.assertEqual(b['data'][0]['name'],'Original')
        patch = {'status':'review','note':'한글 메모','version':0}
        self.assertEqual(self.call('inquiries/2025-01-01','PATCH',patch)[0]['status'],200)
        self.assertEqual(self.call('inquiries/2025-01-01','PATCH',patch)[0]['status'],409)
        import_rows(self.path,[{'timestamp':'2025-01-01','name':'Overwrite'}])
        row = self.call('inquiries')[1]['data'][0]
        self.assertEqual((row['name'],row['status'],row['note']),('Original','review','한글 메모'))
        self.app = create_app(self.path,'https://admin.example','owner',password_hash('changed-password'))
        self.assertEqual(self.call('inquiries')[0]['status'],401)

    def test_legacy_state_is_atomic_and_non_destructive(self):
        with self.assertRaises(ValueError):
            import_legacy_state(self.path, {'2025-01-01':{'status':'done','note':'old'}, 'missing':{'status':'hold'}})
        self.login()
        self.assertEqual(self.call('inquiries')[1]['data'][0]['status'],'')
        import_legacy_state(self.path, {'2025-01-01':{'status':'done','note':'old'}})
        self.assertEqual(self.call('inquiries')[1]['data'][0]['note'],'old')
        with self.assertRaises(ValueError):
            import_legacy_state(self.path, {'2025-01-01':{'status':'hold'}})

    def test_invalid_state_and_throttle(self):
        self.login()
        self.assertEqual(self.call('inquiries/2025-01-01','PATCH',{'status':[], 'note':'', 'version':0})[0]['status'],400)
        for _ in range(10):
            self.assertEqual(self.call('login','POST',{'username':'owner','password':'wrong'})[0]['status'],401)
        self.assertEqual(self.call('login','POST',{'username':'owner','password':'wrong'})[0]['status'],429)

if __name__ == '__main__':
    unittest.main()
