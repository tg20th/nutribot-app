from app.meal_planner.core import Dish,generate
from app.meal_planner.planner_config import PlannerConfig
class MealPlannerService:
 def __init__(self,config=None): self.config=config or PlannerConfig()
 def generate_weekly_plan(self,request):
  dishes=[Dish(d.dish_id,d.name,d.calories,d.protein_g,d.carbs_g,d.healthy_fats_g,d.vegetarian_type,d.is_active,tuple(dict.fromkeys(i.ingredient_id for i in d.ingredients))) for d in request.canonical_dishes]
  target=request.nutrition_target.model_dump()
  last=None
  for attempt,cfg in enumerate(self.config.ladder()):
   result=generate(dishes,target,cfg.policy(target),cfg.weekly(),request.vegetarian_type,request.allergy_ingredient_ids,cfg.solver_time_limit_seconds)
   if result.get("status")=="INVALID_INPUT":return result
   if result.get("status") in ("OPTIMAL","FEASIBLE"):
    if attempt: result.setdefault("executionMetadata",{})["policyRelaxed"]=True
    return result
   last=result
  return last
