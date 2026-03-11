package com.example.finance.controller;

import com.example.finance.dto.CategoryApiModels;
import com.example.finance.entity.Category;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;
    private final FamilyAccessService familyAccessService;

    public CategoryController(CategoryService categoryService, FamilyAccessService familyAccessService) {
        this.categoryService = categoryService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryApiModels.Response create(@Valid @RequestBody CategoryApiModels.CreateRequest request) {
        familyAccessService.requireFamilyOwner(request.familyId());
        return toResponse(categoryService.create(request));
    }

    @GetMapping
    public List<CategoryApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return categoryService.listByFamilyId(familyId).stream()
                .map(CategoryController::toResponse)
                .toList();
    }

    private static CategoryApiModels.Response toResponse(Category category) {
        return new CategoryApiModels.Response(
                category.getId(),
                category.getFamilyId(),
                category.getParentId(),
                category.getCategoryName(),
                category.getCategoryType(),
                category.getScopeType(),
                category.getIconCode(),
                category.getSortOrder(),
                category.getEnabled()
        );
    }
}
