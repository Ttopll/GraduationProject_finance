package com.example.finance.service;

import com.example.finance.dto.CategoryApiModels;
import com.example.finance.entity.Category;
import com.example.finance.repository.BillParseRuleRepository;
import com.example.finance.repository.BudgetPlanRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class CategoryService {

    private static final int ENABLED = 1;
    private static final int DISABLED = 0;

    private final CategoryRepository categoryRepository;
    private final BudgetPlanRepository budgetPlanRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final BillParseRuleRepository billParseRuleRepository;
    private final FamilyService familyService;

    public CategoryService(
            CategoryRepository categoryRepository,
            BudgetPlanRepository budgetPlanRepository,
            TransactionRecordRepository transactionRecordRepository,
            RuleDefinitionRepository ruleDefinitionRepository,
            BillParseRuleRepository billParseRuleRepository,
            FamilyService familyService
    ) {
        this.categoryRepository = categoryRepository;
        this.budgetPlanRepository = budgetPlanRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.ruleDefinitionRepository = ruleDefinitionRepository;
        this.billParseRuleRepository = billParseRuleRepository;
        this.familyService = familyService;
    }

    public Category create(CategoryApiModels.CreateRequest request) {
        familyService.getById(request.familyId());

        Category category = new Category();
        category.setFamilyId(request.familyId());
        applyCategoryFields(
                category,
                request.familyId(),
                request.parentId(),
                request.categoryName(),
                request.categoryType(),
                request.scopeType(),
                request.iconCode(),
                request.sortOrder()
        );
        category.setEnabled(ENABLED);
        return categoryRepository.save(category);
    }

    public Category update(Long categoryId, CategoryApiModels.UpdateRequest request) {
        Category category = getById(categoryId);
        familyService.getById(category.getFamilyId());
        applyCategoryFields(
                category,
                category.getFamilyId(),
                request.parentId(),
                request.categoryName(),
                request.categoryType(),
                request.scopeType(),
                request.iconCode(),
                request.sortOrder()
        );
        return categoryRepository.save(category);
    }

    public Category changeEnabled(Long categoryId, boolean enabled) {
        Category category = getById(categoryId);
        familyService.getById(category.getFamilyId());
        category.setEnabled(enabled ? ENABLED : DISABLED);
        return categoryRepository.save(category);
    }

    public void delete(Long categoryId) {
        Category category = getById(categoryId);
        familyService.getById(category.getFamilyId());

        Long familyId = category.getFamilyId();
        if (categoryRepository.existsByFamilyIdAndParentId(familyId, categoryId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category has child categories");
        }
        if (budgetPlanRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category is referenced by budgets");
        }
        if (transactionRecordRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category is referenced by transaction records");
        }
        if (ruleDefinitionRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category is referenced by rules");
        }
        if (billParseRuleRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category is referenced by bill parse rules");
        }
        categoryRepository.delete(category);
    }

    public List<Category> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId);
    }

    public Category getById(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));
    }

    private void applyCategoryFields(
            Category category,
            Long familyId,
            Long parentId,
            String categoryName,
            String categoryType,
            String scopeType,
            String iconCode,
            Integer sortOrder
    ) {
        if (parentId != null) {
            Category parent = getById(parentId);
            if (!familyId.equals(parent.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent category does not belong to family");
            }
            if (category.getId() != null && category.getId().equals(parentId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "category parent cannot be self");
            }
        }

        category.setParentId(parentId);
        category.setCategoryName(categoryName.trim());
        category.setCategoryType(categoryType.trim().toUpperCase(Locale.ROOT));
        category.setScopeType(StringUtils.hasText(scopeType) ? scopeType.trim().toUpperCase(Locale.ROOT) : "FAMILY");
        category.setIconCode(normalize(iconCode));
        category.setSortOrder(sortOrder == null ? 0 : sortOrder);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
