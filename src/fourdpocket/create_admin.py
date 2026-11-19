"""Create a private deployment's administrator from its container terminal."""

import sys
from getpass import getpass

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from fourdpocket.api.auth_utils import hash_password
from fourdpocket.api.deps import get_or_create_settings
from fourdpocket.db.session import get_engine
from fourdpocket.models.base import UserRole
from fourdpocket.models.user import User, UserCreate


def main() -> None:
    if not sys.stdin.isatty():
        raise SystemExit("Open an interactive terminal to create an administrator.")
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    password = getpass("Password: ")
    if password != getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")

    try:
        data = UserCreate(username=username, email=email, password=password)
    except ValidationError as error:
        messages = [f"{item['loc'][0]}: {item['msg']}" for item in error.errors()]
        raise SystemExit("\n".join(messages)) from None

    with Session(get_engine()) as db:
        instance = get_or_create_settings(db)
        instance.admin_bootstrapped = True
        db.add(instance)
        db.add(User(
            username=data.username,
            email=data.email,
            password_hash=hash_password(data.password),
            role=UserRole.admin,
        ))
        try:
            db.commit()
        except IntegrityError:
            raise SystemExit("That username or email is already in use.") from None

    print("Administrator created. You can now sign in to 4DPocket.")


if __name__ == "__main__":
    main()
