package com.example.finance.service;

import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.util.RuleThresholdConfigUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class RuleDefinitionService {

    private static final int ENABLED = 1;
    private static final int DISABLED = 0;
    private static final int DEFAULT_PRIORITY = 100;

    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyService familyService;

    public RuleDefinitionService(
            RuleDefinitionRepository ruleDefinitionRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            FamilyService familyService
    ) {
        this.ruleDefinitionRepository = ruleDefinitionRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.familyService = familyService;
    }

    @Transactional
    public RuleDefinition create(RuleDefinitionApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateCategoryBelongsToFamily(request.familyId(), request.categoryId());
        validateCreatorMember(request.familyId(), request.createdByMemberId());

        RuleNormalizedValues values = normalizeAndValidate(
                request.categoryId(),
                request.ruleName(),
                request.ruleType(),
                request.metricType(),
                request.timeScope(),
                request.operatorType(),
                request.thresholdValue(),
                request.thresholdJson(),
                request.actionType(),
                request.messageTemplate(),
                request.priority()
        );

        RuleDefinition ruleDefinition = new RuleDefinition();
        ruleDefinition.setFamilyId(request.familyId());
        ruleDefinition.setCreatedByMemberId(request.createdByMemberId());
        applyRuleFields(ruleDefinition, values);
        ruleDefinition.setEnabled(ENABLED);
        return ruleDefinitionRepository.save(ruleDefinition);
    }

    @Transactional
    public RuleDefinition update(Long ruleId, RuleDefinitionApiModels.UpdateRequest request) {
        RuleDefinition ruleDefinition = getById(ruleId);
        familyService.getById(ruleDefinition.getFamilyId());
        validateCategoryBelongsToFamily(ruleDefinition.getFamilyId(), request.categoryId());
        validateCreatorMember(ruleDefinition.getFamilyId(), request.createdByMemberId());

        RuleNormalizedValues values = normalizeAndValidate(
                request.categoryId(),
                request.ruleName(),
                request.ruleType(),
                request.metricType(),
                request.timeScope(),
                request.operatorType(),
                request.thresholdValue(),
                request.thresholdJson(),
                request.actionType(),
                request.messageTemplate(),
                request.priority()
        );

        if (request.createdByMemberId() != null) {
            ruleDefinition.setCreatedByMemberId(request.createdByMemberId());
        }
        applyRuleFields(ruleDefinition, values);
        return ruleDefinitionRepository.save(ruleDefinition);
    }

    @Transactional
    public RuleDefinition changeEnabled(Long ruleId, boolean enabled) {
        RuleDefinition ruleDefinition = getById(ruleId);
        familyService.getById(ruleDefinition.getFamilyId());
        ruleDefinition.setEnabled(enabled ? ENABLED : DISABLED);
        return ruleDefinitionRepository.save(ruleDefinition);
    }

    @Transactional
    public void delete(Long ruleId) {
        RuleDefinition ruleDefinition = getById(ruleId);
        familyService.getById(ruleDefinition.getFamilyId());
        ruleDefinitionRepository.delete(ruleDefinition);
    }

    public RuleDefinition getById(Long ruleId) {
        return ruleDefinitionRepository.findById(ruleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "rule definition not found"));
    }

    public List<RuleDefinition> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return ruleDefinitionRepository.findByFamilyIdOrderByPriorityAscIdAsc(familyId);
    }

    private void applyRuleFields(RuleDefinition ruleDefinition, RuleNormalizedValues values) {
        ruleDefinition.setCategoryId(values.categoryId());
        ruleDefinition.setRuleName(values.ruleName());
        ruleDefinition.setRuleType(values.ruleType());
        ruleDefinition.setMetricType(values.metricType());
        ruleDefinition.setTimeScope(values.timeScope());
        ruleDefinition.setOperatorType(values.operatorType());
        ruleDefinition.setThresholdValue(values.thresholdValue());
        ruleDefinition.setThresholdJson(values.thresholdJson());
        ruleDefinition.setActionType(values.actionType());
        ruleDefinition.setMessageTemplate(values.messageTemplate());
        ruleDefinition.setPriority(values.priority());
    }

    private void validateCategoryBelongsToFamily(Long familyId, Long categoryId) {
        if (categoryId == null) {
            return;
        }
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "rule category not found"));
        if (!familyId.equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rule category does not belong to family");
        }
    }

    private void validateCreatorMember(Long familyId, Long createdByMemberId) {
        if (createdByMemberId == null) {
            return;
        }
        FamilyMember familyMember = familyMemberRepository.findById(createdByMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "rule creator member not found"));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rule creator member does not belong to family");
        }
    }

    private RuleNormalizedValues normalizeAndValidate(
            Long categoryId,
            String ruleName,
            String ruleTypeInput,
            String metricTypeInput,
            String timeScopeInput,
            String operatorTypeInput,
            BigDecimal thresholdValue,
            String thresholdJsonInput,
            String actionTypeInput,
            String messageTemplate,
            Integer priorityInput
    ) {
        String ruleType = ruleTypeInput.trim().toUpperCase(Locale.ROOT);
        String metricType = metricTypeInput.trim().toUpperCase(Locale.ROOT);
        String timeScope = timeScopeInput.trim().toUpperCase(Locale.ROOT);
        String operatorType = operatorTypeInput.trim().toUpperCase(Locale.ROOT);
        String actionType = actionTypeInput.trim().toUpperCase(Locale.ROOT);

        if (!List.of("THRESHOLD", "CONSECUTIVE_THRESHOLD", "TREND_ANOMALY").contains(ruleType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "ruleType only supports THRESHOLD, CONSECUTIVE_THRESHOLD, TREND_ANOMALY"
            );
        }
        if (!List.of("CATEGORY_EXPENSE", "FAMILY_EXPENSE").contains(metricType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "metricType only supports CATEGORY_EXPENSE or FAMILY_EXPENSE"
            );
        }
        if (!List.of("MONTH", "YEAR").contains(timeScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "timeScope only supports MONTH or YEAR");
        }
        if (!List.of("GT", "GTE", "LT", "LTE", "EQ").contains(operatorType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported operatorType");
        }
        if (!"NOTIFY".equals(actionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "actionType only supports NOTIFY");
        }
        if ("CATEGORY_EXPENSE".equals(metricType) && categoryId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CATEGORY_EXPENSE requires categoryId");
        }
        if ("CONSECUTIVE_THRESHOLD".equals(ruleType) && !"MONTH".equals(timeScope)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "CONSECUTIVE_THRESHOLD only supports MONTH timeScope"
            );
        }
        if ("TREND_ANOMALY".equals(ruleType) && !"MONTH".equals(timeScope)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "TREND_ANOMALY only supports MONTH timeScope"
            );
        }
        if ("TREND_ANOMALY".equals(ruleType) && !List.of("GT", "GTE").contains(operatorType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "TREND_ANOMALY only supports GT or GTE operatorType"
            );
        }

        String normalizedThresholdJson;
        try {
            normalizedThresholdJson = RuleThresholdConfigUtil.normalizeThresholdJson(ruleType, thresholdJsonInput);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }

        return new RuleNormalizedValues(
                categoryId,
                ruleName.trim(),
                ruleType,
                metricType,
                timeScope,
                operatorType,
                thresholdValue,
                normalizedThresholdJson,
                actionType,
                messageTemplate.trim(),
                priorityInput == null ? DEFAULT_PRIORITY : priorityInput
        );
    }

    private record RuleNormalizedValues(
            Long categoryId,
            String ruleName,
            String ruleType,
            String metricType,
            String timeScope,
            String operatorType,
            BigDecimal thresholdValue,
            String thresholdJson,
            String actionType,
            String messageTemplate,
            Integer priority
    ) {
    }
}
