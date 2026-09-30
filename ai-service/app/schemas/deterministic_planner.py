from pydantic import BaseModel, ConfigDict, Field
def camel(v):
 h,*t=v.split("_");return h+"".join(x.title() for x in t)
class Base(BaseModel):
 model_config=ConfigDict(alias_generator=camel,populate_by_name=True,extra="forbid")
class Ingredient(Base): ingredient_id:int=Field(gt=0);name:str
class Dish(Base):
 dish_id:int=Field(gt=0);name:str;description:str|None=None;image_url:str|None=None;category_id:int|None=None;serving_size:float=Field(gt=0);serving_unit:str;calories:float=Field(ge=0);protein_g:float=Field(ge=0);carbs_g:float=Field(ge=0);healthy_fats_g:float=Field(ge=0);vegetarian_type:str;is_active:bool;ingredients:list[Ingredient]=Field(min_length=1)
class Target(Base): calories:float=Field(ge=0);protein_g:float=Field(ge=0);carbs_g:float=Field(ge=0);fat_g:float=Field(ge=0);estimated:bool
class DeterministicPlannerRequest(Base):
 vegetarian_type:str=Field(min_length=1);allergy_ingredient_ids:list[int]|None=None;nutrition_target:Target;canonical_dishes:list[Dish]
