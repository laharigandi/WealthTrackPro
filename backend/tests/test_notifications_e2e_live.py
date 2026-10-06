import asyncio
import json
import time
import requests
import httpx
import pytest

BASE_URL = "http://127.0.0.1:8000/api/v1"

def create_test_user(email, password="Password123!", name="Test User"):
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    if res.status_code in (200, 201):
        pass
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()

def run_complete_realtime_sse_flow():
    """
    Complete end-to-end test verifying:
    1. Connect to SSE /api/v1/notifications/stream?token=...
    2. Receive initial 'connected' and 'notification_update'
    3. Trigger backend event (KYC status update / Goal milestone / Portfolio alert)
    4. Confirm SSE receives the new notification in REAL TIME without polling
    5. Verify unread count increments
    6. Mark as read and verify update
    7. User isolation: User B does not receive User A's notifications
    """
    ts = int(time.time() * 1000)
    user_a = create_test_user(f"user_a_{ts}@example.com", name="User A")
    user_b = create_test_user(f"user_b_{ts}@example.com", name="User B")

    token_a = user_a["access_token"]
    token_b = user_b["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

    # 1. Connect to SSE stream for User A
    received_events_a = []
    stream_connected_event = asyncio.Event()

    async def sse_listener_a():
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("GET", f"{BASE_URL}/notifications/stream?token={token_a}") as response:
                assert response.status_code == 200, f"SSE endpoint returned {response.status_code}"
                assert "text/event-stream" in response.headers.get("content-type", "")
                
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        event_str, buffer = buffer.split("\n\n", 1)
                        if not event_str.strip():
                            continue
                        
                        lines = event_str.strip().split("\n")
                        event_type = "message"
                        data_str = ""
                        for line in lines:
                            if line.startswith("event:"):
                                event_type = line.split(":", 1)[1].strip()
                            elif line.startswith("data:"):
                                data_str = line.split(":", 1)[1].strip()
                        
                        try:
                            parsed_data = json.loads(data_str) if data_str else {}
                        except Exception:
                            parsed_data = data_str

                        received_events_a.append({
                            "event": event_type,
                            "data": parsed_data
                        })

                        if event_type == "connected":
                            stream_connected_event.set()

                        # Stop if we received the triggered goal event
                        if event_type == "notification_update" and isinstance(parsed_data, dict):
                            notifs = parsed_data.get("notifications", [])
                            if any("RealTime Car Goal" in n.get("title", "") or "RealTime Car Goal" in n.get("message", "") for n in notifs):
                                return

    # Run listener in background task
    async def run_test():
        task = asyncio.create_task(sse_listener_a())
        
        # Wait for SSE connection to be established
        await asyncio.wait_for(stream_connected_event.wait(), timeout=5.0)
        assert len(received_events_a) >= 1
        print("[PASSED] Step 1: SSE stream connected successfully with text/event-stream")

        # Step 2: Trigger Goal Milestone Alert for User A
        goal_payload = {
            "title": f"RealTime Car Goal {ts}",
            "category": "Car",
            "target_amount": 1000000.0,
            "current_amount": 550000.0, # 55% progress -> triggers 50% milestone alert
            "monthly_contribution": 20000.0,
            "target_date": "2028-12-31",
            "expected_return_rate": 9.0
        }
        r_goal = requests.post(f"{BASE_URL}/goals", json=goal_payload, headers=headers_a)
        assert r_goal.status_code == 201, f"Goal creation failed: {r_goal.text}"
        print("[PASSED] Step 2: Triggered backend event (Goal creation crossing 50% milestone)")

        # Step 3: Wait for listener to receive the SSE event
        await asyncio.wait_for(task, timeout=5.0)
        
        # Check received events
        update_events = [e for e in received_events_a if e["event"] == "notification_update"]
        assert len(update_events) >= 2, "Expected initial state + triggered real-time update event"
        
        latest_update = update_events[-1]["data"]
        notifs = latest_update["notifications"]
        unread = latest_update["unread_count"]
        
        matching = [n for n in notifs if f"RealTime Car Goal {ts}" in n["message"]]
        assert len(matching) >= 1, f"Triggered notification not found in SSE update: {notifs}"
        assert unread >= 1, f"Unread count not updated in real-time: {unread}"
        title_safe = matching[0]['title'].encode('ascii', 'replace').decode()
        print(f"[PASSED] Step 3: Real-time SSE received notification: '{title_safe}' - unread count = {unread}")

        # Step 4: Mark notification as read
        notif_id = matching[0]["id"]
        r_read = requests.patch(f"{BASE_URL}/notifications/{notif_id}/read", headers=headers_a)
        assert r_read.status_code == 200
        
        r_unread = requests.get(f"{BASE_URL}/notifications/unread-count", headers=headers_a).json()
        assert r_unread["unread_count"] == unread - 1
        print(f"[PASSED] Step 4: Mark as read successfully decreased unread count to {r_unread['unread_count']}")

        # Step 5: Verify User Isolation
        notifs_b = requests.get(f"{BASE_URL}/notifications", headers=headers_b).json()
        assert not any(f"RealTime Car Goal {ts}" in n["message"] for n in notifs_b), "User B received User A's notification!"
        print("[PASSED] Step 5: User isolation verified - User B cannot see User A's notifications")

        # Step 6: Verify GET requests are strictly read-only and idempotent
        db_notifs_before = requests.get(f"{BASE_URL}/notifications", headers=headers_a).json()
        for _ in range(10):
            requests.get(f"{BASE_URL}/notifications", headers=headers_a)
            requests.get(f"{BASE_URL}/portfolio", headers=headers_a)
            requests.get(f"{BASE_URL}/goals", headers=headers_a)
            requests.get(f"{BASE_URL}/advisor/rebalancing", headers=headers_a)
        db_notifs_after = requests.get(f"{BASE_URL}/notifications", headers=headers_a).json()
        assert len(db_notifs_before) == len(db_notifs_after), "GET requests modified notification count!"
        print("[PASSED] Step 6: Idempotency verified - 10 consecutive GETs did not create duplicate records")

    asyncio.run(run_test())

if __name__ == "__main__":
    run_complete_realtime_sse_flow()
    print("\nALL REAL-TIME SSE END-TO-END CHECKS PASSED PERFECTLY!")
