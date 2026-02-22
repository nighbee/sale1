import unittest
from unittest.mock import MagicMock, patch
import uuid
import bcrypt
from src.db import _ensure_manager_user_exists

class TestDB(unittest.TestCase):
    def test_ensure_manager_user_exists_already_exists(self):
        cur = MagicMock()
        company_id = str(uuid.uuid4())
        manager_id = "man123"
        manager_name = "John Doe"
        user_uuid = str(uuid.uuid4())

        cur.fetchone.return_value = (user_uuid,)

        result = _ensure_manager_user_exists(cur, company_id, manager_id, manager_name)

        self.assertEqual(result, user_uuid)
        cur.execute.assert_called_once_with(
            "SELECT id FROM auth_schema.users WHERE manager_id = %s AND company_id = %s",
            (manager_id, company_id)
        )

    def test_ensure_manager_user_exists_creates_new(self):
        cur = MagicMock()
        company_id = str(uuid.uuid4())
        manager_id = "man456"
        manager_name = "Jane Smith"

        cur.fetchone.return_value = None

        result = _ensure_manager_user_exists(cur, company_id, manager_id, manager_name)

        self.assertTrue(uuid.UUID(result)) # Check if it's a valid UUID
        self.assertEqual(cur.execute.call_count, 3) # SELECT, INSERT user, INSERT user_companies

        # Verify email generation and password hashing
        last_call_args = cur.execute.call_args_list[1][0]
        params = last_call_args[1]
        self.assertIn("manager_man456@salesai.local", params)
        self.assertIn("Jane", params)
        self.assertIn("Smith", params)

        # params[3] should be the password hash
        password_hash = params[3]
        self.assertTrue(bcrypt.checkpw("SaleAI!2016".encode('utf-8'), password_hash.encode('utf-8')))

if __name__ == '__main__':
    unittest.main()
