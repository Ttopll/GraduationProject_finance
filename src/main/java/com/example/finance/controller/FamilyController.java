package com.example.finance.controller;

import com.example.finance.dto.FamilyApiModels;
import com.example.finance.entity.Family;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FamilyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/families")
public class FamilyController {

    private final FamilyService familyService;
    private final FamilyAccessService familyAccessService;

    public FamilyController(FamilyService familyService, FamilyAccessService familyAccessService) {
        this.familyService = familyService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FamilyApiModels.Response create(@Valid @RequestBody FamilyApiModels.CreateRequest request) {
        familyAccessService.requireCurrentUserMatches(request.ownerUserId());
        return toResponse(familyService.create(request));
    }

    @GetMapping
    public List<FamilyApiModels.Response> list() {
        return familyAccessService.listAccessibleFamilies().stream()
                .map(FamilyController::toResponse)
                .toList();
    }

    @GetMapping("/{familyId}")
    public FamilyApiModels.Response getById(@PathVariable Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return toResponse(familyService.getById(familyId));
    }

    private static FamilyApiModels.Response toResponse(Family family) {
        return new FamilyApiModels.Response(
                family.getId(),
                family.getFamilyName(),
                family.getOwnerUserId(),
                family.getInviteCode(),
                family.getCurrencyCode(),
                family.getTimezone(),
                family.getStatus(),
                family.getRemark()
        );
    }
}
