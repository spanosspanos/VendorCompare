#!/usr/bin/env python3
import copy,json,os,shutil,tempfile
from pathlib import Path
from datetime import datetime,timezone
R=Path(__file__).resolve().parents[2]; S=Path(tempfile.mkdtemp(prefix='vendorcompare-r1-b1-')); D=S/'vendorcompare.db'; shutil.copy2(R/'backend/vendorcompare.db',D); os.environ['DATABASE_URL']=f'sqlite:///{D}'; os.environ.setdefault('TAQUITO_TEMPERATURE','0.1')
from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.database import SessionLocal
from app.security import get_secret_key
from app.routers import chat
from app.models import Order,OrderItem
H={'Authorization':'Bearer '+jwt.encode({'role':'admin'},get_secret_key(),algorithm='HS256')}
P={
'assemble_order':'Confirmed: assemble an order now for product_id 1 quantity 1. Call assemble_order exactly.',
'save_order':'Confirmed: save the current draft now. Call save_order with supplied draft_id and origin_route chat.',
'lock_vendor':'Confirmed: lock product_id 1 to vendor_id 1 now. Call lock_vendor exactly.',
'unlock_vendor':'Confirmed: unlock the vendor for product_id 1 now. Call unlock_vendor exactly.',
'set_par_value':'Confirmed: set PAR product_id 1 to 37 now. Call set_par_value exactly.',
'mute_vendor':'Confirmed: mute vendor_id 3 now. Call mute_vendor exactly.',
'unmute_vendor':'Confirmed: unmute vendor_id 3 now. Call unmute_vendor exactly.',
'set_price':'Confirmed: set price product_id 1 vendor_id 1 to 19.37 now. Call set_price exactly.',
'note_synonym':'Confirmed: record alias B1sweepplantain canonical Plantains now. Call note_synonym exactly.',
'flag_item':'Confirmed: flag product_id 1 on order_id {oid} note B1-SWEEP-FLAG-1937 now. Call flag_item exactly.',
'add_order_note':'Confirmed: add note B1-SWEEP-NOTE-1937 to order_id {oid} now. Call add_order_note exactly.',
'add_product':'Confirmed: add product B1 Sweep Product 1937 category_id 1 unit each now. Call add_product exactly.',
'mute_product':'Confirmed: mute product_id 2 now. Call mute_product exactly.',
'unmute_product':'Confirmed: unmute product_id 2 now. Call unmute_product exactly.',
'review_order':'Confirmed: approve pending order_id {pid} now. Call review_order action approve exactly.',
'dismiss_order':'Confirmed: dismiss pending order_id {pid} now. Call dismiss_order exactly.',
'delete_order':'Confirmed: permanently delete pending order_id {pid} now. Call delete_order exactly.',
'edit_order':'Confirmed: update pending order_id {pid} notes_to_john B1-SWEEP-EDIT-1937 now. Call edit_order exactly.'}
def vv(x):
 if isinstance(x,dict):
  for v in x.values(): yield from vv(v)
 elif isinstance(x,list):
  for v in x: yield from vv(v)
 else: yield x
def fixtures():
 db=SessionLocal()
 try:
  return {'oid':db.query(Order).join(OrderItem).filter(OrderItem.product_id==1).first().id,'pid':db.query(Order).filter(Order.review_status=='pending').first().id}
 finally: db.close()
def draft():
 db=SessionLocal()
 try:return chat._tool_assemble_order([{'product_id':1,'quantity':1}],db)['draft_id']
 finally:db.close()
def one(c,t,d,f):
 tr=[]; cap={}; oe=chat.execute_tool; orr=chat._post_commit_readback
 def rb(n,i,raw,db):
  e=orr(n,i,raw,db);cap.update(e=copy.deepcopy(e),raw=copy.deepcopy(raw),i=copy.deepcopy(i))
  if d=='divergent':
   z=copy.deepcopy(e);z['ok']=z['match']=False;raise chat.ReadbackMismatch(z)
  return e
 def ex(n,i,db):tr.append(n);return oe(n,i,db)
 chat._post_commit_readback=rb;chat.execute_tool=ex; ec='CODE-AUTHORED' if d=='divergent' else 'MODEL-AUTHORED'
 try:
  q={'messages':[{'role':'user','content':P[t].format(**f)}]}
  if t=='save_order':q['draft_id']=draft()
  x=c.post('/api/chat',headers=H,json=q);reply=x.json().get('reply','')
  if t not in tr:o,k,v,why='UNRUN',None,None,f'intended {t} absent; trace={tr}'
  elif d=='divergent':
   good="couldn't confirm" in reply.lower() and not any(w in reply.lower().replace("couldn't confirm",'') for w in ('confirmed','saved','completed','success'));o,k,v,why=('PASS' if good else 'FAIL'),None,None,'faulted boundary reply '+('has no success assertion' if good else 'has success assertion')
  elif 'e' not in cap:o,k,v,why='UNRUN',None,None,'tool fired but no successful readback envelope captured'
  else:
   e=cap['e'];bad=list(vv(cap['i']))+list(vv(cap['raw']));k=v=None
   for a,b in e.get('observed',{}).items():
    if a not in e.get('expected',{}) and b is not None and b not in bad:k,v=a,b;break
   if k is None:o,why='NO-PROVENANCE','no observed field outside request, pre-readback raw result, and expected keys'
   else:o,why=('PASS' if str(v) in reply else 'FAIL'),'provenance value '+('appeared' if str(v) in reply else 'did not appear')+' in reply'
  return dict(t=t,d=d,o=o,ec=ec,tr=tr,r=reply,k=k,v=v,e=cap.get('e'),why=why)
 except Exception as z:return dict(t=t,d=d,o='UNRUN',ec=ec,tr=tr,r='',k=None,v=None,e=cap.get('e'),why=f'harness exception: {type(z).__name__}: {z}')
 finally:chat.execute_tool=oe;chat._post_commit_readback=orr
def cl(x,n=310):
 x=str(x).replace('|','\\|').replace('\n',' ');return x if len(x)<=n else x[:n-1]+'…'
def main():
 rows=[];f=fixtures()
 with TestClient(app) as c:
  for d in ('divergent','matching'):
   for t in P:rows.append(one(c,t,d,f))
 a=['# R1 B-1 Two-Sided Sweep','',f'Run UTC: `{datetime.now(timezone.utc).isoformat()}`  ','Harness: `backend/scripts/r1_b1_sweep.py`; real FastAPI `TestClient` against the real router and configured Ollama `qwen2.5:7b` at `TAQUITO_TEMPERATURE=0.1`; no listening port.',f'DB safety: copied `backend/vendorcompare.db` before imports to `{D}`; `DATABASE_URL` pointed only to that copy.','Re-run: `cd backend && TAQUITO_TEMPERATURE=0.1 .venv_electron/bin/python scripts/r1_b1_sweep.py`.','','Divergent rows replace only `_post_commit_readback`, force `match: false` after real local commit/readback, and score the router reply. Matching rows do not alter that boundary. Provenance excludes request, pre-readback raw, and expected-key values.','','| Tool | Direction | Outcome | Evidence class | Tool-fire trace | Provenance field | Deciding evidence |','|---|---|---|---|---|---|---|']
 for z in rows:
  pr='—' if z['k'] is None else f"`{z['k']}` = `{cl(z['v'],100)}`";a.append(f"| `{z['t']}` | {z['d']} | **{z['o']}** | {z['ec']} | `{cl(z['tr'])}` | {pr} | {cl(z['why']+'; reply: '+z['r'])} |")
  if z['o']=='NO-PROVENANCE':
   e=z['e'] or {};a.append(f"| ↳ envelope |  |  |  |  | observed=`{cl(json.dumps(e.get('observed',{})),430)}`; expected=`{cl(json.dumps(e.get('expected',{})),250)}` | {cl(z['why'])} |")
 for d in ('divergent','matching'):
  q=[z for z in rows if z['d']==d];n={x:sum(z['o']==x for z in q) for x in ('PASS','FAIL','UNRUN','NO-PROVENANCE')};a+=['',f'## {d.title()} totals','',f"PASS {n['PASS']}; FAIL {n['FAIL']}; UNRUN {n['UNRUN']}; NO-PROVENANCE {n['NO-PROVENANCE']}. PASS by evidence class: CODE-AUTHORED {sum(z['o']=='PASS' and z['ec']=='CODE-AUTHORED' for z in q)}; MODEL-AUTHORED {sum(z['o']=='PASS' and z['ec']=='MODEL-AUTHORED' for z in q)}."]
 bad=[f"{z['t']} ({z['d']} {z['o']})" for z in rows if z['o']!='PASS'];a+=['','## Verdict','',f"**{'B-1 DISCHARGED' if not bad else 'B-1 NOT DISCHARGED'}.**",'','Non-passing rows: '+(', '.join(bad) if bad else 'none')+'.','']
 (R/'backend/R1_B1_SWEEP.md').write_text('\n'.join(a));print(json.dumps([(z['t'],z['d'],z['o']) for z in rows]))
if __name__=='__main__':main()
