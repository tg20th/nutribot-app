from datetime import UTC, datetime, timedelta
from app.schemas.recommender import ContentCandidate, Interaction, RecommendationRequest
from app.services.recommender import ContentRecommender, HashingEmbedder, content_text, cosine

NOW=datetime(2026,9,29,tzinfo=UTC)
def content(id, type="BLOG", status="PUBLISHED", title="tofu protein", category="Protein", views=0, age=1, **extra): return ContentCandidate(content_id=id,content_type=type,status=status,title=title,category=category,view_count=views,published_at=NOW-timedelta(days=age),**extra)
def service(): return ContentRecommender(HashingEmbedder())
def test_embedding_text_and_cosine_are_deterministic():
    assert "BLOG" in content_text(content(1)); assert cosine([1,0],[1,0])==1; assert cosine([],[])==0
def test_user_vector_retrieves_related_content():
    result=service().recommend(RecommendationRequest(contents=[content(1),content(2,title="tofu muscle protein"),content(3,title="vegan dessert")],interactions=[Interaction(content_id=1,vote=1,max_scroll_pct=100)]),NOW); assert result.items[0].content_id==1
def test_unpublished_and_duplicate_ids_never_returned():
    result=service().recommend(RecommendationRequest(contents=[content(1),content(2,status="DRAFT")],limit=10),NOW); assert [x.content_id for x in result.items]==[1]
def test_cold_start_is_valid_and_deterministic():
    request=RecommendationRequest(contents=[content(2,views=4),content(1,views=9)]); assert service().recommend(request,NOW).items==service().recommend(request,NOW).items
def test_new_content_can_be_returned_without_interaction():
    assert service().recommend(RecommendationRequest(contents=[content(1,views=0,age=0)]),NOW).items[0].content_id==1
def test_blog_video_dwell_normalization_and_missing_optional_signals():
    result=service().recommend(RecommendationRequest(contents=[content(1,"BLOG"),content(2,"VIDEO")],interactions=[Interaction(content_id=1,active_dwell_seconds=30),Interaction(content_id=2,active_dwell_seconds=30)]),NOW); assert len(result.items)==2
def test_empty_input_is_safe(): assert service().recommend(RecommendationRequest(),NOW).items==[]
def ids(kind,*items): return [x.content_id for x in service().recommend(RecommendationRequest(contents=list(items),vegetarian_type=kind),NOW).items]
def test_dietary_types_and_hard_filter():
    assert ids("VEGAN",content(1,title="tofu",ingredients=["tofu"]),content(2,title="cheese",ingredients=["cheese"]))==[1]
    assert ids("LACTO",content(1,ingredients=["milk"]),content(2,ingredients=["egg"]))==[1]
    assert ids("OVO",content(1,ingredients=["egg"]),content(2,ingredients=["milk"]))==[1]
    assert set(ids("LACTO_OVO",content(1,ingredients=["egg"]),content(2,ingredients=["milk"])))=={1,2}
def test_animal_unknown_and_null_policy():
    for kind in ["VEGAN","LACTO","OVO","LACTO_OVO"]: assert ids(kind,content(1,ingredients=["fish"]),content(2,ingredients=["lentil"]))==[2]
    assert ids(None,content(1,title="cheese"))==[1]
