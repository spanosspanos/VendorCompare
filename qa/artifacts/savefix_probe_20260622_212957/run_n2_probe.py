import json, os, sys, time, requests
base="http://127.0.0.1:8002"
pin_path=os.path.expanduser("~/.vc_test_pin")
with open(pin_path) as f:
    pin=f.read().strip()
s=requests.Session()
out={"base_url":base,"attempts":2,"iterations":[],"started_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
login=s.post(base+"/api/auth/login", json={"pin":pin}, timeout=20)
out["login_status"]=login.status_code
login.raise_for_status()
token=login.json()["token"]
s.headers.update({"Authorization":"Bearer "+token})
before=s.get(base+"/api/orders/", timeout=20); before.raise_for_status()
before_orders=before.json(); before_ids={o["id"] for o in before_orders}
out["before"]={"count":len(before_orders),"max_id":max(before_ids) if before_ids else None}
seen=[]
for i in range(1,3):
    rec={"i":i}
    t0=time.time()
    messages=[{"role":"user","content":"I need 2 limes"}]
    r1=s.post(base+"/api/chat", json={"messages":messages}, timeout=180)
    rec["assemble_status"]=r1.status_code; rec["assemble_seconds"]=round(time.time()-t0,2)
    r1.raise_for_status(); d1=r1.json()
    od=d1.get("order_data") or {}
    draft_id=od.get("draft_id")
    rec["draft_id"]=draft_id
    rec["assemble_has_order_data"]=bool(od)
    rec["assemble_reply_excerpt"]=(d1.get("reply") or "")[:180]
    messages += [{"role":"assistant","content":d1.get("reply", ""),"draft_id":draft_id}]
    messages += [{"role":"user","content":"save it","draft_id":draft_id}]
    t1=time.time()
    r2=s.post(base+"/api/chat", json={"messages":messages,"draft_id":draft_id}, timeout=180)
    rec["save_status"]=r2.status_code; rec["save_seconds"]=round(time.time()-t1,2)
    r2.raise_for_status(); d2=r2.json()
    receipt=d2.get("confirmation_receipt")
    rec["has_confirmation_receipt"]=bool(receipt)
    if receipt:
        rec["receipt"]={k:receipt.get(k) for k in ["order_id","status","review_status","total_cost","item_count","savings_vs_worst","created_at"]}
        oid=receipt.get("order_id")
        seen.append(oid)
        chk=s.get(base+f"/api/orders/{oid}", timeout=20)
        rec["readback_status"]=chk.status_code
        if chk.status_code==200:
            detail=chk.json()
            rec["readback"]={"id":detail.get("id"),"total_cost":detail.get("total_cost"),"review_status":detail.get("review_status"),"item_count":len(detail.get("items") or [])}
        dele=s.delete(base+f"/api/orders/{oid}", timeout=20)
        rec["cleanup_status"]=dele.status_code
        rec["cleanup_body"]=dele.text[:200]
    else:
        rec["save_reply_excerpt"]=(d2.get("reply") or "")[:240]
    out["iterations"].append(rec)
    print(json.dumps(rec), flush=True)
after=s.get(base+"/api/orders/", timeout=20); after.raise_for_status()
after_orders=after.json(); after_ids={o["id"] for o in after_orders}
out["after"]={"count":len(after_orders),"max_id":max(after_ids) if after_ids else None,"new_ids_after_cleanup":sorted(after_ids-before_ids)}
out["summary"]={"attempts":2,"confirmations":sum(1 for r in out["iterations"] if r.get("has_confirmation_receipt")),"readbacks_200":sum(1 for r in out["iterations"] if r.get("readback_status")==200),"cleanups_200":sum(1 for r in out["iterations"] if r.get("cleanup_status")==200),"distinct_receipt_ids":len(set(x for x in seen if x is not None)),"doubles":len(seen)-len(set(x for x in seen if x is not None)),"persisted_after_cleanup":len(after_ids-before_ids)}
out["finished_at"]=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
print("FINAL", json.dumps(out["summary"]), flush=True)
with open(os.environ["OUT_JSON"],"w") as f: json.dump(out,f,indent=2)
