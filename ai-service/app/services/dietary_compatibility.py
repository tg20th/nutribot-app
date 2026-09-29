"""Dietary hard constraints; canonical metadata wins over conservative text fallback."""
from enum import Enum
from app.schemas.recommender import ContentCandidate
class Compatibility(str, Enum): COMPATIBLE="COMPATIBLE"; INCOMPATIBLE="INCOMPATIBLE"; UNKNOWN="UNKNOWN"
ANIMAL={"meat","beef","pork","chicken","poultry","fish","seafood","shrimp","gelatin","thịt","bò","heo","gà","cá","tôm"}; EGG={"egg","trứng"}; DAIRY={"milk","dairy","cheese","butter","yogurt","whey","casein","sữa","phô mai","bơ"}
def evaluate_dietary_compatibility(content: ContentCandidate, vegetarian_type: str | None) -> Compatibility:
    """Return policy result. UNKNOWN is deliberately not treated as safe when preference exists."""
    if vegetarian_type is None: return Compatibility.COMPATIBLE
    values=[*content.dietary_tags,*content.ingredients]; structured=bool(values)
    text=" ".join(values if structured else [content.title,content.description or "",content.body or "",*content.tags,content.category or ""]).casefold()
    has=lambda terms:any(term in text for term in terms)
    if has(ANIMAL) or vegetarian_type=="VEGAN" and has(EGG|DAIRY) or vegetarian_type=="LACTO" and has(EGG) or vegetarian_type=="OVO" and has(DAIRY): return Compatibility.INCOMPATIBLE
    return Compatibility.COMPATIBLE if structured else Compatibility.UNKNOWN
