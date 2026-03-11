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
        if (request.familyId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "familyId 不能为空");
        }
        familyService.getById(request.familyId());
        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "归类分类不存在"));
        if (!request.familyId().equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "归类分类不属于当前家庭");
        }
        if (!StringUtils.hasText(request.merchantKeyword()) && !StringUtils.hasText(request.regexPattern())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商户关键词和正则表达式至少填写一个");
        }
        if (StringUtils.hasText(request.regexPattern())) {
            try {
                Pattern.compile(request.regexPattern().trim());
            } catch (PatternSyntaxException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "正则表达式不合法");
            }
        }

        BillParseRule rule = new BillParseRule();
        rule.setFamilyId(request.familyId());
        rule.setCategoryId(request.categoryId());
        rule.setMerchantKeyword(normalize(request.merchantKeyword()));
        rule.setRegexPattern(normalize(request.regexPattern()));
        rule.setPriority(request.priority() == null ? 100 : request.priority());
        rule.setEnabled(1);
        rule.setHitCount(0);
        return billParseRuleRepository.save(rule);
    }

    public List<BillParseRuleApiModels.Response> list(Long familyId) {
        familyService.getById(familyId);
        Map<Long, String> categoryNameMap = categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId).stream()
                .collect(Collectors.toMap(Category::getId, Category::getCategoryName));
        return billParseRuleRepository.findByFamilyIdOrderByPriorityAscIdAsc(familyId).stream()
                .map(rule -> new BillParseRuleApiModels.Response(
                        rule.getId(),
                        rule.getFamilyId(),
                        rule.getCategoryId(),
                        categoryNameMap.get(rule.getCategoryId()),
                        rule.getMerchantKeyword(),
                        rule.getRegexPattern(),
                        rule.getPriority(),
                        rule.getEnabled(),
                        rule.getHitCount(),
                        rule.getLastHitAt()
                ))
                .toList();
    }

    public MatchResult match(Long familyId, String merchantName) {
        if (!StringUtils.hasText(merchantName)) {
            return MatchResult.noMatch();
        }
        String normalizedMerchant = merchantName.trim();
        List<BillParseRule> candidates = new ArrayList<>();
        candidates.addAll(billParseRuleRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, 1));
        candidates.addAll(billParseRuleRepository.findByFamilyIdIsNullAndEnabledOrderByPriorityAscIdAsc(1));
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
