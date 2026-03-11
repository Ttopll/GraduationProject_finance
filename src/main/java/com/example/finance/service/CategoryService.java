package com.example.finance.service;

import com.example.finance.dto.CategoryApiModels;
import com.example.finance.entity.Category;
import com.example.finance.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;

    public CategoryService(CategoryRepository categoryRepository, FamilyService familyService) {
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
    }

    public Category create(CategoryApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        if (request.parentId() != null) {
            Category parent = getById(request.parentId());
            if (!request.familyId().equals(parent.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "父分类不属于当前家庭");
            }
        }

        Category category = new Category();
        category.setFamilyId(request.familyId());
        category.setParentId(request.parentId());
        category.setCategoryName(request.categoryName().trim());
        category.setCategoryType(request.categoryType().trim().toUpperCase(Locale.ROOT));
        category.setScopeType(StringUtils.hasText(request.scopeType())
                ? request.scopeType().trim().toUpperCase(Locale.ROOT)
                : "FAMILY");
        category.setIconCode(normalize(request.iconCode()));
        category.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        category.setEnabled(1);
        return categoryRepository.save(category);
    }

    public List<Category> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId);
    }

    public Category getById(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
