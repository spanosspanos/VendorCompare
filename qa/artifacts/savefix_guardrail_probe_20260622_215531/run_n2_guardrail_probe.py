import json, os, time, requests
base="http://127.0.0.1:8002"
pin_path=os.path.expanduser("~/.vc_test_pin")
with open(pin_path) as f:
    pin=f.read().strip()
s=requests.Session()
out={"base_url":base,"attempts_planned":2,"iterations":[],"started_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),"fail_fast":True}
login=s.post(base+"/api/auth/login", json={"pin":pin}, timeout=20)
out["login_status"]=login.status_code
login.raise_for_status()
token=login.json()["token"]
s.headers.update({"Authorization":"Bearer "+token})
before=s.get(base+"/api/orders/", timeout=20); before.raise_for_status()
before_orders=before.json(); before_ids={o["id"] for o in before_orders}
out["before"]={"count":len(before_orders),"max_id":max(before_ids) if before_ids else None}
for i in range(1,3):
    rec={"i":i}
    messages=[{"role":"user","content":"I need 2 limes"}]
    t0=time.time()
    r1=s.post(base+"/api/chat", json={"messages":messages}, timeout=180)
    rec["assemble_status"]=r1.status_code; rec["assemble_seconds"]=round(time.time()-t0,2)
    r1.raise_for_status(); d1=r1.json()
    od=d1.get("order_data") or None
    rec["assemble_has_order_data"]=bool(od)
    rec["draft_id"]=(od or {}).get("draft_id")
    rec["assemble_reply_excerpt"]=(d1.get("reply") or "")[:260]
    rec["guardrail_no_draft"]=(not od and "verified VendorCompare draft" in (d1.get("reply") or "") and "nothing was saved" in (d1.get("reply") or ""))
    out["iterations"].append(rec)
    print(json.dumps(rec), flush=True)
    if not od:
        out["halt_reason"]="first_turn_no_order_data"
        break
    messages += [{"role":"assistant","content":d1.get("reply", ""),"draft_id":rec["draft_id"]}]
    messages += [{"role":"user","content":"save it","draft_id":rec["draft_id"]}]
    t1=time.time()
    r2=s.post(base+"/api/chat", json={"messages":messages,"draft_id":rec["draft_id"]}, timeout=180)
    rec["save_status"]=r2.status_code; rec["save_seconds"]=round(time.time()-t1,2)
    r2.raise_for_status(); d2=r2.json()
    receipt=d2.get("confirmation_receipt")
    rec["has_confirmation_receipt"]=bool(receipt)
    rec["save_reply_excerpt"]=(d2.get("reply") or "")[:260]
after=s.get(base+"/api/orders/", timeout=20); after.raise_for_status()
after_orders=after.json(); after_ids={o["id"] for o in after_orders}
out["after"]={"count":len(after_orders),"max_id":max(after_ids) if after_ids else None,"new_ids_after_cleanup":sorted(after_ids-before_ids)}
out["summary"]={"attempted_iterations":len(out["iterations"]),"drafts":sum(1 for r in out["iterations"] if r.get("assemble_has_order_data")),"guardrail_no_draft":sum(1 for r in out["iterations"] if r.get("guardrail_no_draft")),"persisted_after":len(after_ids-before_ids)}
out["finished_at"]=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
print("FINAL", json.dumps(out["summary"]), flush=True)
with open(os.environ["OUT_JSON"],"w") as f: json.dump(out,f,indent=2)
