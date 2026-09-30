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
def generate(dishes,target,policy,weekly,vegetarian_type,allergies,time_limit):
 if vegetarian_type not in COMPAT:return {"status":"INVALID_INPUT","reasonCodes":["USER_VEGETARIAN_TYPE_INVALID"]}
 if allergies is None:return {"status":"INVALID_INPUT","reasonCodes":["ALLERGY_CONTEXT_MISSING"]}
 if time_limit<=0:return {"status":"INVALID_INPUT","reasonCodes":["SOLVER_TIME_LIMIT_MISSING_OR_INVALID"]}
 if any(k not in target for k in ("calories","protein_g","carbs_g","fat_g")):return {"status":"INVALID_INPUT","reasonCodes":["NUTRITION_TARGET_MISSING_OR_INVALID"]}
 slots=policy.get("meal_slots")
 if not slots or len(set(slots))!=len(slots):return {"status":"INVALID_INPUT","reasonCodes":["INVALID_MEAL_SLOTS"]}
 safe=sorted([d for d in dishes if eligible(d) and d.vegetarian_type in COMPAT[vegetarian_type] and not set(d.ingredient_ids)&set(allergies)],key=lambda d:d.dish_id)
 if not safe:return {"status":"INFEASIBLE","reasonCodes":["NO_SAFE_CANDIDATES"]}
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
 obj=[]
 for a in range(7):
  for k,tol,w in (("calories","calorie_tolerance","calorie_weight"),("protein_g","protein_tolerance","protein_weight"),("carbs_g","carbs_tolerance","carbs_weight"),("fat_g","fat_tolerance","fat_weight")):
   if tol not in policy or w not in policy:return {"status":"INVALID_INPUT","reasonCodes":["PLANNING_POLICY_INCOMPLETE"]}
   total=sum(vals[k][c]*x[a,b,c] for b in range(len(slots)) for c in range(len(safe)));t=round(target[k]*100);z=round(policy[tol]*100);m.Add(total>=t-z);m.Add(total<=t+z);v=m.NewIntVar(0,sum(vals[k])*len(slots),f"d{a}{k}");m.AddAbsEquality(v,total-t);obj.append(policy[w]*v)
 m.Minimize(sum(obj)+sum((c+1)*x[a,b,c] for a in range(7) for b in range(len(slots)) for c in range(len(safe))))
 s=cp_model.CpSolver();s.parameters.num_search_workers=1;s.parameters.random_seed=0;s.parameters.max_time_in_seconds=time_limit;state=s.Solve(m)
 meta={"candidateCountBeforeSafety":len(dishes),"safeCandidateCount":len(safe),"candidateCountAfterGuardrail":len(safe),"solverStatus":s.StatusName(state),"solverWallTime":s.WallTime(),"terminationReason":"TIME_LIMIT" if state==cp_model.UNKNOWN else s.StatusName(state),"plannerVersion":"v1","contractVersion":"v2"}
 if state==cp_model.UNKNOWN:return {"status":"TIME_LIMIT_REACHED","reasonCodes":["SOLVER_TIME_LIMIT"],"executionMetadata":meta}
 if state not in (cp_model.OPTIMAL,cp_model.FEASIBLE):return {"status":"INFEASIBLE","reasonCodes":["NO_SAFE_WEEKLY_FEASIBLE_SOLUTION"],"executionMetadata":meta}
 days=[];usage={}
 for a,day in enumerate(DAYS):
  meals=[];total={"calories":0,"proteinG":0,"carbsG":0,"fatG":0}
  for b,slot in enumerate(slots):
   c=next(c for c in range(len(safe)) if s.Value(x[a,b,c]));d=safe[c];meals.append({"slot":slot,"dishId":d.dish_id});usage[d.dish_id]=usage.get(d.dish_id,0)+1
   total["calories"]+=d.calories;total["proteinG"]+=d.protein_g;total["carbsG"]+=d.carbs_g;total["fatG"]+=d.fat_g
  days.append({"day":day,"meals":meals,"nutritionTotal":total,"deviation":{"calories":total["calories"]-target["calories"],"proteinG":total["proteinG"]-target["protein_g"],"carbsG":total["carbsG"]-target["carbs_g"],"fatG":total["fatG"]-target["fat_g"]}})
 result={"status":"OPTIMAL" if state==cp_model.OPTIMAL else "FEASIBLE","days":days,"weeklySummary":{"distinctDishCount":len(usage),"dishUsageCounts":{str(k):v for k,v in usage.items()}},"reasonCodes":[],"executionMetadata":meta}
 valid,reasons=validate_plan(result,safe,target,policy,weekly,vegetarian_type,allergies)
 return result if valid else {"status":"VALIDATION_FAILED","reasonCodes":list(reasons),"executionMetadata":meta}
