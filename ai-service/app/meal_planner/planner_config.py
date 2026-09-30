"""NB54_POLICY_V1 AI-service-owned planner configuration."""
from dataclasses import dataclass
@dataclass(frozen=True)
class PlannerConfig:
 policy_version:str="NB54_POLICY_V1";meal_slots:tuple[str,...]=("BREAKFAST","LUNCH","DINNER");calorie_tolerance_ratio:float=.10;protein_tolerance_ratio:float=.20;carbs_tolerance_ratio:float=.20;fat_tolerance_ratio:float=.20;max_dish_repetition:int=1;weekly_max_dish_repetition:int=2;weekly_min_distinct_dishes:int|None=14;calorie_weight:int=1;protein_weight:int=1;carbs_weight:int=1;fat_weight:int=1;solver_time_limit_seconds:float=5.0
 def policy(self,target): return {"meal_slots":list(self.meal_slots),"calorie_tolerance":target["calories"]*self.calorie_tolerance_ratio,"protein_tolerance":target["protein_g"]*self.protein_tolerance_ratio,"carbs_tolerance":target["carbs_g"]*self.carbs_tolerance_ratio,"fat_tolerance":target["fat_g"]*self.fat_tolerance_ratio,"max_dish_repetition":self.max_dish_repetition,"calorie_weight":self.calorie_weight,"protein_weight":self.protein_weight,"carbs_weight":self.carbs_weight,"fat_weight":self.fat_weight}
 def weekly(self): return {"weekly_max_dish_repetition":self.weekly_max_dish_repetition,"weekly_min_distinct_dishes":self.weekly_min_distinct_dishes}
