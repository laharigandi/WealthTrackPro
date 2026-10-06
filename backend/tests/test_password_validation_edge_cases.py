import pytest
from app.core.security import validate_password_strength, verify_password, get_password_hash
from app.database import SessionLocal
from app.models.user import User

def test_password_policy_edge_cases():
    # 1. Empty password
    valid, errors = validate_password_strength("")
    assert not valid
    assert "at least 8 characters" in errors[0]

    # 2. Short password (< 8 chars)
    valid, errors = validate_password_strength("Ab1!xyz")
    assert not valid
    assert any("at least 8 characters" in e for e in errors)

    # 3. No uppercase
    valid, errors = validate_password_strength("password123!@#")
    assert not valid
    assert any("uppercase" in e for e in errors)

    # 4. No lowercase
    valid, errors = validate_password_strength("PASSWORD123!@#")
    assert not valid
    assert any("lowercase" in e for e in errors)

    # 5. No number
    valid, errors = validate_password_strength("Password!@#$")
    assert not valid
    assert any("number" in e for e in errors)

    # 6. No special character
    valid, errors = validate_password_strength("Password1234")
    assert not valid
    assert any("special character" in e for e in errors)

    # 7. Valid password
    valid, errors = validate_password_strength("ValidPass123!")
    assert valid
    assert len(errors) == 0

    # 8. Very long valid password
    valid, errors = validate_password_strength("VeryLongSecurePasswordWithDigits1234567890AndSpecialSymbols!@#$%^&*()_+")
    assert valid
    assert len(errors) == 0

    # 9. Password hashing test
    raw = "MySecretPass123$"
    hashed = get_password_hash(raw)
    assert hashed != raw
    assert verify_password(raw, hashed)
    assert not verify_password("WrongPassword123$", hashed)

if __name__ == "__main__":
    test_password_policy_edge_cases()
    print("ALL PASSWORD VALIDATION EDGE CASES PASSED SUCCESSFULLY!")
