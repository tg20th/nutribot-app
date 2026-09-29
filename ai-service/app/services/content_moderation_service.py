"""Hybrid NB-64 classifier. It has no DB writes or lifecycle side effects."""
from app.schemas.moderation import ModerationRequest, ModerationResponse, ModelModeration
POLICY_VERSION="1.0"; AUTO_APPROVE=.90; AUTO_REJECT=.90
class ContentModerationService:
 def __init__(self, gemini): self.gemini=gemini
 def _text(self,r): return " ".join(filter(None,[r.title,r.description,r.body,r.category," ".join(r.tags)])).casefold()
 def rules(self,r):
  """Only clear cases decide here; contextual mentions are deliberately deferred."""
  t=self._text(r)
  if len(t)<20:return ModelModeration(decision="NEEDS_REVIEW",reason="Insufficient text for reliable moderation",confidence=1,categories=["AMBIGUOUS"])
  if ("chữa khỏi ung thư" in t and "không có bằng chứng" not in t) or ("cure cancer" in t and "no evidence" not in t):return ModelModeration(decision="REJECT",reason="Unsafe medical cure claim",confidence=.99,categories=["MEDICAL_CLAIM","UNSAFE_NUTRITION_ADVICE"])
  if "crypto" in t or "free bitcoin" in t:return ModelModeration(decision="REJECT",reason="Off-topic promotional spam",confidence=.99,categories=["SPAM","OFF_TOPIC"])
  contextual=any(x in t for x in ("alternative","replace","avoid","thay thế","món chay"))
  explicit=any(x in t for x in ("how to make beef steak","how to cook beef steak","best grilled beef steak recipe","cách làm bò bít tết"))
  if explicit and not contextual:return ModelModeration(decision="REJECT",reason="Promotes non-vegetarian recipe",confidence=.95,categories=["NON_VEGETARIAN_CONTENT"])
  return None
 async def moderate(self,r):
  """Rule precheck then Gemini; every uncertainty becomes NEEDS_REVIEW."""
  rule=self.rules(r)
  if rule:return self._final(rule)
  try:
   result=await self.gemini.moderate_content(r)
   return self._final(ModelModeration.model_validate(result))
  except Exception:return ModerationResponse(decision="NEEDS_REVIEW",reason="Moderation model unavailable or invalid",confidence=0,categories=["AMBIGUOUS"],model=getattr(self.gemini,"model_name","unknown"),policy_version=POLICY_VERSION)
 def _final(self,m):
  allowed=m.decision=="APPROVE" and m.confidence>=AUTO_APPROVE or m.decision=="REJECT" and m.confidence>=AUTO_REJECT and any(c not in {"AMBIGUOUS"} for c in m.categories)
  return ModerationResponse(**m.model_dump(exclude={"decision"}),decision=m.decision if allowed else "NEEDS_REVIEW",model=getattr(self.gemini,"model_name","gemini"),policy_version=POLICY_VERSION)
