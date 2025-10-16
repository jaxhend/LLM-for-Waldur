import asyncio
from app.db.base import SessionLocal
from app.db.models import Accounts, Users, Threads
import secrets


async def setup_test_data():
    async with SessionLocal() as db:
        # Create test account
        account = Accounts(name="Test Account")
        db.add(account)
        await db.flush()

        # Create test user
        user = Users(
            account_id=account.id,
            username="testuser",
            password_hash="test_hash_not_real"
        )
        db.add(user)
        await db.flush()

        # Create test thread
        thread = Threads(
            user_id=user.id,
            title="Test Conversation",
            url_id=secrets.token_hex(16)
        )
        db.add(thread)
        await db.commit()

        print(f"✓ Created test account (id: {account.id})")
        print(f"✓ Created test user (id: {user.id})")
        print(f"✓ Created test thread (id: {thread.id})")
        print(f"\nYou can now test with thread_id: {thread.id}")


if __name__ == "__main__":
    asyncio.run(setup_test_data())