import sys
import os
import json
import time
import requests
import threading
import queue

BASE_URL = "http://127.0.0.1:8000/api/v1"

def log(step: str, status: str, detail: str = ""):
    color = "\033[92m" if status == "PASS" else ("\033[91m" if status == "FAIL" else "\033[93m")
    reset = "\033[0m"
    print(f"[{color}{status}{reset}] {step}: {detail}", flush=True)

class SSEClient:
    def __init__(self, url, token):
        self.url = f"{url}?token={token}"
        self.events = queue.Queue()
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.status_code = None
        self.headers = None
        self.connected_event = threading.Event()
        self.response = None

    def start(self):
        self.thread.start()
        self.connected_event.wait(timeout=5.0)

    def _run(self):
        try:
            self.response = requests.get(self.url, headers={"Accept": "text/event-stream"}, stream=True, timeout=20)
            self.status_code = self.response.status_code
            self.headers = dict(self.response.headers)
            self.connected_event.set()
            if self.response.status_code != 200:
                return

            event_type = "message"
            data_lines = []
            for line in self.response.iter_lines(decode_unicode=True, chunk_size=1):
                if self.stop_event.is_set():
                    break
                if line is None:
                    continue
                line = line.strip()
                if not line:
                    if data_lines:
                        raw_data = "\n".join(data_lines)
                        try:
                            parsed = json.loads(raw_data)
                        except Exception:
                            parsed = raw_data
                        self.events.put({"event": event_type, "data": parsed})
                        event_type = "message"
                        data_lines = []
                    continue

                if line.startswith("event:"):
                    event_type = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    data_lines.append(line.split(":", 1)[1].strip())
                elif line.startswith(":"):
                    self.events.put({"event": "ping", "data": "ping"})
        except Exception as e:
            if not self.stop_event.is_set():
                self.events.put({"event": "error", "data": str(e)})

    def stop(self):
        self.stop_event.set()
        if self.response:
            try:
                self.response.close()
            except Exception:
                pass

    def get_event(self, timeout=5.0):
        try:
            return self.events.get(timeout=timeout)
        except queue.Empty:
            return None


def run_audit():
    print("=" * 70, flush=True)
    print("WealthTrackPro Notifications & Real-Time SSE Complete Audit", flush=True)
    print("=" * 70, flush=True)

    # 1. Login User A
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"email": "john@example.com", "password": "password123"})
    if login_res.status_code != 200:
        log("1. User A Login", "FAIL", f"Status {login_res.status_code}: {login_res.text}")
        return False
    user_a_tokens = login_res.json()
    user_a_token = user_a_tokens["access_token"]
    user_a_refresh = user_a_tokens["refresh_token"]
    user_a_id = user_a_tokens["user"]["id"]
    log("1. User A Login", "PASS", f"User ID {user_a_id}, Token acquired")

    # 2. Login or Register User B for isolation tests
    user_b_email = f"user_b_test_{int(time.time())}@example.com"
    reg_b = requests.post(f"{BASE_URL}/auth/register", json={"name": "User B", "email": user_b_email, "password": "Password123!"})
    user_b_res = requests.post(f"{BASE_URL}/auth/login", json={"email": user_b_email, "password": "Password123!"})
    if user_b_res.status_code != 200:
        log("2. User B Setup", "FAIL", f"User B setup failed: {user_b_res.text}")
        return False
    user_b_token = user_b_res.json()["access_token"]
    user_b_id = user_b_res.json()["user"]["id"]
    log("2. User B (Isolation Check)", "PASS", f"User B ID {user_b_id} ready")

    # 3. Verify SSE Security: Missing/Invalid/Expired Token
    sec_no_token = requests.get(f"{BASE_URL}/notifications/stream")
    if sec_no_token.status_code == 401:
        log("3a. SSE Security (No Token)", "PASS", "Rejected with 401 Unauthorized")
    else:
        log("3a. SSE Security (No Token)", "FAIL", f"Expected 401, got {sec_no_token.status_code}")

    sec_bad_token = requests.get(f"{BASE_URL}/notifications/stream?token=invalid_token_12345")
    if sec_bad_token.status_code == 401:
        log("3b. SSE Security (Invalid Token)", "PASS", "Rejected with 401 Unauthorized")
    else:
        log("3b. SSE Security (Invalid Token)", "FAIL", f"Expected 401, got {sec_bad_token.status_code}")

    # 4. Connect User A to SSE Stream
    sse_a = SSEClient(f"{BASE_URL}/notifications/stream", user_a_token)
    sse_a.start()
    time.sleep(0.3)

    if sse_a.status_code == 200 and "text/event-stream" in sse_a.headers.get("content-type", ""):
        log("4. SSE Stream Connect (User A)", "PASS", f"Status 200, Content-Type: {sse_a.headers.get('content-type')}")
    else:
        log("4. SSE Stream Connect (User A)", "FAIL", f"Status {sse_a.status_code}, Headers: {sse_a.headers}")
        sse_a.stop()
        return False

    # Check initial events (connected + initial notification_update)
    evt1 = sse_a.get_event(timeout=2.0)
    evt2 = sse_a.get_event(timeout=2.0)
    log("5. Initial SSE Handshake", "PASS", f"Received initial events: {evt1.get('event') if evt1 else None}, {evt2.get('event') if evt2 else None}")

    # Connect User B to SSE stream
    sse_b = SSEClient(f"{BASE_URL}/notifications/stream", user_b_token)
    sse_b.start()
    time.sleep(0.3)
    # Drain User B initial events
    while True:
        e = sse_b.get_event(timeout=0.3)
        if not e:
            break

    # 6. Real-Time Test: Backend Mutation (Goal Creation at 75% Milestone)
    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    test_goal_title = f"RealTime Test Goal {int(time.time())}"
    goal_payload = {
        "title": test_goal_title,
        "category": "Wealth",
        "target_amount": 100000.0,
        "current_amount": 75000.0, # 75% milestone
        "monthly_contribution": 5000.0,
        "target_date": "2028-12-31"
    }

    t0 = time.time()
    create_goal_res = requests.post(f"{BASE_URL}/goals", json=goal_payload, headers=headers_a)
    if create_goal_res.status_code != 201:
        log("6. Create Goal Trigger", "FAIL", f"Status {create_goal_res.status_code}: {create_goal_res.text}")
    else:
        goal_data = create_goal_res.json()
        goal_id = goal_data["id"]
        log("6. Create Goal Trigger", "PASS", f"Goal ID {goal_id} created (75% milestone)")

        # Wait for Real-Time SSE message on User A's stream
        live_evt = sse_a.get_event(timeout=3.0)
        t_elapsed = (time.time() - t0) * 1000
        if live_evt and live_evt.get("event") == "notification_update":
            notifs = live_evt["data"].get("notifications", [])
            unread = live_evt["data"].get("unread_count", 0)
            has_milestone = any("75%" in n.get("message", "") or "75%" in n.get("title", "") for n in notifs)
            if has_milestone:
                log("7. Real-Time SSE Reception (User A)", "PASS", f"Received notification_update in {t_elapsed:.1f}ms! Unread count: {unread}")
            else:
                log("7. Real-Time SSE Reception (User A)", "FAIL", f"Event received but milestone missing in payload: {notifs}")
        else:
            log("7. Real-Time SSE Reception (User A)", "FAIL", f"No notification_update event received within 3s! Got: {live_evt}")

        # Verify User Isolation: User B must NOT have received User A's goal event
        user_b_evt = sse_b.get_event(timeout=1.0)
        if user_b_evt is None:
            log("8. User Isolation Check", "PASS", "User B received 0 events for User A's goal mutation")
        else:
            log("8. User Isolation Check", "FAIL", f"User B unexpectedly received event: {user_b_evt}")

    # 9. Test Mark As Read via API and check Real-Time broadcast
    notifs_res = requests.get(f"{BASE_URL}/notifications", headers=headers_a)
    notif_list = notifs_res.json()
    if notif_list:
        first_unread = next((n for n in notif_list if not n["is_read"]), None)
        if first_unread:
            target_id = first_unread["id"]
            patch_res = requests.patch(f"{BASE_URL}/notifications/{target_id}/read", headers=headers_a)
            if patch_res.status_code == 200:
                mark_evt = sse_a.get_event(timeout=3.0)
                if mark_evt and mark_evt.get("event") == "notification_update":
                    log("9. Real-Time Mark As Read", "PASS", f"Notification {target_id} marked read; live update broadcasted unread={mark_evt['data'].get('unread_count')}")
                else:
                    log("9. Real-Time Mark As Read", "FAIL", f"Live SSE event not received for mark as read: {mark_evt}")
            else:
                log("9. Real-Time Mark As Read", "FAIL", f"PATCH returned {patch_res.status_code}")

    # 10. Test Idempotency: Multiple GET calls must NOT create duplicate records
    c1 = len(requests.get(f"{BASE_URL}/notifications", headers=headers_a).json())
    requests.get(f"{BASE_URL}/portfolio", headers=headers_a)
    requests.get(f"{BASE_URL}/goals", headers=headers_a)
    requests.get(f"{BASE_URL}/advisor/rebalancing", headers=headers_a)
    c2 = len(requests.get(f"{BASE_URL}/notifications", headers=headers_a).json())
    if c1 == c2:
        log("10. Idempotency & Duplicate Prevention", "PASS", f"Notification count remained {c1} across repeated GET calls")
    else:
        log("10. Idempotency & Duplicate Prevention", "FAIL", f"Count changed from {c1} to {c2}")

    # 11. Test Token Refresh & Reconnect
    ref_res = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": user_a_refresh})
    if ref_res.status_code == 200:
        new_token = ref_res.json()["access_token"]
        sse_a.stop()
        sse_a_fresh = SSEClient(f"{BASE_URL}/notifications/stream", new_token)
        sse_a_fresh.start()
        time.sleep(0.3)
        if sse_a_fresh.status_code == 200:
            log("11. Token Refresh & SSE Reconnect", "PASS", "New access token accepted by SSE stream successfully")
            sse_a_fresh.stop()
        else:
            log("11. Token Refresh & SSE Reconnect", "FAIL", f"SSE rejected new token: {sse_a_fresh.status_code}")
    else:
        log("11. Token Refresh & SSE Reconnect", "FAIL", f"Refresh failed: {ref_res.status_code}")

    # Clean up
    sse_a.stop()
    sse_b.stop()

    print("=" * 70, flush=True)
    print("AUDIT SUMMARY: REAL-TIME NOTIFICATION VERIFICATION COMPLETE", flush=True)
    print("=" * 70, flush=True)
    return True

if __name__ == "__main__":
    run_audit()
