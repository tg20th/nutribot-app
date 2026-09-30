from app.meal_planner.core import Dish,generate
from app.meal_planner.planner_config import PlannerConfig
class MealPlannerService:
 def __init__(self,config=None): self.config=config or PlannerConfig()
 def generate_weekly_plan(self,request):
  dishes=[Dish(d.dish_id,d.name,d.calories,d.protein_g,d.carbs_g,d.healthy_fats_g,d.vegetarian_type,d.is_active,tuple(dict.fromkeys(i.ingredient_id for i in d.ingredients))) for d in request.canonical_dishes]
  target=request.nutrition_target.model_dump()
  return generate(dishes,target,self.config.policy(target),self.config.weekly(),request.vegetarian_type,request.allergy_ingredient_ids,self.config.solver_time_limit_seconds)
