package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử ContentRecipeSuggestionService (NB-60)")
class ContentRecipeSuggestionServiceTest {

    private static final int MIN_VIEWS = 500;
    private static final int MIN_VOTES = 50;

    @Mock
    private ContentRepository contentRepository;

    @Mock
    private VoteRepository voteRepository;

    @Mock
    private ContentRecipeSuggestionRepository suggestionRepository;

    @Mock
    private DishRepository dishRepository;

    @Mock
    private RecipeExtractionGatewayService extractionGateway;

    private ContentRecipeSuggestionService service;

    @BeforeEach
    void setUp() {
        service = new ContentRecipeSuggestionService(
                contentRepository,
                voteRepository,
                suggestionRepository,
                dishRepository,
                new ContentRecipeBodyParser(new ObjectMapper()),
                extractionGateway,
                new ObjectMapper(),
                true,
                MIN_VIEWS,
                MIN_VOTES);
    }

    private Content publishedContent(Integer id, String type, int views) {
        return Content.builder()
                .contentId(id)
                .contentType(type)
                .title("Bún gạo lứt rau củ")
                .body("Nguyên liệu và cách làm...")
                .status("published")
                .viewCount(views)
                .build();
    }

    private RecipeExtractionGatewayService.RecipeExtractionResult coreExtraction() {
        return new RecipeExtractionGatewayService.RecipeExtractionResult(
                new RecipeExtractionGatewayService.DishProposal("Bún gạo lứt rau củ", "nhẹ bụng", BigDecimal.ONE, "bowl"),
                new RecipeExtractionGatewayService.NutritionProposal(418, new BigDecimal("15.8"), new BigDecimal("64.2"), new BigDecimal("11.6"), new BigDecimal("9.4")),
                List.of(new RecipeExtractionGatewayService.IngredientProposal("Bún gạo lứt", new BigDecimal("90"), "g", null)),
                new RecipeExtractionGatewayService.RecipeProposal("Bún gạo lứt rau củ", "công thức", 12, 10, 1, List.of("Ngâm bún", "Áp chảo")));
    }

    @Test
    @DisplayName("Tạo suggestion PENDING khi đủ view, đủ vote và trích xuất được công thức")
    void evaluateContent_createsSuggestionWhenEligible() {
        Content content = publishedContent(82, "BLOG", MIN_VIEWS);
        when(voteRepository.countByContentId(82)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(82), anyCollection())).thenReturn(false);
        when(extractionGateway.extractRecipe(content)).thenReturn(coreExtraction());

        boolean created = service.evaluateContent(content);

        assertTrue(created);
        ArgumentCaptor<ContentRecipeSuggestion> captor = ArgumentCaptor.forClass(ContentRecipeSuggestion.class);
        verify(suggestionRepository).save(captor.capture());
        ContentRecipeSuggestion saved = captor.getValue();
        assertEquals("PENDING", saved.getStatus());
        assertEquals("Bún gạo lứt rau củ", saved.getDishName());
        assertEquals(MIN_VIEWS, saved.getSourceViewCount());
        assertEquals(MIN_VOTES, saved.getSourceVoteCount());
        assertEquals(418, saved.getCalories());
        assertNotNull(saved.getIngredientsJson());
        assertNotNull(saved.getRecipeStepsJson());
    }

    @Test
    @DisplayName("Không tạo khi view dưới ngưỡng")
    void evaluateContent_skipsWhenBelowMinViews() {
        Content content = publishedContent(83, "BLOG", MIN_VIEWS - 1);

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verifyNoInteractions(voteRepository, extractionGateway);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không tạo khi nội dung chưa published")
    void evaluateContent_skipsWhenNotPublished() {
        Content content = publishedContent(84, "BLOG", MIN_VIEWS);
        content.setStatus("under_review");

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không tạo khi vote dưới ngưỡng")
    void evaluateContent_skipsWhenBelowMinVotes() {
        Content content = publishedContent(85, "VIDEO", MIN_VIEWS);
        when(voteRepository.countByContentId(85)).thenReturn((long) (MIN_VOTES - 1));

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verifyNoInteractions(extractionGateway);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không tạo trùng khi đã có suggestion PENDING/APPROVED")
    void evaluateContent_skipsWhenActiveSuggestionExists() {
        Content content = publishedContent(86, "BLOG", MIN_VIEWS);
        when(voteRepository.countByContentId(86)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(86), anyCollection())).thenReturn(true);

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verifyNoInteractions(extractionGateway);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không tạo khi món ăn đã tồn tại trong hệ thống")
    void evaluateContent_skipsWhenDishAlreadyExists() {
        Content content = publishedContent(89, "BLOG", MIN_VIEWS);
        when(voteRepository.countByContentId(89)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(89), anyCollection())).thenReturn(false);
        when(extractionGateway.extractRecipe(content)).thenReturn(coreExtraction());
        when(dishRepository.findByNameIgnoreCase("Bún gạo lứt rau củ"))
                .thenReturn(Optional.of(Dish.builder().dishId(7).name("Bún gạo lứt rau củ").build()));

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không tạo khi AI không trích xuất được công thức")
    void evaluateContent_skipsWhenExtractionHasNoCoreInfo() {
        Content content = publishedContent(87, "BLOG", MIN_VIEWS);
        when(voteRepository.countByContentId(87)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(87), anyCollection())).thenReturn(false);
        when(extractionGateway.extractRecipe(content)).thenReturn(null);

        boolean created = service.evaluateContent(content);

        assertFalse(created);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Bỏ qua hoàn toàn khi tính năng bị tắt")
    void evaluateContent_skipsWhenDisabled() {
        ContentRecipeSuggestionService disabled = new ContentRecipeSuggestionService(
                contentRepository, voteRepository, suggestionRepository, dishRepository,
                new ContentRecipeBodyParser(new ObjectMapper()), extractionGateway,
                new ObjectMapper(), false, MIN_VIEWS, MIN_VOTES);

        boolean created = disabled.evaluateContent(publishedContent(88, "BLOG", MIN_VIEWS));

        assertFalse(created);
        verifyNoInteractions(voteRepository, extractionGateway);
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Sweep chỉ xét nội dung published đủ ngưỡng view và đếm số suggestion tạo mới")
    void evaluateEligibleContents_countsCreated() {
        Content first = publishedContent(90, "BLOG", MIN_VIEWS);
        Content second = publishedContent(91, "VIDEO", MIN_VIEWS);
        when(contentRepository.findByStatusAndViewCountGreaterThanEqual("published", MIN_VIEWS))
                .thenReturn(List.of(first, second));
        when(voteRepository.countByContentId(90)).thenReturn((long) MIN_VOTES);
        when(voteRepository.countByContentId(91)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(any(), anyCollection())).thenReturn(false);
        when(extractionGateway.extractRecipe(any(Content.class))).thenReturn(coreExtraction());

        int created = service.evaluateEligibleContents();

        assertEquals(2, created);
        verify(suggestionRepository, times(2)).save(any(ContentRecipeSuggestion.class));
    }

    @Test
    @DisplayName("Tạo suggestion từ body JSON mà KHÔNG gọi AI (hướng lai)")
    void evaluateContent_createsSuggestionFromBodyWithoutAi() {
        String body = "{\"version\":1,\"story\":\"câu chuyện món ăn\",\"prepMinutes\":20,\"cookMinutes\":15,\"servings\":2,"
                + "\"nutrition\":{\"calories\":320,\"proteinG\":13.5,\"carbsG\":38.0,\"fatG\":12.4,\"fiberG\":5.2,\"sodiumMg\":410},"
                + "\"ingredients\":[{\"name\":\"Bột gạo\",\"quantity\":\"200\",\"unit\":\"g\",\"isCustom\":false},"
                + "{\"customName\":\"Gia vị nhà làm\",\"quantity\":\"1\",\"unit\":\"muỗng\",\"isCustom\":true}],"
                + "\"steps\":[\"Trộn bột\",\"Chiên vàng\"]}";
        Content content = Content.builder()
                .contentId(100)
                .contentType("BLOG")
                .title("Chia sẻ cách làm Bánh xèo chay giòn rụm")
                .body(body)
                .status("published")
                .viewCount(MIN_VIEWS)
                .build();
        when(voteRepository.countByContentId(100)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(100), anyCollection())).thenReturn(false);
        when(dishRepository.findByNameIgnoreCase("Bánh xèo chay giòn rụm")).thenReturn(Optional.empty());

        boolean created = service.evaluateContent(content);

        assertTrue(created);
        verifyNoInteractions(extractionGateway);
        ArgumentCaptor<ContentRecipeSuggestion> captor = ArgumentCaptor.forClass(ContentRecipeSuggestion.class);
        verify(suggestionRepository).save(captor.capture());
        ContentRecipeSuggestion saved = captor.getValue();
        assertEquals("Bánh xèo chay giòn rụm", saved.getDishName());
        assertEquals(320, saved.getCalories());
        assertEquals(0, new BigDecimal("13.5").compareTo(saved.getProteinG()));
        assertTrue(saved.getIngredientsJson().contains("Gia vị nhà làm"));
        assertTrue(saved.getIngredientsJson().contains("Bột gạo"));
        assertNotNull(saved.getRecipeStepsJson());
        assertEquals(MIN_VOTES, saved.getSourceVoteCount());
    }

    @Test
    @DisplayName("Fallback sang AI khi body không phải JSON hợp lệ")
    void evaluateContent_fallsBackToAiWhenBodyNotJson() {
        Content content = publishedContent(101, "BLOG", MIN_VIEWS);
        when(voteRepository.countByContentId(101)).thenReturn((long) MIN_VOTES);
        when(suggestionRepository.existsByContentContentIdAndStatusIn(eq(101), anyCollection())).thenReturn(false);
        when(extractionGateway.extractRecipe(content)).thenReturn(coreExtraction());
        when(dishRepository.findByNameIgnoreCase("Bún gạo lứt rau củ")).thenReturn(Optional.empty());

        boolean created = service.evaluateContent(content);

        assertTrue(created);
        verify(extractionGateway).extractRecipe(content);
    }
}
