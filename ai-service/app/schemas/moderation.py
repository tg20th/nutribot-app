"""NB-64 stateless moderation contract."""
from typing import Literal
from pydantic import BaseModel, Field
Decision=Literal["APPROVE","REJECT","NEEDS_REVIEW"]
Category=Literal["SAFE","OFF_TOPIC","NON_VEGETARIAN_CONTENT","SPAM","HARASSMENT","SEXUAL_CONTENT","VIOLENCE","DANGEROUS_CONTENT","UNSAFE_NUTRITION_ADVICE","MEDICAL_CLAIM","SENSITIVE_IMAGE","NON_VEGETARIAN_IMAGE","OTHER_POLICY_VIOLATION","AMBIGUOUS"]
class ModerationRequest(BaseModel):
    content_id:int=Field(gt=0); revision:str|None=None; content_type:Literal["BLOG","VIDEO"]
    title:str=Field(min_length=1,max_length=255); description:str|None=None; body:str|None=None; category:str|None=None; tags:list[str]=Field(default_factory=list)
    thumbnail_url:str|None=None; media_url:str|None=None
class ModelModeration(BaseModel): decision:Decision; reason:str=Field(min_length=1,max_length=500); confidence:float=Field(ge=0,le=1); categories:list[Category]=Field(default_factory=list)
class ModerationResponse(ModelModeration): model:str; policy_version:str
