"""NB54_POLICY_V1 AI-service-owned planner configuration."""
from dataclasses import dataclass
@dataclass(frozen=True)
class PlannerConfig:
 policy_version:str="NB54_POLICY_V1";meal_slots:tuple[str,...]=("BREAKFAST","LUNCH","DINNER");calorie_tolerance_ratio:float=.10;protein_tolerance_ratio:float=.20;carbs_tolerance_ratio:float=.20;fat_tolerance_ratio:float=.20;max_dish_repetition:int=1;weekly_max_dish_repetition:int=2;weekly_min_distinct_dishes:int|None=14;calorie_weight:int=1;protein_weight:int=1;carbs_weight:int=1;fat_weight:int=1;solver_time_limit_seconds:float=5.0
 def policy(self,target): return {"meal_slots":list(self.meal_slots),"calorie_tolerance":target["calories"]*self.calorie_tolerance_ratio,"protein_tolerance":target["protein_g"]*self.protein_tolerance_ratio,"carbs_tolerance":target["carbs_g"]*self.carbs_tolerance_ratio,"fat_tolerance":target["fat_g"]*self.fat_tolerance_ratio,"max_dish_repetition":self.max_dish_repetition,"calorie_weight":self.calorie_weight,"protein_weight":self.protein_weight,"carbs_weight":self.carbs_weight,"fat_weight":self.fat_weight}
 def weekly(self): return {"weekly_max_dish_repetition":self.weekly_max_dish_repetition,"weekly_min_distinct_dishes":self.weekly_min_distinct_dishes}
 def ladder(self):
  """Strict attempt first, then progressively relaxed nutrient/diversity windows.
  The 60-dish demo catalog cannot satisfy every nutrition target within +/-10/20%;
  relaxation keeps generation working instead of returning INFEASIBLE (HTTP 400)."""
  relaxed=PlannerConfig(policy_version=self.policy_version,calorie_tolerance_ratio=.15,protein_tolerance_ratio=.30,carbs_tolerance_ratio=.30,fat_tolerance_ratio=.30,weekly_min_distinct_dishes=10,weekly_max_dish_repetition=3,solver_time_limit_seconds=self.solver_time_limit_seconds)
  last=PlannerConfig(policy_version=self.policy_version,calorie_tolerance_ratio=.20,protein_tolerance_ratio=.40,carbs_tolerance_ratio=.40,fat_tolerance_ratio=.40,weekly_min_distinct_dishes=8,weekly_max_dish_repetition=4,solver_time_limit_seconds=self.solver_time_limit_seconds)
  return (self,relaxed,last)
