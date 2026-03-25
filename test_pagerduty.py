import json
import urllib.request
import urllib.parse

PAGERDUTY_API_KEY = "u+vb1m_A_tEUxujgEbxA"

url = "https://api.pagerduty.com/incidents"
headers = {
    "Authorization": f"Token token={PAGERDUTY_API_KEY}",
    "Accept": "application/vnd.pagerduty+json;version=2",
    "Content-Type": "application/json"
}

# Test 1: Triggered ONLY
print("=" * 60)
print("TEST 1: Triggered only")
print("=" * 60)
params = {"statuses[]": "triggered", "limit": 10}
query_string = urllib.parse.urlencode(params, doseq=True)
full_url = f"{url}?{query_string}"
print(f"URL: {full_url}\n")
req = urllib.request.Request(full_url, headers=headers, method='GET')
with urllib.request.urlopen(req, timeout=10) as response:
    data = json.loads(response.read().decode('utf-8'))
    incidents = data.get("incidents", [])
    print(f"Found {len(incidents)} triggered incident(s)")
    for inc in incidents:
        print(f"  - {inc['id']} | Status: {inc['status']} | Title: {inc['title'][:100]}")

# Test 2: Search for ticket 969243 across ALL triggered + acknowledged (paginated)
print("\n" + "=" * 60)
print("TEST 2: Full paginated search for ticket 969243")
print("=" * 60)
params = {"limit": 100, "offset": 0}
all_incidents = []
while True:
    query_string = urllib.parse.urlencode(params, doseq=True)
    query_string = f"statuses%5B%5D=triggered&statuses%5B%5D=acknowledged&{query_string}"
    full_url = f"{url}?{query_string}"
    req = urllib.request.Request(full_url, headers=headers, method='GET')
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode('utf-8'))
        incidents = data.get("incidents", [])
        if not incidents:
            break
        all_incidents.extend(incidents)
        if not data.get("more", False):
            break
        params["offset"] += params["limit"]

print(f"Total active incidents: {len(all_incidents)}")
triggered = [i for i in all_incidents if i['status'] == 'triggered']
acknowledged = [i for i in all_incidents if i['status'] == 'acknowledged']
print(f"  Triggered: {triggered}")
print(f"  Acknowledged: {len(acknowledged)}")

matching = [inc for inc in all_incidents if "969243" in inc.get('title', '')]
if matching:
    print(f"\n✅ Found {len(matching)} incident(s) matching '969243':")
    for inc in matching:
        print(f"  - {inc['id']} | Status: {inc['status']} | Title: {inc['title'][:100]}")
else:
    print(f"\n❌ No incidents found containing '969243' in title")
    print("\nShowing all triggered incidents for inspection:")
    for inc in triggered:
        print(f"  - {inc['id']} | Status: {inc['status']} | Title: {inc['title'][:100]}")
