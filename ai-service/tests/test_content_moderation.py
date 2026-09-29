import asyncio
from app.schemas.moderation import ModerationRequest
from app.services.content_moderation_service import ContentModerationService
class FakeGemini:
 model_name="configured-test-model"
 def __init__(self,result=None,error=False): self.result=result; self.error=error
 async def moderate_content(self,_):
  if self.error: raise TimeoutError()
  return self.result
def request(title="5 vegetarian tofu protein meals",typ="BLOG",revision="1"): return ModerationRequest(content_id=1,revision=revision,content_type=typ,title=title,body="A detailed vegetarian nutrition post.")
def run(s,r=None): return asyncio.run(s.moderate(r or request()))
def test_approve_threshold_and_metadata():
 for score,decision in [(0.89,"NEEDS_REVIEW"),(0.90,"APPROVE"),(0.91,"APPROVE")]:
  x=run(ContentModerationService(FakeGemini({"decision":"APPROVE","reason":"safe","confidence":score,"categories":["SAFE"]}))); assert x.decision==decision and x.model=="configured-test-model" and x.policy_version=="1.0"
def test_rules_and_context_cases():
 assert run(ContentModerationService(FakeGemini()),request("How to make beef steak")).decision=="REJECT"
 assert run(ContentModerationService(FakeGemini({"decision":"APPROVE","reason":"context","confidence":.95,"categories":["SAFE"]})),request("Vegetarian alternatives to beef steak")).decision=="APPROVE"
 assert run(ContentModerationService(FakeGemini()),request("This food can cure cancer")).decision=="REJECT"
def test_failsafe_video_invalid_and_retry():
 assert run(ContentModerationService(FakeGemini(error=True))).decision=="NEEDS_REVIEW"
 assert run(ContentModerationService(FakeGemini({"bad":1})),request("tofu", "VIDEO")).decision=="NEEDS_REVIEW"
 s=ContentModerationService(FakeGemini({"decision":"APPROVE","reason":"safe","confidence":.1,"categories":["SAFE"]})); assert run(s,request(revision="1")).decision==run(s,request(revision="1")).decision=="NEEDS_REVIEW"
