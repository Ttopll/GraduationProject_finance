package com.example.finance.service;

import com.example.finance.dto.BillParseRuleApiModels;
import com.example.finance.entity.BillParseRule;
import com.example.finance.entity.Category;
import com.example.finance.repository.BillParseRuleRepository;
import com.example.finance.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;

@Service
public class BillParseRuleService {

    private static final int ENABLED = 1;
    private static final int DISABLED = 0;

    private final BillParseRuleRepository billParseRuleRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;

    public BillParseRuleService(
            BillParseRuleRepository billParseRuleRepository,
            CategoryRepository categoryRepository,
            FamilyService familyService
    ) {
        this.billParseRuleRepository = billParseRuleRepository;
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
    }

    @Transactional
    public BillParseRule create(BillParseRuleApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateCategoryBelongsToFamily(request.familyId(), request.categoryId());
        validateMatcher(request.merchantKeyword(), request.regexPattern());

        BillParseRule rule = new BillParseRule();
        rule.setFamilyId(request.familyId());
        rule.setCategoryId(request.categoryId());
        rule.setMerchantKeyword(normalize(request.merchantKeyword()));
        rule.setRegexPattern(normalize(request.regexPattern()));
        rule.setPriority(request.priority() == null ? 100 : request.priority());
        rule.setEnabled(ENABLED);
        rule.setHitCount(0);
        return billParseRuleRepository.save(rule);
    }

    @Transactional
    public BillParseRule update(Long ruleId, BillParseRuleApiModels.UpdateRequest request) {
        BillParseRule rule = getById(ruleId);
        familyService.getById(rule.getFamilyId());
        validateCategoryBelongsToFamily(rule.getFamilyId(), request.categoryId());
        validateMatcher(request.merchantKeyword(), request.regexPattern());

        rule.setCategoryId(request.categoryId());
        rule.setMerchantKeyword(normalize(request.merchantKeyword()));
        rule.setRegexPattern(normalize(request.regexPattern()));
        rule.setPriority(request.priority() == null ? 100 : request.priority());
        return billParseRuleRepository.save(rule);
    }

    @Transactional
    public BillParseRule changeEnabled(Long ruleId, boolean enabled) {
        BillParseRule rule = getById(ruleId);
        familyService.getById(rule.getFamilyId());
        rule.setEnabled(enabled ? ENABLED : DISABLED);
        return billParseRuleRepository.save(rule);
    }

    @Transactional
    public void delete(Long ruleId) {
        BillParseRule rule = getById(ruleId);
        familyService.getById(rule.getFamilyId());
        billParseRuleRepository.delete(rule);
    }

    public BillParseRule getById(Long ruleId) {
        return billParseRuleRepository.findById(ruleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "bill parse rule not found"));
    }

    public BillParseRuleApiModels.Response getResponseById(Long ruleId) {
        BillParseRule rule = getById(ruleId);
        String categoryName = categoryRepository.findById(rule.getCategoryId())
                .map(Category::getCategoryName)
                .orElse(null);
        return toResponse(rule, categoryName);
    }

    public List<BillParseRuleApiModels.Response> list(Long familyId) {
        familyService.getById(familyId);
        Map<Long, String> categoryNameMap = categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId).stream()
                .collect(Collectors.toMap(Category::getId, Category::getCategoryName));
        return billParseRuleRepository.findByFamilyIdOrderByPriorityAscIdAsc(familyId).stream()
                .map(rule -> toResponse(rule, categoryNameMap.get(rule.getCategoryId())))
                .toList();
    }

    public MatchResult match(Long familyId, String merchantName) {
        if (!StringUtils.hasText(merchantName)) {
            return MatchResult.noMatch();
        }
        String normalizedMerchant = merchantName.trim();
        List<BillParseRule> candidates = new ArrayList<>();
        candidates.addAll(billParseRuleRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, ENABLED));
        candidates.addAll(billParseRuleRepository.findByFamilyIdIsNullAndEnabledOrderByPriorityAscIdAsc(ENABLED));
        candidates.sort(Comparator
                .comparing((BillParseRule rule) -> rule.getFamilyId() == null ? 1 : 0)
                .thenComparing(BillParseRule::getPriority)
                .thenComparing(BillParseRule::getId));

        for (BillParseRule rule : candidates) {
            if (matches(rule, normalizedMerchant)) {
                return new MatchResult(rule, rule.getCategoryId());
            }
        }
        return MatchResult.noMatch();
    }

    @Transactional
    public void markHit(BillParseRule rule) {
        rule.setHitCount(rule.getHitCount() + 1);
        rule.setLastHitAt(LocalDateTime.now());
        billParseRuleRepository.save(rule);
    }

    @Transactional
    public BillParseRule createKeywordRuleIfAbsent(Long familyId, Long categoryId, String merchantKeyword, Integer priority) {
        if (!StringUtils.hasText(merchantKeyword)) {
            return null;
        }
        String normalizedKeyword = merchantKeyword.trim();
        for (BillParseRule existingRule : billParseRuleRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, ENABLED)) {
            if (categoryId.equals(existingRule.getCategoryId())
                    && normalizedKeyword.equalsIgnoreCase(normalize(existingRule.getMerchantKeyword()))
                    && !StringUtils.hasText(existingRule.getRegexPattern())) {
                return existingRule;
            }
        }

        BillParseRuleApiModels.CreateRequest request = new BillParseRuleApiModels.CreateRequest(
                familyId,
                categoryId,
                normalizedKeyword,
                null,
                priority
        );
        return create(request);
    }

    private void validateCategoryBelongsToFamily(Long familyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "bill parse category not found"));
        if (!familyId.equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bill parse category does not belong to family");
        }
    }

    private void validateMatcher(String merchantKeyword, String regexPattern) {
        if (!StringUtils.hasText(merchantKeyword) && !StringUtils.hasText(regexPattern)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "merchantKeyword and regexPattern cannot both be empty"
            );
        }
        if (StringUtils.hasText(regexPattern)) {
            try {
                Pattern.compile(regexPattern.trim());
            } catch (PatternSyntaxException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid regexPattern");
            }
        }
    }

    private boolean matches(BillParseRule rule, String merchantName) {
        if (StringUtils.hasText(rule.getMerchantKeyword())
                && merchantName.toLowerCase(Locale.ROOT).contains(rule.getMerchantKeyword().trim().toLowerCase(Locale.ROOT))) {
            return true;
        }
        if (StringUtils.hasText(rule.getRegexPattern())) {
            return Pattern.compile(rule.getRegexPattern().trim(), Pattern.CASE_INSENSITIVE)
                    .matcher(merchantName)
                    .find();
        }
        return false;
    }

    private BillParseRuleApiModels.Response toResponse(BillParseRule rule, String categoryName) {
        return new BillParseRuleApiModels.Response(
                rule.getId(),
                rule.getFamilyId(),
                rule.getCategoryId(),
                categoryName,
                rule.getMerchantKeyword(),
                rule.getRegexPattern(),
                rule.getPriority(),
                rule.getEnabled(),
                rule.getHitCount(),
                rule.getLastHitAt()
        );
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    public record MatchResult(BillParseRule rule, Long categoryId) {
        public static MatchResult noMatch() {
            return new MatchResult(null, null);
        }

        public boolean matched() {
            return rule != null && categoryId != null;
        }
    }
}
