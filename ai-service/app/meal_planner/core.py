"""DB-independent deterministic Meal Planner V1."""
from dataclasses import dataclass
from ortools.sat.python import cp_model

DAYS=("MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY")
COMPAT={"VEGAN":{"VEGAN"},"LACTO":{"VEGAN","LACTO"},"OVO":{"VEGAN","OVO"},"LACTO_OVO":{"VEGAN","LACTO","OVO","LACTO_OVO"}}
@dataclass(frozen=True)
class Dish:
 dish_id:int; name:str; calories:float; protein_g:float; carbs_g:float; fat_g:float; vegetarian_type:str; is_active:bool; ingredient_ids:tuple[int,...]
def eligible(d):
 return isinstance(d.dish_id,int) and d.dish_id>0 and bool(d.name and d.name.strip()) and d.is_active is True and d.vegetarian_type in COMPAT and all(isinstance(i,int) and i>0 for i in d.ingredient_ids) and len(d.ingredient_ids)>0 and len(set(d.ingredient_ids))==len(d.ingredient_ids) and all(v is not None and v>=0 for v in (d.calories,d.protein_g,d.carbs_g,d.fat_g))
def validate_plan(result,safe,target,policy,weekly,vegetarian,allergies):
 if result.get("status") not in ("OPTIMAL","FEASIBLE"):return False,("INVALID_RESULT_STATUS",)
 days=result.get("days",[])
 if len(days)!=7 or tuple(d.get("day") for d in days)!=DAYS:return False,("INVALID_DAY_STRUCTURE",)
 ids={d.dish_id:d for d in safe};usage={}
 for day in days:
  meals=day.get("meals",[])
  if tuple(m.get("slot") for m in meals)!=tuple(policy["meal_slots"]) or len({m.get("slot") for m in meals})!=len(meals):return False,("INVALID_DAY_SLOTS",)
  totals={"calories":0,"proteinG":0,"carbsG":0,"fatG":0}
  daily_usage={}
  for meal in meals:
   d=ids.get(meal.get("dishId"))
   if d is None:return False,("UNKNOWN_DISH_ID",)
   if not eligible(d) or d.vegetarian_type not in COMPAT[vegetarian] or set(d.ingredient_ids)&set(allergies):return False,("SAFETY_VALIDATION_FAILED",)
   usage[d.dish_id]=usage.get(d.dish_id,0)+1;daily_usage[d.dish_id]=daily_usage.get(d.dish_id,0)+1;totals["calories"]+=d.calories;totals["proteinG"]+=d.protein_g;totals["carbsG"]+=d.carbs_g;totals["fatG"]+=d.fat_g
  if day.get("nutritionTotal")!=totals:return False,("NUTRITION_TOTAL_MISMATCH",)
  if any(v>policy["max_dish_repetition"] for v in daily_usage.values()):return False,("DAILY_REPETITION_EXCEEDED",)
  for out,key,tol in (("calories","calories","calorie_tolerance"),("proteinG","protein_g","protein_tolerance"),("carbsG","carbs_g","carbs_tolerance"),("fatG","fat_g","fat_tolerance")):
   if abs(totals[out]-target[key])>policy[tol]:return False,("NUTRITION_TOLERANCE_FAILED",)
 if any(v>weekly["weekly_max_dish_repetition"] for v in usage.values()):return False,("WEEKLY_REPETITION_EXCEEDED",)
 if weekly.get("weekly_min_distinct_dishes") and len(usage)<weekly["weekly_min_distinct_dishes"]:return False,("INSUFFICIENT_DIVERSITY",)
 if result.get("weeklySummary",{}).get("dishUsageCounts")!={str(k):v for k,v in usage.items()}:return False,("USAGE_COUNT_MISMATCH",)
 return True,()
def _day_triples(safe,target,policy):
 # Enumerate every 3-dish combination that satisfies the per-day nutrient windows;
 # an empty list proves day-level infeasibility without running the solver.
 keys=("calories","protein_g","carbs_g","fat_g");pfx=("calorie","protein","carbs","fat")
 wins=[(target[k]-policy[p+"_tolerance"],target[k]+policy[p+"_tolerance"]) for k,p in zip(keys,pfx)]
 n=len(safe);out=[]
 for i in range(n):
  a=safe[i]
  for j in range(i+1,n):
   b=safe[j]
   for k in range(j+1,n):
    c=safe[k];tot=(a.calories+b.calories+c.calories,a.protein_g+b.protein_g+c.protein_g,a.carbs_g+b.carbs_g+c.carbs_g,a.fat_g+b.fat_g+c.fat_g)
    if all(lo<=v<=hi for v,(lo,hi) in zip(tot,wins)):
     dev=sum(abs(tot[m]-target[kk])/(policy[pfx[m]+"_tolerance"] or 1e-9) for m,kk in enumerate(keys))
     out.append((i,j,k,dev))
 return sorted(out,key=lambda t:t[3])
def _greedy_hint(triples,n_safe,weekly,days=7):
 # Deterministic day-by-day selection with cap/diversity lookahead; returns one
 # triple (dish indices) per day or None when lookahead finds no admissible move.
 caps=weekly["weekly_max_dish_repetition"];md=weekly.get("weekly_min_distinct_dishes");cnt=[0]*n_safe;chosen=[]
 for day in range(days):
  rem=days-day-1;best=None
  for t in range(len(triples)):
   i,j,k,dev=triples[t]
   if cnt[i]>=caps or cnt[j]>=caps or cnt[k]>=caps:continue
   if sum(caps-x for x in cnt)-3<3*rem:continue
   new=(cnt[i]==0)+(cnt[j]==0)+(cnt[k]==0)
   if md is not None and sum(1 for x in cnt if x>0)+new+3*rem<md:continue
   cand=(dev,-new,t)
   if best is None or cand<best:best=cand
  if best is None:return None
  i,j,k,_=triples[best[2]]
  for c in (i,j,k):cnt[c]+=1
  chosen.append((i,j,k))
 return chosen
def generate(dishes,target,policy,weekly,vegetarian_type,allergies,time_limit):
 if vegetarian_type not in COMPAT:return {"status":"INVALID_INPUT","reasonCodes":["USER_VEGETARIAN_TYPE_INVALID"]}
 if allergies is None:return {"status":"INVALID_INPUT","reasonCodes":["ALLERGY_CONTEXT_MISSING"]}
 if time_limit<=0:return {"status":"INVALID_INPUT","reasonCodes":["SOLVER_TIME_LIMIT_MISSING_OR_INVALID"]}
 if any(k not in target for k in ("calories","protein_g","carbs_g","fat_g")):return {"status":"INVALID_INPUT","reasonCodes":["NUTRITION_TARGET_MISSING_OR_INVALID"]}
 slots=policy.get("meal_slots")
 if not slots or len(set(slots))!=len(slots):return {"status":"INVALID_INPUT","reasonCodes":["INVALID_MEAL_SLOTS"]}
 safe=sorted([d for d in dishes if eligible(d) and d.vegetarian_type in COMPAT[vegetarian_type] and not set(d.ingredient_ids)&set(allergies)],key=lambda d:d.dish_id)
 if not safe:return {"status":"INFEASIBLE","reasonCodes":["NO_SAFE_CANDIDATES"]}
 for k in ("calorie_tolerance","protein_tolerance","carbs_tolerance","fat_tolerance","calorie_weight","protein_weight","carbs_weight","fat_weight"):
  if k not in policy:return {"status":"INVALID_INPUT","reasonCodes":["PLANNING_POLICY_INCOMPLETE"]}
 triples=_day_triples(safe,target,policy)
 if not triples:
  meta={"candidateCountBeforeSafety":len(dishes),"safeCandidateCount":len(safe),"candidateCountAfterGuardrail":len(safe),"solverStatus":"NO_FEASIBLE_DAY","solverWallTime":0.0,"terminationReason":"DAY_WINDOW_INFEASIBLE","plannerVersion":"v1","contractVersion":"v2"}
  return {"status":"INFEASIBLE","reasonCodes":["NO_SAFE_WEEKLY_FEASIBLE_SOLUTION"],"executionMetadata":meta}
 m=cp_model.CpModel();x={(a,b,c):m.NewBoolVar(f"x{a}{b}{c}") for a in range(7) for b in range(len(slots)) for c in range(len(safe))}
 for a in range(7):
  for b in range(len(slots)):m.AddExactlyOne(x[a,b,c] for c in range(len(safe)))
 for c in range(len(safe)):m.Add(sum(x[a,b,c] for a in range(7) for b in range(len(slots)))<=weekly["weekly_max_dish_repetition"])
 for a in range(7):
  for c in range(len(safe)):m.Add(sum(x[a,b,c] for b in range(len(slots)))<=policy["max_dish_repetition"])
 if weekly.get("weekly_min_distinct_dishes") is not None:
  if weekly["weekly_min_distinct_dishes"]>len(safe):return {"status":"INFEASIBLE","reasonCodes":["INSUFFICIENT_DIVERSITY"]}
  used=[m.NewBoolVar(f"u{c}") for c in range(len(safe))]
  for c in range(len(safe)):
   count=sum(x[a,b,c] for a in range(7) for b in range(len(slots)));m.Add(count>=used[c]);m.Add(count<=7*len(slots)*used[c])
  m.Add(sum(used)>=weekly["weekly_min_distinct_dishes"])
 vals={"calories":[round(d.calories*100) for d in safe],"protein_g":[round(d.protein_g*100) for d in safe],"carbs_g":[round(d.carbs_g*100) for d in safe],"fat_g":[round(d.fat_g*100) for d in safe]}
 obj=[];vvars=[]
 for a in range(7):
  for midx,(k,tol,w) in enumerate((("calories","calorie_tolerance","calorie_weight"),("protein_g","protein_tolerance","protein_weight"),("carbs_g","carbs_tolerance","carbs_weight"),("fat_g","fat_tolerance","fat_weight"))):
   if tol not in policy or w not in policy:return {"status":"INVALID_INPUT","reasonCodes":["PLANNING_POLICY_INCOMPLETE"]}
   total=sum(vals[k][c]*x[a,b,c] for b in range(len(slots)) for c in range(len(safe)));t=round(target[k]*100);z=round(policy[tol]*100);m.Add(total>=t-z);m.Add(total<=t+z);v=m.NewIntVar(0,sum(vals[k])*len(slots),f"d{a}{k}");m.Add(total-t<=v);m.Add(t-total<=v);obj.append(policy[w]*v);vvars.append((a,midx,v))
 objective=sum(obj)+sum((c+1)*x[a,b,c] for a in range(7) for b in range(len(slots)) for c in range(len(safe)))
 # Seed a complete solution hint from the greedy construction: with every variable
 # hinted (x, used, deviation) the solver validates it up front instead of searching.
 hint=_greedy_hint(triples,len(safe),weekly)
 if hint:
  for a in range(7):
   sel=set(hint[a])
   for b in range(len(slots)):
    for c in range(len(safe)):m.AddHint(x[a,b,c],1 if c in sel else 0)
  if weekly.get("weekly_min_distinct_dishes") is not None:
   for c in range(len(safe)):m.AddHint(used[c],1 if any(c in day for day in hint) else 0)
  nkeys=("calories","protein_g","carbs_g","fat_g")
  for a,midx,v in vvars:
   total=sum(vals[nkeys[midx]][c] for c in hint[a]);m.AddHint(v,abs(total-round(target[nkeys[midx]]*100)))
 s=cp_model.CpSolver();s.parameters.num_search_workers=1;s.parameters.random_seed=0
 # Phase 1: feasibility without the objective. With Minimize() the single-threaded solver
 # finds no incumbent inside the budget (every request ended in TIME_LIMIT_REACHED).
 # Greedy-hinted requests settle instantly; unhinted ones get a wider proof budget.
 s.parameters.max_time_in_seconds=(min(2.0,time_limit) if hint else min(4.0,time_limit));feas_state=s.Solve(m)
 if feas_state not in (cp_model.OPTIMAL,cp_model.FEASIBLE):
  meta={"candidateCountBeforeSafety":len(dishes),"safeCandidateCount":len(safe),"candidateCountAfterGuardrail":len(safe),"solverStatus":s.StatusName(feas_state),"solverWallTime":s.WallTime(),"terminationReason":"TIME_LIMIT" if feas_state==cp_model.UNKNOWN else s.StatusName(feas_state),"greedyHintUsed":bool(hint),"plannerVersion":"v1","contractVersion":"v2"}
  if feas_state==cp_model.UNKNOWN:return {"status":"TIME_LIMIT_REACHED","reasonCodes":["SOLVER_TIME_LIMIT"],"executionMetadata":meta}
  return {"status":"INFEASIBLE","reasonCodes":["NO_SAFE_WEEKLY_FEASIBLE_SOLUTION"],"executionMetadata":meta}
 phase1={(a,b,c):s.Value(v) for (a,b,c),v in x.items() if s.Value(v)};phase1_wall=s.WallTime()
 # Phase 2: seed the phase-1 incumbent as a hint, then improve deviation within a short cap
 # (AddAbsEquality broke presolve in ortools 9.15; abs via two inequalities keeps the solver alive).
 for (a,b,c),value in phase1.items():m.AddHint(x[a,b,c],value)
 m.Minimize(objective)
 s.parameters.max_time_in_seconds=max(0.1,min(2.0,time_limit-phase1_wall));state=s.Solve(m)
 if state not in (cp_model.OPTIMAL,cp_model.FEASIBLE):
  state=cp_model.FEASIBLE;selected=phase1
 else:
  selected={(a,b,c):s.Value(v) for (a,b,c),v in x.items() if s.Value(v)}
 meta={"candidateCountBeforeSafety":len(dishes),"safeCandidateCount":len(safe),"candidateCountAfterGuardrail":len(safe),"solverStatus":s.StatusName(state),"solverWallTime":phase1_wall+s.WallTime(),"terminationReason":s.StatusName(state),"greedyHintUsed":bool(hint),"plannerVersion":"v1","contractVersion":"v2"}
 days=[];usage={}
 for a,day in enumerate(DAYS):
  meals=[];total={"calories":0,"proteinG":0,"carbsG":0,"fatG":0}
  for b,slot in enumerate(slots):
   c=next(c for c in range(len(safe)) if selected.get((a,b,c)));d=safe[c];meals.append({"slot":slot,"dishId":d.dish_id});usage[d.dish_id]=usage.get(d.dish_id,0)+1
   total["calories"]+=d.calories;total["proteinG"]+=d.protein_g;total["carbsG"]+=d.carbs_g;total["fatG"]+=d.fat_g
  days.append({"day":day,"meals":meals,"nutritionTotal":total,"deviation":{"calories":total["calories"]-target["calories"],"proteinG":total["proteinG"]-target["protein_g"],"carbsG":total["carbsG"]-target["carbs_g"],"fatG":total["fatG"]-target["fat_g"]}})
 result={"status":"OPTIMAL" if state==cp_model.OPTIMAL else "FEASIBLE","days":days,"weeklySummary":{"distinctDishCount":len(usage),"dishUsageCounts":{str(k):v for k,v in usage.items()}},"reasonCodes":[],"executionMetadata":meta}
 valid,reasons=validate_plan(result,safe,target,policy,weekly,vegetarian_type,allergies)
 return result if valid else {"status":"VALIDATION_FAILED","reasonCodes":list(reasons),"executionMetadata":meta}
