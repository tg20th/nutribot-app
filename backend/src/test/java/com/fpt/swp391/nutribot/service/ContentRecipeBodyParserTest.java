package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.*;
import com.fpt.swp391.nutribot.repository.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContentRecipeBodyParserTest {
 @Test void readsNormalizedRowsInsteadOfBodyJson() {
  var details=mock(ContentRecipeDetailRepository.class); var ingredients=mock(ContentRecipeIngredientRepository.class); var steps=mock(ContentRecipeStepRepository.class);
  when(details.findById(7)).thenReturn(Optional.of(ContentRecipeDetail.builder().prepMinutes(10).cookMinutes(20).servings(2).calories(new BigDecimal("320")).proteinG(new BigDecimal("13.5")).build()));
  when(ingredients.findByContentIdOrderBySortOrderAsc(7)).thenReturn(List.of(ContentRecipeIngredient.builder().ingredientName("Đậu hũ").quantity("150").unit("g").build()));
  when(steps.findByContentIdOrderByStepNumberAsc(7)).thenReturn(List.of(ContentRecipeStep.builder().instruction("Áp chảo").build()));
  var result=new ContentRecipeBodyParser(details,ingredients,steps).parse(Content.builder().contentId(7).title("Góc bếp: Đậu hũ chay").body("Câu chuyện, không phải JSON").build());
  assertEquals("Đậu hũ chay",result.dish().name()); assertEquals(320,result.nutrition().calories()); assertEquals("Đậu hũ",result.ingredients().getFirst().name()); assertEquals("Áp chảo",result.recipe().steps().getFirst());
 }
 @Test void returnsNullWithoutRecipeRows() {
  var details=mock(ContentRecipeDetailRepository.class); var ingredients=mock(ContentRecipeIngredientRepository.class); var steps=mock(ContentRecipeStepRepository.class);
  when(details.findById(1)).thenReturn(Optional.empty()); when(ingredients.findByContentIdOrderBySortOrderAsc(1)).thenReturn(List.of()); when(steps.findByContentIdOrderByStepNumberAsc(1)).thenReturn(List.of());
  assertNull(new ContentRecipeBodyParser(details,ingredients,steps).parse(Content.builder().contentId(1).title("Bài viết").body("Plain text").build()));
 }
}
